디디용달 배포 체크리스트

1. index.html
- meta name="kakao-javascript-key" 의 값이 실제 등록한 JavaScript 키와 같은지 확인
- html 태그에 data-kakao-js-key 같은 오래된 키가 남아 있지 않은지 확인
- 카카오 SDK script 태그를 index.html에 직접 넣지 말 것 (app.js가 동적 로드)

2. 카카오 개발자 콘솔
- 해당 JavaScript 키의 JavaScript SDK 도메인에 실제 접속 주소가 등록되어 있어야 함
- 예: https://ddlogi-yd.netlify.app
- 실제 접속 주소와 등록 주소가 한 글자라도 다르면 차단됨

3. Netlify 환경변수
- KAKAO_MOBILITY_REST_KEY 설정
- 변경 후 재배포

4. 테스트 순서
- 배포 후 강력 새로고침
- 주소 2개 입력 후 거리 계산
- 콘솔에서 Kakao SDK preload failed 문구가 없는지 확인
- 도로거리 함수 실패 시에도 보정거리로 계산되는지 확인

5. 주의
- JavaScript 키와 REST 키를 혼동하지 말 것
- index.html, app.js, netlify/functions/kakaoDirections.js 세 파일이 세트로 배포되어야 함
