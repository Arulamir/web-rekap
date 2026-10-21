import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseDateToIso, formatPurchaseDate, detectReceiptDate } from '../lib/purchase-date.js';
import { parseReceiptText } from '../lib/receipt-parser.js';

test('purchase date DD/MM/YY round trip without a timezone shift', () => {
  assert.equal(purchaseDateToIso('21/10/26'), '2026-10-21');
  assert.equal(formatPurchaseDate('2026-10-21'), '21/10/26');
  assert.equal(purchaseDateToIso('29/02/24'), '2024-02-29');
  assert.equal(formatPurchaseDate(null), 'Belum dicatat');
});

test('invalid calendar dates and wrong display formats are rejected', () => {
  for (const date of ['', '1/2/26', '21/10/2026', '2026-10-21', '31/02/26', '29/02/25', '31/04/26', '00/10/26', '21/00/26', '21/13/26']) {
    assert.throws(() => purchaseDateToIso(date), undefined, date);
  }
});

test('OCR numeric date formats normalize to DD/MM/YY', () => {
  for (const source of ['29/07/26', 'Tanggal 29/07/2026', 'Date: 2026-07-29', '29-07-2026 12:00', '29 . 07 . 26']) {
    assert.equal(detectReceiptDate(source).purchaseDate, '29/07/26', source);
  }
});

test('Indonesian and English month names are supported', () => {
  assert.equal(detectReceiptDate('29 Juli 2026').purchaseDate, '29/07/26');
  assert.equal(detectReceiptDate('Date 21 Oct 26').purchaseDate, '21/10/26');
});

test('expiry dates ignored and conflicting dates never chosen arbitrarily', () => {
  assert.equal(detectReceiptDate('EXP 31/12/27\nTanggal 29/07/26').purchaseDate, '29/07/26');
  assert.equal(detectReceiptDate('29/07/26\n30/07/26').purchaseDate, '');
  assert.match(detectReceiptDate('29/07/26\n30/07/26').dateWarning, /Lebih dari satu/);
  assert.equal(detectReceiptDate('29/07/26\nWaktu 30/07/26').purchaseDate, '30/07/26');
});

test('prices, malformed dates, and out-of-range years are not dates', () => {
  for (const source of ['Rp 10.000.000', 'Tanggal 31/02/26', '21/10/1999', '31/12/20260']) assert.equal(detectReceiptDate(source).purchaseDate, '', source);
});

test('receipt OCR exposes a date even when no item is readable', () => {
  assert.equal(parseReceiptText('Tanggal 29/07/26\nnota tulisan tangan').purchaseDate, '29/07/26');
  const result = parseReceiptText('Waktu : 31/07/2026 09:13:48\nJenis BBM : PERTALITE\nVolume : 2 liter\nHarga Jual : 10,000\nDibayar Konsumen : 20,000');
  assert.equal(result.purchaseDate, '31/07/26');
  assert.equal(result.items[0].price, '10000');
});
