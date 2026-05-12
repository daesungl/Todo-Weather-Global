# Production Deployment Checklist

매 버전 배포 전, 아래 항목을 순서대로 확인하고 적용한다.
새 마이그레이션이나 Edge Function 변경이 있을 때만 해당 섹션을 실행한다.

---

## 배포 순서 (공통)

```bash
# 1. prod 환경 및 링크 전환
npm run env:use:prod
npm run supabase:link:prod

# 2. DB 마이그레이션 적용 (변경사항 있을 때만)
# ⚠️ 반드시 supabase:link:prod 후 실행 — link 없이 하면 dev에 적용됨
supabase migration list --linked   # Remote 열이 빈 항목 확인
supabase db push

# 3. Edge Function 배포 (변경사항 있을 때만)
supabase functions deploy <function-name> --project-ref lptwysebhpaxgcmsrmgk

# 4. 앱 빌드
npm run build:prod:ios
npm run build:prod:android
```

---

## Supabase 인프라 현황

### Edge Functions
| 함수명 | 용도 | 필요 Secrets |
|---|---|---|
| `weather-proxy` | 날씨 API 프록시 (KMA, OpenWeather, VWorld) | `KMA_SERVICE_KEY`, `WEATHER_API_KEY`, `VWORLD_API_KEY` |
| `plan-api` | 플랜/멤버/댓글 CRUD, 초대코드 | `SUPABASE_SERVICE_ROLE_KEY` (자동) |

### 주요 DB 설정
- `plan_members`: `REPLICA IDENTITY FULL` — DELETE 이벤트 realtime 필터 작동에 필수
- `plans`, `plan_steps`, `plan_comments`: Realtime publication 활성화 필요

---

## 버전별 변경사항

### v1.1.3 (build 65) — 2026-05-12

#### DB 마이그레이션
| 파일 | 내용 | 적용 여부 |
|---|---|---|
| `20260511000000_tasks_and_regions.sql` | tasks/regions 테이블 생성 | ✅ prod 적용 완료 |
| `20260512000000_profiles_rls_and_anon_auth.sql` | profiles RLS 정책 (SELECT/INSERT/UPDATE) 추가 | ✅ prod 적용 완료 |
| `20260512001000_plan_realtime_select_policies.sql` | plan 관련 테이블 realtime SELECT 정책 | ✅ prod 적용 완료 |
| `20260512002000_enable_realtime_publications.sql` | plans/steps/comments Realtime publication 활성화 | ✅ prod 적용 완료 |
| `20260512003000_replica_identity_full.sql` | REPLICA IDENTITY FULL 설정 | ✅ prod 적용 완료 |
| `20260512004000_transfer_codes.sql` | 초대 코드 이전 기능 | ✅ prod 적용 완료 |
| `20260512005000_plan_members_replica_identity.sql` | `ALTER TABLE plan_members REPLICA IDENTITY FULL` | ✅ prod 적용 완료 |

#### Edge Functions
| 함수 | 변경 내용 | 적용 여부 |
|---|---|---|
| `weather-proxy` | 코드 최신화 재배포 | ✅ prod 적용 완료 |
| `plan-api` | 플랜 저장 전 profiles upsert 추가 (FK 제약 위반 수정), 댓글 기능 미작동 수정 | ✅ prod 적용 완료 (2차) |

#### Secrets (신규 추가 없음)
- `KMA_SERVICE_KEY`, `WEATHER_API_KEY`, `VWORLD_API_KEY` — 이미 설정됨

#### 주요 이슈 및 원인
- **날씨 데이터 미로딩**: `weather-proxy` 함수가 구버전으로 남아있어 재배포로 해결
- **강퇴 멤버 실시간 미반영**: `plan_members`에 REPLICA IDENTITY FULL 없어 DELETE realtime 이벤트 필터가 작동 안 함 → 마이그레이션으로 해결
- **플랜 저장/댓글 안됨 (핵심 원인)**: `supabase db push`가 dev 링크 상태에서 실행되어 prod에는 `20260511000000` 이후 마이그레이션 7개가 미적용 상태였음. 특히 `20260512000000`(profiles RLS INSERT 정책) 누락 → AuthContext profile INSERT 실패 → FK 제약 위반 (`plans.owner_uid → profiles.uid`). 해결: prod 링크 후 `supabase db push`로 7개 마이그레이션 일괄 적용.
- **재발 방지**: 배포 전 반드시 `npm run supabase:link:prod && supabase migration list --linked`로 Local/Remote 열 확인 후 `supabase db push` 실행.
- **addFlow 오류 무시 문제**: `FlowSyncService.addFlow`가 백엔드 오류를 `console.warn`만 하고 삼켰음. 수정: 내부 상태 롤백 후 re-throw → FlowScreen catch에서 사용자에게 에러 메시지 표시.
- **plan-api 방어 코드 추가**: plan upsert 전 `profiles.upsert()` 추가하여 FK 제약 위반 방지 (admin client로 RLS 우회).

---

### v1.1.2 (이전 버전)

#### DB 마이그레이션
| 파일 | 내용 |
|---|---|
| `20260510000000_plan_core.sql` ~ `20260512004000_transfer_codes.sql` | 플랜 공유 기능 전체 스키마, RLS, Realtime 설정 |

---

## 신규 버전 작업 시 체크리스트 템플릿

```markdown
### vX.X.X (build NN) — YYYY-MM-DD

#### DB 마이그레이션
| 파일 | 내용 | 적용 여부 |
|---|---|---|
| `` | | ⬜ |

#### Edge Functions
| 함수 | 변경 내용 | 적용 여부 |
|---|---|---|
| `weather-proxy` | | ⬜ / — |
| `plan-api` | | ⬜ / — |

#### Secrets
- 신규: ``
- 변경 없음: ``

#### 주요 이슈 및 원인
-
```
