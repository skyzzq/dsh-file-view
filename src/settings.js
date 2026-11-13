/**
 * `src/settings.js`
 * Settings UI component for dsh-file-view:
 * - Accent color selection & custom hex input
 * - Synchronous UI theme token overriding
 * - Click behavior (preview vs system default open)
 * - Underline and code block path scanning options
 */

export const ACCENT_PRESETS = [
  { id: 'default', label: '跟随主题', light: '', dark: '' },
  { id: 'deepseek', label: '官方蓝', light: '#4176e6', dark: '#7aaaff' },
  { id: 'green', label: '绿', light: '#0f9d6e', dark: '#34d399' },
  { id: 'violet', label: '紫', light: '#7c3aed', dark: '#a78bfa' },
  { id: 'rose', label: '玫红', light: '#db2777', dark: '#f472b6' },
  { id: 'amber', label: '琥珀', light: '#b45309', dark: '#fbbf24' },
  { id: 'teal', label: '青', light: '#0d9488', dark: '#2dd4bf' },
  { id: 'slate', label: '石板', light: '#475569', dark: '#94a3b8' }
];

export const ACCENT_TOKENS = [
  '--dsw-alias-state-business-primary',
  '--dsw-alias-brand-primary'
];

export const ACCENT_STATIC_TOKENS = [
  '--dsw-static-deepseek-500',
  '--dsw-static-deepseek-400'
];

export function settingsStyles() {
  return {
    root: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '2px 0 8px' },
    group: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.22))',
      background: 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,.04))'
    },
    groupTitle: { fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-primary, inherit)' },
    row: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    label: { fontSize: '12px', minWidth: '76px', color: 'var(--dsw-alias-label-secondary, #64748b)' },
    swatches: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    swatch: {
      width: '26px',
      height: '26px',
      borderRadius: '7px',
      border: '2px solid transparent',
      cursor: 'pointer',
      padding: 0,
      boxShadow: 'inset 0 0 0 1px var(--dsw-alias-border-l2, rgba(127,127,127,.35))'
    },
    swatchActive: { borderColor: 'var(--dsw-alias-label-primary, #111)' },
    hex: {
      width: '96px',
      padding: '4px 8px',
      borderRadius: '6px',
      border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.25))',
      background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,.06))',
      color: 'inherit',
      fontSize: '12px',
      fontFamily: 'ui-monospace, monospace'
    },
    color: { width: '32px', height: '26px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' },
    btn: {
      padding: '4px 12px',
      borderRadius: '6px',
      border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.25))',
      background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,.06))',
      color: 'inherit',
      fontSize: '12px',
      cursor: 'pointer'
    },
    muted: {
      fontSize: '11px',
      lineHeight: '1.65',
      color: 'var(--dsw-alias-label-secondary, #64748b)'
    },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' },
    demo: {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '12px',
      padding: '2px 5px',
      borderRadius: '4px',
      color: 'var(--dsw-alias-state-business-primary, #4176e6)',
      borderBottom: '1px dashed var(--dsw-alias-state-business-primary, #4176e6)'
    }
  };
}

