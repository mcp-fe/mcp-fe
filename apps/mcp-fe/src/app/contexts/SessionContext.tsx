import { createContext, useState, useEffect, ReactNode } from 'react';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';

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
  const [sessionUser, setSessionUser] = useState<string>(() => {
    return (
      localStorage.getItem('mcp_session_user') ||
      'user_' + Math.random().toString(36).substring(7)
    );
  });

  useEffect(() => {
    localStorage.setItem('mcp_session_user', sessionUser);
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
