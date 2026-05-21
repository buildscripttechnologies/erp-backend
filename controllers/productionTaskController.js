const ProductionTask = require("../models/productionTask");
const ProductionLog = require("../models/productionLog");
const { checkAndComplete } = require("../services/taskCompletion");
const MI = require("../models/MI");
const User = require("../models/user");
const Machine = require("../models/machine");
const { autoAssign } = require("../services/assignment");

const taskPopulate = [
  {
    path: "assignedUser",
    select: "fullName username userType skills efficiencyScore currentLoad status",
  },
  {
    path: "assignedMachine",
    select: "name code type subType status currentLoad capacityPerHour isActive",
  },
  {
    path: "assignedBy",
    select: "fullName username userType",
  },
];

const isRunningLoadStatus = (status) => ["Assigned", "In Progress"].includes(status);
const isStitchingStage = (stage) => String(stage || "").trim() === "Stitching";

const createProductionLogPayload = (task) => ({
  date: new Date(),
  taskId: task._id,
  miId: task.miId,
  itemDetailId: task.itemDetailId,
  machineId: task.assignedMachine,
  labourId: task.assignedUser || null,
  partName: task.partName,
  stage: task.stage,
  bomQty: task.qty,
  trackingType: isStitchingStage(task.stage) ? "Hourly" : "StartEnd",
  targetPerHour: Math.ceil((Number(task.qty) || 0) / 8),
  totalProduced: 0,
  totalBalance: task.qty,
  hourlyData: [],
  stitchGroupId: isStitchingStage(task.stage)
    ? (task.stitchGroupId || task.miId.toString())
    : null,
});

const ensureProductionLog = async (task) => {
  let log = await ProductionLog.findOne({ taskId: task._id });

  if (!log) {
    log = await ProductionLog.create(createProductionLogPayload(task));
  }

  return log;
};

const markTaskInProgress = async (task) => {
  if (task.status === "Assigned") {
    task.status = "In Progress";
    task.actualStartTime = new Date();
    await task.save();
  }

  const mi = await MI.findById(task.miId);

  if (mi) {
    const item = mi.itemDetails.id(task.itemDetailId);

    if (item) {
      const stageObj = item.stages.find((s) => s.stage === task.stage);

      if (stageObj && stageObj.status !== "In Progress") {
        stageObj.status = "In Progress";
        stageObj.startedAt = new Date();
      }

      item.currentStatus = task.stage;

      await mi.save();
    }
  }
};

