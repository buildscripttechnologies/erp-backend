const IndiaMartLead = require("../models/IndiaMartLead");

async function getLeads(req, res) {
  try {
    // Get page and limit from query, set defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;

    // Count total leads
    const totalResults = await IndiaMartLead.countDocuments();

    // Calculate total pages
    const totalPages = Math.ceil(totalResults / limit);

    // Fetch leads with pagination
    const leads = await IndiaMartLead.find()
      .sort({ QUERY_TIME: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: leads,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: "Failed to fetch leads" });
  }
}

module.exports = { getLeads };
