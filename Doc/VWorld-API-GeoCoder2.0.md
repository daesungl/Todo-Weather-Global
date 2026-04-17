주소를 좌표로 변환
좌표를 주소로 변환
소개
주소를 좌표로 변환하는 서비스를 제공합니다.
요청URL을 전송하면 지오코딩 서비스를 사용하실 수 있으며 일일 지오코딩 요청건수는 최대 40,000건 입니다.
단, API 요청은 실시간으로 사용하셔야 하며 별도의 저장장치나 데이터베이스에 저장할 수 없습니다.
주소정보를 좌표로 변환
https://api.vworld.kr/req/address?service=address&request=getCoord&key=인증키&[요청파라미터]
사용예제
클립보드에 복사

요청URL

Java

Python

JS(AJAX)

R
https://api.vworld.kr/req/address?
service=address&request=getcoord&version=2.0&crs=epsg:4326&address=%ED%9A%A8%EB%A0%B9%EB%A1%9C72%EA%B8%B8%2060
&refine=true&simple=false&format=xml&type=road&key=[KEY]
					
요청파라미터
파라미터	선택	설명	유효값
service	O/1	요청 서비스명	address(기본값)
version	O/1	요청 서비스 버전	2.0(기본값)
request	M/1	요청 서비스 오퍼레이션	GetCoord
key	M/1	발급받은 api key	
format	O/1	응답결과 포맷	json(기본값), xml
errorFormat	O/1	에러 응답결과 포맷, 생략 시 format파라미터에 지정된 포맷으로 설정	json, xml
type	M/1	검색 주소 유형	PARCEL : 지번주소
ROAD : 도로명주소
address	M/1	검색 키워드
지번주소 : 법정동 + 지번까지 입력
ex) 관양동 1588-8
ex) 경기도 안양시 동안구 관양동 1588-8

도로명주소 : 시군구 + 도로명 + 건물번호 입력
ex) 부림로169번길 22
ex) 안양시 동안구 부림로169번길 22	
refine	O/1	정제되어 있는 주소의 경우 false로 설정하여 주소 정제 없이 빠르게 처리	true(기본값), false
simple	O/1	응답결과 간략 출력 여부	true, false(기본값)
crs	O/1	응답결과 좌표계	지원좌표계 참고,
EPSG:4326(기본값)
callback	O/1	format값이 json일 경우 callback함수를 지원합니다.	
결과응답
항목명	타입	설명
service	 	요청 서비스 정보 Root
 	name	문자	요청 서비스명
 	version	숫자	요청 서비스 버전
 	operation	문자	요청 서비스 오퍼레이션 이름
 	time	숫자	응답결과 생성 시간
status	문자	처리 결과의 상태 표시, 유효값 : OK(성공), NOT_FOUND(결과없음), ERROR(에러)
input	 	입력 주소 정보 Root, 생략조건 : simple=true
 	type	문자	입력 주소 유형(ROAD, PARCEL)
 	address	문자	입력 주소
refined	 	정제 주소 정보 Root, 생략조건 : refine=false or simple=true
 	text	문자	전체 주소 텍스트
 	structure	 	구조화된 주소 Root
 	level0	문자	국가
 	level1	문자	시·도
 	level2	문자	시·군·구
 	level3	문자	(일반구)구
 	level4L	문자	(도로)도로명, (지번)법정읍·면·동 명
 	level4A	문자	(도로)행정읍·면·동 명, (지번)지원안함
 	level4AC	문자	(도로)행정읍·면·동 코드, (지번)지원안함
 	level5	문자	(도로)길, (지번)번지
 	detail	문자	상세주소
result	 	응답결과 Root
 	crs	문자	응답결과 좌표계
 	point	 	주소 좌표 Root
 	x	숫자	x좌표
 	y	숫자	y좌표
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
오픈API 목록 돌아가기
------
주소를 좌표로 변환
좌표를 주소로 변환
소개
좌표를 주소로 변환하는 서비스를 제공합니다.
요청URL을 전송하면 지오코딩 서비스를 사용하실 수 있으며 일일 지오코딩 요청건수는 무제한으로 제공됩니다.
단, API 요청은 실시간으로 사용하셔야 하며 별도의 저장장치나 데이터베이스에 저장할 수 없습니다.
좌표를 주소정보로 변환
https://api.vworld.kr/req/address?service=address&request=getAddress&key=인증키&[요청파라미터]
사용예제
클립보드에 복사

요청URL

Java

Python

JS(AJAX)

R
https://api.vworld.kr/req/address?
service=address&request=getAddress&version=2.0&crs=epsg:4326&point=126.978275264,37.566642192
&format=xml&type=both&zipcode=true&simple=false&key=[KEY]
					
요청파라미터
파라미터	선택	설명	유효값
service	O/1	요청 서비스명	address(기본값)
version	O/1	요청 서비스 버전	2.0(기본값)
request	M/1	요청 서비스 오퍼레이션	GetAddress
key	M/1	발급받은 api key	
format	O/1	응답결과 포맷	json(기본값), xml
errorFormat	O/1	에러 응답결과 포맷, 생략 시 format파라미터에 지정된 포맷으로 설정	json, xml
point	M/1	주소를 찾을 좌표	포맷 : x,y
crs	O/1	응답결과 좌표계	지원좌표계표 참고,
EPSG:4326(기본값)
type	O/1	검색 주소 유형, 도로주소, 지번주소 또는 둘다 요청할 수 있습니다.	PARCEL : 지번주소
ROAD : 도로명주소
BOTH(기본값) : 도로명주소, 지번주소
zipcode	O/1	우편번호 반환 여부	true(기본값), false
simple	O/1	응답결과 간략 출력 여부	true, false(기본값)
callback	O/1	format값이 json일 경우 callback함수를 지원합니다.	 
결과응답
항목명	타입	설명
service	 	요청 서비스 정보 Root
name	문자	요청 서비스명
version	숫자	요청 서비스 버전
operation	문자	요청 서비스 오퍼레이션 이름
time	숫자	응답결과 생성 시간
status	문자	처리 결과의 상태 표시, 유효값 : OK(성공), NOT_FOUND(결과없음), ERROR(에러)
input	문자	입력 정보 Root, 생략조건 : simple=true
point	 	주소 좌표 Root
x	숫자	x좌표
y	숫자	y좌표
crs	문자	입력에 적용되는 좌표계
type	문자	요청한 주소 유형(ROAD, PARCEL, BOTH)
result	 	응답결과 Root
item	 	출력 주소 정보 Root
zipcode	숫자	우편번호, 생략조건 : zipcode=false
type	문자	주소 유형(ROAD, PARCEL), 생략조건 : simple=true
text	문자	전체 주소 텍스트
structure	 	구조화된 주소 Root
level0	문자	국가
level1	문자	시·도
level2	문자	시·군·구
level3	문자	(일반구)구
level4L	문자	(도로)도로명, (지번)법정읍·면·동 명
level4LC	문자	(도로)도로코드, (지번)법정읍·면·동 코드
level4A	문자	(도로)행정읍·면·동 명, (지번)지원안함
level4AC	문자	(도로)행정읍·면·동 코드, (지번)지원안함
level5	문자	(도로)길, (지번)번지
detail	문자	상세주소
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
