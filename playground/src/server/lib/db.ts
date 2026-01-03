import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../database/schema'
import appConfig from '../../config'

const config = typeof useRuntimeConfig !== 'undefined' ? useRuntimeConfig() : appConfig
export const db = () => {
  const client = postgres(config.db.connStr)
  return drizzle(client, { schema })
}
