// scripts/addSoftDeleteFields.js
const mongoose = require("mongoose");
const BOM = require("../models/BOM");
const Customer = require("../models/Customer");
const FG = require("../models/FG");
const Location = require("../models/Location");
const RawMaterial = require("../models/RawMaterial");
const Role = require("../models/Role");
const SFG = require("../models/SFG");
const UOM = require("../models/UOM");
const user = require("../models/user");
const Vendor = require("../models/Vendor");

const MONGO_URI =
  "mongodb+srv://buildscripttechnologies:erp@erp.mmhozvp.mongodb.net/?retryWrites=true&w=majority&appName=erp";

async function updateAllDocuments(Model, modelName) {
  const result = await Model.updateMany(
    {
      $or: [
        { isDeleted: { $exists: false } },
        { deletedAt: { $exists: false } },
      ],
    },
    {
      $set: { isDeleted: false, deletedAt: null },
    }
  );
  console.log(`${modelName} updated:`, result.modifiedCount);
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");

    await updateAllDocuments(BOM, "BOM");
    await updateAllDocuments(Customer, "Customer");
    await updateAllDocuments(FG, "FG");
    await updateAllDocuments(Location, "Location");
    await updateAllDocuments(RawMaterial, "RawMaterial");
    await updateAllDocuments(Role, "Role");
    await updateAllDocuments(SFG, "SFG");
    await updateAllDocuments(UOM, "UOM");
    await updateAllDocuments(user, "user");
    await updateAllDocuments(Vendor, "Vendor");

    console.log("All documents updated with isDeleted and deletedAt");
    process.exit(0);
  } catch (err) {
    console.error("Error updating documents:", err);
    process.exit(1);
  }
}

main();
