import type { H3Event, ValidateFunction } from 'h3'
import superjson from 'superjson'

export const readSuperBody = async <T>(e: H3Event, validated: ValidateFunction<T>): Promise<T> => {
  const rawBody = await readRawBody(e)
  const body = superjson.parse(rawBody || '{}')
  return validated(body) as T
}
