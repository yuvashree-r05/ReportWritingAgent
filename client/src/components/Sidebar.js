import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/Sidebar.css";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  return (
    <div className="sidebar">
      <h2 className="sidebar-title">Report Agent</h2>

      <nav className="sidebar-nav">
        <Link to="/" className={isActive("/") ? "active" : ""}>
          New Report
        </Link>
        <Link to="/history" className={isActive("/history") ? "active" : ""}>
          History
        </Link>
      </nav>

      <button className="logout-btn" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default Sidebar;