import { createContext, useState, useEffect, ReactNode } from 'react';
import { SignJWT } from 'jose';

// Shared secret key (must match server's SECRET_KEY in auth.ts)
const SECRET_KEY = new TextEncoder().encode(
  'mcp-mock-secret-key-do-not-use-in-production',
);

/**
 * Creates a properly signed mock JWT token with the given sessionId
 * Uses HS256 signature algorithm with a shared secret key
 * This is for development/demo purposes only
 */
async function createMockJWT(sessionId: string): Promise<string> {
  return await new SignJWT({
    sub: sessionId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET_KEY);
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
    // Create mock JWT token client-side asynchronously
    createMockJWT(sessionUser)
      .then((mockJwt) => {
        localStorage.setItem('jwtTokenMock', mockJwt);
        setToken(mockJwt);
      })
      .catch((err) => {
        console.error('Failed to create JWT token:', err);
      });
  }, [sessionUser]);

  return (
    <SessionContext.Provider value={{ sessionUser, setSessionUser, token }}>
      {children}
    </SessionContext.Provider>
  );
}
