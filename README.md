# openwrangler

A Cloudflare bindings implementation library that solves miniflare's bugs and limitations

## Background

Cloudflare Workers development environment uses miniflare internally via `wrangler dev` to simulate bindings like R2, KV, and D1 locally. However, miniflare has critical issues:

### miniflare's Problems

1. **R2 Buffer Processing Bug**: Fails to properly handle Node.js Buffer when uploading to R2
2. **remote Option Errors**: The `remote = true` option in `wrangler.toml` throws errors, making it completely unusable

### openwrangler's Solution

openwrangler bypasses miniflare and **directly calls Cloudflare REST APIs** to solve these problems:

- **R2**: Direct access to actual Cloudflare R2 buckets via S3-compatible API
- **KV**: Use real KV namespaces via Cloudflare KV REST API
- **D1**: Query real D1 databases via Cloudflare D1 REST API

You can use actual production resources in your development environment, enabling development and testing in an environment identical to production.

## Installation

```bash
npm install openwrangler
# or
pnpm add openwrangler
```

## Usage

### 1. Direct Usage (Node.js)

```typescript
import { createR2Binding, createKVBinding, createD1Binding } from 'openwrangler'

// R2
const r2 = createR2Binding({
  accountId: 'your-account-id',
  r2AccessKeyId: 'your-r2-access-key',
  r2SecretAccessKey: 'your-r2-secret-key',
}, 'bucket-name')

await r2.put('image.png', buffer)  // ✅ Buffer works correctly
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

### 2. Nitro/Nuxt Integration (`@bino0216/nitro-cloudflare-dev`)

For Nitro and Nuxt, use the integration module for easier setup.

#### Installation

```bash
npm install @bino0216/nitro-cloudflare-dev
```

#### Nuxt Configuration

```typescript
// nuxt.config.ts
import nitroCloudflareDev from '@bino0216/nitro-cloudflare-dev'

export default defineNuxtConfig({
  nitro: {
    modules: [nitroCloudflareDev],
    cloudflareDev: {
      remote: true,  // Use actual Cloudflare resources
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

#### wrangler.toml Configuration

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

#### Usage

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

### 3. Buffer Compatibility Wrapper (When Using miniflare)

If you want to use miniflare with `remote: false` while only fixing the R2 Buffer issue:

```typescript
import { wrapR2BucketForDev } from 'openwrangler'

// Wrap the R2 binding from miniflare
const r2 = wrapR2BucketForDev(miniflareR2Bucket)

// Buffer now works correctly
await r2.put('file.bin', Buffer.from([1, 2, 3]))
```

`@bino0216/nitro-cloudflare-dev` automatically applies this wrapper to all R2 bindings when `remote: false`.

## Supported Bindings

| Binding | Type | REST API | Support |
|---------|------|----------|---------|
| R2 | `R2Bucket` | S3-compatible API | ✅ |
| KV | `KVNamespace` | Cloudflare KV API | ✅ |
| D1 | `D1Database` | Cloudflare D1 API | ✅ |

All types are imported from `@cloudflare/workers-types` to ensure 100% compatibility with actual Cloudflare Workers.

## Use Cases

### Development with Real Data
Access actual production resources during local development for development and debugging

### Bypass miniflare Bugs
Work around known miniflare bugs such as R2 Buffer processing

### Integration Testing
Run integration tests against actual Cloudflare services

### CI/CD
Test with real Cloudflare resources in GitHub Actions and other CI/CD pipelines

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run playground (Nuxt + Nitro test environment)
pnpm dev
```

## Project Structure

```
openwrangler/
├── src/
│   ├── index.ts              # Main export
│   ├── bindings/
│   │   ├── r2.ts            # R2 binding implementation (S3 API)
│   │   ├── r2.dev.ts        # R2 Buffer wrapper
│   │   ├── kv.ts            # KV binding implementation
│   │   └── d1.ts            # D1 binding implementation
│   └── utils/
│       ├── http-client.ts   # Cloudflare API client
│       └── s3-signer.ts     # AWS S3 signing utility
├── packages/
│   └── nitro-cloudflare-dev/ # Nitro/Nuxt integration module
└── playground/               # Nuxt test environment
```

## License

MIT

## Related Issues

- [miniflare R2 Buffer issue](https://github.com/cloudflare/workers-sdk/issues)
- [wrangler remote binding errors](https://github.com/cloudflare/workers-sdk/issues)
