/**
 * `src/client.body.js`
 * Main client runtime logic for dsh-file-view.
 */

// ── 配置 ──────────────────────────────────────────────────────────
var STORAGE_KEY = 'dsh-file-view:config:v1';

var DEFAULTS = {
  enabled: true,
  accentPreset: 'default',
  accentCustom: '',
  clickAction: 'preview',
  underline: true,
  scanCode: false
};

var PRESET_ALIASES = { blue: 'deepseek' };

var config = readConfig();
var listeners = new Set();

function normalizeConfig(raw) {
  var src = raw && typeof raw === 'object' ? raw : {};
  var preset = typeof src.accentPreset === 'string' ? src.accentPreset : DEFAULTS.accentPreset;
  if (Object.prototype.hasOwnProperty.call(PRESET_ALIASES, preset)) preset = PRESET_ALIASES[preset];
  var known = false;
  for (var i = 0; i < ACCENT_PRESETS.length; i++) if (ACCENT_PRESETS[i].id === preset) known = true;
  if (preset === 'custom') known = true;
  return {
    enabled: src.enabled === undefined ? DEFAULTS.enabled : src.enabled !== false,
    accentPreset: known ? preset : DEFAULTS.accentPreset,
    accentCustom: typeof src.accentCustom === 'string' ? src.accentCustom : DEFAULTS.accentCustom,
    clickAction: src.clickAction === 'open' ? 'open' : 'preview',
    underline: src.underline === undefined ? DEFAULTS.underline : src.underline !== false,
    scanCode: src.scanCode === undefined ? DEFAULTS.scanCode : src.scanCode === true
  };
}

function readConfig() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? normalizeConfig(null) : normalizeConfig(JSON.parse(raw));
  } catch (e) {
    return normalizeConfig(null);
  }
}

function fileLinkConfig() {
  return config;
}

function subscribeConfig(fn) {
  listeners.add(fn);
  return function () {
    listeners.delete(fn);
  };
}

function updateFileLinkConfig(patch) {
  config = normalizeConfig(Object.assign({}, config, patch));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    /* 隐私模式/配额满：配置退化为本次会话有效 */
  }
  listeners.forEach(function (fn) {
    try {
      fn(config);
    } catch (e) {
      /* 单个订阅者出错不影响其它订阅者 */
    }
  });
  return config;
}

/** 解析当前强调色的浅/深两套值；空字符串表示交给宿主主题。 */
function accentColorOf(cfg, scheme) {
  if (!cfg) return '';
  if (cfg.accentPreset === 'custom') {
    var custom = String(cfg.accentCustom || '').trim();
    return isHexColor(custom) ? custom : '';
  }
  for (var i = 0; i < ACCENT_PRESETS.length; i++) {
    if (ACCENT_PRESETS[i].id === cfg.accentPreset) return ACCENT_PRESETS[i][scheme] || '';
  }
  return '';
}

function isHexColor(value) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}

function accentTokens(cfg) {
  var tokens = {};
  var light = accentColorOf(cfg, 'light');
  var dark = accentColorOf(cfg, 'dark');
  if (light === '' && dark === '') return null;
  var modes = {
    light: light === '' ? dark : light,
    dark: dark === '' ? light : dark
  };
  var i;
  for (i = 0; i < ACCENT_TOKENS.length; i++) tokens[ACCENT_TOKENS[i]] = modes;
  for (i = 0; i < ACCENT_STATIC_TOKENS.length; i++) tokens[ACCENT_STATIC_TOKENS[i]] = modes;
  return tokens;
}

// ── 样式 ──────────────────────────────────────────────────────────
var STYLE_ID = 'dsh-file-view-style';

var LINK_ACCENT = 'var(--dsw-alias-state-business-primary,#4176e6)';

function styleText(cfg) {
  var underline = cfg.underline
    ? 'border-bottom:1px dashed ' + LINK_ACCENT + ';'
    : 'border-bottom:0;';
  return (
    '.dshfl-link{' +
    'color:' + LINK_ACCENT + ';' +
    'cursor:pointer;' +
    'border-radius:2px;' +
    underline +
    'transition:background-color .12s ease;' +
    '}' +
    '.dshfl-link:hover{background:color-mix(in srgb,' + LINK_ACCENT + ' 16%,transparent);}' +
    '.dshfl-link:active{background:color-mix(in srgb,' + LINK_ACCENT + ' 26%,transparent);}' +
    '.dshfl-link[data-dshfl-missing="1"]{color:var(--dsw-alias-label-tertiary,#94a3b8);' +
    'border-bottom-style:dotted;}' +
    '.dshfl-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);' +
    'padding:8px 14px;border-radius:8px;font-size:12px;z-index:2147483000;' +
    'background:var(--dsw-alias-bg-overlay,rgba(24,24,27,.94));' +
    'color:var(--dsw-alias-label-primary,#fafafa);' +
    'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));' +
    'box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:none;' +
    'opacity:0;transition:opacity .16s ease;}' +
    '.dshfl-toast[data-show="1"]{opacity:1;}'
  );
}

