'use client';

import { useEffect, useRef, useState } from 'react';
import { parseReceiptText } from '@/lib/receipt-parser';
import { lineTotal, normalizeItem } from '@/lib/reimburse-item';
import { rupiah } from '@/lib/format';

export default function ReceiptOcr({ file, available, onApply, onBusy, onDateDetected, onUseDate }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [receiptTotal, setReceiptTotal] = useState(null);
  const [detectedDate, setDetectedDate] = useState('');
  const [dateWarning, setDateWarning] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const workerRef = useRef(null);
  const runRef = useRef(0);

  useEffect(() => {
    setText(''); setCandidates([]); setReceiptTotal(null); setDetectedDate(''); setDateWarning(''); setError(''); setMessage('');
  }, [file]);
  useEffect(() => () => {
    runRef.current++;
    workerRef.current?.terminate();
    onBusy(false);
  }, [onBusy]);

  function parse(value) {
    const result = parseReceiptText(value);
    setCandidates(result.items.map((item, id) => ({ ...item, id, selected: true })));
    setReceiptTotal(result.receiptTotal);
    setDetectedDate(result.purchaseDate);
    setDateWarning(result.dateWarning);
    if (result.purchaseDate) onDateDetected?.(result.purchaseDate);
    setMessage(result.items.length ? `${result.items.length} calon item ditemukan. Periksa dan edit sebelum digunakan.` : 'Item dan harga belum terbaca. Perbaiki teks bacaan atau isi item secara manual.');
  }

  async function scan() {
    if (!file || busy) return;
    const run = ++runRef.current;
    setBusy(true); onBusy(true); setError(''); setMessage(''); setProgress(0);
    let timer;
    try {
      const job = (async () => {
        const { createWorker } = await import('tesseract.js');
        const origin = window.location.origin;
        const worker = await createWorker(['ind', 'eng'], 1, {
          workerPath: `${origin}/ocr/worker.min.js`,
          corePath: `${origin}/ocr`,
          langPath: `${origin}/ocr`,
          workerBlobURL: false,
          logger: ({ status, progress: p }) => {
            if (runRef.current === run && status === 'recognizing text') setProgress(Math.round((p || 0) * 100));
          },
        });
        if (runRef.current !== run) { await worker.terminate(); return null; }
        workerRef.current = worker;
        await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '6' });
        return worker.recognize(file);
      })();
      const result = await Promise.race([job, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('OCR terlalu lama. Coba foto yang lebih jelas atau isi secara manual.')), 120000);
      })]);
      if (runRef.current !== run || !result) return;
      setText(result.data.text);
      parse(result.data.text);
    } catch (err) {
      if (runRef.current === run) setError(err.message || 'OCR gagal dimuat. Coba lagi atau isi manual.');
    } finally {
      clearTimeout(timer);
      if (runRef.current === run) {
        runRef.current++;
        workerRef.current?.terminate(); workerRef.current = null;
        setBusy(false); onBusy(false);
      }
    }
  }

  function cancel() {
    runRef.current++;
    workerRef.current?.terminate(); workerRef.current = null;
    setBusy(false); onBusy(false); setMessage('Pembacaan dibatalkan. Anda tetap bisa mengisi item secara manual.');
  }

  function patch(id, values) {
    setCandidates((list) => list.map((item) => item.id === id ? { ...item, ...values } : item));
  }
  const chosen = candidates.filter((item) => item.selected);
  const total = chosen.reduce((sum, item) => sum + lineTotal(item.quantity, item.price), 0);

  function apply() {
    setError('');
    if (!chosen.length) return setError('Pilih minimal satu item hasil OCR.');
    if (chosen.length > available) return setError(`Tersedia ${available} slot item. Kurangi pilihan atau hapus item pada formulir terlebih dahulu (maks. 10 item).`);
    try {
      chosen.forEach((item) => normalizeItem({ item: item.item, quantity: item.quantity, unit_price: item.price }));
      onApply(chosen);
      setCandidates([]); setMessage('Draf ditambahkan ke formulir. Periksa kembali, lalu klik Simpan Reimburse.');
    } catch (err) { setError(err.message); }
  }

  return (
    <section className="ocr-panel stack" aria-label="Baca nota otomatis">
      <p className="muted">OCR berjalan di browser tanpa API key. Untuk tulisan tangan, hasil bisa meleset. Putar foto sampai tegak, lalu periksa nama, Qty, dan harga.</p>
      <div className="row-gap">
        <button type="button" className="btn btn-primary btn-sm" disabled={!file || busy} onClick={scan}>{busy ? `Membaca nota… ${progress}%` : 'Baca item & harga (OCR)'}</button>
        {busy && <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>Batalkan OCR</button>}
      </div>
      {busy && <progress max="100" value={progress} aria-label="Kemajuan OCR" />}
      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <p role="status">{message}</p>}
      {detectedDate && <div className="stack">
        <p>Tanggal nota dari OCR: <b>{detectedDate}</b>. Periksa kembali, terutama tahunnya. Tanggal yang sudah diisi manual tidak ditimpa otomatis.</p>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onUseDate?.(detectedDate)}>Gunakan tanggal OCR {detectedDate}</button>
      </div>}
      {dateWarning && <p className="alert error">{dateWarning}</p>}
      {text && !detectedDate && !dateWarning && <p className="muted">Tanggal nota belum terbaca. Isi tanggal beli secara manual dengan format DD/MM/YY.</p>}
      {text && <details>
        <summary>Teks yang terbaca (bisa diedit)</summary>
        <label className="field"><span>Teks OCR</span><textarea rows={8} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} /></label>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => parse(text)}>Susun draf dari teks</button>
      </details>}
      {candidates.length > 0 && <>
        <p className="muted">{chosen.length} dipilih · {available} slot tersedia · Total draf {rupiah(total)}</p>
        {receiptTotal !== null && <p className={receiptTotal !== total ? 'alert error' : 'muted'}>Total nota yang terbaca: {rupiah(receiptTotal)}{receiptTotal !== total ? '. Belum cocok dengan total draf. Periksa kembali.' : ''}</p>}
        {candidates.map((item) => <div className="item-card" key={item.id}>
          <label className="check-label"><input type="checkbox" checked={item.selected} disabled={busy} onChange={(e) => patch(item.id, { selected: e.target.checked })} /> Gunakan calon item #{item.id + 1}</label>
          <label className="field"><span>Nama hasil OCR #{item.id + 1}</span><input value={item.item} maxLength={200} disabled={busy} onChange={(e) => patch(item.id, { item: e.target.value })} /></label>
          <div className="item-amounts">
            <label className="field"><span>Qty hasil OCR #{item.id + 1}</span><input inputMode="decimal" value={item.quantity} disabled={busy} onChange={(e) => patch(item.id, { quantity: e.target.value.replace(',', '.') })} /></label>
            <label className="field"><span>Harga satuan hasil OCR #{item.id + 1}</span><input inputMode="numeric" value={item.price} disabled={busy} onChange={(e) => patch(item.id, { price: e.target.value.replace(/\D/g, '') })} /></label>
          </div>
          <small className="muted">Total: {rupiah(lineTotal(item.quantity, item.price))}</small>
          {item.warning && <small className="alert error">{item.warning}</small>}
          <details><summary>Baris sumber OCR</summary><p>{item.source}</p></details>
        </div>)}
        <button type="button" className="btn btn-primary" disabled={busy || !chosen.length || chosen.length > available} onClick={apply}>Tambahkan {chosen.length} item terpilih ke formulir</button>
      </>}
    </section>
  );
}
