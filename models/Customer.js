const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require('../plugins/mongooseDeletePlugin');
const customerSchema = new mongoose.Schema(
  {
    customerCode: String,
    customerName: String,
    aliasName: String,
    natureOfBusiness: String,
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    gst: String,
    // bankName: String,
    // branch: String,
    // accountNumber: String,
    // ifscCode: String,
    // agentName: String,
    paymentTerms: String,
    leadCompetitor: String,
    transportationTime: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    contactPersons: [
      {
        contactPerson: String,
        designation: String,
        phone: String,
        email: String,
        information: String,
        isActive: { type: Boolean, default: true },
      },
    ],

    deliveryLocations: [
      {
        consigneeName: String,
        consigneeAddress: String,
        country: String,
        state: String,
        city: String,
        pinCode: String,
        gstinOfConsignee: String,
        storeIncharge: String,
        contactNo: String,
        email: String,
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
   
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applySoftDelete(customerSchema);

module.exports = mongoose.model("Customer", customerSchema);
