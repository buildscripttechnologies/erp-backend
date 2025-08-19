const express = require("express");
const os = require("os");
const { execSync } = require("child_process");
const mongoose = require("mongoose");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    // Database status
    const dbState = mongoose.connection.readyState;
    const dbStatus =
      dbState === 1
        ? "connected"
        : dbState === 2
        ? "connecting"
        : dbState === 3
        ? "disconnecting"
        : "disconnected";

    // System Info
    const uptime = process.uptime(); // seconds
    const memoryUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuLoad = os.loadavg(); // [1min, 5min, 15min]
    const cpuCount = os.cpus().length;

    // Disk Usage (Linux only - using df -h)
    let diskUsage = {};
    try {
      const df = execSync("df -h /").toString().split("\n")[1].split(/\s+/);
      diskUsage = {
        size: df[1],
        used: df[2],
        available: df[3],
        usagePercent: df[4],
      };
    } catch (err) {
      diskUsage = { error: "Disk info not available" };
    }

    res.status(200).json({
      status: "ok",
      timestamp: new Date(),
      services: {
        api: "running",
        database: dbStatus,
      },
      system: {
        uptime_seconds: uptime,
        memory: {
          total: (totalMem / 1024 / 1024).toFixed(2) + " MB",
          free: (freeMem / 1024 / 1024).toFixed(2) + " MB",
          used: ((totalMem - freeMem) / 1024 / 1024).toFixed(2) + " MB",
        },
        cpu: {
          cores: cpuCount,
          load_avg: {
            "1min": cpuLoad[0].toFixed(2),
            "5min": cpuLoad[1].toFixed(2),
            "15min": cpuLoad[2].toFixed(2),
          },
        },
        disk: diskUsage,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

module.exports = router;
