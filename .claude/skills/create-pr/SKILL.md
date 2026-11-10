---
name: create-pr
description: 현재 브랜치의 변경사항을 분석해 프로젝트 성격에 맞는 언어(한국어/영문) 템플릿으로 PR 본문을 작성하고 GitHub PR을 생성한다. 한국 프로젝트는 한국어, 해외 오픈소스 프로젝트는 영문 템플릿을 쓴다. "PR 만들어줘", "PR 생성", "풀리퀘스트 올려줘", "create pr", "open a pull request", "/create-pr" 같은 요청에 활성화한다.
argument-hint: "[kr|en] [--draft] [--base <브랜치>]"
context: fork
allowed-tools: Bash(git:*), Bash(gh:*), Read, Glob, Grep
---

# Create PR

현재 브랜치를 기준으로 PR 제목·본문을 작성하고 `gh pr create`로 생성한다. 이 스킬은 fork 컨텍스트(서브 에이전트)에서 실행되므로 메인 대화 맥락에 의존하지 말고 git 이력과 diff만으로 내용을 파악한다.

## 인자

- `kr` 또는 `en`: PR 언어를 직접 지정한다. 있으면 자동 판별보다 우선한다.
- `--draft`: 드래프트 PR로 생성한다.
- `--base <브랜치>`: 대상 브랜치. 없으면 저장소 기본 브랜치를 사용한다.

## 템플릿 (references/)

| 언어 | 템플릿 파일 | 사용 대상 |
|------|-------------|-----------|
| kr | `references/kr.md` | 한국 프로젝트 |
| en | `references/en.md` | 해외 오픈소스 등 영문 프로젝트 |

선택한 언어의 템플릿만 읽는다. 다른 언어 템플릿과 섞지 않는다.

## 언어 판별

PR을 읽을 사람이 쓰는 언어를 따라야 리뷰가 자연스럽다. 인자가 없으면 아래 신호를 위에서부터 확인해 정한다.

1. 인자로 `kr`/`en`이 주어졌는가.
2. 저장소에 자체 PR 템플릿(`.github/PULL_REQUEST_TEMPLATE*`)이 있는가. 있으면 그 언어를 따른다.
3. 프로젝트 문서(`AGENTS.md`, `CLAUDE.md`, `README.md`)의 주 언어와 커밋 컨벤션이 한국어인가.
4. 최근 커밋 메시지(`git log -10 --format=%s`)에 한글이 주로 쓰였는가.
5. 원격 저장소가 외부 조직 소유의 공개 저장소이고(`gh repo view --json owner,isFork,parent`) 위 신호가 영문인가.

한글 신호가 우세하면 `kr`, 영문 신호가 우세하면 `en`이다. 신호가 엇갈리거나 없으면 최근 커밋 메시지 언어를 따르고, 그것도 불명확하면 `en`으로 한다. 어떤 신호로 골랐는지 최종 보고에 한 줄로 남긴다.

## 절차

### 1. 사전 확인
- `git rev-parse --is-inside-work-tree`로 저장소인지 확인한다. 아니면 알리고 멈춘다.
- `gh auth status`로 인증을 확인한다. 실패하면 `gh auth login`이 필요하다고 알리고 멈춘다.
- `git branch --show-current`로 현재 브랜치를 확인한다. 기본 브랜치(`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`)이거나 detached HEAD면 PR을 만들 수 없다고 알리고 멈춘다.
- `git status --short`에 커밋되지 않은 변경이 있으면 PR에 포함되지 않는다고 사용자에게 알린다. 커밋은 임의로 하지 않는다.
- `gh pr list --head <현재 브랜치> --json url,state`로 이미 열린 PR이 있는지 확인한다. 있으면 URL을 알리고 멈춘다.

### 2. 변경 분석
- base 브랜치를 정한다 (`--base` 우선, 없으면 기본 브랜치).
- `git log <base>..HEAD --oneline`과 `git diff <base>...HEAD --stat`, 필요하면 `git diff <base>...HEAD`로 변경을 파악한다.
- base 대비 커밋이 없으면 알리고 멈춘다.
- 변경 내용에 비밀 값(키, 토큰 등)이 보이면 PR을 만들지 않고 파일명과 위치만 알린다. 값은 출력하지 않는다.

### 3. 언어 결정 및 제목·본문 작성
- 위 "언어 판별"로 언어를 정하고 해당 `references/` 템플릿을 읽는다.
- 제목: 선택한 언어로 70자 이내, 마침표 없음. 커밋이 하나면 그 커밋 메시지를 바탕으로 한다.
- 본문: 템플릿의 섹션 구조를 그대로 유지하고 각 섹션을 diff에서 확인한 사실로 채운다.
  - 추측하지 않는다. 실행하지 않은 테스트를 통과했다고 쓰지 않는다.
  - 해당 사항이 없는 섹션은 지우지 말고 `해당 없음`(kr) / `N/A`(en)으로 둔다.
  - 템플릿의 HTML 주석 안내문은 제거한다.
- 본문 맨 끝에 다음 줄을 붙인다.

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 4. 푸시 및 생성
- 원격에 브랜치가 없거나 앞서 있으면 `git push -u origin <현재 브랜치>`로 푸시한다. force push는 하지 않는다.
- 본문은 임시 파일이나 heredoc으로 `--body-file`/`--body`에 전달해 줄바꿈을 보존한다.
- `gh pr create --base <base> --title "<제목>" --body-file <파일>` (`--draft` 인자가 있으면 추가).
- 생성되면 PR URL, 제목, base 브랜치, 사용한 언어와 그 판별 근거를 보고한다.

## 하지 말 것
- 기본 브랜치에서 PR 만들기.
- 커밋되지 않은 변경을 임의로 커밋하기.
- force push.
- 두 언어를 한 본문에 섞기.
- 수행하지 않은 검증을 체크 처리하기.
