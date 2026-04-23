const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },

    code: {
        type: String,
        required: true,
        unique: true,
    },

    // 🔥 Stage it works for
    type: {
        type: String, // Cutting / Stitching / Printing / etc
        required: true,
    },

    subType: {
        type: String, // Slitting / Press / Laser / Table
    },

    // 🔥 Real-time status
    status: {
        type: String,
        enum: ["Idle", "Running", "Maintenance"],
        default: "Idle",
    },

    // 🔥 Current workload
    currentLoad: {
        type: Number,
        default: 0,
    },

    // 🔥 Capacity per hour (VERY IMPORTANT later)
    capacityPerHour: {
        type: Number,
        default: 0,
    },

    // 🔥 Optional: assigned operator (future ready)
    assignedOperator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },

    // 🔥 Track usage
    totalRunHours: {
        type: Number,
        default: 0,
    },

    // 🔥 Active flag
    isActive: {
        type: Boolean,
        default: true,
    },
    assignedOperators: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],

}, { timestamps: true });

module.exports = mongoose.model("Machine", machineSchema);