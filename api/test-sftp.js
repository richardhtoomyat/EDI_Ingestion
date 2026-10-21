import SftpClient from 'ssh2-sftp-client'
import { sftpMock } from '../sftpMock.js'

function mockTarget() {
  return {
    host: process.env.SFTP_HOST || sftpMock.host,
    port: Number(process.env.SFTP_PORT || sftpMock.port),
    username: sftpMock.username,
    password: sftpMock.password,
  }
}

function readBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
}

function missingFile(err) {
  const message = String(err?.message || err || '').toLowerCase()
  return err?.code === 2 || message.includes('no such file')
}

async function withClient(work) {
  const target = mockTarget()
  const client = new SftpClient()
  try {
    await client.connect({
      host: target.host,
      port: target.port,
      username: target.username,
      password: target.password,
      readyTimeout: 8000,
    })
    return await work(client)
  } finally {
    try {
      await client.end()
    } catch {
      // The client is already closed after a failed handshake.
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST required' })
    return
  }

  const body = readBody(req)
  const target = mockTarget()
  const server = String(body.server || '').trim()
  const port = String(body.port || '').trim()
  if (server !== target.host || port !== String(target.port)) {
    res.status(400).json({
      ok: false,
      error: `This deployment only tests the mock SFTP server at ${target.host}:${target.port}.`,
    })
    return
  }

  const action = body.action || 'connect'
  try {
    if (action === 'connect') {
      const files = await withClient((client) => client.list('.'))
      res.status(200).json({
        ok: true,
        folder: sftpMock.folder,
        files: files.map((file) => file.name),
      })
      return
    }
    if (action === 'send-inbound') {
      await withClient((client) => client.put(Buffer.from('inbound ok\n'), sftpMock.inboundFile))
      res.status(200).json({ ok: true, folder: sftpMock.folder, file: sftpMock.inboundFile })
      return
    }
    if (action === 'check-outbound') {
      try {
        const text = await withClient(async (client) => (await client.get(sftpMock.outboundFile)).toString('utf8').trim())
        res.status(200).json({ ok: true, found: true, file: sftpMock.outboundFile, text })
      } catch (err) {
        if (missingFile(err)) {
          res.status(200).json({ ok: true, found: false, file: sftpMock.outboundFile })
          return
        }
        throw err
      }
      return
    }
    res.status(400).json({ ok: false, error: 'Unknown test action' })
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message || 'SFTP connection failed' })
  }
}
