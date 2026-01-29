# MCP-FE (Model Context Protocol - Frontend Edge)

**MCP-FE** is an architectural pattern that turns the browser into an active, queryable node in the MCP ecosystem. It bridges the gap between AI Agents (like Claude or Cursor) and the real-time state of your frontend application.
## Why MCP-FE?
Traditional AI agents are "runtime blind". They know your code, but they don't know the current value of a specific input, the state of a Redux store, or the exact sequence of clicks that led to an error. 

MCP-FE solves this by exposing the **Browser Runtime** as a first-class MCP Server.

---

## Overview

Traditional MCP integrations are backend-centric. Frontend applications typically push events continuously (analytics-style), regardless of whether an AI agent actually needs the data.

This pattern inverts the flow:

- The frontend **does not push context automatically** to the server.
- A browser-resident worker (SharedWorker or ServiceWorker) acts as a local MCP server, collecting and storing UI events in IndexedDB.
- A **Node.js MCP Proxy** maintains a WebSocket connection to the worker and exposes MCP tools to remote agents.
- The MCP server **pulls context only when an agent calls a tool**.
- AI agents interact with standard MCP tools (e.g., `get_user_events`) to retrieve what they need.

---

## Architecture

![Architecture](./MCP-FE-architecture-diagram.png?raw=true "MCP FE architecture diagram")

1. **Frontend App**: Tracks user interactions using the `event-tracker` library and posts events to the worker client.
2. **Browser Worker (MCP Worker)**: 
   - Implements MCP server endpoints in web worker, stores events in IndexedDB, and maintains a WebSocket transport layer to the MCP proxy server.
   - Using `SharedWorker` fall back to a `ServiceWorker` when `SharedWorker` is unavailable.
3. **Node.js MCP Proxy**:
   - Acts as a proxy between AI Agents and the browser MCP worker.
   - Allows the client MCP tools to be registered and called remotely.
   - Routes tool calls over a WebSocket to the worker and routes responses back to the agent.
4. **AI Agent**: Uses standard MCP clients to discover and call tools.

---

## Key Concepts


### MCP workers: SharedWorker vs ServiceWorker

- SharedWorker (preferred):
  - One shared instance is available to all same-origin windows/iframes.
  - Good for multi-tab apps and when you want a single MCP edge connection per browser.

- ServiceWorker (fallback):
  - Runs in background, lifecycle managed by browser.
  - Can be used as a fallback when SharedWorker is not supported.

`WorkerClient` in this repo prefers SharedWorker and automatically falls back to ServiceWorker. It also supports passing an explicit `ServiceWorkerRegistration` to use a previously registered service worker.

### Worker as MCP Edge Server

The Shared/Service Worker acts as a lightweight **edge node** enables you to:

* **Collects** UI-level events history (navigation, interactions, errors).
* **Queries** live application state (e.g., Redux, Zustand, or simple DOM state) in real-time.
* **Exposes** data through MCP Tools.
* **Maintains** a persistent WebSocket connection to the proxy.


### Server-Driven Pull Model (MCP Tools)

The MCP Worker **never sends data proactively to the backend**. Context is shared **only** when an AI agent explicitly requests it by calling a tool.

Example **tool call** from the agent (via MCP Server Proxy):

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "get_user_events",
    "arguments": {
      "type": "click",
      "limit": 5
    }
  }
}
```

MCP Worker **response**:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"type\":\"click\",\"element\":\"button\",\"elementText\":\"Submit\",\"timestamp\":1705712400000}]"
      }
    ]
  }
}
```

---

## Use Cases

- **Context-Aware Support**: Customer support agents can query the user's current UI state and recent interactions to provide instant help.
- **Agentic Debugging**: Ask the agent "Why is the submit button disabled?" and it inspects the live React state to tell you.
- **Dynamic Onboarding**: AI guides users through complex workflows based on their real-time progress and errors.


---

## Using MCP-FE in Your Applications

MCP-FE is available as a set of NPM packages that you can integrate into your existing applications:

### Core Package: `@mcp-fe/mcp-worker`

The main package that provides the MCP Worker client and ready-to-use worker scripts. This package handles the core functionality of running MCP server endpoints in the browser and maintaining connections to the backend.

