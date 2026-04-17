소개
검색엔진 기반 주소(구 주소, 도로명주소)와 국가관심지점(명칭/장소) 검색 API입니다.
요청 URL
https://api.vworld.kr/req/search?key=인증키&[검색API 요청파라미터]
요청파라미터
파라미터	선택	설명	유효값
service	O/1	요청 서비스명	search(기본값)
version	O/1	요청 서비스 버전	2.0(기본값)
request	M/1	요청 서비스 오퍼레이션	search
key	M/1	발급받은 api key	 
format	O/1	응답결과 포맷	json(기본값), xml
errorFormat	O/1	에러 응답결과 포맷, 생략 시 format파라미터에 지정된 포맷으로 설정	json, xml
size	O/1	한 페이지에 출력될 응답결과 건수	숫자
기본값 : 10
최소값 : 1
최대값 : 1000
page	O/1	응답결과 페이지 번호	숫자
기본값 : 1
query	M/1	검색 키워드
예) 장소(건물명, 시설명, 기관/상호명 등) : 공간정보산업진흥원
주소 : 판교로 344(도로주소), 삼평동 688-1(지번주소)
행정구역 : 삼평동
도로명 : 판교로	 
type	M/1	검색 대상	PLACE : 장소
ADDRESS : 주소
DISTRICT : 행정구역
ROAD : 도로명
category	장소 : O/n
주소 : M/1
행정구역 : M/1	검색 대상에 따른 하위 유형입니다.
하위 유형을 지정하려면 반드시 검색 대상(type)을 정해야 합니다.
검색 대상(type)에 따라 유효값이 달라집니다.
검색 대상(type)값이 address 또는 district일 경우, category파라미터는 필수값입니다.	장소 : 장소분류코드
[다운받기]
주소 : ROAD(도로), PARCEL(지번)
행정구역 : L1(시도), L2(시군구), L3(일반구), L4(읍면동)
bbox	O/1	검색 영역 내의 대상만 검색
포맷 : minx,miny,maxx,maxy	 
crs	O/1	응답결과 좌표계
응답결과와 bbox, center 파라미터에 적용됩니다.	지원좌표계표 참고,
EPSG:4326(기본값)
callback	O/1	format값이 json일 경우 callback함수를 지원합니다.	 
사용예제
장소(PLACE) 검색 예제
클립보드에 복사
https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:900913&bbox=14140071.146077,4494339.6527027,14160071.146077,4496339.6527027&size=10&page=1&query=공간정보산업진흥원&type=place&format=json&errorformat=json&key=[KEY]
주소(ADDRESS) 검색 예제
클립보드에 복사
https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:900913&bbox=14140071.146077,4494339.6527027,14160071.146077,4496339.6527027&size=10&page=1&query=성남시 분당구 판교로 242&type=address&category=road&format=json&errorformat=json&key=[KEY]
행정구역(DISTRICT) 검색 예제
클립보드에 복사
https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:900913&bbox=14140071.146077,4494339.6527027,14160071.146077,4496339.6527027&size=10&page=1&query=삼평동&type=district&category=L4&format=json&errorformat=json&key=[KEY]
도로명(ROAD) 검색 예제
클립보드에 복사
https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:900913&bbox=14140071.146077,4494339.6527027,14160071.146077,4496339.6527027&size=10&page=1&query=판교로&type=road&format=json&errorformat=json&key=[KEY]
응답결과
장소 응답결과 (type=place인 경우)
항목명	타입	설명
service	문자	요청 서비스 정보 Root
 	name	문자	요청 서비스명
 	version	숫자	요청 서비스 버전
 	operation	문자	요청 서비스 오퍼레이션 이름
 	time	숫자	응답결과 생성 시간(단위 : ms)
status	문자	처리 결과의 상태 표시, 유효값 : OK(성공), NOT_FOUND(결과없음), ERROR(에러)
record	 	응답결과 건수 정보 Root
 	total	숫자	전체 결과 건수
 	current	숫자	현재 반환된 결과 건수
page	 	응답결과 페이지 정보 Root
 	total	숫자	전체 페이지 수
 	current	숫자	현재 페이지 번호
 	size	숫자	페이지 당 반환되는 결과 건수
result	 	응답결과 Root
 	crs	문자	응답결과 좌표계
 	type	문자	요청검색 대상
 	items	 	응답결과 목록 Root
 	item	 	응답결과 상세정보 Root, 응답결과가 여러건일 경우 반복 출력
 	id	문자	ID
 	title	문자	이름(업체,기관명)
 	category	문자	장소 분류 유형
 	address	 	주소 Root
 	road	문자	도로 주소
 	parcel	문자	지번 주소
 	point	 	주소 좌표 Root
 	x	숫자	x좌표
 	y	숫자	y좌표
주소 응답결과 (type=address인 경우)
항목명	타입	설명
service	 	요청 서비스 정보 Root
 	name	문자	요청 서비스명
 	version	숫자	요청 서비스 버전
 	operation	문자	요청 서비스 오퍼레이션 이름
 	time	숫자	응답결과 생성 시간
status	문자	처리 결과의 상태 표시, 유효값 : OK(성공), NOT_FOUND(결과없음), ERROR(에러)
record		응답결과 건수 정보 Root
 	total	숫자	전체 결과 건수
 	current	숫자	현재 반환된 결과 건수
page		응답결과 페이지 정보 Root
 	total	숫자	전체 페이지 수
 	current	숫자	현재 페이지 번호
 	size	숫자	페이지 당 반환되는 결과 건수
