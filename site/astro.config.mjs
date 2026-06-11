// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // V2: the homepage IS the shop (owner mandate); /shop lives on as a redirect so old
  // links and muscle memory keep working. PDPs remain at /shop/[slug].
  redirects: { '/shop': '/' },
});
