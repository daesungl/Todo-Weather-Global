# 투두날씨 글로벌 프로젝트 코딩 가이드라인 (CODING_GUIDELINES.md)

이 문서는 투두날씨 프로젝트를 개발하면서 겪었던 기술적 이슈와 해결책을 바탕으로, 동일한 실수를 반복하지 않고 프로젝트의 품질을 유지하기 위한 코딩 규칙을 정의합니다.

---

## 1. 플랫폼별 분기 처리 (Platform-Specific Logic)

React Native/Expo 환경에서 iOS와 안드로이드는 동작 방식이 다를 수 있습니다. 이를 명확히 처리하기 위해 다음 원칙을 따릅니다.

### ✅ 권장 사항
*   **`Platform` 모듈 사용:** `react-native`에서 제공하는 `Platform` 모듈을 사용하세요.
*   **파일 분리:** 로직이나 UI 구성이 크게 다를 경우 `.ios.js`와 `.android.js` 파일로 분리하는 것이 가장 깔끔합니다.
*   **`Platform.select` 활용:** 스타일이나 간단한 옵션값 분기에 유리합니다.
    ```javascript
    const styles = StyleSheet.create({
      container: {
        paddingTop: Platform.select({ ios: 20, android: 0 }),
      },
    });
    ```

### ❌ 금지 사항
*   **모호한 전역 변수:** `if (__ios)`와 같이 출처가 불분명하거나 전역 선언된 플래그 사용을 지양하세요. (가독성이 떨어지고 버그의 원인이 됩니다.)

---

## 2. iOS 전용 체크리스트 (Critical for iOS)

최근 경험한 iOS 이슈들을 방지하기 위한 핵심 규칙입니다.

### 📍 App Tracking Transparency (ATT) & 광고
*   **권한 요청 순서:** AdMob 광고를 로드하기 전에 반드시 ATT 권한 요청(`expo-tracking-transparency`)이 완료되어야 합니다.
*   **프리즈(Freeze) 방지:** iOS에서 보상형 광고나 전면 광고를 띄울 때, **현재 열려 있는 모달(Modal)을 먼저 닫고 약 500ms~1000ms의 지연 시간**을 준 뒤 광고를 호출해야 UI가 얼어버리는 현상을 방지할 수 있습니다.

### 📍 빌드 및 설정 (Podfile)
*   **C++ 표준 준수:** iOS 프로덕션 빌드 시 `fmt` 라이브러리 등에서 발생하는 컴파일 에러를 방지하기 위해 `Podfile`에서 C++20 설정을 강제해야 할 때가 있습니다. (가급적 Expo Config Plugin을 통해 관리하세요.)

---

## 3. UI/UX 및 디자인 시스템

프로젝트의 프리미엄 느낌(Glassmorphism)을 유지하기 위한 가이드입니다.

*   **Glassmorphism 효과:** `Colors.glass`와 `rgba(255, 255, 255, 0.4)` 등을 활용하여 투명도를 조절하고, 배경에 `blur` 효과를 적절히 섞어 사용하세요.
*   **그림자(Shadow):** 
    *   **iOS:** `shadowColor`, `shadowOpacity` 등으로 정교하게 구현.
    *   **Android:** `elevation`을 사용하되, iOS와 느낌이 비슷하도록 보정 필수.
*   **SafeArea:** `SafeAreaView`는 하위 호환성 버그나 레이아웃 제약이 많으므로 사용하지 않습니다. 대신 `expo-constants`의 `Constants.statusBarHeight`를 사용하여 상단 여백을 직접 제어하세요.
50:     ```javascript
51:     style={{ paddingTop: Constants.statusBarHeight }}
52:     ```

---

## 4. 다국어 지원 (i18n)

글로벌 버전이므로 모든 텍스트는 `t()` 함수를 통해 관리합니다.

*   **위치:** `src/i18n/` 하위의 JSON 파일에 정의.
*   **사용법:** `const { t } = useTranslation();` 후 `t('common.appName')` 방식으로 호출.
*   **주의:** 하드코딩된 문자열은 코드 리뷰 시 반려 대상입니다.

