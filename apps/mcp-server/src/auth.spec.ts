/**
 * auth.ts derives AUTH_MODE (and keycloak/local config) from process.env at module load
 * time, so each mode under test needs its own fresh module instance. We flip env vars and
 * `jest.resetModules()` before each `require('./auth')` rather than using the static import.
 */

type AuthModule = typeof import('./auth');

describe('auth.ts', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.dontMock('jose');
    jest.resetModules();
  });

  describe('demo mode', () => {
    function loadDemoAuth(): AuthModule {
      process.env = { ...ORIGINAL_ENV, AUTH_MODE: 'demo' };
      jest.resetModules();
      return require('./auth');
    }

    it('accepts a non-empty (>= 8 char) token as the session id, as-is', async () => {
      const auth = loadDemoAuth();
      await expect(auth.verifyToken('mysession123')).resolves.toBe(
        'mysession123',
      );
    });

    it('rejects tokens shorter than 8 characters', async () => {
      const auth = loadDemoAuth();
      await expect(auth.verifyToken('short')).resolves.toBeNull();
    });

    it('rejects null/undefined tokens', async () => {
      const auth = loadDemoAuth();
      await expect(auth.verifyToken(null)).resolves.toBeNull();
      await expect(auth.verifyToken(undefined)).resolves.toBeNull();
    });

    it('accepts an array-form token header, using the first element', async () => {
      const auth = loadDemoAuth();
      await expect(
        auth.verifyToken(['mysession123', 'ignored']),
      ).resolves.toBe('mysession123');
    });

    it('issueToken throws — only available in local mode', async () => {
      const auth = loadDemoAuth();
      await expect(auth.issueToken('user')).rejects.toThrow(
        'only available in local auth mode',
      );
    });
  });

  describe('local mode', () => {
    function loadLocalAuth(secret?: string): AuthModule {
      process.env = { ...ORIGINAL_ENV, AUTH_MODE: 'local' };
      if (secret) {
        process.env.JWT_SECRET = secret;
      } else {
        delete process.env.JWT_SECRET;
      }
      jest.resetModules();
      return require('./auth');
    }

    it('round-trips: a token from issueToken is accepted and returns the sub claim', async () => {
      const auth = loadLocalAuth('test-secret-value');
      const token = await auth.issueToken('user-42');
      await expect(auth.verifyToken(token)).resolves.toBe('user-42');
    });

    it('rejects a token signed with a different secret', async () => {
      const authA = loadLocalAuth('secret-a');
      const token = await authA.issueToken('user-1');

      const authB = loadLocalAuth('secret-b');
      await expect(authB.verifyToken(token)).resolves.toBeNull();
    });

    it('rejects malformed (non-JWT) tokens', async () => {
      const auth = loadLocalAuth('test-secret-value');
      await expect(auth.verifyToken('not-a-jwt')).resolves.toBeNull();
    });

    it('rejects an expired token', async () => {
      const auth = loadLocalAuth('test-secret-value');
      const { SignJWT } = require('jose');
      const key = new TextEncoder().encode('test-secret-value');
      const expiredToken = await new SignJWT({ sub: 'user-1' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
        .sign(key);

      await expect(auth.verifyToken(expiredToken)).resolves.toBeNull();
    });

    it('rejects a token with no sub claim', async () => {
      const auth = loadLocalAuth('test-secret-value');
      const { SignJWT } = require('jose');
      const key = new TextEncoder().encode('test-secret-value');
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(key);

      await expect(auth.verifyToken(token)).resolves.toBeNull();
    });

    it('throws at module load when NODE_ENV=production and JWT_SECRET is unset', () => {
      process.env = {
        ...ORIGINAL_ENV,
        AUTH_MODE: 'local',
        NODE_ENV: 'production',
      };
      delete process.env.JWT_SECRET;
      jest.resetModules();

      expect(() => require('./auth')).toThrow(
        'JWT_SECRET must be set in production',
      );
    });
  });

  describe('keycloak mode', () => {
    it('throws at module load when KEYCLOAK_JWKS_URI is missing', () => {
      process.env = { ...ORIGINAL_ENV, AUTH_MODE: 'keycloak' };
      delete process.env.KEYCLOAK_JWKS_URI;
      process.env.KEYCLOAK_ISSUER = 'https://issuer.example.com';
      jest.resetModules();

      expect(() => require('./auth')).toThrow(
        'KEYCLOAK_JWKS_URI is required',
      );
    });

    it('throws at module load when KEYCLOAK_ISSUER is missing', () => {
      process.env = { ...ORIGINAL_ENV, AUTH_MODE: 'keycloak' };
      process.env.KEYCLOAK_JWKS_URI = 'https://issuer.example.com/jwks';
      delete process.env.KEYCLOAK_ISSUER;
      jest.resetModules();

      expect(() => require('./auth')).toThrow('KEYCLOAK_ISSUER is required');
    });

    it('verifies a token via JWKS, passing issuer/audience, and returns the sub claim', async () => {
      process.env = {
        ...ORIGINAL_ENV,
        AUTH_MODE: 'keycloak',
        KEYCLOAK_JWKS_URI: 'https://issuer.example.com/jwks',
        KEYCLOAK_ISSUER: 'https://issuer.example.com',
        KEYCLOAK_AUDIENCE: 'my-audience',
      };
      jest.resetModules();

      const mockJwtVerify = jest
        .fn()
        .mockResolvedValue({ payload: { sub: 'kc-user-1' } });
      jest.doMock('jose', () => ({
        ...jest.requireActual('jose'),
        jwtVerify: mockJwtVerify,
        createRemoteJWKSet: jest.fn().mockReturnValue('fake-jwks'),
      }));

      const auth: AuthModule = require('./auth');
      await expect(auth.verifyToken('some.jwt.token')).resolves.toBe(
        'kc-user-1',
      );

      expect(mockJwtVerify).toHaveBeenCalledWith(
        'some.jwt.token',
        'fake-jwks',
        { issuer: 'https://issuer.example.com', audience: 'my-audience' },
      );
    });

    it('omits the audience check when KEYCLOAK_AUDIENCE is unset', async () => {
      process.env = {
        ...ORIGINAL_ENV,
        AUTH_MODE: 'keycloak',
        KEYCLOAK_JWKS_URI: 'https://issuer.example.com/jwks',
        KEYCLOAK_ISSUER: 'https://issuer.example.com',
      };
      delete process.env.KEYCLOAK_AUDIENCE;
      jest.resetModules();

      const mockJwtVerify = jest
        .fn()
        .mockResolvedValue({ payload: { sub: 'kc-user-1' } });
      jest.doMock('jose', () => ({
        ...jest.requireActual('jose'),
        jwtVerify: mockJwtVerify,
        createRemoteJWKSet: jest.fn().mockReturnValue('fake-jwks'),
      }));

      const auth: AuthModule = require('./auth');
      await auth.verifyToken('some.jwt.token');

      expect(mockJwtVerify).toHaveBeenCalledWith(
        'some.jwt.token',
        'fake-jwks',
        { issuer: 'https://issuer.example.com' },
      );
    });

    it('rejects when jwtVerify throws (invalid signature/issuer)', async () => {
      process.env = {
        ...ORIGINAL_ENV,
        AUTH_MODE: 'keycloak',
        KEYCLOAK_JWKS_URI: 'https://issuer.example.com/jwks',
        KEYCLOAK_ISSUER: 'https://issuer.example.com',
      };
      jest.resetModules();
      jest.doMock('jose', () => ({
        ...jest.requireActual('jose'),
        jwtVerify: jest
          .fn()
          .mockRejectedValue(new Error('signature verification failed')),
        createRemoteJWKSet: jest.fn().mockReturnValue('fake-jwks'),
      }));

      const auth: AuthModule = require('./auth');
      await expect(auth.verifyToken('bad.jwt.token')).resolves.toBeNull();
    });

    it('rejects a token missing the sub claim', async () => {
      process.env = {
        ...ORIGINAL_ENV,
        AUTH_MODE: 'keycloak',
        KEYCLOAK_JWKS_URI: 'https://issuer.example.com/jwks',
        KEYCLOAK_ISSUER: 'https://issuer.example.com',
      };
      jest.resetModules();
      jest.doMock('jose', () => ({
        ...jest.requireActual('jose'),
        jwtVerify: jest.fn().mockResolvedValue({ payload: {} }),
        createRemoteJWKSet: jest.fn().mockReturnValue('fake-jwks'),
      }));

      const auth: AuthModule = require('./auth');
      await expect(auth.verifyToken('some.jwt.token')).resolves.toBeNull();
    });

    it('issueToken throws — only available in local mode', async () => {
      process.env = {
        ...ORIGINAL_ENV,
        AUTH_MODE: 'keycloak',
        KEYCLOAK_JWKS_URI: 'https://issuer.example.com/jwks',
        KEYCLOAK_ISSUER: 'https://issuer.example.com',
      };
      jest.resetModules();

      const auth: AuthModule = require('./auth');
      await expect(auth.issueToken('user')).rejects.toThrow(
        'only available in local auth mode',
      );
    });
  });
});
