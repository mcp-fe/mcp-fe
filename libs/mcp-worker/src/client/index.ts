/**
 * Client-side exports for MCP Worker
 * Use this in your application code
 */

export { WorkerClient, type WorkerClientInitOptions } from './worker-client';

// WorkerClient global singleton instance
import { WorkerClient } from './worker-client';
export const workerClient = new WorkerClient();
