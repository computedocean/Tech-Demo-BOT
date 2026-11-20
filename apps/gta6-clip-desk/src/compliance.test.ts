import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRewriteEnabled, rewriteCaption } from '../server/rewrite.ts'
import { BUNDLED_CLIPS, PLACEHOLDER_LICENSE } from './domain/clips.ts'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'test-results') {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

describe('no keys and no copyrighted game assets', () => {
  test('bundled clips are synthetic placeholders with a source note', () => {
    const sourceNote = readFileSync(path.join(appRoot, 'public/clips/SOURCE.txt'), 'utf8')
    expect(sourceNote.toLowerCase()).toContain('synthetic')
    expect(sourceNote).toContain('CC0')
    expect(sourceNote.toLowerCase()).toContain('no recorded footage')
    expect(PLACEHOLDER_LICENSE.toLowerCase()).toContain('synthetic')
    expect(PLACEHOLDER_LICENSE).toContain('CC0')
    expect(PLACEHOLDER_LICENSE.toLowerCase()).toContain('no game assets')

    const mediaDir = path.join(appRoot, 'public/clips')
    const mediaFiles = readdirSync(mediaDir).filter((name) => name.endsWith('.mp4'))
    expect(mediaFiles.sort()).toEqual(BUNDLED_CLIPS.map((clip) => path.basename(clip.src)).sort())
    for (const clip of BUNDLED_CLIPS) {
      expect(clip.origin).toBe('bundled')
      expect(clip.license).toBe(PLACEHOLDER_LICENSE)
      const file = path.join(appRoot, 'public', clip.src)
      const info = statSync(file)
      expect(info.size).toBeLessThan(250_000)
      const bytes = readFileSync(file).toString('latin1')
      expect(bytes).not.toMatch(/Rockstar|Grand Theft Auto|Take-Two|Take Two/i)
    }
  })

  test('client source has no API keys and does not import the server rewrite', () => {
    const clientFiles = walk(path.join(appRoot, 'src')).filter(
      (file) => /\.(ts|tsx|css|html)$/.test(file) && !file.endsWith('.test.ts'),
    )
    expect(clientFiles.length).toBeGreaterThan(0)
    for (const file of clientFiles) {
      const text = readFileSync(file, 'utf8')
      expect(text).not.toMatch(/sk-[A-Za-z0-9]{8,}/)
      expect(text).not.toContain('CLIP_DESK_LLM')
      expect(text).not.toMatch(/VITE_[A-Z0-9_]*KEY/)
      expect(text).not.toContain('import.meta.env')
      expect(text).not.toContain('process.env')
      expect(text).not.toContain('server/rewrite')
      expect(text).not.toMatch(/Bearer\s/)
    }
  })

  test('optional rewrite is off without a key and the client bundle stays clean', async () => {
    expect(isRewriteEnabled({})).toBe(false)
    expect(isRewriteEnabled({ CLIP_DESK_LLM_API_KEY: '   ' })).toBe(false)
    const result = await rewriteCaption(
      {
        title: 'Harbor cruise',
        tags: ['night'],
        hook: 'Stay.',
        caption: 'Hold the line.',
        hashtags: ['#ClipDesk'],
      },
      {},
    )
    expect(result).toEqual({ enabled: false, source: 'template' })

    const build = spawnSync('bun', ['run', 'build'], {
      cwd: appRoot,
      encoding: 'utf8',
      timeout: 120_000,
    })
    expect(build.status, build.stdout + build.stderr).toBe(0)
    const assets = walk(path.join(appRoot, 'dist')).filter((file) => /\.(js|css|html)$/.test(file))
    expect(assets.length).toBeGreaterThan(0)
    for (const file of assets) {
      const text = readFileSync(file, 'utf8')
      expect(text).not.toContain('CLIP_DESK_LLM')
      expect(text).not.toMatch(/sk-[A-Za-z0-9]{8,}/)
      expect(text).not.toMatch(/VITE_[A-Z0-9_]*KEY/)
      expect(text).not.toMatch(/Bearer\s+[A-Za-z0-9_\-.]{8,}/)
    }
  })
})
