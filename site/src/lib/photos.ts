// Photo registry — name -> imported asset (Astro optimizes at build).
import type { ImageMetadata } from 'astro';

const modules = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.webp', { eager: true });

const byName: Record<string, ImageMetadata> = {};
for (const [path, mod] of Object.entries(modules)) {
  const name = path.split('/').pop()!.replace('.webp', '');
  byName[name] = mod.default;
}

export function getPhoto(name: string): ImageMetadata | undefined {
  return byName[name];
}
