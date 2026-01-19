# Frontend MCP Edge (Service Worker Pattern)

This repository documents an architectural pattern for using **Model Context Protocol (MCP)** on the frontend by introducing a **Service Worker–based MCP edge node** and a **Node.js proxy**.

The goal is to enable **server-driven access to frontend context** (navigation, user interactions, application state) without continuous event streaming or tight coupling between the frontend and AI agents.

---

## Overview

Traditional MCP integrations are backend-centric. Frontend applications typically push events continuously (analytics-style), regardless of whether an AI agent actually needs the data.

This pattern inverts the flow:

* The frontend **does not push context automatically** to the server.
* A **Service Worker** acts as a local MCP server, collecting and storing UI events in IndexedDB.
* a **Node.js MCP Server** acts as a proxy, maintaining a WebSocket connection to the Service Worker.
* The MCP server **pulls context only when an agent calls a tool**.
* AI agents interact with standard MCP tools (e.g., `get_user_events`) to retrieve what they need.

---

## Architecture

![Architecture](./MCP-FE-architecture-diagram.png?raw=true "MCP FE architecture diagram")

1. **Frontend App**: Tracks user interactions using the `event-tracker` library and sends them to the Service Worker.
2. **Service Worker MCP server (MCP Edge)**: 
    * Implements a full MCP server using `@modelcontextprotocol/sdk`.
    * Stores events in IndexedDB for session-scoped persistence.
    * Connects to the backend via WebSocket.
3. **Node.js MCP Server (MCP Proxy)**:
    * Acts as a proxy between the AI Agent and the Service Worker.
    * Exposes the Service Worker's tools to the agent.
    * Routes tool calls through the WebSocket connection to the browser.
4. **AI Agent**: Uses standard MCP clients to discover and call tools.

---

## Key Concepts

### 1. Service Worker as MCP Edge

The Service Worker acts as a lightweight **edge node**:

* **Collects** UI-level events (navigation, interactions, errors).
* **Stores** them in a local database (IndexedDB).
* **Exposes** data through MCP Tools.
* **Maintains** a persistent WebSocket connection to the proxy.

---

### 2. Server-Driven Pull Model (MCP Tools)

The Service Worker **never sends data proactively to the backend**. Context is shared **only** when an AI agent explicitly requests it by calling a tool.

Example **tool call** from the agent (via Proxy):

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

Service Worker **response**:

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

### 3. Clear Separation of Concerns

| Component      | Responsibility                            |
| -------------- | ----------------------------------------- |
| Frontend App   | Emit UI events via `trackEvent`           |
| Service Worker | Local MCP Server + IndexedDB + WebSocket  |
| Node.js Proxy | Proxy MCP requests to the Service Worker  |
| AI Agent       | Call MCP tools to retrieve context        |

The frontend never communicates directly with the agent.

---

## Why This Pattern Exists

### Problems with push-based frontend context

* unnecessary network traffic,
* implicit and uncontrolled context sharing,
* analytics-style data flow,
* tight coupling between frontend and agent logic.

### What this pattern improves

* context is shared intentionally, not continuously,
* lower bandwidth usage,
* better privacy and control,
* frontend remains agent-agnostic,
* compatible with existing MCP servers and SDKs.

---

## What This Is (and Is Not)

### This **is**

* a frontend architectural pattern,
* a new way to apply MCP at the UI edge,
* compatible with existing MCP implementations,
* suitable for interactive, session-based AI agents.

### This is **not**

* a new protocol,
* a replacement for MCP,
* an analytics framework,
* a guaranteed delivery or persistence mechanism.

---

## Lifecycle Notes

* Service Worker lifecycle is not guaranteed.
* WebSocket connections may drop at any time.
* Missing context is a valid and expected state.
* MCP server must tolerate partial or empty responses.

This pattern favors **graceful degradation** over reliability guarantees.

---

## Use Cases

* AI assistants embedded in complex web UIs
* Agent-driven UI inspection or debugging
* Context-aware copilots with minimal data exposure
* Short-lived, interactive user sessions

---

## Non-Goals

* Long-term session memory
* Event analytics or tracking
* Real-time streaming of UI events
* Agent execution inside the browser

---

## Future Directions

* Standardizing frontend MCP edge capabilities
* Optional persistence strategies
* Multi-agent orchestration
* Command channels (Proxy → Service Worker → UI via `postMessage`)

---

## Getting Started

### 1. Install dependencies
```bash
pnpm install
```

### 2. Start the MCP Proxy (Server)
```bash
npx nx serve mcp-server
```

### 3. Start the Frontend App
```bash
npx nx serve mcp-fe
```

The Service Worker will automatically register and connect to the proxy.

---

## Summary

This pattern introduces a **Service Worker–based MCP edge** that enables:

* server-driven context access,
* minimal frontend-to-server traffic,
* clean separation between UI, transport, and agent logic.

It represents a **new architectural application of Model Context Protocol on the frontend**, not a new protocol.

---

*Feedback and discussion are welcome. This pattern is intentionally minimal and designed to evolve.*
