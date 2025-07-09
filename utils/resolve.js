const Location = require("../models/Location");
const UOM = require("../models/UOM");

exports.resolveUOM = async (uom) => {
  if (!uom) return null;
  // If it's already a valid ObjectId
  if (/^[0-9a-fA-F]{24}$/.test(uom)) return uom;
  // Else, lookup by unit name
  const unit = await UOM.findOne({ unitName: uom.trim() });
  return unit?._id || null;
};

exports.resolveLocation = async (loc) => {
  if (!loc) return null;

  // If it's already a valid ObjectId
  if (/^[0-9a-fA-F]{24}$/.test(loc)) return loc;

  // Else, lookup by locationId
  const location = await Location.findOne({ locationId: loc.trim() });
  return location?._id || null;
};