function ensureStyle(cfg) {
  var el = document.getElementById(STYLE_ID);
  if (el === null) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = styleText(cfg);
  return el;
}

// ── 提示 ──────────────────────────────────────────────────────────
var toastTimer = null;

function toast(message) {
  var el = document.getElementById('dshfl-toast');
  if (el === null) {
    el = document.createElement('div');
    el.id = 'dshfl-toast';
    el.className = 'dshfl-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.setAttribute('data-show', '1');
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(function () {
    el.setAttribute('data-show', '0');
  }, 2200);
}

// ── 文本节点包裹 ──────────────────────────────────────────────────
var MAX_SCAN_TEXT_LEN = 32768;
var scannedTextValues = new WeakMap();

var SKIP_TAGS = {
  A: 1, BUTTON: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1,
  PRE: 1, SVG: 1, CODE: 1, KBD: 1, SAMP: 1
};

/** 该文本节点是否值得扫描。 */
function acceptableTextNode(node, cfg) {
  if (!node.nodeValue || node.nodeValue.length < 4 || node.nodeValue.length > MAX_SCAN_TEXT_LEN) return false;
  if (scannedTextValues.get(node) === node.nodeValue) return false;
  var parent = node.parentElement;
  if (parent === null) return false;
  if (parent.closest('.dshfl-link, .dsh-think-time-pill, .dsh-think-step-chip')) return false;
  var tag = parent.tagName;
  if (SKIP_TAGS[tag] === 1) {
    if (tag !== 'CODE') return false;
    if (!cfg.scanCode) return false;
    if (parent.closest('pre') !== null) return false;
  }
  return true;
}

/** 把一个文本节点里的文件路径包成可点击 span。返回是否改动。 */
function wrapTextNode(node, cfg) {
  if (!acceptableTextNode(node, cfg)) return false;
  var text = node.nodeValue;
  var matches = findPathMatches(text);
  if (matches.length === 0) {
    scannedTextValues.set(node, text);
    return false;
  }

  var parent = node.parentNode;
  if (parent === null) return false;
  var frag = document.createDocumentFragment();
  var cursor = 0;

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    if (m.start < cursor) continue;
    if (m.start > cursor) {
      var headNode = document.createTextNode(text.slice(cursor, m.start));
      scannedTextValues.set(headNode, headNode.nodeValue);
      frag.appendChild(headNode);
    }
    var split = splitAnnotation(m.raw);
    var span = document.createElement('span');
    span.className = 'dshfl-link';
    span.setAttribute('data-dshfl-path', split.path);
    if (split.line !== undefined) span.setAttribute('data-dshfl-line', String(split.line));
    span.setAttribute('role', 'link');
    span.setAttribute('tabindex', '0');
    span.title = '单击预览 · Ctrl+单击用默认程序打开 · Alt+单击定位';
    span.textContent = m.raw;
    frag.appendChild(span);
    cursor = m.end;
  }
  if (cursor < text.length) {
    var tailNode = document.createTextNode(text.slice(cursor));
    scannedTextValues.set(tailNode, tailNode.nodeValue);
    frag.appendChild(tailNode);
  }
  parent.replaceChild(frag, node);
  return true;
}

/** 扫描一个子树；limit 防止一次性处理过多节点。 */
function scanTree(root, cfg) {
  if (!root || root.nodeType !== 1) return 0;
  if (root.closest('.dshfl-link')) return 0;
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      return acceptableTextNode(node, cfg) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  var pending = [];
  var node;
  var count = 0;
  while ((node = walker.nextNode()) !== null && count < 400) {
    pending.push(node);
    count++;
  }
  var changed = 0;
  for (var i = 0; i < pending.length; i++) {
    if (wrapTextNode(pending[i], cfg)) changed++;
  }
  return changed;
}

