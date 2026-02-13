const mongoose = require("mongoose");
const StockLedger = require("../models/StockLedger"); // adjust path if needed

const MONGO_URI = "mongodb://ikhodal_erp_user:Build%40072025@147.93.111.196:27017/ikhodal_erp_db?authSource=ikhodal_erp_db";

// Financial Year function
const getFinancialYear = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  if (month >= 4) {
    return `${year.toString().slice(-2)}${(year + 1).toString().slice(-2)}`;
  } else {
    return `${(year - 1).toString().slice(-2)}${year.toString().slice(-2)}`;
  }
};

const run = async () => {

  try {

    await mongoose.connect(MONGO_URI);

    console.log("Connected to MongoDB");

    const entries = await StockLedger.find({
      movementType: "GRN",
      $or: [
        { grnNumber: { $exists: false } },
        { grnNumber: null }
      ]
    }).sort({ createdAt: 1 });

    console.log(`Found ${entries.length} entries`);

    const fyCounters = {};

    for (const entry of entries) {

      const fy = getFinancialYear(entry.createdAt);

      if (!fyCounters[fy]) {

        const prefix = `GRNIKB${fy}`;

        const lastEntry = await StockLedger.findOne({
          grnNumber: { $regex: `^${prefix}` }
        })
          .sort({ grnNumber: -1 })
          .select("grnNumber");

        fyCounters[fy] = lastEntry?.grnNumber
          ? parseInt(lastEntry.grnNumber.slice(-3)) + 1
          : 1;
      }

      const sequence = String(fyCounters[fy]).padStart(3, "0");

      const grnNumber = `GRNIKB${fy}${sequence}`;

      await StockLedger.updateOne(
        { _id: entry._id },
        { $set: { grnNumber } }
      );

      console.log(`Added ${grnNumber}`);

      fyCounters[fy]++;
    }

    console.log("Migration complete");

    process.exit(0);

  } catch (err) {

    console.error(err);

    process.exit(1);
  }
};

run();
