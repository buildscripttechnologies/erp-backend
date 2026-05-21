// models/productionTask.js

const mongoose = require("mongoose");

const productionTaskSchema = new mongoose.Schema({
  miId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MI",
  },

  itemDetailId: mongoose.Schema.Types.ObjectId,

  partName: String,
  category: String,

  stage: String,

  qty: Number,

  assignedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  assignedMachine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Machine",
  },

  assignmentMode: {
    type: String,
    enum: ["Auto", "Manual"],
    default: "Auto",
  },

  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  assignedAt: {
    type: Date,
    default: null,
  },

  assignmentNote: {
    type: String,
    default: "",
  },
  cuttingType: {
    type: String
  },

  isWaiting: {
    type: Boolean,
    default: false,
  },

  stitchGroupId: {
    type: String,
  },

  status: {
    type: String,
    enum: ["Pending", "Assigned", "Queued", "In Progress", "Completed"],
    default: "Pending",
  },

  actualStartTime: Date,
  actualEndTime: Date,

  _loadReduced: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

module.exports = mongoose.model("ProductionTask", productionTaskSchema);
