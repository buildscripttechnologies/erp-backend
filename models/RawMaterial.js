const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const rawMaterialSchema = new mongoose.Schema(
  {
    skuCode: {
      type: String,
      trim: true,
      unique: true,
    },
    itemName: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      default: "-",
    },
    hsnOrSac: {
      type: String,
    },
    type: {
      type: String,
      enum: ["RM"],
      default: "RM",
    },
    itemCategory: {
      type: String,
      default: "",
    },
    itemColor: {
      type: String,
      default: "",
    },

    qualityInspectionNeeded: {
      type: Boolean,
      default: false,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    baseQty: {
      type: Number,
      default: 0,
    },
    pkgQty: {
      type: Number,
      default: 0,
    },
    moq: {
      type: Number,
      default: 1,
    },
    baseUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    purchaseUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    rate: {
      type: Number,
      default: 0,
    },
    totalRate: { type: Number, default: 0 },
    gst: {
      type: Number,
      default: 0,
    },
    stockQty: {
      type: Number,
      default: 0,
    },
    stockUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    conversionFactor: {
      type: Number,
      default: 1, // Example: 1 box = 10 kg
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
      },
    ],
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true, // automatically handles createdAt and updatedAt
  }
);

applySoftDelete(rawMaterialSchema);

// rawMaterialSchema.pre("save", function (next) {
//   if (this.rate != null && this.stockQty != null) {
//     this.totalRate = this.rate * this.stockQty;
//   }
//   next();
// });

// rawMaterialSchema.pre("findOneAndUpdate", function (next) {
//   const update = this.getUpdate();
//   const rate = update.rate ?? update.$set?.rate;
//   const stockQty = update.stockQty ?? update.$set?.stockQty;

//   if (rate != null && stockQty != null) {
//     if (!update.$set) update.$set = {};
//     update.$set.totalRate = rate * stockQty;
//   }

//   next();
// });

// rawMaterialSchema.post("find", async function (docs) {
//   for (const doc of docs) {
//     if ((!doc.totalRate || doc.totalRate === 0) && doc.rate && doc.stockQty) {
//       doc.totalRate = doc.rate * doc.stockQty;
//       await doc.save(); // only if needed
//     }
//   }
// });

// rawMaterialSchema.post("findOne", async function (doc) {
//   if (
//     doc &&
//     (!doc.totalRate || doc.totalRate === 0) &&
//     doc.rate &&
//     doc.stockQty
//   ) {
//     doc.totalRate = doc.rate * doc.stockQty;
//     await doc.save(); // only if needed
//   }
// });

const RawMaterial = mongoose.model("RawMaterial", rawMaterialSchema);
module.exports = RawMaterial;

// async function updateExistingRawMaterials() {
//   const materials = await RawMaterial.find({});

//   for (const material of materials) {
//     if (!material.totalRate || material.totalRate === 0) {
//       material.totalRate = (material.rate || 0) * (material.stockQty || 0);
//       await material.save();
//     }
//   }

//   console.log("All existing raw materials updated with totalRate.");
// }

// updateExistingRawMaterials();
