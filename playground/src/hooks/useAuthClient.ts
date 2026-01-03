import type { auth } from '@/server/lib/auth'
import { adminClient, genericOAuthClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export default () => {
  const headers = import.meta.server ? useRequestHeaders() : undefined
  return createAuthClient({
    sessionOptions: {
      refetchOnWindowFocus: false,
    },
    fetchOptions: { headers },
    plugins: [
      inferAdditionalFields<ReturnType<typeof auth>>(),
      adminClient(),
      genericOAuthClient(),
    ],
  })
}
