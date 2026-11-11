/**
 * `test/e2e-simulation.test.mjs`
 * End-to-End DOM simulation and Cordis Client runtime integration tests for dsh-file-view.
 */

import assert from 'node:assert/strict';

console.log('🎭 Running dsh-file-view END-TO-END RUNTIME SIMULATION TEST...\n');

// ── Lightweight Mock DOM Environment ────────────────────────────────────────
class MockNode {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.parentElement = null;
    this.parentNode = null;
    this.childNodes = [];
  }

  get textContent() {
    return this.childNodes.map(c => c.textContent).join('');
  }

  set textContent(val) {
    this.childNodes = [new MockTextNode(String(val))];
    this.childNodes[0].parentElement = this;
    this.childNodes[0].parentNode = this;
  }

  appendChild(child) {
    if (child.nodeType === 11) { // DocumentFragment
      const children = [...child.childNodes];
      child.childNodes = [];
      for (const c of children) this.appendChild(c);
      return child;
    }
    child.parentElement = this;
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  replaceChild(newChild, oldChild) {
    const idx = this.childNodes.indexOf(oldChild);
    if (idx !== -1) {
      if (newChild.nodeType === 11) {
        const fragChildren = [...newChild.childNodes];
        newChild.childNodes = [];
        this.childNodes.splice(idx, 1, ...fragChildren);
        for (const c of fragChildren) {
          c.parentElement = this;
          c.parentNode = this;
        }
      } else {
        newChild.parentElement = this;
        newChild.parentNode = this;
        this.childNodes[idx] = newChild;
      }
      oldChild.parentElement = null;
      oldChild.parentNode = null;
    }
    return oldChild;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentElement = null;
      child.parentNode = null;
    }
    return child;
  }
}

class MockTextNode extends MockNode {
  constructor(text) {
    super(3, '#text');
    this.nodeValue = text;
  }
  get textContent() { return this.nodeValue; }
  set textContent(v) { this.nodeValue = String(v); }
}

class MockElement extends MockNode {
  constructor(tagName) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.className = '';
    this.id = '';
  }

  setAttribute(name, val) { this.attributes.set(name, String(val)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }

  closest(selector) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        if (cur.className && cur.className.split(/\s+/).includes(cls)) return cur;
      } else if (selector.startsWith('[')) {
        const attr = selector.slice(1, -1);
        if (cur.hasAttribute(attr)) return cur;
      } else {
        if (cur.tagName.toLowerCase() === selector.toLowerCase()) return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  querySelectorAll(selector) {
    const res = [];
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 1) {
        if (selector.startsWith('[')) {
          const attr = selector.slice(1, -1);
          if (node.hasAttribute(attr)) res.push(node);
        } else if (selector.startsWith('.')) {
          const cls = selector.slice(1);
          if (node.className && node.className.split(/\s+/).includes(cls)) res.push(node);
        }
      }
      for (const c of node.childNodes) walk(c);
    }
    walk(this);
    return res;
  }
}

class MockDocument {
  constructor() {
    this.head = new MockElement('head');
    this.body = new MockElement('body');
    this.head.parentElement = this;
    this.body.parentElement = this;
    this.elementsById = new Map();
  }

  createElement(tag) { return new MockElement(tag); }
  createTextNode(text) { return new MockTextNode(text); }
  createDocumentFragment() { return new MockNode(11, '#document-fragment'); }

