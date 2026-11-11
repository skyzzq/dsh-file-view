#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://api.github.com'
const UPSTREAM = 'awesome-dsh-plugin/awesome-dsh-plugin'
const owner = 'skyzzq'
const repoName = 'dsh-file-view'

let token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
if (!token) {
  try {
    const cred = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const m = cred.match(/^password=(.*)$/m)
    if (m && m[1]) token = m[1].trim()
  } catch {}
}

if (!token) {
  console.error('No GitHub token found via env or git credential fill!')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const tag = `v${manifest.version}`

async function api(method, path, body) {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'dsh-file-view-publish',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok && res.status !== 404) {
    throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 400)}`)
  }
  return res.status === 404 ? undefined : text ? JSON.parse(text) : undefined
}

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts })
}

console.log('1. Preparing and committing working tree...')
git(['add', '-A'])
try {
  git(['commit', '-m', `feat: release ${tag}`])
  console.log(`committed ${tag}`)
} catch {
  console.log('nothing new to commit')
}

console.log('2. Pushing main branch...')
const tokenUrl = `https://x-access-token:${token}@github.com/${owner}/${repoName}.git`
git(['-c', 'credential.helper=', 'push', tokenUrl, 'HEAD:refs/heads/main'], {
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
})
console.log('pushed main branch successfully')

console.log('3. Updating repository metadata and topics...')
await api('PATCH', `/repos/${owner}/${repoName}`, {
  description: manifest.description,
  homepage: manifest.homepage,
  has_issues: true,
})
await api('PUT', `/repos/${owner}/${repoName}/topics`, {
  names: ['dsh', 'dsh-plugin', 'dsh-plugin-market', 'cordis', 'deepseek-harness'],
})
console.log('repository metadata and topics updated')

console.log('4. Tagging and creating release on GitHub...')
try {
  git(['tag', '-a', tag, '-m', tag])
} catch {}
git(['-c', 'credential.helper=', 'push', tokenUrl, tag], {
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
})
console.log(`pushed tag ${tag}`)

const tarball = join(root, 'release', `${repoName}.tgz`)
if (!existsSync(tarball)) {
  throw new Error(`tarball missing: ${tarball} — run scripts/prepare-publish.mjs first`)
}

let release = await api('GET', `/repos/${owner}/${repoName}/releases/tags/${tag}`)
const readmeLines = readFileSync(join(root, 'README.md'), 'utf8').split('\n')
const releaseBody = readmeLines.slice(0, 45).join('\n')

if (!release) {
  release = await api('POST', `/repos/${owner}/${repoName}/releases`, {
    tag_name: tag,
    name: tag,
    body: releaseBody,
    make_latest: 'true',
  })
  console.log(`release ${tag} created`)
} else {
  await api('PATCH', `/repos/${owner}/${repoName}/releases/${release.id}`, {
    make_latest: 'true',
    body: releaseBody,
  })
  console.log(`release ${tag} updated`)
}

// Upload tarball asset
const existingAsset = (release.assets ?? []).find(a => a.name === `${repoName}.tgz`)
if (existingAsset) {
  await api('DELETE', `/repos/${owner}/${repoName}/releases/assets/${existingAsset.id}`)
  console.log(`removed stale asset ${existingAsset.id}`)
}

console.log(`uploading ${tarball} to release...`)
const upload = await fetch(`https://uploads.github.com/repos/${owner}/${repoName}/releases/${release.id}/assets?name=${repoName}.tgz`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'content-type': 'application/gzip',
    'user-agent': 'dsh-file-view-publish',
  },
  body: readFileSync(tarball),
})
if (!upload.ok) {
  throw new Error(`tarball upload failed: ${upload.status} ${await upload.text()}`)
}
console.log(`tarball ${repoName}.tgz attached to release ${tag}`)

console.log('5. Submitting to awesome-dsh-plugin marketplace...')
const entryPath = `data/plugins/${owner}__${repoName}.yml`
const entryFile = join(root, 'docs', `awesome-entry-${owner}__${repoName}.yml`)
if (!existsSync(entryFile)) {
  throw new Error(`missing ${entryFile}`)
}

// Ensure fork exists
await api('POST', `/repos/${UPSTREAM}/forks`, { default_branch_only: true })
const headBranch = `add-${repoName}`

