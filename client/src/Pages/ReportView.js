import React, { useEffect, useState } from "react";
import api from "../api";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../styles/History.css";

const ReportView = () => {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchReport = async () => {
    try {
      const response = await api.get(`/api/report/single/${id}`);
      setReport(response.data);
    } catch (error) {
      console.log("Fetch Report Error", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-layout">
      <Sidebar />

      <div className="page-content">
        <Link to="/history" className="back-link">← Back to History</Link>

        {loading ? (
          <p>Loading...</p>
        ) : !report ? (
          <p>Report not found.</p>
        ) : (
          <div className="card report-card">
            <h1>{report.topic}</h1>
            <span className="history-date">
              {new Date(report.createdAt).toLocaleString()}
            </span>

            <div className="report-content">{report.content}</div>

            {report.sourcesUsed?.length > 0 && (
              <div className="sources-section">
                <h3>Sources Used</h3>
                <ul>
                  {report.sourcesUsed.map((source) => (
                    <li key={source._id}>
                      <span className={`source-badge ${source.sourceType}`}>
                        {source.sourceType === "upload" ? "Your Document" : "Web"}
                      </span>
                      {source.origin}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportView;