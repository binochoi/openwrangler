import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import appConfig from '../../config'
import * as schema from '../../server/database/schema'
import { db } from './db'

const config = typeof useRuntimeConfig !== 'undefined' ? useRuntimeConfig() : appConfig
export function auth() {
  return betterAuth({
    baseURL: `${config.baseURL}/auth`,
    trustedOrigins: [config.baseURL],
    secret: 'C2AqBaeCeP29eOiBndlEugLMCdUiYdghKhTwl5Jvx64=',
    database: drizzleAdapter(db(), {
      provider: 'pg',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    // socialProviders: {
    // google: {
    //   redirectURI: `${baseURL}/api/auth/callback/google`,
    // },
    // },
    session: {
      expiresIn: 60 * 60 * 24 * 60, // 60 days
      updateAge: 60 * 60 * 24 * 7, // 7 day (every 1 day the session expiration is updated)
    },
    advanced: {
      cookiePrefix: config.auth.key,
    },
    logger: {
      level: 'debug',
    },
  })
}
export { toNodeHandler } from 'better-auth/node'
