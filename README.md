# Kept — 개인 기록·기억 관리 웹앱 (v2 작업본)

생각, 아이디어, 할 일, 일정, 물건 위치, 연락처를 빠르게 기록하고 바로 찾는 텍스트 중심 서비스입니다.

## 폴더 구조 (v2)

빌드 도구 없이 그대로 배포합니다. 브라우저 표준 ES 모듈을 사용합니다.

```
index.html              ← 화면 뼈대만 (메타·CSS 링크·config.js·js/main.js)
config.js               ← 운영 설정 (Supabase, 운영자, 결제)
sw.js                   ← 서비스 워커 (오프라인). 캐시 이름 = 앱 버전
manifest.webmanifest    ← PWA 설치 정보
_headers                ← Cloudflare Pages 보안·캐시 헤더
supabase/               ← 서버 SQL (Supabase에서 실행하는 파일, 배포에는 필요 없음)
icons/                  ← 앱 아이콘 (기존 배포본에서 옮겨 와야 함)
css/
  tokens.css            ← 색·글자 크기 등 디자인 토큰, 기본 요소
  shell.css today.css entries.css tasks.css calendar.css items.css
  settings.css dock.css overlays.css editor.css auth.css responsive.css
  layers/               ← v1.1~v1.6.2에서 덧입힌 스타일 (해당 화면 작업 때 위 파일로 합칠 예정)
  editor-v2.css         ← v2 글쓰기: 접히는 도구, 선택 아이콘, 템플릿, 문단 간격 5단계, 인터랙션
  home-v2.css           ← v2 메인: 감성형 문장, 접는 카드, 프로필 크기
  calendar-v2.css       ← v2 캘린더: 구글 캘린더형 월간 격자, N개 더보기, 날짜 팝업
  lists-v2.css          ← v2 목록: 날짜순 정렬의 날짜별 소제목
  share-v2.css          ← v2 공유 폴더: 배지, 폴더 목록, 멤버 창, 글쓰기 공유 칩
  plans-v2.css          ← v2 구독: 무료·월간·연간 카드, Kept 알리기 창
  fixes.css             ← v2 수정 (더블탭 확대 방지 등)
js/
  main.js               ← 시작점: 모든 모듈을 불러오고 앱을 부팅
  lib/                  ← 공통 도구: config, utils, i18n, sanitize, icons, strings
  i18n/                 ← 언어별 문구 (en.js, ko.js), 감성형 메인 문장 (story.ko.js, story.en.js)
  data/                 ← 저장소: store(상태), local-db(IndexedDB), sync, supabase, cities
  editor/               ← 글쓰기: editor, rich(서식 엔진), composer(빠른 기록), templates(서식 템플릿 10종), spacing(문단 간격 5단계)
  features/             ← 기능: story(감성형 메인 조립), share(공유 폴더), billing(Paddle 구독), promo(Kept 알리기), search, reminders, weather, aurora, prompts, avatar, data-io, install
  ui/                   ← 공통 화면: shell(틀·사이드바·독), router, entries(카드), feedback(토스트·대화상자), motion(작은 애니메이션)
  views/                ← 화면: today, lists, tasks, calendar, folders(공유 폴더), items, organize, settings, pages
  app/                  ← 동작 연결: actions, menus, events, auth-screen, session
tools/update-precache.mjs ← 파일을 추가·삭제한 뒤 실행
```

### 개발 규칙
- 앱 버전은 `js/lib/config.js`의 `APP_VERSION` 한 곳에서만 바꿉니다. 서비스 워커 캐시 이름도 자동으로 따라갑니다.
- JS나 CSS 파일을 추가하거나 지우면 `node tools/update-precache.mjs`를 실행해 오프라인 목록을 갱신합니다.
- 로컬 확인: 이 폴더에서 `python3 -m http.server 8080` 실행 후 http://localhost:8080 접속 (모듈은 파일을 더블클릭해서는 열리지 않습니다).
- 인라인 스크립트를 쓰지 않습니다. 보안 정책(CSP)에서 `script-src 'unsafe-inline'`을 뺐습니다.
- 앱 파일(js, css)은 항상 서버에서 최신본을 먼저 받고, 오프라인일 때만 캐시를 씁니다. 배포 직후 옛 파일과 새 파일이 섞이지 않게 하기 위함입니다.

