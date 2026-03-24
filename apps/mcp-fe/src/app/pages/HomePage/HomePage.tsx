import { Link } from 'react-router-dom';
import { Onboarding } from './Onboarding';
import styles from './HomePage.module.scss';

export const HomePage = () => (
  <div>
    <h1>MCP-FE — Frontend Edge for AI Agents</h1>
    <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
      Turn your browser into an active, queryable node in the MCP ecosystem.
      Create a <strong>bidirectional bridge</strong> between AI Agents and your
      frontend - agents can read component state, send data to components, and
      you can register custom tools directly from React components.
    </p>

    <Onboarding />

    <div className={styles.featureHighlight}>
      <h3>🤖 Why MCP-FE?</h3>
      <p>
        Traditional AI agents are <strong>"runtime blind"</strong>. They know
        your code, communicates with your server, but they can't:
      </p>
      <ul>
        <li>Read the current value of a specific input field</li>
        <li>Access the browsing history or event sequences</li>
        <li>Send data back to update your UI components</li>
        <li>Interact with custom tools you define in your components</li>
      </ul>
      <p>
        <strong>MCP-FE solves this</strong> by exposing the{' '}
        <strong>Browser Runtime</strong> as a first-class MCP Server with{' '}
        <strong>bidirectional communication</strong> - agents can both read and
        write to your application state.
      </p>
    </div>

    <div style={{ marginBottom: '2rem' }}>
      <h3>✨ Key Features</h3>
      <div className={styles.featureGrid}>
        <div className={styles.featureItem}>
          <h4>🔧 Custom Tools</h4>
          <p>
            Register custom MCP tools directly from React components using{' '}
            <code>@mcp-fe/react-tools</code>.
          </p>
        </div>
        <div className={styles.featureItem}>
          <h4>📖 State Reading</h4>
          <p>
            AI agents can read the current state of your components in
            real-time.
          </p>
        </div>
        <div className={styles.featureItem}>
          <h4>📝 State Writing</h4>
          <p>
            Agents can send data directly to your components to update their
            state.
          </p>
        </div>
        <div className={styles.featureItem}>
          <h4>📊 Auto Event Tracking</h4>
          <p>
            Automatic tracking of user interactions with{' '}
            <code>@mcp-fe/react-event-tracker</code>.
          </p>
        </div>
        <div className={styles.featureItem}>
          <h4>🔒 Privacy-First</h4>
          <p>
            Data never leaves your browser unless an AI agent explicitly
            requests it.
          </p>
        </div>
        <div className={styles.featureItem}>
          <h4>⚡ Edge Architecture</h4>
          <p>
            SharedWorker/ServiceWorker acts as a local MCP server in your
            browser.
          </p>
        </div>
      </div>
    </div>

    <div className={styles.useCases}>
      <h3>💡 Use Cases</h3>
      <ul>
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
        <li>
          <strong>Custom Tools Integration:</strong> Register domain-specific
          tools directly in components (e.g., "calculate shipping cost",
          "validate order")
        </li>
        <li>
          <strong>Agent-Driven UI Updates:</strong> Let AI agents populate
          forms, update dashboards, or trigger actions based on user queries
        </li>
        <li>
          <strong>Component State Queries:</strong> Agents can ask "What items
          are in the shopping cart?" and get real-time answers
        </li>
      </ul>
      <p>
        Want to learn more about the architecture?{' '}
        <Link to="/how-it-works" style={{ fontWeight: 'bold' }}>
          See How It Works →
        </Link>
      </p>
    </div>

    <div className={styles.demoSections}>
      <h3>🚀 Try the Interactive Demo</h3>
      <p>
        Explore different pages to see how user interactions are automatically
        tracked and stored locally in IndexedDB. Watch the{' '}
        <strong>Live Event Log</strong> in the sidebar to see how the events are
        stored in real-time!
      </p>
      <div className={styles.demoGrid}>
        <div className={styles.demoCard}>
          <h4>🧭 Navigation</h4>
          <p>Various navigation patterns and automatic route tracking</p>
          <Link to="/navigation" className={styles.demoLink}>
            Try Navigation →
          </Link>
        </div>

        <div className={styles.demoCard}>
          <h4>📝 Forms Demo</h4>
          <p>
            Complex forms with validation - perfect for tracking user input
            patterns
          </p>
          <Link to="/forms" className={styles.demoLink}>
            Try Forms →
          </Link>
        </div>

        <div className={styles.demoCard}>
          <h4>📋 Data Table</h4>
          <p>Sortable, filterable data table with bulk operations</p>
          <Link to="/data-table" className={styles.demoLink}>
            Try Data Table →
          </Link>
        </div>
      </div>
    </div>

    <div className={styles.gettingStarted}>
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
          href="https://www.npmjs.com/package/@mcp-fe/react-tools"
          target="_blank"
          rel="noopener noreferrer"
        >
          @mcp-fe/react-tools
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
