const express = require("express");
const router = express.Router();
const {
  addMultipleSFGs,
  getAllSFGs,
  updateSFG,
  updateSFGWithFiles,
  deleteSFG,
} = require("../controllers/sfgController");
const upload = require("../utils/multer");
const auth = require("../middlewares/authMiddleware");

router.post("/add-many", auth, upload.array("files"), addMultipleSFGs);
router.get("/get-all", auth, getAllSFGs);
router.patch("/update/:id", auth, updateSFG);
router.patch("/edit/:id", auth, upload.array("files"), updateSFGWithFiles);
router.delete("/delete/:id", auth, deleteSFG);

module.exports = router;
