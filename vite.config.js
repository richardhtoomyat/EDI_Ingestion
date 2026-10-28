import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import handler from './api/test-sftp.js'
import onboardings from './api/onboardings.js'
import profiles from './api/profiles.js'
import invite from './api/invite.js'

if (!process.env.SFTP_HOST) process.env.SFTP_HOST = '127.0.0.1'

function devApi(path, handler, methods) {
  return (req, res, next) => {
    if (methods && !methods.includes(req.method)) {
      next()
      return
    }
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const url = new URL(req.url || '/', 'http://localhost')
      req.query = Object.fromEntries(url.searchParams)
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
        res.end(JSON.stringify({ ok: false, error: String(err.message || err) }))
      })
    })
  }
}

function sftpDevApi() {
  return {
    name: 'sftp-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/test-sftp', devApi('/api/test-sftp', handler, ['POST']))
      server.middlewares.use('/api/onboardings', devApi('/api/onboardings', onboardings))
      server.middlewares.use('/api/profiles', devApi('/api/profiles', profiles, ['GET', 'PATCH']))
      server.middlewares.use('/api/invite', devApi('/api/invite', invite, ['POST']))
    },
  }
}

export default defineConfig({ plugins: [react(), sftpDevApi()] })
