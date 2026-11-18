import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { publicPaths } from './app/app.routes.server';
import type { SiteRequestContext } from './app/seo';

const browserDistFolder = join(import.meta.dirname, '../browser');
const allowedHosts = (process.env['NG_ALLOWED_HOSTS'] ?? 'localhost,127.0.0.1')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const app = express();
const angularApp = new AngularNodeAppEngine({ allowedHosts });

function readOrigin(value: string, variable: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    ![url.origin, url.origin + '/'].includes(value)
  ) {
    throw new Error(`${variable} must be an HTTP(S) origin without a path.`);
  }
  return url.origin;
}

const configuredOrigin = process.env['SITE_ORIGIN'];
const siteOrigin = configuredOrigin ? readOrigin(configuredOrigin, 'SITE_ORIGIN') : undefined;
const apiOrigin = readOrigin(process.env['API_ORIGIN'] ?? 'http://127.0.0.1:3000', 'API_ORIGIN');
const requestContext: SiteRequestContext = { siteOrigin, apiOrigin };

app.get('/robots.txt', (_req, res) => {
  const sitemap = siteOrigin ? `Sitemap: ${siteOrigin}/sitemap.xml\n` : '';
  res.type('text/plain').send(`User-agent: *\nDisallow: /api/\n${sitemap}`);
});

app.get('/sitemap.xml', (_req, res) => {
  if (!siteOrigin) {
    res.sendStatus(404);
    return;
  }
  const entries = publicPaths.map((path) => `  <url><loc>${siteOrigin}/${path}</loc></url>`);
  res
    .type('application/xml')
    .send(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...entries,
        '</urlset>',
      ].join('\n'),
    );
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req, requestContext)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
