// `npm run dev`: serves /api/*.js like Vercel does (req.body parsed, res.status().json()/send()).
// Only for local development; production uses Vercel's own functions.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function vercelRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return res; };
  res.send = (body) => { res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); return res; };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = req.headers['content-type'] || '';
  if (!raw) return undefined;
  if (type.includes('application/json')) { try { return JSON.parse(raw); } catch { return raw; } }
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

export default function devApi() {
  return {
    name: 'beautypass-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://local');
        // Vercel serves /onboarding as /onboarding/index.html; Vite needs the trailing slash
        if (/^\/(onboarding|member|beheer)$/.test(url.pathname)) { req.url = url.pathname + '/' + url.search; return next(); }
        if (!url.pathname.startsWith('/api/')) return next();
        const m = url.pathname.match(/^\/api\/([a-z0-9-]+)\/?$/);
        const notFound = () => { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end('{"ok":false,"error":"Niet gevonden"}'); };
        if (!m) return notFound();
        // Same single entry point as on Vercel
        const file = resolve(server.config.root, 'api', '[route].js');
        if (!existsSync(resolve(server.config.root, 'api', '_routes', m[1] + '.js'))) return notFound();
        try {
          req.query = Object.fromEntries(url.searchParams);
          req.body = await readBody(req);
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, vercelRes(res));
        } catch (e) {
          console.error('[dev-api]', m[1], e);
          if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: e.message })); }
        }
      });
    },
  };
}
