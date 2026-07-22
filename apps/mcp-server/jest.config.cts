module.exports = {
  displayName: 'mcp-server',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  // `jose` ships ESM-only; let ts-jest transpile it too instead of leaving it
  // in the default node_modules ignore list (which would fail on `export`).
  // pnpm nests the real file under node_modules/.pnpm/jose@<ver>/node_modules/jose/,
  // so a simple "not immediately followed by jose/" lookahead isn't enough.
  transformIgnorePatterns: ['node_modules/(?!.*jose)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/mcp-server',
};
