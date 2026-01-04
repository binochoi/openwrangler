import type {
  R2Bucket,
  R2GetOptions,
  R2ListOptions,
  R2MultipartOptions,
  R2MultipartUpload,
  R2Object,
  R2ObjectBody,
  R2Objects,
  R2PutOptions,
} from '@cloudflare/workers-types/experimental'
import { signRequest } from '../utils/s3-signer'

export interface R2Config {
  accountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
}

export function createR2Binding(config: R2Config, bucketName: string): R2Bucket {
  const { accountId, r2AccessKeyId, r2SecretAccessKey } = config
  const baseUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}`

  async function signedFetch(
    method: string,
    key: string,
    options?: {
      headers?: Record<string, string>
      body?: ArrayBuffer | string | ReadableStream
      queryParams?: Record<string, string>
    },
  ): Promise<Response> {
    const queryString = options?.queryParams
      ? `?${new URLSearchParams(options.queryParams).toString()}`
      : ''
    const url = `${baseUrl}/${encodeURIComponent(key)}${queryString}`

    // Convert ReadableStream to ArrayBuffer for signing
    let body: ArrayBuffer | string | undefined
    if (options?.body instanceof ReadableStream) {
      const reader = options.body.getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break
        chunks.push(value)
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      body = result.buffer
    }
    else {
      body = options?.body
    }

    const signatureHeaders = await signRequest({
      method,
      url,
      headers: options?.headers || {},
      body,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    })

    return fetch(url, {
      method,
      headers: {
        ...options?.headers,
        ...signatureHeaders,
      },
      body,
    })
  }

  async function signedFetchBucket(
    method: string,
    options?: {
      headers?: Record<string, string>
      queryParams?: Record<string, string>
    },
  ): Promise<Response> {
    const queryString = options?.queryParams
      ? `?${new URLSearchParams(options.queryParams).toString()}`
      : ''
    const url = `${baseUrl}${queryString}`

    const signatureHeaders = await signRequest({
      method,
      url,
      headers: options?.headers || {},
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    })

    return fetch(url, {
      method,
      headers: {
        ...options?.headers,
        ...signatureHeaders,
      },
    })
  }

  const r2Bucket: R2Bucket = {
    async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null> {
      const headers: Record<string, string> = {}

      if (options?.range) {
        if (typeof options.range === 'object') {
          const { offset, length, suffix } = options.range
          if (suffix) {
            headers.Range = `bytes=-${suffix}`
          }
          else if (offset !== undefined) {
            headers.Range = length
              ? `bytes=${offset}-${offset + length - 1}`
              : `bytes=${offset}-`
          }
        }
      }

      if (options?.onlyIf) {
        if (options.onlyIf.etagMatches) {
          headers['If-Match'] = options.onlyIf.etagMatches
        }
        if (options.onlyIf.etagDoesNotMatch) {
          headers['If-None-Match'] = options.onlyIf.etagDoesNotMatch
        }
        if (options.onlyIf.uploadedBefore) {
          headers['If-Unmodified-Since'] = options.onlyIf.uploadedBefore.toUTCString()
        }
        if (options.onlyIf.uploadedAfter) {
          headers['If-Modified-Since'] = options.onlyIf.uploadedAfter.toUTCString()
        }
      }

      const response = await signedFetch('GET', key, { headers })

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`R2 GET failed: ${response.status}`)
      }

      // Parse R2 metadata from headers
      const customMetadata: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('x-amz-meta-')) {
          const metaKey = key.slice('x-amz-meta-'.length)
          customMetadata[metaKey] = value
        }
      })

      const r2Object: R2ObjectBody = {
        key,
        version: response.headers.get('x-amz-version-id') || '',
        size: Number.parseInt(response.headers.get('content-length') || '0', 10),
        etag: response.headers.get('etag') || '',
        httpEtag: response.headers.get('etag') || '',
        checksums: {},
        uploaded: new Date(response.headers.get('last-modified') || Date.now()),
        httpMetadata: {
          contentType: response.headers.get('content-type') || undefined,
          contentLanguage: response.headers.get('content-language') || undefined,
          contentDisposition: response.headers.get('content-disposition') || undefined,
          contentEncoding: response.headers.get('content-encoding') || undefined,
          cacheControl: response.headers.get('cache-control') || undefined,
          cacheExpiry: response.headers.get('expires')
            ? new Date(response.headers.get('expires')!)
            : undefined,
        },
        customMetadata,
        range: options?.range
          ? {
              offset: 0,
              length: Number.parseInt(response.headers.get('content-length') || '0', 10),
            }
          : undefined,
        body: response.body!,
        bodyUsed: false,
        arrayBuffer: () => response.arrayBuffer(),
        text: () => response.text(),
        json: () => response.json(),
        blob: () => response.blob(),
        writeHttpMetadata: (headers: Headers) => {
          if (r2Object.httpMetadata.contentType) {
            headers.set('content-type', r2Object.httpMetadata.contentType)
          }
          if (r2Object.httpMetadata.contentLanguage) {
            headers.set('content-language', r2Object.httpMetadata.contentLanguage)
          }
          if (r2Object.httpMetadata.contentDisposition) {
            headers.set('content-disposition', r2Object.httpMetadata.contentDisposition)
          }
          if (r2Object.httpMetadata.contentEncoding) {
            headers.set('content-encoding', r2Object.httpMetadata.contentEncoding)
          }
          if (r2Object.httpMetadata.cacheControl) {
            headers.set('cache-control', r2Object.httpMetadata.cacheControl)
          }
          if (r2Object.httpMetadata.cacheExpiry) {
            headers.set('expires', r2Object.httpMetadata.cacheExpiry.toUTCString())
          }
        },
      }

      return r2Object
    },

    async put(
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string,
      options?: R2PutOptions,
    ): Promise<R2Object> {
      const headers: Record<string, string> = {}

      if (options?.httpMetadata) {
        if (options.httpMetadata.contentType) {
          headers['Content-Type'] = options.httpMetadata.contentType
        }
        if (options.httpMetadata.contentLanguage) {
          headers['Content-Language'] = options.httpMetadata.contentLanguage
        }
        if (options.httpMetadata.contentDisposition) {
          headers['Content-Disposition'] = options.httpMetadata.contentDisposition
        }
        if (options.httpMetadata.contentEncoding) {
          headers['Content-Encoding'] = options.httpMetadata.contentEncoding
        }
        if (options.httpMetadata.cacheControl) {
          headers['Cache-Control'] = options.httpMetadata.cacheControl
        }
        if (options.httpMetadata.cacheExpiry) {
          headers.Expires = options.httpMetadata.cacheExpiry.toUTCString()
        }
      }

      if (options?.customMetadata) {
        for (const [key, value] of Object.entries(options.customMetadata)) {
          headers[`x-amz-meta-${key}`] = value
        }
      }

      // Convert value to appropriate format
      let body: ReadableStream | ArrayBuffer | string
      if (ArrayBuffer.isView(value)) {
        body = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
      }
      else {
        body = value
      }

      const response = await signedFetch('PUT', key, { headers, body })

      if (!response.ok) {
        throw new Error(`R2 PUT failed: ${response.status}`)
      }

      return {
        key,
        version: response.headers.get('x-amz-version-id') || '',
        size: typeof value === 'string' ? value.length : 0,
        etag: response.headers.get('etag') || '',
        httpEtag: response.headers.get('etag') || '',
        checksums: {},
        uploaded: new Date(),
        httpMetadata: options?.httpMetadata || {},
        customMetadata: options?.customMetadata || {},
      }
    },

    async delete(keys: string | string[]): Promise<void> {
      const keyArray = Array.isArray(keys) ? keys : [keys]

      if (keyArray.length === 1) {
        const response = await signedFetch('DELETE', keyArray[0])
        if (!response.ok && response.status !== 404) {
          throw new Error(`R2 DELETE failed: ${response.status}`)
        }
      }
      else {
        // Multi-object delete using S3 API
        const _deleteXml = `<?xml version="1.0" encoding="UTF-8"?>
