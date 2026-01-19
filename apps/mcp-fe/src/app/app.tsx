// Uncomment this line to use CSS modules
// import styles from './app.module.scss';
import { HomePage } from './homePage';
import { Routes, Link, Route, useLocation } from 'react-router-dom';
import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';
import { useStoredEvents } from './hooks/useStoredEvents';
import { useConnectionStatus } from './hooks/useConnectionStatus';

export function App() {
  useReactRouterEventTracker();
  const { events } = useStoredEvents(1000);
  const location = useLocation();
  const isConnected = useConnectionStatus();

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1>MCP Edge Demo</h1>
          <nav className="header-nav">
            <ul>
              <li>
                <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
              </li>
              <li>
                <Link to="/page-2" className={location.pathname === '/page-2' ? 'active' : ''}>Page 2</Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
          <span className="dot"></span>
          {isConnected ? 'Connected to MCP Proxy' : 'Disconnected from MCP Proxy'}
        </div>
      </header>

      <main className="main-layout">
        <section className="content-area">
          <div className="card">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/page-2"
                element={
                  <div>
                    <h2>Page 2</h2>
                    <p>This is another page to demonstrate navigation tracking.</p>
                    <Link to="/">Back to Home</Link>
                  </div>
                }
              />
            </Routes>
          </div>

          <div className="card doc-section">
            <h2>How it works</h2>
            <p>
              This demo showcases the <strong>Service Worker MCP Edge</strong> pattern.
              Your interactions are tracked locally and stored in <code>IndexedDB</code> inside a Service Worker.
            </p>
            <div className="architecture-image">
              <img src="/assets/mcp-architecture.png" alt="MCP Architecture Diagram" />
            </div>
            <p>
              The Service Worker acts as an MCP Server. The data is <strong>never pushed</strong> to the server automatically.
              Instead, an AI Agent can <strong>pull</strong> it on-demand via the MCP server Proxy.
            </p>
          </div>
        </section>

        <aside className="sidebar">
          <div className="card">
            <h2>Live Event Log (IndexedDB)</h2>
            <ul className="event-list">
              {events.length === 0 && <li>No events tracked yet.</li>}
              {events.map((event) => (
                <li key={event.id}>
                  <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <span className="event-type">{event.type}</span>
                  <span className="event-details">
                    {event.type === 'navigation' && `to: ${event.to}`}
                    {event.type === 'click' && `on: ${event.element}${event.elementText ? ` ("${event.elementText}")` : ''}`}
                    {event.type === 'input' && `in: ${event.element}${event.metadata?.value ? ` (value: ${event.metadata.value})` : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
