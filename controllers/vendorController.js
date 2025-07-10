const Vendor = require("../models/Vendor");
const { resolveUOM } = require("../utils/resolve");

const generateBulkSkuCodes = async (count) => {
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
    console.log("vendors", vendors);

    if (!Array.isArray(vendors) || vendors.length === 0) {
      return res
        .status(400)
        .json({ status: 400, message: "Request must include vendors array" });
    }

    const venderCodes = await generateBulkSkuCodes(vendors.length);

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

// GET ALL VENDORS
exports.getAllVendors = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = "", search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let filter = {};

    // Search by vendorName or venderCode
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ vendorName: regex }, { venderCode: regex }];
    }

    // Status-based filtering
    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;
    // "all" skips filtering isActive

    const total = await Vendor.countDocuments(filter);

    const vendors = await Vendor.find(filter)
      .populate("createdBy", "fullName userType")
      .populate({
        path: "rm.item",
        select: "skuCode itemName description hsnOrSac type stockUOM UOM",
      }) // Dynamically populate either RawMaterial or SFG
      .populate("rm.uom", "unitName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

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
    const deleted = await Vendor.findByIdAndDelete(id);

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