## 1. Supabase 설정 (약 5분)

1. https://supabase.com 에서 새 프로젝트를 만듭니다.
2. **SQL Editor** → `supabase/schema.sql` 전체를 붙여 넣고 실행합니다. 여러 번 실행해도 안전합니다.
3. **Authentication → URL Configuration**
   - Site URL: 배포 주소 (예: `https://kept.pages.dev`)
   - Redirect URLs: 같은 주소 추가 (이메일 인증·비밀번호 재설정 링크가 여기로 돌아옵니다)
4. **Authentication → Providers → Email**: 이메일 확인(Confirm email) 켜기를 권장합니다.
5. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사합니다.
   > ⚠️ `service_role` 키는 절대 index.html에 넣지 마세요. 앱은 anon 키 + RLS로만 동작합니다.

## 1-1. 공유 폴더 켜기 (v2)

1. Supabase **SQL Editor**에 `supabase/v2-shared-folders.sql` 전체를 붙여 넣고 실행합니다. 여러 번 실행해도 안전하고, 기존 테이블·정책은 건드리지 않습니다.
2. 끝. 앱이 서버에 공유 테이블이 있는지 스스로 확인합니다. 실행 전에는 공유 메뉴에 "서버에 아직 켜지지 않았어요" 안내만 보이고 나머지는 그대로 동작합니다.

- 만드는 것: `folders`(공유 폴더), `folder_members`(멤버·초대, 역할 owner/editor/viewer), `entries.folder_id`(null = 나만 보기, 기본값), 추가 RLS 정책, 초대 수락 함수 `accept_folder_invite`, 초대 목록 함수 `my_folder_invites`.
- 초대는 이메일 주소로 만들고, 그 이메일로 로그인한 사람이 앱에서 수락합니다. 앱이 메일을 보내지는 않아서 초대 후 안내 문구를 복사해 보내도록 했습니다. (자동 메일이 필요하면 나중에 Edge Function으로 추가)
- 한도: 한 사람당 공유 폴더 20개, 폴더당 멤버 30명. SQL의 `folders_limits`에서 바꿉니다.
- 다른 사람 기록에 누른 즐겨찾기·메인에 표시·카테고리는 내 기기에만 남고 원래 작성자의 기록은 바꾸지 않습니다.
- 주의: v1 `schema.sql` 원본이 없어 기존 트리거를 추정했습니다. v1 트리거가 "작성자가 아니면 수정 거부"처럼 오류를 내는 방식이라면 멤버의 편집이 막힙니다. 이 경우 `schema.sql`을 주시면 맞춰 고치겠습니다. 확인용 쿼리:
  `select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'public.entries'::regclass and not tgisinternal;`
- 테스트: `../tools/sql-test/` (실제 Postgres에서 권한 검사 29개, 두 사용자 화면 테스트)

## 2. 설정값 입력

