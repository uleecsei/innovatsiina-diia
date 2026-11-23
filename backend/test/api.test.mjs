import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../dist/app.js';
import { readConfig } from '../dist/config.js';

async function withServer(repository, run, media = {}) {
  const server = createApp(repository, media).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}
const project = { id: 'abc', title: 'Проєкт', description: 'Опис' };
const specialist = { id: 'def', name: 'Ім’я', skill: 'Тренерка', email: 'test@example.com' };
const repository = {
  async ping() {},
  async reports() {
    return [{ id: 'ghi', year: 2025, pdfUrl: '/media/reports/2025.pdf' }];
  },
  async projects() {
    return [project];
  },
  async specialists() {
    return [specialist];
  },
};

test('reports and PDF portfolios open inline while other portfolio files download', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'media-preview-'));
  try {
    await writeFile(join(directory, 'document.pdf'), '%PDF-1.7\n');
    await writeFile(join(directory, 'portfolio.zip'), 'archive');
    await withServer(
      repository,
      async (base) => {
        for (const path of ['/media/reports/document.pdf', '/media/specialists/document.pdf']) {
          const response = await fetch(base + path);
          assert.equal(response.status, 200);
          assert.equal(response.headers.get('content-type'), 'application/pdf');
          assert.equal(response.headers.get('content-disposition'), 'inline');
          assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
          assert.equal(await response.text(), '%PDF-1.7\n');
        }
        const archive = await fetch(base + '/media/specialists/portfolio.zip');
        assert.equal(archive.status, 200);
        assert.equal(archive.headers.get('content-disposition'), 'attachment');
        await archive.arrayBuffer();
      },
      { reportsDir: directory, specialistPortfoliosDir: directory },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('public endpoints return repository data and health', async () => {
  await withServer(repository, async (base) => {
    for (const [path, expected] of [
      ['/api/projects', [project]],
      ['/api/reports', await repository.reports()],
      ['/api/specialists', [specialist]],
      ['/api/health', { status: 'ok' }],
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), expected);
    }
    assert.equal((await fetch(base + '/api/unknown')).status, 404);
    assert.equal((await fetch(base + '/api/projects', { method: 'POST' })).status, 404);
  });
});

test('database failure returns 503 health and safe 500 content errors', async () => {
  const fail = async () => {
    throw new Error('private database details');
  };
  await withServer({ ping: fail, projects: fail, specialists: fail }, async (base) => {
    assert.equal((await fetch(base + '/api/health')).status, 503);
    const response = await fetch(base + '/api/projects');
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Internal server error' });
  });
});

test('configuration requires MongoDB and validates the port', () => {
  assert.throws(() => readConfig({}), /MONGODB_URI/);
  assert.throws(() => readConfig({ MONGODB_URI: 'https://example.com' }), /MONGODB_URI/);
  assert.throws(() => readConfig({ MONGODB_URI: 'mongodb://localhost', PORT: 'wrong' }), /PORT/);
  assert.equal(readConfig({ MONGODB_URI: 'mongodb://localhost' }).port, 3000);
});
