import '@/app.css'
import { createPinia } from 'pinia'
import type { App } from 'vue'
import * as vue from 'vue'

export function setupApp({ app }: { app: App }) {
  Object.assign(window, { ...vue })
  const pinia = createPinia()
  app.use(pinia)
}
