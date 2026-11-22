import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { darkroomSavePlugin } from './src/lib/darkroomPlugin.mjs';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  vite: {
    plugins: [darkroomSavePlugin()],
  },
  output: 'static',
  redirects: {
    '/portfolio': '/gallery',
    '/experience': '/about',
  },
  build: {
    format: 'directory',
  },
});