// ── 打开文件 ──────────────────────────────────────────────────────
/** 当前活跃会话：主视图保留计数最高的那个。 */
function activeSession(ctx) {
  try {
    var snap = ctx.sessions.list.getSnapshot();
    var rows = snap && snap.byId ? snap.byId : null;
    if (rows === null) return null;
    var best = null;
    var bestScore = 0;
    for (var id in rows) {
      if (!Object.prototype.hasOwnProperty.call(rows, id)) continue;
      var row = rows[id];
      var score = row && row.retainedBy ? row.retainedBy.mainView || 0 : 0;
      if (score > bestScore) {
        bestScore = score;
        best = { id: id, cwd: row.cwd };
      }
    }
    return best;
  } catch (e) {
    return null;
  }
}

/** 在右侧栏打开预览（与官方产物 chip 同一路径）。 */
function previewPath(ctx, sessionId, cwd, path, line) {
  var url = fileAddressFor(sessionId, cwd, path);
  if (line === undefined) ctx.sidebarRight.openResource(url);
  else ctx.sidebarRight.openResource(url, { params: { line: line } });
}

/** 交给宿主桌面打开/定位。返回 Promise<boolean>。 */
function hostOpen(ctx, absolutePath, action) {
  var request = action === 'reveal' ? { path: absolutePath, action: 'reveal' } : { path: absolutePath };
  return Promise.resolve()
    .then(function () {
      return ctx.remote.session.openWorkspacePath(request);
    })
    .then(function (result) {
      return Boolean(result && result.ok);
    })
    .catch(function () {
      return false;
    });
}

function handleActivate(ctx, el, event) {
  var cfg = config;
  if (!cfg.enabled) return;
  var rawPath = el.getAttribute('data-dshfl-path') || el.getAttribute('href');
  if (!rawPath) return;
  var split = splitAnnotation(rawPath);
  var path = split.path;
  var lineAttr = el.getAttribute('data-dshfl-line');
  var line = lineAttr !== null && lineAttr !== '' ? Number(lineAttr) : split.line;

  try {
    path = decodeURIComponent(path);
  } catch (e) {
    /* ignore malformed URI */
  }

  var session = activeSession(ctx);
  if (session === null) {
    toast('找不到当前会话，无法解析路径');
    return;
  }

  var modifierOpen = event.ctrlKey || event.metaKey;
  var modifierReveal = event.altKey;
  var isExe = isExecutablePath(path);
  var isRemoteUnc = isRemoteUncPath(path);

  if (modifierReveal) {
    if (isRemoteUnc) {
      toast('安全保护：禁止自动定位远程网络共享（UNC）路径，防止 NTLM 凭据泄露');
      return;
    }
    hostOpen(ctx, resolveWorkspacePath(session.cwd, path), 'reveal').then(function (ok) {
      if (!ok) toast('定位失败：' + path);
    });
    return;
  }

  if (modifierOpen || cfg.clickAction === 'open') {
    if (isRemoteUnc) {
      toast('安全保护：禁止直接打开远程网络共享（UNC）路径，防止 NTLM 凭据泄露');
      return;
    }
    if (isExe) {
      toast('安全保护：可执行文件已在资源管理器中定位，未直接执行');
      hostOpen(ctx, resolveWorkspacePath(session.cwd, path), 'reveal').then(function (ok) {
        if (!ok) toast('定位失败：' + path);
      });
      return;
    }
    hostOpen(ctx, resolveWorkspacePath(session.cwd, path), 'open').then(function (ok) {
      if (!ok) toast('打开失败：' + path);
    });
    return;
  }

  try {
    previewPath(ctx, session.id, session.cwd, path, line);
  } catch (e) {
    toast('预览失败：' + path);
  }
}

// ── 插件主体 ──────────────────────────────────────────────────────
var inject = ['slots', 'sessions', 'remote', 'remote.session', 'sidebarRight', 'locale', 'theme'];

