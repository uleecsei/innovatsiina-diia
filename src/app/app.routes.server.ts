import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'projects', renderMode: RenderMode.Client },
  { path: 'services', renderMode: RenderMode.Client },
  { path: 'reports', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
