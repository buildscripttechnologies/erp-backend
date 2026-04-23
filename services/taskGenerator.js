const ProductionTask = require("../models/productionTask");
const { autoAssign } = require("./assignment");

async function generateTasksFromMI(mi) {
    const tasks = [];

    for (const item of mi.itemDetails) {
        if (item.jobWorkType === "Outside Company") continue;

        // 🔥 ONLY FIRST STAGE
        tasks.push({
            miId: mi._id,
            itemDetailId: item._id,
            partName: item.partName,
            category: item.category,
            stage: "Cutting",
            qty: item.qty,
            status: "Pending",
            cuttingType: item.cuttingType,
            isWaiting: false,
        });
    }

    // 🔥 INSERT TASKS
    const createdTasks = await ProductionTask.insertMany(tasks);

    // 🔥 AUTO ASSIGN FIRST STAGE
    for (const task of createdTasks) {
        await autoAssign(task);
    }
}

module.exports = { generateTasksFromMI };