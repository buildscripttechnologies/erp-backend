const express = require("express");
const {
  createStockEntry,
  getAllStocks,
  getBarcodesByStockId,
  deleteStock,
} = require("../controllers/stockController");
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");

const router = express.Router();

// Create stock + generate barcodes
router.post("/add", auth, checkPermission("Stock", "write"), createStockEntry);

// // Get all stocks with pagination
router.get("/get-all", auth, checkPermission("Stock", "read"), getAllStocks);

// Get barcodes for a given stock
router.get(
  "/barcodes/:id",
  auth,
  checkPermission("Stock", "read"),
  getBarcodesByStockId
);

// Soft delete stock
router.delete(
  "/delete/:id",
  auth,
  checkPermission("Stock", "delete"),
  deleteStock
);

module.exports = router;
