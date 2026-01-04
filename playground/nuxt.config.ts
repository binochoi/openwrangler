import removeOtherAliases from './src/utils/removeOtherAliases'
import config from './src/config'
import nitroCloudflareDev from '@bino0216/nitro-cloudflare-dev'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@vueuse/nuxt', '@pinia/colada-nuxt', '@nuxt/ui'],
  ssr: true,
  css: ['./src/app.css'],
  ui: {
    colorMode: false,
  },
  runtimeConfig: config,
  srcDir: 'src/',
  serverDir: 'src/server',
  routeRules: {
    '/*': {
      ssr: false,
      prerender: true,
    },
  },
  devServer: {
    port: Number(config.port),
    https: {
      cert: './localhost.pem',
      key: './localhost-key.pem',
    },
  },
  compatibilityDate: '2024-11-30',
  nitro: {
    preset: 'cloudflare_module',
    minify: true,
    rollupConfig: {
      external: ['cloudflare:sockets', '@aws-sdk/client-s3', 'wrangler'],
    },
    modules: [nitroCloudflareDev],
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  hooks: {
    'prepare:types'(config) {
      removeOtherAliases(config)
    },
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },
  icon: {
    mode: 'css',
    cssLayer: 'base',
    provider: 'iconify',
    clientBundle: {
      scan: true,
      // ...or other bundle options
    },
  },
})
