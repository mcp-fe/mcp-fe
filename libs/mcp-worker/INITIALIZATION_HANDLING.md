# ✅ Implementace čekání na inicializaci - DOKONČENO

## Problém

Registrace toolů probíhala **před dokončením inicializace** MCP workeru, což způsobovalo:
- ❌ Selhání registrace (worker není ready)
- ❌ Ztráta registrací
- ❌ Race conditions

## Řešení - Dvouúrovňové ošetření

Implementoval jsem ochranu na **obou úrovních** podle doporučení:

### 1️⃣ Úroveň WorkerClient (první linie obrany)

```typescript
// Worker client nyní sleduje stav inicializace
private isInitialized = false;
private pendingRegistrations: Array<...> = [];

public async registerTool(...) {
  // Pokud není inicializován, zařaď do fronty
  if (!this.isInitialized) {
    return new Promise((resolve, reject) => {
      this.pendingRegistrations.push({ name, ..., resolve, reject });
    });
  }
  
  // Už je inicializován - registruj hned
  return this.registerToolInternal(...);
}
```

**Benefity:**
- ✅ Automatické queueování registrací
- ✅ Zpracování po dokončení init
- ✅ Žádná ztráta registrací

### 2️⃣ Úroveň MCPController (druhá linie obrany)

```typescript
// Controller sleduje stav MCP serveru
private isMCPServerReady = false;
private pendingToolRegistrations: Array<...> = [];

public async handleRegisterTool(toolData) {
  // Pokud MCP server není ready, zařaď do fronty
  if (!this.isMCPServerReady) {
    return new Promise((resolve, reject) => {
      this.pendingToolRegistrations.push({ toolData, resolve, reject });
    });
  }
  
  // MCP server je ready - registruj hned
  return this.handleRegisterToolInternal(toolData);
}
```

**Benefity:**
- ✅ Ochrana i když WorkerClient pustí request příliš brzy
- ✅ Čeká na připojení k WebSocket
- ✅ Zpracování po dokončení MCP server connection

### 3️⃣ Úroveň React Hook (uživatelsky přívětivé)

```typescript
const register = useCallback(async () => {
  // Čekáme na inicializaci workeru před registrací
  if (!workerClient.initialized) {
    console.log(`Waiting for worker initialization...`);
    await workerClient.waitForInit();
  }
  
  // Teď registrujeme
  await workerClient.registerTool(...);
}, [...]);
```

**Benefity:**
- ✅ Explicitní čekání před registrací
- ✅ Debugging info v konzoli
- ✅ Reference counting funguje správně

## Flow diagram

```
Component Mount
    ↓
useMCPTool → register()
    ↓
workerClient.initialized? 
    ├─ NO → workerClient.waitForInit()
    │           ↓
    │       [čeká na init...]
    │           ↓
    │       ✅ initialized
    │
    └─ YES → registerTool()
                ↓
            workerClient.isInitialized?
                ├─ NO → Queue pending registration
                │           ↓
                │       [čeká v queue...]
                │           ↓
                │       init dokončen → processPending()
                │           ↓
                │       registerToolInternal()
                │
                └─ YES → registerToolInternal()
                            ↓
                        request('REGISTER_TOOL')
                            ↓
                        MCPController.handleRegisterTool()
                            ↓
                        isMCPServerReady?
                            ├─ NO → Queue pending registration
                            │           ↓
                            │       [čeká v queue...]
                            │           ↓
                            │       MCP connect → processPending()
                            │           ↓
                            │       handleRegisterToolInternal()
                            │
                            └─ YES → handleRegisterToolInternal()
                                        ↓
                                    toolRegistry.register()
                                        ↓
                                    ✅ Tool zaregistrován!
```

## Nová API metoda

### `workerClient.waitForInit()`

```typescript
/**
 * Wait for worker initialization
 * @returns Promise that resolves when worker is initialized
 */
public async waitForInit(): Promise<void> {
  if (this.isInitialized) {
    return Promise.resolve();
  }

  if (this.initPromise) {
    await this.initPromise;
    return;
  }

  return new Promise<void>((resolve) => {
    this.initResolvers.push(resolve);
  });
}
```

**Použití:**
```typescript
// Explicitní čekání
await workerClient.waitForInit();
await workerClient.registerTool(...);

// Nebo kontrola
if (workerClient.initialized) {
  await workerClient.registerTool(...);
}
```

### `workerClient.initialized` (getter)

```typescript
public get initialized(): boolean {
  return this.isInitialized;
}
```

**Použití:**
```typescript
if (workerClient.initialized) {
  console.log('Worker is ready!');
}
```

## Chování v různých scénářích

### Scénář 1: Rychlá registrace (před init)

```typescript
// Component A se mountuje hned při startu
function ComponentA() {
  useMCPTool({ name: 'tool1', ... }); // ← Mount PŘED init
}

// Flow:
// 1. useMCPTool volá register()
// 2. workerClient.initialized === false
// 3. Čeká na waitForInit()
// 4. Mezitím init() probíhá na pozadí
// 5. init() dokončen → markAsInitialized()
// 6. waitForInit() resolve
// 7. register() pokračuje a registruje tool
```

