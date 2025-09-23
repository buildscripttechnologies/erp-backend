const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const { type } = require("os");

const miSchema = new mongoose.Schema(
  {
    prodNo: String,
    bom: { type: mongoose.Schema.Types.ObjectId, ref: "BOM" },
    bomNo: String,
    productName: String,
    type: { type: String, enum: ["SFG", "FG"] },
    description: String,
    status: {
      type: String,
      default: "Pending",
    },
    readyForStitching: { type: Boolean, default: false },
    readyForChecking: { type: Boolean, default: false },
    itemDetails: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "itemDetails.type",
        },
        type: {
          type: String,
          enum: ["RawMaterial", "SFG", "FG"],
        },
        partName: String,
        height: Number,
        width: Number,
        category: String,
        qty: Number,
        grams: Number,
        rate: Number,
        sqInchRate: Number,
        baseQty: Number,
        itemRate: Number,
        assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

        // 👇 Instead of only one status, keep both
        currentStatus: {
          type: String,
          default: "Pending",
        },

        stages: [
          {
            stage: {
              type: String,
              enum: [
                "Cutting",
                "Printing",
                "Stitching",
                "Checking",
                "Completed",
              ],
            },
            status: {
              type: String,
              enum: [
                "Yet to Start",
                "In Progress",
                "Paused",
                "Completed",
                "Approved",
              ],
              default: "Yet to Start",
            },
            startedAt: Date,
            endedAt: Date,
            note: String,
          },
        ],

        isPrint: { type: Boolean, default: false },
        cuttingType: String,
        jobWorkType: String,
        note: { type: String, default: "" },
        vendor: { type: String },
      },
    ],
    consumptionTable: [
      {
        skuCode: String,
        itemName: String,
        category: String,
        weight: { type: String }, // in kg if applicable
        qty: { type: String }, // in meters, pcs, etc.
        stockQty: Number,
        receiveQty: { type: Number, default: 0 },
        type: {
          type: String,
          default: "",
        },
        isChecked: Boolean,
        isReceived: { type: Boolean, default: false },
        receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        receivedAt: { type: Date },
        extra: { type: Number, default: 0 },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);
applySoftDelete(miSchema);
const MI = mongoose.model("MI", miSchema);
module.exports = MI;
