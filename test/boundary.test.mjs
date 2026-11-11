/**
 * `test/boundary.test.mjs`
 * Comprehensive boundary & edge case test suite for dsh-file-view:
 * - Windows UNC / WSL paths
 * - Spaces & URL encodings
 * - Compound file extensions (.d.ts, .tar.gz, .test.tsx, .min.js, etc.)
 * - Chinese & Unicode file paths and line annotations
 * - Diverse annotation syntax (:42, :L42, #L42, (第42行), etc.)
 * - Strict false-positive filtering (URLs, versions, console.log, decimals)
 * - Sentence punctuation and quotation boundaries
 * - Workspace path resolution & DSH resource URL formatting
 */

import assert from 'node:assert/strict';
import {
  looksLikeFilePath,
  splitAnnotation,
  fileAddressFor,
  resolveWorkspacePath,
  findPathMatches
} from '../lib/paths.js';

console.log('🚀 Running dsh-file-view EXTENSIVE BOUNDARY TEST SUITE...\n');

// ============================================================================
// Group 1: Compound Extensions & Real-world Web/Dev Filenames
// ============================================================================
console.log('--- Group 1: Compound Extensions ---');
const compoundFiles = [
  'types.d.ts',
  'api.d.mts',
  'archive.tar.gz',
  'backup.tar.bz2',
  'bundle.min.js',
  'style.min.css',
  'Component.test.tsx',
  'User.spec.js',
  'theme.module.css',
  'vite.config.ts'
];

for (const file of compoundFiles) {
  assert.equal(looksLikeFilePath(file), true, `Compound file ${file} should be recognized`);
  const matches = findPathMatches(`Check out ${file} in project`);
  assert.equal(matches.length, 1, `Should find match for ${file}`);
  assert.equal(matches[0].raw, file);
}
console.log(`✔ All ${compoundFiles.length} compound extension tests passed!\n`);

// ============================================================================
// Group 2: Chinese & Non-ASCII Unicode Paths
// ============================================================================
console.log('--- Group 2: Chinese & Unicode Paths ---');
const unicodeCases = [
  { text: '请查看 测试.md 文件', expected: '测试.md' },
  { text: '组件位于 src/组件/按钮.vue，请核对', expected: 'src/组件/按钮.vue' },
  { text: '配置文件为 config/本地配置.yaml:35', expected: 'config/本地配置.yaml:35', path: 'config/本地配置.yaml', line: 35 },
  { text: 'Windows路径：C:\\项目\\说明文档\\readme.md:20', expected: 'C:\\项目\\说明文档\\readme.md:20', path: 'C:\\项目\\说明文档\\readme.md', line: 20 },
  { text: '混合路径 /var/log/应用日志/error.log', expected: '/var/log/应用日志/error.log' }
];

for (const tc of unicodeCases) {
  const matches = findPathMatches(tc.text);
  assert.equal(matches.length, 1, `Failed to find match in: ${tc.text}`);
  assert.equal(matches[0].raw, tc.expected);
  if (tc.path) {
    const split = splitAnnotation(matches[0].raw);
    assert.equal(split.path, tc.path);
    assert.equal(split.line, tc.line);
  }
}
console.log(`✔ All ${unicodeCases.length} Chinese & Unicode path tests passed!\n`);

// ============================================================================
// Group 3: Diverse Line Annotation Formats
// ============================================================================
console.log('--- Group 3: Diverse Line Annotations ---');
const annotationCases = [
  { raw: 'src/main.ts:42', expectedPath: 'src/main.ts', line: 42, col: undefined },
  { raw: 'src/main.ts:42:15', expectedPath: 'src/main.ts', line: 42, col: 15 },
  { raw: 'src/main.ts:L42', expectedPath: 'src/main.ts', line: 42, col: undefined },
  { raw: 'src/main.ts#L42', expectedPath: 'src/main.ts', line: 42, col: undefined },
  { raw: 'src/main.ts#L42-L80', expectedPath: 'src/main.ts', line: 42, col: undefined },
  { raw: 'src/main.ts (line 42)', expectedPath: 'src/main.ts', line: 42, col: undefined },
  { raw: 'src/main.ts (lines 42-50)', expectedPath: 'src/main.ts', line: 42, col: undefined },
  { raw: 'src/main.ts (第 42 行)', expectedPath: 'src/main.ts', line: 42, col: undefined },
  { raw: 'src/main.ts (第42-50行)', expectedPath: 'src/main.ts', line: 42, col: undefined },
  { raw: 'src/main.ts, line 42', expectedPath: 'src/main.ts', line: 42, col: undefined }
];

for (const tc of annotationCases) {
  const split = splitAnnotation(tc.raw);
  assert.equal(split.path, tc.expectedPath, `Path mismatch for ${tc.raw}`);
  assert.equal(split.line, tc.line, `Line mismatch for ${tc.raw}`);
  assert.equal(split.col, tc.col, `Col mismatch for ${tc.raw}`);
}
console.log(`✔ All ${annotationCases.length} line annotation parsing tests passed!\n`);

// ============================================================================
// Group 4: False Positive Filtering (Must NOT match)
// ============================================================================
console.log('--- Group 4: False Positive Filtering ---');
const falsePositives = [
  'https://github.com/deepseek-ai/DeepSeek-V3/blob/main/README.md#L10',
  'http://localhost:8080/api/v1/health.json',
  'www.example.com/index.html',
  'version 1.2.3 was released',
  'node v20.10.0',
  '3.1415926 is pi',
  'console.log("hello world")',
  'logger.log(message)',
  'Math.log(2.718)',
  'google.com is a search engine',
  'e.g. something',
  'i.e. that is'
];

