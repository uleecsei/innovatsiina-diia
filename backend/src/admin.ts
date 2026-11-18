import express from 'express';
import { documentRoutes } from './admin-documents.ts';
import { ObjectId, type Db } from 'mongodb';
import sharp from 'sharp';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { digest, token, verifyPassword } from './admin-auth.ts';

export interface Admin {
  _id: string;
  username: string;
  passwordHash: string;
}
interface Session {
  _id: string;
  csrf: string;
  expiresAt: Date;
  lastSeen: Date;
}
interface Attempt {
  _id: string;
  count: number;
  expiresAt: Date;
}
export async function createAdminRouter(
  db: Db,
  imagesDir: string,
  origins: string[],
  secure: boolean,
  documents?: { specialistPortfoliosDir: string; reportsDir: string },
) {
  const admins = db.collection<Admin>('admin');
  const sessions = db.collection<Session>('admin_sessions');
  const attempts = db.collection<Attempt>('admin_login_attempts');
  await Promise.all([
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    attempts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  const router = express.Router();
  const cookieName = secure ? '__Host-admin' : 'admin_session';
  const cookieOptions = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };
  const sessionId = (req: express.Request) => {
    const value = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? digest(value) : '';
  };
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method) && !origins.includes(req.get('origin') ?? '')) {
      res.status(403).json({ error: 'Недозволене джерело запиту.' });
      return;
    }
    next();
  });
  router.post('/login', express.json({ limit: '2kb' }), async (req, res) => {
    // A single global budget protects the sole account even from distributed guesses.
    const window = Math.floor(Date.now() / 900000);
    const attempt = await attempts.findOneAndUpdate(
      { _id: String(window) },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * 900000) } },
      { upsert: true, returnDocument: 'after' },
    );
    if (!attempt || attempt.count > 10) {
      res.set('Retry-After', String(Math.ceil(((window + 1) * 900000 - Date.now()) / 1000)));
      res.status(429).json({ error: 'Забагато спроб. Спробуйте через 15 хвилин.' });
      return;
    }
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 128) {
      res.status(400).json({ error: 'Перевірте логін і пароль.' });
      return;
    }
    const admin = await admins.findOne({ _id: 'owner' });
    const valid = admin ? await verifyPassword(password, admin.passwordHash) : false;
    if (!valid || username !== admin?.username) {
      res.status(401).json({ error: 'Невірний логін або пароль.' });
      return;
    }
    await sessions.deleteOne({ _id: sessionId(req) });
    const value = token();
    const csrf = token();
    await sessions.insertOne({
      _id: digest(value),
      csrf,
      expiresAt: new Date(Date.now() + 8 * 3600000),
      lastSeen: new Date(),
    });
    res.cookie(cookieName, value, { ...cookieOptions, maxAge: 8 * 3600000 });
    res.json({ username: admin.username, csrf });
  });
  router.use(async (req, res, next) => {
    const session = await sessions.findOne({
      _id: sessionId(req),
      expiresAt: { $gt: new Date() },
      lastSeen: { $gt: new Date(Date.now() - 30 * 60000) },
    });
    if (!session) {
      res.status(401).json({ error: 'Увійдіть до адміністративної панелі.' });
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method) && req.get('x-csrf-token') !== session.csrf) {
      res.status(403).json({ error: 'Оновіть сторінку та спробуйте знову.' });
      return;
    }
    await sessions.updateOne({ _id: session._id }, { $set: { lastSeen: new Date() } });
    res.locals['session'] = session;
    next();
  });
  router.get('/session', async (_req, res) => {
    const admin = await admins.findOne({ _id: 'owner' });
    res.json({ username: admin?.username, csrf: res.locals['session'].csrf });
  });
  router.post('/logout', async (req, res) => {
    await sessions.deleteOne({ _id: sessionId(req) });
    res.clearCookie(cookieName, cookieOptions);
    res.sendStatus(204);
  });
  if (documents) {
    router.use(
      '/specialists',
      documentRoutes(db, 'specialists', documents.specialistPortfoliosDir),
    );
    router.use('/reports', documentRoutes(db, 'reports', documents.reportsDir));
  }
  router.get('/projects', async (_req, res) => {
    const items = await db
      .collection('projects')
      .find({}, { projection: { title: 1, description: 1, imageUrl: 1 } })
      .sort({ sortOrder: 1, _id: 1 })
      .limit(200)
      .toArray();
    res.json(items.map(({ _id, ...item }) => ({ id: _id.toHexString(), ...item })));
  });
  // Only remove files generated by this admin; manually managed/shared media stays intact.
  const cleanupImage = async (url: unknown) => {
    if (typeof url !== 'string' || !/^\/media\/projects\/[a-f0-9]{64}\.webp$/.test(url)) return;
    try {
      if (await db.collection('projects').countDocuments({ imageUrl: url })) return;
      await unlink(join(imagesDir, url.split('/').at(-1)!));
    } catch {
      console.error('Could not clean up project image');
    }
  };
  router.param('id', (req, res, next, id: string) => {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      res.status(400).json({ error: 'Некоректний ідентифікатор проєкту.' });
      return;
    }
    next();
  });
  router.delete('/projects/:id', async (req, res) => {
    const previous = await db
      .collection('projects')
      .findOneAndDelete({ _id: new ObjectId(String(req.params['id'])) });
    if (!previous) {
      res.status(404).json({ error: 'Проєкт не знайдено.' });
      return;
    }
    await cleanupImage(previous['imageUrl']);
    res.sendStatus(204);
  });
  const saveProject: express.RequestHandler = async (req, res) => {
    const id = req.params['id'] ? new ObjectId(String(req.params['id'])) : undefined;
    if (id && !(await db.collection('projects').findOne({ _id: id }, { projection: { _id: 1 } }))) {
      res.status(404).json({ error: 'Проєкт не знайдено.' });
      return;
    }
    const { title, description, image } = req.body ?? {};
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 160 ||
      typeof description !== 'string' ||
      !description.trim() ||
      description.trim().length > 5000
    ) {
      res.status(400).json({ error: 'Назва: 1–160 символів. Опис: 1–5000 символів.' });
      return;
    }
    let imageUrl: string | undefined;
    let filePath: string | undefined;
    if (image !== undefined && image !== null) {
      if (
        typeof image !== 'string' ||
        image.length > 6990508 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(image)
      ) {
        res.status(400).json({ error: 'Некоректне фото.' });
        return;
      }
      let output: Buffer;
      try {
        const input = Buffer.from(image, 'base64');
        if (input.length > 5 * 1024 * 1024) throw new Error('Size');
        const pipeline = sharp(input, { limitInputPixels: 25000000, failOn: 'warning' });
        const meta = await pipeline.metadata();
        if (
          !['jpeg', 'png', 'webp', 'avif', 'heif'].includes(meta.format ?? '') ||
          (meta.pages ?? 1) > 1
        )
          throw new Error('Format');
        output = await pipeline
          .rotate()
          .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        res
          .status(400)
          .json({ error: 'Потрібне фото JPG, PNG, WebP або AVIF до 5 МБ і 25 мегапікселів.' });
        return;
      }
      const filename = `${token()}.webp`;
      filePath = join(imagesDir, filename);
      await writeFile(filePath, output, { flag: 'wx' });
      imageUrl = `/media/projects/${filename}`;
    }
    try {
      const fields = {
        title: title.trim(),
        description: description.trim(),
        ...(imageUrl ? { imageUrl } : {}),
      };
      if (id) {
        const previous = await db
          .collection('projects')
          .findOneAndUpdate(
            { _id: id },
            { $set: fields, ...(image === null ? { $unset: { imageUrl: '' } } : {}) },
            { returnDocument: 'before' },
          );
        if (!previous) {
          if (filePath) await unlink(filePath).catch(() => {});
          res.status(404).json({ error: 'Проєкт не знайдено.' });
          return;
        }
        if (image !== undefined) await cleanupImage(previous['imageUrl']);
        const keptImage = image === undefined ? previous['imageUrl'] : imageUrl;
        res.json({
          id: id.toHexString(),
          title: fields.title,
          description: fields.description,
          ...(keptImage ? { imageUrl: keptImage } : {}),
        });
      } else {
        const project = { ...fields, sortOrder: Date.now() };
        const result = await db.collection('projects').insertOne(project);
        res.status(201).json({ id: result.insertedId.toHexString(), ...project });
      }
    } catch (error) {
      if (filePath) await unlink(filePath).catch(() => {});
      throw error;
    }
  };
  router.post('/projects', express.json({ limit: '7mb' }), saveProject);
  router.put('/projects/:id', express.json({ limit: '7mb' }), saveProject);
  router.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const status = (error as { status?: number }).status;
      if (status === 413 || status === 400) {
        res.status(status).json({ error: 'Некоректні дані або завеликий файл.' });
        return;
      }
      console.error('Admin request failed');
      res.status(500).json({ error: 'Не вдалося виконати запит. Спробуйте пізніше.' });
    },
  );
  return router;
}