exports.getTasksByMI = async (req, res) => {
  try {
    const tasks = await ProductionTask.find({ miId: req.params.miId })
      .populate(taskPopulate)
      .sort({ createdAt: 1, _id: 1 });

    res.status(200).json({
      status: 200,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
};

exports.getAssignmentOptions = async (req, res) => {
  try {
    const { stage = "" } = req.query;
    const stageName = String(stage || "").trim();

    const userFilter = {
      status: "Active",
      deleted: { $ne: true },
    };

    if (stageName) {
      userFilter.skills = { $in: [stageName] };
    }

    const machineFilter = {
      isActive: true,
      deleted: { $ne: true },
    };

    if (stageName) {
      machineFilter.type = stageName;
    }

    const [operators, machines] = await Promise.all([
      isStitchingStage(stageName)
        ? []
        : User.find(userFilter)
          .select("fullName username userType skills efficiencyScore currentLoad status")
          .sort({ fullName: 1, username: 1 }),
      Machine.find(machineFilter)
        .select("name code type subType status currentLoad capacityPerHour isActive assignedOperators")
        .sort({ currentLoad: 1, code: 1 }),
    ]);

    res.status(200).json({
      status: 200,
      operators,
      machines,
    });
  } catch (error) {
    res.status(500).json({ status: 500, error: error.message });
  }
};

exports.retryAutoAssignTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await ProductionTask.findById(taskId);

    if (!task) {
      return res.status(404).json({ status: 404, message: "Task not found" });
    }

    if (task.status === "Completed") {
      return res.status(400).json({
        status: 400,
        message: "Completed task cannot be assigned again.",
      });
    }

    if (
      (isStitchingStage(task.stage) && task.assignedMachine) ||
      (!isStitchingStage(task.stage) && task.assignedUser && task.assignedMachine)
    ) {
      const populatedTask = await ProductionTask.findById(task._id).populate(
        taskPopulate
      );
      return res.status(200).json({
        status: 200,
        message: "Task is already assigned.",
        data: populatedTask,
      });
    }

    task.assignmentMode = "Auto";
    task.assignedBy = null;
    task.assignmentNote = "";
    if (!["Pending", "Queued"].includes(task.status)) {
      task.status = "Pending";
    }
    await task.save();

    const assignedTask = await autoAssign(task);

    if (!assignedTask) {
      return res.status(422).json({
        status: 422,
        message: "Assignment still pending. Please check operator skill and machine availability.",
      });
    }

    const populatedTask = await ProductionTask.findById(assignedTask._id).populate(
      taskPopulate
    );

    if (global.io) {
      global.io.emit("task_assignment_retried", populatedTask);
    }

    res.status(200).json({
      status: 200,
      message: "Assignment retried successfully.",
      data: populatedTask,
    });
  } catch (error) {
    console.error("❌ retryAutoAssignTask error:", error.message);
    res.status(500).json({ status: 500, message: error.message });
  }
};

exports.manualAssignTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { assignedUser, assignedMachine, assignmentNote = "" } = req.body;

    const task = await ProductionTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ status: 404, message: "Task not found" });
    }

    const isStitchingTask = isStitchingStage(task.stage);

    if (!isStitchingTask && !assignedUser) {
      return res.status(400).json({
        status: 400,
        message: "Assigned operator is required.",
      });
    }

    if (isStitchingTask && !assignedMachine) {
      return res.status(400).json({
        status: 400,
        message: "Assigned machine is required for stitching.",
      });
    }

    if (task.status === "Completed") {
      return res.status(400).json({
        status: 400,
        message: "Completed task cannot be reassigned.",
      });
    }

    let operator = null;
    if (!isStitchingTask) {
      operator = await User.findOne({
        _id: assignedUser,
        status: "Active",
        deleted: { $ne: true },
      });

      if (!operator) {
        return res.status(404).json({
          status: 404,
          message: "Active operator not found.",
        });
      }
    }

    let machine = null;
    if (assignedMachine) {
      machine = await Machine.findOne({
        _id: assignedMachine,
        isActive: true,
        deleted: { $ne: true },
      });

      if (!machine) {
        return res.status(404).json({
          status: 404,
          message: "Active machine not found.",
        });
      }

      if (isStitchingTask && machine.type !== "Stitching") {
        return res.status(400).json({
          status: 400,
          message: "Only stitching machines can be assigned to stitching tasks.",
        });
      }
    }

    const previousUserId = task.assignedUser?.toString();
    const previousMachineId = task.assignedMachine?.toString();
    const targetMachineId = assignedMachine || previousMachineId || null;
    const wasRunningLoad = isRunningLoadStatus(task.status);

    if (wasRunningLoad) {
      if (previousUserId && previousUserId !== assignedUser) {
        await User.updateOne(
          { _id: previousUserId },
          { $inc: { currentLoad: -Math.max(Number(task.qty) || 0, 0) } }
        );
      }

      if (previousMachineId && previousMachineId !== targetMachineId) {
        await Machine.updateOne(
          { _id: previousMachineId },
          { $inc: { currentLoad: -Math.max(Number(task.qty) || 0, 0) } }
        );
      }
    }

    let nextStatus = task.status;

    if (["Pending", "Queued"].includes(task.status)) {
      if (targetMachineId) {
        const busyTask = await ProductionTask.exists({
          _id: { $ne: task._id },
          assignedMachine: targetMachineId,
          status: { $in: ["Assigned", "In Progress"] },
        });
        nextStatus = busyTask ? "Queued" : "Assigned";
      } else {
        nextStatus = "Assigned";
      }
    }

    const willRunLoad = isRunningLoadStatus(nextStatus);

    if (willRunLoad) {
      if (!isStitchingTask && (!wasRunningLoad || previousUserId !== assignedUser)) {
        await User.updateOne(
          { _id: assignedUser },
          { $inc: { currentLoad: Math.max(Number(task.qty) || 0, 0) } }
        );
      }

      if (
        targetMachineId &&
        (!wasRunningLoad || previousMachineId !== targetMachineId)
      ) {
        await Machine.updateOne(
          { _id: targetMachineId },
          {
            $inc: { currentLoad: Math.max(Number(task.qty) || 0, 0) },
            $set: { status: "Running" },
          }
        );
      }
    } else if (targetMachineId) {
      await Machine.updateOne(
        { _id: targetMachineId },
        { $set: { status: "Running" } }
      );
    }

    task.assignedUser = isStitchingTask ? null : assignedUser;
    if (assignedMachine !== undefined) {
      task.assignedMachine = assignedMachine || null;
    }
    task.assignmentMode = "Manual";
    task.assignedBy = req.user?._id || null;
    task.assignedAt = new Date();
    task.assignmentNote = String(assignmentNote || "").trim();
    task.status = nextStatus;

    await task.save();

    await ProductionLog.updateMany(
      { taskId: task._id },
      {
        $set: {
          labourId: task.assignedUser || null,
          machineId: task.assignedMachine,
        },
      }
    );

    const populatedTask = await ProductionTask.findById(task._id).populate(
      taskPopulate
    );

    if (global.io) {
      global.io.emit("task_manual_assigned", populatedTask);
    }

    res.status(200).json({
      status: 200,
      message: isStitchingTask ? "Stitching machine assigned manually" : "Task assigned manually",
      data: populatedTask,
    });
  } catch (error) {
    console.error("❌ manualAssignTask error:", error.message);
    res.status(500).json({ status: 500, error: error.message });
  }
};

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

    await markTaskInProgress(task);

    // =====================================================
    // 🔥 3. ENSURE PRODUCTION LOG
    // =====================================================
    let log = await ensureProductionLog(task);

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

