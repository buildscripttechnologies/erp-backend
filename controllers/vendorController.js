const Vendor = require("../models/Vendor");
const { resolveUOM } = require("../utils/resolve");
const SFG = require("../models/SFG");
const FG = require("../models/FG");
const UOM = require("../models/UOM");
const User = require("../models/user");
const RawMaterial = require("../models/RawMaterial");

const generateBulkVendorCodes = async (count) => {
  const allVend = await Vendor.find({}, { venderCode: 1 }).lean();
  let maxNumber = 0;

  allVend.forEach((item) => {
    const match = item.venderCode?.match(/VEND-(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNumber) maxNumber = num;
    }
  });

  return Array.from(
    { length: count },
    (_, i) => `VEND-${(maxNumber + i + 1).toString().padStart(3, "0")}`
  );
};
// CREATE SINGLE VENDOR
exports.addVendor = async (req, res) => {
  try {
    const vendorData = req.body;
    vendorData.createdBy = req.user._id;

    const resolvedRM = await Promise.all(
      (vendorData.rm || []).map(async (item) => {
        return {
          ...item,
          uom: await resolveUOM(item.uom),
        };
      })
    );

    const newVendor = await Vendor.create({
      ...vendorData,
      rm: resolvedRM,
    });

    res.status(201).json({
      status: 201,
      message: "Vendor added successfully",
      data: newVendor,
    });
  } catch (err) {
    console.error("Add Vendor Error:", err);
    res
      .status(500)
      .json({ status: 500, message: "Add vendor failed", error: err.message });
  }
};

// CREATE MULTIPLE VENDORS
exports.addMultipleVendors = async (req, res) => {
  try {
    const vendors = req.body.vendors;
    // console.log("vendors", vendors);

    if (!Array.isArray(vendors) || vendors.length === 0) {
      return res
        .status(400)
        .json({ status: 400, message: "Request must include vendors array" });
    }

    const venderCodes = await generateBulkVendorCodes(vendors.length);

    const resolvedVendors = await Promise.all(
      vendors.map(async (vendor, i) => {
        const resolvedRM = await Promise.all(
          (vendor?.rm || []).map(async (item) => {
            return {
              ...item,
              uom: await resolveUOM(item.uom),
            };
          })
        );

        return {
          ...vendor,
          createdBy: req.user._id,
          venderCode: venderCodes[i],
          rm: resolvedRM,
        };
      })
    );

    const inserted = await Vendor.insertMany(resolvedVendors);

    res.status(201).json({
      status: 201,
      message: "Vendors added successfully",
      insertedCount: inserted.length,
      data: inserted,
    });
  } catch (err) {
    console.error("Add Multiple Vendors Error:", err);
    res
      .status(500)
      .json({ status: 500, message: "Bulk insert failed", error: err.message });
  }
};

exports.getAllVendors = async (req, res) => {
  try {
    const { page = 1, limit = "", status = "", search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let filter = {};

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { vendorName: regex },
        { venderCode: regex },
        { natureOfBusiness: regex },
        { address: regex },
        { city: regex },
        { state: regex },
        { country: regex },
        { gst: regex },
        { postalCode: regex },
      ];
    }

    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;

    const total = await Vendor.countDocuments(filter);

    let vendors = await Vendor.find(filter)
      .populate("createdBy", "fullName userType")
      .populate("rm.uom", "unitName")
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    for (const vendor of vendors) {
      for (const rmEntry of vendor.rm) {
        if (!rmEntry?.item || !rmEntry?.type) continue;

        let model = null;
        let selectFields = "";
        let populateFields = [];

        switch (rmEntry.type) {
          case "RawMaterial":
            model = RawMaterial;
            selectFields =
              "skuCode itemName description hsnOrSac type stockUOM status";
            populateFields = [{ path: "stockUOM", select: "unitName" }];
            break;
          case "SFG":
            model = SFG;
            selectFields =
              "skuCode itemName description hsnOrSac type UOM status";
            populateFields = [{ path: "UOM", select: "unitName" }];
            break;
          case "FG":
            model = FG;
            selectFields =
              "skuCode itemName description hsnOrSac type UOM status";
            populateFields = [{ path: "UOM", select: "unitName" }];
            break;
        }

        if (!model) continue;

        const rmItem = await model
          .findById(rmEntry.item)
          .select(selectFields)
          .populate(populateFields);

        rmEntry.item = rmItem || null;
      }
    }

    res.status(200).json({
      status: 200,
      message: "Vendors fetched successfully",
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      limit: Number(limit),
      data: vendors,
    });
  } catch (err) {
    console.error("Get vendors error:", err);
    res.status(500).json({
      status: 500,
      message: "Failed to fetch vendors",
      error: err.message,
    });
  }
};