export function createFileLinkSettings(react, deps) {
  const h = react.createElement;
  const { fileLinkConfig, subscribeConfig, updateFileLinkConfig, accentColorOf } = deps;

  return function FileLinkSettings() {
    const S = settingsStyles();
    const state = react.useState(fileLinkConfig());
    const current = state[0];
    const setCurrent = state[1];

    react.useEffect(() => {
      return subscribeConfig((next) => {
        setCurrent(next);
      });
    }, []);

    function patch(next) {
      const merged = updateFileLinkConfig(next);
      setCurrent(merged);
    }

    const swatchNodes = ACCENT_PRESETS.map((preset) => {
      const active = current.accentPreset === preset.id;
      const style = Object.assign({}, S.swatch, active ? S.swatchActive : {});
      if (preset.light) style.background = preset.light;
      else style.background =
        'linear-gradient(135deg, var(--dsw-alias-label-tertiary,#94a3b8), var(--dsw-alias-bg-base,#fff))';
      return h('button', {
        key: preset.id,
        type: 'button',
        title: preset.label,
        'aria-label': preset.label,
        'aria-pressed': active,
        style: style,
        onClick: () => {
          patch({ accentPreset: preset.id, accentCustom: '' });
        }
      });
    });

    return h(
      'div',
      { style: S.root },

      h(
        'div',
        { style: S.group },
        h('div', { style: S.groupTitle }, '强调色'),
        h(
          'div',
          { style: S.muted },
          '同一个颜色同时决定界面强调色和聊天里可点击文件的颜色，改一处两边都变。'
        ),
        h('div', { style: S.swatches }, swatchNodes),
        h(
          'div',
          { style: S.row },
          h('span', { style: S.label }, '自定义'),
          h('input', {
            type: 'color',
            style: S.color,
            value: current.accentCustom || accentColorOf(current, 'light') || '#2563eb',
            onChange: (e) => {
              patch({ accentPreset: 'custom', accentCustom: e.target.value });
            }
          }),
          h('input', {
            type: 'text',
            style: S.hex,
            placeholder: '#2563eb',
            value: current.accentCustom,
            onChange: (e) => {
              const value = String(e.target.value || '').trim();
              patch({ accentPreset: value ? 'custom' : 'default', accentCustom: value });
            }
          }),
          h(
            'button',
            {
              style: S.btn,
              type: 'button',
              onClick: () => {
                patch({ accentPreset: 'default', accentCustom: '' });
              }
            },
            '恢复默认'
          )
        ),
        h(
          'div',
          { style: S.row },
          h('span', { style: S.label }, '预览'),
          h('span', { style: S.demo }, 'src/app/main.ts'),
          h('span', { style: S.muted }, '← 这就是聊天里文件链接的样子')
        )
      ),

      h(
        'div',
        { style: S.group },
        h('div', { style: S.groupTitle }, '文件点击'),
        h(
          'label',
          { style: S.check },
          h('input', {
            type: 'checkbox',
            checked: current.enabled,
            onChange: (e) => {
              patch({ enabled: e.target.checked });
            }
          }),
          '把聊天里提到的文件路径变成可点击链接'
        ),
        h(
          'label',
          { style: S.check },
          h('input', {
            type: 'checkbox',
            checked: current.clickAction === 'preview',
            onChange: (e) => {
              patch({ clickAction: e.target.checked ? 'preview' : 'open' });
            }
          }),
          '单击在右侧栏预览（关闭则用系统默认程序打开）'
        ),
        h(
          'label',
          { style: S.check },
          h('input', {
            type: 'checkbox',
            checked: current.underline,
            onChange: (e) => {
              patch({ underline: e.target.checked });
            }
          }),
          '链接下方显示虚线下划线'
        ),
        h(
          'label',
          { style: S.check },
          h('input', {
            type: 'checkbox',
            checked: current.scanCode,
            onChange: (e) => {
              patch({ scanCode: e.target.checked });
            }
          }),
          '代码块里的路径也可点击'
        )
      ),

      h(
        'div',
        { style: S.group },
        h('div', { style: S.groupTitle }, '怎么用'),
        h(
          'div',
          { style: S.muted },
          '单击 → 右侧栏预览　·　Ctrl+单击 → 本机默认应用打开　·　Alt+单击 → 在文件管理器中定位'
        ),
        h(
          'div',
          { style: S.muted },
          '右键 → 打开菜单：在右侧栏预览 / 用本机默认应用打开 / 从文件管理器查看 / 复制路径。'
        ),
        h(
          'div',
          { style: S.muted },
          '路径按会话工作区解析；相对路径先拼工作区根目录。点击不会打断文本选择：拖选超过 4px 或已有选中文本时不触发。'
        ),
        h(
          'div',
          { style: S.muted },
          '识别范围：带分隔符的相对/绝对路径，以及常见扩展名的裸文件名；URL 和普通英文单词不处理。'
        )
      )
    );
  };
}
