import { RenderMode, ServerRoute } from '@angular/ssr';
import { routes } from './app.routes';

export const publicPaths = routes
  .filter((route) => route.data?.['description'])
  .map((route) => route.path!);

export const serverRoutes: ServerRoute[] = [
  { path: 'admin', renderMode: RenderMode.Client, headers: { 'X-Robots-Tag': 'noindex' } },
  ...publicPaths.map((path) => ({ path, renderMode: RenderMode.Server as const })),
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
