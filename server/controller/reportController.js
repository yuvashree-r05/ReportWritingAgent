const Report = require("../models/Report");

// GET /api/report/mine — all reports for the logged-in user, newest first
const getReports = async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.userId })
      .sort({ createdAt: -1 });

    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/report/single/:id — one specific report, with sources populated
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate("sourcesUsed");

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Ownership check — only the report's own creator can view it
    if (report.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to view this report" });
    }

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = { getReports, getReportById };