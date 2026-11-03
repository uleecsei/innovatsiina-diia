import express from 'express';
import type { ContentRepository } from './modules/content.ts';

export function createApp(repository: ContentRepository) {
  const app = express();
  app.disable('x-powered-by');

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
