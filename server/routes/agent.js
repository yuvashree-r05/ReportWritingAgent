const express = require("express");
const multer = require("multer");

const { generateReport, uploadDocument } = require("../controller/agentController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/generate-report", verifyToken, generateReport);
router.post("/upload-document", verifyToken, upload.single("file"), uploadDocument);

module.exports = router;