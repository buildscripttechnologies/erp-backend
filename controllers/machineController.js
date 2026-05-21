const Machine = require("../models/machine");

const normalizeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

const buildMachineFilter = ({ search = "", status = "all", isActive = "all", type = "" }) => {
  const filter = {};
  const trimmedSearch = String(search || "").trim();

  if (trimmedSearch) {
    const searchRegex = new RegExp(trimmedSearch, "i");
    filter.$or = [
      { name: searchRegex },
      { code: searchRegex },
      { type: searchRegex },
      { subType: searchRegex },
      { status: searchRegex },
    ];
  }

  if (status && status !== "all") filter.status = status;
  if (type) filter.type = new RegExp(String(type).trim(), "i");
  if (isActive !== "all") filter.isActive = isActive === "true";

  return filter;
};

const machinePopulation = [
  { path: "createdBy", select: "fullName userType" },
  { path: "assignedOperator", select: "fullName username userType" },
  { path: "assignedOperators", select: "fullName username userType" },
];

exports.createMachine = async (req, res) => {
  try {
    const {
      name,
      code,
      type,
      subType = "",
      status = "Idle",
      currentLoad = 0,
      capacityPerHour = 0,
      assignedOperator = null,
      assignedOperators = [],
      totalRunHours = 0,
      isActive = true,
    } = req.body;

    if (!name || !code || !type) {
      return res.status(400).json({
        status: 400,
        message: "Machine name, code, and type are required.",
      });
    }

    const existing = await Machine.findWithDeleted({
      code: String(code).trim().toUpperCase(),
    });

    if (existing.length) {
      return res.status(409).json({
        status: 409,
        message: "Machine code already exists.",
      });
    }

    const machine = await Machine.create({
      name: String(name).trim(),
      code: String(code).trim().toUpperCase(),
      type: String(type).trim(),
      subType: String(subType || "").trim(),
      status,
      currentLoad: normalizeNumber(currentLoad),
      capacityPerHour: normalizeNumber(capacityPerHour),
      assignedOperator: assignedOperator || null,
      assignedOperators: Array.isArray(assignedOperators) ? assignedOperators : [],
      totalRunHours: normalizeNumber(totalRunHours),
      isActive: Boolean(isActive),
      createdBy: req.user?._id || null,
    });

    const populated = await Machine.findById(machine._id).populate(machinePopulation);

    res.status(201).json({
      status: 201,
      message: "Machine created successfully",
      data: populated,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to create machine",
      error: err.message,
    });
  }
};

exports.addManyMachines = async (req, res) => {
  try {
    const { machines } = req.body;

    if (!Array.isArray(machines) || !machines.length) {
      return res.status(400).json({
        status: 400,
        message: "Machines array is required.",
      });
    }

    const payload = [];
    const seenCodes = new Set();

    for (const machine of machines) {
      const name = String(machine.name || "").trim();
      const code = String(machine.code || "").trim().toUpperCase();
      const type = String(machine.type || "").trim();

      if (!name || !code || !type) {
        return res.status(400).json({
          status: 400,
          message: "Machine name, code, and type are required for every row.",
        });
      }

      if (seenCodes.has(code)) {
        return res.status(409).json({
          status: 409,
          message: `Duplicate machine code in request: ${code}`,
        });
      }

      seenCodes.add(code);
      payload.push({
        name,
        code,
        type,
        subType: String(machine.subType || "").trim(),
        status: machine.status || "Idle",
        currentLoad: normalizeNumber(machine.currentLoad),
        capacityPerHour: normalizeNumber(machine.capacityPerHour),
        assignedOperator: machine.assignedOperator || null,
        assignedOperators: Array.isArray(machine.assignedOperators)
          ? machine.assignedOperators
          : [],
        totalRunHours: normalizeNumber(machine.totalRunHours),
        isActive: machine.isActive === undefined ? true : Boolean(machine.isActive),
        createdBy: req.user?._id || null,
      });
    }

    const existingCodes = await Machine.findWithDeleted({
      code: { $in: payload.map((machine) => machine.code) },
    }).distinct("code");

    if (existingCodes.length) {
      return res.status(409).json({
        status: 409,
        message: `Machine code already exists: ${existingCodes.join(", ")}`,
      });
    }

    const created = await Machine.insertMany(payload, { ordered: true });

    res.status(201).json({
      status: 201,
      message: `${created.length} machine(s) created successfully.`,
      data: created,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to create machines",
      error: err.message,
    });
  }
};

