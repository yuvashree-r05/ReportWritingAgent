const Report = require("../models/Report");
const Source = require("../models/Source");
const { runAgent } = require("../agent/loop");
const { parseDocument, chunkText } = require("../rag/parseDocument");
const { upsertChunks } = require("../rag/vectorStore");
const fs = require("fs");

/**
 * POST /api/agent/generate-report
 * body: { topic }
 * userId now comes from the verified JWT (req.userId), set by the
 * verifyToken middleware — never trusted from the request body.
 */
const generateReport = async (req, res) => {
  try {
    const userId = req.userId;
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ message: "topic is required" });
    }

    const { report, steps, sourcesUsed } = await runAgent(userId, topic);

    const sourceIds = sourcesUsed
      .map((s) => s.id)
      .filter((id) => id && id.length === 24);

    const savedReport = await Report.create({
      userId,
      topic,
      content: report,
      sourcesUsed: sourceIds
    });

    res.status(201).json({
      report: savedReport,
      steps
    });

  } catch (error) {
    console.log("Generate Report Error", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

/**
 * POST /api/agent/upload-document
 * multipart/form-data: { topic (optional), file }
 * userId comes from the verified JWT, same as above.
 */
const uploadDocument = async (req, res) => {
  try {
    const userId = req.userId;
    const { topic } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "A file is required" });
    }

    const rawText = await parseDocument(req.file.path, req.file.mimetype);
    const chunks = chunkText(rawText);

    const savedChunks = [];

    for (const chunk of chunks) {
      const sourceDoc = await Source.create({
        userId,
        sourceType: "upload",
        origin: req.file.originalname,
        content: chunk,
        topic: topic || ""
      });

      savedChunks.push({
        id: sourceDoc._id.toString(),
        text: chunk,
        sourceType: "upload",
        origin: req.file.originalname,
        topic: topic || ""
      });
    }

    await upsertChunks(savedChunks);

    fs.unlink(req.file.path, () => {});

    res.status(201).json({
      message: "Document uploaded and added to knowledge base",
      chunksSaved: savedChunks.length
    });

  } catch (error) {
    console.log("Upload Document Error", error);
    res.status(500).json({ message: error.message || "Failed to process document" });
  }
};

module.exports = { generateReport, uploadDocument };