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
const checkPermission = require("../middlewares/checkPermission");

router.post(
  "/add-many",
  auth,
  checkPermission(["SFG"], "write"),
  setUploadType("sfg_attachments"),
  uploadFile.fields([
    { name: "files", maxCount: 10 },
    { name: "printingFiles", maxCount: 10 },
  ]),
  // compressUploadedFiles,
  addMultipleSFGs
);
router.get("/get-all", auth, checkPermission(["SFG"], "read"), getAllSFGs);
router.patch("/update/:id", auth, checkPermission(["SFG"], "update"), updateSFG);
router.patch(
  "/edit/:id",
  auth,
  checkPermission(["SFG"], "update"),
  setUploadType("sfg_attachments"),
  uploadFile.fields([
    { name: "files", maxCount: 10 },
    { name: "printingFiles", maxCount: 10 },
  ]),
  // compressUploadedFiles,
  updateSFGWithFiles
);
router.delete("/delete/:id", auth, checkPermission(["SFG"], "delete"), deleteSFG);

module.exports = router;
