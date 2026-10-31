const U = 'https://zurfdfqfztydhbmjwyqx.supabase.co', K = 'sb_publishable_8asTfEEJyyDniSAITehVqg_fNAf1Oh7';
const CATS = ['제조/생산', '건설/공사', '물류/운송', '의료/요양/복지', 'IT/연구/기술', '도소매/유통', '시설관리/환경', '사무/전문서비스', '음식/숙박', '교육', '기타'];
const CITIES = ['전체', '천안시', '아산시', '평택시'];
const SELECT_ZOOM = 15;
const ROW_H = 80;
const qs = new URLSearchParams(location.search);
let st = {
  cat: CATS.includes(qs.get('c')) ? qs.get('c') : '제조/생산',
  city: CITIES.includes(qs.get('city')) ? qs.get('city') : null,
  bbox: null
};
let pendingDeep = qs.get('pid');
const map = L.map('map', { maxZoom: 19, minZoom: 9, zoomAnimation: false }).setView([36.88, 127.05], 10);
window.__map = map;
window.__baseMap = 'osm';
L.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
(function addBaseMap() {
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  });
  const key = String(window.VWORLD_KEY || '').trim();
  if (!key) {
    osm.addTo(map);
    return;
  }
  let switched = false;
  let errors = 0;
  let loaded = 0;
  const vworld = L.tileLayer('https://api.vworld.kr/req/wmts/1.0.0/' + encodeURIComponent(key) + '/Base/{z}/{y}/{x}.png', {
    maxZoom: 19,
    attribution: '© 국토지리정보원 · 브이월드'
  });
  function useOsm() {
    if (switched) return;
    switched = true;
    window.__baseMap = 'osm';
    if (map.hasLayer(vworld)) map.removeLayer(vworld);
    if (!map.hasLayer(osm)) osm.addTo(map);
  }
  vworld.on('tileload', () => { loaded++; });
  vworld.on('tileerror', () => {
    errors++;
    if (loaded === 0 && errors >= 4) useOsm();
  });
  vworld.addTo(map);
  window.__baseMap = 'vworld';
})();

