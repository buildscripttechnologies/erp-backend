const RawMaterial = require("../models/RawMaterial");
const StockLedger = require("../models/StockLedger");

const getLedgerStock = async (materialId, warehouse) => {
  const [warehouseStock, totalStock] = await Promise.all([
    StockLedger.aggregate([
      {
        $match: {
          itemId: materialId,
          itemType: "RM",
          warehouse,
        },
      },
      { $group: { _id: null, qty: { $sum: "$qty" } } },
    ]),
    StockLedger.aggregate([
      {
        $match: {
          itemId: materialId,
          itemType: "RM",
        },
      },
      { $group: { _id: null, qty: { $sum: "$qty" } } },
    ]),
  ]);

  return {
    warehouseQty: Math.max(0, Number(warehouseStock[0]?.qty) || 0),
    totalQty: Math.max(0, Number(totalStock[0]?.qty) || 0),
  };
};

exports.updateStock = async (materialId, qty, warehouse, type = "ADD") => {
  if (!["ADD", "REMOVE"].includes(type)) {
    throw new Error("Invalid stock update type");
  }

  const stockQty = Number(qty);
  if (!Number.isFinite(stockQty)) {
    throw new Error("Invalid stock quantity");
  }

  const item = await RawMaterial.findById(materialId);
  if (!item) throw new Error("Raw Material not found");
  const ledgerStock = await getLedgerStock(item._id, warehouse);

  // --- Update warehouse-wise stock ---
  const index = item.stockByWarehouse.findIndex(
    (w) => String(w.warehouse) === String(warehouse)
  );

  if (type === "REMOVE") {
    const currentWarehouseQty = ledgerStock.warehouseQty;

    if (currentWarehouseQty < stockQty) {
      throw new Error(
        `Insufficient stock in ${warehouse}. Available: ${currentWarehouseQty}, Required: ${stockQty}`
      );
    }
  }

  // --- Update total stock ---
  const currentStockQty = ledgerStock.totalQty;
  if (type === "ADD") item.stockQty = currentStockQty + stockQty;
  if (type === "REMOVE") item.stockQty = currentStockQty - stockQty;

  console.log("Updated total stock:", item.stockQty);

  if (index === -1) {
    // warehouse not present → add
    item.stockByWarehouse.push({
      warehouse,
      qty: type === "ADD" ? stockQty : -stockQty,
    });
  } else {
    // warehouse exists → update qty
    const currentWarehouseQty = ledgerStock.warehouseQty;
    if (type === "ADD") {
      item.stockByWarehouse[index].qty = currentWarehouseQty + stockQty;
    }
    if (type === "REMOVE") {
      item.stockByWarehouse[index].qty = currentWarehouseQty - stockQty;
    }
  }

  await item.save();
  return item;
};
