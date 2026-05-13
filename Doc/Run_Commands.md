# dev 일때는 dev firebase key 넣고 prod 일떄는..?

supabase secrets set FIREBASE_WEB_API_KEY=Firebase_Dev_Web_API_Key

# npm commands

npm run supabase:use:dev
npm run supabase:use:prod
npm run env:use:dev
npm run env:use:prod
npm run supabase:link:dev
npm run supabase:deploy

# build commands

npm run build:test:ios
npm run build:test:android
npm run build:prod:ios
npm run build:prod:android

# 추가 필요 작업 (프로덕션 배포 전):

- Prod Supabase도 동일하게 처리: npm run env:use:prod && supabase db push
- Prod에서도 익명 로그인 활성화 필요 (Dashboard → Authentication → Providers → Anonymous)
- 버전별 DB/Edge Function 변경사항 → Doc/Deployment.md 참고 및 업데이트

# 잠수함 패치

npx eas update --channel production --message "fix: task time/color persistence, card
delete animation"
