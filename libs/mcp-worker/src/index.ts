import {WorkerClient}  from './lib/worker-client';

export { type WorkerClientInitOptions } from './lib/worker-client';
export { queryEvents, type UserEvent } from './lib/database';

// WorkerClient global singleton
export const workerClient = new WorkerClient();
