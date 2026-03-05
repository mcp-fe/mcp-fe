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
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('jwtTokenMock');
  });
  const [sessionUser, setSessionUser] = useState<string>(() => {
    return (
      localStorage.getItem('mcp_session_user') ||
      'user_' + Math.random().toString(36).substring(7)
    );
  });

  useEffect(() => {
    localStorage.setItem('mcp_session_user', sessionUser);
    fetchToken(sessionUser)
      .then((jwt) => {
        localStorage.setItem('jwtTokenMock', jwt);
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
