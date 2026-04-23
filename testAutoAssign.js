require("dotenv").config();
const mongoose = require("mongoose");

const { autoAssign } = require("../erp-backend/services/assignment");
const ProductionTask = require("../erp-backend/models/productionTask");

async function run() {
  try {
    // 🔥 1. Connect DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ DB Connected");

    // 🔥 2. Pick a task (change filter if needed)
    const task = await ProductionTask.findOne({
      status: "Pending" // or use _id
    });

    if (!task) {
      console.log("❌ No task found");
      return;
    }

    console.log("👉 Running autoAssign for:", task._id);

    // 🔥 3. Run function
    await autoAssign(task);

    console.log("🎉 Done");

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();