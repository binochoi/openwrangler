# openwrangler

miniflare의 버그와 한계를 해결하는 Cloudflare 바인딩 구현 라이브러리

## 배경

Cloudflare Workers 개발 환경에서 `wrangler dev`는 내부적으로 miniflare를 사용하여 R2, KV, D1 등의 바인딩을 로컬에서 시뮬레이션합니다. 하지만 miniflare는 다음과 같은 문제점이 있습니다:

### miniflare의 문제점

1. **R2 Buffer 처리 버그**: Node.js Buffer를 R2에 업로드할 때 제대로 처리하지 못하는 버그
2. **remote 옵션 미작동**: `wrangler.toml`의 `remote = true` 옵션이 실제로 작동하지 않음
3. **프로덕션 환경과의 차이**: 로컬 시뮬레이션 환경이라 실제 프로덕션과 동작이 다를 수 있음

### openwrangler의 해결책

openwrangler는 miniflare를 우회하고 **Cloudflare REST API를 직접 호출**하여 이러한 문제들을 해결합니다:

- **R2**: S3 호환 API를 통해 실제 Cloudflare R2 버킷에 직접 접근
- **KV**: Cloudflare KV REST API로 실제 KV 네임스페이스 사용
- **D1**: Cloudflare D1 REST API로 실제 D1 데이터베이스 쿼리

개발 환경에서도 실제 프로덕션 리소스를 사용할 수 있어, 프로덕션과 동일한 환경에서 개발 및 테스트가 가능합니다.

## 설치

```bash
npm install openwrangler
# or
pnpm add openwrangler
```

## 사용법

### 1. 직접 사용 (Node.js)

```typescript
import { createR2Binding, createKVBinding, createD1Binding } from 'openwrangler'

// R2
const r2 = createR2Binding({
  accountId: 'your-account-id',
  r2AccessKeyId: 'your-r2-access-key',
  r2SecretAccessKey: 'your-r2-secret-key',
}, 'bucket-name')

await r2.put('image.png', buffer)  // ✅ Buffer 정상 작동
const file = await r2.get('image.png')

// KV
const kv = createKVBinding({
  accountId: 'your-account-id',
  apiToken: 'your-api-token',
}, 'namespace-id')

await kv.put('key', 'value')
const value = await kv.get('key')

// D1
const d1 = createD1Binding({
  accountId: 'your-account-id',
  apiToken: 'your-api-token',
}, 'database-id')

const result = await d1.prepare('SELECT * FROM users').all()
```

### 2. Nitro/Nuxt 통합 (`@bino0216/nitro-cloudflare-dev`)

Nitro와 Nuxt에서는 통합 모듈을 사용하여 더 쉽게 설정할 수 있습니다.

#### 설치

```bash
npm install @bino0216/nitro-cloudflare-dev
```

#### Nuxt 설정

```typescript
// nuxt.config.ts
import nitroCloudflareDev from '@bino0216/nitro-cloudflare-dev'

export default defineNuxtConfig({
  nitro: {
    modules: [nitroCloudflareDev],
    cloudflareDev: {
      remote: true,  // 실제 Cloudflare 리소스 사용
      remoteCredentials: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN,
        r2: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY,
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY,
        },
      },
    },
  },
})
```

#### wrangler.toml 설정

```toml
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket"

[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-id"

[[d1_databases]]
binding = "MY_DB"
database_name = "my-database"
database_id = "your-db-id"
```

#### 사용

```typescript
// server/api/example.ts
export default defineEventHandler(async (event) => {
  const { MY_BUCKET, MY_KV, MY_DB } = event.context.cloudflare.env

  // R2
  await MY_BUCKET.put('file.txt', 'Hello World')

  // KV
  await MY_KV.put('key', 'value')

  // D1
  const users = await MY_DB.prepare('SELECT * FROM users').all()

  return { users }
})
```

### 3. Buffer 호환성 Wrapper (miniflare 사용 시)

`remote: false`로 miniflare를 사용하면서 R2 Buffer 문제만 해결하고 싶다면:

```typescript
import { wrapR2BucketForDev } from 'openwrangler'

// miniflare에서 받은 R2 바인딩을 감싸기
const r2 = wrapR2BucketForDev(miniflareR2Bucket)

// 이제 Buffer가 정상 작동
await r2.put('file.bin', Buffer.from([1, 2, 3]))
```

`@bino0216/nitro-cloudflare-dev`는 `remote: false`일 때 자동으로 모든 R2 바인딩에 이 wrapper를 적용합니다.

## 지원 바인딩

| 바인딩 | 타입 | REST API | 지원 |
|--------|------|----------|------|
| R2 | `R2Bucket` | S3 호환 API | ✅ |
| KV | `KVNamespace` | Cloudflare KV API | ✅ |
| D1 | `D1Database` | Cloudflare D1 API | ✅ |

모든 타입은 `@cloudflare/workers-types`에서 import하여 실제 Cloudflare Workers와 100% 호환됩니다.

## 사용 사례

### 개발 환경에서 실제 데이터 사용
로컬 개발 중에도 실제 프로덕션 리소스에 접근하여 개발 및 디버깅

### miniflare 버그 우회
R2 Buffer 처리 등 miniflare의 알려진 버그를 우회

### 통합 테스트
실제 Cloudflare 서비스를 대상으로 통합 테스트 실행

### CI/CD
GitHub Actions 등에서 실제 Cloudflare 리소스를 사용한 테스트

## 개발

```bash
# 의존성 설치
pnpm install

# 빌드
pnpm build

# playground 실행 (Nuxt + Nitro 테스트 환경)
pnpm dev
```

## 프로젝트 구조

```
openwrangler/
├── src/
│   ├── index.ts              # 메인 export
│   ├── bindings/
│   │   ├── r2.ts            # R2 바인딩 구현 (S3 API)
│   │   ├── r2.dev.ts        # R2 Buffer wrapper
│   │   ├── kv.ts            # KV 바인딩 구현
│   │   └── d1.ts            # D1 바인딩 구현
│   └── utils/
│       ├── http-client.ts   # Cloudflare API 클라이언트
│       └── s3-signer.ts     # AWS S3 서명 유틸
├── packages/
│   └── nitro-cloudflare-dev/ # Nitro/Nuxt 통합 모듈
└── playground/               # Nuxt 테스트 환경
```

## 라이선스

MIT

## 관련 이슈

- [miniflare R2 Buffer issue](https://github.com/cloudflare/workers-sdk/issues)
- [wrangler remote binding not working](https://github.com/cloudflare/workers-sdk/issues)