exports.getAllDeletedVendors = async (req, res) => {
  try {
    const { page = 1, limit = "", status = "", search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let filter = {};

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { vendorName: regex },
        { venderCode: regex },
        { natureOfBusiness: regex },
        { address: regex },
        { city: regex },
        { state: regex },
        { country: regex },
        { gst: regex },
        { postalCode: regex },
      ];
    }

    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;

    const total = await Vendor.findDeleted(filter).countDocuments();

    let vendors = await Vendor.findDeleted(filter)
      .populate("createdBy", "fullName userType")
      .populate("rm.uom", "unitName")
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    for (const vendor of vendors) {
      for (const rmEntry of vendor.rm) {
        if (!rmEntry?.item || !rmEntry?.type) continue;

        let model = null;
        let selectFields = "";
        let populateFields = [];

        switch (rmEntry.type) {
          case "RawMaterial":
            model = RawMaterial;
            selectFields =
              "skuCode itemName description hsnOrSac type stockUOM status";
            populateFields = [{ path: "stockUOM", select: "unitName" }];
            break;
          case "SFG":
            model = SFG;
            selectFields =
              "skuCode itemName description hsnOrSac type UOM status";
            populateFields = [{ path: "UOM", select: "unitName" }];
            break;
          case "FG":
            model = FG;
            selectFields =
              "skuCode itemName description hsnOrSac type UOM status";
            populateFields = [{ path: "UOM", select: "unitName" }];
            break;
        }

        if (!model) continue;

        const rmItem = await model
          .findById(rmEntry.item)
          .select(selectFields)
          .populate(populateFields);

        rmEntry.item = rmItem || null;
      }
    }

    res.status(200).json({
      status: 200,
      message: "Vendors fetched successfully",
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      limit: Number(limit),
      data: vendors,
    });
  } catch (err) {
    console.error("Get vendors error:", err);
    res.status(500).json({
      status: 500,
      message: "Failed to fetch vendors",
      error: err.message,
    });
  }
};

// UPDATE VENDOR
exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ status: 404, message: "Vendor not found" });
    }

    if (updates.rm) {
      updates.rm = await Promise.all(
        updates.rm.map(async (item) => {
          return {
            ...item,
            uom: await resolveUOM(item.uom),
          };
        })
      );
    }

    Object.assign(vendor, updates);
    await vendor.save();

    res.status(200).json({
      status: 200,
      message: "Vendor updated successfully",
      data: vendor,
    });
  } catch (err) {
    console.error("Update Vendor Error:", err);
    res
      .status(500)
      .json({ status: 500, message: "Update failed", error: err.message });
  }
};

// DELETE VENDOR
exports.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Vendor.delete({ _id: id });

    if (!deleted) {
      return res.status(404).json({ status: 404, message: "Vendor not found" });
    }

    res.status(200).json({
      status: 200,
      message: "Vendor deleted successfully",
      data: deleted,
    });
  } catch (err) {
    console.error("Delete Vendor Error:", err);
    res
      .status(500)
      .json({ status: 500, message: "Delete failed", error: err.message });
  }
};

exports.deleteVendorPermanently = async (req, res) => {
  try {
    const ids = req.body.ids || (req.params.id ? [req.params.id] : []);

    if (!ids.length)
      return res.status(400).json({ status: 400, message: "No IDs provided" });

    // Check if they exist (including soft deleted)
    const items = await Vendor.findWithDeleted({ _id: { $in: ids } });

    if (items.length === 0)
      return res.status(404).json({ status: 404, message: "No items found" });

    // Hard delete
    await Vendor.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      status: 200,
      message: `${ids.length} Vendor(s) permanently deleted`,
      deletedCount: ids.length,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
};

exports.restoreVendor = async (req, res) => {
  try {
    const ids = req.body.ids;
    console.log("ids", ids);

    const result = await Vendor.restore({
      _id: { $in: ids },
    });

    await Vendor.updateMany(
      { _id: { $in: ids } },
      { $set: { deleted: false, deletedAt: null } }
    );

    res.json({
      status: 200,
      message: "Vendor(s) restored successfully",
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
};
