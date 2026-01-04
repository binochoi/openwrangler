# openwrangler

A library that implements wrangler's remote functionality, allowing you to use Cloudflare bindings via direct REST API calls instead of local simulation.

## Overview

`openwrangler` provides the same binding interface as wrangler's `getPlatformProxy`, but instead of using local miniflare/workerd simulation, it directly calls the Cloudflare REST API. This enables you to work with remote Cloudflare resources during development.

## Installation

```bash
npm install openwrangler
# or
pnpm add openwrangler
```

## Direct Usage

You can use openwrangler directly in your Node.js applications:

```typescript
import { getBindings } from 'openwrangler'

const bindings = getBindings({
  accountId: 'your-account-id',
  apiToken: 'your-api-token',
})

// Use bindings just like in Cloudflare Workers
await bindings.r2.put('image.png', buffer)
await bindings.kv.get('key')
await bindings.d1.exec('SELECT * FROM users')
```

## Nitro Integration

`openwrangler` can be seamlessly integrated with Nitro applications using `@bino0216/nitro-cloudflare-dev`.

### Setup

1. Install the Nitro integration package:

```bash
npm install npm:@bino0216/nitro-cloudflare-dev
```

2. Configure remote credentials in your Nitro config:

```typescript
// nitro.config.ts
export default defineNitroConfig({
  cloudflareDev: {
    remoteCredentials: {
      accountId: 'your-account-id',
      apiToken: 'your-api-token',
    }
  }
})
```

3. Mark bindings as remote in your `wrangler.toml` or `wrangler.json`:

```toml
# wrangler.toml
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket"
remote = true

[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-id"
remote = true

[[d1_databases]]
binding = "MY_DB"
database_name = "my-database"
database_id = "your-db-id"
remote = true
```

Or in JSON format:

```json
{
  "r2_buckets": [
    {
      "binding": "MY_BUCKET",
      "bucket_name": "my-bucket",
      "remote": true
    }
  ],
  "kv_namespaces": [
    {
      "binding": "MY_KV",
      "id": "your-kv-id",
      "remote": true
    }
  ],
  "d1_databases": [
    {
      "binding": "MY_DB",
      "database_name": "my-database",
      "database_id": "your-db-id",
      "remote": true
    }
  ]
}
```

When bindings have `remote = true`, Nitro will use openwrangler's implementation to connect to your actual Cloudflare resources instead of local simulation.

## Supported Bindings

- **R2** (`R2Bucket`) - Object storage
- **KV** (`KVNamespace`) - Key-value storage
- **D1** (`D1Database`) - SQL database

All types are imported from `@cloudflare/workers-types` to ensure compatibility with Cloudflare Workers.

## Development

```bash
pnpm install
pnpm dev      # Run playground
pnpm build    # Build package
```

## Project Structure

- `src/index.ts` - Package entry point, `getBindings()` function
- `playground/` - Nuxt/Nitro v3 based test environment
- `build.config.ts` - unbuild configuration

## Use Cases

- **Development against production data**: Work with real Cloudflare resources during development
- **Testing**: Test against actual Cloudflare services without deployment
- **CI/CD**: Run integration tests against remote Cloudflare resources
- **Hybrid environments**: Mix local and remote bindings based on your needs

## License

MIT
