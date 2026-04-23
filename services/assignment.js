const User = require("../models/user");
const Machine = require("../models/machine");
const ProductionTask = require("../models/productionTask");
const { getMachineSubType } = require("./machineHelper");

async function autoAssign(task) {
  try {

    let machine = null;
    let selectedUser = null;

    // =====================================================
    // 🔥 GUARD: only process valid tasks
    // =====================================================
    if (!task || !["Pending", "Queued"].includes(task.status)) {
      console.log("⛔ Skipping autoAssign → status:", task?.status);
      return null;
    }

    // =====================================================
    // 🔥 STEP 1: STITCHING GROUP (USE stitchGroupId)
    // =====================================================
    if (task.stage === "Stitching" && task.stitchGroupId) {

      const existingTask = await ProductionTask.findOne({
        stitchGroupId: task.stitchGroupId,
        assignedMachine: { $ne: null }
      });

      if (existingTask) {

        const reusedMachine = await Machine.findOne({
          _id: existingTask.assignedMachine,
          isActive: true
        });

        if (reusedMachine) {
          machine = reusedMachine;
          selectedUser = await User.findById(existingTask.assignedUser);

          console.log("🔁 Reusing stitching line:", machine?.code);
        }
      }
    }

    // =====================================================
    // 🔥 STEP 2: MACHINE SELECTION
    // =====================================================
    if (!machine) {

      const subType = getMachineSubType(task);

      let query = {
        type: task.stage,
        isActive: true,
      };

      // 🔥 STRICT CUTTING
      if (task.stage === "Cutting") {
        if (!subType) {
          console.log("❌ Missing cuttingType:", task.cuttingType);
          return null;
        }
        query.subType = subType;
      } else if (subType) {
        query.subType = subType;
      }

      const machines = await Machine.find(query)
        .sort({ currentLoad: 1, updatedAt: 1 });

      if (!machines.length) {
        console.log("❌ No machine available for:", task.stage);
        return null;
      }

      // 🔥 FIND FREE MACHINE
      for (const m of machines) {

        const activeTask = await ProductionTask.findOne({
          assignedMachine: m._id,
          status: { $in: ["Assigned", "In Progress"] }
        });

        if (!activeTask) {
          machine = m;
          break;
        }
      }

      // 🔥 fallback → least loaded
      if (!machine) {
        machine = machines[0];
      }
    }

    // =====================================================
    // 🔥 SAFETY CHECK
    // =====================================================
    if (!machine) {
      console.log("❌ No machine resolved");
      return null;
    }

    // =====================================================
    // 🔥 STEP 3: GET OPERATORS
    // =====================================================
    let operators = await User.find({
      status: "Active",
      deleted: { $ne: true },
      skills: { $in: [task.stage] },
    });

    if (!operators.length) {
      console.log("❌ No skilled operators for stage:", task.stage);
      return null;
    }

    // 🔥 machine preferred operators
    if (machine.assignedOperators?.length) {
      const mapped = operators.filter(u =>
        machine.assignedOperators.some(id => id.toString() === u._id.toString())
      );
      if (mapped.length) operators = mapped;
    }

    // =====================================================
    // 🔥 STEP 4: ACCESSORY SAME USER (ZIP/RUNNER)
    // =====================================================
    if (!selectedUser && task.stage === "Stitching") {

      const category = (task.category || "").toLowerCase();
      const isAccessory = ["zipper", "runner"].includes(category);

      if (isAccessory) {

        const accessoryTask = await ProductionTask.findOne({
          miId: task.miId,
          stage: "Stitching",
          assignedUser: { $ne: null }
        });

        if (accessoryTask) {
          selectedUser = await User.findById(accessoryTask.assignedUser);
          console.log("🔁 Reusing accessory operator:", selectedUser?.fullName);
        }
      }
    }

    // =====================================================
    // 🔥 STEP 5: SELECT BEST USER
    // =====================================================
    if (!selectedUser) {
      const sorted = operators.sort((a, b) => {
        if ((b.efficiencyScore || 1) !== (a.efficiencyScore || 1)) {
          return (b.efficiencyScore || 1) - (a.efficiencyScore || 1);
        }
        return (a.currentLoad || 0) - (b.currentLoad || 0);
      });

      selectedUser = sorted[0];
    }

    if (!selectedUser) {
      console.log("❌ No operator selected");
      return null;
    }

    // =====================================================
    // 🔥 STEP 6: ASSIGN OR QUEUE
    // =====================================================
    const isBusy = await ProductionTask.exists({
      assignedMachine: machine._id,
      status: { $in: ["Assigned", "In Progress"] }
    });

    task.assignedUser = selectedUser._id;
    task.assignedMachine = machine._id;
    task.status = isBusy ? "Queued" : "Assigned";

    await task.save();

    // =====================================================
    // 🔥 STEP 7: LOAD UPDATE
    // =====================================================
    if (!isBusy) {

      await User.updateOne(
        { _id: selectedUser._id },
        { $inc: { currentLoad: task.qty } }
      );

      await Machine.updateOne(
        { _id: machine._id },
        {
          $inc: { currentLoad: task.qty },
          $set: { status: "Running" }
        }
      );

    } else {
      // 🔥 Ensure machine is marked active if queue exists
      await Machine.updateOne(
        { _id: machine._id },
        { $set: { status: "Running" } }
      );
    }

    console.log(
      `✅ Task assigned → User: ${selectedUser.fullName} | Machine: ${machine.code} | Status: ${task.status}`
    );

    return task;

  } catch (error) {
    console.error("❌ AutoAssign Error:", error.message);
    return null;
  }
}

module.exports = { autoAssign };