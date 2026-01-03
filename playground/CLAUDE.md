# 프로젝트 규칙

## 기술 스택
- **Common**: valibot
- **Frontend**: Nuxt 3, pinia, pinia colada, tailwind
- **Database**: Postgres + Drizzle ORM
- **Auth**: Better Auth

## component 폴더 구조
### components/ui
앱 전반적으로 사용되는 재활용 가능한 ui 컴포넌트
### components/features
컴포넌트를 각 도메인 단위로 세분화하여 분류

## composables 폴더 사용 안함
대신 hooks 폴더를 사용한다.

# 환경 변수
환경변수는 항상 useRuntimeConfig를 사용한다.
어떤 env var가 존재하는지는 config/index.ts 파일을 참고해. 둘이 서로 타입이 같다.
```ts
const config = useRuntimeConfig()
/**
 * public은 nuxt app에서도 접근 가능
 */
const { public } = useRuntimeConfig()
```
server에서 환경 변수에 접근할 때는 config 자체를 import하면 되고,
frontend에서는 useRuntimeConfig 함수를 사용하며 config의 public property 안에 선언된 환경변수여야 해.
# api fetch 요청 가이드
## 프론트엔드
내부 api에 대한 접근은 항상 $api와 useQuery, useMutation을 활용한다.
$api는 $fetch의 extends 버전이며, $fetch와 동일하다고 보면 된다.

### $api 주의사항
 $api를 사용할때는 항상 변수로 받은 다음 사용해야 한다.
```ts
/** X */
function query() {
  return $api('/api/articles')
}
/** O */
function query() {
  const res = await $api('/api/articles')
  return res
}
```

### pinia colada
```ts
// src/queries/article.query.ts
import { $api } from '@/hooks/api';
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
/**
 * use*Query, use*Mutation 함수는 parameter가 항상 Ref이어야 한다.
 * 
 * ```ts
 * const { state: articleState } = useArticleOneQuery(articleId);
 * ```
 */
export const useArticleOneQuery = (articleId: Ref<string>) => useQuery(() => ({
    key: ['article', articleId.value],
    query() {
      const res = await $api('/api/articles')
      return res
    },
    enabled: true,
}));
/**
 * 자꾸 isPending을 쓰는데, isLoading이 옳다.
 * ```ts
 * const { mutateAsync, isLoading } = useArticleMutation();
 * ```
 */
export const useArticleMutation = (articleId: Ref<string>) => {
    return useMutation({
        key: ['article', articleId.value],
        async mutation(body: IArticlePatchBodyDto) {
          await $api('/api/articles', {
            method: 'patch',
            body,
          });
          await useQueryCache().invalidateQueries({ key: ['article'] });
        }
    })
}
// useArticleListQuery
// useArticleDeleteMutation
// ...
```
## 서버
database schema를 기반으로 entity를 만들고, entity 기반으로 dto를 생성한다.
### schema
```ts
// src/server/database/schema/article.schema.ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const article = pgTable('article', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

```
### entity
```ts
// src/server/entities/article.entity.ts
import { createInsertSchema } from 'drizzle-valibot'
import { category } from 'server/constants/category.constant'
import { article, articleContent } from 'server/database/schema'
import * as v from 'valibot'
export const ArticleEntity = v.object({
  ...createInsertSchema(article).entries,
  ...createInsertSchema(articleContent).entries,
  categorySlug: v.optional(v.picklist(Object.keys(category) as [keyof typeof category])),
})
export type IArticleEntity = v.InferInput<typeof ArticleEntity>
```
### dto
```ts
// src/server/dtos/article.dto.ts
export const ArticleFindManyDto = v.object({
  page: stringToNumberPipe(),
  categorySlug: ArticleEntity.entries.categorySlug,
})
export type IArticleFindManyDto = v.InferOutput<typeof ArticleFindManyDto>
export const ArticleInertDto = v.intersect([
    v.pick(
      ArticleEntity,
      ['title', 'contentHTML', 'categorySlug', 'thumbnailUrl']
    ),
    v.object({
      mediaFileURLs: v.optional(v.array(v.string())),
    })
])
export type IArticleInsertDto = v.InferOutput<typeof ArticleInsertDto>
```
### api (route)
```ts
// src/server/api/articles.post.ts

import * as v from 'valibot'
import { defineHandlerSchema } from '@/server/framework'
import { ArticleInsertDto } from '@/server/dtos/article.dto'

export default defineEventHandler({
  onRequest: [],
  async handler(e) {
    const body = await readSuperBody(e, (i) => v.parse(ArticleInsertDto, i));
  }
})
```
## params, query, body
클라이언트한테 payload를 전달받을 때는
- getValidatedRouterParams
- getValidatedQuery
- readSuperBody
세 가지만을 사용한다.
```ts
export default defineEventHandler({
  onRequest: [],
  async handler(e) {
    const params = await getValidatedRouterParams(e, (i) => v.parse(ArticleInsertDto, i));
    const query = await getValidatedQuery(e, (i) => v.parse(ArticleInsertDto, i));
    const body = await readSuperBody(e, (i) => v.parse(ArticleInsertDto, i));
  }
})
```

