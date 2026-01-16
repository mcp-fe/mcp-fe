# Frontend MCP Edge (Service Worker Pattern)

This repository documents an architectural pattern for using **Model Context Protocol (MCP)** on the frontend by introducing a **Service Worker–based MCP edge node**.

The goal is to enable **server-driven access to frontend context** without continuous event streaming or tight coupling between the frontend and AI agents.

---

## Overview

Traditional MCP integrations are backend-centric. Frontend applications typically push events continuously (analytics-style), regardless of whether an AI agent actually needs the data.

This pattern inverts the flow:

* The frontend **does not push context automatically**
* A Service Worker maintains **session-scoped UI context**
* The MCP server **pulls context only when needed**
* AI agents receive context exclusively through the MCP server

---

## Architecture


![Architecture](./MCP-FE-architecture-diagram.png?raw=true "MCP FE architecture diagram")


---

## Key Concepts

### 1. Service Worker as MCP Edge

The Service Worker acts as a lightweight **edge node**:

* collects UI-level events (navigation, interactions, errors),
* stores a short-lived, in-memory session context,
* maintains a persistent WebSocket connection to the MCP server,
* responds to explicit context requests.

It is **not**:

* a server,
* an authority,
* a persistence layer.

---

### 2. Server-Driven Pull Model

The Service Worker never sends data proactively.

Context is shared **only** when the MCP server requests it.

Example request from MCP server:

```json
{
  "type": "request_context",
  "fields": ["route", "recent_events"]
}
```

Service Worker response:

```json
{
  "type": "context_response",
  "context": {
    "route": "/checkout",
    "recent_events": ["submit", "validation_error"]
  }
}
```

---

### 3. Clear Separation of Concerns

| Component      | Responsibility                        |
| -------------- | ------------------------------------- |
| Frontend App   | Emit UI events only                   |
| Service Worker | Session context + transport           |
| MCP Server     | Authority, orchestration, agent calls |
| AI Agent       | Consume context, generate responses   |

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
* Command channels (server → Service Worker → UI)

---

## Summary

This pattern introduces a **Service Worker–based MCP edge** that enables:

* server-driven context access,
* minimal frontend-to-server traffic,
* clean separation between UI, transport, and agent logic.

It represents a **new architectural application of Model Context Protocol on the frontend**, not a new protocol.

---

*Feedback and discussion are welcome. This pattern is intentionally minimal and designed to evolve.*
