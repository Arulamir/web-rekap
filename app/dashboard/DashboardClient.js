'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { rupiah, tanggal, kategoriLabel, compressImage } from '@/lib/format';

const MAX_ITEMS = 10;
let keySeq = 0;
const emptyItem = () => ({ key: ++keySeq, item: '', price: '', file: null, preview: '' });

export default function DashboardClient({ userName }) {
  const [step, setStep] = useState(1);
  const [project, setProject] = useState('');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [photoMode, setPhotoMode] = useState('per-item');
  const [sharedPhoto, setSharedPhoto] = useState({ file: null, preview: '' });
  const [processingPhotos, setProcessingPhotos] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [projects, setProjects] = useState([]);
  const [history, setHistory] = useState(null);

  useEffect(() => () => {
    if (sharedPhoto.preview) URL.revokeObjectURL(sharedPhoto.preview);
  }, [sharedPhoto.preview]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/reimburse');
      setHistory(res.ok ? (await res.json()).rows : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d) => setProjects(d.projects));
  }, [loadHistory]);

  const updateItem = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const removeItem = (key) =>
    setItems((list) => {
      const it = list.find((x) => x.key === key);
      if (it?.preview) URL.revokeObjectURL(it.preview);
      return list.filter((x) => x.key !== key);
    });

  async function onPhoto(key, file) {
    if (!file) return;
    setError('');
    setProcessingPhotos((count) => count + 1);
    try {
      const compressed = await compressImage(file);
      setItems((list) =>
        list.map((it) => {
          if (it.key !== key) return it;
          if (it.preview) URL.revokeObjectURL(it.preview);
          return { ...it, file: compressed, preview: URL.createObjectURL(compressed) };
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessingPhotos((count) => count - 1);
    }
  }

  async function onSharedPhoto(file) {
    if (!file) return;
    setError('');
    setProcessingPhotos((count) => count + 1);
    try {
      const compressed = await compressImage(file);
      setSharedPhoto({ file: compressed, preview: URL.createObjectURL(compressed) });
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessingPhotos((count) => count - 1);
    }
  }

  const total = items.reduce((s, it) => s + (Number(it.price) || 0), 0);

  async function submit() {
    if (submitting || processingPhotos > 0) return;
    setError('');
    if (photoMode === 'shared' && !sharedPhoto.file) return setError('Unggah satu foto nota untuk semua item.');
    for (const [i, it] of items.entries()) {
      if (!it.item.trim()) return setError(`Item #${i + 1}: isi nama barang.`);
      if (!(Number(it.price) > 0)) return setError(`Item #${i + 1}: isi harga.`);
      if (photoMode === 'per-item' && !it.file) return setError(`Item #${i + 1}: unggah foto nota/barang.`);
    }
    const fd = new FormData();
    fd.append('project', project.trim());
    fd.append('category', category);
    fd.append('items', JSON.stringify(items.map((it) => ({ item: it.item.trim(), price: Number(it.price) }))));
    fd.append('photo_mode', photoMode);
    if (photoMode === 'shared') fd.append('photo_shared', sharedPhoto.file);
    else items.forEach((it, i) => fd.append(`photo_${i}`, it.file));

    setSubmitting(true);
    try {
      const res = await fetch('/api/reimburse', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || 'Gagal menyimpan.');
      items.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
      setSuccess(`${data.count} item untuk project "${project.trim()}" berhasil disimpan.`);
      setItems([emptyItem()]);
      setSharedPhoto({ file: null, preview: '' });
      setCategory('');
      setStep(1);
      if (!projects.includes(project.trim())) setProjects([project.trim(), ...projects]);
      loadHistory();
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id) {
    if (!confirm('Hapus data reimburse ini?')) return;
    const res = await fetch(`/api/reimburse/${id}`, { method: 'DELETE' });
    if (res.ok) loadHistory();
  }

  return (
    <div className="grid-2">
      <section className="card">
        <h2>Input Reimburse</h2>
        <p className="muted">Dicatat atas nama <b>{userName}</b></p>

        <ol className="stepper">
          {['Project', 'Kategori', 'Detail item'].map((label, i) => (
            <li key={label} className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''}>
              <span>{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {success && step === 1 && <div className="alert success">{success}</div>}
        {error && <div className="alert error">{error}</div>}

        {step === 1 && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (project.trim()) {
                setSuccess('');
                setStep(2);
              }
            }}
          >
            <label className="field">
              <span>Nama project</span>
              <input
                list="project-list"
                placeholder="Ketik nama project, mis. Renovasi Gudang A"
                maxLength={150}
                required
                autoFocus
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
              <datalist id="project-list">
                {projects.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <button className="btn btn-primary">Lanjut</button>
          </form>
        )}

        {step === 2 && (
          <div className="stack">
            <Summary project={project} onEdit={() => setStep(1)} />
            <p className="label">Pilih jenis reimburse</p>
            <div className="choice-grid">
              {[
                { v: 'operasional', t: 'Operasional', d: 'Transport, makan, bensin, parkir, dll.' },
                { v: 'material', t: 'Material', d: 'Bahan, alat, dan barang untuk project' },
              ].map((c) => (
                <button
                  key={c.v}
                  type="button"
                  className={`choice ${category === c.v ? 'selected' : ''}`}
                  onClick={() => {
                    setCategory(c.v);
                    setStep(3);
                  }}
                >
                  <b>{c.t}</b>
                  <small>{c.d}</small>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Kembali</button>
          </div>
        )}

        {step === 3 && (
          <fieldset className="stack reimburse-fields" disabled={submitting || processingPhotos > 0}>
            <Summary project={project} category={category} onEdit={() => setStep(2)} />
            <label className="field">
              <span>Penggunaan foto nota</span>
              <select value={photoMode} onChange={(e) => { setPhotoMode(e.target.value); setError(''); }}>
                <option value="per-item">Foto berbeda untuk tiap item</option>
                <option value="shared">Satu foto nota untuk semua item</option>
              </select>
            </label>
            {photoMode === 'shared' && (
              <div className="item-card">
                <p className="muted">Unggah nota sekali, lalu isi nama dan harga masing-masing item di bawah. Foto ini digunakan untuk semua item dalam pengajuan ini.</p>
                <PhotoUpload preview={sharedPhoto.preview} onPhoto={onSharedPhoto} label="Foto nota bersama" />
              </div>
            )}
            {items.map((it, i) => (
              <ItemCard
                key={it.key}
                index={i}
                it={it}
                canRemove={items.length > 1}
                onChange={(patch) => updateItem(it.key, patch)}
                onPhoto={(f) => onPhoto(it.key, f)}
                onRemove={() => removeItem(it.key)}
                showPhoto={photoMode === 'per-item'}
              />
            ))}
            {items.length < MAX_ITEMS && (
              <button type="button" className="btn btn-ghost" onClick={() => setItems([...items, emptyItem()])}>
                + Tambah item
              </button>
            )}
            <div className="total-bar">
              <span>Total</span>
              <b>{rupiah(total)}</b>
            </div>
            <div className="row-gap">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(2)} disabled={submitting}>Kembali</button>
              <button type="button" className="btn btn-primary grow" onClick={submit} disabled={submitting}>
                {submitting ? 'Menyimpan…' : processingPhotos > 0 ? 'Memproses foto…' : 'Simpan Reimburse'}
              </button>
            </div>
          </fieldset>
        )}
      </section>

      <section className="card">
        <h2>Riwayat Saya</h2>
        {history === null ? (
          <p className="muted">Memuat…</p>
        ) : history.length === 0 ? (
          <p className="muted">Belum ada data reimburse.</p>
        ) : (
          <>
            <p className="muted">
              {history.length} item · Total <b>{rupiah(history.reduce((s, r) => s + Number(r.price), 0))}</b>
            </p>
            <ul className="history">
              {history.map((r) => (
                <li key={r.id}>
                  <a href={`/api/photo/${r.id}`} target="_blank" rel="noreferrer">
                    <img src={`/api/photo/${r.id}`} alt={r.item} loading="lazy" />
                  </a>
                  <div className="grow">
                    <b>{r.item}</b>
                    <small className="muted">
                      {r.project} · <span className={`tag ${r.category}`}>{kategoriLabel(r.category)}</span>
                    </small>
                    <small className="muted">{tanggal(r.created_at)}</small>
                  </div>
                  <div className="right">
                    <b>{rupiah(r.price)}</b>
                    <button className="link-danger" onClick={() => remove(r.id)}>Hapus</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Summary({ project, category, onEdit }) {
  return (
    <div className="summary">
      <div>
        <small className="muted">Project</small>
        <b>{project}</b>
        {category && (
          <span className={`tag ${category}`} style={{ marginLeft: 8 }}>{kategoriLabel(category)}</span>
        )}
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>Ubah</button>
    </div>
  );
}

function ItemCard({ index, it, canRemove, onChange, onPhoto, onRemove, showPhoto }) {
  return (
    <div className="item-card">
      <div className="item-head">
        <b>Item #{index + 1}</b>
        {canRemove && (
          <button type="button" className="link-danger" onClick={onRemove}>Hapus</button>
        )}
      </div>
      <label className="field">
        <span>Barang / item yang dibeli</span>
        <input maxLength={200} placeholder="mis. Semen 50kg x 10 sak" value={it.item} onChange={(e) => onChange({ item: e.target.value })} />
      </label>
      <label className="field">
        <span>Harga (Rp)</span>
        <input
          inputMode="numeric"
          placeholder="0"
          value={it.price ? Number(it.price).toLocaleString('id-ID') : ''}
          onChange={(e) => onChange({ price: e.target.value.replace(/\D/g, '').slice(0, 15) })}
        />
      </label>
      {showPhoto && <PhotoUpload preview={it.preview} onPhoto={onPhoto} label={`Foto nota / barang item #${index + 1}`} />}
    </div>
  );
}

function PhotoUpload({ preview, onPhoto, label }) {
  const inputRef = useRef(null);
  return (
      <div className="field">
        <span>{label}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label={label}
          hidden
          onChange={(e) => {
            onPhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {preview ? (
          <div className="photo-preview">
            <img src={preview} alt={label} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}>Ganti foto</button>
          </div>
        ) : (
          <button type="button" className="upload-box" onClick={() => inputRef.current?.click()}>
            Ambil / pilih foto
          </button>
        )}
      </div>
  );
}