// Sync fork with upstream main or get fork main sha
try {
  await api('POST', `/repos/${owner}/awesome-dsh-plugin/merge-upstream`, { branch: 'main' })
  console.log('synced fork main branch with upstream')
} catch (e) {
  console.log('fork sync note:', e.message)
}

const mainRef = await api('GET', `/repos/${owner}/awesome-dsh-plugin/git/ref/heads/main`)
const mainSha = mainRef.object.sha

// Create or update headBranch
try {
  await api('POST', `/repos/${owner}/awesome-dsh-plugin/git/refs`, {
    ref: `refs/heads/${headBranch}`,
    sha: mainSha,
  })
  console.log(`created branch ${headBranch}`)
} catch {
  console.log(`branch ${headBranch} exists, updating ref...`)
  await api('PATCH', `/repos/${owner}/awesome-dsh-plugin/git/refs/heads/${headBranch}`, {
    sha: mainSha,
    force: true,
  })
}

// Check existing file content on branch if any
let existingFileSha = undefined
try {
  const existingFile = await api('GET', `/repos/${owner}/awesome-dsh-plugin/contents/${entryPath}?ref=${headBranch}`)
  if (existingFile && existingFile.sha) {
    existingFileSha = existingFile.sha
  }
} catch {}

await api('PUT', `/repos/${owner}/awesome-dsh-plugin/contents/${entryPath}`, {
  message: `add ${owner}/${repoName}`,
  content: readFileSync(entryFile).toString('base64'),
  branch: headBranch,
  ...(existingFileSha ? { sha: existingFileSha } : {}),
})
console.log(`committed ${entryPath} on ${headBranch}`)

// Check existing PRs
const existingPRs = await api('GET', `/repos/${UPSTREAM}/pulls?head=${owner}:${headBranch}&state=open`)
if (Array.isArray(existingPRs) && existingPRs.length > 0) {
  console.log(`Marketplace PR already open: ${existingPRs[0].html_url}`)
} else {
  const pr = await api('POST', `/repos/${UPSTREAM}/pulls`, {
    title: `add ${owner}/${repoName}`,
    head: `${owner}:${headBranch}`,
    base: 'main',
    body: [
      `<!-- Thanks for contributing! Quick checklist / 提交前快速自查 -->`,
      ``,
      `- [x] I added **one file** at \`data/plugins/${owner}__${repoName}.yml\` — that single file is the whole submission. The READMEs are regenerated on \`main\` after merge: don't edit them by hand, and you don't need to commit them either / 我新增了一个 \`data/plugins/${owner}__${repoName}.yml\` 文件——**这一个文件就是全部投稿**。README 会在合并后由 \`main\` 自动重新生成：不要手工编辑，也不需要提交`,
      `- [x] My repo's \`package.json\` declares **\`dsh.bundle\`** (not just \`dsh.client\`) — [example](../blob/main/contributing.md) / 仓库 \`package.json\` 已声明 \`dsh.bundle\`（只有 \`dsh.client\` 无法安装）`,
      `- [x] \`category\` is one of \`agi ui usage theme model identity session memory tools wsl browser vision voice docs skill workflow git notify dev security remote market fun\` ([full list with descriptions](../blob/main/contributing.md)), and themes/skins go under \`theme\` / \`category\` 取值正确（完整清单见 contributing.md），主题/皮肤类请用 \`theme\``,
      `- [x] Description states what the plugin does, no superlatives / 描述只说功能，不带营销词`,
      `- [x] My repo has the \`dsh-plugin\` topic / 仓库已打 \`dsh-plugin\` topic`,
      ``,
      `**Submission Summary:**`,
      `- Repository: https://github.com/${owner}/${repoName}`,
      `- Release: https://github.com/${owner}/${repoName}/releases/tag/${tag}`,
      `- Tarball: https://github.com/${owner}/${repoName}/releases/latest/download/${repoName}.tgz`,
      `- Category: ui`,
      `- Description (zh): 对话文件路径高亮与交互插件，支持侧边栏秒级预览、外部编辑器跳转与资源管理器定位，支持强调色自定义。`,
      `- Description (en): Converts file paths in chat to clickable links with sidebar preview, external editor opening, and theme customization.`,
    ].join('\n'),
  })
  console.log(`Marketplace PR opened successfully: ${pr.html_url}`)
}
