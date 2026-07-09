// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Static-first: the salon pages prerender at build time; only on-demand routes
  // (the /api capture endpoint, marked `export const prerender = false`) run on the
  // Cloudflare Worker. Keeps the site fast + mostly static, one dynamic endpoint.
  output: 'static',
  adapter: cloudflare(),

  // V2: the homepage IS the shop (owner mandate); /shop lives on as a redirect so old
  // links and muscle memory keep working. PDPs remain at /shop/[slug].
  redirects: { '/shop': '/' },
});
