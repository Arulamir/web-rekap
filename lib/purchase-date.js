// Purchase dates are calendar dates, independent of server timezone or input time.
export function purchaseDateToIso(value) {
  const match = String(value ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) throw new Error('Tanggal beli harus berformat DD/MM/YY, misalnya 21/10/26.');
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = 2000 + Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Tanggal beli tidak valid. Periksa tanggal, bulan, dan tahun.');
  }
  return `${year}-${match[2]}-${match[1]}`;
}

export function formatPurchaseDate(value) {
  if (!value) return 'Belum dicatat';
  const match = String(value).match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return 'Belum dicatat';
  const display = `${match[3]}/${match[2]}/${match[1].slice(-2)}`;
  try { purchaseDateToIso(display); return display; } catch { return 'Belum dicatat'; }
}

const months = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, ags: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12 };

export function detectReceiptDate(text) {
  const candidates = [];
  const add = (day, month, year, priority) => {
    const fullYear = Number(year) < 100 ? 2000 + Number(year) : Number(year);
    if (fullYear < 2000 || fullYear > 2099) return;
    const display = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(fullYear).slice(-2)}`;
    try { purchaseDateToIso(display); candidates.push({ display, priority }); } catch { /* Never invent or repair invalid calendar dates. */ }
  };
  for (const line of String(text || '').split(/\r?\n/)) {
    if (/\b(?:exp(?:ired|iry)?|kedaluwarsa|kadaluarsa|jatuh\s+tempo)\b/i.test(line)) continue;
    const priority = /\b(?:tgl|tanggal|date|waktu|pembelian|transaksi)\b/i.test(line) ? 1 : 0;
    for (const match of line.matchAll(/(?<!\d)(20\d{2})[ \t]*[-/.][ \t]*(\d{1,2})[ \t]*[-/.][ \t]*(\d{1,2})(?!\d)/g)) add(match[3], match[2], match[1], priority);
    for (const match of line.matchAll(/(?<!\d)(\d{1,2})[ \t]*[-/.][ \t]*(\d{1,2})[ \t]*[-/.][ \t]*(\d{4}|\d{2})(?!\d)/g)) add(match[1], match[2], match[3], priority);
    for (const match of line.matchAll(/\b(\d{1,2})[ \t-]+([a-z]+)[ \t,-]+(\d{4}|\d{2})\b/gi)) {
      const month = months[match[2].toLowerCase()];
      if (month) add(match[1], month, match[3], priority);
    }
  }
  const priority = Math.max(-1, ...candidates.map((candidate) => candidate.priority));
  const dates = [...new Set(candidates.filter((candidate) => candidate.priority === priority).map((candidate) => candidate.display))];
  return { purchaseDate: dates.length === 1 ? dates[0] : '', dateWarning: dates.length > 1 ? 'Lebih dari satu tanggal terbaca. Pilih dan isi tanggal beli secara manual.' : '' };
}
