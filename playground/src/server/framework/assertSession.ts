import type { H3Event } from 'h3'
import { getSession } from '.'

export function assertSession(e: H3Event) {
  const session = getSession(e)
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
  return session
}
