import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: mode === 'pages' ? '/Pixel3Dwizhack/' : '/',
  build: {
    outDir: mode === 'pages' ? 'dist-pages' : 'dist',
    rolldownOptions: { input: ['index.html', 'character-lab.html', 'combat-lab.html', 'room.html', 'dungeon.html', 'adventure.html', 'alpha.html', 'alpha2.html', 'alpha3.html', 'alpha4.html', 'alpha5.html', 'alpha6.html'] }
  }
}));
