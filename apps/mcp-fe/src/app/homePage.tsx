import { Link } from 'react-router-dom';

export const HomePage = () => (
  <div>
    <h2>Welcome to MCP Edge Demo</h2>
    <p>
      This is a demo application for the Model Context Protocol (MCP) on the frontend.
      Try interacting with the elements below and watch the <strong>Live Event Log</strong> in the sidebar.
    </p>

    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexDirection: 'column' }}>
      <div>
        <label htmlFor="demo-input">Type something to track input events: </label>
        <input id="demo-input" type="text" placeholder="Try typing here..." style={{ padding: '8px', width: '250px' }} />
      </div>

      <div>
        <button id="demo-button" style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Click Me (Tracked Button)
        </button>
      </div>

      <div>
        <Link to="/page-2">Go to Page 2 (Tracked Navigation)</Link>
      </div>
    </div>
  </div>
);
