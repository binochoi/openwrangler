# openwrangler

wrangler의 `getPlatformProxy` 바인딩을 Cloudflare REST API로 구현하는 패키지

## 목적

Cloudflare Workers에서 `env.r2.put()` 같은 바인딩을 사용하듯이,
Node.js 환경에서 `getBindings().r2.put()`으로 동일한 인터페이스를 사용할 수 있게 함.

차이점:
- wrangler의 `getPlatformProxy`: 로컬 miniflare/workerd 시뮬레이션 사용
- openwrangler의 `getBindings`: Cloudflare REST API 직접 호출

## API

```typescript
import { getBindings } from 'openwrangler'

const bindings = getBindings({
  accountId: 'your-account-id',
  apiToken: 'your-api-token',
})

await bindings.r2.put('image.png', buffer)
await bindings.kv.get('key')
await bindings.d1.exec('SELECT * FROM users')
```

## 지원 바인딩

- R2 (Object Storage)
- KV (Key-Value Storage)
- D1 (Database)

## 개발

```bash
pnpm install
pnpm dev      # playground 실행
pnpm build    # 패키지 빌드
```

## 프로젝트 구조

- `src/index.ts` - 패키지 엔트리포인트, getBindings() 함수
- `playground/` - Nuxt/Nitro v3 기반 테스트 환경
- `build.config.ts` - unbuild 설정
