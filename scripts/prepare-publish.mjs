#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(root, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const owner = 'skyzzq'
const repo = 'dsh-file-view'
const slug = `https://github.com/${owner}/${repo}`

manifest.repository = { type: 'git', url: `git+${slug}.git` }
manifest.homepage = `${slug}#readme`
manifest.bugs = { url: `${slug}/issues` }
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`package.json -> ${slug}`)

// Verify required build outputs
for (const required of ['index.js', 'lib/client.js', 'lib/paths.js', 'cordis.patch.yml']) {
  if (!existsSync(join(root, required))) {
    console.error(`missing build output: ${required}`)
    process.exit(1)
  }
}

const releaseDir = join(root, 'release')
mkdirSync(releaseDir, { recursive: true })

execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--pack-destination', releaseDir], {
  cwd: root,
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: process.platform === 'win32',
})

const packed = `dsh-file-view-${manifest.version}.tgz`
const target = join(releaseDir, 'dsh-file-view.tgz')
if (existsSync(join(releaseDir, packed))) {
  copyFileSync(join(releaseDir, packed), target)
}

const digest = createHash('sha256').update(readFileSync(target)).digest('hex')
console.log(`tarball -> release/dsh-file-view.tgz  sha256 ${digest}`)
