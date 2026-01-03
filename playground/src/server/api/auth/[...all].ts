import { auth } from '@/server/lib/auth'

export default defineEventHandler(
  event => auth().handler(toWebRequest(event)),
)
