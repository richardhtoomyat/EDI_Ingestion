import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import handler from './api/test-sftp.js'

if (!process.env.SFTP_HOST) process.env.SFTP_HOST = '127.0.0.1'

function sftpDevApi() {
  return {
    name: 'sftp-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/test-sftp', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => {
          try {
            req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
          } catch {
            req.body = {}
          }
          const vercelRes = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this },
            json(payload) {
              res.statusCode = this.statusCode
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            },
          }
          Promise.resolve(handler(req, vercelRes)).catch((err) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          })
        })
      })
    },
  }
}

export default defineConfig({ plugins: [react(), sftpDevApi()] })
