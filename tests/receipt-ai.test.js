import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAiReceipt, readReceiptAi } from '../lib/receipt-ai.js';

const fixture = () => ({ raw_text: 'Nota contoh', purchase_date: '21/10/26', receipt_total: 20000, warnings: [], items: [{ name: 'Barang contoh', quantity: 2, unit_price: 10000, line_total: 20000, uncertain: false }] });

test('AI output preserves quantity, unit price, explicit date and total', () => {
  const result = normalizeAiReceipt(fixture());
  assert.equal(result.items[0].quantity, '2'); assert.equal(result.items[0].price, '10000');
  assert.equal(result.items[0].selected, true); assert.equal(result.purchaseDate, '21/10/26');
  assert.equal(result.receiptTotal, 20000);
});
test('missing/uncertain AI fields stay blank and unselected; totals never fill missing prices', () => {
  const data = fixture(); data.items[0].unit_price = null; data.items[0].quantity = null; data.items[0].uncertain = true;
  const row = normalizeAiReceipt(data).items[0];
  assert.equal(row.price, ''); assert.equal(row.quantity, ''); assert.equal(row.selected, false); assert.match(row.warning, /belum lengkap/);
});
test('invalid dates, mismatched totals and excess precision require review', () => {
  const data = fixture(); data.purchase_date = '31/02/26'; data.items[0].line_total = 30000;
  let result = normalizeAiReceipt(data);
  assert.equal(result.purchaseDate, ''); assert.match(result.warnings.join(' '), /Tanggal/);
  assert.equal(result.items[0].selected, false); assert.match(result.items[0].warning, /tidak cocok/);
  data.items[0].quantity = 1.00001; result = normalizeAiReceipt(data);
  assert.equal(result.items[0].selected, false); assert.match(result.items[0].warning, /batas/);
});
test('bad shape and too many items are handled explicitly', () => {
  assert.throws(() => normalizeAiReceipt({ items: null, raw_text: '' }));
  const data = fixture(); data.items = Array(11).fill(data.items[0]);
  const result = normalizeAiReceipt(data); assert.equal(result.items.length, 10); assert.match(result.warnings.join(' '), /lebih dari 10/);
});

const options = () => ({ bytes: Buffer.from('fixture'), mimeType: 'image/png', apiKey: 'test-only-key', model: 'gemini-3.1-flash-lite' });
test('provider call puts key in header and sends structured image extraction request', async () => {
  const result = await readReceiptAi({ ...options(), fetcher: async (url, request) => {
    assert.equal(url.includes('test-only-key'), false); assert.equal(request.headers['x-goog-api-key'], 'test-only-key');
    const body = JSON.parse(request.body); assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/png');
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'ignore' }, { text: JSON.stringify(fixture()) }] } }] });
  } });
  assert.equal(result.items[0].item, 'Barang contoh');
});
test('quota and provider configuration failures never leak raw provider response', async () => {
  for (const status of [429, 400, 403, 404, 500]) await assert.rejects(readReceiptAi({ ...options(), fetcher: async () => Response.json({ error: { message: 'secret-value-must-never-leak' } }, { status }) }), (error) => {
    assert.equal(error.message.includes('secret-value'), false); assert.equal(error.status, status === 429 ? 429 : status < 500 ? 503 : 502); return true;
  });
});
test('malformed, truncated, safety-blocked, and network-failed responses never yield drafts', async () => {
  for (const payload of [{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(fixture()) }] } }] }, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{broken' }] } }] }, { promptFeedback: { blockReason: 'SAFETY' } }]) await assert.rejects(readReceiptAi({ ...options(), fetcher: async () => Response.json(payload) }));
  await assert.rejects(readReceiptAi({ ...options(), fetcher: async () => { throw new Error('network'); } }), (error) => error.status === 504);
});
