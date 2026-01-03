import type { AuthState, Session, User } from '../types'
import useAuthClient from './useAuthClient'

export default () => {
  const client = useAuthClient()
  const auth = client.useSession()
  const user = computed<User | undefined>(() => auth.value?.data?.user)
  const session = computed<Session | undefined>(() => auth.value?.data?.session)
  const state = computed<AuthState>(() => {
    if (auth.value.error) {
      return {
        status: 'error',
        error: auth.value.error,
      }
    }
    if (auth.value.isPending) {
      return { status: 'loading' }
    }
    if (auth.value.isRefetching) {
      return { status: 'loading', isRefetching: true }
    }
    return {
      status: user.value ? 'logged_in' : 'not_logged_in',
      user: user.value!,
      session: session.value!,
    }
  })
  return {
    client,
    user,
    session,
    state,
  }
}
