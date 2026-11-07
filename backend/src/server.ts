import { mkdir } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { createContentRepository } from './modules/content.ts';

const config = readConfig();
await Promise.all([
  mkdir(config.reportsDir, { recursive: true }),
  mkdir(config.projectImagesDir, { recursive: true }),
  mkdir(config.specialistPortfoliosDir, { recursive: true }),
]);
const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  await client.db(config.database).command({ ping: 1 });
} catch {
  console.error('Cannot connect to MongoDB. Check MONGODB_URI and database availability.');
  await client.close();
  process.exit(1);
}
const server = createApp(createContentRepository(client.db(config.database)), config).listen(
  config.port,
  () => console.log(`API listening on port ${config.port}`),
);
server.on('error', async () => {
  console.error('Cannot start API listener');
  await client.close();
  process.exit(1);
});
function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    await client.close();
    clearTimeout(timeout);
    process.exit(0);
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
