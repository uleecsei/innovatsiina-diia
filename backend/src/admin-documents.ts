import express from 'express';
import { decodePortrait } from './specialist-photo.ts';
import { ObjectId, type Db } from 'mongodb';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { token } from './admin-auth.ts';

// Mounted only after the admin session and CSRF middleware.
export function documentRoutes(db: Db, kind: 'specialists' | 'reports', directory: string) {
  const router = express.Router();
  const collection = db.collection(kind);
  const fileField = kind === 'reports' ? 'pdfUrl' : 'portfolioUrl';
  const projection =
    kind === 'reports'
      ? { year: 1, pdfUrl: 1 }
      : { name: 1, skill: 1, email: 1, portfolioUrl: 1, imageUrl: 1 };
  const serialize = (item: Record<string, unknown>) => {
    const result: Record<string, unknown> = { id: String(item['_id']) };
    for (const field of Object.keys(projection))
      if (item[field] !== undefined) result[field] = item[field];
    return result;
  };
  const cleanup = async (url: unknown) => {
    if (typeof url !== 'string' || !new RegExp(`^/media/${kind}/[a-f0-9]{64}\\.pdf$`).test(url))
      return;
    try {
      if (!(await collection.countDocuments({ [fileField]: url })))
        await unlink(join(directory, url.split('/').at(-1)!));
    } catch {
      console.error('Could not clean up document');
    }
  };
  const cleanupPhoto = async (url: unknown) => {
    if (typeof url !== 'string' || !/^\/media\/specialists\/photos\/[a-f0-9]{64}\.webp$/.test(url))
      return;
    try {
      if (!(await collection.countDocuments({ imageUrl: url })))
        await unlink(join(directory, 'photos', url.split('/').at(-1)!));
    } catch {
      console.error('Could not clean up portrait');
    }
  };
  router.param('id', (_req, res, next, id: string) => {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      res.status(400).json({ error: 'Некоректний ідентифікатор.' });
      return;
    }
    next();
  });
  router.get('/', async (_req, res) => {
    const items = await collection
      .find({}, { projection })
      .sort(kind === 'reports' ? { year: -1, _id: 1 } : { sortOrder: 1, _id: 1 })
      .limit(200)
      .toArray();
    res.json(items.map(serialize));
  });
  router.delete('/:id', async (req, res) => {
    const previous = await collection.findOneAndDelete({
      _id: new ObjectId(String(req.params['id'])),
    });
    if (!previous) {
      res.status(404).json({ error: 'Запис не знайдено.' });
      return;
    }
    await cleanup(previous[fileField]);
    if (kind === 'specialists') await cleanupPhoto(previous['imageUrl']);
    res.sendStatus(204);
  });
  const save: express.RequestHandler = async (req, res) => {
    const id = req.params['id'] ? new ObjectId(String(req.params['id'])) : undefined;
    const existing = id ? await collection.findOne({ _id: id }) : null;
    if (id && !existing) {
      res.status(404).json({ error: 'Запис не знайдено.' });
      return;
    }
    const { name, skill, email, year, file, image } = req.body ?? {};
    const fields: Record<string, unknown> = {};
    if (kind === 'reports') {
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        res.status(400).json({ error: 'Вкажіть рік від 1900 до 2100.' });
        return;
      }
      if (file === null || (file === undefined && !existing?.[fileField])) {
        res.status(400).json({ error: 'Додайте PDF звіту.' });
        return;
      }
      fields['year'] = year;
    } else {
      if (
        typeof name !== 'string' ||
        !name.trim() ||
        name.trim().length > 160 ||
        typeof skill !== 'string' ||
        !skill.trim() ||
        skill.trim().length > 5000 ||
        typeof email !== 'string' ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ) {
        res.status(400).json({
          error: 'Вкажіть ім’я (до 160 символів), опис послуг (до 5000) і коректний email.',
        });
        return;
      }
      Object.assign(fields, { name: name.trim(), skill: skill.trim(), email: email.trim() });
    }
    const photo =
      kind === 'specialists' && image !== undefined && image !== null
        ? await decodePortrait(image)
        : undefined;
    let photoPath: string | undefined;
    let path: string | undefined;
    if (file !== undefined && file !== null) {
      if (
        typeof file !== 'string' ||
        file.length > 13981016 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(file)
      ) {
        res.status(400).json({ error: 'Некоректний PDF.' });
        return;
      }
      const buffer = Buffer.from(file, 'base64');
      if (
        buffer.length > 10 * 1024 * 1024 ||
        !/^%PDF-\d\.\d/.test(buffer.subarray(0, 8).toString()) ||
        !buffer.subarray(-1024).includes(Buffer.from('%%EOF'))
      ) {
        res.status(400).json({ error: 'Оберіть PDF до 10 МБ.' });
        return;
      }
      const filename = `${token()}.pdf`;
      path = join(directory, filename);
      await writeFile(path, buffer, { flag: 'wx' });
      fields[fileField] = `/media/${kind}/${filename}`;
    }
    try {
      if (photo) {
        const filename = `${token()}.webp`;
        photoPath = join(directory, 'photos', filename);
        await writeFile(photoPath, photo, { flag: 'wx' });
        fields['imageUrl'] = `/media/specialists/photos/${filename}`;
      }
      const unset = {
        ...(file === null ? { [fileField]: '' } : {}),
        ...(kind === 'specialists' && image === null ? { imageUrl: '' } : {}),
      };
      if (id) {
        const previous = await collection.findOneAndUpdate(
          { _id: id },
          { $set: fields, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
          { returnDocument: 'before' },
        );
        if (!previous) {
          if (path) await unlink(path).catch(() => {});
          if (photoPath) await unlink(photoPath).catch(() => {});
          res.status(404).json({ error: 'Запис не знайдено.' });
          return;
        }
        if (file !== undefined) await cleanup(previous[fileField]);
        if (kind === 'specialists' && image !== undefined) await cleanupPhoto(previous['imageUrl']);
        const result = { ...previous, ...fields };
        for (const key of Object.keys(unset)) delete result[key];
        res.json(serialize(result));
      } else {
        const item = { ...fields, sortOrder: Date.now() };
        const inserted = await collection.insertOne(item);
        res.status(201).json(serialize({ ...item, _id: inserted.insertedId }));
      }
    } catch (error) {
      if (path) await unlink(path).catch(() => {});
      if (photoPath) await unlink(photoPath).catch(() => {});
      throw error;
    }
  };
  router.post('/', express.json({ limit: kind === 'specialists' ? '21mb' : '14mb' }), save);
  router.put('/:id', express.json({ limit: kind === 'specialists' ? '21mb' : '14mb' }), save);
  return router;
}
