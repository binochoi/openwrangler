import type { EventHandler, H3Event } from 'h3'
import { auth } from '@/server/lib/auth'

/**
 * Middleware used to require authentication for a route.
 * Can be extended to check for specific roles or permissions.
 */
export const injectAuth: EventHandler = async (e: H3Event) => {
  const config = useRuntimeConfig(e)
  const cookie = getCookie(e, `__Secure-${config.auth.key}.session_token`)
  if (!cookie) {
    return
  }

  const session = await auth().api.getSession({
    headers: e.headers,
  })
  e.context.auth = session
}
