import { Component } from '@angular/core';
import { RouterLink, Routes } from '@angular/router';

@Component({
  imports: [RouterLink],
  template: `
    <main class="section-wide">
      <h1>Сторінку не знайдено</h1>
      <p><a routerLink="/">Повернутися на головну</a></p>
    </main>
  `,
})
class NotFoundPage {}

export const routes: Routes = [
  {
    path: '',
    title: 'Інноваційна дія — громадська організація',
    data: {
      description:
        'ГО «Інноваційна дія» об’єднує жінок і зміцнює громади через освіту, психологічну підтримку та професійний розвиток.',
    },
    loadComponent: () => import('./features/home/home.page').then(({ HomePage }) => HomePage),
  },
  {
    path: 'about',
    title: 'Про нас | Інноваційна дія',
    data: {
      description:
        'Місія, команда та напрями роботи ГО «Інноваційна дія»: підтримка жінок, ВПО, дітей і людей старшого віку.',
    },
    loadComponent: () => import('./features/about/about.page').then(({ AboutPage }) => AboutPage),
  },
  {
    path: 'projects',
    title: 'Проєкти | Інноваційна дія',
    data: {
      description:
        'Проєкти ГО «Інноваційна дія» для підтримки жінок, розвитку навичок і зміцнення громад.',
    },
    loadComponent: () =>
      import('./features/projects/projects.page').then(({ ProjectsPage }) => ProjectsPage),
  },
  {
    path: 'services',
    title: 'Послуги | Інноваційна дія',
    data: {
      description: 'Послуги та фахівці ГО «Інноваційна дія»: напрями роботи, контакти й портфоліо.',
    },
    loadComponent: () =>
      import('./features/services/services.page').then(({ ServicesPage }) => ServicesPage),
  },
  {
    path: 'reports',
    title: 'Звітність | Інноваційна дія',
    data: {
      description:
        'Річні звіти ГО «Інноваційна дія» про діяльність організації. Перегляньте доступні звіти та завантажте їх у PDF.',
    },
    loadComponent: () =>
      import('./features/reports/reports.page').then(({ ReportsPage }) => ReportsPage),
  },
  {
    path: 'admin',
    title: 'Адміністрування | Інноваційна дія',
    loadComponent: () => import('./features/admin/admin.page').then((m) => m.AdminPage),
  },
  { path: '**', title: 'Сторінку не знайдено | Інноваційна дія', component: NotFoundPage },
];
