import type { H3Event } from 'h3'
import { getUser } from './getUser'

export function assertUser(e: H3Event) {
  const user = getUser(e)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
  return user
}
