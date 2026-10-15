/* Shared logic for the WordPress REST proxy.
 *
 * The browser calls this same-origin endpoint, so no CORS preflight is ever
 * triggered. The proxy forwards the request (including the Authorization
 * header) to the configured WordPress site server-to-server. It is used by the
 * Vercel serverless function (api/wp-proxy.js) and the Vite dev middleware.
 */

const PRIVATE_HOST =
  /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|\[?::1\]?)$/i

/* Validate the upstream URL supplied by the client. Blocks non-HTTP targets
   and obvious internal/private hosts so the proxy cannot be abused. */
export function parseProxyTarget(value) {
  if (!value) return { error: 'Missing url parameter.' }

  let url
  try {
    url = new URL(String(value))
  } catch {
    return { error: 'Invalid url parameter.' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'Unsupported url protocol.' }
  }
  if (PRIVATE_HOST.test(url.hostname)) {
    return { error: 'Target host is not allowed.' }
  }

  return { url }
}

/* Only forward what the WordPress API needs. */
export function pickForwardHeaders(headers = {}) {
  const out = { Accept: 'application/json' }
  const auth = headers.authorization || headers.Authorization
  if (auth) out.Authorization = Array.isArray(auth) ? auth[0] : auth
  return out
}

export async function proxyRequest(targetValue, requestHeaders = {}) {
  const { url, error } = parseProxyTarget(targetValue)
  if (error) return { status: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ success: false, message: error }) }

  let upstream
  try {
    upstream = await fetch(url.toString(), {
      headers: pickForwardHeaders(requestHeaders),
      redirect: 'follow'
    })
  } catch {
    return {
      status: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ success: false, message: 'The proxy could not reach the WordPress API.' })
    }
  }

  const body = Buffer.from(await upstream.arrayBuffer())
  return {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store'
    },
    body
  }
}
