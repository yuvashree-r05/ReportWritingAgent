const express = require("express");
const { getReports, getReportById } = require("../controller/reportController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/mine", verifyToken, getReports);
router.get("/single/:id", verifyToken, getReportById);

module.exports = router;