`config.js`의 `window.KEPT_CONFIG` 블록을 채웁니다.

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
OPERATOR: "운영자 이름",
PRIVACY_CONTACT: "privacy@yourdomain.com",
SITE_URL: "https://kept.pages.dev",   // 'Kept 알리기'가 공유하는 주소 (비우면 지금 주소)
SUBSCRIBE: { environment: "sandbox", clientToken: "test_...", prices: { monthly: "pri_...", yearly: "pri_..." }, display: { monthly: 3.99, yearly: 39.9, currency: "USD" } }
```

- Supabase 값을 비워 두면 **기기 전용 모드**로 동작합니다 (브라우저 IndexedDB에만 저장). 화면에도 "클라우드 미연결"로 명확히 표시됩니다.
- `SUBSCRIBE`의 토큰이나 가격 ID를 비워 두면 구독 버튼이 꺼지고 "결제가 아직 연결되지 않았어요"라고 안내합니다. 결제가 된 것처럼 보이는 화면은 없습니다.

## 3. Cloudflare Pages 배포

- **Direct Upload**: Pages → Create → Upload assets → 이 폴더 업로드.
- 또는 Git 연결 시 Build command 없음, Output directory는 이 폴더.
- HTTPS는 Pages가 자동 제공합니다. `_headers`가 보안 헤더를 적용합니다.

## 4. 정기구독 — Paddle (무료 / 월 $3.99 / 연 $39.90)

Paddle이 판매 대행(Merchant of Record)으로 결제·세금·영수증·환불을 처리합니다. 앱은 카드 정보를 보지 않고, 구독 상태는 웹훅이 서버에 기록한 것만 믿습니다.
처음에는 **Sandbox**(테스트 결제)에서 끝까지 확인한 뒤 Live로 바꾸세요. Live 판매는 Paddle의 사업자·웹사이트 심사가 끝나야 열립니다.

1. **Paddle 계정**: sandbox-vendors.paddle.com(테스트)와 vendors.paddle.com(실제)에 가입. 실제 쪽은 사업자 정보, 웹사이트 주소, 이용약관·개인정보처리방침·환불정책 링크로 심사를 받습니다(앱의 #/terms, #/privacy 사용 가능).
2. **상품과 가격**: Catalog → Products에서 상품 "Kept 구독"을 만들고 가격 두 개를 추가합니다.
   - 월간: $3.99, 청구 주기 1개월 · 연간: $39.90, 청구 주기 1년 · 각 가격의 ID(`pri_…`)를 복사
3. **클라이언트 토큰**: Developer tools → Authentication → Client-side tokens에서 새 토큰(`test_…` / `live_…`)을 만들어 복사
4. **허용 도메인**: Checkout → Checkout settings에서 기본 결제 링크(Default payment link)에 배포 주소를 넣고, 도메인 승인을 요청합니다(Live만 해당).
5. **서버 테이블**: Supabase SQL Editor에서 `supabase/v2-subscriptions.sql` 실행
6. **웹훅 함수 배포**:
   ```
   supabase functions deploy paddle-webhook --no-verify-jwt
   supabase secrets set PADDLE_WEBHOOK_SECRET=pdl_ntfset_... PADDLE_PRICE_MONTHLY=pri_... PADDLE_PRICE_YEARLY=pri_...
   ```
7. **웹훅 연결**: Developer tools → Notifications → New destination
   - URL `https://<project>.supabase.co/functions/v1/paddle-webhook`
   - 이벤트: subscription.created / updated / activated / canceled / past_due / paused / resumed / trialing
   - 만들고 나서 보이는 Secret key를 6번의 `PADDLE_WEBHOOK_SECRET`에 넣습니다.
8. **config.js**의 `SUBSCRIBE`에 `environment`, `clientToken`, `prices.monthly`, `prices.yearly`를 넣고 배포합니다.
9. **테스트 결제**: Sandbox에서 카드 `4242 4242 4242 4242`, 아무 미래 날짜, CVC `100`으로 구독 → 몇 초 뒤 구독 페이지와 설정에 "연간 구독 이용 중"이 보이면 성공입니다.
10. Live 전환: Live 토큰·가격 ID·웹훅 secret으로 바꾸고 `environment: "production"`.

