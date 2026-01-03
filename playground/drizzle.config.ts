import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/database/schema',
  out: './.persisted/.migrations',
  breakpoints: true,
  dbCredentials: {
    url: process.env.PG_CONNECTION_STRING!,
  },
})
