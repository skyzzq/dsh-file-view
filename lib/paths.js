/**
 * `lib/paths.js`
 * Pure logic for path recognition, line annotation extraction, URL exclusion,
 * and DSH resource URL formatting.
 */

/** File extensions treated as a real file reference when the token has no separator. */
export const BARE_NAME_EXTENSIONS = new Set([
  // code
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'cts', 'mts', 'json', 'jsonc', 'json5',
  'py', 'pyi', 'rb', 'go', 'rs', 'java', 'kt', 'kts', 'swift', 'c', 'h', 'cc', 'cpp',
  'cxx', 'hpp', 'cs', 'php', 'pl', 'pm', 'lua', 'r', 'jl', 'dart', 'scala', 'clj',
  'ex', 'exs', 'erl', 'hrl', 'fs', 'fsx', 'vb', 'asm', 's', 'sql', 'graphql', 'gql',
  'proto', 'thrift', 'vue', 'svelte', 'astro', 'elm', 'ml', 'mli', 'nim', 'zig', 'v',
  'sol', 'move', 'cairo', 'wat', 'wasm',
  // docs & config
  'md', 'mdx', 'markdown', 'rst', 'txt', 'text', 'adoc', 'org', 'tex', 'bib',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'properties', 'env', 'editorconfig',
  'gitignore', 'gitattributes', 'dockerignore', 'npmrc', 'nvmrc', 'babelrc',
  'eslintrc', 'prettierrc', 'stylelintrc', 'browserslistrc', 'lock',
  // web & assets
  'html', 'htm', 'xhtml', 'css', 'scss', 'sass', 'less', 'styl', 'stylus',
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'tiff',
  'psd', 'ai', 'sketch', 'fig', 'xd', 'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  // data
  'csv', 'tsv', 'psv', 'xml', 'plist', 'db', 'sqlite', 'sqlite3', 'parquet',
  'avro', 'ndjson', 'jsonl', 'xlsx', 'xls', 'xlsm', 'ods',
  // packages & archives
  'tgz', 'tar', 'gz', 'bz2', 'xz', 'zst', 'zip', 'rar', '7z', 'war',
  'whl', 'egg', 'gem', 'nupkg', 'deb', 'rpm', 'dmg', 'pkg', 'iso', 'img', 'vhd', 'vmdk',
  // misc
  'log', 'out', 'err', 'pid', 'sock', 'patch', 'diff', 'bak', 'tmp', 'temp',
  'crt', 'key', 'pem', 'cer', 'p12', 'pfx', 'jks', 'keystore',
  'ipynb', 'rmd', 'qmd', 'drawio', 'excalidraw', 'canvas', 'board',
]);

/** Recognised secondary extensions in compound filenames like .d.ts or .tar.gz */
export const COMPOUND_SUB_EXTENSIONS = new Set([
  'tar', 'd', 'test', 'spec', 'min', 'module', 'config'
]);

/** Extensions of executable binaries or scripts that should never be directly executed on click. */
export const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1', 'pif', 'hta', 'cpl', 'jar'
]);

/** Windows reserved device filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9). */
export const WINDOWS_RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

/**
 * Check whether a file path has an executable binary or script extension.
 * @param {string} path
 * @returns {boolean}
 */
export function isExecutablePath(path) {
  const ext = extensionOf(path);
  return EXECUTABLE_EXTENSIONS.has(ext);
}

/**
 * Check whether a token corresponds to a Windows reserved device name.
 * @param {string} token
 * @returns {boolean}
 */
export function isWindowsReservedName(token) {
  const base = token.split(/[/\\]/).pop() || '';
  const stem = base.split('.')[0].toLowerCase();
  return WINDOWS_RESERVED_NAMES.has(stem);
}

/**
 * Check whether a path points to an external remote UNC share (e.g. \\remote-server\share)
 * to prevent NTLM credential leakage over SMB. Local shares (wsl.localhost, wsl$, localhost)
 * are permitted.
 * @param {string} path
 * @returns {boolean}
 */
