import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyRequest } from './server/wpProxy.js'

/* Dev-time equivalent of the api/wp-proxy.js serverless function so the app
   can reach the WordPress REST API without any CORS preflight. */
function wpApiProxy() {
  return {
    name: 'wp-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/wp-proxy', async (req, res, next) => {
        const { searchParams } = new URL(req.url, 'http://localhost')
        const { status, headers, body } = await proxyRequest(searchParams.get('url'), req.headers)
        res.statusCode = status
        for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
        if (status === 404 && body == null) return next()
        res.end(body)
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), wpApiProxy()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.monkeycode-ai.live']
  }
})
