const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  topic: { type: String, required: true },

  // The final compiled report text
  content: { type: String, required: true },

  // Which sources (by _id, referencing Source) were actually used
  sourcesUsed: [{ type: mongoose.Schema.Types.ObjectId, ref: "Source" }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Report", reportSchema);