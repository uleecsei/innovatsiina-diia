import type { Db } from 'mongodb';

export interface Project {
  title: string;
  description: string;
  imageUrl?: string;
  sortOrder: number;
}

export interface Specialist {
  name: string;
  skill: string;
  email: string;
  portfolioUrl?: string;
  sortOrder: number;
}

export interface Report {
  year: number;
  pdfUrl: string;
}

export interface ContentRepository {
  ping(): Promise<void>;
  projects(): Promise<unknown[]>;
  specialists(): Promise<unknown[]>;
  reports(): Promise<unknown[]>;
}

export function createContentRepository(db: Db): ContentRepository {
  return {
    async ping() {
      await db.command({ ping: 1 });
    },
    async projects() {
      const items = await db
        .collection<Project>('projects')
        .find({}, { projection: { title: 1, description: 1, imageUrl: 1 } })
        .sort({ sortOrder: 1, _id: 1 })
        .limit(200)
        .toArray();
      return items.map(({ _id, ...item }) => ({ id: _id.toHexString(), ...item }));
    },
    async reports() {
      const items = await db
        .collection<Report>('reports')
        .find({}, { projection: { year: 1, pdfUrl: 1 } })
        .sort({ year: -1, _id: 1 })
        .limit(200)
        .toArray();
      return items.map(({ _id, ...item }) => ({ id: _id.toHexString(), ...item }));
    },
    async specialists() {
      const items = await db
        .collection<Specialist>('specialists')
        .find({}, { projection: { name: 1, skill: 1, email: 1, portfolioUrl: 1 } })
        .sort({ sortOrder: 1, _id: 1 })
        .limit(200)
        .toArray();
      return items.map(({ _id, ...item }) => ({ id: _id.toHexString(), ...item }));
    },
  };
}
