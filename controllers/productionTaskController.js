const ProductionTask = require("../models/productionTask");
const ProductionLog = require("../models/productionLog");
const { checkAndComplete } = require("../services/taskCompletion");
const MI = require("../models/MI");

exports.startTask = async (req, res) => {
  try {
    const { taskId } = req.body;

    const task = await ProductionTask.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // 🚨 Prevent invalid states
    if (task.status === "In Progress") {
      return res.status(400).json({ message: "Task already started" });
    }

    if (task.status !== "Assigned") {
      return res.status(400).json({
        message: "Only assigned tasks can be started"
      });
    }

    // =====================================================
    // 🔥 1. UPDATE TASK
    // =====================================================
    task.status = "In Progress";
    task.actualStartTime = new Date();
    await task.save();

    // =====================================================
    // 🔥 2. UPDATE MI (STAGE START)
    // =====================================================
    const mi = await MI.findById(task.miId);

    if (mi) {
      const item = mi.itemDetails.id(task.itemDetailId);

      if (item) {
        const stageObj = item.stages.find(s => s.stage === task.stage);

        if (stageObj) {
          stageObj.status = "In Progress";
          stageObj.startedAt = new Date();
        }

        // 👇 current running stage
        item.currentStatus = task.stage;

        await mi.save();
      }
    }

    // =====================================================
    // 🔥 3. ENSURE PRODUCTION LOG
    // =====================================================
    let log = await ProductionLog.findOne({ taskId });

    if (!log) {
      log = await ProductionLog.create({
        date: new Date(),
        taskId: task._id,
        miId: task.miId,
        itemDetailId: task.itemDetailId,
        machineId: task.assignedMachine,
        labourId: task.assignedUser,
        partName: task.partName,
        stage: task.stage,
        bomQty: task.qty,

        trackingType:
          task.stage === "Stitching" ? "Hourly" : "StartEnd",

        targetPerHour: Math.ceil(task.qty / 8),

        totalProduced: 0,
        totalBalance: task.qty,
        hourlyData: [],

        stitchGroupId:
          task.stage === "Stitching"
            ? (task.stitchGroupId || task.miId.toString())
            : null,
      });
    }

    // =====================================================
    // 🔥 4. REALTIME (SAFE)
    // =====================================================
    if (global.io) {
      global.io.emit("task_started", {
        taskId: task._id,
        stage: task.stage,
        machine: task.assignedMachine,
        user: task.assignedUser
      });
    }

    res.json({
      success: true,
      data: { task, log }
    });

  } catch (error) {
    console.error("❌ startTask error:", error.message);
    res.status(500).json({ error: error.message });
  }
};



// 🔥 END TASK (NON-STITCHING ONLY)
// 🔥 END TASK (NON-STITCHING ONLY)
exports.endTask = async (req, res) => {
  try {
    const { taskId } = req.body;

    const task = await ProductionTask.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.status !== "In Progress") {
      return res.status(400).json({
        message: "Only in-progress tasks can be ended"
      });
    }

    const log = await ProductionLog.findOne({ taskId });

    if (log?.trackingType === "Hourly") {
      return res.status(400).json({
        message: "Use hourly production for stitching tasks"
      });
    }

    // 🔥 ONLY set end time
    task.actualEndTime = new Date();

    await task.save();

    // 🔥 Update log
    if (log) {
      log.totalProduced = task.qty;
      log.totalBalance = 0;
      await log.save();
    }

    // 🔥 NOW let system decide completion
    await checkAndComplete(taskId);

    if (global.io) {
      global.io.emit("task_ended", {
        taskId: task._id,
        stage: task.stage
      });
    }

    res.json({
      success: true,
      message: "Task ended successfully",
      data: task
    });

  } catch (error) {
    console.error("❌ endTask error:", error.message);
    res.status(500).json({ error: error.message });
  }
};