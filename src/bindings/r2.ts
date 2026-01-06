import type {
  R2Bucket,
  R2Conditional,
  R2GetOptions,
  R2HTTPMetadata,
  R2ListOptions,
  R2MultipartOptions,
  R2MultipartUpload,
  R2Object,
  R2ObjectBody,
  R2Objects,
  R2PutOptions,
  R2Range,
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

  const r2Bucket = {
    async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null> {
      const headers: Record<string, string> = {}

      if (options?.range) {
        if (typeof options.range === 'object') {
          const range = options.range as R2Range
          if ('suffix' in range && range.suffix) {
            headers.Range = `bytes=-${range.suffix}`
          }
          else if ('offset' in range && range.offset !== undefined) {
            headers.Range = 'length' in range && range.length
              ? `bytes=${range.offset}-${range.offset + range.length - 1}`
              : `bytes=${range.offset}-`
          }
        }
      }

      if (options?.onlyIf) {
        const onlyIf = options.onlyIf as R2Conditional
        if (onlyIf.etagMatches) {
          headers['If-Match'] = onlyIf.etagMatches
        }
        if (onlyIf.etagDoesNotMatch) {
          headers['If-None-Match'] = onlyIf.etagDoesNotMatch
        }
        if (onlyIf.uploadedBefore) {
          headers['If-Unmodified-Since'] = onlyIf.uploadedBefore.toUTCString()
        }
        if (onlyIf.uploadedAfter) {
          headers['If-Modified-Since'] = onlyIf.uploadedAfter.toUTCString()
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
        checksums: {
          toJSON: () => ({}),
        },
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
        storageClass: 'Standard',
        range: options?.range
          ? {
              offset: 0,
              length: Number.parseInt(response.headers.get('content-length') || '0', 10),
            }
          : undefined,
        body: response.body! as any,
        bodyUsed: false,
        arrayBuffer: () => response.arrayBuffer(),
        text: () => response.text(),
        json: () => response.json(),
        blob: () => response.blob() as any,
        bytes: async () => new Uint8Array(await response.arrayBuffer()),
        writeHttpMetadata: ((headers: any) => {
          const metadata = r2Object.httpMetadata as R2HTTPMetadata
          if (metadata.contentType) {
            headers.set('content-type', metadata.contentType)
          }
          if (metadata.contentLanguage) {
            headers.set('content-language', metadata.contentLanguage)
          }
          if (metadata.contentDisposition) {
            headers.set('content-disposition', metadata.contentDisposition)
          }
          if (metadata.contentEncoding) {
            headers.set('content-encoding', metadata.contentEncoding)
          }
          if (metadata.cacheControl) {
            headers.set('cache-control', metadata.cacheControl)
          }
          if (metadata.cacheExpiry) {
            headers.set('expires', metadata.cacheExpiry.toUTCString())
          }
        }) as any,
      }

      return r2Object
    },

    async put(
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
      options?: R2PutOptions,
    ): Promise<R2Object> {
      const headers: Record<string, string> = {}

      if (options?.httpMetadata) {
        const metadata = options.httpMetadata as R2HTTPMetadata
        if (metadata.contentType) {
          headers['Content-Type'] = metadata.contentType
        }
        if (metadata.contentLanguage) {
          headers['Content-Language'] = metadata.contentLanguage
        }
        if (metadata.contentDisposition) {
          headers['Content-Disposition'] = metadata.contentDisposition
        }
        if (metadata.contentEncoding) {
          headers['Content-Encoding'] = metadata.contentEncoding
        }
        if (metadata.cacheControl) {
          headers['Cache-Control'] = metadata.cacheControl
        }
        if (metadata.cacheExpiry) {
          headers.Expires = metadata.cacheExpiry.toUTCString()
        }
      }

      if (options?.customMetadata) {
        for (const [key, value] of Object.entries(options.customMetadata)) {
          headers[`x-amz-meta-${key}`] = value
        }
      }

      // Convert value to appropriate format
      let body: ReadableStream | ArrayBuffer | string
      if (value === null) {
        body = ''
      }
      else if (value instanceof Blob) {
        body = await value.arrayBuffer()
      }
      else if (ArrayBuffer.isView(value)) {
        body = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
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
        checksums: {
          toJSON: () => ({}),
        },
        uploaded: new Date(),
        httpMetadata: (options?.httpMetadata || {}) as R2HTTPMetadata,
        customMetadata: options?.customMetadata || {},
        storageClass: 'Standard',
        writeHttpMetadata: () => {},
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
        checksums: {
          toJSON: () => ({}),
        },
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
        storageClass: 'Standard',
        writeHttpMetadata: () => {},
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
          checksums: {
            toJSON: () => ({}),
          },
          uploaded: new Date(lastModified),
          httpMetadata: {},
          customMetadata: {},
          storageClass: 'Standard',
          writeHttpMetadata: () => {},
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
        cursor: nextContinuationToken as any,
        delimitedPrefixes,
      }
    },

    createMultipartUpload(_key: string, _options?: R2MultipartOptions): Promise<R2MultipartUpload> {
      throw new Error('R2 multipart upload not yet implemented')
    },

    resumeMultipartUpload(_key: string, _uploadId: string): R2MultipartUpload {
      throw new Error('R2 multipart upload not yet implemented')
    },
  } as R2Bucket

  return r2Bucket
}
