const port = process.env.PORT!
export default {
  isDev: process.env.NODE_ENV === 'development',
  port,
  baseURL: 'https://localhost:' + port,
  db: {
    connStr: process.env.PG_CONNECTION_STRING!,
  },
  auth: {
    key: process.env.APP_AUTH_KEY!,
  },
}
