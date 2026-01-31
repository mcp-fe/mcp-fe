import { Link } from 'react-router-dom';

export const HomePage = () => (
  <div>
    <h1>MCP-FE (Model Context Protocol - Frontend Edge)</h1>
    <p
      className="lead-text"
      style={{ fontSize: '1.2rem', marginBottom: '2rem' }}
    >
      Turn your browser into an active, queryable node in the MCP ecosystem.
      Bridge the gap between AI Agents and the real-time state of your frontend
      application.
    </p>

    <div
      className="feature-highlight"
      style={{
        backgroundColor: '#e8f4f8',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}
    >
      <h3>🤖 Why MCP-FE?</h3>
      <p>
        Traditional AI agents are <strong>"runtime blind"</strong>. They know
        your code, but they don't know:
      </p>
      <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
        <li>The current value of a specific input field</li>
        <li>The browsing history</li>
        <li>The exact sequence of clicks that led to an error</li>
      </ul>
      <p>
        <strong>MCP-FE solves this</strong> by exposing the{' '}
        <strong>Browser Runtime</strong> as a first-class MCP Server.
      </p>
    </div>

    <div className="key-features" style={{ marginBottom: '2rem' }}>
      <h3>✨ Key Features</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
          }}
        >
          <h4>🔒 Privacy-First</h4>
          <p>
            Data never leaves your browser unless an AI agent explicitly
            requests it.
          </p>
        </div>
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
          }}
        >
          <h4>🎯 On-Demand Pull</h4>
          <p>No continuous data pushing. Context is shared only when needed.</p>
        </div>
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
          }}
        >
          <h4>⚡ Edge Architecture</h4>
          <p>
            SharedWorker/ServiceWorker acts as a local MCP server in your
            browser.
          </p>
        </div>
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
          }}
        >
          <h4>📦 Easy Integration</h4>
          <p>
            NPM packages ready to use: event tracker, React hooks, and worker
            client.
          </p>
        </div>
      </div>
    </div>

    <div
      className="use-cases"
      style={{
        marginBottom: '2rem',
        padding: '1.5rem',
        backgroundColor: '#fff9e6',
        borderRadius: '8px',
      }}
    >
      <h3>💡 Use Cases</h3>
      <ul style={{ marginLeft: '1.5rem' }}>
        <li>
          <strong>Context-Aware Support:</strong> Query the user's current UI
          state for instant help
        </li>
        <li>
          <strong>Agentic Debugging:</strong> Ask "Why is the submit button
          disabled?" and get live state inspection
        </li>
        <li>
          <strong>Dynamic Onboarding:</strong> AI guides users based on their
          real-time progress and errors
        </li>
      </ul>
      <p style={{ marginTop: '1rem' }}>
        Want to learn more about the architecture?{' '}
        <Link to="/how-it-works" style={{ fontWeight: 'bold' }}>
          See How It Works →
        </Link>
      </p>
    </div>

    <div className="demo-sections">
      <h3>🚀 Try the Interactive Demo</h3>
      <p style={{ marginBottom: '1.5rem' }}>
        Explore different pages to see how user interactions are automatically
        tracked and stored locally in IndexedDB. Watch the{' '}
        <strong>Live Event Log</strong> in the sidebar to see how the events are
        stored in real-time!
      </p>
      <div className="demo-grid">
        <div className="demo-card">
          <h4>🎛️ Interactive Components</h4>
          <p>
            Explore buttons, modals, tabs, toggles, and more UI components with
            real-time tracking
          </p>
          <Link to="/components" className="demo-link">
            Try Components →
          </Link>
        </div>

        <div className="demo-card">
          <h4>📝 Forms Demo</h4>
          <p>
            Complex forms with validation - perfect for tracking user input
            patterns
          </p>
          <Link to="/forms" className="demo-link">
            Try Forms →
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
          <p>Various navigation patterns and automatic route tracking</p>
          <Link to="/navigation" className="demo-link">
            Try Navigation →
          </Link>
        </div>
      </div>
    </div>

    <div
      className="getting-started"
      style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f0f0f0',
        borderRadius: '8px',
      }}
    >
      <h3>📚 Want to integrate MCP-FE into your app?</h3>
      <p>
        MCP-FE is available as NPM packages. Check out the{' '}
        <a
          href="https://www.npmjs.com/package/@mcp-fe/mcp-worker"
          target="_blank"
          rel="noopener noreferrer"
        >
          @mcp-fe/mcp-worker
        </a>
        ,{' '}
        <a
          href="https://www.npmjs.com/package/@mcp-fe/react-event-tracker"
          target="_blank"
          rel="noopener noreferrer"
        >
          @mcp-fe/react-event-tracker
        </a>
        , and{' '}
        <a
          href="https://www.npmjs.com/package/@mcp-fe/event-tracker"
          target="_blank"
          rel="noopener noreferrer"
        >
          @mcp-fe/event-tracker
        </a>{' '}
        packages for easy integration.
      </p>
    </div>
  </div>
);