const placeIcon = L.divIcon({
  className: 'pin-wrap',
  html: '<div class="pin-muted"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 22]
});
function selectedIconFor(name) {
  return L.divIcon({
    className: 'sel-wrap',
    html: Ilteo.selectedPinHtml(name),
    iconSize: [42, 42],
    iconAnchor: [21, 40]
  });
}
function countIcon(n, tip) {
  const size = n < 10 ? 'small' : n < 100 ? 'medium' : 'large';
  const title = tip ? ' title="' + esc(tip) + '"' : '';
  return L.divIcon({
    html: '<div' + title + '><span>' + n + '</span></div>',
    className: 'marker-cluster marker-cluster-' + size,
    iconSize: [40, 40]
  });
}
function infraIcon(kind) {
  return L.divIcon({
    className: 'infra-icon infra-' + kind,
    html: '<span></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}
function ringLabel(text) {
  return L.divIcon({
    className: 'ring-label',
    html: '<span>' + text + '</span>',
    iconSize: [150, 22],
    iconAnchor: [75, 11]
  });
}

const cl = L.markerClusterGroup({
  chunkedLoading: false,
  spiderfyOnMaxZoom: false,
  zoomToBoundsOnClick: true,
  showCoverageOnHover: false,
  disableClusteringAtZoom: SELECT_ZOOM,
  maxClusterRadius: 56,
  iconCreateFunction: function (cluster) {
    let n = 0;
    cluster.getAllChildMarkers().forEach(m => { n += m.options.companyCount || 1; });
    return countIcon(n, '회사 ' + n + '곳 · 눌러서 확대');
  }
});
map.addLayer(cl);
cl.on('clustermouseover', e => {
  let n = 0;
  e.layer.getAllChildMarkers().forEach(m => { n += m.options.companyCount || 1; });
  const tip = '회사 ' + n + '곳 · 눌러서 확대';
  if (!e.layer.getTooltip()) e.layer.bindTooltip(tip, { direction: 'top', offset: [0, -12] });
  else e.layer.setTooltipContent(tip);
  e.layer.openTooltip();
});
(function addLegend() {
  const Legend = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML =
        '<button type="button" class="legend-toggle" aria-expanded="false">범례</button>' +
        '<div class="legend-body" hidden>' +
        '<div class="legend-row"><i class="pin-muted"></i><span>회사 1곳</span></div>' +
        '<div class="legend-row"><i class="legend-badge"><span>2</span></i><span>근처 회사 묶음 (눌러서 확대)</span></div>' +
        '<div class="legend-row"><i class="sel-pin"></i><span>선택한 회사</span></div>' +
        '<div class="legend-row"><i class="legend-ring"></i><span>반경 1·2·3km</span></div>' +
        '<div class="legend-infra" hidden>' +
        '<div class="legend-row"><i class="dot infra-bus"></i><span>버스정류장</span></div>' +
        '<div class="legend-row"><i class="dot infra-convenience"></i><span>편의점</span></div>' +
        '<div class="legend-row"><i class="dot infra-pharmacy"></i><span>약국</span></div>' +
        '<div class="legend-row"><i class="dot infra-clinic"></i><span>의원</span></div>' +
        '<div class="legend-row"><i class="dot infra-dental"></i><span>치과</span></div>' +
        '<div class="legend-row"><i class="dot infra-korean"></i><span>한의원</span></div>' +
        '<div class="legend-row"><i class="dot infra-hospital"></i><span>병원</span></div>' +
        '<div class="legend-row"><i class="dot infra-health"></i><span>보건소</span></div>' +
        '</div></div>';
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      div.querySelector('.legend-toggle').onclick = () => {
        const body = div.querySelector('.legend-body');
        const open = body.hidden;
        body.hidden = !open;
        div.querySelector('.legend-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      return div;
    }
  });
  new Legend().addTo(map);
})();
const infraLayer = L.layerGroup().addTo(map);
const ringLayer = L.layerGroup().addTo(map);

const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mobile = () => window.matchMedia('(max-width: 899px)').matches;
const panel = document.getElementById('panel');
const listEl = document.getElementById('list');

let siteMarkers = new Map();
let groupByPid = new Map();
let allGroups = null;
let visibleGroups = [];
let selectedPin = null;
let hiddenSite = null;
let hoverRing = null;
let infraHighlight = null;
let infraFocusMarker = null;
let selectedPid = null;
let returnView = null;
let pendingRestore = null;
let rentRows = null;
let umdPoints = [];
let infraData = null;
let suppressMapClick = false;
let selectionId = 0;
let pushedDetail = false;
let pendingScrollPid = null;
let moveTimer = 0;
let listRaf = 0;
const RING = '#7EB6E6';
const RINGS = [
  { m: 1000, label: '1km · 도보 15분' },
  { m: 2000, label: '2km · 자전거 10분' },
  { m: 3000, label: '3km · 차 5분' }
];
const dataReady = Promise.all([
  fetch(Ilteo.assetUrl('data/rent.json')).then(r => r.json()),
  fetch(Ilteo.assetUrl('data/infra.json')).then(r => r.json()),
  fetch(Ilteo.assetUrl('data/umd-points.json')).then(r => r.ok ? r.json() : []).catch(() => [])
]).then(([rent, infra, points]) => { rentRows = rent; infraData = infra; umdPoints = points || []; }).catch(() => {});

function storyFor(p) {
  const blob = (p.city || '') + ' ' + (p.address || '');
  if (blob.indexOf('평택') !== -1) {
    return { href: Ilteo.BASE + 'blog/pyeongtaek-oneroom-rent/', title: '평택 원룸 월세 이야기' };
  }
  return null;
}
function companyUrl(pid) {
  const u = new URL(location.href);
  u.searchParams.set('c', st.cat);
  if (st.city) u.searchParams.set('city', st.city);
  else u.searchParams.delete('city');
  if (pid) u.searchParams.set('pid', pid);
  else u.searchParams.delete('pid');
  u.hash = '';
  return u.toString();
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), 1800);
}
  function viewportH() {
  const vv = window.visualViewport;
  const inner = window.innerHeight || 0;
  const visual = vv && vv.height ? vv.height : 0;
  const client = document.documentElement ? document.documentElement.clientHeight : 0;
  return Math.max(inner, visual, client, 320);
}
function sheetPx(stage) {
  const vh = viewportH();
  if (stage === 'peek') return 96;
  if (stage === 'full') return Math.round(vh * 0.88);
  return Math.round(vh * 0.46);
}
function setStage(stage) {
  panel.dataset.stage = stage;
  document.body.dataset.sheet = stage;
  if (mobile()) panel.style.height = sheetPx(stage) + 'px';
  else panel.style.height = '';
  if (stage === 'half' || stage === 'full') requestAnimationFrame(() => { renderWindow(); applyPendingScroll(); });
}

