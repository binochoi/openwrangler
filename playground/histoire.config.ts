import path from 'node:path'
import { HstVue } from '@histoire/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'histoire'

export default defineConfig({
  plugins: [
    HstVue(),
  ],
  storyMatch: [
    'src/components/ui/**/*.story.vue',
  ],
  setupFile: './src/histoire.setup.ts',
  vite: {
    base: '/',
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
})