- 해지·결제 수단 변경: 구독 페이지의 버튼이 Paddle이 주는 관리 링크로 연결됩니다. 해지하면 결제한 기간 끝까지 유지됩니다.
- 구독자 판별이 필요하면 SQL에서 `is_subscriber()`를 쓰면 됩니다(지금은 기능 차등 없음).
- 이전 Stripe 후원(`donations` 테이블, `donation-webhook`)은 v2 앱에서 더 이상 쓰지 않습니다. 기존 후원자가 있다면 Stripe에서 정기 후원을 정리해 주세요.

## 동작 방식 요약

| 영역 | 구현 |
|---|---|
| 저장 | 로컬 우선(IndexedDB) → 디바운스 후 Supabase 동기화. 저장 중/저장됨/동기화됨/오프라인/실패 상태 표시 |
| 충돌 | 모든 행에 `version`(서버 트리거가 증가). 버전이 다르면 덮어쓰지 않고 **서버본 + "(충돌 사본)" 둘 다 보관** |
| 삭제 동기화 | 영구 삭제 시 `deleted_records` 툼스톤으로 다른 기기에 전파. 휴지통은 30일 후 자동 영구 삭제 |
| 보안 | 전 테이블 RLS(`user_id = auth.uid()`), 소유자·버전·시각은 서버 트리거가 강제, 리치 텍스트는 허용 목록 기반 정화 후 저장·렌더, CSP·보안 헤더, CSV 수식 주입 방지 |
| 검색 | 로컬 인덱스로 입력 즉시 검색(수천 건도 즉시), 서버에는 trigram/GIN 인덱스 준비 |
| 사용 정책 | 계정당 기록 20,000개, 카테고리 200개, 기록당 20만 자 (`schema.sql`에서 조정) |
| 알림 | 브라우저 Notification API — 앱이 열려 있을 때 동작한다고 화면에 정직하게 안내 |
| 오프라인 | 서비스 워커가 앱 셸 캐시, 로그인 사용자는 오프라인 콜드스타트도 계정 모드로 열리고 복귀 시 자동 동기화 |
| 다국어 | 한국어·영어 (`I18N` 객체에 언어 추가). 날짜·숫자는 `Intl`로 지역화 |

## v1.5 변경
- 날씨: 기기 위치·권한을 쓰지 않고 설정 → 화면 → '오늘 화면 날씨'에서 국가 → 도시(전 세계 56개국 대도시, 한국은 시 단위 49곳)를 고르는 방식. 선택하지 않으면 날씨 미표시
- 메인 팁 문구를 맨 아래로 이동
- `KEPT_CONFIG`에 Supabase URL·anon 키, 운영자(Andrew Lee), 문의 메일(24story@gmail.com) 입력 완료

## v1.4 변경
- PC: 메뉴를 제외한 콘텐츠 최대 폭 820px(아이패드급) 고정, 메인은 모바일과 같은 한 줄 흐름
- 질문 카드 배경: 입자 느낌의 원형 빛 대신 자연스러운 대각선 그라데이션 + 필름 그레인, 빛이 천천히 흐르는 애니메이션(CSS만 사용)
- 모바일 카드 모서리 잘림(정사각형) 수정
- 글쓰기 '취소' 추가: 새 기록은 저장하지 않고, 기존 기록은 열었을 때 상태로 되돌림(확인 후)
- 빠른 기록: 질문은 본문과 분리된 작은 안내로 표시되고 글을 쓰기 시작하면 접힘, 본문 안내문 표시, 상단 빈 공간 오류 수정

## v1.3 변경
- 메인: '목요일•' 전체 요일 + 날씨(아이콘/문장 랜덤, 누르면 전환). 날씨는 Open-Meteo(무료·API 키 없음)에서 위치 허용 시 1시간에 한 번만 요청, 서버에 위치 저장 없음. CSP `connect-src`에 `https://api.open-meteo.com` 추가됨
- '지금 떠오른 생각' 카드: CSS만으로 잔잔하게 움직이는 오로라(네트워크 0, 화면 밖이면 정지), 팔레트 8종(자동: 날씨/랜덤, 설정에서 고정 가능), 질문 48개가 9초마다 랜덤 전환
- 메인 요약(연속 기록·기록 수·완료·물건 위치)을 누르면 해당 화면으로 이동
- 주간 날짜·월간 달력 스와이프 이동, '오늘' 버튼으로 복귀
- 일정 화면 재디자인(부드러운 색 칩, 모바일은 점 표시, 오늘·선택 표시 정리, 타임라인 일정 목록), 긴 제목에도 모바일 폭 유지
- 후원 직접 입력에 통화 표시(US$), 모바일 메뉴 크기 확대

