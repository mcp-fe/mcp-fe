const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
const { join } = require('path');
const rspack = require('@rspack/core');

// Derive WebSocket URL from MCP_SERVER_URL if MCP_WS_URL is not explicitly set.
// e.g. http://myhost:3001 → ws://myhost:3001, https://myhost → wss://myhost
function deriveWsUrl(httpUrl) {
  return httpUrl.replace(/^http(s?):\/\//, (_, s) => `ws${s}://`);
}

const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const mcpWsUrl = process.env.MCP_WS_URL || deriveWsUrl(mcpServerUrl);
// Public-facing MCP URL shown to users (e.g. https://api.mcp-fe.ai). Falls back to mcpServerUrl.
const mcpPublicUrl = process.env.MCP_PUBLIC_URL || mcpServerUrl;

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/mcp-fe'),
    filename: (pathData) => {
      const name = pathData.chunk?.name;
      if (name === 'mcp-service-worker' || name === 'mcp-shared-worker') {
        return '[name].js';
      }
      return process.env['NODE_ENV'] === 'production'
        ? '[name].[contenthash].js'
        : '[name].js';
    },
  },
  entry: {
    main: './src/main.tsx',
    'mcp-service-worker': '../../libs/mcp-worker/src/mcp-service-worker.ts',
    'mcp-shared-worker': '../../libs/mcp-worker/src/mcp-shared-worker.ts',
  },
  devServer: {
    port: 4200,
    historyApiFallback: {
      index: '/index.html',
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    },
  },
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'development',
      ),
      'process.env.MCP_DEBUG': JSON.stringify(process.env.MCP_DEBUG || ''),
      'process.env.MCP_SERVER_URL': JSON.stringify(mcpServerUrl),
      'process.env.MCP_WS_URL': JSON.stringify(mcpWsUrl),
      'process.env.MCP_BUILD_ID': JSON.stringify(Date.now().toString()),
      'process.env.MCP_PUBLIC_URL': JSON.stringify(mcpPublicUrl),
    }),
    new NxAppRspackPlugin({
      tsConfig: './tsconfig.app.json',
      main: './src/main.tsx',
      index: './src/index.html',
      baseHref: '/',
      assets: ['./src/assets'],
      styles: ['./src/styles.scss'],
      outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
      optimization: process.env['NODE_ENV'] === 'production',
      runtimeChunk: false,
      excludeChunks: ['sw', 'shared-worker'],
    }),
    new NxReactRspackPlugin({
      // Uncomment this line if you don't want to use SVGR
      // See: https://react-svgr.com/
      // svgr: false
    }),
  ],
};
