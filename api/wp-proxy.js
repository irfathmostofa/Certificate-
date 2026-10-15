import { proxyRequest } from '../server/wpProxy.js'

/* Same-origin WordPress REST proxy (Vercel serverless function).
   See server/wpProxy.js for the forwarding logic. */
export default async function handler(req, res) {
  const raw = req.query && req.query.url
  const target = Array.isArray(raw) ? raw[0] : raw

  const { status, headers, body } = await proxyRequest(target, req.headers)
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  res.status(status).send(body)
}
