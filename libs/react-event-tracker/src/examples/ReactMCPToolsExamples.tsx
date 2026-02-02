/**
 * Praktický příklad použití React MCP Tools hooks
 * Demonstruje různé use-cases a patterns
 */

import React, { useState } from 'react';
import {
  useMCPTool,
  useMCPGetter,
  useMCPAction,
  MCPToolsProvider,
  useMCPToolsContext,
} from '@mcp-fe/react-event-tracker';

// =============================================================================
// Příklad 1: Jednoduchý getter tool
// =============================================================================

function UserProfileComponent() {
  const [user] = useState({
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
  });

  // Jednoduchý getter - automaticky se registruje/odregistruje
  useMCPGetter(
    'get_user_profile',
    'Get current user profile information',
    () => ({
      user,
      timestamp: Date.now(),
    }),
  );

  return (
    <div>
      <h3>User Profile</h3>
      <p>Name: {user.name}</p>
      <p>Email: {user.email}</p>
      <p>✅ Tool 'get_user_profile' is registered</p>
    </div>
  );
}

// =============================================================================
// Příklad 2: Action tool s state updates
// =============================================================================

function TodoListComponent() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Learn MCP', done: false },
    { id: 2, text: 'Build tools', done: false },
  ]);

  // List todos
  useMCPGetter('list_todos', 'Get all todos', () => todos);

  // Add todo
  useMCPAction(
    'add_todo',
    'Add a new todo item',
    {
      text: { type: 'string', description: 'Todo text' },
    },
    async (args: { text: string }) => {
      const newTodo = {
        id: Date.now(),
        text: args.text,
        done: false,
      };
      setTodos([...todos, newTodo]);
      return { success: true, todo: newTodo };
    },
  );

  // Toggle todo
  useMCPAction(
    'toggle_todo',
    'Mark todo as done/undone',
    {
      id: { type: 'number', description: 'Todo ID' },
    },
    async (args: { id: number }) => {
      setTodos(
        todos.map((t) => (t.id === args.id ? { ...t, done: !t.done } : t)),
      );
      return { success: true };
    },
  );

  // Delete todo
  useMCPAction(
    'delete_todo',
    'Delete a todo item',
    {
      id: { type: 'number', description: 'Todo ID' },
    },
    async (args: { id: number }) => {
      setTodos(todos.filter((t) => t.id !== args.id));
      return { success: true };
    },
  );

  return (
    <div>
      <h3>Todo List</h3>
      <ul>
        {todos.map((todo) => (
          <li
            key={todo.id}
            style={{ textDecoration: todo.done ? 'line-through' : 'none' }}
          >
            {todo.text}
          </li>
        ))}
      </ul>
      <p>
        ✅ 4 tools registered: list_todos, add_todo, toggle_todo, delete_todo
      </p>
    </div>
  );
}

// =============================================================================
// Příklad 3: Conditional tool registration
// =============================================================================

function AdminPanelComponent() {
  const [isAdmin, setIsAdmin] = useState(false);

  const { isRegistered, register, unregister } = useMCPTool({
    name: 'admin_delete_user',
    description: 'Delete a user (admin only)',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: 'User ID to delete' },
      },
      required: ['userId'],
    },
    handler: async (args: unknown) => {
      const { userId } = args as { userId: number };
      console.log('Deleting user:', userId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, deletedUserId: userId }),
          },
        ],
      };
    },
    autoRegister: false, // Neregistrovat automaticky
  });

  // Registrovat pouze když je admin
  React.useEffect(() => {
    if (isAdmin) {
      register();
    } else {
      unregister();
    }
  }, [isAdmin, register, unregister]);

  return (
    <div>
      <h3>Admin Panel</h3>
      <button onClick={() => setIsAdmin(!isAdmin)}>
        {isAdmin ? 'Disable' : 'Enable'} Admin Mode
      </button>
      <p>
        Admin mode: {isAdmin ? '✅ ON' : '❌ OFF'}
        <br />
        Tool 'admin_delete_user':{' '}
        {isRegistered ? '✅ Registered' : '❌ Not registered'}
      </p>
    </div>
  );
}

// =============================================================================
// Příklad 4: Multiple components using the same tool
// =============================================================================

