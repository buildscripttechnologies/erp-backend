const Customer = require("../models/Customer");

// Add single customer
exports.addCustomer = async (req, res) => {
  try {
    const customerData = req.body;
    customerData.createdBy = req.user._id;

    const created = await Customer.create(customerData);

    res.status(201).json({
      status: 201,
      message: "Customer added successfully",
      data: created,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to add customer",
      error: err.message,
    });
  }
};

exports.addMultipleCustomers = async (req, res) => {
  try {
    const customers = req.body.customers;

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Request must contain a non-empty array of customers.",
      });
    }

    const preparedCustomers = customers.map((customer) => ({
      ...customer,
      createdBy: req.user._id,
    }));

    const inserted = await Customer.insertMany(preparedCustomers, {
      ordered: false, // allows partial success if some records fail
    });

    res.status(201).json({
      status: 201,
      message: "Customers added successfully",
      insertedCount: inserted.length,
      data: inserted,
    });
  } catch (err) {
    console.error("Bulk customer insert error:", err);
    res.status(500).json({
      status: 500,
      message: "Bulk insert failed",
      error: err.message,
    });
  }
};

// Get all customers with pagination, search, and status filter
exports.getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ customerName: regex }, { customerCode: regex }];
    }

    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;

    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .populate("createdBy", "fullName userType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      status: 200,
      message: "Customers fetched successfully",
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      limit: Number(limit),
      data: customers,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch customers",
      error: err.message,
    });
  }
};

// Update customer by ID
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Customer.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ status: 404, message: "Customer not found" });
    }

    res.status(200).json({
      status: 200,
      message: "Customer updated successfully",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to update customer",
      error: err.message,
    });
  }
};

// Delete customer by ID
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Customer.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ status: 404, message: "Customer not found" });
    }

    res.status(200).json({
      status: 200,
      message: "Customer deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to delete customer",
      error: err.message,
    });
  }
};
