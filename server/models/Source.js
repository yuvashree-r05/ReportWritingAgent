
const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  sourceType: {
    type: String,
    enum: ["web", "upload"],
    required: true
  },

  title: {
    type: String,
    default: ""
  },

  origin: {
    type: String,
    required: true
  },

  content: {
    type: String,
    required: true
  },

  topic: {
    type: String,
    default: ""
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Source", sourceSchema);
