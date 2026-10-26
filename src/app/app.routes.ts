import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Інноваційна дія',
    loadComponent: () => import('./features/home/home.page').then(({ HomePage }) => HomePage),
  },
  {
    path: 'about',
    title: 'Про нас | Інноваційна дія',
    loadComponent: () => import('./features/about/about.page').then(({ AboutPage }) => AboutPage),
  },
  {
    path: 'projects',
    title: 'Проєкти | Інноваційна дія',
    loadComponent: () =>
      import('./features/projects/projects.page').then(({ ProjectsPage }) => ProjectsPage),
  },
  {
    path: 'services',
    title: 'Послуги | Інноваційна дія',
    loadComponent: () =>
      import('./features/services/services.page').then(({ ServicesPage }) => ServicesPage),
  },
  {
    path: 'reports',
    title: 'Звітність | Інноваційна дія',
    loadComponent: () =>
      import('./features/reports/reports.page').then(({ ReportsPage }) => ReportsPage),
  },
  { path: '**', redirectTo: '' },
];