exports.getAllMachines = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const numericPage = Math.max(Number(page) || 1, 1);
    const numericLimit = Math.max(Number(limit) || 10, 1);
    const filter = buildMachineFilter(req.query);

    const total = await Machine.countDocuments(filter);
    const machines = await Machine.find(filter)
      .populate(machinePopulation)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit);

    res.status(200).json({
      status: 200,
      message: "Fetched machines successfully",
      totalResults: total,
      totalPages: Math.ceil(total / numericLimit),
      currentPage: numericPage,
      limit: numericLimit,
      data: machines,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch machines",
      error: err.message,
    });
  }
};

exports.getAllDeletedMachines = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const numericPage = Math.max(Number(page) || 1, 1);
    const numericLimit = Math.max(Number(limit) || 10, 1);
    const filter = buildMachineFilter(req.query);

    const total = await Machine.findDeleted(filter).countDocuments();
    const machines = await Machine.findDeleted(filter)
      .populate(machinePopulation)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit);

    res.status(200).json({
      status: 200,
      message: "Fetched deleted machines successfully",
      totalResults: total,
      totalPages: Math.ceil(total / numericLimit),
      currentPage: numericPage,
      limit: numericLimit,
      data: machines,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch deleted machines",
      error: err.message,
    });
  }
};

exports.updateMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };

    if (update.code) {
      update.code = String(update.code).trim().toUpperCase();
      const duplicate = await Machine.findWithDeleted({
        _id: { $ne: id },
        code: update.code,
      });

      if (duplicate.length) {
        return res.status(409).json({
          status: 409,
          message: "Machine code already exists.",
        });
      }
    }

    ["name", "type", "subType"].forEach((field) => {
      if (update[field] !== undefined) update[field] = String(update[field]).trim();
    });

    ["currentLoad", "capacityPerHour", "totalRunHours"].forEach((field) => {
      if (update[field] !== undefined) update[field] = normalizeNumber(update[field]);
    });

    if (update.assignedOperator === "") update.assignedOperator = null;
    if (update.assignedOperators && !Array.isArray(update.assignedOperators)) {
      update.assignedOperators = [];
    }

    const machine = await Machine.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).populate(machinePopulation);

    if (!machine) {
      return res.status(404).json({ status: 404, message: "Machine not found" });
    }

    res.status(200).json({
      status: 200,
      message: "Machine updated successfully",
      data: machine,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to update machine",
      error: err.message,
    });
  }
};

exports.deleteMachine = async (req, res) => {
  try {
    const machine = await Machine.findById(req.params.id);
    if (!machine) {
      return res.status(404).json({ status: 404, message: "Machine not found" });
    }

    await Machine.delete({ _id: req.params.id });

    res.status(200).json({
      status: 200,
      message: "Machine deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to delete machine",
      error: err.message,
    });
  }
};

exports.deleteMachinePermanently = async (req, res) => {
  try {
    const ids = req.body.ids || [];

    if (!ids.length) {
      return res.status(400).json({ status: 400, message: "No IDs provided" });
    }

    const machines = await Machine.findWithDeleted({ _id: { $in: ids } });
    if (!machines.length) {
      return res.status(404).json({ status: 404, message: "No machines found" });
    }

    await Machine.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      status: 200,
      message: `${ids.length} machine(s) permanently deleted`,
      deletedCount: ids.length,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
};

exports.restoreMachine = async (req, res) => {
  try {
    const ids = req.body.ids || [];

    if (!ids.length) {
      return res.status(400).json({ status: 400, message: "No IDs provided" });
    }

    await Machine.restore({ _id: { $in: ids } });

    res.status(200).json({
      status: 200,
      message: "Machine(s) restored successfully",
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
};
