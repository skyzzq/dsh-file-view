import assert from 'node:assert/strict';
import {
  findPathMatches,
  normalizeWrappedPath,
  splitAnnotation,
  looksLikeFilePath
} from '../lib/paths.js';

console.log('🔄 Running dsh-file-view WRAPPED LONG FILENAME & PATH TEST SUITE...\n');

// ============================================================================
// Group 1: Absolute Path Line Wrapping
// ============================================================================
console.log('--- Group 1: Absolute Path Line Wrapping ---');

const winWrap1 = 'File at C:\\Users\\zhaozhongqi\\Documents\\deepseek-harness\\plugins\\\r\n    dsh-file-view\\lib\\paths.js check please';
const m1 = findPathMatches(winWrap1);
assert.equal(m1.length, 1);
assert.equal(normalizeWrappedPath(m1[0].raw), 'C:\\Users\\zhaozhongqi\\Documents\\deepseek-harness\\plugins\\dsh-file-view\\lib\\paths.js');

const winWrap2 = 'Path C:\\Users\\test\\project\r\n\\src\\index.ts ready';
const m2 = findPathMatches(winWrap2);
assert.equal(m2.length, 1);
assert.equal(normalizeWrappedPath(m2[0].raw), 'C:\\Users\\test\\project\\src\\index.ts');

const posixWrap1 = 'Look at /var/log/nginx/\n    access.log today';
const m3 = findPathMatches(posixWrap1);
assert.equal(m3.length, 1);
assert.equal(normalizeWrappedPath(m3[0].raw), '/var/log/nginx/access.log');

const posixWrap2 = 'Package /home/user/my-very-long-project-name-\n    subfolder/app.py ready';
const m4 = findPathMatches(posixWrap2);
assert.equal(m4.length, 1);
assert.equal(normalizeWrappedPath(m4[0].raw), '/home/user/my-very-long-project-name-subfolder/app.py');

console.log('✔ All absolute path line wrap tests passed!\n');

// ============================================================================
// Group 2: Relative, UNC & file:// Line Wrapping
// ============================================================================
console.log('--- Group 2: Relative, UNC & file:// Line Wrapping ---');

const relWrap = 'Run src/components/very/deep/folder/\n    MyComponent.tsx now';
const m5 = findPathMatches(relWrap);
assert.equal(m5.length, 1);
assert.equal(normalizeWrappedPath(m5[0].raw), 'src/components/very/deep/folder/MyComponent.tsx');

const uncWrap = 'Path \\\\wsl.localhost\\Ubuntu\\home\\user\\\nproject\\main.go exists';
const m6 = findPathMatches(uncWrap);
assert.equal(m6.length, 1);
assert.equal(normalizeWrappedPath(m6[0].raw), '\\\\wsl.localhost\\Ubuntu\\home\\user\\project\\main.go');

const fileWrap = 'Open file:///C:/Users/test/folder/\nfile.json here';
const m7 = findPathMatches(fileWrap);
assert.equal(m7.length, 1);
assert.equal(normalizeWrappedPath(m7[0].raw), 'file:///C:/Users/test/folder/file.json');

console.log('✔ All relative, UNC & file:// line wrap tests passed!\n');

// ============================================================================
// Group 3: Bare Long Filenames Wrapped Mid-Name
// ============================================================================
console.log('--- Group 3: Bare Long Filenames Wrapped Mid-Name ---');

const bareUnderscore = 'File very_long_file_name_that_wraps_\nhere.ts is compiled';
const m8 = findPathMatches(bareUnderscore);
assert.equal(m8.length, 1);
assert.equal(normalizeWrappedPath(m8[0].raw), 'very_long_file_name_that_wraps_here.ts');

const bareHyphen = 'File my-super-long-component-name-part1-\npart2.tsx created';
const m9 = findPathMatches(bareHyphen);
assert.equal(m9.length, 1);
assert.equal(normalizeWrappedPath(m9[0].raw), 'my-super-long-component-name-part1-part2.tsx');

const bareMidWord = 'File mySuperLongFileNameWithoutAnySeparators\nContinuation.tsx ready';
const m10 = findPathMatches(bareMidWord);
assert.equal(m10.length, 1);
assert.equal(normalizeWrappedPath(m10[0].raw), 'mySuperLongFileNameWithoutAnySeparatorsContinuation.tsx');

console.log('✔ All bare long filenames wrapped mid-name tests passed!\n');

// ============================================================================
// Group 4: Wrapped Line Annotations
// ============================================================================
console.log('--- Group 4: Wrapped Line Annotations ---');

const anno1 = 'Check src/utils.ts:\n    128 for details';
const s1 = splitAnnotation(findPathMatches(anno1)[0].raw);
assert.equal(s1.path, 'src/utils.ts');
assert.equal(s1.line, 128);

const anno2 = 'Check src/utils.ts\n    :128 for details';
const s2 = splitAnnotation(findPathMatches(anno2)[0].raw);
assert.equal(s2.path, 'src/utils.ts');
assert.equal(s2.line, 128);

const anno3 = 'Check src/utils.ts\n    #L45-L60 for details';
const s3 = splitAnnotation(findPathMatches(anno3)[0].raw);
assert.equal(s3.path, 'src/utils.ts');
assert.equal(s3.line, 45);

const anno4 = 'Check src/utils.ts\n    (第 99 行) for details';
const s4 = splitAnnotation(findPathMatches(anno4)[0].raw);
assert.equal(s4.path, 'src/utils.ts');
assert.equal(s4.line, 99);

console.log('✔ All wrapped line annotation tests passed!\n');

// ============================================================================
// Group 5: Zero-Width Characters & Discretionary Hyphens
// ============================================================================
console.log('--- Group 5: Zero-Width Characters & Discretionary Hyphens ---');

const zwspPath = 'Path: C:\\Users\\test\\my\u200blong\u00adfile.txt ok';
const mZwsp = findPathMatches(zwspPath);
assert.equal(mZwsp.length, 1);
assert.equal(normalizeWrappedPath(mZwsp[0].raw), 'C:\\Users\\test\\mylongfile.txt');

const bomPath = 'file:///C:/test/\ufeffmain.go';
const mBom = findPathMatches(bomPath);
assert.equal(mBom.length, 1);
assert.equal(normalizeWrappedPath(mBom[0].raw), 'file:///C:/test/main.go');

console.log('✔ Zero-width and soft-hyphen sanitization verified!\n');

// ============================================================================
// Group 6: Consecutive Files on Separate Lines Isolation
// ============================================================================
console.log('--- Group 6: Consecutive Files on Separate Lines Isolation ---');

const multilineFiles = 'Check these:\nREADME.md\npackage.json\nsrc/index.ts\nDone.';
const multiMatches = findPathMatches(multilineFiles).map(m => normalizeWrappedPath(m.raw));
assert.deepEqual(multiMatches, ['README.md', 'package.json', 'src/index.ts']);

console.log('✔ Consecutive files on separate lines safely isolated without false merging!\n');

console.log('================================================================');
console.log('🎉 ALL WRAPPED LONG FILENAME & PATH TESTS PASSED 100%!');
console.log('================================================================\n');
