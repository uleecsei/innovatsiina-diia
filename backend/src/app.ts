import express from 'express';
import { extname } from 'node:path';
import type { ContentRepository } from './modules/content.ts';

interface MediaDirectories {
  projectImagesDir?: string;
  specialistPortfoliosDir?: string;
  reportsDir?: string;
}

function serveMedia(directory: string, extensions: string[], download = false) {
  const allowed = new Set(extensions);
  const staticFiles = express.static(directory, {
    index: false,
    redirect: false,
    dotfiles: 'ignore',
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (download) res.setHeader('Content-Disposition', 'attachment');
    },
  });

  const middleware: express.RequestHandler = (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || !allowed.has(extname(req.path).toLowerCase())) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    staticFiles(req, res, next);
  };
  return middleware;
}

export function createApp(repository: ContentRepository, media: MediaDirectories = {}) {
  const app = express();
  app.disable('x-powered-by');

  if (media.projectImagesDir) {
    app.use(
      '/media/projects',
      serveMedia(media.projectImagesDir, ['.jpg', '.jpeg', '.png', '.webp', '.avif']),
    );
  }
  if (media.specialistPortfoliosDir) {
    app.use(
      '/media/specialists',
      serveMedia(
        media.specialistPortfoliosDir,
        ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.odt', '.zip'],
        true,
      ),
    );
  }

  if (media.reportsDir) {
    app.use('/media/reports', serveMedia(media.reportsDir, ['.pdf'], true));
  }

  app.get('/api/reports', async (_req, res) => {
    res.json(await repository.reports());
  });

  app.get('/api/health', async (_req, res) => {
    try {
      await repository.ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.get('/api/projects', async (_req, res) => {
    res.json(await repository.projects());
  });

  app.get('/api/specialists', async (_req, res) => {
    res.json(await repository.specialists());
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const errorHandler: express.ErrorRequestHandler = (error, _req, res, _next) => {
    void _next;
    console.error('API request failed', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ error: 'Internal server error' });
  };

  app.use(errorHandler);
  return app;
}
