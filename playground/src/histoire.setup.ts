import type { App } from 'vue'
import { createPinia } from 'pinia'
import * as vue from 'vue'
import '@/app.css'

export function setupApp({ app }: { app: App }) {
  Object.assign(window, { ...vue })
  const pinia = createPinia()
  app.use(pinia)
}
