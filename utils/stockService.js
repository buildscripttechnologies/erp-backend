const RawMaterial = require("../models/RawMaterial");

exports.updateStock = async (materialId, qty, warehouse, type = "ADD") => {
  const item = await RawMaterial.findById(materialId);
  if (!item) throw new Error("Raw Material not found");

  // --- Update total stock ---
  if (type === "ADD") item.stockQty += qty;
  if (type === "REMOVE") item.stockQty -= qty;

  console.log("Updated total stock:", item.stockQty);

  // --- Update warehouse-wise stock ---
  const index = item.stockByWarehouse.findIndex(
    (w) => String(w.warehouse) === String(warehouse)
  );

  if (index === -1) {
    // warehouse not present → add
    item.stockByWarehouse.push({
      warehouse,
      qty: type === "ADD" ? qty : -qty,
    });
  } else {
    // warehouse exists → update qty
    if (type === "ADD") item.stockByWarehouse[index].qty += qty;
    if (type === "REMOVE") item.stockByWarehouse[index].qty -= qty;
  }

  await item.save();
  return item;
};
