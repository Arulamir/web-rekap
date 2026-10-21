// price remains the line total for compatibility with existing reimbursements.
export function normalizeItem(input) {
  const item = String(input?.item || '').trim();
  const quantity = Number(input?.quantity ?? 1);
  const unitPrice = Number(input?.unit_price ?? input?.price);
  if (!item || item.length > 200) throw new Error('nama barang wajib diisi (maks. 200 karakter).');
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001) {
    throw new Error('Qty harus lebih dari 0, maksimal 1.000.000, dengan hingga 3 angka desimal.');
  }
  if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) throw new Error('harga satuan harus berupa Rupiah bulat lebih dari 0.');
  const price = Math.round(quantity * unitPrice);
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error('total item tidak valid atau terlalu besar.');
  return { item, quantity, unitPrice, price };
}

export function lineTotal(quantity, unitPrice) {
  const value = Math.round(Number(quantity) * Number(unitPrice));
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}
