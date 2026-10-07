# Kept 관리자 페이지

회원·구독을 보고 최소한의 조치(이용 정지, 계정 삭제, 구독 해지)를 하는 운영용 페이지입니다.
앱(v2)과 **완전히 따로** 배포하며, v2 앱 코드는 바꾸지 않습니다.

## 1. 무엇을 어디서 관리하나

| 할 일 | 어디서 | 이유 |
|---|---|---|
| 회원 수·가입 추이·접속·기록 수 | **관리자 페이지** 대시보드 | 여러 곳 숫자를 한 화면에 |
| 회원 검색, 가입일·최근 접속·기록 개수·구독 상태 | **관리자 페이지** 회원 | |
| 스팸/악용 계정 이용 정지·해제 | **관리자 페이지** | 기록은 남기고 로그인만 막음 |
| 계정 삭제(본인 요청 등) | **관리자 페이지** (owner만) | 이메일 재입력 확인, 구독이 살아 있으면 막힘 |
| 구독 목록·결제 실패·해지 예정 | **관리자 페이지** 구독·결제 | 웹훅이 기록한 내용 |
| 구독 해지 | **관리자 페이지** (owner, Paddle API 키 필요) 또는 Paddle | |
| 환불, 영수증, 세금, 정산, 결제 수단 | **Paddle 대시보드** | Paddle이 판매 대행(MoR)이라 그쪽이 기준 |
| 비밀번호 재설정 메일, 인증 메일, 로그인 설정 | **Supabase 대시보드** → Authentication | 이미 다 갖춰져 있음 |
| 서버 오류·사용량 | **Supabase** Logs / Reports, **Cloudflare** Analytics | |

**나중에 추가할 만한 것** (출시 후 필요해지면): 공지/점검 안내(앱 수정 필요), 문의·신고 처리함, 쿠폰·무료 이용권, 2단계 인증(MFA) 강제, 운영자 여러 명 권한 세분화, 매출 리포트.

**하지 않는 것**: 관리자도 회원의 기록 **내용**(제목·본문)은 볼 수 없습니다. 개수와 날짜만 봅니다. 개인 기록 서비스라 이것이 신뢰의 기본이고, 개인정보처리방침에도 그렇게 쓸 수 있습니다.

## 화면

어두운 화면 전용입니다. 검은 프레임 + 왼쪽 아이콘 레일, 둥근 회색 패널, 보라·머스터드·코럴·세이지 컬러 카드, 넓은 글꼴(Archivo, Google Fonts)의 큰 숫자, 초록 알약 변화량, 흰 알약 선택 탭.
대시보드: 전체 회원 → 주요 지표 카드 4장(30일 추이선) → 가입 추이 차트(7/14/30일, 마우스를 올리면 날짜별 값) + 최근 관리 기록 → 오른쪽에 구독 상태 카드와 예상 월 매출.
스크린샷: `record-service/screens/admin-*.png`

## 2. 보안 구조

```
관리자 브라우저 ──(관리자 계정 로그인 토큰)──▶ Edge Function admin-api ──(service role)──▶ DB / Auth / Paddle API
   anon 키만 가짐                               ① 토큰 주인 확인
                                                ② public.admins 명단 확인 (owner / staff)
                                                ③ 처리 + admin_audit에 기록
```

- 관리자 화면에는 **anon 키만** 있습니다. service role 키와 Paddle API 키는 Edge Function 비밀값에만 둡니다.
- `admins`, `admin_audit` 표와 `admin_*` 함수는 일반 로그인 사용자가 읽거나 부를 수 없습니다(검사로 확인).
- 화면이 아니라 **서버가** 관리자 여부를 판단합니다. 누가 화면 코드를 고쳐도 데이터는 못 가져갑니다.
- 정지·삭제·해지는 누가, 언제, 왜 했는지 `admin_audit`에 남습니다.
- 권한 두 단계: **owner**(전부) / **staff**(조회, 이용 정지·해제).
- 관리자 주소는 검색에 안 잡히게(noindex) 하고, 가능하면 Cloudflare Access로 한 겹 더 막습니다(아래 5번).

## 3. 파일

```
admin/
  site/                     관리자 페이지 (Cloudflare Pages에 따로 배포)
    index.html  app.js  admin.css  config.js  _headers  robots.txt
  supabase/
    admin.sql               관리자 명단·관리 기록 표, 조회 함수(service role 전용)
    functions/admin-api/    관리자 API (Edge Function)
  test/                     검사 (배포 안 함)
    api.test.mjs            권한·API 34개 검사      node api.test.mjs
    ui.mjs                  브라우저 화면 검사       node ui.mjs
    fake-db.mjs             PGlite로 Supabase 흉내
```
검사 준비: `npm i @electric-sql/pglite playwright` (record-service/tools/sql-test와 같은 방식)

