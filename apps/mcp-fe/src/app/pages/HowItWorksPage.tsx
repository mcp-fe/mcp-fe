import { Link } from 'react-router-dom';
import mcpArchitectureImg from '../../assets/mcp-architecture.png';

export const HowItWorksPage = () => (
  <div className="how-it-works-page">
    <h2>How It Works</h2>
    <p
      className="lead-text"
      style={{ fontSize: '1.1rem', marginBottom: '2rem' }}
    >
      MCP-FE implements a <strong>bidirectional architecture</strong> where the
      browser acts as a local MCP server with pull-based data requests from AI
      agents, plus the ability for agents to send data back to components and
      interact with custom tools registered directly in your React components.
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
            Your React (or any other) application integrates MCP-FE capabilities
            through multiple libraries:
          </p>
          <ul>
            <li>
              <strong>Event Tracking:</strong>{' '}
              <code>@mcp-fe/event-tracker</code> or{' '}
              <code>@mcp-fe/react-event-tracker</code> automatically capture:
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>Navigation events (route changes, page transitions)</li>
                <li>Click events (buttons, links, interactive elements)</li>
                <li>Input events (typing, form changes, validations)</li>
                <li>Custom events (application-specific interactions)</li>
              </ul>
            </li>
            <li>
              <strong>Custom Tools:</strong> <code>@mcp-fe/react-tools</code>{' '}
              allows you to register custom MCP tools directly in React
              components with hooks like <code>useMCPTool</code>
            </li>
            <li>
              <strong>State Sharing:</strong> Components can expose their state
              for AI agents to read
            </li>
            <li>
              <strong>Data Receiving:</strong> Components can receive and
              process data sent from AI agents
            </li>
          </ul>
          <p>
            All data is sent to the Worker Client for storage and processing.
            The integration is simple and requires minimal setup.
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
          <h4>2. MCP Worker (Browser worker)</h4>
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
              <strong>Manages custom tools registry</strong> - keeps track of
              tools registered by components
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
              IndexedDB or executing custom tools
            </li>
            <li>
              <strong>Routes data from agents</strong> back to the appropriate
              components
            </li>
          </ul>
          <p>
            The worker is shared across all tabs of your application (when using
            SharedWorker), providing a unified view of user activity and
            bidirectional communication channel.
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
            A lightweight Node.js server acts as a bridge between AI agents and
            the browser worker:
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
            can call built-in and custom tools to interact with your frontend:
          </p>
          <ul>
            <li>
              <strong>Built-in tools:</strong>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>
                  <code>get_client_status</code> - Get current state of the
                  browser - worker connection
                </li>
                <li>
                  <code>get_user_events</code> - Retrieve complete user
                  interaction history
                </li>
                <li>
                  <code>get_navigation_history</code> - Search through
                  navigation history
                </li>
                <li>
                  <code>get_click_events</code> - Retrieve click event history
                </li>
              </ul>
            </li>
            <li>
              <strong>Custom tools:</strong> Any tools registered by your
              components using <code>@mcp-fe/react-tools</code> (e.g.,{' '}
              <code>calculate_shipping</code>, <code>validate_order</code>,{' '}
              <code>get_cart_items</code>)
            </li>
            <li>
              <strong>Bidirectional actions:</strong> Agents can send data back
              to components to update UI state
            </li>
          </ul>
          <p>
            The agent only requests data when it needs it, making the system
            efficient and privacy-friendly. Agents can both read from and write
            to your application.
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

      <div style={{ marginBottom: '1.5rem' }}>
        <h4>🔄 Bidirectional Communication</h4>
        <p>
          Unlike traditional one-way analytics, MCP-FE enables two-way
          communication. AI agents can not only read application state but also
          send data back to components, execute custom tools, and trigger UI
          updates—all through a standard MCP interface.
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
      <h3>Example: AI Agent Interactive Flow</h3>
      <ol style={{ marginLeft: '1.5rem' }}>
        <li>
          <strong>User asks:</strong> "Why can't I submit this form?"
        </li>
        <li>
          <strong>AI agent calls built-in tool:</strong>{' '}
          <code>get_user_events(type: "click", limit: 10)</code> to see recent
          interactions
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
          <strong>Agent calls custom tool:</strong>{' '}
          <code>get_form_state(formId: "checkout-form")</code> registered by
          your component
        </li>
        <li>
          <strong>Component responds</strong> with current form state including
          validation errors
        </li>
        <li>
          <strong>Agent analyzes and responds:</strong> "I see you clicked
          'Submit' but the form has validation errors in the email field. Would
          you like me to help fix it?"
        </li>
        <li>
          <strong>User agrees, agent sends data:</strong> Agent calls another
          custom tool to populate the email field with a corrected value
        </li>
      </ol>
      <p style={{ marginTop: '1rem', fontStyle: 'italic' }}>
        All of this happens in real-time with bidirectional communication - the
        AI agent has full context of user actions and can actively help by
        updating the UI.
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
        to="/navigation"
        className="demo-link"
        style={{ fontSize: '1.1rem', padding: '0.5rem 1rem' }}
      >
        Try Navigation →
      </Link>
    </div>
  </div>
);