function clearHover() {
  if (hoverRing) { map.removeLayer(hoverRing); hoverRing = null; }
}
function markerOnMap(layer) {
  if (!layer || !layer._icon) return false;
  const mapRect = map.getContainer().getBoundingClientRect();
  const rect = layer._icon.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return cx >= mapRect.left && cy >= mapRect.top && cx <= mapRect.right && cy <= mapRect.bottom;
}
function shownLayer(group) {
  const marker = siteMarkers.get(Ilteo.coordKey(group[0]));
  if (marker && hiddenSite === marker && markerOnMap(selectedPin)) return selectedPin;
  if (!marker) return null;
  const parent = cl.getVisibleParent(marker);
  if (!markerOnMap(parent)) return null;
  return parent;
}
function highlightGroup(group) {
  clearHover();
  if (!group) return;
  const layer = shownLayer(group);
  if (!layer || !layer.getLatLng) return;
  const clustered = typeof layer.getAllChildMarkers === 'function';
  const badge = !clustered && layer.options && layer.options.companyCount > 1;
  hoverRing = L.circleMarker(layer.getLatLng(), {
    radius: clustered ? 26 : badge ? 22 : 14,
    color: '#5C6B7A',
    weight: 3,
    fillColor: '#5C6B7A',
    fillOpacity: 0.18,
    interactive: false
  }).addTo(map);
}
function hideTip(layer) {
  if (!layer || !layer.getTooltip) return;
  const tip = layer.getTooltip();
  if (!tip) return;
  layer.closeTooltip();
  clearTimeout(tip._removeTimeout);
  if (tip._container && tip._container.parentNode) tip._container.remove();
}
function clearInfraFocus() {
  if (infraHighlight) { map.removeLayer(infraHighlight); infraHighlight = null; }
  hideTip(infraFocusMarker);
  if (infraFocusMarker && infraLayer.hasLayer(infraFocusMarker)) infraLayer.removeLayer(infraFocusMarker);
  infraFocusMarker = null;
  infraLayer.eachLayer(hideTip);
  document.querySelectorAll('#infra-list .infra-item.on').forEach(el => el.classList.remove('on'));
}
function rememberView() {
  if (returnView) return;
  const c = map.getCenter();
  returnView = { lat: c.lat, lng: c.lng, zoom: map.getZoom(), scroll: listEl.scrollTop || 0 };
}
function restoreView() {
  const view = returnView;
  returnView = null;
  if (!view) return;
  pendingScrollPid = null;
  pendingRestore = view;
  if (map.stop) map.stop();
  map.setView([view.lat, view.lng], view.zoom, { animate: false });
  scheduleSync();
}
function fitResults() {
  pendingScrollPid = null;
  const layers = cl.getLayers();
  if (!layers.length) return;
  const bounds = cl.getBounds();
  if (!bounds.isValid()) return;
  if (map.stop) map.stop();
  map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13, animate: false });
}

function drawRings(lat, lng) {
  ringLayer.clearLayers();
  RINGS.forEach(s => {
    L.circle([lat, lng], {
      radius: s.m, color: RING, weight: 2, dashArray: '7 7', fillColor: RING, fillOpacity: 0.05, interactive: false
    }).addTo(ringLayer);
    const latOff = s.m / 111320;
    L.marker([lat + latOff, lng], { icon: ringLabel(esc(s.label)), interactive: false, keyboard: false }).addTo(ringLayer);
  });
}

function clearSelection(opts) {
  opts = opts || {};
  clearInfraFocus();
  if (selectedPin) { map.removeLayer(selectedPin); selectedPin = null; }
  if (hiddenSite) { cl.addLayer(hiddenSite); hiddenSite = null; }
  infraLayer.clearLayers();
  ringLayer.clearLayers();
  clearHover();
  const legendInfra = document.querySelector('.legend-infra');
  if (legendInfra) legendInfra.hidden = true;
  selectedPid = null;
  pendingScrollPid = null;
  document.body.classList.remove('detail-open');
  document.getElementById('sheet').classList.remove('on');
  renderWindow();
  if (!opts.fromPop) history.replaceState({ ilteo: 'map' }, '', companyUrl(null));
}
function closeDetail(opts) {
  opts = opts || {};
  const restore = !!opts.restore;
  clearSelection({ fromPop: !!opts.fromPop });
  if (!restore) {
    returnView = null;
    pendingRestore = null;
    return;
  }
  if (returnView) restoreView();
  else if (!opts.fromPop) fitResults();
}

function sitePopupHtml(site) {
  return `<div class="sitepop"><b>이 위치 ${site.groups.length}곳</b><div class="site-list">` + site.groups.map(g => {
    const p = g[0];
    const meta = [p.industry, p.headcount ? '가입자 ' + p.headcount + '명' : ''].filter(Boolean).join(' · ');
    return `<button type="button" data-pid="${esc(p.pid)}"><b>${esc(p.name)}</b>${meta ? `<small>${esc(meta)}</small>` : ''}</button>`;
  }).join('') + '</div></div>';
}

