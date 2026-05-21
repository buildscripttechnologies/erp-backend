// models/productionLog.js

const mongoose = require("mongoose");

const productionLogSchema = new mongoose.Schema({
  date: Date,

  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductionTask",
  },

  miId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MI",
  },

  itemDetailId: mongoose.Schema.Types.ObjectId,

  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Machine",
  },

  labourId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  partName: String,
  stage: String,

  bomQty: Number,
  targetPerHour: Number,

  hourlyData: [
    {
      date: Date, 
      hourSlot: String,
      inputQty: Number,
      outputQty: Number,
      balanceQty: Number,
      efficiency: Number,
    }
  ],

  totalProduced: {
    type: Number,
    default: 0,
  },

  totalBalance: {
    type: Number,
    default: 0,
  },

  trackingType: {
  type: String,
  enum: ["Hourly", "StartEnd"],
},

  stitchGroupId: {
    type: String,
    default: null,
  },

}, { timestamps: true });

module.exports = mongoose.model("ProductionLog", productionLogSchema);
