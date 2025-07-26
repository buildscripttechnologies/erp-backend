const express = require("express");
const router = express.Router();
const {
  addMultipleSFGs,
  getAllSFGs,
  updateSFG,
  updateSFGWithFiles,
  deleteSFG,
} = require("../controllers/sfgController");
// const upload = require("../utils/multer");
const auth = require("../middlewares/authMiddleware");
const {
  uploadFile,
  compressUploadedFiles,
} = require("../middlewares/uploadFile");
const setUploadType = require("../middlewares/setUploadType");

router.post(
  "/add-many",
  auth,
  setUploadType("sfg_attachments"),
  uploadFile.array("files"),
  compressUploadedFiles,
  addMultipleSFGs
);
router.get("/get-all", auth, getAllSFGs);
router.patch("/update/:id", auth, updateSFG);
router.patch(
  "/edit/:id",
  auth,
  setUploadType("sfg_attachments"),
  uploadFile.array("files"),
  compressUploadedFiles,
  updateSFGWithFiles
);
router.delete("/delete/:id", auth, deleteSFG);

module.exports = router;