---

## 5. 성능 및 상태 관리

*   **이미지 최적화:** 큰 이미지는 가급적 지양하고, `expo-image` 등을 활용해 캐싱 처리하세요.
*   **비동기 처리:** 광고 로딩, 날씨 API 호출 시 `loading` 상태를 명확히 처리하여 사용자에게 빈 화면이 노출되지 않도록 합니다.

---

## 6. 날씨 상세 페이지 및 데이터 표준화 (Weather Detail & Normalization)

데이터 소스(기상청, OpenWeather 등)에 관계없이 일관된 사용자 경험을 제공하기 위한 설계 원칙입니다.

### 📍 데이터 정규화 (Normalization)
*   **통합 객체 구조:** 모든 날씨 API 응답은 `src/services/weather/WeatherService.js`에서 공통 객체 구조로 변환되어 UI에 전달되어야 합니다.
*   **필수 포함 데이터:**
    *   `current`: 온도, 체감온도, 상태키값(`condKey`), 습도, 풍속 등
    *   `location`: `placeName`(장소명, 예: 강남역), `addressName`(주소명, 예: 서울특별시 강남구 역삼동)
    *   `forecasts`: 시간별/일별 예보 배열
    *   `source`: 데이터 출처 정보 (사용자에게 고지용)

### 📍 날씨 상세 UI 구성 (Header Policy)
*   **헤더 레이아웃:** 상세 페이지 상단 헤더에는 **장소명(`placeName`) | 주소명(`addressName`)** 형식을 사용하여 사용자가 현재 어디의 날씨를 보고 있는지 명확하게 인지시켜야 합니다.
*   **가시성:** 배경 그라데이션이 있더라도 텍스트 가독성을 확보하기 위해 적절한 텍스트 섀도우나 대비를 적용합니다.

### 📍 모듈형 블록 구조 (Component Arch)
*   상세 페이지는 데이터 가용 여부에 따라 유연하게 UI 블록(시간별 예보, 상세 수치 그리드, 주간 예보 등)이 렌더링되도록 구현합니다. 특정 데이터(예: 자외선)가 소스에서 제공되지 않을 경우, 레이아웃이 깨지지 않고 자연스럽게 해당 블록만 생략되거나 기본값이 표시되어야 합니다.

---

## 🎨 UX & Interaction Principles

사용자에게 프리미엄하고 기민한(Snappy) 반응성을 제공하기 위한 핵심 인터랙션 원칙입니다.

### 📍 즉시 네비게이션 (Immediate Navigation)
*   **원칙:** 데이터 로딩 완료를 기다리지 않고 즉시 화면을 전환합니다.
*   **구현:** 
    *   날씨 아이콘이나 지역 카드 클릭 시 `await WeatherService...`를 하지 않고 즉시 `navigation.navigate`를 호출합니다.
    *   상세 데이터가 없는 경우 기본적인 좌표(`lat`, `lon`)와 이름만 전달하며, 상세 화면(`WeatherDetailScreen`) 내부의 `useEffect`에서 부족한 데이터를 비동기로 로딩합니다.
    *   사용자가 "기다린다"는 느낌을 받지 않도록 하는 것이 최우선입니다.

### 📍 터치 응답성 및 히트박스 (Touch Responsiveness)
*   **GHButton 활용:** 단순 클릭이 아닌 인터랙티브한 반응이 필요한 모든 요소에는 `src/components/common/GHButton` (또는 프로젝트 내 최적화된 버튼 컴포넌트)을 사용합니다.
*   **히트박스 확장 (`hitSlop`):** 아이콘 위주의 작은 버튼은 사용자의 손가락 크기를 고려하여 최소 `20px` ~ `25px` 이상의 `hitSlop`을 상하좌우로 부여합니다.
*   **이벤트 간섭 방지:** 버튼 내부의 아이콘이나 텍스트에는 `pointerEvents="none"`을 적용하여 터치 이벤트가 부모 버튼으로 누락 없이 전달되게 합니다.

