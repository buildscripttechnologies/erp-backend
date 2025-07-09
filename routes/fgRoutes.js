const express = require("express");
const router = express.Router();
const upload = require("../utils/multer");
const auth = require("../middlewares/authMiddleware");
const {
  addMultipleFGs,
  getAllFGs,
  updateFG,
  updateFGWithFiles,
  deleteFG,
} = require("../controllers/fgController");

router.post("/add-many", auth, upload.array("files"), addMultipleFGs);
router.get("/get-all", auth, getAllFGs);
router.patch("/update/:id", auth, updateFG);
router.patch("/edit/:id", auth, upload.array("files"), updateFGWithFiles);
router.delete("/delete/:id", auth, deleteFG);

module.exports = router;
