import { defineConfig } from 'histoire'
import { HstVue } from '@histoire/plugin-vue'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

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
