const { fetchLeads, saveLeads } = require("./indiamartService");

const startScheduler = (apiKey) => {
  console.log("IndiaMART Lead Scheduler started...");

  const fetchAndStore = async () => {
    try {
      const leads = await fetchLeads(apiKey);
      if (leads.length > 0) {
        const saved = await saveLeads(leads);
        console.log(
          `Fetched ${leads.length}, Saved ${
            saved.length
          } leads at ${new Date().toLocaleString()}`
        );
      } else {
        console.log(`No new leads at ${new Date().toLocaleString()}`);
      }
    } catch (err) {
      console.error("Scheduler error:", err.response?.data || err.message);
    }
  };

  // Run immediately
  fetchAndStore();

  // Schedule every 5 minutes (300000 ms)
  setInterval(fetchAndStore, 600000);
};

module.exports = { startScheduler };