map.on('popupopen', e => {
  const el = e.popup.getElement();
  if (!el) return;
  L.DomEvent.disableClickPropagation(el);
  L.DomEvent.disableScrollPropagation(el);
  el.querySelectorAll('[data-pid]').forEach(btn => {
    const go = ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const group = groupByPid.get(btn.getAttribute('data-pid'));
      if (group) selectGroup(group);
    };
    btn.addEventListener('click', go);
    btn.addEventListener('touchend', go, { passive: false });
  });
});

function requestClose() {
  if (pushedDetail) history.back();
  else closeDetail({ restore: true });
}

function selectGroup(group, opts) {
  opts = opts || {};
  const p = group[0];
  const key = Ilteo.coordKey(p);
  const opening = !selectedPid;
  if (opening && !opts.fromPop && !opts.deep) rememberView();
  suppressMapClick = true;
  setTimeout(() => { suppressMapClick = false; }, 400);
  clearInfraFocus();
  if (selectedPin) { map.removeLayer(selectedPin); selectedPin = null; }
  if (hiddenSite) { cl.addLayer(hiddenSite); hiddenSite = null; }
  clearHover();
  map.closePopup();
  if (map.stop) map.stop();
  selectedPid = p.pid;
  pendingScrollPid = opts.fromPop ? null : p.pid;
  const siteMarker = siteMarkers.get(key);
  if (siteMarker) {
    cl.removeLayer(siteMarker);
    hiddenSite = siteMarker;
  }
  selectedPin = L.marker([Number(p.lat), Number(p.lng)], {
    icon: selectedIconFor(p.name), zIndexOffset: 1200, interactive: false
  }).addTo(map);
  drawRings(Number(p.lat), Number(p.lng));
  if (mobile()) setStage('full');
  map.setView([Number(p.lat), Number(p.lng)], Math.max(map.getZoom(), SELECT_ZOOM), { animate: false });
  if (mobile()) {
    const h = panel.offsetHeight || window.innerHeight * 0.88;
    map.panBy([0, Math.round(h * 0.32)], { animate: false });
  }
  renderSheet(group);
  const url = companyUrl(p.pid);
  const state = { ilteo: 'detail', pid: p.pid, view: returnView };
  if (opts.fromPop) pushedDetail = true;
  else if (opts.deep) {
    history.replaceState(state, '', url);
    pushedDetail = false;
  } else if (opening) {
    history.pushState(state, '', url);
    pushedDetail = true;
  } else history.replaceState(state, '', url);
  scheduleSync();
}

function renderSheet(group) {
  const token = ++selectionId;
  const p = group[0];
  const sheet = document.getElementById('sheet');
  document.getElementById('sheet-title').textContent = p.name;
  const meta = [p.city, p.industry, p.headcount ? '가입자 ' + p.headcount + '명' : ''].filter(Boolean).join(' · ');
  const kakao = `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}`;
  const naver = `https://map.naver.com/p/directions/-/${p.lng},${p.lat},${encodeURIComponent(p.name)}/-/car`;
  const story = storyFor(p);
  document.getElementById('sheet-body').innerHTML =
    `<p class="summary" id="summary">주변 정보를 불러오는 중…</p>` +
    `<p class="pinmeta">${esc(meta)}</p>` +
    (p.address ? `<p class="addr">${esc(p.address)}</p>` : '') +
    `<div class="cta-row">` +
    `<a class="primary" target="_blank" rel="noopener" href="${kakao}">카카오 길찾기</a>` +
    `<a target="_blank" rel="noopener" href="${naver}">네이버 길찾기</a>` +
    (story ? `<a href="${story.href}">이 동네 이야기</a>` : '') +
    `<button type="button" id="share-btn">공유</button></div>` +
    `<p class="pinmeta">1km 도보 15분 · 2km 자전거 10분 · 3km 차 5분</p>` +
    (group.length > 1 ? `<p class="pinmeta">이 사업장 기록 ${group.length}건 · <a href="${Ilteo.placeUrl(p)}">자세히 보기</a></p>` : `<p class="sheet-links" style="margin:0"><a href="${Ilteo.placeUrl(p)}">자세히 보기</a></p>`) +
    `<section class="block"><h2>주변 월세</h2><div id="rent-box"><p class="pinmeta">불러오는 중…</p></div></section>` +
    `<section class="block"><h2>주변 생활 <span>반경 2km · 가까운 3곳</span></h2><div id="infra-list"><p class="pinmeta">불러오는 중…</p></div></section>`;
  sheet.classList.add('on');
  document.body.classList.add('detail-open');
  document.getElementById('share-btn').onclick = () => shareCompany(p);
  dataReady.then(() => { if (token === selectionId) fillContext(group); });
}

function shareCompany(p) {
  const url = companyUrl(p.pid);
  const payload = { title: p.name + ' | 일터동네', text: p.name, url };
  if (navigator.share) {
    navigator.share(payload).catch(() => {});
    return;
  }
  const done = () => toast('링크를 복사했습니다');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(done);
  else { window.prompt('링크를 복사하세요', url); }
}

