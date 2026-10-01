# Kept — 개인 기록·기억 관리 웹앱

생각, 아이디어, 할 일, 일정, 물건 위치, 연락처를 빠르게 기록하고 바로 찾는 텍스트 중심 서비스입니다.
무료 · 광고 없음 · AI 없음 · 이미지 저장 없음 · 자발적 후원 운영.

```
dist/
├─ index.html                  ← 앱 전체 (HTML·CSS·JS 단일 파일, 상단에 설정 블록)
├─ sw.js                       ← 서비스 워커 (오프라인 앱 셸)
├─ manifest.webmanifest        ← PWA 설치 정보
├─ icons/                      ← 앱 아이콘 (192/512/maskable/apple-touch)
├─ _headers                    ← Cloudflare Pages 보안 헤더
└─ supabase/
   ├─ schema.sql               ← 테이블·RLS·트리거·계정 삭제 함수
   └─ functions/donation-webhook/index.ts  ← (선택) Stripe 후원 내역 기록
```

## 1. Supabase 설정 (약 5분)

1. https://supabase.com 에서 새 프로젝트를 만듭니다.
2. **SQL Editor** → `supabase/schema.sql` 전체를 붙여 넣고 실행합니다. 여러 번 실행해도 안전합니다.
3. **Authentication → URL Configuration**
   - Site URL: 배포 주소 (예: `https://kept.pages.dev`)
   - Redirect URLs: 같은 주소 추가 (이메일 인증·비밀번호 재설정 링크가 여기로 돌아옵니다)
4. **Authentication → Providers → Email**: 이메일 확인(Confirm email) 켜기를 권장합니다.
5. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사합니다.
   > ⚠️ `service_role` 키는 절대 index.html에 넣지 마세요. 앱은 anon 키 + RLS로만 동작합니다.

## 2. 설정값 입력

`index.html` 상단의 `window.KEPT_CONFIG` 블록을 채웁니다.

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
OPERATOR: "운영자 이름",
PRIVACY_CONTACT: "privacy@yourdomain.com",
DONATE: { provider: "Stripe", oneTime: "https://buy.stripe.com/...", monthly: "https://buy.stripe.com/...", manage: "https://billing.stripe.com/p/login/...", currency: "KRW" }
```

- Supabase 값을 비워 두면 **기기 전용 모드**로 동작합니다 (브라우저 IndexedDB에만 저장). 화면에도 "클라우드 미연결"로 명확히 표시됩니다.
- 후원 링크를 비워 두면 후원 버튼이 비활성화되고 "결제가 아직 연결되지 않았어요"라고 안내합니다. 결제가 된 것처럼 보이는 화면은 없습니다.

## 3. Cloudflare Pages 배포

- **Direct Upload**: Pages → Create → Upload assets → `dist` 폴더 업로드.
- 또는 Git 연결 시 Build command 없음, Output directory `dist`.
- HTTPS는 Pages가 자동 제공합니다. `_headers`가 보안 헤더를 적용합니다.

## 4. (선택) 후원 내역 연동 — Stripe

1. Stripe에서 일회성·정기 Payment Link를 만들고 `DONATE`에 입력합니다 (금액은 "고객이 선택" 권장).
2. Edge Function 배포:
   ```
   supabase functions deploy donation-webhook --no-verify-jwt
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. Stripe Webhook 엔드포인트 `https://<project>.supabase.co/functions/v1/donation-webhook` 추가 (이벤트: `checkout.session.completed`, `invoice.paid`).
4. 앱이 결제 링크에 `client_reference_id=<사용자 ID>`를 붙여 후원과 계정을 연결합니다. 내역은 후원 페이지에 표시됩니다.
   해지는 `DONATE.manage`(Stripe 고객 포털)에서 사용자가 직접 합니다.

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
- [ ] 후원 결제 연결(또는 비워 두어 비활성 안내 유지)
- [ ] 실제 배포 주소에서 회원가입 → 이메일 인증 → 두 기기 동기화 확인

아이콘: Lucide (ISC License).
