import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'
import { rewriteCaption } from './server/rewrite.ts'

const root = path.dirname(fileURLToPath(import.meta.url))

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function captionRewritePlugin(): Plugin {
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const url = req.url?.split('?')[0]
    if (url !== '/api/caption-rewrite') {
      next()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ enabled: false, error: 'POST only' }))
      return
    }
    let body: unknown = {}
    try {
      const raw = await readBody(req)
      body = raw ? JSON.parse(raw) : {}
    } catch {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ enabled: false, error: 'Invalid JSON' }))
      return
    }
    const result = await rewriteCaption(body, {
      CLIP_DESK_LLM_API_KEY: process.env.CLIP_DESK_LLM_API_KEY,
      CLIP_DESK_LLM_BASE_URL: process.env.CLIP_DESK_LLM_BASE_URL,
      CLIP_DESK_LLM_MODEL: process.env.CLIP_DESK_LLM_MODEL,
    })
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(result))
  }
  return {
    name: 'caption-rewrite',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), captionRewritePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
