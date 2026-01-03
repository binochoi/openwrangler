export default defineEventHandler(async (e) => {
  const config = useRuntimeConfig()
  setResponseHeaders(e, {
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
    'Access-Control-Allow-Origin': `https://${config.baseURL}`,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  })

  if (e.node.req.method === 'OPTIONS') {
    return 'OK'
  }
})