<Delete>
  ${keyArray.map(key => `<Object><Key>${key}</Key></Object>`).join('')}
</Delete>`

        const response = await signedFetchBucket('POST', {
          queryParams: { delete: '' },
          headers: { 'Content-Type': 'application/xml' },
        })

        if (!response.ok) {
          throw new Error(`R2 DELETE BULK failed: ${response.status}`)
        }
      }
    },

    async head(key: string): Promise<R2Object | null> {
      const response = await signedFetch('HEAD', key)

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`R2 HEAD failed: ${response.status}`)
      }

      const customMetadata: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('x-amz-meta-')) {
          const metaKey = key.slice('x-amz-meta-'.length)
          customMetadata[metaKey] = value
        }
      })

      return {
        key,
        version: response.headers.get('x-amz-version-id') || '',
        size: Number.parseInt(response.headers.get('content-length') || '0', 10),
        etag: response.headers.get('etag') || '',
        httpEtag: response.headers.get('etag') || '',
        checksums: {},
        uploaded: new Date(response.headers.get('last-modified') || Date.now()),
        httpMetadata: {
          contentType: response.headers.get('content-type') || undefined,
          contentLanguage: response.headers.get('content-language') || undefined,
          contentDisposition: response.headers.get('content-disposition') || undefined,
          contentEncoding: response.headers.get('content-encoding') || undefined,
          cacheControl: response.headers.get('cache-control') || undefined,
          cacheExpiry: response.headers.get('expires')
            ? new Date(response.headers.get('expires')!)
            : undefined,
        },
        customMetadata,
      }
    },

    async list(options?: R2ListOptions): Promise<R2Objects> {
      const queryParams: Record<string, string> = {
        'list-type': '2',
      }

      if (options?.limit) {
        queryParams['max-keys'] = options.limit.toString()
      }
      if (options?.prefix) {
        queryParams.prefix = options.prefix
      }
      if (options?.cursor) {
        queryParams['continuation-token'] = options.cursor
      }
      if (options?.delimiter) {
        queryParams.delimiter = options.delimiter
      }
      if (options?.startAfter) {
        queryParams['start-after'] = options.startAfter
      }

      const response = await signedFetchBucket('GET', { queryParams })

      if (!response.ok) {
        throw new Error(`R2 LIST failed: ${response.status}`)
      }

      const xml = await response.text()

      // Parse XML response (simple parsing for ListBucketResult)
      const objects: R2Object[] = []
      const delimitedPrefixes: string[] = []

      // Extract objects
      const contentsRegex = /<Contents>(.*?)<\/Contents>/gs
      let match
      while ((match = contentsRegex.exec(xml)) !== null) {
        const content = match[1]
        const key = content.match(/<Key>(.*?)<\/Key>/)?.[1] || ''
        const size = Number.parseInt(content.match(/<Size>(.*?)<\/Size>/)?.[1] || '0', 10)
        const etag = content.match(/<ETag>(.*?)<\/ETag>/)?.[1] || ''
        const lastModified = content.match(/<LastModified>(.*?)<\/LastModified>/)?.[1] || ''

        objects.push({
          key,
          version: '',
          size,
          etag,
          httpEtag: etag,
          checksums: {},
          uploaded: new Date(lastModified),
          httpMetadata: {},
          customMetadata: {},
        })
      }

      // Extract delimited prefixes
      const prefixRegex = /<CommonPrefixes>.*?<Prefix>(.*?)<\/Prefix>.*?<\/CommonPrefixes>/gs
      while ((match = prefixRegex.exec(xml)) !== null) {
        delimitedPrefixes.push(match[1])
      }

      const isTruncated = xml.includes('<IsTruncated>true</IsTruncated>')
      const nextContinuationToken = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/)?.[1]

      return {
        objects,
        truncated: isTruncated,
        cursor: nextContinuationToken,
        delimitedPrefixes,
      }
    },

    createMultipartUpload(_key: string, _options?: R2MultipartOptions): Promise<R2MultipartUpload> {
      throw new Error('R2 multipart upload not yet implemented')
    },

    resumeMultipartUpload(_key: string, _uploadId: string): R2MultipartUpload {
      throw new Error('R2 multipart upload not yet implemented')
    },
  }

  return r2Bucket
}
