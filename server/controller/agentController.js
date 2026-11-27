const Report = require("../models/Report");
const Source = require("../models/Source");
const { runAgent } = require("../agent/loop");
const { parseDocument, chunkText } = require("../rag/parseDocument");
const { upsertChunks } = require("../rag/vectorStore");
const fs = require("fs");

/**
 * POST /api/agent/generate-report
 * Body: { topic }
 * The user ID comes from the login token (req.userId), never from the request body.
 */
const generateReport = async (req, res) => {
  try {
    const userId = req.userId;
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ message: "topic is required" });
    }

    const { report, status, notice, steps, sourcesUsed } = await runAgent(userId, topic);

    // If the report failed, send the message back and save nothing.
    if (status === "error") {
      return res.status(503).json({
        message: report,
        status,
        steps
      });
    }

    // Keep only the source IDs that look like valid database IDs.
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
      steps,
      status,
      notice
    });

  } catch (error) {
    console.log("Generate Report Error", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

/**
 * POST /api/agent/upload-document
 * Form data: { topic (optional), file }
 * The user ID comes from the login token, same as above.
 */
const uploadDocument = async (req, res) => {
  try {
    const userId = req.userId;
    const { topic } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "A file is required" });
    }

    // Read the text from the file and cut it into pieces.
    const rawText = await parseDocument(req.file.path, req.file.mimetype);
    const chunks = chunkText(rawText);

    const savedChunks = [];

    // Save each piece to the database.
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

    // Add the pieces to the search index.
    await upsertChunks(savedChunks);

    // Delete the uploaded file from the server, since its text is now saved.
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