## v1.2 변경
- 텍스트 크기 7단계 기준(표시·히어로·페이지 제목·섹션 제목·본문·보조·캡션) + 편집 본문 17px로 통일
- 모든 기록 구조 통일: 제목 → 속성 칩 한 줄 → 본문. 날짜·시간·위치·전화번호 등은 칩을 눌러 키보드 위 패널에서 입력
- 아이콘·이모티콘 선택 패널은 휴대폰에서 키보드 자리를 대신해 글이 밀리지 않음 (⌨ 버튼으로 키보드 복귀)
- '지금 떠오른 생각'은 같은 편집기의 오로라 스킨으로 열려 모든 서식 도구 사용 가능
- 프로필 사진(기기에서 160px로 줄여 설정에 저장), 후원 $1·$3·$5·$7·직접 입력, Kept 소개·FAQ 페이지
- `schema.sql`의 설정(prefs) 크기 제한을 64KB로 늘렸습니다 — 기존 프로젝트는 SQL을 다시 실행하세요.

## 모바일 사용 (v1.1)
- **편집기**: 키보드 바로 위에 서식 도구 18개가 2줄로 모두 보입니다(스와이프 없음). 색·형광펜·크기 버튼은 한 번 누르면 마지막 색이 바로 적용되고, 아래 패널에서 다른 값을 고를 수 있습니다. 글자를 선택하지 않은 상태에서 서식을 고르면 **다음에 입력하는 글자**에 적용됩니다(한글 입력 포함).
- **빠른 기록**: 오늘 화면의 입력창을 누르면 전체 화면 입력 시트가 열려 입력 위치가 가려지지 않습니다. ⤢ 버튼으로 전체 편집기로 이어서 쓸 수 있습니다.
- **제스처**: 목록·할 일 행을 오른쪽으로 밀면 완료/즐겨찾기, 왼쪽으로 밀면 휴지통. 편집기는 위쪽 손잡이를 아래로 끌어 닫습니다.
- **iPhone·iPad 설치**: Safari 공유 버튼 → 홈 화면에 추가 → 추가 (iOS 16.4+). 앱 안에 그림으로 된 설치 안내가 있습니다. iPhone·iPad 알림은 홈 화면에 추가한 앱에서만 동작합니다.

## 단축키
`/` 또는 `⌘/Ctrl K` 검색 · `N` 새 기록 · `?` 단축키 목록 · `Esc` 닫기 · 편집기에서 `⌘B/I/U`, `⌘⇧X` 취소선, `⌘⇧H` 형광펜, `⌘⇧8/7` 목록, `⌘⇧9` 인용, `⌘⇧I` 아이콘, `⌘⇧E` 이모티콘, 줄 첫머리 `- ` `1. ` `> ` `# ` 자동 서식.

## 출시 전 체크리스트
- [ ] `KEPT_CONFIG` 입력, Supabase Redirect URL 등록
- [ ] 개인정보 처리방침·이용약관 템플릿 검토 및 운영자 정보 기입 (법률 검토 권장)
- [ ] Paddle 구독 연결(Sandbox 테스트 → Live 심사·전환) 또는 비워 두어 비활성 안내 유지
- [ ] 실제 배포 주소에서 회원가입 → 이메일 인증 → 두 기기 동기화 확인

아이콘: Lucide (ISC License).
