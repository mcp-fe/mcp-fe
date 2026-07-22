// Jest's jsdom test environment doesn't provide TextEncoder/TextDecoder as
// globals (unlike a real browser or Node itself), which crashes any dependency
// that references them at module load time (e.g. @tanstack/router-core).
import { TextEncoder, TextDecoder } from 'util';

if (typeof globalThis.TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = TextDecoder;
}
