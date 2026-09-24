import React, { useEffect, useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../styles/History.css";

const History = () => {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReports = async () => {
    try {
      const response = await api.get("/api/report/mine");
      setReports(response.data);
    } catch (error) {
      console.log("Fetch Reports Error", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-layout">
      <Sidebar />

      <div className="page-content">
        <h1>Report History</h1>

        {loading ? (
          <p>Loading...</p>
        ) : reports.length === 0 ? (
          <p className="hint">No reports yet — generate your first one from New Report.</p>
        ) : (
          <div className="history-list">
            {reports.map((report) => (
              <div
                key={report._id}
                className="history-item"
                onClick={() => navigate(`/report/${report._id}`)}
              >
                <div>
                  <h3>{report.topic}</h3>
                  <span className="history-date">
                    {new Date(report.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className="history-arrow">→</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;