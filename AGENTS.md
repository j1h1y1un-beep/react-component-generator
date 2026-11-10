# AGENTS.md

## Operational Commands

- 패키지 매니저는 `bun`으로 고정한다. npm, yarn, pnpm을 쓰지 않는다 (`bun.lock`).
- 개발 서버(API + Vite): `bun run dev`
- API 서버만: `bun run server` (포트 3002)
- 테스트: `bun run test` (vitest 실행). `bun test`는 Bun 내장 러너를 호출하므로 쓰지 않는다 (`package.json` scripts.test, `vite.config.ts` test 설정).
- 린트: `bun run lint`
- 빌드(타입체크 포함): `bun run build`
- 변경 후 `bun run test`, `bun run lint`, `bun run build`가 통과해야 완료로 본다.

## Golden Rules

### Immutable

- API 키는 클라이언트에 영속화하지 않는다. 입력값은 `App.tsx:14`의 React state에만 두고, localStorage/sessionStorage/쿠키에 저장하지 않는다.
- 서버 환경변수 키 값은 클라이언트로 내려보내지 않는다. 클라이언트에는 존재 여부(boolean)만 노출한다 (`server/index.ts:151-152`).
- `.env`는 커밋하지 않는다 (`.gitignore`).

### Do's & Don'ts

- Do: 미리보기는 react-live `noInline` 모드를 유지한다 (`src/components/LivePreview.tsx:14`). 이 모드는 코드 끝에 `render(<X />)` 호출이 있어야 렌더된다. 생성 코드 형식(import 금지, `render()` 호출)과 서버의 정규화 로직은 이 제약에서 나온다. 한쪽을 바꾸면 다른 쪽도 함께 확인한다.
- Do: 생성 코드는 순수 JavaScript여야 한다. react-live는 TypeScript 구문을 변환하지 않는다 (`server/index.ts:20`).
- Don't: 프론트엔드에서 AI 제공자 API를 직접 호출하지 않는다. 모든 호출은 `/api/*` 프록시 서버를 거친다 (`vite.config.ts` proxy).
- Don't: 서버 순수 로직(`server/generator.ts`, `server/fallback.ts`)에 `Bun.serve` 등 부수효과를 넣지 않는다. 테스트 가능성이 깨진다 (`server/generator.ts:1-2` 주석).
- 테스트 경계: 테스트는 `server/generator`, `server/fallback`, `PromptInput`에만 있다. `server/index.ts`(제공자 호출, 에러 매핑), `App.tsx`, `useComponentGenerator.ts`, `ComponentCard.tsx`에는 없다. 이 영역을 수정하면 테스트를 추가하거나 수동 확인 결과를 보고한다.

## Project Context

- 프롬프트로 React 컴포넌트를 생성하고 실시간 미리보기를 제공하는 도구.
- Stack: React 19, TypeScript, Vite, react-live, Bun(API 서버), vitest, Testing Library.
- 서버 전용 규칙은 `server/AGENTS.md`를 따른다.

## Standards & References

- 코드 스타일은 `eslint.config.js`를 따른다.
- 커밋 메시지: `<type>: <한국어 요약>` (type: feat, fix, refactor, chore, docs, test, style). 요약은 50자 안팎, 마침표 없음.
- push는 사용자가 요청할 때만 한다.
- Maintenance Policy: 이 문서의 규칙과 코드가 어긋나면 작업을 멈추고 업데이트를 제안한다.
