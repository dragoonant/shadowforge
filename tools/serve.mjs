// Static dev server: node tools/serve.mjs [port]  (default 8241, PLAN.md D12).
// Cache-Control: no-store on everything — a cached script during a fix pass once cost a
// whole session (kb/LESSONS-DIGEST.md §10). scratch/, .git/ and token files are refused.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2]) || 8241;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
// Secrets by their real names only (tokens.txt, hf_token.md, .hf_token, elevenlabs.token*, .env*):
// a game asset may be called token.mp3.
const FORBIDDEN = /(^|[\\/])(scratch|\.git)([\\/]|$)|(^|[\\/])(tokens?\.txt(\.txt)?|hf_token\.md|\.hf_token|elevenlabs\.token[^\\/]*|\.env[^\\/]*)$/i;

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = normalize(path === '/' ? '/index.html' : path).replace(/^[\\/]+/, '');
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT) || FORBIDDEN.test(rel)) { res.writeHead(403); res.end('403'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end('404 ' + rel); }
}).listen(PORT, () => console.log('shadowforge on http://localhost:' + PORT));
