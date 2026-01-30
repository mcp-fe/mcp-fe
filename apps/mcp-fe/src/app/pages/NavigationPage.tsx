import { useState } from 'react';
import { Link } from 'react-router-dom';

export const NavigationPage = () => {
  const [breadcrumbs, setBreadcrumbs] = useState(['Home', 'Navigation Demo']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentSection, setCurrentSection] = useState('overview');

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'features', label: 'Features', icon: '⭐' },
    { id: 'integration', label: 'Integration', icon: '🔧' },
    { id: 'examples', label: 'Examples', icon: '📚' },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: '🔍' },
  ];

  const quickActions = [
    { label: 'Go to Dashboard', path: '/dashboard', icon: '🏠' },
    { label: 'Try Forms', path: '/forms', icon: '📝' },
    { label: 'Components Demo', path: '/components', icon: '🎛️' },
    { label: 'Data Table', path: '/data-table', icon: '📊' },
    { label: 'Back to Home', path: '/', icon: '🏡' },
  ];

  const handleSectionChange = (sectionId: string, sectionLabel: string) => {
    setCurrentSection(sectionId);
    // Simulate adding to breadcrumb navigation
    setBreadcrumbs(['Home', 'Navigation Demo', sectionLabel]);
  };

  const renderSectionContent = () => {
    switch (currentSection) {
      case 'overview':
        return (
          <div>
            <h3>Navigation Tracking Overview</h3>
            <p>
              This page demonstrates various navigation patterns and how they
              are tracked by the MCP-FE system. Every navigation event, whether
              it's page routing, section changes, or breadcrumb clicks, is
              captured and stored locally.
            </p>
            <ul>
              <li>
                <strong>Route Changes:</strong> Traditional React Router
                navigation
              </li>
              <li>
                <strong>Section Navigation:</strong> In-page section switching
              </li>
              <li>
                <strong>Breadcrumb Navigation:</strong> Hierarchical navigation
                tracking
              </li>
              <li>
                <strong>Sidebar Navigation:</strong> Secondary navigation
                patterns
              </li>
              <li>
                <strong>Quick Actions:</strong> Contextual navigation shortcuts
              </li>
            </ul>
          </div>
        );
      case 'features':
        return (
          <div>
            <h3>Navigation Features</h3>
            <div className="feature-grid">
              <div className="feature-item">
                <h4>🚀 Real-time Tracking</h4>
                <p>
                  All navigation events are captured instantly and stored in
                  IndexedDB.
                </p>
              </div>
              <div className="feature-item">
                <h4>🔄 Route History</h4>
                <p>
                  Complete history of user navigation patterns and route
                  transitions.
                </p>
              </div>
              <div className="feature-item">
                <h4>📍 Context Preservation</h4>
                <p>
                  Maintains context about user journey and interaction
                  sequences.
                </p>
              </div>
              <div className="feature-item">
                <h4>🎯 Intent Analysis</h4>
                <p>
                  AI agents can analyze navigation patterns to understand user
                  intent.
                </p>
              </div>
            </div>
          </div>
        );
      case 'integration':
        return (
          <div>
            <h3>Integration Guide</h3>
            <p>Integrating MCP-FE navigation tracking into your application:</p>
            <div className="code-example">
              <h4>1. Install the packages:</h4>
              <pre>{`npm install @mcp-fe/react-event-tracker @mcp-fe/mcp-worker`}</pre>

              <h4>2. Set up the hook in your main App component:</h4>
              <pre>{`import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';

function App() {
  const { setAuthToken } = useReactRouterEventTracker();
  // Your app logic here
}`}</pre>

              <h4>3. Navigation events are automatically tracked!</h4>
            </div>
          </div>
        );
      case 'examples':
        return (
          <div>
            <h3>Example Scenarios</h3>
            <div className="example-scenarios">
              <div className="scenario">
                <h4>Scenario 1: User Journey Analysis</h4>
                <p>
                  An AI agent can ask: "Show me the user's navigation path in
                  the last 10 minutes"
                </p>
                <p>
                  <em>
                    Response includes: Home → Dashboard → Forms → Navigation
                    Demo → Features
                  </em>
                </p>
              </div>

              <div className="scenario">
                <h4>Scenario 2: Feature Discovery</h4>
                <p>
                  Agent query: "Which sections has the user spent most time on?"
                </p>
                <p>
                  <em>
                    Analytics reveal user preferences and engagement patterns
                  </em>
                </p>
              </div>

              <div className="scenario">
                <h4>Scenario 3: Error Context</h4>
                <p>
                  When an error occurs, agents can see: "What pages did the user
                  visit before the error?"
                </p>
                <p>
                  <em>
                    Provides crucial debugging context for development teams
                  </em>
                </p>
              </div>
            </div>
          </div>
        );
      case 'troubleshooting':
        return (
          <div>
            <h3>Troubleshooting Navigation Tracking</h3>
            <div className="troubleshooting-steps">
              <div className="step">
                <h4>✅ Check Connection Status</h4>
                <p>
                  Ensure the connection indicator shows "Connected to MCP Proxy"
                </p>
              </div>
              <div className="step">
                <h4>🔍 Verify Event Logging</h4>
                <p>
                  Check the sidebar event log to confirm navigation events are
                  being captured
                </p>
              </div>
              <div className="step">
                <h4>🔧 Worker Registration</h4>
                <p>
                  Ensure the SharedWorker or ServiceWorker is properly
                  registered
                </p>
              </div>
              <div className="step">
                <h4>🌐 MCP Proxy Server</h4>
                <p>Confirm the MCP proxy server is running and accessible</p>
              </div>
            </div>
          </div>
        );
      default:
        return <div>Select a section from the navigation menu.</div>;
    }
  };

  return (
    <div className="navigation-page">
      <div className="page-header">
        <h2>Navigation Demo</h2>

        {/* Breadcrumb Navigation */}
        <nav className="breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={index}>
              {index > 0 && <span className="separator"> / </span>}
              <button
                className="breadcrumb-item"
                onClick={() => {
                  // Simulate breadcrumb navigation
                  setBreadcrumbs(breadcrumbs.slice(0, index + 1));
                  if (index === 0) setCurrentSection('overview');
                }}
              >
                {crumb}
              </button>
            </span>
          ))}
        </nav>
      </div>

      <div className="navigation-layout">
        {/* Sidebar Navigation */}
        <aside
          className={`navigation-sidebar ${sidebarOpen ? 'open' : 'closed'}`}
        >
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? '◄' : '►'}
          </button>

          {sidebarOpen && (
            <nav className="sidebar-nav">
              <h3>Sections</h3>
              <ul>
                {navigationItems.map((item) => (
                  <li key={item.id}>
                    <button
                      className={`nav-item ${currentSection === item.id ? 'active' : ''}`}
                      onClick={() => handleSectionChange(item.id, item.label)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <h3>Quick Actions</h3>
              <ul>
                {quickActions.map((action, index) => (
                  <li key={index}>
                    <Link to={action.path} className="nav-item">
                      <span className="nav-icon">{action.icon}</span>
                      <span className="nav-label">{action.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>

        {/* Main Content */}
        <main className="navigation-content">
          {renderSectionContent()}

          <div className="content-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                // Simulate a complex navigation action
                setCurrentSection('features');
                setBreadcrumbs(['Home', 'Navigation Demo', 'Features']);
                setTimeout(() => {
                  alert(
                    'Navigation action completed! This interaction was tracked.',
                  );
                }, 100);
              }}
            >
              Trigger Complex Navigation
            </button>

            <Link to="/dashboard" className="btn btn-secondary">
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>

      {/* Footer Navigation */}
      <footer className="page-footer">
        <div className="footer-nav">
          <Link to="/components" className="footer-nav-item">
            ← Previous: Components Demo
          </Link>
          <Link to="/forms" className="footer-nav-item">
            Next: Forms Demo →
          </Link>
        </div>
      </footer>
    </div>
  );
};