exports.scanStitchingMachine = async (req, res) => {
  try {
    const machineCode = String(
      req.body.machineCode || req.body.code || req.params.machineCode || ""
    ).trim();

    if (!machineCode) {
      return res.status(400).json({
        status: 400,
        message: "Machine code is required.",
      });
    }

    const machine = await Machine.findOne({
      code: machineCode.toUpperCase(),
      type: "Stitching",
      isActive: true,
      deleted: { $ne: true },
    });

    if (!machine) {
      return res.status(404).json({
        status: 404,
        message: "Active stitching machine not found.",
      });
    }

    let task = await ProductionTask.findOne({
      assignedMachine: machine._id,
      stage: "Stitching",
      status: "In Progress",
    }).sort({ actualStartTime: -1, updatedAt: -1 });

    if (!task) {
      task = await ProductionTask.findOne({
        assignedMachine: machine._id,
        stage: "Stitching",
        status: "Assigned",
      }).sort({ assignedAt: 1, createdAt: 1 });
    }

    if (!task) {
      return res.status(404).json({
        status: 404,
        message: "No active stitching task found for this machine.",
        data: { machine },
      });
    }

    if (task.status === "Assigned") {
      await markTaskInProgress(task);
    }

    const log = await ensureProductionLog(task);
    const populatedTask = await ProductionTask.findById(task._id).populate(
      taskPopulate
    );

    if (global.io) {
      global.io.emit("stitching_machine_scanned", {
        machineId: machine._id,
        machineCode: machine.code,
        taskId: task._id,
        logId: log._id,
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Stitching hourly entry ready.",
      data: {
        screen: "StitchingHourlyEntry",
        machine,
        task: populatedTask,
        log,
        taskId: task._id,
        logId: log._id,
      },
    });
  } catch (error) {
    console.error("❌ scanStitchingMachine error:", error.message);
    return res.status(500).json({ status: 500, message: error.message });
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
