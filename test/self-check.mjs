/**
 * `test/self-check.mjs`
 * Verifies plugin packaging, host exports, and client loader registration.
 */

import assert from 'node:assert/strict';
import * as hostModule from '../index.js';

console.log('🚀 Running dsh-file-view self-check...\n');

// 1. Host export check
console.log('--- Step 1: Host exports ---');
assert.equal(hostModule.name, 'dsh-file-view');
assert.equal(typeof hostModule.apply, 'function');
console.log('✔ Host exports valid!\n');

// 2. Client bundle ModuleLoader check
console.log('--- Step 2: Client bundle ModuleLoader ---');
let registeredBundle = null;
globalThis.window = {
  __ModuleLoader__: {
    load(def) {
      registeredBundle = def;
    }
  },
  localStorage: {
    getItem() { return null; },
    setItem() {}
  }
};

await import('../lib/client.js');

assert.ok(registeredBundle, 'Bundle registered with window.__ModuleLoader__');
assert.equal(registeredBundle.id, 'dsh-file-view');
assert.equal(typeof registeredBundle.factory, 'function');

const mockReact = {
  createElement(type, props, ...children) {
    return { type, props, children };
  },
  useState(init) { return [init, () => {}]; },
  useEffect(fn) { fn(); return () => {}; }
};

const clientModule = registeredBundle.factory((id) => {
  if (id === 'react') return mockReact;
  throw new Error(`Unexpected require: ${id}`);
});

assert.equal(clientModule.name, 'dsh-file-view');
assert.equal(typeof clientModule.apply, 'function');
assert.ok(Array.isArray(clientModule.inject), 'Client inject list exists');
console.log('✔ Client bundle loaded and exports verified!\n');

console.log('======================================================');
console.log('✨ SELF-CHECK PASSED! dsh-file-view is fully operational.');
console.log('======================================================');
