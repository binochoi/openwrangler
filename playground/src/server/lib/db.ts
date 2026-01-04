import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import appConfig from '../../config'
import * as schema from '../database/schema'

const config = typeof useRuntimeConfig !== 'undefined' ? useRuntimeConfig() : appConfig
export function db() {
  const client = postgres(config.db.connStr)
  return drizzle(client, { schema })
}
