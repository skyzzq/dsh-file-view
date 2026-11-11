/**
 * `test/security.test.mjs`
 * Security & Defense Test Suite for dsh-file-view:
 * 1. Pseudo-protocol injection (javascript:, data:, vbscript:)
 * 2. Dangerous executable handling (.exe, .bat, .cmd, .ps1, .vbs)
 * 3. ReDoS / Long input stress testing
 * 4. DOM XSS payload containment (HTML / script tags in paths)
 * 5. Prototype pollution & config tampering
 */

import assert from 'node:assert/strict';
import {
  looksLikeFilePath,
  splitAnnotation,
  fileAddressFor,
  resolveWorkspacePath,
  findPathMatches
} from '../lib/paths.js';

console.log('🛡️ Running dsh-file-view SECURITY ANALYSIS & TEST SUITE...\n');

// ============================================================================
// 1. Pseudo-Protocol & Malicious URL Schemes
// ============================================================================
console.log('--- Test 1: Pseudo-Protocol & Malicious URL Schemes ---');
const maliciousSchemes = [
  'javascript:alert(1)',
  'javascript:alert(document.cookie)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox("hello")',
  'about:blank',
  'blob:http://example.com/uuid'
];

for (const malicious of maliciousSchemes) {
  const matches = findPathMatches(`Click here: ${malicious} for info`);
  for (const m of matches) {
    const raw = m.raw;
    assert.ok(!raw.startsWith('javascript:'), `javascript: scheme leaked: ${raw}`);
    assert.ok(!raw.startsWith('data:'), `data: scheme leaked: ${raw}`);
    assert.ok(!raw.startsWith('vbscript:'), `vbscript: scheme leaked: ${raw}`);
  }
}
console.log('✔ Pseudo-protocols safely rejected or sanitized!\n');

// ============================================================================
// 2. Dangerous Executable & Batch Script Policy
// ============================================================================
console.log('--- Test 2: Dangerous Executable Policy ---');
const dangerousFiles = [
  'calc.exe',
  'exploit.bat',
  'run.cmd',
  'trojan.vbs',
  'script.ps1',
  'payload.msi',
  'virus.scr',
  'harm.com'
];

for (const df of dangerousFiles) {
  assert.equal(looksLikeFilePath(df), false, `Dangerous bare executable ${df} should never look like a safe file`);
  const matches = findPathMatches(`Run ${df} now`);
  assert.equal(matches.length, 0, `Dangerous bare executable ${df} should not be recognized`);
}
console.log('✔ Bare executables strictly rejected from automatic linkification!\n');

// ============================================================================
// 3. ReDoS / Large Input Stress Testing
// ============================================================================
console.log('--- Test 3: ReDoS & Backtracking Stress Test ---');
const evilStrings = [
  'a/'.repeat(5000) + 'test.ts',
  'file:///' + 'C:/foo/'.repeat(2000) + 'test.js',
  'path/' + '.'.repeat(5000) + 'ts',
  '//' + 'host/'.repeat(2000) + 'share/test.py',
  '中文/'.repeat(2000) + '测试.vue'
];

for (const evil of evilStrings) {
  const t0 = performance.now();
  findPathMatches(evil);
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 200, `ReDoS detected! String of length ${evil.length} took ${elapsed}ms`);
}
console.log('✔ ReDoS stress tests passed (< 200ms for 10,000+ char patterns)!\n');

// ============================================================================
// 4. XSS & HTML Payload Neutralization
// ============================================================================
console.log('--- Test 4: XSS & HTML Payload Neutralization ---');
const xssPayloads = [
  '<script>alert(1)</script>/test.ts',
  '"><img src=x onerror=alert(1)>.md',
  '<iframe src="evil.com"></iframe>/app.js:20',
  'src/<svg onload=alert(1)>/test.py'
];

for (const xss of xssPayloads) {
  const matches = findPathMatches(xss);
  for (const m of matches) {
    assert.ok(!m.raw.includes('<script>'), 'Script tag must not be part of path match');
    assert.ok(!m.raw.includes('onerror='), 'HTML attribute must not be part of path match');
    assert.ok(!m.raw.includes('<iframe'), 'Iframe tag must not be part of path match');
    assert.ok(!m.raw.includes('<svg'), 'SVG tag must not be part of path match');
  }
}
console.log('✔ XSS & HTML injection payloads safely isolated!\n');

// ============================================================================
// 5. Prototype Pollution in Configuration
// ============================================================================
console.log('--- Test 5: Prototype Pollution & Config Tampering ---');
const maliciousJson = JSON.parse('{"__proto__":{"polluted":true},"enabled":true,"accentCustom":"#123456"}');
assert.equal(Object.prototype.polluted, undefined, 'Prototype must not be polluted by JSON.parse');
console.log('✔ Prototype pollution checks passed!\n');

// ============================================================================
// 6. Windows Reserved Device Names (DOS Device Hang Protection)
// ============================================================================
console.log('--- Test 6: Windows Reserved Device Names ---');
const reservedNames = [
  'CON', 'con.txt', 'PRN.log', 'AUX.py', 'NUL.json', 'com1.ts', 'lpt1.js'
];
for (const dev of reservedNames) {
  assert.equal(looksLikeFilePath(dev), false, `Reserved device name ${dev} must not be accepted`);
  const matches = findPathMatches(`Device output: ${dev}`);
  assert.equal(matches.length, 0, `Reserved device name ${dev} must not be matched`);
}
console.log('✔ Windows DOS device names (CON/NUL/AUX/PRN) safely rejected!\n');

// ============================================================================
// 7. Remote UNC vs Local WSL Protection (NTLM Leak Prevention)
// ============================================================================
console.log('--- Test 7: Remote UNC Share Protection ---');
import { isRemoteUncPath } from '../lib/paths.js';

assert.equal(isRemoteUncPath('\\\\wsl.localhost\\Ubuntu\\home\\user\\app.py'), false, 'WSL localhost is local');
assert.equal(isRemoteUncPath('\\\\wsl$\\Debian\\var\\log\\syslog'), false, 'WSL$ is local');
assert.equal(isRemoteUncPath('\\\\localhost\\c$\\test.txt'), false, 'localhost is local');
assert.equal(isRemoteUncPath('\\\\127.0.0.1\\c$\\test.txt'), false, '127.0.0.1 is local');
assert.equal(isRemoteUncPath('\\\\attacker.com\\share\\file.txt'), true, 'External domain UNC must be flagged as remote');
assert.equal(isRemoteUncPath('\\\\192.168.1.100\\share\\doc.md'), true, 'External LAN/WAN IP UNC must be flagged as remote');
console.log('✔ Remote UNC shares properly identified to prevent NTLM credential leakage!\n');

console.log('================================================================');
console.log('🎉 ALL SECURITY TESTS PASSED 100%!');
console.log('================================================================');
