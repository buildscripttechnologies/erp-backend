require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../erp-backend/models/user");
const Machine = require("../erp-backend/models/machine");
const ProductionTask = require("../erp-backend/models/productionTask");
const ProductionLog = require("../erp-backend/models/productionLog");

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ DB Connected");

        // =====================================================
        // 🔥 1. FIX USER LOAD
        // =====================================================
        const users = await User.find();

        for (const user of users) {

            const result = await ProductionTask.aggregate([
                {
                    $match: {
                        assignedUser: user._id,
                        status: { $in: ["Assigned", "In Progress"] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$qty" }
                    }
                }
            ]);

            const load = result[0]?.total || 0;

            await User.updateOne(
                { _id: user._id },
                { $set: { currentLoad: load } }
            );

            console.log(`👤 User fixed → ${user.fullName}: ${load}`);
        }

        // =====================================================
        // 🔥 2. FIX MACHINE LOAD + STATUS
        // =====================================================
        const machines = await Machine.find();

        for (const machine of machines) {

            const activeTasks = await ProductionTask.find({
                assignedMachine: machine._id,
                status: { $in: ["Assigned", "In Progress"] }
            });

            const queuedTasks = await ProductionTask.countDocuments({
                assignedMachine: machine._id,
                status: "Queued"
            });

            const load = activeTasks.reduce((sum, t) => sum + (t.qty || 0), 0);

            let status = "Idle";

            if (activeTasks.some(t => t.status === "In Progress")) {
                status = "Running";
            } else if (activeTasks.length > 0 || queuedTasks > 0) {
                status = "Running"; // machine busy due to queue
            }

            await Machine.updateOne(
                { _id: machine._id },
                {
                    $set: {
                        currentLoad: load,
                        status
                    }
                }
            );

            console.log(
                `🏭 Machine fixed → ${machine.code}: load=${load}, status=${status}`
            );
        }

        // =====================================================
        // 🔥 3. FIX INVALID TASK STATES (OPTIONAL)
        // =====================================================
        await ProductionTask.updateMany(
            { status: { $exists: false } },
            { $set: { status: "Pending" } }
        );

        console.log("🧹 Fixed missing task statuses");

        // =====================================================
        // 🔥 4. REMOVE NEGATIVE LOAD (SAFETY)
        // =====================================================
        await User.updateMany(
            { currentLoad: { $lt: 0 } },
            { $set: { currentLoad: 0 } }
        );

        await Machine.updateMany(
            { currentLoad: { $lt: 0 } },
            { $set: { currentLoad: 0 } }
        );

        console.log("🛡️ Cleaned negative loads");

        // =====================================================
        // 🔥 4. FIX USER EFFICIENCY
        // =====================================================
        const usersForEfficiency = await User.find({
            status: "Active",
            deleted: { $ne: true }
        });

        for (const user of usersForEfficiency) {

            const logs = await ProductionLog.find({
                labourId: user._id
            });

            let totalProduced = 0;
            let totalHours = 0;

            for (const log of logs) {

                totalProduced += log.totalProduced || 0;
                totalHours += (log.hourlyData || []).length;
            }

            let efficiency = 0;

            if (totalHours > 0) {
                efficiency = totalProduced / totalHours;
            }

            await User.updateOne(
                { _id: user._id },
                { $set: { efficiencyScore: efficiency } }
            );

            console.log(
                `⚡ Efficiency fixed → ${user.fullName}: ${efficiency.toFixed(2)}`
            );
        }

        // =====================================================
        // 🔥 DONE
        // =====================================================
        console.log("🎉 SYSTEM FIX COMPLETED");

    } catch (err) {
        console.error("❌ ERROR:", err.message);
    } finally {
        mongoose.disconnect();
    }
}

run();