const RawMaterial = require("../models/RawMaterial");

const syncRawMaterials = async () => {
  console.log("🔄 Starting raw materials sync...");

  const cursor = RawMaterial.find().lean().cursor();
  let bulkOps = [];
  let updatedCount = 0;

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const expectedTotalRate = (doc.rate ?? 0) * (doc.stockQty ?? 0);

    if (doc.totalRate !== expectedTotalRate) {
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: { totalRate: expectedTotalRate },
          },
        },
      });
    }

    if (bulkOps.length === 500) {
      await RawMaterial.bulkWrite(bulkOps);
      updatedCount += bulkOps.length;
      bulkOps = [];
    }
  }

  if (bulkOps.length > 0) {
    await RawMaterial.bulkWrite(bulkOps);
    updatedCount += bulkOps.length;
  }

  console.log(
    `✅ Raw materials sync complete. Updated ${updatedCount} records.`
  );
};

module.exports = syncRawMaterials;
