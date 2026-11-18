import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { MongoClient } from 'mongodb';
import { readConfig } from './config.ts';
import { hashPassword } from './admin-auth.ts';
import type { Admin } from './admin.ts';

if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal.');
let hidden = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!hidden) process.stdout.write(chunk);
    callback();
  },
});
const prompt = createInterface({ input: process.stdin, output, terminal: true });
const config = readConfig();
const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
try {
  const username = (await prompt.question('Логін адміністратора: ')).trim();
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username))
    throw new Error('Use 3–64 Latin letters, digits, dots, underscores or hyphens.');
  process.stdout.write('Пароль (15–128 символів, введення приховане): ');
  hidden = true;
  const password = await prompt.question('');
  hidden = false;
  process.stdout.write('\nПовторіть пароль: ');
  hidden = true;
  const confirmation = await prompt.question('');
  hidden = false;
  process.stdout.write('\n');
  if (password.length < 15 || password.length > 128 || password !== confirmation)
    throw new Error('Passwords must match and contain 15–128 characters.');
  await client.connect();
  const db = client.db(config.database);
  const existing = await db.collection<Admin>('admin').findOne({ _id: 'owner' });
  if (
    existing &&
    (await prompt.question('Замінити доступ єдиного адміністратора? Введіть YES: ')) !== 'YES'
  )
    throw new Error('Cancelled.');
  const passwordHash = await hashPassword(password);
  await db
    .collection<Admin>('admin')
    .replaceOne({ _id: 'owner' }, { username, passwordHash }, { upsert: true });
  await db.collection('admin_sessions').deleteMany({});
  console.log('Адміністратора збережено. Попередні сесії завершені. Відкрийте /admin.');
} finally {
  prompt.close();
  await client.close();
}
