# Инновационная деятельность

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.22.

Requires Node.js 24 LTS and pnpm 11+. Node 23 is not supported by Angular 21.

After a production build, start the site with
`pnpm run serve:ssr:innovatsiina-diia` and open `http://localhost:4000`.
Do not open `dist/.../index.html` directly as a local file. In production, set
`NG_ALLOWED_HOSTS=example.com,www.example.com` to the real domain names.

Planned architecture: prerendered/SSR public pages, a lazy-loaded admin area,
a small API in the existing Node.js/Express SSR server, and SQLite or PostgreSQL
for content. A separate NestJS service is intentionally deferred until needed.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Project structure

Application pages are grouped by feature under `src/app/features`. Each feature keeps its
component class and template together. Application-wide routing and the root layout stay in
`src/app`, while global design tokens and reusable utility styles live in `src/styles.scss`.

Before committing, run:

```bash
pnpm lint
pnpm format:check
pnpm test --watch=false
pnpm build
```

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
