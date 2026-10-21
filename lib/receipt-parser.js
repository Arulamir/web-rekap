import { detectReceiptDate } from './purchase-date.js';

// Conservative heuristic parser: these are suggestions, never authoritative data.
export function receiptNumber(value) {
  let text = String(value ?? '').replace(/Rp\.?/gi, '').replace(/\s+/g, '').replace(/[.,]-$/, '');
  if (!/^\d+(?:[.,]\d+)*$/.test(text)) return null;
  const dot = text.lastIndexOf('.');
  const comma = text.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    const decimal = Math.max(dot, comma);
    text = text.slice(0, decimal).replace(/[.,]/g, '') + '.' + text.slice(decimal + 1);
  } else if (dot >= 0 || comma >= 0) {
    const separator = dot >= 0 ? '.' : ',';
    const parts = text.split(separator);
    if (parts.length > 2 || parts.at(-1).length === 3) text = parts.join('');
    else text = parts.join('.');
  }
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

const numberPattern = /(?<![\p{L}\d])(?:Rp\.?\s*)?\d+(?:[.,]\d+)*(?:[.,]-)?(?![\p{L}\d])/giu;
const summary = /^(?:grand\s*)?(?:sub\s*total|total|jumlah(?:\s+rp)?|tunai|cash|bayar|pembayaran|kembali|change|pajak|ppn|tax|diskon|discount)\b/i;
const metadata = /^(?:nota|invoice|receipt|tanggal|date|waktu|time|telp|telepon|phone|npwp|alamat|kasir|cashier|shift|operator|pulau|nozzle|spbu|jl\.?|jenis\s+bbm|volume|informasi|harga\s+(?:jual|non|bbm)|subsidi|tanpa\s+subsidi|dibayar|no\.?\s*(?:struk|nota|transaksi)|tanda\s+terima|hormat|terima\s*kasih)\b/i;

export function parseReceiptText(text) {
  // Fuel receipts use labeled fields rather than one item per line.
  const raw = String(text || '');
  const receiptDate = detectReceiptDate(raw);
  const fuel = raw.match(/jenis\s*bbm[^\p{L}\r\n]*([^\r\n]+)/iu);
  if (fuel) {
    const qty = raw.match(/volume[^\d\r\n]*(\d+(?:[.,]\d+)?)/i);
    const unit = raw.match(/^harga\s+jual[^\d\r\n]*([\d.,]+)/im);
    const paid = raw.match(/^dibayar\s+konsumen[^\d\r\n]*([\d.,]+)/im);
    const quantity = qty ? receiptNumber(qty[1]) : null;
    const price = unit ? receiptNumber(unit[1]) : null;
    const receiptTotal = paid ? receiptNumber(paid[1]) : null;
    if (quantity > 0 && Number.isSafeInteger(price) && price > 0) {
      return { items: [{ item: fuel[1].trim().slice(0, 200), quantity: String(quantity), price: String(price), warning: receiptTotal !== null && Math.round(quantity * price) !== receiptTotal ? `Periksa Qty/harga: total yang terbaca ${receiptTotal}.` : '', source: raw }], receiptTotal, ...receiptDate };
    }
    return { items: [], receiptTotal, ...receiptDate };
  }
  const items = [];
  let receiptTotal = null;
  for (const source of raw.split(/\r?\n/)) {
    const line = source.replace(/[|¦]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    // Do not split an OCR thousands-separator error (140-000) into a price of 140.
    if (/\d[\d.,]*\s*[-–]\s*\d{3}\s*[\]|¦]?\s*$/.test(line)) continue;
    const numbers = [...line.matchAll(numberPattern)].map((match) => ({ raw: match[0], value: receiptNumber(match[0]), index: match.index }));
    if (summary.test(line)) {
      if (/^(?:grand\s*)?total\b|^jumlah(?:\s+rp)?\b/i.test(line)) receiptTotal = numbers.at(-1)?.value ?? receiptTotal;
      continue;
    }
    if (metadata.test(line) || /\b(?:qty|uraian|nama barang)\b/i.test(line) || /\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}/.test(line)) continue;
    const amounts = numbers.filter((n) => n.value !== null && (n.value >= 100 || /^Rp/i.test(n.raw)));
    if (!amounts.length) continue;
    const firstAmount = amounts[0];
    if (!Number.isSafeInteger(firstAmount.value)) continue;
    let name = line.slice(0, firstAmount.index).trim();
    if (!/[\p{L}]{2}/u.test(name)) continue;
    let quantity = 1;
    let quantityRead = false;
    const trailingQty = name.match(/\s+(\d+(?:[.,]\d+)?)\s*(?:x|pcs|buah|porsi|sak|kg|ltr|liter)?$/i);
    const leadingQty = name.match(/^(\d+(?:[.,]\d+)?)\s*(?:x\s+)?(?=[\p{L}])/iu);
    if (trailingQty) {
      quantity = receiptNumber(trailingQty[1]);
      name = name.slice(0, trailingQty.index).replace(/^\d+[.)]?\s+/, '').trim();
      quantityRead = true;
    } else if (leadingQty) {
      quantity = receiptNumber(leadingQty[1]);
      name = name.slice(leadingQty[0].length).trim();
      quantityRead = true;
    }
    name = name.replace(/\s+Rp\.?$/i, '').replace(/[=:;,-]+$/, '').trim();
    if (!name || !quantity || quantity > 1000000) continue;
    let price = Math.round(firstAmount.value);
    const warnings = [];
    if (amounts.length > 1) {
      const printedTotal = Math.round(amounts.at(-1).value);
      if (!quantityRead) {
        price = printedTotal;
        warnings.push('Qty tidak terbaca; total baris ditempatkan pada harga dengan Qty 1.');
      } else if (Math.round(quantity * price) !== printedTotal) {
        warnings.push(`Periksa Qty/harga: total yang terbaca ${printedTotal}.`);
      }
    }
    if (!Number.isSafeInteger(price) || price <= 0) continue;
    items.push({ item: name.slice(0, 200), quantity: String(quantity), price: String(price), warning: warnings.join(' '), source });
  }
  return { items, receiptTotal, ...receiptDate };
}
