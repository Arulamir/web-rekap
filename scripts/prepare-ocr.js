import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'public', 'ocr');
await mkdir(target, { recursive: true });
await copyFile(path.join(root, 'node_modules/tesseract.js/dist/worker.min.js'), path.join(target, 'worker.min.js'));
const core = path.join(root, 'node_modules/tesseract.js-core');
for (const file of await readdir(core)) {
  if (/^tesseract-core.*lstm\.wasm(?:\.js)?$/.test(file)) await copyFile(path.join(core, file), path.join(target, file));
}
for (const lang of ['ind', 'eng']) {
  await copyFile(path.join(root, `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`), path.join(target, `${lang}.traineddata.gz`));
}
console.log('OCR worker, WASM, and Indonesian/English models ready on this website.');
