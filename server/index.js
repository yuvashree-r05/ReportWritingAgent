require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ===== Routes =====
const authRoutes = require("./routes/auth");
const agentRoutes = require("./routes/agent");
const reportRoutes = require("./routes/report");

app.use("/api/auth", authRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/report", reportRoutes);

app.get("/", (req, res) => {
  res.send("Report Writing Agent API is running");
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB connection error:", error);
  });