function SharedToolComponentA() {
  const [data] = useState('Data from Component A');

  const { refCount, isRegistered } = useMCPTool({
    name: 'get_shared_data',
    description: 'Get shared data',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ source: 'A', data }),
        },
      ],
    }),
  });

  return (
    <div>
      <h4>Component A</h4>
      <p>Data: {data}</p>
      <p>Tool ref count: {refCount}</p>
      <p>Status: {isRegistered ? '✅ Registered' : '❌ Not registered'}</p>
    </div>
  );
}

function SharedToolComponentB() {
  const [data] = useState('Data from Component B');

  const { refCount, isRegistered } = useMCPTool({
    name: 'get_shared_data', // ← Stejné jméno!
    description: 'Get shared data',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ source: 'B', data }),
        },
      ],
    }),
  });

  return (
    <div>
      <h4>Component B</h4>
      <p>Data: {data}</p>
      <p>Tool ref count: {refCount}</p>
      <p>Status: {isRegistered ? '✅ Registered' : '❌ Not registered'}</p>
    </div>
  );
}

function SharedToolDemo() {
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);

  return (
    <div>
      <h3>Shared Tool Demo (Reference Counting)</h3>
      <button onClick={() => setShowA(!showA)}>
        {showA ? 'Hide' : 'Show'} Component A
      </button>
      <button onClick={() => setShowB(!showB)}>
        {showB ? 'Hide' : 'Show'} Component B
      </button>

      <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
        {showA && <SharedToolComponentA />}
        {showB && <SharedToolComponentB />}
      </div>

      <p>
        💡 Tip: Zkuste hide/show komponenty a sledujte ref count.
        <br />
        Tool se odregistruje pouze když jsou obě komponenty hidden!
      </p>
    </div>
  );
}

// =============================================================================
// Příklad 5: With Context Provider
// =============================================================================

function ConnectionStatus() {
  const { isInitialized, isConnected } = useMCPToolsContext();

  return (
    <div
      style={{ padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}
    >
      <strong>MCP Status:</strong>
      <br />
      Initialized: {isInitialized ? '✅' : '❌'}
      <br />
      Connected: {isConnected ? '✅' : '❌'}
    </div>
  );
}

// =============================================================================
// Main Example App
// =============================================================================

function ExampleAppContent() {
  const [activeExample, setActiveExample] = useState<number>(1);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>React MCP Tools - Examples</h1>

      <ConnectionStatus />

      <div style={{ marginTop: '20px' }}>
        <h2>Select Example:</h2>
        <button onClick={() => setActiveExample(1)}>1. User Profile</button>
        <button onClick={() => setActiveExample(2)}>2. Todo List</button>
        <button onClick={() => setActiveExample(3)}>3. Admin Panel</button>
        <button onClick={() => setActiveExample(4)}>4. Shared Tool</button>
      </div>

      <div
        style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc' }}
      >
        {activeExample === 1 && <UserProfileComponent />}
        {activeExample === 2 && <TodoListComponent />}
        {activeExample === 3 && <AdminPanelComponent />}
        {activeExample === 4 && <SharedToolDemo />}
      </div>

      <div
        style={{ marginTop: '20px', padding: '10px', background: '#e8f5e9' }}
      >
        <h3>How to test:</h3>
        <ol>
          <li>
            Start your MCP server: <code>pnpm nx serve mcp-server</code>
          </li>
          <li>
            Connect with MCP client (e.g., Claude Desktop) to{' '}
            <code>ws://localhost:3001</code>
          </li>
          <li>Try calling the registered tools!</li>
          <li>Switch between examples and see tools register/unregister</li>
        </ol>
      </div>
    </div>
  );
}

export default function ReactMCPToolsExample() {
  return (
    <MCPToolsProvider
      backendWsUrl="ws://localhost:3001"
      onInitialized={() => console.log('✅ MCP Tools initialized!')}
      onInitError={(error) => console.error('❌ MCP init failed:', error)}
    >
      <ExampleAppContent />
    </MCPToolsProvider>
  );
}

// =============================================================================
// Standalone usage (without Provider)
// =============================================================================

export function StandaloneExample() {
  useMCPTool({
    name: 'standalone_tool',
    description: 'A tool without Context Provider',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ message: 'Works without Provider!' }),
        },
      ],
    }),
  });

  return <div>Standalone tool registered! (no Provider needed)</div>;
}