for (const text of falsePositives) {
  const matches = findPathMatches(text);
  assert.equal(matches.length, 0, `False positive detected in "${text}": ${JSON.stringify(matches)}`);
}
console.log(`✔ All ${falsePositives.length} false positive rejection tests passed!\n`);

// ============================================================================
// Group 5: Punctuation, Quotes & Markdown Enclosure Boundaries
// ============================================================================
console.log('--- Group 5: Punctuation & Quotes Boundaries ---');
const punctuationCases = [
  { text: '(see src/utils.ts)', expected: 'src/utils.ts' },
  { text: 'Look at "src/utils.ts", ok?', expected: 'src/utils.ts' },
  { text: "Open 'src/utils.ts'; now.", expected: 'src/utils.ts' },
  { text: 'Check `src/utils.ts` please.', expected: 'src/utils.ts' },
  { text: 'Check `src/utils.ts:88` please.', expected: 'src/utils.ts:88' },
  { text: 'Is file at src/utils.ts?', expected: 'src/utils.ts' },
  { text: 'Great work on src/utils.ts!', expected: 'src/utils.ts' },
  { text: '[my link](file:///C:/Users/test/doc.md#L20)', expected: 'file:///C:/Users/test/doc.md#L20' }
];

for (const tc of punctuationCases) {
  const matches = findPathMatches(tc.text);
  assert.equal(matches.length, 1, `Failed to isolate path from punctuation in "${tc.text}"`);
  assert.equal(matches[0].raw, tc.expected);
}
console.log(`✔ All ${punctuationCases.length} punctuation isolation tests passed!\n`);

// ============================================================================
// Group 6: Windows UNC, WSL & file:// Schemes
// ============================================================================
console.log('--- Group 6: UNC, WSL & file:// Schemes ---');
const uncCases = [
  '\\\\wsl.localhost\\Ubuntu\\home\\user\\app.py:10',
  '\\\\wsl$\\Debian\\var\\log\\syslog.log',
  '\\\\192.168.1.10\\shared\\data.csv',
  'file:///C:/Users/user/AppData/Local/Temp/test.ts:45',
  'file://localhost/C:/Users/user/AppData/Local/Temp/test.ts:45'
];

for (const unc of uncCases) {
  const matches = findPathMatches(`Found in ${unc} file`);
  assert.equal(matches.length, 1, `Failed to match UNC/file scheme: ${unc}`);
  assert.equal(matches[0].raw, unc);
}

// Check resolution
const resolvedUnc = resolveWorkspacePath('C:\\workspace', '\\\\wsl.localhost\\Ubuntu\\home\\user\\app.py');
assert.equal(resolvedUnc, '\\\\wsl.localhost\\Ubuntu\\home\\user\\app.py', 'UNC path should stay intact');

const resolvedFileScheme = resolveWorkspacePath('C:\\workspace', 'file:///C:/MyDir/app.py');
assert.equal(resolvedFileScheme, 'C:/MyDir/app.py', 'file:/// should be stripped on absolute Windows path');

const resolvedLocalhost = resolveWorkspacePath('C:\\workspace', 'file://localhost/C:/MyDir/app.py');
assert.equal(resolvedLocalhost, 'C:/MyDir/app.py', 'file://localhost/ should be stripped');
console.log(`✔ All UNC, WSL & file:// scheme tests passed!\n`);

// ============================================================================
// Group 7: Spaces & URL Encoding
// ============================================================================
console.log('--- Group 7: Spaces & URL Encoding ---');
const encodedFile = 'file:///C:/My%20Documents/%E6%B5%8B%E8%AF%95/app.py#L42';
const split = splitAnnotation(encodedFile);
assert.equal(split.line, 42);

const resolvedEncoded = resolveWorkspacePath('C:/workspace', split.path);
assert.equal(resolvedEncoded, 'C:/My Documents/测试/app.py', 'Encoded URI should be decoded to physical path with spaces and Chinese');

const addrInside = fileAddressFor('session-test', 'C:/My Documents/测试', split.path);
assert.equal(addrInside, 'dsh-resource://file/session/session-test/app.py', 'Inside workspace should become session relative');

const addrOutside = fileAddressFor('session-test', 'C:/other-workspace', split.path);
assert.ok(addrOutside.startsWith('dsh-resource://file/session/session-test/C:/My%20Documents/'), 'External workspace path should be encoded');
console.log('✔ Spaces & URL encoding tests passed!\n');

// ============================================================================
// Group 8: DSH Resource URL Formatting (Session CWD edge cases)
// ============================================================================
console.log('--- Group 8: DSH Resource Address Edge Cases ---');
const sess = 'session-xyz';

// Trailing slashes
assert.equal(
  fileAddressFor(sess, 'C:/workspace/', 'C:/workspace/src/app.ts'),
  'dsh-resource://file/session/session-xyz/src/app.ts'
);

// Windows backslashes in CWD
assert.equal(
  fileAddressFor(sess, 'C:\\workspace', 'src\\app.ts'),
  'dsh-resource://file/session/session-xyz/src/app.ts'
);

// Relative path
assert.equal(
  fileAddressFor(sess, 'C:/workspace', 'index.js'),
  'dsh-resource://file/session/session-xyz/index.js'
);

// Root path itself
assert.equal(
  fileAddressFor(sess, 'C:/workspace', 'C:/workspace'),
  'dsh-resource://file/session/session-xyz/'
);
console.log('✔ All DSH resource address edge cases passed!\n');

console.log('================================================================');
console.log('🎉 ALL 8 GROUPS OF EXTENSIVE BOUNDARY TESTS PASSED 100%!');
console.log('================================================================');