export function isRemoteUncPath(path) {
  const norm = String(path).replace(/^file:\/\//i, '');
  if (!norm.startsWith('\\\\') && !norm.startsWith('//')) return false;
  const host = norm.slice(2).split(/[/\\]/)[0]?.toLowerCase() || '';
  if (host === 'wsl.localhost' || host === 'wsl$' || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return false;
  }
  return true;
}

/** Trailing line/column annotations: `:12`, `:L12`, `:12:5`, ` (line 12)`, `, line 12`, ` (第 12 行)`, `#L12`, `#L12-L20`, supporting optional line wraps before annotation. */
export const TRAILING_ANNOTATION = /(?:(?:\s*|\s*\r?\n\s*)[,(]\s*(?:line|lines|行|第)\s*\d+(?:\s*[-–]\s*\d+)?\s*(?:行)?\s*\)?|(?:\s*:\s*(?:\r?\n\s*)?|\s*\r?\n\s*:\s*)L?\d+(?:\s*[:,]\s*\d+)?|(?:\s*|\s*\r?\n\s*)#L?\d+(?:-L?\d+)?)$/i;

/**
 * Normalize a wrapped path by collapsing newlines, indentation, and stripping zero-width characters.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeWrappedPath(raw) {
  let s = String(raw).replace(/[\u200b\u200c\u200d\u200e\u200f\ufeff\u00ad]/g, '');
  // Slashes on both sides of newline
  s = s.replace(/\\+[ \t]*\r?\n[ \t]*\\+/g, '\\');
  s = s.replace(/\/+[ \t]*\r?\n[ \t]*\/+/g, '/');
  // Slash on left
  s = s.replace(/\\+[ \t]*\r?\n[ \t]*/g, '\\');
  s = s.replace(/\/+[ \t]*\r?\n[ \t]*/g, '/');
  // Slash on right
  s = s.replace(/[ \t]*\r?\n[ \t]*\\+/g, '\\');
  s = s.replace(/[ \t]*\r?\n[ \t]*\/+/g, '/');
  // Hyphen / underscore wrap (keep the character)
  s = s.replace(/(-)[ \t]*\r?\n[ \t]*/g, (m, p) => p);
  s = s.replace(/(_)[ \t]*\r?\n[ \t]*/g, (m, p) => p);
  // Mid-token wrap without separator
  s = s.replace(/[ \t]*\r?\n[ \t]*/g, '');
  return s;
}

/**
 * Verify that a match spanning a newline does not falsely merge already-complete file entries.
 * @param {string} raw
 * @returns {boolean}
 */
export function isValidWrapMatch(raw) {
  if (!raw.includes('\n')) return true;
  const parts = raw.split(/\r?\n/);
  for (let i = 0; i < parts.length - 1; i++) {
    const lineHead = parts[i].trim();
    const ext = extensionOf(lineHead);
    if (ext !== '' && BARE_NAME_EXTENSIONS.has(ext)) {
      return false;
    }
  }
  return true;
}

/**
 * Whether a path uses a Windows drive or UNC prefix.
 * @param {string} value candidate text
 * @returns {boolean}
 */
export function isWindowsStylePath(value) {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith('\\\\');
}

/**
 * Whether a path is absolute in either spelling the Host accepts.
 * @param {string} path candidate text
 * @returns {boolean}
 */
export function isAbsoluteWorkspacePath(path) {
  return path.startsWith('/') || isWindowsStylePath(path);
}

/**
 * Extract the extension of a candidate token, lowercased and without the dot.
 * @param {string} token candidate text
 * @returns {string}
 */
