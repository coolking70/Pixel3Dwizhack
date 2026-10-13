import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({ plugins: [vue()], build: { rolldownOptions: { input: ['index.html', 'character-lab.html', 'combat-lab.html', 'room.html', 'dungeon.html', 'adventure.html', 'alpha.html', 'alpha2.html', 'alpha3.html', 'alpha4.html', 'alpha5.html', 'alpha6.html'] } } });