function levelBadge(level) {
  return level === 'dong' ? '동' : level === 'eupmyeon' ? '읍·면' : '시';
}

function fillContext(group) {
  const p = group[0];
  const rentBox = document.getElementById('rent-box');
  const infraList = document.getElementById('infra-list');
  const summary = document.getElementById('summary');
  if (!rentBox || !summary) return;
  let oneroom = null;
  let rent = null;
  if (!rentRows) rentBox.innerHTML = '<p class="pinmeta">월세 정보를 불러오지 못했습니다.</p>';
  else {
    rent = Ilteo.matchRent(rentRows, p.city, p.address, p.lat, p.lng, umdPoints);
    if (!rent || !rent.bands.length) rentBox.innerHTML = '<p class="pinmeta">이 지역 월세 집계가 없습니다.</p>';
    else {
      oneroom = rent.bands.filter(b => b.short === '원룸')[0] || null;
      const note = Ilteo.rentNote(rent);
      rentBox.innerHTML =
        `<p class="where">${esc(rent.label)} <span class="badge">${levelBadge(rent.level)}</span></p>` +
        '<table class="rent"><thead><tr><th>유형</th><th>보증금</th><th>월세</th><th>거래</th></tr></thead><tbody>' +
        rent.bands.map(b => `<tr><td>${esc(b.short)}</td><td>${b.dep}만</td><td>${b.rent}만</td><td>${b.n.toLocaleString()}</td></tr>`).join('') +
        '</tbody></table>' +
        (note ? `<p class="pinmeta">${esc(note)}</p>` : '') +
        '<p class="src-line">국토교통부 실거래가 (2025.10~2026.09)</p>';
    }
  }
  infraLayer.clearLayers();
  if (!infraData) {
    infraList.innerHTML = '<p class="pinmeta">주변 시설을 불러오지 못했습니다.</p>';
    summary.textContent = oneroom ? `원룸 월세 약 ${oneroom.rent}만` : '주변 시설 정보를 불러오지 못했습니다';
    return;
  }
  const parts = Ilteo.infraSummary(infraData, Number(p.lat), Number(p.lng), 2000);
  const bits = [];
  if (oneroom) bits.push('원룸 월세 약 ' + oneroom.rent + '만');
  parts.forEach(part => { if (part.n) bits.push(part.label + ' ' + part.n); });
  summary.innerHTML = esc(bits.join(' · ')) + ' <span>2km</span>';
  const shown = parts.filter(part => part.n);
  if (!shown.length) {
    infraList.innerHTML = '<p class="pinmeta">반경 2km 안에서 찾지 못했습니다.</p>';
    return;
  }
  infraList.innerHTML = shown.map(part => Ilteo.infraGroupHtml(part, false)).join('')
    + '<p class="src-line">약국·의료기관: 국립중앙의료원 (공공데이터포털)</p><p class="src-line">버스정류장·편의점: OpenStreetMap</p>';
  infraList.querySelectorAll('details.fac').forEach(details => {
    details.addEventListener('toggle', () => {
      if (!details.open && details.querySelector('.infra-item.on')) clearInfraFocus();
    });
  });
  const legendInfra = document.querySelector('.legend-infra');
  if (legendInfra) legendInfra.hidden = false;
  shown.forEach(part => part.nearest.forEach(s => {
    const marker = L.marker([s.lat, s.lng], { icon: infraIcon(s.kind), interactive: true, keyboard: false });
    marker.bindTooltip(s.name + ' · ' + Ilteo.formatDistance(s.d), { direction: 'top', offset: [0, -8] });
    marker._infraKey = s.kind + ':' + s.lat + ':' + s.lng;
    marker.addTo(infraLayer);
  }));
}

function rowHtml(group) {
  const p = group[0];
  const on = p.pid === selectedPid;
  const extra = group.length > 1 ? ` · ${group.length}건` : '';
  return `<li class="row${on ? ' on' : ''}" data-pid="${esc(p.pid)}" tabindex="0" role="option" aria-selected="${on ? 'true' : 'false'}"><b>${esc(p.name)}</b><span class="tag">${p.kind === 'factory' ? '공장' : '사업장'}</span><small>${esc(p.city || '')} · ${esc(p.industry || '')}${p.headcount ? ' · 가입자 ' + p.headcount + '명' : ''}${extra}</small></li>`;
}

