// models/StockLedger.js
const mongoose = require("mongoose");

const stockLedgerSchema = new mongoose.Schema(
  {
    // Which item
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "itemType", // dynamic reference
    },

    // RM / SFG / FG
    itemType: {
      type: String,
      enum: ["RM", "SFG", "FG"],
      required: true,
    },

    // Where
    warehouse: {
      type: String,
      required: true,
    },

    // Movement
    qty: {
      type: Number,
      required: true, // +IN , -OUT
    },

    // What kind of movement
    movementType: {
      type: String,
      enum: [
        "GRN",        // Material Inward
        "ISSUE",      // Production usage
        "SALE",       // Sales
        "TRANSFER",   // Warehouse transfer
        "DAMAGE",     // Damaged
        "ADJUSTMENT"  // Manual correction
      ],
      required: true,
    },

    // Link to document
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    referenceModel: {
      type: String, // PO, MO, Invoice, Stock
    },

    // Barcode support
    barcode: {
      type: String,
    },

     batchNo: {
      type: String, // PO number / GRN number
    },

    // StockLedger schema
    stockUOM: { type: mongoose.Schema.Types.ObjectId, ref: "UOM" }
    ,

    // Cost at that time (VERY IMPORTANT for ERP)
    rateAtThatTime: {
      type: Number,
      default: 0,
    },

    grnNumber: {
      type: String,
      index: true,
      unique: true,
      sparse: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    remarks: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("StockLedger", stockLedgerSchema);
