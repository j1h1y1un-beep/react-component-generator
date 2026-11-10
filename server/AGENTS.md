# server/AGENTS.md

## Module Context

Bun 기반 AI API 프록시. `index.ts`가 엔드포인트와 제공자 호출을 담당하고, `generator.ts`와 `fallback.ts`는 부수효과 없는 순수 함수다.

## Tech Stack & Constraints

- 런타임은 Bun이다. 서버 코드에서 `Bun.serve`, `process.env`를 사용한다. 외부 HTTP 클라이언트 라이브러리를 추가하지 않고 `fetch`를 쓴다 (`index.ts:69`, `index.ts:101`).
- 테스트는 vitest로 실행한다 (`server/**/*.test.ts`, `vite.config.ts`).
- 새 로직은 `index.ts`가 아니라 순수 모듈로 분리해 테스트를 붙인다.

## Implementation Patterns

- 모든 응답에 `CORS_HEADERS`를 붙인다 (`index.ts:51`, 각 `Response.json` 호출).
- 에러는 `index.ts:194-211`에서 메시지 문자열(`503`, `429` 포함 여부)로 상태코드를 매핑한다. 제공자 함수가 던지는 에러 메시지에 상태코드를 포함해야 이 매핑이 동작한다 (`index.ts:85`, `index.ts:112`).
- 새 Google 모델은 `GOOGLE_MODELS` 배열에 우선순위 순으로 추가한다 (`index.ts:5`).

## Local Golden Rules

- 비대칭: Google 경로에는 모델 폴백(`index.ts:135`)과 `MAX_TOKENS` 잘림 검사(`index.ts:123`)가 있고, Anthropic 경로(`callAnthropic`)에는 둘 다 없다. 이는 현재 상태이며, 한쪽 경로를 고칠 때 다른 경로에 같은 문제가 있는지 확인한다.
- 이중 방어: `render()` 호출 누락은 시스템 프롬프트 규칙(`index.ts:12`)과 `ensureRenderCall`(`generator.ts:238`) 두 곳에서 막는다. 프롬프트 규칙이 지켜져도 `ensureRenderCall`을 제거하지 않는다. 마크다운 펜스도 프롬프트(`index.ts:16`)와 `stripCodeFences`(`generator.ts:227`)가 이중으로 막는다.
- 보안 경계: Gemini 호출은 API 키를 URL 쿼리에 넣는다 (`index.ts:99`). 이 URL이나 요청을 로그·에러 메시지에 출력하지 않는다. 에러에는 상태코드만 담는다 (`index.ts:112`).
- 보안 경계: `/api/config`는 키 존재 여부만 반환한다 (`index.ts:147-157`). 키 값을 응답에 추가하지 않는다.
- 키 우선순위: 클라이언트가 보낸 키가 `.env` 키보다 우선한다 (`index.ts:65`).
- 폴백(`fallback.ts`)은 모든 에러에서 다음 모델로 넘어간다. 429/503 외 인증 오류도 재시도되므로, 에러 종류별 분기를 추가하려면 `fallback.test.ts`를 함께 수정한다.

## Testing Strategy

- 실행: `bun run test` (전체) 또는 `bunx vitest run server`.
- `generator.test.ts`, `fallback.test.ts`가 기준 패턴이다. 순수 함수를 직접 호출해 검증하고, 네트워크는 호출하지 않는다.
- `index.ts`는 `Bun.serve`를 즉시 실행하므로 테스트에서 import하지 않는다.
