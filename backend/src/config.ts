import { resolve } from 'node:path';

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env['PORT'] ?? 3000);
  const mongoUri = env['MONGODB_URI'];
  const database = env['MONGODB_DB'] ?? 'innovatsiina_diia';
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  if (!mongoUri || !/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    throw new Error('Set MONGODB_URI in backend/.env to a MongoDB connection string');
  }
  if (!database.trim()) throw new Error('MONGODB_DB cannot be empty');
  const projectImagesDir = resolve(env['PROJECT_IMAGES_DIR'] ?? 'uploads/projects');
  const specialistPortfoliosDir = resolve(
    env['SPECIALIST_PORTFOLIOS_DIR'] ?? 'uploads/specialists',
  );
  const reportsDir = resolve(env['REPORTS_DIR'] ?? 'uploads/reports');
  const secureCookies = env['NODE_ENV'] === 'production';
  const adminOrigins = (
    env['ADMIN_ORIGINS'] ?? (secureCookies ? '' : 'http://localhost:4200,http://127.0.0.1:4200')
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    !adminOrigins.length ||
    adminOrigins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          url.origin !== origin ||
          (secureCookies ? url.protocol !== 'https:' : !['http:', 'https:'].includes(url.protocol))
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error('Set ADMIN_ORIGINS to exact allowed origins (HTTPS in production)');
  return {
    adminOrigins,
    secureCookies,
    port,
    mongoUri,
    database,
    projectImagesDir,
    specialistPortfoliosDir,
    reportsDir,
  };
}
