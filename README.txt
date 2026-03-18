Netlify 환경변수
- KAKAO_MOBILITY_REST_KEY : 카카오 모빌리티 REST API 키

설명
- 카카오 JS SDK로 주소를 좌표로 변환
- Netlify function kakaoDirections로 도로거리 계산
- 함수 호출이 실패하면 직선거리 x 1.25 보정값으로 자동 fallback
- 거리 요금 수식: 10km까지 km당 2,000원 / 10km 초과분 km당 1,550원
- 기사 도움: 출발지 15,000원 / 도착지 15,000원
