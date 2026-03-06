import { useState, useEffect } from 'react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { useSessionManager } from '../hooks/useSessionManager';
import styles from './ConnectionPanel.module.scss';

const MCP_PUBLIC_URL = process.env.MCP_PUBLIC_URL || 'http://localhost:3001';

interface ConnectionPanelProps {
  onShowInstructions: () => void;
}

export function ConnectionPanel({ onShowInstructions }: ConnectionPanelProps) {
  const { sessionUser, setSessionUser } = useSessionManager();
  const isConnected = useConnectionStatus();
  const [localUsername, setLocalUsername] = useState(sessionUser);
  const [copied, setCopied] = useState(false);

  const mcpUrl = `${MCP_PUBLIC_URL}/mcp?token=${encodeURIComponent(sessionUser)}`;

  // Sync local state when sessionUser changes from outside
  useEffect(() => {
    setLocalUsername(sessionUser);
  }, [sessionUser]);

  // Debounce updates to session user
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localUsername !== sessionUser) {
        setSessionUser(localUsername);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localUsername, sessionUser, setSessionUser]);

  function handleCopy() {
    navigator.clipboard.writeText(mcpUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={styles.connectionPanel}>
      <div className={styles.container}>
        <div className={styles.sessionInfo}>
          <label>Session User:</label>
          <input
            value={localUsername}
            onChange={(e) => setLocalUsername(e.target.value)}
          />
        </div>
        <div className={styles.mcpUrl}>
          <label>MCP Server URL:</label>
          <div className={styles.mcpUrlRow}>
            <input readOnly value={mcpUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button className={styles.copyButton} onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className={styles.mcpUrlWarning}>
            Keep this URL private — anyone with it can control your session.
          </p>
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
