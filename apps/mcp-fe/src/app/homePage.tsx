import { Link } from 'react-router-dom';

export const HomePage = () => (
  <div>
    <h2>Welcome to MCP Edge Demo</h2>
    <p>
      This is a comprehensive demo application for the Model Context Protocol
      (MCP) on the frontend. Explore different pages to see how various user
      interactions are tracked and stored locally.
    </p>

    <div className="demo-sections">
      <h3>Explore Demo Features</h3>
      <div className="demo-grid">
        <div className="demo-card">
          <h4>📊 Dashboard</h4>
          <p>Interactive dashboard with stats and quick actions</p>
          <Link to="/dashboard" className="demo-link">
            Try Dashboard →
          </Link>
        </div>

        <div className="demo-card">
          <h4>📝 Forms Demo</h4>
          <p>Complex forms with validation and various input types</p>
          <Link to="/forms" className="demo-link">
            Try Forms →
          </Link>
        </div>

        <div className="demo-card">
          <h4>🎛️ Components</h4>
          <p>Interactive UI components: buttons, modals, tabs, toggles</p>
          <Link to="/components" className="demo-link">
            Try Components →
          </Link>
        </div>

        <div className="demo-card">
          <h4>📋 Data Table</h4>
          <p>Sortable, filterable data table with bulk operations</p>
          <Link to="/data-table" className="demo-link">
            Try Data Table →
          </Link>
        </div>

        <div className="demo-card">
          <h4>🧭 Navigation</h4>
          <p>Various navigation patterns and route tracking</p>
          <Link to="/navigation" className="demo-link">
            Try Navigation →
          </Link>
        </div>
      </div>
    </div>

    <div className="quick-test-section" style={{ marginTop: '2rem' }}>
      <h3>Quick Test Elements</h3>
      <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
        <div>
          <label htmlFor="demo-input">
            Type something to track input events:{' '}
          </label>
          <input
            id="demo-input"
            type="text"
            placeholder="Try typing here..."
            style={{ padding: '8px', width: '250px' }}
          />
        </div>

        <div>
          <button
            id="demo-button"
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          >
            Click Me (Tracked Button)
          </button>
        </div>

        <div>
          <Link to="/page-2">Go to Page 2 (Legacy Navigation Test)</Link>
        </div>
      </div>
    </div>

    <div
      className="architecture-info"
      style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
      }}
    >
      <h3>🔍 What's Being Tracked?</h3>
      <p>
        Watch the <strong>Live Event Log</strong> in the sidebar to see
        real-time tracking of:
      </p>
      <ul>
        <li>Navigation events (page changes, route transitions)</li>
        <li>Click events (buttons, links, interactive elements)</li>
        <li>Input events (typing, form changes)</li>
        <li>UI interactions (modals, dropdowns, tabs)</li>
        <li>Form submissions and validation events</li>
      </ul>
      <p>
        <em>
          All data stays in your browser and is only accessed by AI agents
          on-demand via MCP protocol.
        </em>
      </p>
    </div>
  </div>
);
