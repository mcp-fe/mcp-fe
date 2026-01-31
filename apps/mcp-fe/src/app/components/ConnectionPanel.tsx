import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { useSessionManager } from '../hooks/useSessionManager';
import styles from './ConnectionPanel.module.scss';

interface ConnectionPanelProps {
  onShowInstructions: () => void;
}

export function ConnectionPanel({ onShowInstructions }: ConnectionPanelProps) {
  const { sessionUser, setSessionUser } = useSessionManager();
  const isConnected = useConnectionStatus();

  return (
    <div className={styles.connectionPanel}>
      <div className={styles.container}>
        <div className={styles.sessionInfo}>
          <label>Session User:</label>
          <input
            value={sessionUser}
            onChange={(e) => setSessionUser(e.target.value)}
          />
        </div>
        <div
          className={`${styles.statusBadge} ${isConnected ? styles.connected : styles.disconnected}`}
        >
          <span className={styles.dot}></span>
          <span>
            {isConnected
              ? 'Connected to MCP Proxy'
              : 'Disconnected from MCP Proxy'}
          </span>
        </div>
        <button className={styles.connectButton} onClick={onShowInstructions}>
          <span role="img" aria-label="robot">
            🤖
          </span>{' '}
          Connect AI Agent
        </button>
      </div>
    </div>
  );
}