### 📍 햅틱 피드백 (Haptic Feedback)
*   **적용 시점:** 
    *   페이지 이동(날씨 상세 진입 등) 시작 시점
    *   주요 설정 변경 또는 삭제/저장 성공 시
    *   모달이 열리거나 닫히는 시점
*   **스타일:** `Haptics.ImpactFeedbackStyle.Light`를 기본으로 사용하되, 중요도에 따라 `Medium` 또는 `Heavy`를 적절히 섞어 사용합니다.

### 📍 브랜딩 및 공유 레이아웃 (Branding Policy)
*   **스플래시/아이콘 가시성:** 배경색(`app.json`의 `backgroundColor`)과 로고/텍스트 간의 대비를 높여 작은 사이즈에서도 명확히 보이도록 유지합니다.
*   **공유용 워터마크:** 플로우 공유 이미지 등 외부로 노출되는 화면 하단에는 `TODO WEATHER | Your smart event-based weather planner` 문구를 은은하게(opacity 0.6 내외) 배치하여 앱의 정체성을 유지합니다.

---

## 🏗️ Structural & Maintenance Principles

앱의 규모가 커짐에 따라 코드의 가독성과 유지보수성을 유지하기 위한 구조적 가이드라인입니다.

### 📍 컴포넌트 분리 (Component Decomposition)
*   **원칙:** 하나의 파일이 너무 비대해지지 않도록 기능을 단위별로 쪼갭니다.
*   **기준:** 특정 스크린 파일(예: `FlowScreen.js`)이 800행을 초과하거나, 내부 모달/컴포넌트 로직이 복잡해질 경우 `src/components/` 하위로 분리합니다.
*   **분리 대상:** 
    *   복잡한 모달 (`SearchModal`, `EditStepModal` 등)
    *   반복되는 리스트 아이템 (`StepRow`, `RegionCard` 등)
    *   독립적인 레이아웃 블록 (`HeroSection`, `WeatherGrid` 등)

### 📍 비즈니스 로직의 추상화 (Custom Hooks)
*   **원칙:** UI와 비즈니스 로직을 분리하여 재사용성을 높이고 코드를 간결하게 유지합니다.
*   **구현:** API 호출, 복잡한 상태 계산, 구독 권한 체크 등은 `src/hooks/` 폴더에 커스텀 훅(예: `useWeather`, `useSubscription`, `useTaskSync`)으로 만들어 관리합니다.

### 📍 스타일 및 테마 관리
*   **공통 테마:** 색상, 타이포그래피, 간격 등은 반드시 `src/theme/`에 정의된 토큰을 사용합니다.
*   **스타일 분리:** 특정 컴포넌트 내의 `StyleSheet`가 너무 길어질 경우, `ComponentName.styles.js` 파일로 분리하여 관리하는 것을 권장합니다.

---

> [!TIP]
> 새로운 기능을 개발할 때 "이것이 충분히 빠르게 반응하는가?"와 "터치가 시원시원한가?"를 항상 자문해 보세요. 기술적인 완결성만큼이나 사용자가 느끼는 **'부드러움'**이 이 앱의 핵심 가치입니다.

> [!TIP]
> 새로운 라이브러리를 추가하거나 네이티브 설정을 변경할 때는 반드시 **iOS와 안드로이드 양쪽 기기(또는 시뮬레이터)에서 모두 테스트**를 완료해야 합니다.

### 4. Data Reliability & Validation
- **Validation Layer**: Always validate external API responses before caching or updating UI. Filter extreme outliers (e.g., ±90°C weather) and ensure minimum data completeness.
- **Retry Strategy**: Implement at least one automatic retry with a slight delay for transient API failures or validation errors before falling back to alternative sources.
- **Graceful Fallback**: When a primary data source fails validation, attempt secondary sources to ensure service availability.