**Installation:**
```bash
npm install @mcp-fe/mcp-worker
# or
pnpm add @mcp-fe/mcp-worker
```

**Key Features:**
- Browser-based MCP server implementation using SharedWorker (with ServiceWorker fallback)
- WebSocket transport layer for connecting to MCP proxy servers
- IndexedDB storage for UI events and application state
- Automatic worker lifecycle management

For detailed usage instructions, see the [full documentation in the package README](./libs/mcp-worker/README.md).

**Quick Example:**
```typescript
import { workerClient } from '@mcp-fe/mcp-worker';

// Initialize the worker
await workerClient.init({
  backendWsUrl: 'ws://localhost:3001'
});

// Send events to the worker
await workerClient.post('STORE_EVENT', { 
  event: { type: 'click', element: 'button' }
});
```

### Event Tracking: `@mcp-fe/event-tracker`

A framework-agnostic event tracking library that provides a simple API for collecting user interactions and sending them to the MCP worker.

**Installation:**
```bash
npm install @mcp-fe/event-tracker
```

**Features:**
- Simple API for tracking navigation, clicks, input changes, and custom events
- Automatic event timestamping
- Connection status monitoring
- Prepared to be used with `@mcp-fe/mcp-worker`

**Example:**
```typescript
import { initEventTracker, trackEvent } from '@mcp-fe/event-tracker';

// Initialize
await initEventTracker();

// Track user interactions
await trackEvent({
  type: 'click',
  element: 'button',
  elementText: 'Submit',
  metadata: { formId: 'login-form' }
});
```

### React Integration: `@mcp-fe/react-event-tracker`

React-specific hooks that automatically track navigation and user interactions with minimal setup.

**Installation:**
```bash
npm install @mcp-fe/react-event-tracker
```

**Features:**
- Automatic navigation tracking for React Router and TanStack Router
- Automatic click and input event tracking
- React hooks for easy integration
- Built-in connection status management

**React Router Example:**
```typescript
import { useEffect } from 'react';
import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';

function App() {
  const { setAuthToken } = useReactRouterEventTracker({
    backendWsUrl: 'ws://localhost:3001'
  });

  // Set authentication token when available
  useEffect(() => {
    // Get token from your auth system (localStorage, context, etc.)
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuthToken(token);
    }
  }, [setAuthToken]);

  // The hook automatically tracks navigation, clicks, and input changes
  // No additional setup required!
  
  return (
    // Your app components here
    <div>Your App</div>
  );
}
```

**TanStack Router Example:**
```typescript
import { useEffect } from 'react';
import { useTanstackRouterEventTracker } from '@mcp-fe/react-event-tracker';

function App() {
  const { setAuthToken } = useTanstackRouterEventTracker();
  
  // Set authentication token when available
  useEffect(() => {
    // Get token from your auth system (localStorage, context, etc.)
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuthToken(token);
    }
  }, [setAuthToken]);
  
  return (
    // Your app components here  
    <div>Your App</div>
  );
}
```

### Integration Steps

1. **Install the packages** you need based on your framework
2. **Copy worker files** to your public directory (from `@mcp-fe/mcp-worker`)
3. **Initialize event tracking** in your application entry point
4. **Set up your MCP proxy server** to connect AI agents
5. **Configure authentication** if needed using `setAuthToken()`

The packages work together to provide a complete MCP-FE integration with minimal boilerplate code.


---


## Quick start (development)

1) Install dependencies

```bash
pnpm install
```

### 2. Start the MCP Proxy (Server) and example MCP Frontend App
```bash
pnpm start
```

### 3. Open the Frontend App in your browser
Navigate to `http://localhost:4200` (or the port shown in your terminal)

The Worker will automatically register and connect to the proxy server.

### 4. Connect an AI Agent
Connect your favorite MCP-compatible AI agent to the MCP Proxy server at `http://localhost:3001/mcp` 

---

## Summary

This pattern introduces a **Worker–based MCP edge server** that enables:

* server-driven context access,
* minimal frontend-to-server traffic,
* clean separation between UI, transport, and agent logic.

It represents a **new architectural application of Model Context Protocol on the frontend**, not a new protocol.

---

*Feedback and discussion are welcome. This pattern is in early stage and not all features are fully implemented yet.*

---

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

---

