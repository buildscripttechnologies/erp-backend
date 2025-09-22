const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const LeadSchema = new mongoose.Schema(
  {
    UNIQUE_QUERY_ID: { type: String, unique: true, required: true },
    QUERY_TYPE: String,
    QUERY_TIME: Date,
    SENDER_NAME: String,
    SENDER_EMAIL: String,
    SENDER_MOBILE: String,
    SENDER_COUNTRY_ISO: String,
    rawData: Object, // store full JSON for reference
  },
  { timestamps: true }
);
applySoftDelete(LeadSchema);
const IndiaMartLead = mongoose.model("IndiaMartLead", LeadSchema);
module.exports = IndiaMartLead;
