const express = require("express");
const router = express.Router();
// const upload = require("../utils/multer");
const auth = require("../middlewares/authMiddleware");
const {
  addMultipleFGs,
  getAllFGs,
  updateFG,
  updateFGWithFiles,
  deleteFG,
} = require("../controllers/fgController");
const setUploadType = require("../middlewares/setUploadType");
const {
  uploadFile,
  compressUploadedFiles,
} = require("../middlewares/uploadFile");
const checkPermission = require("../middlewares/checkPermission");

router.post(
  "/add-many",
  auth,
  checkPermission("FG", "write"),
  setUploadType("fg_attachments"),
  uploadFile.array("files"),
  compressUploadedFiles,
  addMultipleFGs
);
router.get("/get-all", auth, checkPermission("FG", "read"), getAllFGs);
router.patch("/update/:id", auth, checkPermission("FG", "update"), updateFG);
router.patch(
  "/edit/:id",
  auth,
  checkPermission("FG", "update"),
  setUploadType("fg_attachments"),
  uploadFile.array("files"),
  compressUploadedFiles,
  updateFGWithFiles
);
router.delete("/delete/:id", auth, checkPermission("FG", "delete"), deleteFG);

module.exports = router;
