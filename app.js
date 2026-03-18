(() => {
  'use strict';

  const PHONE_NUMBER = '01075416143';
  const HELPER_FEE = 15000;
  const BASE_VEHICLE_FEE = 30000;
  const KAKAO_READY_TIMEOUT = 15000;
  const KAKAO_SDK_BASE = 'https://dapi.kakao.com/v2/maps/sdk.js';

  const state = {
    startAddress: '',
    endAddress: '',
    distanceKm: 0,
    distanceMeta: '카카오 주소 기준으로 계산됩니다.',
    selected: {},
    helperFrom: false,
    helperTo: false,
    lastOpenedSize: null,
  };

  const ITEM_GROUPS = {
    small: {
      title: '소형짐',
      copy: '혼자 들 수 있지만 승용차로 옮기기 애매한 짐들이에요.',
      items: [
        ['리빙박스', '정리박스, 수납박스'],
        ['이민가방 / 대형가방', '대형 여행가방 포함'],
        ['컴퓨터 본체', '데스크톱 본체'],
        ['모니터', '개별 모니터'],
        ['프린터', '가정용 / 소형'],
        ['선풍기', '스탠드형 포함'],
        ['소형 공기청정기', '일반 가정용'],
        ['전자레인지', '소형 가전'],
        ['청소기', '유선 / 무선'],
        ['소형 선반', '작은 조립 선반'],
        ['접이식 의자', '캠핑 / 보조 의자'],
        ['소형 화분', '작은 화분류'],
      ],
    },
    medium: {
      title: '중형짐',
      copy: '승용차로는 어렵고 용달차가 필요한 대표 짐들이에요.',
      items: [
        ['책상', '소형 / 일반 책상'],
        ['행거', '이동형 행거'],
        ['싱글 매트리스', '1인용 매트리스'],
        ['TV', '중소형 TV'],
        ['TV다이', '작은 거실장'],
        ['서랍장', '소형 / 중형'],
        ['소형 냉장고', '원룸 냉장고'],
        ['소형 세탁기', '통돌이 / 소형'],
        ['자전거', '일반 자전거'],
        ['소형 소파', '1~2인용'],
        ['2인용 식탁', '소형 식탁'],
        ['책장', '일반 책장'],
      ],
    },
    large: {
      title: '대형짐',
      copy: '부피가 크고 작업 판단이 필요한 대형 짐들이에요.',
      items: [
        ['일반 냉장고', '가정용 냉장고'],
        ['드럼 세탁기', '대형 세탁기'],
        ['건조기', '스탠드형 포함'],
        ['퀸 / 킹 매트리스', '대형 매트리스'],
        ['침대 프레임', '분해 여부 별도 확인'],
        ['3인용 이상 소파', '거실용 대형 소파'],
        ['장롱', '의류장'],
        ['대형 서랍장', '부피 큰 수납장'],
        ['안마의자', '고중량'],
        ['4인 이상 식탁', '중대형 식탁'],
        ['쇼케이스 / 업소장비', '매장 장비류'],
        ['대형 화분', '무게 큰 화분'],
      ],
    },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    start: $('#startAddress'),
    end: $('#endAddress'),
    calcBtn: $('#calcDistanceBtn'),
    distanceText: $('#distanceText'),
    distanceMeta: $('#distanceMeta'),
    summary: $('#selectedItemsSummary'),
    helpFrom: $('#helpFrom'),
    helpTo: $('#helpTo'),
    distanceFeeText: $('#distanceFeeText'),
    helperFeeText: $('#helperFeeText'),
    totalFeeText: $('#totalFeeText'),
    smsBtn: $('#smsBtn'),
    modal: $('#itemsModal'),
    modalTitle: $('#modalTitle'),
    modalCopy: $('#modalCopy'),
    modalList: $('#modalList'),
    modalConfirmBtn: $('#modalConfirmBtn'),
    sizeCards: $$('.size-card'),
  };

  let kakaoReadyPromise = null;
  let modalPreviouslyFocused = null;

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getKakaoJsKey() {
    return (
      document.documentElement.getAttribute('data-kakao-js-key') ||
      $('meta[name="kakao-javascript-key"]')?.getAttribute('content') ||
      window.KAKAO_JS_KEY ||
      ''
    ).trim();
  }

  function buildKakaoSdkUrl() {
    const key = getKakaoJsKey();
    if (!key) return '';
    const url = new URL(KAKAO_SDK_BASE);
    url.searchParams.set('appkey', key);
    url.searchParams.set('libraries', 'services');
    url.searchParams.set('autoload', 'false');
    return url.toString();
  }

  function findKakaoScript() {
    return Array.from(document.scripts).find((script) =>
      String(script.src || '').includes('dapi.kakao.com/v2/maps/sdk.js')
    ) || null;
  }

  function waitForKakaoGlobals(timeoutMs = KAKAO_READY_TIMEOUT) {
    const started = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (window.kakao?.maps) {
          resolve(true);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  async function ensureKakaoScriptLoaded() {
    if (window.kakao?.maps) return true;

    let script = findKakaoScript();
    if (!script) {
      const sdkUrl = buildKakaoSdkUrl();
      if (!sdkUrl) {
        throw new Error('카카오 JavaScript 키가 비어 있어 SDK를 불러올 수 없어요.');
      }
      script = document.createElement('script');
      script.src = sdkUrl;
      script.async = true;
      script.setAttribute('data-kakao-sdk', 'true');
      document.head.appendChild(script);
    }

    const loaded = await Promise.race([
      new Promise((resolve, reject) => {
        const cleanup = () => {
          script.removeEventListener('load', onLoad);
          script.removeEventListener('error', onError);
        };
        const onLoad = () => {
          cleanup();
          resolve(true);
        };
        const onError = () => {
          cleanup();
          reject(new Error('카카오 SDK 스크립트 로드에 실패했어요. 도메인 등록 또는 키를 확인해줘.'));
        };
        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });
      }),
      waitForKakaoGlobals(KAKAO_READY_TIMEOUT),
    ]);

    if (!loaded && !window.kakao?.maps) {
      throw new Error('Kakao Maps SDK not loaded');
    }
    return true;
  }

  function ensureKakaoReady() {
    if (kakaoReadyPromise) return kakaoReadyPromise;

    kakaoReadyPromise = (async () => {
      await ensureKakaoScriptLoaded();

      if (!window.kakao?.maps) {
        throw new Error('Kakao Maps SDK not loaded');
      }

      await new Promise((resolve, reject) => {
        try {
          window.kakao.maps.load(() => {
            if (window.kakao?.maps?.services) resolve();
            else reject(new Error('Kakao services not available'));
          });
        } catch (error) {
          reject(error);
        }
      });

      return window.kakao;
    })().catch((error) => {
      kakaoReadyPromise = null;
      throw error;
    });

    return kakaoReadyPromise;
  }

  function formatWon(value) {
    return `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
  }

  function moveDistanceFee(km) {
    const d = Math.max(0, Number(km) || 0);
    const a = Math.min(d, 10) * 2000;
    const b = Math.max(0, d - 10) * 1550;
    return Math.round(BASE_VEHICLE_FEE + a + b);
  }

  function helperFee() {
    return (state.helperFrom ? HELPER_FEE : 0) + (state.helperTo ? HELPER_FEE : 0);
  }

  function totalFee() {
    return moveDistanceFee(state.distanceKm) + helperFee();
  }

  function cleanQuery(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeRegionText(value) {
    let v = cleanQuery(value);
    const swaps = [
      [/서울시/g, '서울'],
      [/인천시/g, '인천'],
      [/부산시/g, '부산'],
      [/대구시/g, '대구'],
      [/광주시/g, '광주'],
      [/대전시/g, '대전'],
      [/울산시/g, '울산'],
      [/세종시/g, '세종'],
      [/경기도/g, '경기'],
      [/강원도/g, '강원'],
      [/충청북도/g, '충북'],
      [/충청남도/g, '충남'],
      [/전라북도/g, '전북'],
      [/전라남도/g, '전남'],
      [/경상북도/g, '경북'],
      [/경상남도/g, '경남'],
      [/제주특별자치도/g, '제주'],
      [/제주도/g, '제주'],
    ];
    for (const [from, to] of swaps) v = v.replace(from, to);
    return cleanQuery(v);
  }

  function uniqueQueries(address) {
    const base = normalizeRegionText(address);
    const list = [base];
    const parts = base.split(' ').filter(Boolean);

    if (parts.length >= 2) {
      list.push(parts.slice(-2).join(' '));
      list.push(parts[parts.length - 1]);
      list.push(parts.slice(0, 2).join(' '));
    }
    if (parts.length >= 3) {
      list.push(parts.slice(0, 3).join(' '));
      list.push(parts.slice(1, 3).join(' '));
      list.push(parts.slice(-3).join(' '));
    }
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const prev = parts[parts.length - 2];
      list.push(`${prev} ${last}`);
      if (parts[0] && last) list.push(`${parts[0]} ${last}`);
    }

    return [...new Set(list.map(cleanQuery).filter(Boolean))];
  }

  function scorePlaceName(place, query) {
    const hay = [place.place_name, place.address_name, place.road_address_name]
      .filter(Boolean)
      .join(' ');
    const parts = cleanQuery(query).split(' ').filter(Boolean);

    let score = 0;
    for (const part of parts) {
      if (hay.includes(part)) score += part.length;
    }
    if (place.address_name && cleanQuery(place.address_name).includes(cleanQuery(query))) score += 20;
    if (place.road_address_name && cleanQuery(place.road_address_name).includes(cleanQuery(query))) score += 10;
    return score;
  }

  function haversineKm(a, b) {
    const R = 6371;
    const dLat = ((b.y - a.y) * Math.PI) / 180;
    const dLon = ((b.x - a.x) * Math.PI) / 180;
    const lat1 = (a.y * Math.PI) / 180;
    const lat2 = (b.y * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function getModalInputByName(name) {
    return Array.from($$('[data-item-input]', els.modalList)).find(
      (input) => input.getAttribute('data-item-input') === name
    ) || null;
  }

  function currentSelectedEntries() {
    return Object.entries(state.selected)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => `${name}${qty > 1 ? ` ×${qty}` : ''}`);
  }

  function currentSelectedCountForGroup(groupKey) {
    const items = ITEM_GROUPS[groupKey]?.items || [];
    return items.reduce((sum, [name]) => sum + (Number(state.selected[name]) || 0), 0);
  }

  function renderSizeCards() {
    els.sizeCards.forEach((card) => {
      const groupKey = card.dataset.size;
      const count = currentSelectedCountForGroup(groupKey);
      card.classList.toggle('active', count > 0);
      card.setAttribute('aria-pressed', count > 0 ? 'true' : 'false');

      let badge = $('.size-count', card);
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'size-count';
        card.appendChild(badge);
      }
      badge.textContent = count > 0 ? `${count}개 선택` : '미선택';
      badge.classList.toggle('filled', count > 0);
    });
  }

  function renderSummary() {
    const items = currentSelectedEntries();
    if (!items.length) {
      els.summary.textContent = '아직 선택한 짐이 없어요.';
      els.summary.classList.add('empty');
    } else {
      els.summary.textContent = items.join(', ');
      els.summary.classList.remove('empty');
    }
    renderSizeCards();
  }

  function renderFees() {
    els.distanceFeeText.textContent = formatWon(moveDistanceFee(state.distanceKm));
    els.helperFeeText.textContent = formatWon(helperFee());
    els.totalFeeText.textContent = formatWon(totalFee());
  }

  function renderDistance() {
    els.distanceText.textContent = state.distanceKm > 0 ? `${state.distanceKm.toFixed(1)} km` : '주소를 입력해주세요';
    els.distanceMeta.textContent = state.distanceMeta;
  }

  function renderAll() {
    renderDistance();
    renderSummary();
    renderFees();
  }

  function setCalcButtonLoading(isLoading) {
    els.calcBtn.disabled = isLoading;
    els.calcBtn.textContent = isLoading ? '계산 중...' : '거리 계산하기';
  }

  function validateForSms() {
    state.startAddress = cleanQuery(els.start.value);
    state.endAddress = cleanQuery(els.end.value);

    if (!state.startAddress || !state.endAddress) {
      alert('출발지와 도착지 주소를 먼저 입력해줘.');
      return false;
    }
    if (!(state.distanceKm > 0)) {
      alert('먼저 거리 계산을 해줘야 정확한 예약 문구가 들어가요.');
      return false;
    }
    return true;
  }

  async function geocode(geocoder, address) {
    const kakao = window.kakao;
    const queries = uniqueQueries(address);
    const places = new kakao.maps.services.Places();

    const tryAddressSearch = (query) =>
      new Promise((resolve, reject) => {
        geocoder.addressSearch(query, (result, status) => {
          if (status === kakao.maps.services.Status.OK && result?.[0]) {
            resolve({
              x: Number(result[0].x),
              y: Number(result[0].y),
              matchedAddress: result[0].address_name || result[0].road_address?.address_name || query,
              method: 'address',
            });
            return;
          }
          reject(new Error(`addressSearch failed: ${query}`));
        });
      });

    const tryKeywordSearch = (query) =>
      new Promise((resolve, reject) => {
        places.keywordSearch(query, (result, status) => {
          if (status === kakao.maps.services.Status.OK && result?.length) {
            const best = [...result].sort((a, b) => scorePlaceName(b, query) - scorePlaceName(a, query))[0];
            resolve({
              x: Number(best.x),
              y: Number(best.y),
              matchedAddress: best.address_name || best.road_address_name || best.place_name || query,
              method: 'keyword',
            });
            return;
          }
          reject(new Error(`keywordSearch failed: ${query}`));
        });
      });

    let lastError = null;

    for (const query of queries) {
      const rough = query.split(' ').length <= 2;
      const attempts = rough ? [tryKeywordSearch, tryAddressSearch] : [tryAddressSearch, tryKeywordSearch];
      for (const attempt of attempts) {
        try {
          return await attempt(query);
        } catch (error) {
          lastError = error;
        }
      }
    }

    throw lastError || new Error(`주소 검색 실패: ${address}`);
  }

  async function fetchRoadDistanceKm(origin, destination) {
    const params = new URLSearchParams({
      origin: `${origin.x},${origin.y}`,
      destination: `${destination.x},${destination.y}`,
    });

    const res = await fetch(`/.netlify/functions/kakaoDirections?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Road distance failed: ${res.status}`);
    }

    const data = await res.json();
    const meter = data?.routes?.[0]?.summary?.distance;
    if (!Number.isFinite(meter)) throw new Error('No road distance data');

    return Math.round((meter / 1000) * 10) / 10;
  }

  async function calculateDistance() {
    state.startAddress = cleanQuery(els.start.value);
    state.endAddress = cleanQuery(els.end.value);

    if (!state.startAddress || !state.endAddress) {
      alert('출발지와 도착지 주소를 모두 입력해줘.');
      return;
    }

    if (state.startAddress === state.endAddress) {
      state.distanceKm = 0.1;
      state.distanceMeta = '같은 주소로 입력되어 최소 거리 기준으로 계산했어요.';
      renderAll();
      return;
    }

    setCalcButtonLoading(true);
    state.distanceMeta = '주소를 확인하고 있어요.';
    renderDistance();

    try {
      await ensureKakaoReady();
      const geocoder = new window.kakao.maps.services.Geocoder();

      const origin = await geocode(geocoder, state.startAddress);
      const destination = await geocode(geocoder, state.endAddress);

      if (origin?.matchedAddress) {
        state.startAddress = origin.matchedAddress;
        els.start.value = origin.matchedAddress;
      }
      if (destination?.matchedAddress) {
        state.endAddress = destination.matchedAddress;
        els.end.value = destination.matchedAddress;
      }

      try {
        state.distanceKm = await fetchRoadDistanceKm(origin, destination);
        state.distanceMeta = `카카오 ${origin.method === 'keyword' || destination.method === 'keyword' ? '키워드/주소' : '주소'} 기준으로 계산됐어요.`;
      } catch (roadError) {
        console.warn('Road distance fallback:', roadError);
        const base = haversineKm(origin, destination);
        const adjusted = Math.max(base * 1.25, 0.1);
        state.distanceKm = Math.round(adjusted * 10) / 10;
        state.distanceMeta = '카카오 검색 좌표 기준 보정거리로 계산됐어요.';
      }

      renderAll();
    } catch (error) {
      console.error(error);
      state.distanceKm = 0;
      state.distanceMeta = error?.message?.includes('SDK') || error?.message?.includes('도메인 등록')
        ? '카카오 지도 SDK 연결에 실패했어요. 카카오 개발자 콘솔의 사이트 도메인 등록과 JavaScript 키를 확인해줘.'
        : '입력한 주소를 다시 확인해줘. 동 이름, 역 이름, 건물명처럼 러프한 주소도 다시 시도할 수 있어요.';
      renderAll();
      alert(state.distanceMeta);
    } finally {
      setCalcButtonLoading(false);
    }
  }

  function openModal(sizeKey) {
    const group = ITEM_GROUPS[sizeKey];
    if (!group) return;

    state.lastOpenedSize = sizeKey;
    modalPreviouslyFocused = document.activeElement;

    els.modalTitle.textContent = group.title;
    els.modalCopy.textContent = group.copy;
    els.modalList.innerHTML = '';

    group.items.forEach(([name, desc]) => {
      const qty = state.selected[name] || 0;
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-label">
          <strong>${name}</strong>
          <small>${desc}</small>
        </div>
        <div class="stepper">
          <button type="button" aria-label="${name} 수량 줄이기" data-item-minus="${name}">−</button>
          <input type="number" inputmode="numeric" min="0" value="${qty}" data-item-input="${name}" />
          <button type="button" aria-label="${name} 수량 늘리기" data-item-plus="${name}">+</button>
        </div>
      `;
      els.modalList.appendChild(row);
    });

    els.modal.classList.remove('hidden');
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    const firstInput = $('[data-item-input]', els.modalList);
    if (firstInput) firstInput.focus();
  }

  function closeModal() {
    els.modal.classList.add('hidden');
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    renderSummary();

    if (modalPreviouslyFocused && typeof modalPreviouslyFocused.focus === 'function') {
      modalPreviouslyFocused.focus();
    }
  }

  function sanitizeQty(value) {
    return Math.max(0, parseInt(String(value).replace(/[^0-9-]/g, ''), 10) || 0);
  }

  function setItemQty(name, next) {
    const value = sanitizeQty(next);
    if (value <= 0) delete state.selected[name];
    else state.selected[name] = value;
    renderSummary();
  }

  function smsBody() {
    const items = currentSelectedEntries();
    const helperText = [state.helperFrom ? '출발지 도움' : null, state.helperTo ? '도착지 도움' : null]
      .filter(Boolean)
      .join(', ') || '없음';

    return [
      '디디운송 용달 예약 문의',
      `출발지: ${state.startAddress || '-'}`,
      `도착지: ${state.endAddress || '-'}`,
      `거리: ${state.distanceKm > 0 ? `${state.distanceKm.toFixed(1)}km` : '-'}`,
      `선택 품목: ${items.length ? items.join(', ') : '없음'}`,
      `기사 도움: ${helperText}`,
      `예상 용달비: ${formatWon(totalFee())}`,
    ].join('\n');
  }

  function buildSmsHref() {
    const body = encodeURIComponent(smsBody());
    const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isiOS ? `sms:${PHONE_NUMBER}&body=${body}` : `sms:${PHONE_NUMBER}?body=${body}`;
  }

  function goSms() {
    if (!validateForSms()) return;
    window.location.href = buildSmsHref();
  }

  function handleModalClick(event) {
    const closeTrigger = event.target.closest('[data-close-modal]');
    if (closeTrigger) {
      closeModal();
      return;
    }

    const minusBtn = event.target.closest('[data-item-minus]');
    if (minusBtn) {
      const name = minusBtn.getAttribute('data-item-minus');
      const input = getModalInputByName(name);
      if (!input) return;
      const next = Math.max(0, sanitizeQty(input.value) - 1);
      input.value = String(next);
      setItemQty(name, next);
      return;
    }

    const plusBtn = event.target.closest('[data-item-plus]');
    if (plusBtn) {
      const name = plusBtn.getAttribute('data-item-plus');
      const input = getModalInputByName(name);
      if (!input) return;
      const next = sanitizeQty(input.value) + 1;
      input.value = String(next);
      setItemQty(name, next);
    }
  }

  function handleModalInput(event) {
    const input = event.target.closest('[data-item-input]');
    if (!input) return;
    const value = sanitizeQty(input.value);
    input.value = String(value);
    setItemQty(input.getAttribute('data-item-input'), value);
  }

  function handleModalKeydown(event) {
    if (event.key === 'Escape' && !els.modal.classList.contains('hidden')) {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key === 'Enter' && event.target.matches('[data-item-input]')) {
      event.preventDefault();
      closeModal();
    }
  }

  function bindEvents() {
    els.sizeCards.forEach((btn) => {
      btn.addEventListener('click', () => openModal(btn.dataset.size));
    });

    els.calcBtn.addEventListener('click', calculateDistance);
    els.start.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') calculateDistance();
    });
    els.end.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') calculateDistance();
    });

    els.helpFrom.addEventListener('change', (event) => {
      state.helperFrom = event.target.checked;
      renderFees();
    });
    els.helpTo.addEventListener('change', (event) => {
      state.helperTo = event.target.checked;
      renderFees();
    });

    els.smsBtn.addEventListener('click', goSms);
    els.modalConfirmBtn.addEventListener('click', closeModal);
    els.modal.addEventListener('click', handleModalClick);
    els.modalList.addEventListener('input', handleModalInput);
    els.modal.addEventListener('keydown', handleModalKeydown);
    document.addEventListener('keydown', handleModalKeydown);
  }

  bindEvents();
  renderAll();

  ensureKakaoReady().catch((error) => {
    console.warn('Kakao SDK preload failed:', error);
  });
})();