# 코드 작성 규칙
## 항상 tailwind 사용
@apply도 절대 사용하지 않는다.
꼭 필요한 상황에만 인라인 scss를 사용한다.
## 템플릿에서도 항상 camel case 사용
```vue
<template>
    <!-- X -->
    <Acomponent :article-id />
    <!-- O -->
    <Acomponent :articleId />
</template>
```
## Import
- 항상 모든 module을 명시적으로 import해. auto import가 그냥 없다고 생각해.
- 항상 @로 시작하는 절대 경로를 사용해. 상대 경로 말고.
- 동적 import 금지 (`await import(...)` 사용 불가)
- 모든 import는 파일 상단에 정적으로 작성

## useRouteQuery, useRouteParams
route.query 대신 @vueuse/router의 useRouteQuery를 사용해.
route.params 대신 @vueuse/router의 useRouteQuery를 사용해.
```ts
useRouteQuery<string>('q');
useRouteParams<string>('id');
```

## queries 폴더의 useQuery 기반 query 함수들 사용법
```vue
<script setup lang="ts">
// state를 항상 우선적으로 사용한다
const { state } = useArticleListQuery();
</script>
<template>
    <!-- if문으로 type narrow한다. -->
    <div v-if="state.status === 'error'">{{ state.error }}</div>
    <div v-else-if="state.status === 'pending'"></div>
    <div v-else>
        <ArticleList :list="state.data" />
    </div>
</template>
```

## 순수 함수는 항상 utils 폴더에 저장
vue파일의 script 태그 안에 쓰는 경우가 많은데, 이런 함수들은 utils에 따로 위치시키고 import해.

## alias
모든 import는 절대경로로 가져와야 함.
모든 alias는 @만 사용한다.
```ts
import * from '@/...'
```

## 폴더 구조
- DB 스키마: `server/src/database/schema/`
- API 엔드포인트: `server/src/api/`

## Database
- Drizzle ORM 사용
- 스키마 변경 시 migration 생성 필수
- Turso 연결 설정은 환경변수 사용

## Auth
- Better Auth 사용
- 인증 로직은 Better Auth 내장 기능 우선 활용

## readValidatedBody 금지
항상 readSuperBody로 대체한다.

## 작업 완료 후 타입체크
작업이 끝날 때마다 `npm run check`를 실행해서 타입체크를 수행한다.
문제가 있으면 단 한 번만 오류를 수정한다. 한 번 수정 후에도 오류가 남아있으면 사용자에게 알린다.


# framework
src/server/framework에 위치한
앱에 내장된 자체 프레임워크 라이브러리.

## readSuperBody
readValidatedBody 대체.

## injectAuth
로그인 상태일 경우 context에 유저 세션 데이터를 주입한다.
```ts
import * as v from 'valibot'
import { injectAuth } from '@/server/framework'
export default defineEventHandler({
  onRequest: [injectAuth],
  async handler(e) {
  }
})
```
## assertUser
context에서 유저 데이터를 가져온다. 유저 데이터가 없을 경우 401 반환.
```ts
import { injectAuth, assertUser } from '@/server/framework'
export default defineEventHandler({
  onRequest: [injectAuth],
  async handler(e) {
    const user = assertUser(e);
  }
})
```
## assertSession
context에서 유저의 현재 세션 데이터를 가져온다. 세션 데이터가 없을 경우 401 반환.
## getUser
context에서 유저 데이터를 가져온다. 유저가 있어도 되고 없어도 될 경우 사용.
```ts
import { injectAuth, getUser } from '@/server/framework'
export default defineEventHandler({
  onRequest: [injectAuth],
  async handler(e) {
    const user = getUser(e);
  }
})
```
## getSession
context에서 유저의 현재 세션 데이터를 가져온다. 세션 데이터가 있어도 되고 없어도 될 경우 사용.
