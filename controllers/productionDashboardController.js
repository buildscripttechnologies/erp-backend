const ProductionTask = require("../models/productionTask");
const Machine = require("../models/machine");
const User = require("../models/user");

exports.getLiveProduction = async (req, res) => {

  const tasks = await ProductionTask.find({
    status: { $in: ["Assigned", "In Progress"] }
  })
  .populate("assignedUser", "fullName")
  .populate("assignedMachine", "name code");

  res.json({
    success: true,
    data: tasks
  });
};



exports.getMachineUtilization = async (req, res) => {

  const totalMachines = await Machine.countDocuments({ isActive: true });

  const activeMachines = await ProductionTask.distinct("assignedMachine", {
    status: "In Progress"
  });

  res.json({
    success: true,
    totalMachines,
    activeMachines: activeMachines.length,
    utilization: totalMachines
      ? (activeMachines.length / totalMachines) * 100
      : 0
  });
};

exports.getLabourPerformance = async (req, res) => {

  const users = await User.find({ status: "Active" })
    .select("fullName efficiencyScore currentLoad skills");

  res.json({
    success: true,
    data: users
  });
};

exports.getStageWIP = async (req, res) => {

  const result = await ProductionTask.aggregate([
    {
      $match: {
        status: { $in: ["Pending", "Assigned", "In Progress"] }
      }
    },
    {
      $group: {
        _id: "$stage",
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: result
  });
};

exports.getBottleneck = async (req, res) => {

  const result = await ProductionTask.aggregate([
    {
      $match: {
        status: { $in: ["Pending", "Assigned", "In Progress"] }
      }
    },
    {
      $group: {
        _id: "$stage",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  const bottleneck = result[0];

  res.json({
    success: true,
    bottleneck
  });
};

exports.getDashboardOverview = async (req, res) => {
  try {

    // =====================================================
    // 🔥 1. MACHINE INSIGHTS
    // =====================================================
    const machines = await Machine.find({ isActive: true });

    const machineStats = [];

    for (const m of machines) {

      const running = await ProductionTask.countDocuments({
        assignedMachine: m._id,
        status: "In Progress"
      });

      const assigned = await ProductionTask.countDocuments({
        assignedMachine: m._id,
        status: "Assigned"
      });

      const queued = await ProductionTask.countDocuments({
        assignedMachine: m._id,
        status: "Queued"
      });

      const load = m.currentLoad || 0;
      const capacity = (m.capacityPerHour || 0) * 8;

      machineStats.push({
        machineId: m._id,
        code: m.code,
        name: m.name,
        type: m.type,

        running,
        assigned,
        queued,

        status:
          running > 0 ? "Running"
          : assigned > 0 ? "Ready"
          : "Idle",

        load,
        capacity,
        utilization: capacity ? ((load / capacity) * 100).toFixed(2) : 0
      });
    }

    // =====================================================
    // 🔥 2. OPERATOR INSIGHTS
    // =====================================================
    const users = await User.find({
      status: "Active",
      deleted: { $ne: true }
    });

    const operatorStats = users.map(u => ({
      userId: u._id,
      name: u.fullName,
      efficiency: u.efficiencyScore || 0,
      load: u.currentLoad || 0,
      skills: u.skills || [],
    }));

    // =====================================================
    // 🔥 3. STAGE WIP (ENHANCED)
    // =====================================================
    const stageWip = await ProductionTask.aggregate([
      {
        $match: {
          status: { $in: ["Pending", "Assigned", "In Progress", "Queued"] }
        }
      },
      {
        $group: {
          _id: "$stage",
          total: { $sum: 1 },
          queued: {
            $sum: {
              $cond: [{ $eq: ["$status", "Queued"] }, 1, 0]
            }
          },
          running: {
            $sum: {
              $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0]
            }
          }
        }
      }
    ]);

    // =====================================================
    // 🔥 4. BOTTLENECK (SMART)
    // =====================================================
    const bottleneck = stageWip.sort((a, b) => b.total - a.total)[0];

    // =====================================================
    // 🔥 5. GLOBAL METRICS
    // =====================================================
    const totalTasks = await ProductionTask.countDocuments();

    const completedTasks = await ProductionTask.countDocuments({
      status: "Completed"
    });

    const runningTasks = await ProductionTask.countDocuments({
      status: "In Progress"
    });

    const queuedTasks = await ProductionTask.countDocuments({
      status: "Queued"
    });

    // =====================================================
    // 🔥 RESPONSE
    // =====================================================
    res.json({
      success: true,

      summary: {
        totalTasks,
        completedTasks,
        runningTasks,
        queuedTasks,
        completionRate: totalTasks
          ? ((completedTasks / totalTasks) * 100).toFixed(2)
          : 0
      },

      machines: machineStats,
      operators: operatorStats,
      stageWip,
      bottleneck
    });

  } catch (error) {
    console.error("❌ dashboard error:", error.message);
    res.status(500).json({ error: error.message });
  }
};