## 4. 설정 순서 (직접 하실 일)

1. **v2 SQL 먼저**: `v2/supabase/v2-shared-folders.sql`, `v2-subscriptions.sql`을 아직 안 돌렸다면 먼저 실행
2. **관리자 SQL**: Supabase → SQL Editor에서 `admin/supabase/admin.sql` 전체 실행
3. **첫 관리자 등록**: 관리자로 쓸 계정으로 Kept에 가입(또는 기존 계정)한 뒤, 이메일을 바꿔 SQL Editor에서 한 줄 실행
   ```sql
   insert into public.admins (user_id, role) select id, 'owner' from auth.users where email = '내이메일@example.com'
   on conflict (user_id) do update set role = 'owner';
   ```
   운영자를 더 두려면 같은 문장에서 `'owner'`를 `'staff'`로. 빼려면 `delete from public.admins where user_id = '…';`
4. **Edge Function 배포** (Supabase CLI):
   ```
   supabase functions deploy admin-api
   supabase secrets set ADMIN_ORIGIN=https://admin.내도메인.com
   ```
   - `--no-verify-jwt`는 **붙이지 마세요** (paddle-webhook과 다름).
   - `ADMIN_ORIGIN`은 관리자 페이지 주소(5번). Pages 기본 주소를 쓰면 `https://kept-admin.pages.dev` 같은 값.
   - (선택) 관리자 페이지에서 구독 해지까지 하려면: Paddle → Developer tools → Authentication → **API key** 발급(권한: subscriptions 쓰기) 후
     `supabase secrets set PADDLE_API_KEY=pdl_… PADDLE_ENV=sandbox` (실서비스는 `production`). 안 넣으면 해지는 Paddle 대시보드에서 합니다.
5. **관리자 페이지 배포**: Cloudflare Pages에서 **새 프로젝트**(예: kept-admin)를 만들고 `admin/site/` 폴더만 올립니다. 앱과 같은 프로젝트에 넣지 마세요.
   - `site/config.js`는 앱과 같은 Supabase 주소·anon 키로 이미 채워 두었습니다.
   - 사용자 도메인을 쓴다면 `admin.내도메인.com` 연결 후 4번 `ADMIN_ORIGIN`도 그 주소로.
6. **(권장) Cloudflare Access**: Cloudflare Zero Trust → Access → Applications → Self-hosted로 관리자 주소를 등록하고 정책을 "내 이메일만 허용"으로. 무료(50명까지)이고, 로그인 화면 자체가 남에게 안 보이게 됩니다.
7. **(권장) 관리자 계정 보안**: 관리자 계정은 긴 비밀번호를 쓰고, 같은 계정으로 다른 사이트에 가입하지 않기. Supabase Auth의 MFA(TOTP)는 다음 단계에서 화면에 붙일 수 있습니다.
8. **확인**: 관리자 주소에서 로그인 → 대시보드 숫자가 보이면 끝. "관리자 명단에 없습니다"가 나오면 3번, "함수가 배포되지 않았습니다"가 나오면 4번을 확인.

## 5. 동작 메모

- **이용 정지**: Supabase Auth의 ban(약 100년). 새 로그인 불가, 열린 앱은 토큰 갱신(최대 1시간) 때 끊김. 기록은 그대로.
- **계정 삭제**: Auth 사용자 삭제 → 기록·카테고리·만든 공유 폴더가 함께 지워짐(외래키 cascade). 이용 중 구독이 있으면 먼저 해지해야 함. 되돌릴 수 없음.
- **구독 해지**: Paddle API로 "이번 결제 기간 끝에 해지" 요청 → Paddle 웹훅이 상태를 갱신. 환불은 Paddle에서.
- **예상 월 매출**: (월간 수 × $3.99) + (연간 수 × $39.90 ÷ 12). 세금·수수료 전 대략치이며 정확한 금액은 Paddle 기준.
- 앱의 원본 `schema.sql`이 없어 `entries`, `categories` 열 이름은 앱 코드로 추정했습니다(`user_id`, `deleted_at`, `created_at`, `updated_at`). 다르면 admin.sql 실행 때 오류로 바로 드러납니다.