function renderWindow() {
  if (!listEl || !allGroups) return;
  const total = visibleGroups.length;
  if (!total) {
    listEl.innerHTML = '<li class="empty">이 화면에는 회사가 없습니다. 지도를 축소하거나 이 지역 다시 검색을 눌러 보세요.</li>';
    return;
  }
  const top = listEl.scrollTop;
  const viewH = listEl.clientHeight || 480;
  const start = Math.max(0, Math.floor(top / ROW_H) - 4);
  const end = Math.min(total, Math.ceil((top + viewH) / ROW_H) + 6);
  const html = [`<li class="spacer" style="height:${start * ROW_H}px"></li>`];
  for (let i = start; i < end; i++) html.push(rowHtml(visibleGroups[i]));
  html.push(`<li class="spacer" style="height:${Math.max(0, total - end) * ROW_H}px"></li>`);
  listEl.innerHTML = html.join('');
  if (Math.abs(listEl.scrollTop - top) > 1) listEl.scrollTop = top;
}

function applyPendingScroll() {
  if (!pendingScrollPid) return;
  const i = visibleGroups.findIndex(g => g[0].pid === pendingScrollPid);
  if (i < 0) return;
  if (listEl.clientHeight < 40) return;
  listEl.scrollTop = Math.max(0, i * ROW_H - 8);
  pendingScrollPid = null;
  renderWindow();
}

function syncViewport() {
  if (!allGroups) return;
  const seen = new Map();
  visibleGroups = allGroups.filter(g => {
    const layer = shownLayer(g);
    if (!layer) return false;
    if (seen.has(layer)) return seen.get(layer);
    const ok = markerOnMap(layer);
    seen.set(layer, ok);
    return ok;
  });
  document.getElementById('count').innerHTML = `지도 안 <span style="color:#EC4600">${visibleGroups.length.toLocaleString()}</span>곳`;
  if (pendingRestore) {
    const view = pendingRestore;
    if (Math.abs(map.getZoom() - view.zoom) > 0.01) {
      renderWindow();
      return;
    }
    pendingRestore = null;
    renderWindow();
    listEl.scrollTop = view.scroll;
    renderWindow();
    return;
  }
  if (!pendingScrollPid) listEl.scrollTop = 0;
  renderWindow();
  applyPendingScroll();
}
function scheduleSync() {
  clearTimeout(moveTimer);
  moveTimer = setTimeout(syncViewport, 300);
}

function chips(id, arr, key) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  arr.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = v;
    const val = v === '전체' ? null : v;
    if (st[key] === val) b.className = 'on';
    b.onclick = () => { st[key] = val; st.bbox = null; chips(id, arr, key); load(); };
    el.appendChild(b);
  });
}

