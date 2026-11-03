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
  return { port, mongoUri, database };
}
