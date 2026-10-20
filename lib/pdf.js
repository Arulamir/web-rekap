import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE = [595.28, 841.89]; // A4 portrait
const M = 36;
const CONTENT_W = PAGE[0] - M * 2;
const PRIMARY = rgb(0.059, 0.463, 0.431);
const MUTED = rgb(0.42, 0.45, 0.5);
const BORDER = rgb(0.85, 0.87, 0.9);
const ZEBRA = rgb(0.97, 0.98, 0.98);

const COLS = [
  { key: 'no', title: 'No', w: 24 },
  { key: 'tanggal', title: 'Tanggal', w: 62 },
  { key: 'nama', title: 'Nama', w: 72 },
  { key: 'project', title: 'Project', w: 92 },
  { key: 'kategori', title: 'Kategori', w: 58 },
  { key: 'item', title: 'Barang / Item', w: 0, grow: true },
  { key: 'harga', title: 'Harga', w: 82, right: true },
];
COLS.find((c) => c.grow).w = CONTENT_W - COLS.reduce((s, c) => s + c.w, 0);

const FONT_SIZE = 8.5;
const LINE_H = 11;
const PAD = 5;

// Font standar PDF hanya mendukung WinAnsi; ganti karakter di luar itu.
const clean = (s) =>
  String(s ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

export const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const wib = (d) => {
  const t = new Date(new Date(d).getTime() + 7 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(t.getUTCDate())}/${p(t.getUTCMonth() + 1)}/${t.getUTCFullYear()} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
};

function wrap(text, font, size, maxW) {
  const lines = [];
  for (const para of clean(text).split('\n')) {
    let line = '';
    for (let word of para.split(/\s+/).filter(Boolean)) {
      // Pecah kata yang terlalu panjang untuk satu baris.
      while (font.widthOfTextAtSize(word, size) > maxW) {
        let i = word.length;
        while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > maxW) i--;
        if (line) lines.push(line);
        lines.push(word.slice(0, i));
        line = '';
        word = word.slice(i);
      }
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}

export async function buildRekapPdf({ rows, filterText, generatedBy, person }) {
  const doc = await PDFDocument.create();
  doc.setTitle('Rekap Reimburse');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page;
  let y;
  const newPage = () => {
    page = doc.addPage(PAGE);
    y = PAGE[1] - M;
  };
  const text = (t, x, yy, { size = FONT_SIZE, f = font, color = rgb(0.12, 0.16, 0.22) } = {}) =>
    page.drawText(clean(t), { x, y: yy, size, font: f, color });
  const textRight = (t, xRight, yy, opts = {}) =>
    text(t, xRight - (opts.f || font).widthOfTextAtSize(clean(t), opts.size || FONT_SIZE), yy, opts);

  // ---- Judul ----
  newPage();
  text('Rekap Reimburse', M, y - 18, { size: 18, f: bold, color: PRIMARY });
  y -= 34;
  if (person) {
    text(`Atas nama: ${person}`, M, y, { size: 11, f: bold });
    y -= 16;
  }
  text(`Dicetak: ${wib(new Date())} WIB oleh ${generatedBy}`, M, y, { size: 9, color: MUTED });
  y -= 13;
  text(`Filter: ${filterText}`, M, y, { size: 9, color: MUTED });
  y -= 20;

  // ---- Tabel ----
  const drawHeader = () => {
    const h = LINE_H + PAD * 2;
    page.drawRectangle({ x: M, y: y - h, width: CONTENT_W, height: h, color: PRIMARY });
    let x = M;
    for (const c of COLS) {
      const ty = y - PAD - 8;
      if (c.right) textRight(c.title, x + c.w - PAD, ty, { f: bold, color: rgb(1, 1, 1) });
      else text(c.title, x + PAD, ty, { f: bold, color: rgb(1, 1, 1) });
      x += c.w;
    }
    y -= h;
  };
  const ensure = (h, withHeader) => {
    if (y - h < M + 20) {
      newPage();
      if (withHeader) drawHeader();
    }
  };

  drawHeader();
  rows.forEach((r, idx) => {
    const cells = {
      no: String(idx + 1),
      tanggal: wib(r.created_at),
      nama: r.user_name,
      project: r.project,
      kategori: r.category === 'material' ? 'Material' : 'Operasional',
      item: r.item,
      harga: rp(r.price),
    };
    const lines = Object.fromEntries(COLS.map((c) => [c.key, wrap(cells[c.key], font, FONT_SIZE, c.w - PAD * 2)]));
    const h = Math.max(...COLS.map((c) => lines[c.key].length)) * LINE_H + PAD * 2;
    ensure(h, true);
    if (idx % 2 === 1) page.drawRectangle({ x: M, y: y - h, width: CONTENT_W, height: h, color: ZEBRA });
    let x = M;
    for (const c of COLS) {
      lines[c.key].forEach((ln, i) => {
        const ty = y - PAD - 8 - i * LINE_H;
        if (c.right) textRight(ln, x + c.w - PAD, ty);
        else text(ln, x + PAD, ty);
      });
      x += c.w;
    }
    page.drawLine({ start: { x: M, y: y - h }, end: { x: M + CONTENT_W, y: y - h }, thickness: 0.5, color: BORDER });
    y -= h;
  });

  if (rows.length === 0) {
    ensure(30, false);
    text('Tidak ada data untuk filter ini.', M + PAD, y - 16, { color: MUTED });
    y -= 26;
  }

  // ---- Total ----
  const sum = (cat) => rows.filter((r) => !cat || r.category === cat).reduce((s, r) => s + Number(r.price), 0);
  const totals = [
    ['Subtotal Operasional', sum('operasional'), false],
    ['Subtotal Material', sum('material'), false],
    ['TOTAL', sum(), true],
  ];
  const hargaCol = COLS[COLS.length - 1];
  ensure(totals.length * (LINE_H + PAD * 2) + 10, false);
  y -= 4;
  for (const [label, val, isGrand] of totals) {
    const h = LINE_H + PAD * 2;
    if (isGrand) page.drawRectangle({ x: M, y: y - h, width: CONTENT_W, height: h, color: rgb(0.8, 0.98, 0.94) });
    const f = isGrand ? bold : font;
    textRight(label, M + CONTENT_W - hargaCol.w - PAD, y - PAD - 8, { f, size: isGrand ? 9.5 : FONT_SIZE });
    textRight(rp(val), M + CONTENT_W - PAD, y - PAD - 8, { f, size: isGrand ? 9.5 : FONT_SIZE });
    y -= h;
  }

  // ---- Lampiran foto ----
  const withPhoto = rows.map((r, i) => ({ ...r, no: i + 1 })).filter((r) => r.photo_data);
  if (withPhoto.length) {
    y -= 24;
    ensure(60, false);
    text('Lampiran: Foto Nota / Bukti Pembayaran', M, y - 12, { size: 12, f: bold, color: PRIMARY });
    y -= 26;

    const GAP = 14;
    const cellW = (CONTENT_W - GAP) / 2;
    const maxImgH = 300;
    const CAPTION_H = 26;

    for (let i = 0; i < withPhoto.length; i += 2) {
      const pair = [];
      for (const r of withPhoto.slice(i, i + 2)) {
        let img = null;
        try {
          // Salin ke Uint8Array baru: pdf-lib membaca .buffer dari offset 0, sedangkan Buffer kecil bisa berbagi pool.
          const bytes = new Uint8Array(Buffer.from(r.photo_data, 'base64'));
          img = r.photo_type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        } catch {
          img = null;
        }
        const scale = img ? Math.min(cellW / img.width, maxImgH / img.height, 1) : 0;
        pair.push({ r, img, w: img ? img.width * scale : cellW, h: img ? img.height * scale : 40 });
      }
      const rowH = CAPTION_H + Math.max(...pair.map((p) => p.h)) + GAP;
      ensure(rowH, false);
      pair.forEach((p, j) => {
        const x = M + j * (cellW + GAP);
        const cap1 = wrap(`#${p.r.no}  ${p.r.item}`, bold, 8.5, cellW)[0];
        text(cap1, x, y - 9, { f: bold });
        text(clean(`${p.r.user_name} - ${p.r.project} - ${rp(p.r.price)}`).slice(0, 80), x, y - 20, { size: 7.5, color: MUTED });
        const top = y - CAPTION_H;
        if (p.img) {
          page.drawImage(p.img, { x, y: top - p.h, width: p.w, height: p.h });
          page.drawRectangle({ x, y: top - p.h, width: p.w, height: p.h, borderColor: BORDER, borderWidth: 0.5 });
        } else {
          page.drawRectangle({ x, y: top - p.h, width: cellW, height: p.h, borderColor: BORDER, borderWidth: 0.5 });
          text('Foto tidak dapat ditampilkan', x + 8, top - 24, { color: MUTED });
        }
      });
      y -= rowH;
    }
  }

  // ---- Nomor halaman ----
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Halaman ${i + 1} dari ${pages.length}`;
    p.drawText(label, {
      x: PAGE[0] - M - font.widthOfTextAtSize(label, 8),
      y: M / 2,
      size: 8,
      font,
      color: MUTED,
    });
  });

  return doc.save();
}
