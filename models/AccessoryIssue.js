const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const accessoryIssueSchema = new mongoose.Schema(
  {
    accessories: [
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
        remarks: {
          type: String,
          default: "",
        },
      },
    ],

    issueNo: {
      type: Number,
    },

    personName: {
      type: String,
      default: "",
    },
    receivedBy: {
      type: String,
      default: "",
    },
    department: {
      type: String,
      default: "",
    },
    issueReason: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);
applySoftDelete(accessoryIssueSchema);

const AccessoryIssue = mongoose.model("AccessoryIssue", accessoryIssueSchema);

module.exports = AccessoryIssue;
