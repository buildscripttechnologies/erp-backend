function getMachineSubType(task) {
  if (task.stage !== "Cutting") return null;

  const type = task.cuttingType || "";

  if (type.includes("Slitting")) return "Slitting";
  if (type.includes("Press")) return "Press";
  if (type.includes("Laser")) return "Laser";
  if (type.includes("Table")) return "Table";

  return null;
}

module.exports = { getMachineSubType };