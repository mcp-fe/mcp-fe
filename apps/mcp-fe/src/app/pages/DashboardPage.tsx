import { useState } from 'react';
import { Link } from 'react-router-dom';

export const DashboardPage = () => {
  const [stats, setStats] = useState({
    clicks: 0,
    formSubmissions: 0,
    navigationEvents: 0,
  });

  const handleStatClick = (statType: keyof typeof stats) => {
    setStats((prev) => ({ ...prev, [statType]: prev[statType] + 1 }));
  };

  return (
    <div className="dashboard-page">
      <h2>Dashboard - Interactive Demo</h2>
      <p>
        This dashboard demonstrates various interactive components that are
        being tracked by the MCP-FE system. All your interactions here are
        captured and stored locally in IndexedDB.
      </p>

      <div className="stats-grid">
        <div className="stat-card" onClick={() => handleStatClick('clicks')}>
          <h3>Total Clicks</h3>
          <div className="stat-number">{stats.clicks}</div>
          <small>Click this card to increment</small>
        </div>

        <div
          className="stat-card"
          onClick={() => handleStatClick('formSubmissions')}
        >
          <h3>Form Submissions</h3>
          <div className="stat-number">{stats.formSubmissions}</div>
          <small>Click to simulate submission</small>
        </div>

        <div
          className="stat-card"
          onClick={() => handleStatClick('navigationEvents')}
        >
          <h3>Navigation Events</h3>
          <div className="stat-number">{stats.navigationEvents}</div>
          <small>Click to increment</small>
        </div>
      </div>

      <div className="dashboard-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <Link to="/forms" className="action-btn primary">
            📝 Try Forms Demo
          </Link>
          <Link to="/components" className="action-btn secondary">
            🎛️ Interactive Components
          </Link>
          <Link to="/data-table" className="action-btn secondary">
            📊 Data Table Demo
          </Link>
          <Link to="/navigation" className="action-btn secondary">
            🧭 Navigation Demo
          </Link>
        </div>
      </div>
    </div>
  );
};