result		응답결과 Root
 	crs	문자	응답결과 좌표계
 	type	문자	요청검색 대상
 	items		응답결과 목록 Root
 	item		응답결과 상세정보 Root, 응답결과가 여러건일 경우 반복 출력
 	id	문자	주소의 ID(PNU 지번 코드)
 	address		주소 Root
 	zipcode	숫자	우편번호
 	category	문자	요청한 주소의 유형
 	road	문자	도로 주소
 	parcel	문자	지번 주소
 	bldnm	문자	건물명 (단, category=road일때만 출력)
 	bldnmdc	문자	건물명 상세정보(단, category=road일때만 출력)
 	point		주소 좌표 Root
 	x	숫자	x좌표
 	y	숫자	y좌표
행정구역 응답결과 (type=district인 경우)
항목명	타입	설명
service	 	요청 서비스 정보 Root
 	name	문자	요청 서비스명
 	version	숫자	요청 서비스 버전
 	operation	문자	요청 서비스 오퍼레이션 이름
 	time	숫자	응답결과 생성 시간
status	문자	처리 결과의 상태 표시, 유효값 : OK(성공), NOT_FOUND(결과없음), ERROR(에러)
record		응답결과 건수 정보 Root
 	total	숫자	전체 결과 건수
 	current	숫자	현재 반환된 결과 건수
page		응답결과 페이지 정보 Root
 	total	숫자	전체 페이지 수
 	current	숫자	현재 페이지 번호
 	size	숫자	"페이지 당 반환되는 결과 건수
result		응답결과 Root
 	crs	문자	응답결과 좌표계
 	type	문자	요청검색 대상
 	items		응답결과 목록 Root
 	item		응답결과 상세정보 Root, 응답결과가 여러건일 경우 반복 출력
 	id	문자	주소의 ID(행정구역코드)
 	title	문자	행정구역명
 	geometry	문자	요청한 행정구역의 도로구간정보 파일(gml,geojson포맷)호출
 	point		주소 좌표 Root
 	x	숫자	x좌표
 	y	숫자	y좌표
도로명 응답결과 (type=road인 경우)
항목명	타입	설명
service	 	요청 서비스 정보 Root
 	name	문자	요청 서비스명
 	version	숫자	요청 서비스 버전
 	operation	문자	요청 서비스 오퍼레이션 이름
 	time	숫자	응답결과 생성 시간
status	문자	처리 결과의 상태 표시, 유효값 : OK(성공), NOT_FOUND(결과없음), ERROR(에러)
record		응답결과 건수 정보 Root
 	total	숫자	전체 결과 건수
 	current	숫자	현재 반환된 결과 건수
page		응답결과 페이지 정보 Root
 	total	숫자	전체 페이지 수
 	current	숫자	현재 페이지 번호
 	size	숫자	페이지 당 반환되는 결과 건수
result		응답결과 Root
 	crs	문자	응답결과 좌표계
 	type	문자	요청검색 대상
 	items		응답결과 목록 Root
 	item		응답결과 상세정보 Root, 응답결과가 여러건일 경우 반복 출력
 	id	문자	주소의 ID(도로명코드)
 	title	문자	도로명
 	district	문자	도로를 포함하는 구역
 	geometry	문자	요청한 도로명의 도로구간정보 파일(gml,geojson포맷)호출
지원좌표계
좌표계	설명
WGS84 경위도	EPSG:4326
GRS80 경위도	EPSG:4019
Google Mercator	EPSG:3857, EPSG:900913
서부원점(GRS80)	EPSG:5180(50만), EPSG:5185
중부원점(GRS80)	EPSG:5181(50만), EPSG:5186
제주원점(GRS80, 55만)	EPSG:5182
동부원점(GRS80)	EPSG:5183(50만), EPSG:5187
동해(울릉)원점(GRS80)	EPSG:5184(50만), EPSG:5188
UTM-K(GRS80)	EPSG:5179
오류 응답결과
항목명	타입	설명
service	문자	요청 서비스 정보 Root
 	name	문자	요청 서비스명
 	version	숫자	요청 서비스 버전
 	operation	문자	요청 서비스 오퍼레이션 이름
 	time	숫자	응답결과 생성 시간
status	문자	처리 결과의 상태 표시, 유효값 : OK(성공), NOT_FOUND(결과없음), ERROR(에러)
error	문자	에러 정보 Root
 	level	숫자	에러 레벨
 	code	문자	에러 코드
 	text	문자	에러 메시지
오류메세지
코드	레벨	메세지	비고
PARAM_REQUIRED	1	필수 파라미터인 <%S1>가 없어서 요청을 처리할수 없습니다.	%S1 : 파라미터 이름
INVALID_TYPE	1	<%S1> 파라미터 타입이 유효하지 않습니다.
유효한 파라미터 타입 : <%S2>
입력한 파라미터 값 : <%S3>	%S1 : 파라미터 이름
%S2 : 유효한 파라미터 값의 유형
%S3 : 입력한 파라미터 값
INVALID_RANGE	1	<%S1> 파라미터의 값이 유효한 범위를 넘었습니다.
유효한 파라미터 타입 : <%S2>
입력한 파라미터 값 : <%S3>	%S1 : 파라미터 이름
%S2 : 유효한 파라미터 값의 범위
%S3 : 입력한 파라미터 값
INVALID_KEY	2	등록되지 않은 인증키입니다.	 
INCORRECT_KEY	2	인증키 정보가 올바르지 않습니다.
(ex. 인증키 발급 시 입력한 도메인이 다를경우)	 
UNAVAILABLE_KEY	2	임시로 인증키를 사용할 수 없는 상태입니다.	 
OVER_REQUEST_LIMIT	2	서비스 사용량이 일일 제한량을 초과하여 더 이상 서비스를 사용할 수 없습니다.	 
SYSTEM_ERROR	3	시스템 에러가 발생하였습니다.	 
UNKNOWN_ERROR	3	알 수 없는 에러가 발생하였습니다.	 