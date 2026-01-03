import fetchAuthSession from '../hooks/fetchAuthSession'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const auth = fetchAuthSession()
  const { client } = auth
  return {
    ...auth,
    client: computed(() => auth.client),
    async signOut() {
      await client.signOut()
    },
  }
})
