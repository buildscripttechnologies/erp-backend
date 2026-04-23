const ProductionTask = require("../models/productionTask");
const Machine = require("../models/machine");

async function splitStitchingByMI(miId) {

  // 🔥 check already split
  const alreadySplit = await ProductionTask.exists({
    miId,
    stage: "Stitching",
    stitchGroupId: { $regex: "_part_" }
  });

  if (alreadySplit) {
    console.log("✅ Already split");
    return;
  }

  // 🔥 total stitching qty
  const result = await ProductionTask.aggregate([
    {
      $match: { miId, stage: "Stitching" }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$qty" }
      }
    }
  ]);

  const totalQty = result[0]?.total || 0;

  const machine = await Machine.findOne({ type: "Stitching" });

  if (!machine?.capacityPerHour) return;

  const capacity = machine.capacityPerHour * 8;

  // 🔥 NO NEED TO SPLIT
  if (totalQty <= capacity) {
    await ProductionTask.updateMany(
      { miId, stage: "Stitching" },
      { $set: { stitchGroupId: miId.toString() } }
    );
    return;
  }

  // 🔥 SPLIT
  console.log("⚠️ Splitting stitching at MI level");

  const parts = Math.ceil(totalQty / capacity);

  const tasks = await ProductionTask.find({
    miId,
    stage: "Stitching"
  });

  let groupIndex = 0;

  for (const task of tasks) {

    const groupId = `${miId}_part_${groupIndex}`;

    await ProductionTask.updateOne(
      { _id: task._id },
      { $set: { stitchGroupId: groupId } }
    );

    groupIndex = (groupIndex + 1) % parts;
  }
}

module.exports = { splitStitchingByMI };