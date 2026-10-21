import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptCrop, enhanceReceiptPixels } from '../lib/receipt-preprocess.js';

test('crop percentages map to source resolution with validated bounds', () => {
  assert.deepEqual(receiptCrop(2160, 3840, { left: 10, top: 40, right: 90, bottom: 60 }), { x: 216, y: 1536, width: 1728, height: 768 });
  assert.deepEqual(receiptCrop(100, 200), { x: 0, y: 0, width: 100, height: 200 });
  for (const bounds of [{ left: 20, right: 10, top: 0, bottom: 100 }, { left: -1, right: 100, top: 0, bottom: 100 }, { left: NaN, right: 100, top: 0, bottom: 100 }]) assert.throws(() => receiptCrop(100, 200, bounds));
});

test('local normalization whitens shadowed paper and preserves dark strokes without mutating source', () => {
  const width = 100, height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4;
    pixels.fill(x === 50 ? 30 : 140 + y, p, p + 3); pixels[p + 3] = 255;
  }
  const before = pixels.slice();
  for (const mode of ['contrast', 'binary']) {
    const result = enhanceReceiptPixels(pixels, width, height, mode);
    assert.ok(result[(50 * width + 50) * 4] < 50);
    assert.ok(result[(50 * width + 10) * 4] > 240);
    assert.deepEqual(pixels, before);
  }
  assert.deepEqual(enhanceReceiptPixels(pixels, width, height, 'original'), before);
});

test('transparency becomes white and invalid modes are rejected', () => {
  assert.deepEqual([...enhanceReceiptPixels(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1)], [255, 255, 255, 255]);
  assert.throws(() => enhanceReceiptPixels(new Uint8ClampedArray(4), 1, 1, 'unknown'));
});