async function searchPlaces(body) {
  const rows = [];
  const seen = new Set();
  for (let off = 0; off < 5000; off += 1000) {
    const r = await fetch(`${U}/rest/v1/rpc/search_places?offset=${off}&limit=1000`, {
      method: 'POST',
      headers: { apikey: K, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    let added = 0;
    for (const p of d) {
      if (!p || p.pid == null || seen.has(p.pid)) continue;
      seen.add(p.pid);
      rows.push(p);
      added++;
    }
    if (!added || d.length < 1000) break;
  }
  return rows;
}

async function load() {
  returnView = null;
  pendingRestore = null;
  pushedDetail = false;
  clearSelection({ fromPop: true });
  if (!pendingDeep) history.replaceState({ ilteo: 'map' }, '', companyUrl(null));
  document.getElementById('count').textContent = '불러오는 중…';
  const body = { p_category: st.cat, p_city: st.city, p_limit: 5000 };
  if (st.bbox) Object.assign(body, st.bbox);
  let rows = await searchPlaces(body);
  rows = rows.filter(p => p.lat > 36.6 && p.lat < 37.2 && p.lng > 126.7 && p.lng < 127.4);
  rows.forEach(p => { p.name = Ilteo.normalizeName(p.name); });
  const groups = Ilteo.groupPlaces(rows);
  const sites = Ilteo.clusterSites(groups);
  window.__groups = groups;
  window.__sites = sites;
  allGroups = groups;
  groupByPid = new Map();
  groups.forEach(g => g.forEach(p => groupByPid.set(p.pid, g)));
  cl.clearLayers();
  siteMarkers = new Map();
  const ms = [];
  sites.forEach(site => {
    const n = site.groups.length;
    const markerOpts = {
      companyCount: n,
      bubblingMouseEvents: false,
      icon: n > 1 ? countIcon(n, '회사 ' + n + '곳 · 눌러서 목록') : placeIcon
    };
    const marker = L.marker([site.lat, site.lng], markerOpts);
    if (n > 1) {
      const tip = '회사 ' + n + '곳 · 눌러서 목록';
      marker.bindTooltip(tip, { direction: 'top', offset: [0, -10] });
      marker.bindPopup(sitePopupHtml(site), { autoPan: true, maxWidth: 280, minWidth: 220, className: 'pin-popup' });
    }
    marker.on('click', () => { if (n === 1) selectGroup(site.groups[0]); });
    siteMarkers.set(site.key, marker);
    ms.push(marker);
  });
  cl.addLayers(ms);
  if (ms.length && !st.bbox && !pendingDeep) map.fitBounds(cl.getBounds(), { padding: [24, 24], maxZoom: 13, animate: false });
  scheduleSync();
  if (pendingDeep && groupByPid.has(pendingDeep)) {
    const g = groupByPid.get(pendingDeep);
    pendingDeep = null;
    selectGroup(g, { deep: true });
  } else pendingDeep = null;
}

listEl.addEventListener('scroll', () => {
  if (listRaf) return;
  listRaf = requestAnimationFrame(() => { listRaf = 0; renderWindow(); });
});
listEl.addEventListener('click', e => {
  const li = e.target.closest('li[data-pid]');
  if (!li) return;
  const g = groupByPid.get(li.dataset.pid);
  if (g) selectGroup(g);
});
listEl.addEventListener('keydown', e => {
  const li = e.target.closest('li[data-pid]');
  if (!li || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  const g = groupByPid.get(li.dataset.pid);
  if (g) selectGroup(g);
});
listEl.addEventListener('mouseover', e => {
  const li = e.target.closest('li[data-pid]');
  if (!li) return;
  highlightGroup(groupByPid.get(li.dataset.pid));
});
listEl.addEventListener('mouseout', e => {
  const li = e.target.closest('li[data-pid]');
  if (!li) return;
  if (e.relatedTarget && li.contains(e.relatedTarget)) return;
  clearHover();
});
listEl.addEventListener('focusin', e => {
  const li = e.target.closest('li[data-pid]');
  if (li) highlightGroup(groupByPid.get(li.dataset.pid));
});
listEl.addEventListener('focusout', () => clearHover());

document.getElementById('sheet-body').addEventListener('click', e => {
  const more = e.target.closest('.more-infra');
  if (more) {
    e.preventDefault();
    const fac = more.closest('details');
    const rest = fac.querySelector('.infra-rest');
    const opening = rest.hidden;
    rest.hidden = !opening;
    more.textContent = opening ? '접기' : '모두 보기 (' + more.dataset.n + '곳)';
    if (!opening && rest.querySelector('.infra-item.on')) clearInfraFocus();
    return;
  }
  const li = e.target.closest('.infra-item');
  if (!li) return;
  clearInfraFocus();
  li.classList.add('on');
  const lat = Number(li.dataset.lat), lng = Number(li.dataset.lng);
  infraHighlight = L.circleMarker([lat, lng], {
    radius: 14, color: '#5C6B7A', weight: 3, fillColor: '#5C6B7A', fillOpacity: 0.2, interactive: false
  }).addTo(map);
  let found = null;
  infraLayer.eachLayer(layer => {
    if (!layer.getLatLng || found) return;
    const ll = layer.getLatLng();
    if (Math.abs(ll.lat - lat) < 1e-4 && Math.abs(ll.lng - lng) < 1e-4) found = layer;
  });
  if (found) {
    if (found.openTooltip) found.openTooltip();
  } else {
    infraFocusMarker = L.marker([lat, lng], { icon: infraIcon(li.dataset.kind), zIndexOffset: 700 });
    infraFocusMarker.bindTooltip(li.querySelector('b').textContent, { direction: 'top', offset: [0, -8] });
    infraFocusMarker.addTo(infraLayer);
    infraFocusMarker.openTooltip();
  }
});
document.getElementById('sheet-back').onclick = () => requestClose();
document.getElementById('area').onclick = () => {
  const b = map.getBounds();
  st.bbox = { min_lat: b.getSouth(), min_lng: b.getWest(), max_lat: b.getNorth(), max_lng: b.getEast() };
  load();
};
document.getElementById('me').onclick = () => navigator.geolocation && navigator.geolocation.getCurrentPosition(pos => {
  map.setView([pos.coords.latitude, pos.coords.longitude], 14, { animate: false });
  L.circleMarker([pos.coords.latitude, pos.coords.longitude], { color: '#5C6B7A', fillColor: '#8AA0B4', fillOpacity: 0.9, radius: 6 }).addTo(map);
}, () => alert('위치 권한이 필요합니다'));
map.on('click', () => {
  if (suppressMapClick) return;
  if (document.body.classList.contains('detail-open')) requestClose();
});
map.on('moveend', scheduleSync);
window.addEventListener('popstate', () => {
  const next = history.state;
  if (next && next.ilteo === 'detail' && next.pid && groupByPid.has(next.pid)) {
    pushedDetail = true;
    if (next.view) returnView = next.view;
    selectGroup(groupByPid.get(next.pid), { fromPop: true });
    return;
  }
  pushedDetail = false;
  if (selectedPid || returnView) closeDetail({ fromPop: true, restore: true });
  else if (mobile()) setStage('half');
});
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !selectedPid) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  e.preventDefault();
  requestClose();
});

(function sheetDrag() {
  const grab = document.getElementById('grab');
  const head = document.getElementById('listhead');
  const order = ['peek', 'half', 'full'];
  let dragging = false;
  let source = null;
  let pointerId = null;
  let startY = 0, startH = 0, lastH = 0, startStage = 'half';
  let startOnGrab = false;
  let landStage = null;

  function begin(y, fromGrab) {
    dragging = true;
    startOnGrab = !!fromGrab;
    startY = y;
    startH = panel.offsetHeight || sheetPx(panel.dataset.stage || 'half');
    lastH = startH;
    startStage = panel.dataset.stage || 'half';
    panel.style.transition = 'none';
  }
  function dragTo(y) {
    if (!dragging) return;
    const maxH = Math.round(viewportH() * 0.94);
    lastH = Math.max(84, Math.min(maxH, startH + (startY - y)));
    panel.style.height = lastH + 'px';
  }
  function nearestStage(height) {
    const peek = 96;
    const half = sheetPx('half');
    const full = sheetPx('full');
    const options = [['peek', peek], ['half', half], ['full', full]];
    let best = 'half', bd = 1e9;
    options.forEach(([name, h]) => {
      const d = Math.abs(height - h);
      if (d < bd) { bd = d; best = name; }
    });
    return best;
  }
  function finish() {
    if (!dragging) return;
    dragging = false;
    source = null;
    pointerId = null;
    const moved = Math.abs(lastH - startH);
    let best;
    if (moved < 14 && startOnGrab) {
      const i = Math.max(0, order.indexOf(startStage));
      best = order[(i + 1) % order.length];
    } else if (moved < 14) {
      best = startStage;
    } else {
      best = nearestStage(lastH);
    }
    panel.style.transition = '';
    if (selectedPid && best !== 'full' && startStage === 'full') {
      landStage = best;
      requestClose();
      return;
    }
    setStage(best);
  }
  const prevClose = closeDetail;
  closeDetail = function (opts) {
    const stage = landStage;
    landStage = null;
    prevClose(opts);
    if (stage && mobile()) setStage(stage);
  };
  function onHandle(target) {
    return !!(target && (target.closest('#grab') || target.closest('#listhead')) && !target.closest('button'));
  }
  function fromGrab(target) {
    return !!(target && target.closest('#grab'));
  }

  [grab, head].forEach(el => {
    el.addEventListener('touchstart', e => {
      if (!mobile() || !e.touches || e.touches.length !== 1) return;
      if (!onHandle(e.target)) return;
      if (source === 'pointer' && Math.abs(lastH - startH) < 8) {
        source = 'touch';
        begin(e.touches[0].clientY, fromGrab(e.target));
        return;
      }
      if (source) return;
      source = 'touch';
      begin(e.touches[0].clientY, fromGrab(e.target));
    }, { passive: true });
    el.addEventListener('pointerdown', e => {
      if (!mobile() || source) return;
      if (!onHandle(e.target)) return;
      source = 'pointer';
      pointerId = e.pointerId;
      begin(e.clientY, fromGrab(e.target));
      try { if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
      if (e.cancelable) e.preventDefault();
    });
  });
  document.addEventListener('touchmove', e => {
    if (source !== 'touch' || !dragging || !e.touches || !e.touches.length) return;
    if (e.cancelable) e.preventDefault();
    dragTo(e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('touchend', () => { if (source === 'touch') finish(); });
  document.addEventListener('touchcancel', () => { if (source === 'touch') finish(); });
  document.addEventListener('pointermove', e => {
    if (source !== 'pointer' || !dragging) return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    if (e.cancelable) e.preventDefault();
    dragTo(e.clientY);
  });
  document.addEventListener('pointerup', e => {
    if (source !== 'pointer') return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    finish();
  });
  document.addEventListener('pointercancel', e => {
    if (source !== 'pointer') return;
    if (Math.abs(lastH - startH) < 8) {
      source = null;
      dragging = false;
      pointerId = null;
      return;
    }
    finish();
  });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => {
    if (!mobile() || dragging) return;
    setStage(panel.dataset.stage || 'half');
  });
  window.addEventListener('resize', () => {
    if (!mobile() || dragging) return;
    setStage(panel.dataset.stage || 'half');
  });
})();

if (mobile()) setStage(panel.dataset.stage || 'half');
else document.body.dataset.sheet = panel.dataset.stage || 'half';
chips('cats', CATS, 'cat');
chips('cities', CITIES, 'city');
load();
