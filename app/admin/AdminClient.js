'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { rupiah, tanggal, kategoriLabel } from '@/lib/format';

const emptyFilters = { project: '', category: '', from: '', to: '', user: '' };

function toQuery(f) {
  const qs = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
  return qs.toString();
}

const exportUrl = (f) => {
  const qs = toQuery(f);
  return `/api/export${qs ? `?${qs}` : ''}`;
};

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Gagal memuat data.');
  return data;
}

export default function AdminClient() {
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [rows, setRows] = useState(null);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const selectAllRef = useRef(null);
  const detailRef = useRef(null);

  const load = useCallback(async (f) => {
    setError('');
    setRows(null);
    setSelectedIds([]);
    const qsAll = toQuery({ ...f, user: '' });
    const qs = toQuery(f);
    try {
      const [list, ppl] = await Promise.all([
        getJson(`/api/reimburse?scope=all${qs ? `&${qs}` : ''}`),
        getJson(`/api/people${qsAll ? `?${qsAll}` : ''}`),
      ]);
      setRows(list.rows);
      setPeople(ppl.people);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load(applied);
  }, [applied, load]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.length > 0 && selectedIds.length < (rows?.length || 0);
    }
  }, [selectedIds, rows]);

  function showPerson(id) {
    const next = { ...applied, user: String(id) };
    setFilters({ ...filters, user: String(id) });
    setApplied(next);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function clearPerson() {
    setFilters({ ...filters, user: '' });
    setApplied({ ...applied, user: '' });
  }

  function toggleItem(id) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  }

  async function removeItems(ids) {
    if (deleting || ids.length === 0) return;
    if (!confirm(`Hapus ${ids.length} item reimburse yang dipilih beserta fotonya? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeleting(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/reimburse/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus item.');
      await load(applied);
      setNotice(`${data.count} item reimburse berhasil dihapus.`);
    } catch (e) {
      setError(e.message || 'Tidak dapat terhubung ke server.');
    } finally {
      setDeleting(false);
    }
  }

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const list = rows || [];
  const sum = (cat) => list.filter((r) => !cat || r.category === cat).reduce((s, r) => s + Number(r.price), 0);
  const selected = people.find((p) => String(p.id) === applied.user);
  const selectedName = selected?.name || (applied.user ? 'orang terpilih' : '');

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Rekap Reimburse</h1>
          <p className="muted">Lihat rekap per orang sebelum mengekspor</p>
        </div>
        <a className="btn btn-primary" href={exportUrl(applied)}>
          {applied.user ? `Export PDF: ${selectedName}` : 'Export PDF: Semua'}
        </a>
      </div>

      <form
        className="card filters"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...filters, project: filters.project.trim() });
        }}
      >
        <fieldset className="filter-fields" disabled={deleting}>
          <label className="field">
            <span>Project</span>
            <input placeholder="Cari project" value={filters.project} onChange={set('project')} />
          </label>
          <label className="field">
            <span>Orang</span>
            <select value={filters.user} onChange={set('user')}>
              <option value="">Semua orang</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Kategori</span>
            <select value={filters.category} onChange={set('category')}>
              <option value="">Semua</option>
              <option value="operasional">Operasional</option>
              <option value="material">Material</option>
            </select>
          </label>
          <label className="field">
            <span>Dari tanggal</span>
            <input type="date" value={filters.from} onChange={set('from')} />
          </label>
          <label className="field">
            <span>Sampai tanggal</span>
            <input type="date" value={filters.to} onChange={set('to')} />
          </label>
          <div className="filter-actions">
            <button className="btn btn-primary">Terapkan</button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setFilters(emptyFilters);
                setApplied(emptyFilters);
              }}
            >
              Reset
            </button>
          </div>
        </fieldset>
      </form>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      <section className="card table-wrap">
        <div className="section-head">
          <h2>Rekap per Orang</h2>
          <small className="muted">Klik "Lihat" untuk melihat detail, atau export PDF untuk satu orang saja</small>
        </div>
        {people.length === 0 ? (
          <p className="muted">{rows === null ? 'Memuat…' : 'Tidak ada data.'}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th className="num">Item</th>
                <th className="num">Operasional</th>
                <th className="num">Material</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className={String(p.id) === applied.user ? 'row-selected' : ''}>
                  <td>
                    <b>{p.name}</b>
                    <small className="muted block">{p.email}</small>
                  </td>
                  <td className="num">{p.items}</td>
                  <td className="num nowrap">{rupiah(p.operasional)}</td>
                  <td className="num nowrap">{rupiah(p.material)}</td>
                  <td className="num nowrap"><b>{rupiah(p.total)}</b></td>
                  <td>
                    <div className="row-gap actions">
                      <button type="button" className="btn btn-ghost btn-sm" disabled={deleting} onClick={() => showPerson(p.id)}>Lihat</button>
                      <a className="btn btn-primary btn-sm" href={exportUrl({ ...applied, user: String(p.id) })}>Export PDF</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div ref={detailRef} className="stack-lg">
        {applied.user && (
          <div className="alert success person-banner">
            <span>Menampilkan rekap <b>{selectedName}</b></span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={deleting} onClick={clearPerson}>Tampilkan semua orang</button>
          </div>
        )}

        <div className="stats">
          <div className="card stat"><small>Jumlah item</small><b>{list.length}</b></div>
          <div className="card stat"><small>Operasional</small><b>{rupiah(sum('operasional'))}</b></div>
          <div className="card stat"><small>Material</small><b>{rupiah(sum('material'))}</b></div>
          <div className="card stat accent"><small>Total</small><b>{rupiah(sum())}</b></div>
        </div>

        <section className="card table-wrap">
          <div className="section-head">
            <h2>Detail Item{applied.user ? `: ${selectedName}` : ''}</h2>
            <div className="bulk-actions">
              <span className="muted">{selectedIds.length} item dipilih dari {list.length} item yang ditampilkan</span>
              <button type="button" className="btn btn-danger btn-sm" disabled={deleting || selectedIds.length === 0} onClick={() => removeItems(selectedIds)}>
                {deleting ? 'Menghapus…' : `Hapus terpilih (${selectedIds.length})`}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={deleting || selectedIds.length === 0} onClick={() => setSelectedIds([])}>Batalkan pilihan</button>
            </div>
          </div>
          {rows === null ? (
            <p className="muted">Memuat…</p>
          ) : list.length === 0 ? (
            <p className="muted">Tidak ada data.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="selection-cell">
                    <input ref={selectAllRef} type="checkbox" aria-label="Pilih semua item yang ditampilkan" checked={list.length > 0 && selectedIds.length === list.length} disabled={deleting} onChange={(e) => setSelectedIds(e.target.checked ? list.map((r) => r.id) : [])} />
                  </th>
                  <th>Tanggal</th>
                  <th>Nama</th>
                  <th>Project</th>
                  <th>Kategori</th>
                  <th>Barang / Item</th>
                  <th className="num">Harga</th>
                  <th>Foto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={selectedIds.includes(r.id) ? 'row-selected' : ''}>
                    <td className="selection-cell">
                      <input type="checkbox" aria-label={`Pilih ${r.item} milik ${r.user_name}`} checked={selectedIds.includes(r.id)} disabled={deleting} onChange={() => toggleItem(r.id)} />
                    </td>
                    <td className="nowrap">{tanggal(r.created_at)}</td>
                    <td>
                      {r.user_name}
                      <small className="muted block">{r.email}</small>
                    </td>
                    <td>{r.project}</td>
                    <td><span className={`tag ${r.category}`}>{kategoriLabel(r.category)}</span></td>
                    <td>{r.item}</td>
                    <td className="num nowrap">{rupiah(r.price)}</td>
                    <td>
                      <a href={`/api/photo/${r.id}`} target="_blank" rel="noreferrer">
                        <img className="thumb" src={`/api/photo/${r.id}`} alt={r.item} loading="lazy" />
                      </a>
                    </td>
                    <td><button className="link-danger" disabled={deleting} onClick={() => removeItems([r.id])}>Hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
