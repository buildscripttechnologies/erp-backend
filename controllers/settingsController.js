const path = require("path");
const Settings = require("../models/Settings");
const { log } = require("console");

// Upload Letterpad
exports.uploadLetterpad = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const protocol =
      process.env.NODE_ENV == "production" ? "https" : req.protocol;

    // Construct URL
    const fileUrl = `${protocol}://${req.get("host")}/uploads/${
      req.uploadType
    }/${req.file.filename}`;

    // Update or create settings doc
    let settings = await Settings.findOne();
    if (settings) {
      settings.letterpad = fileUrl;
      await settings.save();
    } else {
      settings = await Settings.create({ letterpad: fileUrl });
    }

    res.json({ success: true, path: fileUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Get Current Letterpad
exports.getLetterpad = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings || !settings.letterpad) {
      return res.status(404).json({ message: "No letterpad set" });
    }
    res.json({ path: settings.letterpad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.addVendor = async (req, res) => {
  try {
    const { name, gst, address, mobile } = req.body;
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({ vendors: [] });
    }

    settings.vendors.push({ name, gst, address, mobile });
    await settings.save();

    res.json(settings.vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings || !settings.vendors) {
      return res.status(404).json({ message: "No Vendors Found" });
    }
    res.status(200).json({
      status: 200,
      success: true,
      message: "Vendors Fetched Successfully",
      vendors: settings.vendors,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.editVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gst, address, mobile } = req.body;

    // Update the vendor inside vendors array
    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      {
        $set: {
          "vendors.$[elem].name": name,
          "vendors.$[elem].gst": gst,
          "vendors.$[elem].address": address,
          "vendors.$[elem].mobile": mobile,
        },
      },
      {
        arrayFilters: [{ "elem._id": id }],
        new: true,
      }
    );

    if (!updatedSettings) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.json(updatedSettings.vendors);
  } catch (err) {
    console.error("Error updating vendor:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await Settings.findOne();

    if (!settings) return res.status(404).json({ error: "Settings not found" });

    settings.vendors = settings.vendors.filter(
      (vendor) => vendor._id.toString() !== id
    );

    await settings.save();
    res.json(settings.vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get company details
exports.getCompanyDetails = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings || !settings.companyDetails) {
      return res.status(404).json({ message: "No Company Details Found" });
    }
    res.json(settings.companyDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add/Update company details (full object)
exports.setCompanyDetails = async (req, res) => {
  try {
    const { companyName, gst, pan, mobile, warehouses, bankDetails } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    settings.companyDetails = {
      companyName,
      gst,
      pan,
      mobile,
      warehouses: warehouses || [],
      bankDetails: bankDetails || [],
    };

    await settings.save();
    res.json(settings.companyDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editCompanyDetails = async (req, res) => {
  try {
    const { companyName, gst, pan, mobile, warehouses, bankDetails } = req.body;

    const settings = await Settings.findOne();

    if (!settings || !settings.companyDetails) {
      return res.status(404).json({ message: "Company details not found" });
    }

    // Update only provided fields
    if (companyName) settings.companyDetails.companyName = companyName;
    if (gst) settings.companyDetails.gst = gst;
    if (pan) settings.companyDetails.pan = pan;
    if (mobile) settings.companyDetails.mobile = mobile;
    if (warehouses) settings.companyDetails.warehouses = warehouses;
    if (bankDetails) settings.companyDetails.bankDetails = bankDetails;

    await settings.save();

    res.status(200).json({
      success: true,
      message: "Company details updated successfully",
      companyDetails: settings.companyDetails,
    });
  } catch (err) {
    console.error("Error editing company details:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Add warehouse
exports.addWarehouse = async (req, res) => {
  try {
    const { name, address } = req.body;
    let settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });

    settings.companyDetails.warehouses.push({ name, address });
    await settings.save();
    res.json(settings.companyDetails.warehouses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Edit warehouse
exports.editWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address } = req.body;

    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      {
        $set: {
          "companyDetails.warehouses.$[elem].name": name,
          "companyDetails.warehouses.$[elem].address": address,
        },
      },
      {
        arrayFilters: [{ "elem._id": id }],
        new: true,
      }
    );

    if (!updatedSettings) {
      return res.status(404).json({ message: "Warehouse not found" });
    }

    res.json(updatedSettings.companyDetails.warehouses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete warehouse
exports.deleteWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    let settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });

    settings.companyDetails.warehouses =
      settings.companyDetails.warehouses.filter(
        (wh) => wh._id.toString() !== id
      );

    await settings.save();
    res.json(settings.companyDetails.warehouses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add bank detail
exports.addBankDetail = async (req, res) => {
  try {
    const { accountNo, ifsc, upiId, bankName, branch } = req.body;
    let settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });

    settings.companyDetails.bankDetails.push({
      accountNo,
      ifsc,
      upiId,
      bankName,
      branch,
    });
    await settings.save();
    res.json(settings.companyDetails.bankDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Edit bank detail
exports.editBankDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { accountNo, ifsc, upiId, bankName, branch } = req.body;

    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      {
        $set: {
          "companyDetails.bankDetails.$[elem].accountNo": accountNo,
          "companyDetails.bankDetails.$[elem].ifsc": ifsc,
          "companyDetails.bankDetails.$[elem].upiId": upiId,
          "companyDetails.bankDetails.$[elem].bankName": bankName,
          "companyDetails.bankDetails.$[elem].branch": branch,
        },
      },
      {
        arrayFilters: [{ "elem._id": id }],
        new: true,
      }
    );

    if (!updatedSettings) {
      return res.status(404).json({ message: "Bank detail not found" });
    }

    res.json(updatedSettings.companyDetails.bankDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete bank detail
exports.deleteBankDetail = async (req, res) => {
  try {
    const { id } = req.params;
    let settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });

    settings.companyDetails.bankDetails =
      settings.companyDetails.bankDetails.filter(
        (bank) => bank._id.toString() !== id
      );

    await settings.save();
    res.json(settings.companyDetails.bankDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get all categories
 */
exports.getCategories = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });
    res.json({ categories: settings.categories || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Add a new category
 */
exports.addCategory = async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name?.trim() || !type) {
      return res
        .status(400)
        .json({ message: "Category name and type are required" });
    }

    let settings = await Settings.findOne();
    if (!settings) settings = new Settings({ categories: [] });

    if (settings.categories.some((c) => c.name === name && c.type === type)) {
      return res.status(400).json({ message: "Category already exists" });
    }

    settings.categories.push({ name, type });
    await settings.save();
    res.json({ categories: settings.categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Edit category
 */
exports.editCategory = async (req, res) => {
  try {
    const { oldName, newName, newType } = req.body;
    if (!oldName || !newName || !newType) {
      return res
        .status(400)
        .json({ message: "Old name, new name, and type are required" });
    }

    const settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });

    const index = settings.categories.findIndex((c) => c.name === oldName);
    if (index === -1)
      return res.status(404).json({ message: "Category not found" });

    settings.categories[index] = { name: newName, type: newType };
    await settings.save();
    res.json({ categories: settings.categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Delete category
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { name, type } = req.params; // pass type as query param

    const settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });

    settings.categories = settings.categories.filter(
      (c) => !(c.name === name && c.type === type)
    );
    await settings.save();

    res.json({ categories: settings.categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get all categories
 */
exports.getGst = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });
    res.json({ gstTable: settings.gstTable || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Add a new category
 */
exports.addGst = async (req, res) => {
  try {
    const { hsn, gst } = req.body;
    // console.log("hsn,gst", hsn, gst);

    if (!hsn?.trim() || !gst) {
      return res.status(400).json({ message: "HSN and GST are required" });
    }

    let settings = await Settings.findOne();
    if (!settings) settings = new Settings({ categories: [], gstTable: [] });

    if (settings.gstTable.some((g) => g.hsn === hsn && g.gst === gst)) {
      return res.status(400).json({ message: "GST entry already exists" });
    }

    settings.gstTable.push({ hsn, gst });
    await settings.save();
    res.json({ gstTable: settings.gstTable });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Edit GST entry
 */
exports.editGst = async (req, res) => {
  try {
    const { oldHsn, newHsn, newGst } = req.body;
    if (!oldHsn || !newHsn || !newGst) {
      return res
        .status(400)
        .json({ message: "Old HSN, new HSN, and GST are required" });
    }

    const settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });

    const index = settings.gstTable.findIndex((g) => g.hsn === oldHsn);
    if (index === -1)
      return res.status(404).json({ message: "GST entry not found" });

    settings.gstTable[index] = { hsn: newHsn, gst: newGst };
    await settings.save();
    res.json({ gstTable: settings.gstTable });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Delete category
 */
exports.deleteGst = async (req, res) => {
  try {
    const { gst, hsn } = req.params; // pass type as query param

    const settings = await Settings.findOne();
    if (!settings)
      return res.status(404).json({ message: "Settings not found" });

    log("hsn,gst", hsn, gst);
    settings.gstTable = settings.gstTable.filter(
      (g) => !(g.hsn == hsn && g.gst == gst)
    );
    await settings.save();

    res.json({ gstTable: settings.gstTable });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
