const express = require("express");
const {
  createStockEntry,
  getAllStocks,
  getBarcodesByStockId,
  deleteStock,
  getAllStocksMerged,
} = require("../controllers/stockController");
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");

const router = express.Router();

// Create stock + generate barcodes
router.post(
  "/add",
  auth,
  checkPermission(["Material Inward"], "write"),
  createStockEntry
);

// // Get all stocks with pagination
router.get(
  "/get-all",
  auth,
  checkPermission(["Material Inward"], "read"),
  getAllStocks
);

router.get(
  "/get-all-merged",
  auth,
  checkPermission(["Stock"], "read"),
  getAllStocksMerged
);

// Get barcodes for a given stock
router.get(
  "/barcodes/:id",
  auth,
  checkPermission(["Material Inward"], "read"),
  getBarcodesByStockId
);

// Soft delete stock
router.delete(
  "/delete/:id",
  auth,
  checkPermission(["Material Inward"], "delete"),
  deleteStock
);

module.exports = router;
