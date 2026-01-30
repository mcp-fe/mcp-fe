import { Link } from 'react-router-dom';
import mcpArchitectureImg from '../../assets/mcp-architecture.png';

export const HowItWorksPage = () => (
  <div className="how-it-works-page">
    <h2>How It Works</h2>
    <p
      className="lead-text"
      style={{ fontSize: '1.1rem', marginBottom: '2rem' }}
    >
      MCP-FE implements a <strong>pull-based architecture</strong> where the
      browser acts as a local MCP server, responding to data requests from AI
      agents on-demand rather than continuously pushing data.
    </p>

    <div
      className="architecture-diagram"
      style={{ marginBottom: '2rem', textAlign: 'center' }}
    >
      <img
        src={mcpArchitectureImg}
        alt="MCP-FE Architecture Diagram"
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      />
    </div>

    <div className="architecture-explanation">
      <h3>Architecture Overview</h3>
      <p>
        The MCP-FE architecture consists of four main components working
        together to enable AI agents to query frontend application state in
        real-time:
      </p>

      <div className="architecture-steps">
        <div
          className="step-card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
          }}
        >
          <h4>1. Frontend Application</h4>
          <p>
            Your React (or any other) application uses the{' '}
            <code>@mcp-fe/event-tracker</code> or{' '}
            <code>@mcp-fe/react-event-tracker</code> library to automatically
            capture user interactions:
          </p>
          <ul>
            <li>Navigation events (route changes, page transitions)</li>
            <li>Click events (buttons, links, interactive elements)</li>
            <li>Input events (typing, form changes, validations)</li>
            <li>Custom events (application-specific interactions)</li>
          </ul>
          <p>
            These events are sent to the Worker Client for storage. The tracking
            is automatic and requires minimal setup.
          </p>
        </div>

        <div
          className="step-card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
            backgroundColor: '#e8f4f8',
            borderRadius: '8px',
          }}
        >
          <h4>2. Browser Worker (MCP Worker)</h4>
          <p>
            A <code>SharedWorker</code> (with <code>ServiceWorker</code>{' '}
            fallback) runs in the background, provided by{' '}
            <code>@mcp-fe/mcp-worker</code>. This worker acts as a lightweight
            edge MCP server:
          </p>
          <ul>
            <li>
              <strong>Stores events locally</strong> in IndexedDB (persistent,
              private browser storage)
            </li>
            <li>
              <strong>Implements MCP server endpoints</strong> that can be
              called by AI agents
            </li>
            <li>
              <strong>Maintains a WebSocket connection</strong> to the MCP Proxy
              Server
            </li>
            <li>
              <strong>Responds to tool calls</strong> from AI agents by querying
              IndexedDB
            </li>
          </ul>
          <p>
            The worker is shared across all tabs of your application (when using
            SharedWorker), providing a unified view of user activity.
          </p>
        </div>

        <div
          className="step-card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
            backgroundColor: '#fff9e6',
            borderRadius: '8px',
          }}
        >
          <h4>3. Node.js MCP Proxy Server</h4>
          <p>
            A lightweight Node.js server (<code>@mcp-fe/mcp-server</code>) acts
            as a bridge between AI agents and the browser worker:
          </p>
          <ul>
            <li>
              <strong>Accepts WebSocket connections</strong> from browser
              workers
            </li>
            <li>
              <strong>Exposes MCP tools</strong> to AI agents (like Claude,
              Cursor, etc.)
            </li>
            <li>
              <strong>Routes tool calls</strong> from agents to the appropriate
              browser worker
            </li>
            <li>
              <strong>Returns responses</strong> back to the AI agent
            </li>
          </ul>
          <p>
            You can use our Docker image or run it locally. It's designed to be
            stateless and lightweight.
          </p>
        </div>

        <div
          className="step-card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
            backgroundColor: '#e8f8e8',
            borderRadius: '8px',
          }}
        >
          <h4>4. AI Agent (Claude, Cursor, etc.)</h4>
          <p>
            Standard MCP-compatible AI agents connect to the proxy server and
            can call tools to query the frontend state:
          </p>
          <ul>
            <li>
              <code>get_user_events</code> - Retrieve user interaction history
            </li>
            <li>
              <code>query_application_state</code> - Get current UI state
            </li>
            <li>
              <code>search_events</code> - Search through event history
            </li>
          </ul>
          <p>
            The agent only requests data when it needs it, making the system
            efficient and privacy-friendly.
          </p>
        </div>
      </div>
    </div>

    <div
      className="key-principles"
      style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f0f0f0',
        borderRadius: '8px',
      }}
    >
      <h3>Key Principles</h3>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4>🔒 Privacy-First</h4>
        <p>
          All data stays in your browser's IndexedDB. It's never sent to any
          server unless an authorized AI agent explicitly requests it. You
          control what data is shared and when.
        </p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4>📡 Pull, Don't Push</h4>
        <p>
          Unlike traditional analytics that continuously stream data to servers,
          MCP-FE only sends data when an AI agent calls a tool. This reduces
          bandwidth, improves privacy, and gives you better control.
        </p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4>⚡ Edge Computing</h4>
        <p>
          By running the MCP server in a browser worker, we bring compute to the
          edge—right where the data is. This enables real-time queries without
          round-trip delays.
        </p>
      </div>

      <div>
        <h4>🔌 Standard MCP Protocol</h4>
        <p>
          MCP-FE uses the standard Model Context Protocol. Any MCP-compatible AI
          agent can connect and query your frontend state without custom
          integrations.
        </p>
      </div>
    </div>

    <div
      className="example-flow"
      style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
      }}
    >
      <h3>Example: AI Agent Debugging Flow</h3>
      <ol style={{ marginLeft: '1.5rem' }}>
        <li>
          <strong>User reports:</strong> "I clicked the submit button but
          nothing happened"
        </li>
        <li>
          <strong>AI agent calls tool:</strong>{' '}
          <code>get_user_events(type: "click", limit: 10)</code>
        </li>
        <li>
          <strong>MCP Proxy routes</strong> the request to the browser worker
          via WebSocket
        </li>
        <li>
          <strong>Worker queries IndexedDB</strong> and retrieves the last 10
          click events
        </li>
        <li>
          <strong>Response sent back</strong> through proxy to AI agent
        </li>
        <li>
          <strong>Agent analyzes:</strong> "I see you clicked 'Submit' but the
          form has validation errors in the email field"
        </li>
      </ol>
      <p style={{ marginTop: '1rem', fontStyle: 'italic' }}>
        All of this happens in real-time, with the AI agent having full context
        of what the user did.
      </p>
    </div>

    <div
      className="getting-started-link"
      style={{ marginTop: '2rem', textAlign: 'center' }}
    >
      <h3>Ready to try it?</h3>
      <p>Explore the interactive demos to see MCP-FE in action!</p>
      <Link
        to="/"
        className="demo-link"
        style={{ fontSize: '1.1rem', padding: '0.5rem 1rem' }}
      >
        ← Back to Home
      </Link>{' '}
      <Link
        to="/components"
        className="demo-link"
        style={{ fontSize: '1.1rem', padding: '0.5rem 1rem' }}
      >
        Try Components →
      </Link>
    </div>
  </div>
);