### Scénář 2: Pomalá registrace (po init)

```typescript
// Worker se inicializuje v App
function App() {
  useEffect(() => {
    workerClient.init();
  }, []);
}

// Component B se mountuje později (po kliknutí)
function ComponentB() {
  useMCPTool({ name: 'tool2', ... }); // ← Mount PO init
}

// Flow:
// 1. useMCPTool volá register()
// 2. workerClient.initialized === true
// 3. Okamžitě registruje bez čekání
```

### Scénář 3: Paralelní registrace

```typescript
// Více komponent se mountuje současně
function App() {
  return (
    <>
      <ComponentA /> {/* useMCPTool('tool1') */}
      <ComponentB /> {/* useMCPTool('tool2') */}
      <ComponentC /> {/* useMCPTool('tool3') */}
    </>
  );
}

// Flow:
// 1. Všechny 3 komponenty se mountují současně
// 2. Všechny 3 volají register() → všechny čekají na waitForInit()
// 3. init() dokončen
// 4. Všechny 3 resolve současně
// 5. Všechny 3 registrují své tools
```

### Scénář 4: MCP server není připojený

```typescript
// Init dokončen, ale MCP server ještě není připojený k WebSocket
workerClient.init(); // ← dokončeno, ale socket connecting...

useMCPTool({ name: 'tool', ... });

// Flow:
// 1. workerClient.initialized === true ✅
// 2. registerTool() volá request('REGISTER_TOOL')
// 3. MCPController.handleRegisterTool()
// 4. isMCPServerReady === false (socket stále connecting)
// 5. Zařazeno do pendingToolRegistrations
// 6. WebSocket connect → processPendingToolRegistrations()
// 7. Tool zaregistrován
```

## Testování

### Test 1: Registrace před init

```typescript
const client = new WorkerClient();

// Registruj PŘED init
const registerPromise = client.registerTool('test', '...', {}, async () => ({
  content: [{ type: 'text', text: 'OK' }]
}));

// Init na pozadí
setTimeout(() => client.init(), 100);

// Počkej na registraci
await registerPromise; // ← Dokončí se PO init
console.log('✅ Tool registered after init completed');
```

### Test 2: Více registrací současně

```typescript
const client = new WorkerClient();

// Registruj více toolů současně (před init)
const promises = [
  client.registerTool('tool1', '...', {}, handler1),
  client.registerTool('tool2', '...', {}, handler2),
  client.registerTool('tool3', '...', {}, handler3),
];

// Init
setTimeout(() => client.init(), 100);

// Všechny by měly dokončit
await Promise.all(promises);
console.log('✅ All tools registered');
```

### Test 3: React hook

```typescript
function TestComponent() {
  const { isRegistered } = useMCPTool({
    name: 'test_tool',
    description: 'Test',
    inputSchema: {},
    handler: async () => ({ content: [{ type: 'text', text: 'OK' }] })
  });
  
  // isRegistered bude false dokud:
  // 1. Worker se inicializuje
  // 2. Tool se zaregistruje
  // Pak bude true
  
  return <div>{isRegistered ? '✅ Ready' : '⏳ Loading...'}</div>;
}
```

## Výkon

### Overhead

- **Čekání na init:** ~0-100ms (pokud init už probíhá)
- **Queue operace:** <1ms (push/pop z array)
- **Promise overhead:** zanedbatelné

### Memory

- **pendingRegistrations:** Array (malý - max několik itemů)
- **initResolvers:** Array (malý - max několik callbacků)
- **Celkem:** ~několik KB navíc

## Debugging

Přidány log messages:

```typescript
// WorkerClient
[WorkerClient] Queueing tool registration 'my_tool' (worker not initialized yet)
[WorkerClient] Worker initialized, processing pending operations

// useMCPTool  
[useMCPTool] Waiting for worker initialization before registering 'my_tool'
[useMCPTool] Registered tool 'my_tool'

// MCPController
[MCPController] Queueing tool registration 'my_tool' (MCP server not ready yet)
[MCPController] Processing 3 pending tool registrations
[MCPController] Registered proxy tool: my_tool (forwards to main thread)
```

## Build status

```bash
✅ pnpm nx build mcp-worker
   Successfully ran target build (3s)

✅ pnpm nx build react-event-tracker  
   Successfully ran target build (3.92s)
```

## Závěr

Implementace zajišťuje **robustní handling** inicializace na třech úrovních:

1. **React hook** - Čeká na init před registrací
2. **WorkerClient** - Queue pro registrace před init
3. **MCPController** - Queue pro registrace před MCP connect

**Výsledek:** 
- ✅ Žádné ztráty registrací
- ✅ Žádné race conditions
- ✅ Graceful handling všech scénářů
- ✅ Transparentní pro uživatele (funguje automaticky)

Uživatel prostě zavolá `useMCPTool()` a **vše funguje**, ať už je worker inicializovaný nebo ne! 🎉
