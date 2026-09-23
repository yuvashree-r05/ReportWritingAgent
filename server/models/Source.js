const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // Where this chunk came from
  sourceType: {
    type: String,
    enum: ["web", "upload"],
    required: true
  },

  // For web sources: the page URL. For uploads: the original filename.
  origin: { type: String, required: true },

  // The actual text chunk (kept here too, alongside Pinecone, so we can
  // display/reference it without an extra Pinecone round-trip if needed)
  content: { type: String, required: true },

  // Optional: which report this was originally gathered for
  topic: { type: String },

  createdAt: { type: Date, default: Date.now }
});

// NOTE: no embedding field here anymore — Pinecone's integrated embedding
// model handles that internally. This document's own _id is what gets
// used as the matching Pinecone record id (see rag/vectorStore.js).

module.exports = mongoose.model("Source", sourceSchema);