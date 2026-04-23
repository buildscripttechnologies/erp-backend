const flowConfig = require("../config/processFlow");

function getNextStage(category, currentStage, item) {

  // 🔥 STEP 1: Decide flow based on item type (NOT category)
  let flow;

  if (item.category?.toLowerCase().includes("pvc")) {
    flow = flowConfig.Fabric;
  } else if (item.category?.toLowerCase().includes("zip")) {
    flow = flowConfig.Zipper;
  } else if (
    item.category?.toLowerCase().includes("runner") ||
    item.category?.toLowerCase().includes("slider")
  ) {
    flow = flowConfig.Accessories;
  } else {
    flow = flowConfig.Default;
  }

  let index = flow.indexOf(currentStage);

  while (true) {
    index++;

    const next = flow[index];

    if (!next) return null;

    // 🔥 CONDITIONAL LOGIC
    if (next === "Printing" && !item.isPrint) continue;
    if (next === "Pasting" && !item.isPasting) continue;

    return next;
  }
}

module.exports = { getNextStage };