import type { H3Event } from 'h3'
import type { Session } from '@/types'

export const getSession = (e: H3Event) => e.context.auth?.session as Session | null
