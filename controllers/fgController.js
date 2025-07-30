const FG = require("../models/FG");
const { generateBulkFgSkuCodes } = require("../utils/codeGenerator");
const { resolveUOM, resolveLocation } = require("../utils/resolve");

const fs = require("fs");

// start implementing populate location logic, in all controller

exports.getAllFGs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const searchFilter = search
      ? {
          $or: [
            { itemName: { $regex: search, $options: "i" } },
            { skuCode: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const total = await FG.countDocuments(searchFilter);

    const fgs = await FG.find(searchFilter)
      .populate({
        path: "rm.rmid",
        select:
          "skuCode itemName description type hsnOrSac stockUOM qualityInspectionNeeded location",
        populate: [
          {
            path: "stockUOM",
            model: "UOM",
            select: "unitName",
          },
          {
            path: "location",
            model: "Location",
            select: "locationId",
          },
        ],
      })
      .populate({
        path: "sfg.sfgid",
        select:
          "skuCode itemName description hsnOrSac qualityInspectionNeeded location type moq UOM rm sfg location",
        populate: [
          {
            path: "UOM",
            select: "unitName",
          },
          {
            path: "location",
            model: "Location",
            select: "locationId",
          },
          {
            path: "rm.rmid",
            select:
              "skuCode itemName description hsnOrSac type location qualityInspectionNeeded stockUOM",
            populate: [
              {
                path: "stockUOM",
                select: "unitName",
              },
              {
                path: "location",
                model: "Location",
                select: "locationId",
              },
            ],
          },
          {
            path: "sfg.sfgid",
            select:
              "skuCode itemName description hsnOrSac qualityInspectionNeeded location type moq UOM rm",
            populate: [
              {
                path: "UOM",
                select: "unitName",
              },
              {
                path: "location",
                model: "Location",
                select: "locationId",
              },
              {
                path: "rm.rmid",
                select:
                  "skuCode itemName description hsnOrSac type location qualityInspectionNeeded stockUOM",
                populate: [
                  {
                    path: "stockUOM",
                    select: "unitName",
                  },
                  {
                    path: "location",
                    model: "Location",
                    select: "locationId",
                  },
                ],
              },
            ],
          },
        ],
      })
      .populate({
        path: "UOM",
        select: "unitName",
      })
      .populate({
        path: "location",
        select: "locationId",
      })
      .populate("createdBy", "fullName userType")
      .sort({ skuCode: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Format for frontend
    const formatted = fgs.map((fg) => ({
      id: fg._id,
      skuCode: fg.skuCode,
      itemName: fg.itemName,
      description: fg.description,
      hsnOrSac: fg.hsnOrSac,
      qualityInspectionNeeded: fg.qualityInspectionNeeded,
      location: fg.location?.locationId || null,
      gst: fg.gst,
      type: fg.type,
      status: fg.status,
      createdAt: fg.createdAt,
      updatedAt: fg.updatedAt,
      uom: fg.UOM?.unitName || null,
      createdBy: {
        id: fg.createdBy?._id,
        fullName: fg.createdBy?.fullName,
        userType: fg.createdBy?.userType,
      },
      files: fg.file || [],
      rm: fg.rm.map((r) => ({
        id: r.rmid?._id || r.rmid,
        skuCode: r.rmid?.skuCode,
        itemName: r.rmid?.itemName,
        description: r.rmid?.description,
        hsnOrSac: r.rmid?.hsnOrSac,
        type: r.rmid?.type,
        location: r.rmid?.location?.locationId || null,
        qualityInspectionNeeded: r.rmid?.qualityInspectionNeeded,
        stockUOM: r.rmid?.stockUOM?.unitName || null,
        qty: r.qty,
        height: r.height,
        width: r.width,
        depth: r.depth,
      })),
      sfg: fg.sfg.map((sfgRef) => {
        const sfg = sfgRef.sfgid || {};
        return {
          id: sfg._id,
          skuCode: sfg.skuCode,
          itemName: sfg.itemName,
          description: sfg.description,
          hsnOrSac: sfg.hsnOrSac,
          location: sfg.location?.locationId || null,
          type: sfg.type,
          moq: sfg.moq,
          uom: sfg.UOM?.unitName || null,
          qualityInspectionNeeded: sfg.qualityInspectionNeeded,
          qty: sfgRef.qty,
          height: sfgRef.height,
          width: sfgRef.width,
          depth: sfgRef.depth,
          rm: (sfg.rm || []).map((r) => ({
            id: r.rmid?._id || r.rmid,
            skuCode: r.rmid?.skuCode,
            itemName: r.rmid?.itemName,
            description: r.rmid?.description,
            hsnOrSac: r.rmid?.hsnOrSac,
            type: r.rmid?.type,
            location: r.rmid?.location?.locationId || null,
            qualityInspectionNeeded: r.rmid?.qualityInspectionNeeded,
            stockUOM: r.rmid?.stockUOM?.unitName || null,
            qty: r.qty,
            height: r.height,
            width: r.width,
            depth: r.depth,
          })),
          sfg: (sfg.sfg || []).map((nested) => {
            const nestedSFG = nested.sfgid || {};
            return {
              id: nestedSFG._id,
              skuCode: nestedSFG.skuCode,
              itemName: nestedSFG.itemName,
              description: nestedSFG.description,
              hsnOrSac: nestedSFG.hsnOrSac,
              location: nestedSFG.location?.locationId || null,
              type: nestedSFG.type,
              moq: nestedSFG.moq,
              uom: nestedSFG.UOM?.unitName || null,
              qualityInspectionNeeded: nestedSFG.qualityInspectionNeeded,
              qty: nested.qty,
              height: nested.height,
              width: nested.width,
              depth: nested.depth,
              rm: (nestedSFG.rm || []).map((r) => ({
                id: r.rmid?._id || r.rmid,
                skuCode: r.rmid?.skuCode,
                itemName: r.rmid?.itemName,
                description: r.rmid?.description,
                hsnOrSac: r.rmid?.hsnOrSac,
                type: r.rmid?.type,
                location: r.rmid?.location?.locationId || null,
                qualityInspectionNeeded: r.rmid?.qualityInspectionNeeded,
                stockUOM: r.rmid?.stockUOM?.unitName || null,
                qty: r.qty,
                height: r.height,
                width: r.width,
                depth: r.depth,
              })),
            };
          }),
        };
      }),
    }));

    return res.status(200).json({
      status: 200,
      message: "Fetched FGs successfully",
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      limit: Number(limit),
      data: formatted,
    });
  } catch (err) {
    console.error("Get FG error:", err);
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch FGs",
      error: err.message,
    });
  }
};

exports.addMultipleFGs = async (req, res) => {
  try {
    const fgs = JSON.parse(req.body.fgs);

    if (!Array.isArray(fgs) || fgs.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Request body must be a non-empty array.",
      });
    }

    console.log("add fgs", fgs[0].rm, fgs[0].sfg);

    const fileMap = {};

    // Map files by index from filename convention
    req.files.forEach((file) => {
      const match = file.originalname.match(/__index_(\d+)__/);
      if (!match) return;
      const index = parseInt(match[1], 10);
      const cleanedFileName = file.originalname.replace(/__index_\d+__/, "");
      const protocol =
        process.env.NODE_ENV === "production" ? "https" : req.protocol;
      const fileUrl = `${protocol}://${req.get("host")}/uploads/${
        req.uploadType
      }/${file.filename}`;

      if (!fileMap[index]) fileMap[index] = [];
      fileMap[index].push({
        fileName: cleanedFileName,
        fileUrl: fileUrl,
      });
    });

    const skuCodes = await generateBulkFgSkuCodes(fgs.length);

    const mappedFGs = await Promise.all(
      fgs.map(async (fg, index) => {
        const uom = await resolveUOM(fg.UOM);
        const loc = await resolveLocation(fg.location);

        return {
          ...fg,
          skuCode: skuCodes[index],
          createdBy: req.user._id,
          UOM: uom,
          location: loc,
          file: fileMap[index] || [],
        };
      })
    );

    console.log("mapped", mappedFGs[0].rm, mappedFGs[0].sfg);

    const inserted = await FG.insertMany(mappedFGs, { ordered: false });

    console.log("inserted", inserted);

    res.status(201).json({
      status: 201,
      message: "FGs added successfully.",
      insertedCount: inserted.length,
      data: inserted,
    });
  } catch (err) {
    console.error("Bulk FG insert error:", err);
    res.status(500).json({
      status: 500,
      message: "Bulk insert failed.",
      error: err.message,
    });
  }
};