  getElementById(id) {
    let match = null;
    function walk(n) {
      if (!n || match) return;
      if (n.nodeType === 1 && n.id === id) { match = n; return; }
      for (const c of n.childNodes) walk(c);
    }
    walk(this.head);
    walk(this.body);
    return match;
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  createTreeWalker(root, whatToShow, filter) {
    const nodes = [];
    function collect(n) {
      if (!n) return;
      if (n !== root) {
        if (whatToShow === 4 && n.nodeType === 3) { // NodeFilter.SHOW_TEXT
          if (!filter || filter.acceptNode(n) === 1) {
            nodes.push(n);
          }
        }
      }
      for (const c of n.childNodes) collect(c);
    }
    collect(root);
    let index = 0;
    return {
      nextNode() {
        if (index < nodes.length) return nodes[index++];
        return null;
      }
    };
  }
}

// Global setup
const document = new MockDocument();
const listeners = new Map();

function addEventListener(ev, fn) {
  if (!listeners.has(ev)) listeners.set(ev, []);
  listeners.get(ev).push(fn);
}
function removeEventListener(ev, fn) {
  if (!listeners.has(ev)) return;
  const list = listeners.get(ev);
  const idx = list.indexOf(fn);
  if (idx !== -1) list.splice(idx, 1);
}
function dispatchEvent(ev, payload) {
  const list = listeners.get(ev) || [];
  for (const fn of list) fn(payload);
}

let selectionText = '';
const windowMock = {
  localStorage: {
    store: new Map(),
    getItem(k) { return this.store.get(k) || null; },
    setItem(k, v) { this.store.set(k, String(v)); }
  },
  getSelection() {
    return {
      toString() { return selectionText; }
    };
  },
  setTimeout(fn, ms) { return setTimeout(fn, ms); },
  clearTimeout(id) { clearTimeout(id); }
};

class MockMutationObserver {
  constructor(cb) { this.cb = cb; }
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
}

globalThis.document = document;
globalThis.window = windowMock;
globalThis.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
globalThis.MutationObserver = MockMutationObserver;

document.addEventListener = addEventListener;
document.removeEventListener = removeEventListener;

// ── Mock Cordis Context ─────────────────────────────────────────────────────
const sidebarCalls = [];
const hostOpenCalls = [];
const themeCalls = [];
let effectDisposer = null;

const mockCtx = {
  sessions: {
    list: {
      getSnapshot() {
        return {
          byId: {
            'sess-1': { cwd: 'C:/Users/test/workspace', retainedBy: { mainView: 10 } },
            'sess-2': { cwd: 'D:/Other/project', retainedBy: { mainView: 1 } }
          }
        };
      }
    }
  },
  sidebarRight: {
    openResource(url, opts) {
      sidebarCalls.push({ url, opts });
    }
  },
  remote: {
    session: {
      openWorkspacePath(req) {
        hostOpenCalls.push(req);
        return Promise.resolve({ ok: true });
      }
    }
  },
  theme: {
    overrideTokens(id, tokens) {
      themeCalls.push({ id, tokens });
      return () => {};
    }
  },
  slots: {
    inject(name, fn) { fn(); },
    register(meta, fn) { return { meta, fn }; }
  },
  effect(fn) {
    effectDisposer = fn();
  }
};

// Load Client Plugin Bundle
let clientModule = null;
globalThis.window.__ModuleLoader__ = {
  load(def) {
    clientModule = def.factory((id) => {
      if (id === 'react') return { createElement() {}, useState: () => [{}, () => {}], useEffect: () => {} };
      throw new Error(`Unknown require ${id}`);
    });
  }
};

await import('../lib/client.js');

assert.ok(clientModule, 'Client module loaded');
assert.equal(clientModule.name, 'dsh-file-view');

// Initialize plugin
clientModule.apply(mockCtx);

// ============================================================================
// Scenario 1: Chat Stream DOM Scan & Path Wrapping
// ============================================================================
console.log('--- Scenario 1: Chat Stream DOM Scan & Link Wrapping ---');
const chatFlow = document.createElement('div');
chatFlow.setAttribute('data-chat-flow', '1');
document.body.appendChild(chatFlow);

const msg = document.createElement('div');
msg.className = 'message-bubble';
const p = document.createElement('p');
const textNode = document.createTextNode('Here is src/core/main.ts:88 and also docs/README.md for reference.');
p.appendChild(textNode);
msg.appendChild(p);
chatFlow.appendChild(msg);

// Trigger scan via global control
windowMock.__dshFileView.rescan();

const links = chatFlow.querySelectorAll('.dshfl-link');
assert.equal(links.length, 2, `Expected 2 wrapped links, found ${links.length}`);
assert.equal(links[0].getAttribute('data-dshfl-path'), 'src/core/main.ts');
assert.equal(links[0].getAttribute('data-dshfl-line'), '88');
assert.equal(links[1].getAttribute('data-dshfl-path'), 'docs/README.md');
console.log('✔ Links properly wrapped into DOM span elements!\n');

// ============================================================================
// Scenario 2: Normal Left Click (Preview in Right Sidebar)
// ============================================================================
console.log('--- Scenario 2: Normal Left Click (Sidebar Preview) ---');
sidebarCalls.length = 0;
hostOpenCalls.length = 0;

// Simulate pointer down & click at same coordinate (no drag)
dispatchEvent('mousedown', { clientX: 100, clientY: 100 });
dispatchEvent('click', {
  target: links[0],
  button: 0,
  clientX: 100,
  clientY: 100,
  preventDefault() {},
  stopPropagation() {}
});

assert.equal(sidebarCalls.length, 1, 'sidebarRight.openResource should be called');
assert.equal(
  sidebarCalls[0].url,
  'dsh-resource://file/session/sess-1/src/core/main.ts'
);
assert.deepEqual(sidebarCalls[0].opts, { params: { line: 88 } });
assert.equal(hostOpenCalls.length, 0, 'hostOpen should not be called on preview');
console.log('✔ Sidebar preview opened with session URL and exact line 88!\n');

// ============================================================================
// Scenario 3: Ctrl + Click (Open in Cursor / External Editor)
// ============================================================================
console.log('--- Scenario 3: Ctrl + Click (Open in External Editor) ---');
sidebarCalls.length = 0;
hostOpenCalls.length = 0;

dispatchEvent('mousedown', { clientX: 100, clientY: 100 });
dispatchEvent('click', {
  target: links[0],
  button: 0,
  ctrlKey: true,
  clientX: 100,
  clientY: 100,
  preventDefault() {},
  stopPropagation() {}
});

await new Promise(r => setTimeout(r, 10));

assert.equal(sidebarCalls.length, 0, 'sidebarRight.openResource should not be called');
assert.equal(hostOpenCalls.length, 1, 'hostOpen should be called');
assert.equal(
  hostOpenCalls[0].path,
  'C:/Users/test/workspace/src/core/main.ts'
);
console.log('✔ External editor invoked with absolutized workspace path!\n');

// ============================================================================
// Scenario 4: Alt + Click (Reveal in Explorer)
// ============================================================================
console.log('--- Scenario 4: Alt + Click (Reveal in Explorer) ---');
sidebarCalls.length = 0;
hostOpenCalls.length = 0;

dispatchEvent('mousedown', { clientX: 100, clientY: 100 });
dispatchEvent('click', {
  target: links[0],
  button: 0,
  altKey: true,
  clientX: 100,
  clientY: 100,
  preventDefault() {},
  stopPropagation() {}
});

await new Promise(r => setTimeout(r, 10));

assert.equal(hostOpenCalls.length, 1, 'hostOpen should be called');
assert.equal(hostOpenCalls[0].action, 'reveal', 'action should be reveal');
console.log('✔ Alt+click correctly triggers reveal action in Explorer!\n');

// ============================================================================
// Scenario 5: Text Selection Drag Protection
// ============================================================================
console.log('--- Scenario 5: Text Selection Drag Protection ---');
sidebarCalls.length = 0;
hostOpenCalls.length = 0;

// Mouse down at (100, 100), mouse moved to (150, 100) (drag distance 50px > 4px threshold)
dispatchEvent('mousedown', { clientX: 100, clientY: 100 });
dispatchEvent('click', {
  target: links[0],
  button: 0,
  clientX: 150,
  clientY: 100,
  preventDefault() {},
  stopPropagation() {}
});

assert.equal(sidebarCalls.length, 0, 'Should NOT open preview on drag');
assert.equal(hostOpenCalls.length, 0, 'Should NOT open host on drag');
console.log('✔ Drag selection preserved without accidental link triggering!\n');

// ============================================================================
// Scenario 6: Active Selection Protection
// ============================================================================
console.log('--- Scenario 6: Active Selection Protection ---');
sidebarCalls.length = 0;
hostOpenCalls.length = 0;

selectionText = 'selected code';
dispatchEvent('mousedown', { clientX: 100, clientY: 100 });
dispatchEvent('click', {
  target: links[0],
  button: 0,
  clientX: 100,
  clientY: 100,
  preventDefault() {},
  stopPropagation() {}
});

assert.equal(sidebarCalls.length, 0, 'Should NOT trigger when text is currently selected');
selectionText = '';
console.log('✔ Existing text selection respected!\n');

// ============================================================================
// Scenario 7: Security Interception - Executable Direct Launch Block
// ============================================================================
console.log('--- Scenario 7: Executable Direct Launch Block ---');
hostOpenCalls.length = 0;

const exeLink = document.createElement('span');
exeLink.className = 'dshfl-link';
exeLink.setAttribute('data-dshfl-path', 'build/setup.bat');
chatFlow.appendChild(exeLink);

// User presses Ctrl+Click on .bat file (normally 'open')
dispatchEvent('mousedown', { clientX: 100, clientY: 100 });
dispatchEvent('click', {
  target: exeLink,
  button: 0,
  ctrlKey: true,
  clientX: 100,
  clientY: 100,
  preventDefault() {},
  stopPropagation() {}
});

await new Promise(r => setTimeout(r, 10));

// Must be downgraded to 'reveal' for safety!
assert.equal(hostOpenCalls.length, 1);
assert.equal(hostOpenCalls[0].action, 'reveal', 'Executable MUST be downgraded to reveal, never open');
const toastEl = document.getElementById('dshfl-toast');
assert.ok(toastEl && toastEl.textContent.includes('可执行文件'), 'Safety toast must be shown');
console.log('✔ Direct execution of .bat safely downgraded to reveal in file manager!\n');

// ============================================================================
// Scenario 8: Security Interception - Remote UNC Block
// ============================================================================
console.log('--- Scenario 8: Remote UNC Share SMB Leak Block ---');
hostOpenCalls.length = 0;

const uncLink = document.createElement('span');
uncLink.className = 'dshfl-link';
uncLink.setAttribute('data-dshfl-path', '\\\\attacker.com\\share\\leak.txt');
chatFlow.appendChild(uncLink);

// User clicks Ctrl+Click on remote UNC
dispatchEvent('mousedown', { clientX: 100, clientY: 100 });
dispatchEvent('click', {
  target: uncLink,
  button: 0,
  ctrlKey: true,
  clientX: 100,
  clientY: 100,
  preventDefault() {},
  stopPropagation() {}
});

await new Promise(r => setTimeout(r, 10));

assert.equal(hostOpenCalls.length, 0, 'Remote UNC path MUST NOT be passed to hostOpen');
assert.ok(toastEl && toastEl.textContent.includes('NTLM'), 'NTLM credential protection toast shown');
console.log('✔ Remote UNC share completely blocked from triggering SMB leakage!\n');

// ============================================================================
// Scenario 9: Keyboard Activation (Enter & Space)
// ============================================================================
console.log('--- Scenario 9: Keyboard Navigation (Enter / Space) ---');
sidebarCalls.length = 0;

dispatchEvent('keydown', { target: links[1], key: 'Enter', preventDefault() {} });
assert.equal(sidebarCalls.length, 1);
assert.equal(sidebarCalls[0].url, 'dsh-resource://file/session/sess-1/docs/README.md');

dispatchEvent('keydown', { target: links[1], key: ' ', preventDefault() {} });
assert.equal(sidebarCalls.length, 2);
console.log('✔ Accessible keyboard Enter/Space activation verified!\n');

// ============================================================================
// Scenario 10: Theme Accent Swatch Switching
// ============================================================================
console.log('--- Scenario 10: Theme Accent Color Live Synchronization ---');
themeCalls.length = 0;

windowMock.__dshFileView.update({ accentPreset: 'green' });
assert.ok(themeCalls.length > 0, 'overrideTokens should be called on accent update');
const lastTheme = themeCalls[themeCalls.length - 1];
assert.equal(lastTheme.id, 'dsh-file-view');
assert.equal(lastTheme.tokens['--dsw-alias-state-business-primary'].light, '#0f9d6e');
assert.equal(lastTheme.tokens['--dsw-alias-state-business-primary'].dark, '#34d399');
console.log('✔ Theme tokens synchronized in real time with green preset (#0f9d6e)!\n');

// Clean up
if (effectDisposer) effectDisposer();

console.log('================================================================');
console.log('🎉 ALL 10 E2E RUNTIME SIMULATION SCENARIOS PASSED 100%!');
console.log('================================================================');
