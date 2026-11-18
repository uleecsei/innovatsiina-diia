import sharp from 'sharp';

export async function decodePortrait(image: unknown): Promise<Buffer> {
  try {
    if (
      typeof image !== 'string' ||
      image.length > 6990508 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(image)
    )
      throw new Error();
    const input = Buffer.from(image, 'base64');
    if (input.length > 5 * 1024 * 1024) throw new Error();
    const pipeline = sharp(input, { limitInputPixels: 25000000, failOn: 'warning' });
    const meta = await pipeline.metadata();
    if (
      !['jpeg', 'png', 'webp', 'avif', 'heif'].includes(meta.format ?? '') ||
      (meta.pages ?? 1) > 1
    )
      throw new Error();
    return await pipeline
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw Object.assign(new Error('Invalid portrait'), { status: 400 });
  }
}
