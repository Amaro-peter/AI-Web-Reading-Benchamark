#!/usr/bin/env node
/**
 * Static page server for the E2E suite.
 *
 * The backend refuses private addresses, so the E2E backend is started with
 * SCRAPER_ALLOWED_HOSTS=127.0.0.1 and pointed here. Serving a fixed document
 * keeps the suite deterministic and offline: no real site is ever fetched.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const article = readFileSync(resolve(here, '../backend/tests/fixtures/article.html'), 'utf8');
const port = Number(process.env.FIXTURE_PORT ?? 3102);

const server = createServer((request, response) => {
  const path = (request.url ?? '/').split('?')[0];

  if (path === '/article') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(article);
    return;
  }

  if (path === '/redirects-to-article') {
    response.writeHead(302, { location: `http://127.0.0.1:${port}/article` });
    response.end();
    return;
  }

  if (path === '/empty') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><title>Nothing</title></head><body></body></html>');
    return;
  }

  if (path === '/boom') {
    response.writeHead(500, { 'content-type': 'text/html' });
    response.end('<html><body>server error</body></html>');
    return;
  }

  // Readiness probe used by Playwright's webServer.
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end('fixture server');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`fixture server listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
