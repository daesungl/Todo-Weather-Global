# 플로우 카드 공유 기능 기술 명세서 (Tech Spec)

## 1. 개요
* **목적**: 친구 및 지인들과 같은 플로우(Todo/일정)를 함께 보고 편집할 수 있는 실시간 공유 기능 구현.
* **주요 기능**: 계정 시스템(Auth), 실시간 동기화, 충돌 처리, 플로우 간 권한 분리.
* **기반 기술**: React Native (Expo), Firebase Authentication, Firebase Firestore.

## 2. 시스템 아키텍처 및 DB 스키마 (Firestore)
NoSQL의 컬렉션(Collection) 및 하위 컬렉션(Sub-collection) 구조를 활용하여 권한 관리와 실시간 동기화(onSnapshot) 효율을 높입니다.

### 2.1. Users Collection (사용자 계정 및 친구 관리)
`/users/{userId}`
```json
{
  "uid": "string",
  "displayName": "string",
  "email": "string",
  "profileImage": "url",
  "createdAt": "timestamp",
  "friends": ["uid1", "uid2"] // 향후 확장: /friend_requests 컬렉션 고려
}
```

### 2.2. Flows Collection (플로우 메인 정보)
`/flows/{flowId}`
```json
{
  "flowId": "string",
  "title": "string",
  "ownerId": "string", // 플로우 최초 생성자
  "createdAt": "timestamp",
  "updatedAt": "timestamp", // 마지막 수정 시간
  "themeColor": "string",
  "version": 1 // 낙관적 동시성 제어(OCC)를 위한 버전 관리
}
```

### 2.3. Flow Members Collection (권한 관리)
`/flows/{flowId}/members/{userId}`
보안 규칙(Security Rules) 적용 및 참여자 목록 조회를 위해 하위 컬렉션으로 분리합니다.
```json
{
  "userId": "string",
  "role": "owner" | "editor" | "viewer",
  "joinedAt": "timestamp"
}
```

### 2.4. Flow Tasks Collection (개별 플로우 카드)
`/flows/{flowId}/tasks/{taskId}`
동시 수정 시 덮어쓰기 충돌을 방지하기 위해 플로우 전체를 통째로 저장하지 않고 개별 태스크를 문서(Document)로 분리합니다.
```json
{
  "taskId": "string",
  "title": "string",
  "status": "todo" | "in_progress" | "done",
  "order": 1000, // 정렬 값 (LexoRank 등 간격 기반 정렬 추천)
  "lastModifiedBy": "userId",
  "updatedAt": "timestamp" // serverTimestamp() 활용
}
```

## 3. 실시간 동기화 및 충돌 처리 전략
1. **필드/문서 단위 업데이트**: `tasks`를 개별 문서로 분리하여 A 사용자와 B 사용자가 서로 다른 카드를 수정할 때 충돌이 발생하지 않도록 합니다.
2. **충돌 처리 전략 (LWW - Last Write Wins)**:
   * Firestore의 `FieldValue.serverTimestamp()`를 활용하여 가장 늦게 서버에 도착한 쓰기 요청을 반영합니다.
   * 복잡한 CRDT나 OT 대신 구현이 간단하고 일반적인 Todo 앱에 적합한 방식입니다.
3. **낙관적 UI 업데이트 (Optimistic Update)**:
   * 클라이언트(앱)에서 데이터 변경 시 로컬 UI의 상태를 먼저 즉시 업데이트합니다.
   * 백그라운드에서 Firestore 업데이트를 수행하며, 실패 시 로컬 상태를 이전으로 롤백합니다.

## 4. API 데이터 플로우 (클라이언트 로직)
1. **데이터 구독**:
   * 컴포넌트 마운트 시 `firestore().collection('flows').doc(flowId).collection('tasks').onSnapshot(...)`을 호출하여 실시간 리스너 등록.
   * 이벤트 수신 시 상태 관리 스토어(Redux 등) 업데이트.
2. **Firestore Security Rules**:
   * `read`: `members` 컬렉션에 해당 사용자의 `userId`가 존재하는지 확인.
   * `write`: `role`이 `owner` 또는 `editor`인지 확인.

## 5. 구현 로드맵 (구현 시 참고용)
* **Phase 1 (계정 및 기반 설정)**: Firebase Auth 연동, `Users` 컬렉션 구성, 기본 로그인/프로필 UI 구현.
* **Phase 2 (공유 모델링 및 마이그레이션)**: 기존 로컬 저장소 데이터를 Firestore 기반으로 변경, 실시간 리스너(onSnapshot) 연동.
* **Phase 3 (초대 및 권한 로직)**: 딥링크(또는 초대 코드)를 통한 플로우 참여, 권한(Viewer/Editor)에 따른 UI 분기 처리(수정 버튼 비활성화 등).