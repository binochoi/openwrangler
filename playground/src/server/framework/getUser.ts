import type { H3Event } from 'h3'
import type { User } from '@/types'

export const getUser = (e: H3Event) => e.context.auth?.user as User | null
