import { MongoClient } from 'mongodb';
import { readConfig } from './config.ts';
import { projects, specialists } from './seed-data.ts';

const config = readConfig();
const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  const db = client.db(config.database);
  for (const [index, project] of projects.entries()) {
    await db
      .collection('projects')
      .updateOne(
        { title: project.title },
        { $setOnInsert: { ...project, sortOrder: index } },
        { upsert: true },
      );
  }
  for (const [index, specialist] of specialists.entries()) {
    await db
      .collection('specialists')
      .updateOne(
        { email: specialist.email },
        { $setOnInsert: { ...specialist, sortOrder: index } },
        { upsert: true },
      );
  }
  console.log('Initial content inserted; existing records preserved.');
} finally {
  await client.close();
}
