const BOM = require("../models/BOM");
const Customer = require("../models/Customer");
const FG = require("../models/FG");
const PO = require("../models/PO");
const Sample = require("../models/Sample");

exports.generateBulkFgSkuCodes = async (count) => {
  const all = await FG.find({}, { skuCode: 1 }).lean();
  let max = 0;

  all.forEach((item) => {
    const match = item.skuCode?.match(/FG-(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > max) max = num;
    }
  });

  return Array.from(
    { length: count },
    (_, i) => `FG-${(max + i + 1).toString().padStart(3, "0")}`
  );
};

exports.generateBulkCustomerCodes = async (count) => {
  const allCust = await Customer.find({}, { customerCode: 1 }).lean();
  let maxNumber = 0;

  allCust.forEach((item) => {
    const match = item.customerCode?.match(/CUST-(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNumber) maxNumber = num;
    }
  });

  return Array.from(
    { length: count },
    (_, i) => `CUST-${(maxNumber + i + 1).toString().padStart(3, "0")}`
  );
};

exports.generateNextBomNo = async () => {
  const allBOMs = await BOM.find({}, { bomNo: 1 }).lean();
  let max = 0;

  allBOMs.forEach((bom) => {
    const match = bom.bomNo?.toString().match(/BOM-(\d+)/i);
    if (match) {
      const num = parseInt(match[1]);
      if (num > max) max = num;
    }
  });

  return `BOM-${(max + 1).toString().padStart(3, "0")}`;
};

exports.generateNextSampleNo = async () => {
  const allBOMs = await Sample.find({}, { sampleNo: 1 }).lean();
  let max = 0;

  allBOMs.forEach((bom) => {
    const match = bom.sampleNo?.toString().match(/SMP-(\d+)/i);
    if (match) {
      const num = parseInt(match[1]);
      if (num > max) max = num;
    }
  });

  return `SMP-${(max + 1).toString().padStart(3, "0")}`;
};

exports.generateNextPONo = async () => {
  const allPOs = await PO.findWithDeleted({}, { poNo: 1 }).lean(); // includes deleted

  let max = 0;

  allPOs.forEach((po) => {
    const match = po.poNo?.toString().match(/PO-(\d+)/i);
    if (match) {
      const num = parseInt(match[1]);
      if (num > max) max = num;
    }
  });

  return `PO-${(max + 1).toString().padStart(3, "0")}`;
};
