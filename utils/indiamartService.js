const axios = require("axios");
const IndiaMartLead = require("../models/IndiaMartLead");

let lastEndTime = null;

// Format date for IndiaMART API: DD-MON-YYYYHH:MM:SS
function formatDateTime(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = date.toLocaleString("en-US", { month: "short" });
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}${hh}:${min}:${ss}`;
}

// Fetch leads from IndiaMART
async function fetchLeads(apiKey) {
  const endTime = new Date();
  let startTime = lastEndTime
    ? new Date(lastEndTime.getTime() - 5 * 60 * 1000)
    : new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  const formattedStart = formatDateTime(startTime);
  const formattedEnd = formatDateTime(endTime);

  const url = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${apiKey}&start_time=${formattedStart}&end_time=${formattedEnd}`;
  

  const response = await axios.get(url);
  lastEndTime = endTime;
  console.log("india mart response", response.data);

  return response.data.RESPONSE || [];
}

// Save leads to MongoDB (deduplicating by UNIQUE_QUERY_ID)
async function saveLeads(leads) {
  const saved = [];
  for (const lead of leads) {
    try {
      const existing = await IndiaMartLead.findOne({
        UNIQUE_QUERY_ID: lead.UNIQUE_QUERY_ID,
      });
      if (!existing) {
        const newLead = new IndiaMartLead({
          ...lead,
          QUERY_TIME: new Date(lead.QUERY_TIME),
          rawData: lead,
        });
        await newLead.save();
        saved.push(newLead);
      }
    } catch (err) {
      console.error("Lead save error:", err.message);
    }
  }
  return saved;
}

module.exports = { fetchLeads, saveLeads };
