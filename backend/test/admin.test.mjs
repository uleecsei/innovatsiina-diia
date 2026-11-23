import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import sharp from 'sharp';
import { createApp } from '../dist/app.js';
import { createAdminRouter } from '../dist/admin.js';
import { hashPassword, verifyPassword, digest } from '../dist/admin-auth.js';
import { createContentRepository } from '../dist/modules/content.js';
import { readConfig } from '../dist/config.js';

test('password hashes use independent salts and verify correctly', async () => {
  const first = await hashPassword('test-only-long-password');
  assert.notEqual(first, await hashPassword('test-only-long-password'));
  assert.equal(await verifyPassword('test-only-long-password', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
});

test('production requires exact HTTPS admin origins', () => {
  const env = { MONGODB_URI: 'mongodb://localhost', NODE_ENV: 'production' };
  assert.throws(() => readConfig(env), /ADMIN_ORIGINS/);
  assert.throws(() => readConfig({ ...env, ADMIN_ORIGINS: 'http://example.com' }), /ADMIN_ORIGINS/);
  assert.equal(readConfig({ ...env, ADMIN_ORIGINS: 'https://example.com' }).secureCookies, true);
});

test(
  'admin security and content CRUD integration',
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const client = new MongoClient(process.env.TEST_MONGODB_URI);
    const db = client.db(`admin_test_${randomUUID().replaceAll('-', '')}`);
    const directory = await mkdtemp(join(tmpdir(), 'admin-test-'));
    let server;
    try {
      await client.connect();
      await db.collection('admin').insertOne({
        _id: 'owner',
        username: 'owner',
        passwordHash: await hashPassword('test-only-long-password'),
      });
      const router = await createAdminRouter(db, directory, ['http://localhost:4200'], false, {
        specialistPortfoliosDir: directory,
        reportsDir: directory,
      });
      server = createApp(
        createContentRepository(db),
        { projectImagesDir: directory, specialistPortfoliosDir: directory, reportsDir: directory },
        router,
      ).listen(0, '127.0.0.1');
      await once(server, 'listening');
      const base = `http://127.0.0.1:${server.address().port}`;
      const request = (path, body, extra = {}, method = 'POST') =>
        fetch(base + path, {
          method,
          headers: {
            Origin: 'http://localhost:4200',
            'Content-Type': 'application/json',
            ...extra,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      assert.equal((await fetch(base + '/api/admin/projects')).status, 401);
      assert.equal(
        (await request('/api/admin/projects', { title: 'Bad', description: 'Bad' })).status,
        401,
      );
      assert.equal(
        (await request('/api/admin/login', {}, { Origin: 'https://attacker.example' })).status,
        403,
      );
      assert.equal(
        (await request('/api/admin/login', { username: 'owner', password: 'wrong' })).status,
        401,
      );
      const login = await request('/api/admin/login', {
        username: 'owner',
        password: 'test-only-long-password',
      });
      assert.equal(login.status, 200);
      const setCookie = login.headers.get('set-cookie');
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Strict/);
      const cookie = setCookie.split(';')[0];
      const { csrf } = await login.json();
      const auth = { Cookie: cookie, 'X-CSRF-Token': csrf };
      assert.equal((await fetch(base + '/api/admin/session', { headers: auth })).status, 200);
      assert.equal((await request('/api/admin/projects', {}, { Cookie: cookie })).status, 403);
      assert.equal((await request('/api/admin/projects', {}, auth)).status, 400);
      const project = { title: 'Test project', description: 'Test description' };
      assert.equal(
        (
          await request(
            '/api/admin/projects',
            { ...project, image: Buffer.from('<svg></svg>').toString('base64') },
            auth,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/api/admin/projects',
            { ...project, image: 'A'.repeat(7 * 1024 * 1024) },
            auth,
          )
        ).status,
        413,
      );
      const input = await sharp({
        create: { width: 20, height: 20, channels: 3, background: '#123456' },
      })
        .png()
        .toBuffer();
      const saved = await request(
        '/api/admin/projects',
        { ...project, image: input.toString('base64') },
        auth,
      );
      assert.equal(saved.status, 201);
      const record = await saved.json();
      const publicProjects = await (await fetch(base + '/api/projects')).json();
      assert.equal(publicProjects[0].id, record.id);
      const uploaded = await fetch(base + record.imageUrl);
      assert.equal(uploaded.status, 200);
      assert.equal(
        (await sharp(Buffer.from(await uploaded.arrayBuffer())).metadata()).format,
        'webp',
      );
      assert.equal((await readdir(directory)).length, 1);
      assert.equal(
        (
          await request('/api/admin/projects', project, {
            ...auth,
            Origin: 'https://attacker.example',
          })
        ).status,
        403,
      );
      const itemPath = `/api/admin/projects/${record.id}`;
      for (const method of ['PUT', 'DELETE']) {
        assert.equal((await request(itemPath, project, {}, method)).status, 401);
        assert.equal((await request(itemPath, project, { Cookie: cookie }, method)).status, 403);
        assert.equal(
          (
            await request(
              itemPath,
              project,
              { ...auth, Origin: 'https://attacker.example' },
              method,
            )
          ).status,
          403,
        );
        assert.equal(
          (await request('/api/admin/projects/invalid', project, auth, method)).status,
          400,
        );
        assert.equal(
          (await request('/api/admin/projects/000000000000000000000000', project, auth, method))
            .status,
          404,
        );
      }
      const edited = { title: 'Edited title', description: 'Edited description' };
      const update = await request(itemPath, edited, auth, 'PUT');
      assert.equal(update.status, 200);
      assert.equal((await update.json()).imageUrl, record.imageUrl);
      assert.equal((await (await fetch(base + '/api/projects')).json())[0].title, edited.title);
      assert.equal((await request(itemPath, { ...edited, title: ' ' }, auth, 'PUT')).status, 400);
      assert.equal(
        (await request(itemPath, { ...edited, image: 'not-an-image' }, auth, 'PUT')).status,
        400,
      );
      assert.equal((await fetch(base + record.imageUrl)).status, 200);
      const replaced = await request(
        itemPath,
        { ...edited, image: input.toString('base64') },
        auth,
        'PUT',
      );
      assert.equal(replaced.status, 200);
      const replacement = await replaced.json();
      assert.notEqual(replacement.imageUrl, record.imageUrl);
      assert.equal((await fetch(base + record.imageUrl)).status, 404);
      assert.equal((await readdir(directory)).length, 1);
      const removedImage = await request(itemPath, { ...edited, image: null }, auth, 'PUT');
      assert.equal(removedImage.status, 200);
      assert.equal((await removedImage.json()).imageUrl, undefined);
      assert.equal((await readdir(directory)).length, 0);
      await request(itemPath, { ...edited, image: input.toString('base64') }, auth, 'PUT');
      assert.equal((await request(itemPath, undefined, auth, 'DELETE')).status, 204);
      assert.deepEqual(await (await fetch(base + '/api/projects')).json(), []);
      assert.equal((await readdir(directory)).length, 0);
      assert.equal((await request(itemPath, undefined, auth, 'DELETE')).status, 404);
      const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF').toString(
        'base64',
      );
      for (const kind of ['specialists', 'reports']) {
        const url = `/api/admin/${kind}`;
        const fields =
          kind === 'reports'
            ? { year: 2025 }
            : { name: 'Test specialist', skill: 'Consulting', email: 'test@example.com' };
        const fileField = kind === 'reports' ? 'pdfUrl' : 'portfolioUrl';
        assert.equal((await fetch(base + url)).status, 401);
        assert.equal((await request(url, fields)).status, 401);
        assert.equal((await request(url, fields, { Cookie: cookie })).status, 403);
        assert.equal((await request(url, { ...fields, file: 'bm90IHBkZg==' }, auth)).status, 400);
        assert.equal(
          (
            await request(
              url,
              kind === 'reports' ? { year: 1800, file: pdf } : { ...fields, email: 'invalid' },
              auth,
            )
          ).status,
          400,
        );
        if (kind === 'reports') assert.equal((await request(url, fields, auth)).status, 400);
        if (kind === 'specialists') {
          await mkdir(join(directory, 'photos'), { recursive: true });
          assert.equal(
            (await request(url, { ...fields, file: pdf, image: 'bm90IGFuIGltYWdl' }, auth)).status,
            400,
          );
        }
        const created = await request(
          url,
          {
            ...fields,
            file: pdf,
            ...(kind === 'specialists' ? { image: input.toString('base64') } : {}),
          },
          auth,
        );
        assert.equal(created.status, 201);
        const item = await created.json();
        const itemUrl = `${url}/${item.id}`;
        if (kind === 'specialists') {
          const portrait = await fetch(base + item.imageUrl);
          assert.equal(portrait.status, 200);
          assert.equal(portrait.headers.get('content-type'), 'image/webp');
          assert.equal(portrait.headers.get('content-disposition'), null);
          assert.equal(
            (await sharp(Buffer.from(await portrait.arrayBuffer())).metadata()).format,
            'webp',
          );
        }
        assert.equal((await (await fetch(base + url, { headers: auth })).json()).length, 1);
        const download = await fetch(base + item[fileField]);
        assert.equal(download.status, 200);
        assert.equal(download.headers.get('content-disposition'), 'inline');
        assert.equal(download.headers.get('content-type'), 'application/pdf');
        for (const method of ['PUT', 'DELETE']) {
          assert.equal((await request(itemUrl, fields, {}, method)).status, 401);
          assert.equal((await request(itemUrl, fields, { Cookie: cookie }, method)).status, 403);
          assert.equal(
            (
              await request(
                itemUrl,
                fields,
                { ...auth, Origin: 'https://attacker.example' },
                method,
              )
            ).status,
            403,
          );
          assert.equal((await request(`${url}/invalid`, fields, auth, method)).status, 400);
          assert.equal(
            (await request(`${url}/000000000000000000000000`, fields, auth, method)).status,
            404,
          );
        }
        const changedFields =
          kind === 'reports' ? { year: 2026 } : { ...fields, skill: 'Updated service' };
        const changed = await request(itemUrl, changedFields, auth, 'PUT');
        assert.equal(changed.status, 200);
        const changedItem = await changed.json();
        assert.equal(changedItem[fileField], item[fileField]);
        if (kind === 'specialists') assert.equal(changedItem.imageUrl, item.imageUrl);
        const publicItem = (await (await fetch(base + `/api/${kind}`)).json())[0];
        assert.equal(
          kind === 'reports' ? publicItem.year : publicItem.skill,
          kind === 'reports' ? 2026 : 'Updated service',
        );
        if (kind === 'specialists') {
          assert.equal(publicItem.imageUrl, item.imageUrl);
          const replacement = await request(
            itemUrl,
            { ...changedFields, image: input.toString('base64') },
            auth,
            'PUT',
          );
          assert.equal(replacement.status, 200);
          const newPortrait = await replacement.json();
          assert.notEqual(newPortrait.imageUrl, item.imageUrl);
          assert.equal((await fetch(base + item.imageUrl)).status, 404);
          assert.equal(newPortrait.portfolioUrl, item.portfolioUrl);
          const removed = await request(itemUrl, { ...changedFields, image: null }, auth, 'PUT');
          assert.equal(removed.status, 200);
          assert.equal((await removed.json()).imageUrl, undefined);
          assert.equal((await fetch(base + newPortrait.imageUrl)).status, 404);
          await request(
            itemUrl,
            { ...changedFields, image: input.toString('base64') },
            auth,
            'PUT',
          );
        }
        const replacedFile = await request(itemUrl, { ...changedFields, file: pdf }, auth, 'PUT');
        assert.equal(replacedFile.status, 200);
        const replacedItem = await replacedFile.json();
        assert.notEqual(replacedItem[fileField], item[fileField]);
        assert.equal((await fetch(base + item[fileField])).status, 404);
        const removedFile = await request(itemUrl, { ...changedFields, file: null }, auth, 'PUT');
        assert.equal(removedFile.status, kind === 'reports' ? 400 : 200);
        if (kind === 'specialists')
          assert.equal((await removedFile.json()).portfolioUrl, undefined);
        assert.equal((await request(itemUrl, undefined, auth, 'DELETE')).status, 204);
        if (kind === 'specialists') assert.deepEqual(await readdir(join(directory, 'photos')), []);
        assert.deepEqual(await (await fetch(base + `/api/${kind}`)).json(), []);
        assert.equal((await fetch(base + replacedItem[fileField])).status, 404);
        assert.equal((await request(itemUrl, undefined, auth, 'DELETE')).status, 404);
      }
      // Idle and absolute expiry are checked on every request, independent of TTL cleanup.
      const id = digest(cookie.split('=')[1]);
      await db
        .collection('admin_sessions')
        .updateOne({ _id: id }, { $set: { lastSeen: new Date(0) } });
      assert.equal((await fetch(base + '/api/admin/projects', { headers: auth })).status, 401);
      await db
        .collection('admin_sessions')
        .updateOne({ _id: id }, { $set: { lastSeen: new Date(), expiresAt: new Date(0) } });
      assert.equal((await fetch(base + '/api/admin/projects', { headers: auth })).status, 401);
      await db
        .collection('admin_sessions')
        .updateOne({ _id: id }, { $set: { expiresAt: new Date(Date.now() + 60000) } });
      assert.equal((await request('/api/admin/logout', {}, auth)).status, 204);
      assert.equal((await fetch(base + '/api/admin/projects', { headers: auth })).status, 401);
      for (let i = 0; i < 9; i++)
        await request('/api/admin/login', { username: 'owner', password: 'wrong' });
      assert.equal(
        (
          await request('/api/admin/login', {
            username: 'owner',
            password: 'test-only-long-password',
          })
        ).status,
        429,
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await db.dropDatabase();
      await client.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
