/**
 * `test/paths.test.mjs`
 * Comprehensive unit tests for path parsing, line number annotation,
 * and DSH resource URL formatting.
 */

import assert from 'node:assert/strict';
import {
  looksLikeFilePath,
  splitAnnotation,
  fileAddressFor,
  resolveWorkspacePath,
  findPathMatches
} from '../lib/paths.js';

console.log('🚀 Running dsh-file-view paths test suite...\n');

// 1. Path recognition
console.log('--- Suite 1: Path recognition ---');
assert.equal(looksLikeFilePath('C:\\Users\\user\\file.ts'), true, 'Windows absolute backslash');
assert.equal(looksLikeFilePath('C:/Users/user/file.ts'), true, 'Windows absolute slash');
assert.equal(looksLikeFilePath('/Users/user/file.py'), true, 'Unix absolute');
assert.equal(looksLikeFilePath('\\\\wsl.localhost\\Ubuntu\\file.md'), true, 'UNC path');
assert.equal(looksLikeFilePath('src/components/App.vue'), true, 'Relative path with separator');
assert.equal(looksLikeFilePath('./test/paths.test.mjs'), true, 'Dot-relative path');
assert.equal(looksLikeFilePath('README.md'), true, 'Known bare file extension');
assert.equal(looksLikeFilePath('main.rs'), true, 'Rust source file');
assert.equal(looksLikeFilePath('not-a-file'), false, 'Prose word without extension');
assert.equal(looksLikeFilePath('version-1.2.3'), false, 'Version number');
assert.equal(looksLikeFilePath('https://example.com/app.ts'), false, 'Web URL');
console.log('✔ Path recognition tests passed!\n');

// 2. Annotation splitting
console.log('--- Suite 2: Line annotation extraction ---');
const ann1 = splitAnnotation('src/main.ts:42');
assert.equal(ann1.path, 'src/main.ts');
assert.equal(ann1.line, 42);

const ann2 = splitAnnotation('src/main.ts:42:10');
assert.equal(ann2.path, 'src/main.ts');
assert.equal(ann2.line, 42);
assert.equal(ann2.col, 10);

const ann3 = splitAnnotation('file.py (line 120)');
assert.equal(ann3.path, 'file.py');
assert.equal(ann3.line, 120);

const ann4 = splitAnnotation('C:/app/code.ts#L88');
assert.equal(ann4.path, 'C:/app/code.ts');
assert.equal(ann4.line, 88);

const ann5 = splitAnnotation('C:/app/code.ts#L88-L100');
assert.equal(ann5.path, 'C:/app/code.ts');
assert.equal(ann5.line, 88);
console.log('✔ Line annotation tests passed!\n');

// 3. Multi-model Markdown scanning
console.log('--- Suite 3: Multi-model Markdown scanning ---');
const sampleText = `
Here are the files:
- Antigravity: [client.ts](file:///C:/Users/test/client.ts#L45-L60)
- WorkBuddy: see src/core/engine.ts:128 for details
- OpenZ: checkout \`lib/utils.py:50\` or \`README.md\`
- System UNC: \\\\wsl.localhost\\Ubuntu\\home\\user\\main.go
`;

const matches = findPathMatches(sampleText);
assert.equal(matches.length >= 5, true, `Expected at least 5 matches, got ${matches.length}`);
console.log(`Found ${matches.length} matches in sample multi-model text:`);
matches.forEach((m) => console.log(`  - [${m.raw}] -> ${JSON.stringify(splitAnnotation(m.raw))}`));
console.log('✔ Multi-model Markdown scanning passed!\n');

// 4. DSH resource URL formatting
console.log('--- Suite 4: DSH Resource Address formatting ---');
const sessionId = 'session-12345';
const cwd = 'C:/Users/test/project';

const addr1 = fileAddressFor(sessionId, cwd, 'src/index.ts');
assert.equal(addr1, 'dsh-resource://file/session/session-12345/src/index.ts');

const addr2 = fileAddressFor(sessionId, cwd, 'C:/Users/test/project/src/index.ts');
assert.equal(addr2, 'dsh-resource://file/session/session-12345/src/index.ts');

const addr3 = fileAddressFor(sessionId, cwd, 'C:/External/other.txt');
assert.equal(addr3, 'dsh-resource://file/session/session-12345/C:/External/other.txt');
console.log('✔ DSH Resource Address formatting passed!\n');

// 5. Workspace path resolution
console.log('--- Suite 5: Workspace path resolution ---');
const res1 = resolveWorkspacePath('C:\\Users\\test\\project', 'src\\index.ts');
assert.equal(res1, 'C:\\Users\\test\\project\\src\\index.ts');

const res2 = resolveWorkspacePath('/home/user/project', 'src/index.ts');
assert.equal(res2, '/home/user/project/src/index.ts');

const res3 = resolveWorkspacePath('C:\\Users\\test\\project', 'C:\\other\\file.txt');
assert.equal(res3, 'C:\\other\\file.txt');
console.log('✔ Workspace path resolution passed!\n');

console.log('======================================================');
console.log('✨ ALL PATH TESTS PASSED SUCCESSFULLY!');
console.log('======================================================');
