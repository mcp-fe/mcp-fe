import { createContext, useState, useEffect, ReactNode } from 'react';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function getOrCreateSessionUser(): string {
  const stored = localStorage.getItem('mcp_session_user');
  const createdAt = parseInt(localStorage.getItem('mcp_session_user_created_at') || '0', 10);
  const isExpired = !createdAt || Date.now() - createdAt > TOKEN_MAX_AGE_MS;

  if (stored && !isExpired) {
    return stored;
  }

  const newId = crypto.randomUUID();
  localStorage.setItem('mcp_session_user', newId);
  localStorage.setItem('mcp_session_user_created_at', Date.now().toString());
  return newId;
}

async function fetchToken(sessionUser: string): Promise<string> {
  const res = await fetch(`${MCP_SERVER_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionUser }),
  });
  if (!res.ok) throw new Error(`Failed to obtain token: ${res.status}`);
  const data = await res.json();
  return data.token as string;
}

interface SessionContextType {
  sessionUser: string;
  setSessionUser: (user: string) => void;
  token: string | null;
}

export const SessionContext = createContext<SessionContextType | undefined>(
  undefined,
);

export type { SessionContextType };

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  // Always start with null — a fresh token is fetched from the server in the
  // effect below. Using a cached token from localStorage risks sending an
  // expired or client-signed token before the server issues a valid one.
  const [token, setToken] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<string>(getOrCreateSessionUser);

  useEffect(() => {
    localStorage.setItem('mcp_session_user', sessionUser);
    localStorage.setItem('mcp_session_user_created_at', Date.now().toString());
    localStorage.removeItem('jwtTokenMock'); // remove any stale cached token
    fetchToken(sessionUser)
      .then((jwt) => {
        setToken(jwt);
      })
      .catch((err) => {
        console.error('Failed to obtain token from server:', err);
      });
  }, [sessionUser]);

  return (
    <SessionContext.Provider value={{ sessionUser, setSessionUser, token }}>
      {children}
    </SessionContext.Provider>
  );
}
