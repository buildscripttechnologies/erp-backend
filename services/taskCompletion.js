const ProductionTask = require("../models/productionTask");
const ProductionLog = require("../models/productionLog");
const { getNextStage } = require("./flowHelper");
const { autoAssign } = require("./assignment");
const MI = require("../models/MI");
const User = require("../models/user");
const Machine = require("../models/machine");
const { splitStitchingByMI } = require("./stitchSplit");

// 🔥 Check if all non-stitching tasks are completed
async function canStartStitching(miId) {
  const tasks = await ProductionTask.find({
    miId,
    stage: { $ne: "Stitching" }
  });

  if (!tasks.length) return false;

  return tasks.every(t => t.status === "Completed");
}

// 🔥 MAIN COMPLETION HANDLER
async function checkAndComplete(taskId) {
  try {

    const task = await ProductionTask.findById(taskId);
    if (!task) return;

    const log = await ProductionLog.findOne({ taskId });

    let isCompleted = false;

    // =====================================================
    // 🔥 COMPLETION CHECK
    // =====================================================
    if (log?.trackingType === "Hourly") {
      if (log.totalProduced >= log.bomQty) {
        isCompleted = true;
      }
    } else {
      if (task.actualEndTime) {
        isCompleted = true;
      }
    }

    if (!isCompleted) return;
    if (task.status === "Completed") return;

    // =====================================================
    // 🔥 MARK COMPLETED
    // =====================================================
    task.status = "Completed";

    if (!task.actualEndTime) {
      task.actualEndTime = new Date();
    }

    await task.save();

    // =====================================================
    // 🔥 UPDATE MI STAGE
    // =====================================================
    const mi = await MI.findById(task.miId);

    if (mi) {
      const item = mi.itemDetails.id(task.itemDetailId);

      if (item) {
        const stageObj = item.stages.find(s => s.stage === task.stage);

        if (stageObj) {
          stageObj.status = "Completed";
          stageObj.endedAt = new Date();
        }

        item.currentStatus = "Completed";

        await mi.save();
      }
    }

    // =====================================================
    // 🔥 LOAD REDUCTION (SAFE)
    // =====================================================
    if (!task._loadReduced) {

      // 🔽 USER LOAD
      if (task.assignedUser) {
        const user = await User.findById(task.assignedUser);

        if (user) {
          const newLoad = Math.max(0, (user.currentLoad || 0) - task.qty);

          await User.updateOne(
            { _id: user._id },
            { $set: { currentLoad: newLoad } }
          );
        }
      }

      // 🔽 MACHINE LOAD
      if (task.assignedMachine) {
        const machine = await Machine.findById(task.assignedMachine);

        if (machine) {
          const newLoad = Math.max(0, (machine.currentLoad || 0) - task.qty);

          await Machine.updateOne(
            { _id: machine._id },
            { $set: { currentLoad: newLoad } }
          );
        }
      }

      // 🔥 MARK LOAD REDUCED
      task._loadReduced = true;
      await task.save();
    }

    // =====================================================
    // 🔥 QUEUE HANDLING
    // =====================================================
    if (task.assignedMachine) {

      const nextQueued = await ProductionTask.findOne({
        assignedMachine: task.assignedMachine,
        status: "Queued"
      }).sort({ createdAt: 1 });

      if (nextQueued) {

        nextQueued.status = "Assigned";
        nextQueued.assignedAt = new Date();
        await nextQueued.save();

        // 🔥 RESTORE LOAD
        if (nextQueued.assignedUser) {
          await User.updateOne(
            { _id: nextQueued.assignedUser },
            { $inc: { currentLoad: nextQueued.qty } }
          );
        }

        await Machine.updateOne(
          { _id: nextQueued.assignedMachine },
          {
            $inc: { currentLoad: nextQueued.qty },
            $set: { status: "Running" }
          }
        );

        console.log(`🚀 Queue Released → ${nextQueued._id}`);

        if (global.io) {
          global.io.emit("task_assigned", nextQueued);
        }

      } else {
        await Machine.updateOne(
          { _id: task.assignedMachine },
          { $set: { status: "Idle" } }
        );
      }
    }

    // =====================================================
    // 🔥 CREATE NEXT STAGE TASK
    // =====================================================
    const newTask = await triggerNextTask(task);

    if (newTask && !newTask.isWaiting) {
      await autoAssign(newTask);
    }

    // =====================================================
    // 🔥 RELEASE WAITING STITCHING
    // =====================================================
    await releaseWaitingStitching(task.miId);

    // =====================================================
    // 🔥 SPLIT STITCHING
    // =====================================================
    await splitStitchingByMI(task.miId);

    // =====================================================
    // 🔥 MI FLAGS
    // =====================================================
    const nonStitching = await ProductionTask.find({
      miId: task.miId,
      stage: { $ne: "Stitching" }
    });

    const allNonStitchingDone =
      nonStitching.length > 0 &&
      nonStitching.every(t => t.status === "Completed");

    if (allNonStitchingDone) {
      await MI.updateOne(
        { _id: task.miId },
        { readyForStitching: true }
      );
    }

    const stitchingTasks = await ProductionTask.find({
      miId: task.miId,
      stage: "Stitching"
    });

    const stitchingDone =
      stitchingTasks.length > 0 &&
      stitchingTasks.every(t => t.status === "Completed");

    if (stitchingDone) {
      await MI.updateOne(
        { _id: task.miId },
        { readyForChecking: true }
      );
    }

    // =====================================================
    // 🔥 FINAL MI COMPLETION
    // =====================================================
    const allTasks = await ProductionTask.find({ miId: task.miId });

    const allCompleted =
      allTasks.length > 0 &&
      allTasks.every(t => t.status === "Completed");

    if (allCompleted) {

      const miDoc = await MI.findById(task.miId);

      if (miDoc) {

        miDoc.status = "Completed";

        miDoc.itemDetails.forEach(item => {

          item.currentStatus = "Completed";

          let completedStage = item.stages.find(
            s => s.stage === "Completed"
          );

          if (!completedStage) {
            item.stages.push({
              stage: "Completed",
              status: "Completed",
              startedAt: new Date(),
              endedAt: new Date()
            });
          } else {
            completedStage.status = "Completed";
            completedStage.endedAt = new Date();
          }
        });

        await miDoc.save();

        console.log("🎉 FULL MI COMPLETED:", task.miId);
      }
    }

    // =====================================================
    // 🔥 SOCKET EVENT
    // =====================================================
    if (global.io) {
      global.io.emit("task_completed", task);
    }

  } catch (error) {
    console.error("❌ checkAndComplete error:", error.message);
  }
}

