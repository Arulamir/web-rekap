'use client';

import { useEffect, useRef, useState } from 'react';
import { parseReceiptText } from '@/lib/receipt-parser';
import { lineTotal, normalizeItem } from '@/lib/reimburse-item';
import { rupiah } from '@/lib/format';
import { prepareReceiptImage } from '@/lib/receipt-image';
import { FULL_RECEIPT } from '@/lib/receipt-preprocess';

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
  const [crop, setCrop] = useState(FULL_RECEIPT);
  const [angle, setAngle] = useState(0);
  const [mode, setMode] = useState('contrast');
  const [layout, setLayout] = useState('3');
  const [sourceUrl, setSourceUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const workerRef = useRef(null);
  const runRef = useRef(0);

  useEffect(() => {
    setCrop(FULL_RECEIPT); setAngle(0); setMode('contrast'); setLayout('3');
    if (!file) { setSourceUrl(''); return; }
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    setText(''); setCandidates([]); setReceiptTotal(null); setDetectedDate(''); setDateWarning(''); setError(''); setMessage('');
    setPreview(null);
  }, [file, crop, angle, mode, layout]);
  useEffect(() => {
    if (!preview) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(preview);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);
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

  async function scan(previewOnly = false) {
    if (!file || busy) return;
    const run = ++runRef.current;
    setBusy(true); onBusy(true); setError(''); setMessage(''); setProgress(0);
    let timer;
    try {
      const job = (async () => {
        // Yield once so the busy state paints before the bounded pixel transform.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const prepared = await prepareReceiptImage(file, Number(angle), 3000, { crop, mode, lossless: true, upscale: true });
        if (runRef.current !== run) return null;
        setPreview(prepared);
        if (previewOnly) return null;
        const { createWorker } = await import('tesseract.js');
        if (runRef.current !== run) return null;
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
        await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: layout, user_defined_dpi: '300' });
        return worker.recognize(prepared);
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
      <p className="muted">OCR berjalan di browser tanpa API key. Batasi area ke nota atau tabel item agar meja tidak ikut terbaca. Pemrosesan hanya untuk OCR; foto bukti tetap utuh. Tulisan tangan tetap bisa meleset.</p>
      {sourceUrl && <details className="stack" open>
        <summary>Atur area & kejernihan OCR</summary>
        <p className="muted">Geser batas area baca. Untuk nota bertabel, coba fokus pada baris item saja. Jika tanggal di luar area, isi tanggal secara manual.</p>
        <div className="ocr-crop-view">
          <img src={sourceUrl} alt="Foto sumber untuk memilih area baca OCR" />
          <div className="ocr-crop-box" style={{ left: `${crop.left}%`, top: `${crop.top}%`, width: `${crop.right - crop.left}%`, height: `${crop.bottom - crop.top}%` }} />
        </div>
        <fieldset disabled={busy} className="ocr-settings">
          {Object.entries({ left: 'Batas kiri', right: 'Batas kanan', top: 'Batas atas', bottom: 'Batas bawah' }).map(([key, label]) => <label className="field" key={key}>
            <span>{label}: {crop[key]}%</span>
            <input type="range" aria-label={label} min={key === 'right' ? crop.left + 2 : key === 'bottom' ? crop.top + 2 : 0} max={key === 'left' ? crop.right - 2 : key === 'top' ? crop.bottom - 2 : 100} value={crop[key]} onChange={(e) => setCrop((value) => ({ ...value, [key]: Number(e.target.value) }))} />
          </label>)}
          <label className="field"><span>Luruskan: {angle}°</span><input type="range" aria-label="Luruskan foto" min="-15" max="15" step="0.5" value={angle} onChange={(e) => setAngle(Number(e.target.value))} /></label>
          <label className="field"><span>Pemrosesan gambar</span><select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="contrast">Kontras & ratakan pencahayaan</option><option value="binary">Hitam-putih adaptif</option><option value="original">Warna asli</option>
          </select></label>
          <label className="field"><span>Susunan teks</span><select value={layout} onChange={(e) => setLayout(e.target.value)}><option value="6">Baris item / tabel</option><option value="11">Teks tersebar</option><option value="3">Otomatis</option></select></label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCrop(FULL_RECEIPT); setAngle(0); }}>Reset area & sudut</button>
        </fieldset>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => scan(true)}>Pratinjau hasil pemrosesan</button>
        {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer"><img className="ocr-result-preview" src={previewUrl} alt="Pratinjau gambar yang digunakan OCR" /><span>Perbesar hasil pemrosesan</span></a>}
      </details>}
      <div className="row-gap">
        <button type="button" className="btn btn-primary btn-sm" disabled={!file || busy} onClick={() => scan()}>{busy ? `Memproses / membaca… ${progress}%` : 'Baca item & harga (OCR)'}</button>
        {busy && <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>Batalkan OCR</button>}
      </div>
      {busy && <progress max="100" value={progress} aria-label="Kemajuan OCR" />}
      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <p role="status">{message}</p>}
      {text && /\d\s*[-–]\s*\d{3}\b/.test(text) && <p className="alert error">Ada pemisah nominal yang ambigu (tanda minus). Baris tersebut tidak dijadikan draf otomatis. Periksa foto, lalu koreksi nominal di teks OCR atau isi item manual.</p>}
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
