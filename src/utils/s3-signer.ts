// AWS Signature Version 4 implementation for R2 S3 API
// Works in both Node.js and Cloudflare Workers (uses Web Crypto API)

interface SignatureParams {
  method: string
  url: string
  headers: Record<string, string>
  body?: ArrayBuffer | string
  accessKeyId: string
  secretAccessKey: string
  region?: string
  service?: string
}

async function sha256(data: string | ArrayBuffer): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data
  return await crypto.subtle.digest('SHA-256', dataBuffer)
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
}

async function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const kDate = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  const kSigning = await hmac(kService, 'aws4_request')
  return kSigning
}

export async function signRequest(params: SignatureParams): Promise<Record<string, string>> {
  const {
    method,
    url,
    headers,
    body,
    accessKeyId,
    secretAccessKey,
    region = 'auto',
    service = 's3',
  } = params

  const urlObj = new URL(url)
  const host = urlObj.host
  const path = urlObj.pathname || '/'
  const queryString = urlObj.search.slice(1) // Remove '?'

  // Create timestamp
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  // Canonical headers
  const canonicalHeaders = {
    host,
    'x-amz-date': amzDate,
    ...headers,
  }

  const signedHeaders = Object.keys(canonicalHeaders).sort().join(';')
  const canonicalHeadersString = Object.keys(canonicalHeaders)
    .sort()
    .map(key => `${key}:${canonicalHeaders[key]}`)
    .join('\n')

  // Payload hash
  const payloadHash = body
    ? hex(await sha256(body))
    : hex(await sha256(''))

  // Canonical request
  const canonicalRequest = [
    method,
    path,
    queryString,
    canonicalHeadersString + '\n',
    signedHeaders,
    payloadHash,
  ].join('\n')

  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    hex(await sha256(canonicalRequest)),
  ].join('\n')

  // Calculate signature
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service)
  const signature = hex(await hmac(signingKey, stringToSign))

  // Authorization header
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    'Authorization': authorization,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  }
}