function apply(ctx) {
  var observer = null;
  var scanTimer = null;
  var themeDisposer = null;
  var styleEl = null;

  function applyAccent() {
    var theme = ctx.theme;
    if (theme === undefined || theme === null) {
      toast('强调色未生效：theme 服务不可用');
      return;
    }
    if (themeDisposer !== null) {
      try {
        themeDisposer();
      } catch (e) {
        /* 覆盖层可能已被主题切换清掉 */
      }
      themeDisposer = null;
    }
    var tokens = accentTokens(config);
    if (tokens === null) return;
    try {
      themeDisposer = theme.overrideTokens('dsh-file-view', tokens);
    } catch (e) {
      themeDisposer = null;
      toast('强调色未生效：' + String((e && e.message) || e));
    }
  }

  var isWrapping = false;

  function rescanAll() {
    if (!config.enabled || isWrapping) return;
    isWrapping = true;
    try {
      var roots = document.querySelectorAll('[data-chat-flow]');
      for (var i = 0; i < roots.length; i++) scanTree(roots[i], config);
    } finally {
      isWrapping = false;
      if (observer !== null && typeof observer.takeRecords === 'function') {
        observer.takeRecords();
      }
    }
  }

  function isRelevantMutation(record) {
    if (record.type !== 'childList' && record.type !== 'characterData') return false;
    var target = record.target;
    var el = target && target.nodeType === 1 ? target : target && target.parentElement ? target.parentElement : null;
    if (!el) return false;
    if (el.closest('.dshfl-link, .dsh-think-time-pill, .dsh-think-step-chip')) return false;
    if (el.closest('[data-chat-flow]')) return true;
    if (record.type === 'childList' && record.addedNodes) {
      for (var k = 0; k < record.addedNodes.length; k++) {
        var added = record.addedNodes[k];
        if (
          added &&
          added.nodeType === 1 &&
          ((typeof added.hasAttribute === 'function' && added.hasAttribute('data-chat-flow')) ||
            (typeof added.querySelector === 'function' && added.querySelector('[data-chat-flow]')))
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function scheduleScan() {
    if (scanTimer !== null) return;
    scanTimer = window.setTimeout(function () {
      scanTimer = null;
      try {
        rescanAll();
      } catch (e) {
        /* 扫描失败不能影响对话 */
      }
    }, 120);
  }

  var downX = 0;
  var downY = 0;

  function onPointerDown(event) {
    downX = event.clientX;
    downY = event.clientY;
  }

  function onClick(event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    var el = target.closest('.dshfl-link');
    if (el === null) {
      var a = target.closest('a');
      if (a) {
        var href = a.getAttribute('href') || '';
        if (/^file:\/\//i.test(href) || looksLikeFilePath(href)) {
          el = a;
        }
      }
    }
    if (el === null) return;
    if (event.button !== 0) return;
    var moved = Math.abs(event.clientX - downX) + Math.abs(event.clientY - downY);
    if (moved > 4) return;
    var selection = window.getSelection();
    if (selection !== null && String(selection.toString()).length > 0) return;
    event.preventDefault();
    event.stopPropagation();
    handleActivate(ctx, el, event);
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    var el = target.closest('.dshfl-link');
    if (el === null) {
      var a = target.closest('a');
      if (a) {
        var href = a.getAttribute('href') || '';
        if (/^file:\/\//i.test(href) || looksLikeFilePath(href)) {
          el = a;
        }
      }
    }
    if (el === null) return;
    event.preventDefault();
    handleActivate(ctx, el, { ctrlKey: false, metaKey: false, altKey: false });
  }

  ctx.effect(function () {
    styleEl = ensureStyle(config);
    applyAccent();
    rescanAll();

    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    observer = new MutationObserver(function (records) {
      if (isWrapping) return;
      for (var i = 0; i < records.length; i++) {
        if (isRelevantMutation(records[i])) {
          scheduleScan();
          return;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    var unsubscribe = subscribeConfig(function (next) {
      if (styleEl !== null) styleEl.textContent = styleText(next);
      applyAccent();
      scannedTextValues = new WeakMap();
      if (next.enabled) scheduleScan();
    });

    return function () {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      if (observer !== null) {
        observer.disconnect();
        observer = null;
      }
      if (scanTimer !== null) {
        window.clearTimeout(scanTimer);
        scanTimer = null;
      }
      unsubscribe();
      if (themeDisposer !== null) {
        try {
          themeDisposer();
        } catch (e) {
          /* ignore */
        }
        themeDisposer = null;
      }
      if (styleEl !== null && styleEl.parentNode !== null) styleEl.parentNode.removeChild(styleEl);
      styleEl = null;
      var toastEl = document.getElementById('dshfl-toast');
      if (toastEl !== null && toastEl.parentNode !== null) toastEl.parentNode.removeChild(toastEl);
    };
  }, 'dsh-file-view: chat scan, click routing and accent layer');

  ctx.slots.inject('settings.section', function () {
    return ctx.slots.register(
      { name: 'settings.section', id: 'file-link', order: 21, label: '文件链接' },
      function () {
        return h(FileLinkSettings, null);
      }
    );
  });

  try {
    window.__dshFileView = {
      config: function () {
        return config;
      },
      update: updateFileLinkConfig,
      rescan: rescanAll,
      match: findPathMatches
    };
  } catch (e) {
    /* ignore */
  }
}
