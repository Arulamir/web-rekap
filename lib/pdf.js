import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatPurchaseDate } from './purchase-date.js';

const PAGE = [595.28, 841.89]; // A4 portrait
const M = 36;
const CONTENT_W = PAGE[0] - M * 2;
const PRIMARY = rgb(0.059, 0.463, 0.431);
const MUTED = rgb(0.42, 0.45, 0.5);
const BORDER = rgb(0.85, 0.87, 0.9);
const ZEBRA = rgb(0.97, 0.98, 0.98);

const COLS = [
  { key: 'no', title: 'No', w: 24 },
  { key: 'tanggal_beli', title: 'Tgl beli', w: 60 },
  { key: 'item', title: 'Uraian', w: 0, grow: true },
  { key: 'qty', title: 'Qty', w: 38, right: true },
  { key: 'harga', title: 'Harga', w: 82, right: true },
  { key: 'total', title: 'Total', w: 82, right: true },
  { key: 'kategori', title: 'Kategori', w: 72 },
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
  for (const rawPara of String(text ?? '').split(/\r?\n/)) {
    const para = clean(rawPara);
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
  doc.setTitle('Form Reimbursement');
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
  const title = 'FORM REIMBURSEMENT';
  text(title, (PAGE[0] - bold.widthOfTextAtSize(title, 16)) / 2, y - 18, { size: 16, f: bold, color: PRIMARY });
  y -= 34;
  if (person) {
    for (const line of wrap(`Nama: ${person}`, bold, 11, CONTENT_W)) { text(line, M, y, { size: 11, f: bold }); y -= 16; }
  }
  for (const line of wrap(`Dicetak: ${wib(new Date())} WIB oleh ${generatedBy}`, font, 9, CONTENT_W)) { text(line, M, y, { size: 9, color: MUTED }); y -= 13; }
  for (const line of wrap(`Filter: ${filterText}`, font, 9, CONTENT_W)) { text(line, M, y, { size: 9, color: MUTED }); y -= 13; }
  text('Tanggal beli: DD/MM/YY. Tanda - berarti belum dicatat.', M, y, { size: 8, color: MUTED });
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
      tanggal_beli: r.purchase_date ? formatPurchaseDate(r.purchase_date) : '-',
      kategori: r.category === 'material' ? 'Material' : 'Operasional',
      item: `${r.item}\n${r.user_name} | ${r.project}\n${r.created_at ? `Input: ${wib(r.created_at)} WIB` : 'Tanggal pencatatan tidak tersedia'}`,
      qty: Number(r.quantity ?? 1).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 }),
      harga: rp(r.unit_price ?? r.price),
      total: rp(r.price),
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
  const totalRight = M + CONTENT_W - COLS[COLS.length - 1].w;
  const totalWidth = COLS.find((c) => c.key === 'total').w;
  ensure(totals.length * (LINE_H + PAD * 2) + 10, false);
  y -= 4;
  for (const [label, val, isGrand] of totals) {
    const h = LINE_H + PAD * 2;
    if (isGrand) page.drawRectangle({ x: M, y: y - h, width: CONTENT_W, height: h, color: rgb(0.8, 0.98, 0.94) });
    const f = isGrand ? bold : font;
    textRight(label, totalRight - totalWidth - PAD, y - PAD - 8, { f, size: isGrand ? 9.5 : FONT_SIZE });
    textRight(rp(val), totalRight - PAD, y - PAD - 8, { f, size: isGrand ? 9.5 : FONT_SIZE });
    y -= h;
  }

  // One full-page attachment per unique receipt, with references to every item.
  const receipts = new Map();
  rows.forEach((r, i) => {
    if (!r.photo_data) return;
    const key = JSON.stringify([r.user_name, r.project, r.photo_type, r.photo_data]);
    if (receipts.has(key)) receipts.get(key).numbers.push(i + 1);
    else receipts.set(key, { ...r, numbers: [i + 1] });
  });
  let receiptNo = 0;
  for (const r of receipts.values()) {
    newPage();
    text('Lampiran Nota ' + (++receiptNo), M, y - 14, { size: 14, f: bold, color: PRIMARY });
    y -= 34;
    const description = 'Item #' + r.numbers.join(', #') + ' | ' + r.user_name + ' | ' + r.project;
    for (const line of wrap(description, font, 9, CONTENT_W)) {
      text(line, M, y, { size: 9, color: MUTED }); y -= 13;
    }
    y -= 10;
    try {
      const bytes = new Uint8Array(Buffer.from(r.photo_data, 'base64'));
      const img = r.photo_type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const scale = Math.min(CONTENT_W / img.width, (y - M - 20) / img.height, 1);
      const width = img.width * scale;
      const height = img.height * scale;
      const x = M + (CONTENT_W - width) / 2;
      page.drawImage(img, { x, y: y - height, width, height });
      page.drawRectangle({ x, y: y - height, width, height, borderColor: BORDER, borderWidth: 0.5 });
    } catch {
      text('Foto tidak dapat ditampilkan', M, y - 24, { color: MUTED });
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