// 🔁 Create next stage task
async function triggerNextTask(task) {
  const mi = await MI.findById(task.miId);
  if (!mi) return null;

  const item = mi.itemDetails.id(task.itemDetailId);
  if (!item) return null;

  const nextStage = getNextStage(task.category, task.stage, item);
  if (!nextStage || nextStage === "Completed") return null;

  if (nextStage === "Stitching") {
    const allowed = await canStartStitching(task.miId);

    if (!allowed) {
      return await ProductionTask.create({
        miId: task.miId,
        itemDetailId: task.itemDetailId,
        partName: task.partName,
        category: task.category,
        stage: nextStage,
        qty: task.qty,
        isWaiting: true,
        status: "Pending",
      });
    }
  }

  return await ProductionTask.create({
    miId: task.miId,
    itemDetailId: task.itemDetailId,
    partName: task.partName,
    category: task.category,
    stage: nextStage,
    qty: task.qty,
  });
}

// 🔁 Release waiting stitching tasks
async function releaseWaitingStitching(miId) {

  const allTasks = await ProductionTask.find({ miId });

  const nonStitching = allTasks.filter(t => t.stage !== "Stitching");
  const allCompleted = nonStitching.every(t => t.status === "Completed");

  if (!allCompleted) return;

  const waitingTasks = allTasks.filter(
    t => t.stage === "Stitching" && t.isWaiting === true
  );

  for (const task of waitingTasks) {

    task.isWaiting = false;
    task.status = "Pending";

    await task.save();

    await autoAssign(task);

    console.log(`🔥 Stitching Released → ${task.partName}`);
  }
}

module.exports = { checkAndComplete };
