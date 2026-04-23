const ProductionLog = require("../models/productionLog");
const { checkAndComplete } = require("../services/taskCompletion");
const User = require("../models/user");

// 🔥 GET LOG
exports.getProductionLogByTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const log = await ProductionLog.findOne({ taskId });

    if (!log) {
      return res.status(404).json({ message: "Production log not found" });
    }

    res.json({
      success: true,
      data: log
    });

  } catch (error) {
    console.error("❌ getProductionLogByTask error:", error.message);
    res.status(500).json({ error: error.message });
  }
};


// 🔥 ADD HOURLY (ONLY FOR STITCHING)
exports.addHourlyProduction = async (req, res) => {
  try {
    const { taskId, hourSlot, outputQty } = req.body;

    // 1️⃣ Get log
    const log = await ProductionLog.findOne({ taskId });

    if (!log) {
      return res.status(404).json({ message: "Production log not found" });
    }

    // 🚨 BLOCK non-stitching
    if (log.trackingType !== "Hourly") {
      return res.status(400).json({
        message: "Hourly entry allowed only for Stitching tasks"
      });
    }

    const today = new Date();

    // 2️⃣ Prevent duplicate entry for same day + hour
    const exists = log.hourlyData.find(h =>
      h.hourSlot === hourSlot &&
      new Date(h.date).toDateString() === today.toDateString()
    );

    if (exists) {
      return res.status(400).json({
        message: "Hour already entered for today"
      });
    }

    // 3️⃣ FIXED INPUT (IMPORTANT CHANGE)
    const inputQty = log.targetPerHour;

    const safeInput = inputQty || 1;

    const balanceQty = Math.max(0, inputQty - outputQty);

    const entry = {
      date: today, // 🔥 FIX: multi-day support
      hourSlot,
      inputQty,
      outputQty,
      balanceQty,
      efficiency: outputQty / safeInput,
    };

    // 4️⃣ Update log
    log.hourlyData.push(entry);

    log.totalProduced += outputQty;

    // 🔥 FIXED total balance
    log.totalBalance = log.bomQty - log.totalProduced;

    await log.save();

    // 5️⃣ Update efficiency
    const user = await User.findById(log.labourId);

    if (user && log.hourlyData.length > 0) {
      const totalHours = log.hourlyData.length;
      const avgOutput = log.totalProduced / totalHours;

      user.efficiencyScore = avgOutput;
      await user.save();
    }

    // 6️⃣ Completion check
    await checkAndComplete(taskId);

    // 7️⃣ Realtime (safe)
    if (global.io) {
      global.io.emit("production_update", log);
    }

    res.json({ success: true, data: log });

  } catch (error) {
    console.error("❌ addHourlyProduction error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// 🔥 EDIT HOURLY ENTRY
exports.updateHourlyProduction = async (req, res) => {
  try {
    const { taskId, entryId, outputQty } = req.body;

    // 1️⃣ Get log
    const log = await ProductionLog.findOne({ taskId });

    if (!log) {
      return res.status(404).json({ message: "Production log not found" });
    }

    if (log.trackingType !== "Hourly") {
      return res.status(400).json({
        message: "Only hourly logs can be edited"
      });
    }

    // 2️⃣ Find entry
    const entry = log.hourlyData.id(entryId);

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    // 🔥 Update output
    entry.outputQty = outputQty;

    // =====================================================
    // 🔥 RECALCULATE EVERYTHING (IMPORTANT)
    // =====================================================
    let totalProduced = 0;

    for (const h of log.hourlyData) {

      const inputQty = log.targetPerHour;
      const safeInput = inputQty || 1;

      h.inputQty = inputQty;
      h.balanceQty = Math.max(0, inputQty - h.outputQty);
      h.efficiency = h.outputQty / safeInput;

      totalProduced += h.outputQty;
    }

    log.totalProduced = totalProduced;
    log.totalBalance = log.bomQty - totalProduced;

    await log.save();

    // =====================================================
    // 🔥 UPDATE USER EFFICIENCY
    // =====================================================
    const user = await User.findById(log.labourId);

    if (user && log.hourlyData.length > 0) {
      const avgOutput = totalProduced / log.hourlyData.length;
      user.efficiencyScore = avgOutput;
      await user.save();
    }

    // =====================================================
    // 🔥 COMPLETION CHECK
    // =====================================================
    await checkAndComplete(taskId);

    // =====================================================
    // 🔥 REALTIME
    // =====================================================
    if (global.io) {
      global.io.emit("production_update", log);
    }

    res.json({
      success: true,
      message: "Hourly entry updated",
      data: log
    });

  } catch (error) {
    console.error("❌ updateHourlyProduction error:", error.message);
    res.status(500).json({ error: error.message });
  }
};


// 🔥 START TASK
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

    // ✅ Update task
    task.status = "In Progress";
    task.actualStartTime = new Date();

    await task.save();

    // 🔥 Ensure ProductionLog exists
    let log = await ProductionLog.findOne({ taskId });

    if (!log) {
      log = await ProductionLog.create({
        taskId: task._id,
        miId: task.miId,
        itemDetailId: task.itemDetailId,
        machineId: task.assignedMachine,
        labourId: task.assignedUser,
        partName: task.partName,
        stage: task.stage,
        bomQty: task.qty,
        targetPerHour: Math.ceil(task.qty / 8), // simple default

        trackingType:
          task.stage === "Stitching" ? "Hourly" : "StartEnd",

        totalProduced: 0,
        totalBalance: task.qty,
        hourlyData: [],
      });
    }

    // 🔥 realtime
    if (global.io) {
      global.io.emit("task_started", task);
    }

    res.json({
      success: true,
      message: "Task started successfully",
      data: {
        task,
        log
      }
    });

  } catch (error) {
    console.error("❌ startTask error:", error.message);
    res.status(500).json({ error: error.message });
  }
};