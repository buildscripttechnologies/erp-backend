const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const accessoryIssueSchema = new mongoose.Schema(
  {
    accessory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accessory",
      default: null,
    },
    issueQty: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);
applySoftDelete(accessoryIssueSchema);

const AccessoryIssue = mongoose.model(
  "AccessoryIssue",
  accessoryIssueSchema
);

module.exports = AccessoryIssue;
