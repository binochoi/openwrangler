import type { BetterFetchError } from 'better-auth/vue'
import type { db } from '@/server/lib/db'
import type { auth } from '@/server/lib/auth'

export type Session = ReturnType<typeof auth>['$Infer']['Session']['session']
export type User = ReturnType<typeof auth>['$Infer']['Session']['user']
export type AuthState = {
  status: 'error'
  error: BetterFetchError
} | {
  status: 'loading'
  isRefetching?: true
} | {
  status: 'refetching'
} | {
  status: 'not_logged_in'
} | {
  status: 'logged_in'
  user: User
  session: Session
}

export type Database = ReturnType<typeof db>
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
export type DbOrTx = Database | Transaction
