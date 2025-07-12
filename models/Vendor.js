const mongoose = require("mongoose");

const vendorSchema = mongoose.Schema(
  {
    venderCode: String,
    vendorName: String,
    natureOfBusiness: String,
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    gst: String,

    factoryAddress: String,
    factoryCity: String,
    factoryState: String,
    factoryCountry: String,
    factoryPostalCode: String,

    bankName: String,
    branch: String,
    accountNo: String,
    ifscCode: String,
    priceTerms: String,
    paymentTerms: String,

    isActive: {
      type: Boolean,
      default: true,
    },

    contactPersons: [
      {
        contactPerson: String,
        designation: String,
        phone: String,
        email: String,
        information: String,
      },
    ],

    rm: [
      {
        type: {
          type: String,
          enum: ["RawMaterial", "SFG", "FG"],
        },
        item: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "type",
        },
        deliveryDays: Number,
        moq: Number,
        uom: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "UOM",
        },
        rate: Number,
        preferenceIndex: String,
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Vendor = mongoose.model("Vendor", vendorSchema);
module.exports = Vendor;