exports.updateFG = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await FG.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ status: 404, message: "FG not found" });
    }

    return res.status(200).json({
      status: 200,
      message: "FG updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Update FG error:", err);
    return res.status(500).json({
      status: 500,
      message: "Update failed",
      error: err.message,
    });
  }
};

exports.updateFGWithFiles = async (req, res) => {
  try {
    const parsed = JSON.parse(req.body.data);
    const { deletedFiles = [], ...updateFields } = parsed;

    const fg = await FG.findById(req.params.id);
    if (!fg) return res.status(404).json({ message: "FG not found" });

    // Remove deleted files
    fg.file = fg.file.filter(
      (file) => !deletedFiles.includes(file._id?.toString())
    );

    // Handle new uploads
    if (req.files?.length) {
      const uploadedFiles = req.files.map((file) => {
        const protocol =
          process.env.NODE_ENV === "production" ? "https" : req.protocol;
        const fileUrl = `${protocol}://${req.get("host")}/uploads/${
          req.uploadType
        }/${file.filename}`;
        const cleanedFileName = file.originalname.replace(/__index_\d+__/, ""); // optional cleanup

        return {
          fileName: cleanedFileName,
          fileUrl,
        };
        s;
      });

      fg.file.push(...uploadedFiles);
    }

    const resolvedUOM = await resolveUOM(updateFields.UOM);
    const location = await resolveLocation(updateFields.location);
    updateFields.UOM = resolvedUOM;
    updateFields.location = location;
    updateFields.createdBy = req.user._id;
    Object.assign(fg, updateFields);
    await fg.save();

    res.status(200).json({
      status: 200,
      message: "FG updated successfully",
      data: fg,
    });
  } catch (err) {
    console.error("Update FG error:", err);
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

exports.deleteFG = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await FG.delete({ _id: id });

    if (!deleted) {
      return res.status(404).json({ status: 404, message: "FG not found" });
    }

    return res.status(200).json({
      status: 200,
      message: "FG deleted successfully",
      data: deleted,
    });
  } catch (err) {
    console.error("Delete FG error:", err);
    return res.status(500).json({
      status: 500,
      message: "Delete failed",
      error: err.message,
    });
  }
};
