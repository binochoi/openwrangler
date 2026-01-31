/* eslint-disable node/prefer-global/buffer */
import type { R2Bucket, R2Object, R2PutOptions } from '@cloudflare/workers-types/experimental'

/**
 * miniflare R2Bucket을 래핑하여 Buffer 호환성 문제 해결
 * remote: false 환경에서 사용
 */
export function wrapR2BucketForDev(r2: R2Bucket): R2Bucket {
  return {
    ...r2,
    async put(
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
      options?: R2PutOptions,
    ): Promise<R2Object> {
      // Buffer를 Uint8Array로 변환
      // miniflare가 Buffer를 제대로 처리하지 못하므로 변환 필요
      let processedValue: any = value

      if (value && Buffer.isBuffer(value)) {
        processedValue = new Uint8Array(value as any)
      }

      return r2.put(key, processedValue, options)
    },
  } as R2Bucket
}