export function extensionOf(token) {
  const base = token.split(/[/\\]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

/**
 * Whether a candidate token looks like a path the Host could resolve.
 *
 * @param {string} token candidate text
 * @returns {boolean}
 */
export function looksLikeFilePath(token) {
  if (token.length === 0 || token.length > 1024) return false;
  // Reject Windows reserved device names (CON, NUL, AUX, etc.)
  if (isWindowsReservedName(token)) return false;
  // Never treat an external URL host or explicit scheme as a path (except file://).
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(token) && !/^file:\/\//i.test(token)) return false;
  if (token.startsWith('//')) return false;
  if (isAbsoluteWorkspacePath(token)) return true;

  const ext = extensionOf(token);
  if (ext === '' || !BARE_NAME_EXTENSIONS.has(ext)) return false;

  const base = token.split(/[/\\]/).pop() || '';
  const dots = (base.match(/\./g) || []).length;
  if (dots > 1) {
    const parts = base.split('.');
    const secondLast = parts[parts.length - 2]?.toLowerCase();
    if (!COMPOUND_SUB_EXTENSIONS.has(secondLast)) {
      return false;
    }
  }

  // Reject tokens that begin with a non-path character class
  if (/^[^\w\u4e00-\u9fa5.\-\\/~]/.test(token)) return false;
  return true;
}

/**
 * Split a trailing line/column annotation off a match.
 *
 * @param {string} raw matched text
 * @returns {{ path: string, line: number | undefined, col: number | undefined }}
 */
export function splitAnnotation(raw) {
  const match = TRAILING_ANNOTATION.exec(raw);
  if (!match) return { path: normalizeWrappedPath(raw), line: undefined, col: undefined };
  const tail = match[0];
  const pathPart = raw.slice(0, raw.length - tail.length);
  const path = normalizeWrappedPath(pathPart);
  if (path.length === 0) return { path: normalizeWrappedPath(raw), line: undefined, col: undefined };
  const numbers = tail.match(/\d+/g);
  if (!numbers || numbers.length === 0) return { path, line: undefined, col: undefined };
  const line = Number(numbers[0]);
  const col = numbers.length > 1 && !tail.includes('-') && !tail.includes('–') ? Number(numbers[1]) : undefined;
  return { path, line: Number.isFinite(line) ? line : undefined, col };
}

/**
 * Build the `dsh-resource://file/session/<sessionId>/<path>` address.
 *
 * @param {string} sessionId session that resolves the path
 * @param {string | undefined} cwd session workspace root
 * @param {string} path absolute or workspace-relative path
 * @returns {string} resource address
 */
export function fileAddressFor(sessionId, cwd, path) {
  let clean = String(path).replace(/^file:\/\/(?:localhost)?\/?/i, '');
  try {
    clean = decodeURIComponent(clean);
  } catch (e) {
    /* ignore malformed URI */
  }
  let normalized = clean.replace(/\\/g, '/');
  if (/^\/[A-Za-z]:\//.test(normalized)) {
    normalized = normalized.slice(1);
  }

  const encodeSegment = (segment) => encodeURIComponent(segment).replace(/%3A/gi, ':');
  const encodePath = (value) => value.split('/').map(encodeSegment).join('/');
  const sessionFile = (relative) =>
    `dsh-resource://file/session/${encodeSegment(sessionId)}/${encodePath(relative)}`;

  if (!isAbsoluteWorkspacePath(normalized)) return sessionFile(normalized);
  const root = cwd === undefined || cwd === null ? '' : String(cwd).replace(/\\/g, '/').replace(/\/+$/, '');
  if (root !== '' && normalized === root) return sessionFile('');
  if (root !== '' && normalized.startsWith(`${root}/`)) return sessionFile(normalized.slice(root.length + 1));
  return sessionFile(normalized);
}

/**
 * Resolve a workspace-relative path against the session root.
 *
 * @param {string | undefined} cwd session workspace root
 * @param {string} path absolute or workspace-relative path
 * @returns {string} absolute path, or the input when no root is known
 */
export function resolveWorkspacePath(cwd, path) {
  let cleanPath = String(path).replace(/^file:\/\/(?:localhost)?\/?/i, '');
  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch (e) {
    /* ignore malformed URI */
  }
  if (/^\/[A-Za-z]:[/\\]/.test(cleanPath)) {
    cleanPath = cleanPath.slice(1);
  }
  if (isAbsoluteWorkspacePath(cleanPath)) return cleanPath;
  if (cwd === undefined || cwd === null || cwd === '') return cleanPath;
  const separator = isWindowsStylePath(cwd) && cwd.includes('\\') ? '\\' : '/';
  return `${String(cwd).replace(/[/\\]+$/, '')}${separator}${cleanPath.replace(/^[/\\]+/, '')}`;
}

/**
 * Locate explicit URL spans in a text run so the path scanner can skip them.
 *
 * @param {string} text full node text
 * @returns {Array<{ start: number, end: number }>}
 */
export function findUrlSpans(text) {
  const spans = [];
  const scanner = /\b(?:https?|ftp):\/\/[^\s"'`<>)\]]+|\bwww\.[^\s"'`<>)\]]+/gi;
  let match;
  while ((match = scanner.exec(text)) !== null) {
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

/**
 * Extend a match past its path when a line-style annotation immediately follows.
 *
 * @param {string} text full node text
 * @param {number} start index where the match begins
 * @param {number} end index just past the path
 * @returns {string} match text from `start`, including the annotation when present
 */
export function extendWithAnnotation(text, start, end) {
  const rest = text.slice(end);
  const colon = /^(?::\s*(?:\r?\n\s*)?L?\d+(?:\s*[:,]\s*\d+)?|(?:\r?\n\s*):\s*L?\d+(?:\s*[:,]\s*\d+)?)/i.exec(rest);
  if (colon) return text.slice(start, end) + colon[0];
  const paren = /^(?:\s*|\s*\r?\n\s*)\(\s*(?:line|lines|行|第)\s*\d+(?:\s*[-–]\s*\d+)?\s*(?:行)?\s*\)/i.exec(rest);
  if (paren) return text.slice(start, end) + paren[0];
  const hashL = /^(?:\s*|\s*\r?\n\s*)#L?\d+(?:-L?\d+)?/i.exec(rest);
  if (hashL) return text.slice(start, end) + hashL[0];
  return text.slice(start, end);
}

/**
 * Find every file reference inside one text run, supporting wrapped lines and zero-width spaces.
 *
 * @param {string} text text of one node
 * @returns {Array<{ start: number, end: number, raw: string }>} non-overlapping matches in order
 */
export function findPathMatches(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const results = [];

  const SEG_NODOT = '[\\w\\u4e00-\\u9fa5@+%$~\\u200b\\u200c\\u200d\\u200e\\u200f\\ufeff\\u00ad-]';
  const SEG = '[\\w\\u4e00-\\u9fa5.@+%$~\\u200b\\u200c\\u200d\\u200e\\u200f\\ufeff\\u00ad-]';
  const PATH_SEP = '(?:[/\\\\][ \\t]*\\r?\\n[ \\t]*|[/\\\\]|[ \\t]*\\r?\\n[ \\t]*[/\\\\]|[-_][ \\t]*\\r?\\n[ \\t]*)';
  const DELIM_WRAP = '[-_][ \\t]*\\r?\\n[ \\t]*';
  const MID_WORD_WRAP = '[ \\t]*\\r?\\n[ \\t]*';
  const EXT = '\\.[A-Za-z0-9]{1,12}';
  const BOUNDARY = '(?<=[\\s"\'`<>([\\]]|^)';

  const P_FILE = 'file://(?:localhost)?/?(?:[A-Za-z]:' + PATH_SEP + '|/)?(?:' + SEG + '+' + PATH_SEP + ')*' + SEG + '+' + EXT;
  const P_WIN = '[A-Za-z]:' + PATH_SEP + '(?:' + SEG + '+' + PATH_SEP + ')*' + SEG + '+' + EXT;
  const P_UNC = '\\\\\\\\(?:' + SEG + '+' + PATH_SEP + ')+' + SEG + '+' + EXT;
  const P_POSIX = '(?<=[\\s"\'`<>([\\]]|^)/(?!/)(?:' + SEG + '+' + PATH_SEP + ')*' + SEG + '+' + EXT;
  const P_REL = BOUNDARY + '(?:\\.{0,2}[/\\\\])' + '(?:' + SEG + '+' + PATH_SEP + ')*' + SEG + '+' + EXT +
    '|' + BOUNDARY + '(?:' + SEG + '+[/\\\\])' + '(?:' + SEG + '+' + PATH_SEP + ')*' + SEG + '+' + EXT;
  const P_BARE_WRAP = BOUNDARY + '(?:' + SEG_NODOT + '+' + DELIM_WRAP + SEG + '+' + EXT + '|' + SEG_NODOT + '{8,}' + MID_WORD_WRAP + SEG + '+' + EXT + ')';
  const P_BARE = BOUNDARY + SEG + '+' + EXT;

  const scanner = new RegExp(
    '(?:' +
      P_FILE + '|' +
      P_WIN + '|' +
      P_UNC + '|' +
      P_POSIX + '|' +
      P_REL + '|' +
      P_BARE_WRAP + '|' +
      P_BARE +
    ')',
    'gu'
  );

  const urlSpans = findUrlSpans(text);

  let match;
  while ((match = scanner.exec(text)) !== null) {
    const raw = match[0];
    if (!isValidWrapMatch(raw)) continue;
    const normalized = normalizeWrappedPath(raw);
    if (!looksLikeFilePath(normalized)) continue;
    const start = match.index;
    if (urlSpans.some((span) => start >= span.start && start < span.end)) {
      scanner.lastIndex = start + raw.length;
      continue;
    }

    // Guard against function calls like `console.log(...)` or `logger.log(...)`
    const nextChar = text.charAt(start + raw.length);
    if (nextChar === '(' && !/^\s*(?:\r?\n\s*)?\(\s*(?:line|lines|行|第)\s*\d+/i.test(text.slice(start + raw.length))) {
      scanner.lastIndex = start + raw.length;
      continue;
    }

    const withAnnotation = extendWithAnnotation(text, start, start + raw.length);
    results.push({ start, end: start + withAnnotation.length, raw: withAnnotation });
    scanner.lastIndex = start + withAnnotation.length;
  }

  return results;
}
