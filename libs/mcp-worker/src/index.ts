/**
 * Copyright 2026 Michal Kopecky
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { WorkerClient } from './lib/worker-client';

export {
  WorkerClient,
  type WorkerClientInitOptions,
} from './lib/worker-client';
export { queryEvents, type UserEvent } from './lib/database';
export { type ToolHandler, type ToolDefinition } from './lib/tool-registry';
export { logger } from './lib/logger';

// WorkerClient global singleton
export const workerClient = new WorkerClient();
