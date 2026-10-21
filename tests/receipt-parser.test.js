import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptNumber, parseReceiptText } from '../lib/receipt-parser.js';
import { normalizeItem } from '../lib/reimburse-item.js';

test('Indonesian and English currency separators and decimal quantities', () => {
  for (const [raw, expected] of [['Rp 10.000', 10000], ['10,000.00', 10000], ['10.000,00', 10000], ['4.00', 4], ['2,5', 2.5], ['150000', 150000]]) {
    assert.equal(receiptNumber(raw), expected, raw);
  }
  assert.equal(receiptNumber('1O.OOO'), null, 'ambiguous letters are never silently converted to numbers');
});

test('receipt quantity/name/unit price/total, excluding footer and metadata', () => {
  const result = parseReceiptText('NOTA No. 1234\n29/07/26\nBANYAKNYA NAMA BARANG HARGA JUMLAH\n4 Nasi Campur 10.000 40.000\n4 Es 2.000 8.000\nJumlah Rp 48.000\nTelp 081234567890');
  assert.equal(result.items.length, 2);
  assert.equal(result.receiptTotal, 48000);
  assert.deepEqual(result.items.map(({ item, quantity, price }) => ({ item, quantity, price })), [
    { item: 'Nasi Campur', quantity: '4', price: '10000' },
    { item: 'Es', quantity: '4', price: '2000' },
  ]);
});

test('numbered reimbursement table with quantity after description', () => {
  const result = parseReceiptText('NO URAIAN QTY HARGA TOTAL Kategori\n1 Nasi Campur 4.00 10,000.00 40000 OPERASIONAL\n2 Es 4.00 2,000.00 8000 OPERASIONAL\ntotal 48,000.00');
  assert.equal(result.items[0].item, 'Nasi Campur');
  assert.equal(result.items[0].quantity, '4');
  assert.equal(result.items[1].item, 'Es');
  assert.equal(result.receiptTotal, 48000);
});

test('a single line total remains quantity one when no quantity is readable', () => {
  const [row] = parseReceiptText('Transport 150.000').items;
  assert.equal(row.quantity, '1');
  assert.equal(row.price, '150000');
});

test('fuel receipt uses sale price and volume, not subsidy or transaction numbers', () => {
  const result = parseReceiptText('PERTAMINA\nShift : 1 No. Trans : 2835690\nJenis BBM : PERTALITE\nVolume : 2 liter\nHarga Non Subsidi : 15,898\nSubsidi Pemerintah : 5,898\nHarga Jual : 10,000\nTanpa Subsidi : 31,796\nDibayar Konsumen : 20,000\nCASH 20,000');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].item, 'PERTALITE');
  assert.equal(result.items[0].quantity, '2');
  assert.equal(result.items[0].price, '10000');
  assert.equal(result.receiptTotal, 20000);
});

test('fuel labels tolerate OCR separator noise and a misread liter unit', () => {
  const result = parseReceiptText('ma... G1 812.6 3\nJenis BBM — : PERTALITE\nVolume : 2 TES\nHarga Jual : 10,000 ES\nTotal Penjualan (Rp) . 4\nDibayar Konsumen: 20,000');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].item, 'PERTALITE');
  assert.equal(result.items[0].quantity, '2');
  assert.equal(result.items[0].price, '10000');
  assert.equal(result.receiptTotal, 20000);
});

test('mismatched printed line total is surfaced for review', () => {
  const [row] = parseReceiptText('4 Es 8.700 34.000').items;
  assert.match(row.warning, /34000/);
});

test('missing quantity with two amounts does not invent a quantity', () => {
  const [row] = parseReceiptText('Semen 10.000 40.000').items;
  assert.equal(row.quantity, '1');
  assert.equal(row.price, '40000');
  assert.match(row.warning, /Qty tidak terbaca/);
});

test('no candidates fabricated from unreadable prices or numeric-only metadata', () => {
  assert.equal(parseReceiptText('Nasi Campur lO.OOO\n081234567890\nTanggal 29/07/2026\nTOTAL 48.000').items.length, 0);
});

test('server computes the line total; legacy total is preserved', () => {
  assert.deepEqual(normalizeItem({ item: 'Nasi', quantity: 4, unit_price: 10000, price: 1 }), { item: 'Nasi', quantity: 4, unitPrice: 10000, price: 40000 });
  assert.equal(normalizeItem({ item: 'Legacy', price: 48000 }).price, 48000);
  assert.equal(normalizeItem({ item: 'Pertalite', quantity: 2.5, unit_price: 10000 }).price, 25000);
});

test('invalid quantities, prices, and unsafe totals rejected', () => {
  for (const quantity of [0, -1, NaN, Infinity, 0.0001, 1000001]) assert.throws(() => normalizeItem({ item: 'Test', quantity, unit_price: 10000 }));
  for (const unit_price of [0, -1, 1.5, Number.MAX_SAFE_INTEGER]) assert.throws(() => normalizeItem({ item: 'Test', quantity: 4, unit_price }));
});
