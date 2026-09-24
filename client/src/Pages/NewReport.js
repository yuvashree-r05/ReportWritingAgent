import React, { useState } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";
import "../styles/NewReport.css";

const NewReport = () => {
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("Please choose a file first");
      return;
    }

    setUploading(true);
    setUploadMessage("");

    const formData = new FormData();
    formData.append("topic", topic || "uploaded document");
    formData.append("file", file);

    try {
      const response = await api.post("/api/agent/upload-document", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setUploadMessage(
        `"${file.name}" added to your knowledge base (${response.data.chunksSaved} chunks saved).`
      );
      setFile(null);

    } catch (err) {
      setUploadMessage(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic");
      return;
    }

    setError("");
    setReport(null);
    setSteps([]);
    setGenerating(true);

    try {
      const response = await api.post("/api/agent/generate-report", { topic });

      setReport(response.data.report);
      setSteps(response.data.steps || []);

    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page-layout">
      <Sidebar />

      <div className="page-content">
        <h1>New Report</h1>
        <p className="subtitle">
          Enter a topic and the agent will research it — using anything relevant
          it already knows, plus live web search if needed.
        </p>

        <div className="card">
          <label>Report Topic</label>
          <input
            type="text"
            placeholder="e.g. Impact of remote work on small business hiring"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />

          <button
            className="primary-btn"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? "Researching and writing... this can take a minute" : "Generate Report"}
          </button>

          {error && <div className="error-banner">{error}</div>}
        </div>

        <div className="card">
          <label>Add to Knowledge Base (optional)</label>
          <p className="hint">
            Upload a PDF or Word document — the agent will use it as a source
            for this and future reports.
          </p>

          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <button
            className="secondary-btn"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload Document"}
          </button>

          {uploadMessage && <div className="upload-message">{uploadMessage}</div>}
        </div>

        {report && (
          <div className="card report-card">
            <h2>{report.topic}</h2>
            <div className="report-content">{report.content}</div>

            {steps.length > 0 && (
              <details className="agent-trail">
                <summary>Agent's research trail ({steps.length} steps)</summary>
                <ul>
                  {steps.map((step, i) => (
                    <li key={i}>
                      <strong>{step.tool}</strong>
                      {step.args?.query && ` — "${step.args.query}"`}
                      {step.args?.url && ` — ${step.args.url}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewReport;