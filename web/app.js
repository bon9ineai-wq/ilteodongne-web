const U = 'https://zurfdfqfztydhbmjwyqx.supabase.co', K = 'sb_publishable_8asTfEEJyyDniSAITehVqg_fNAf1Oh7';
const CATS = ['제조/생산', '건설/공사', '물류/운송', '의료/요양/복지', 'IT/연구/기술', '도소매/유통', '시설관리/환경', '사무/전문서비스', '음식/숙박', '교육', '기타'];
const CITIES = ['전체', '천안시', '아산시', '평택시'];
const SELECT_ZOOM = 15;
let st = { cat: new URLSearchParams(location.search).get('c') || '제조/생산', city: null, bbox: null };
const map = L.map('map', { maxZoom: 16, minZoom: 9, zoomAnimation: false }).setView([36.88, 127.05], 10);
window.__map = map;
L.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 16,
  attribution: '© OpenStreetMap'
}).addTo(map);

const selectedIcon = L.divIcon({
  className: 'sel-wrap',
  html: '<div class="sel-pin"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 26]
});

function countIcon(n) {
  const size = n < 10 ? 'small' : n < 100 ? 'medium' : 'large';
  return L.divIcon({
    html: '<div><span>' + n + '</span></div>',
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

const cl = L.markerClusterGroup({
  chunkedLoading: false,
  spiderfyOnMaxZoom: false,
  spiderfyOnEveryZoom: false,
  zoomToBoundsOnClick: true,
  showCoverageOnHover: false,
  disableClusteringAtZoom: SELECT_ZOOM,
  maxClusterRadius: 56,
  iconCreateFunction: function (cluster) {
    let n = 0;
    cluster.getAllChildMarkers().forEach(m => { n += m.options.companyCount || 1; });
    return countIcon(n);
  }
});
map.addLayer(cl);
const infraLayer = L.layerGroup().addTo(map);

const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let siteMarkers = new Map();
let groupByPid = new Map();
let selectedPin = null;
let hiddenSite = null;
let rentRows = null;
let infraData = null;
let suppressMapClick = false;
let selectionId = 0;
const dataReady = Promise.all([
  fetch(Ilteo.BASE + 'data/rent.json').then(r => r.json()),
  fetch(Ilteo.BASE + 'data/infra.json').then(r => r.json())
]).then(([rent, infra]) => { rentRows = rent; infraData = infra; }).catch(() => {});

function clearSelection() {
  if (selectedPin) { map.removeLayer(selectedPin); selectedPin = null; }
  if (hiddenSite) { cl.addLayer(hiddenSite); hiddenSite = null; }
  infraLayer.clearLayers();
  document.body.classList.remove('detail-open');
  document.getElementById('sheet').classList.remove('on');
  document.querySelectorAll('#list li.on').forEach(el => el.classList.remove('on'));
}

function sitePopupHtml(site) {
  const items = site.groups.map(g => {
    const p = g[0];
    const meta = [p.industry, p.headcount ? '가입자 ' + p.headcount + '명' : ''].filter(Boolean).join(' · ');
    return `<button type="button" data-pid="${esc(p.pid)}"><b>${esc(p.name)}</b>${meta ? `<small>${esc(meta)}</small>` : ''}</button>`;
  }).join('');
  return `<div class="sitepop"><b>이 위치 ${site.groups.length}곳</b><div class="site-list">${items}</div></div>`;
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

function selectGroup(group) {
  const p = group[0];
  const key = Ilteo.coordKey(p);
  suppressMapClick = true;
  setTimeout(() => { suppressMapClick = false; }, 400);
  clearSelection();
  map.closePopup();
  if (map.stop) map.stop();
  map.setView([Number(p.lat), Number(p.lng)], SELECT_ZOOM, { animate: false });
  const siteMarker = siteMarkers.get(key);
  if (siteMarker) {
    cl.removeLayer(siteMarker);
    hiddenSite = siteMarker;
  }
  selectedPin = L.marker([Number(p.lat), Number(p.lng)], {
    icon: selectedIcon,
    zIndexOffset: 1200,
    interactive: false
  }).addTo(map);
  document.querySelectorAll('#list li.on').forEach(el => el.classList.remove('on'));
  const row = document.querySelector('#list li[data-pid="' + CSS.escape(p.pid) + '"]');
  if (row) row.classList.add('on');
  if (window.innerWidth < 900) document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderSheet(group);
  if (window.innerWidth < 900) map.panBy([0, Math.round(window.innerHeight * 0.16)], { animate: false });
}

function renderSheet(group) {
  const token = ++selectionId;
  const p = group[0];
  const sheet = document.getElementById('sheet');
  const body = document.getElementById('sheet-body');
  document.getElementById('sheet-title').textContent = p.name;
  const meta = [p.city, p.industry, p.headcount ? '가입자 ' + p.headcount + '명' : ''].filter(Boolean).join(' · ');
  const links = group.map(item => `<a href="${Ilteo.placeUrl(item)}">자세히 보기</a>`).join('');
  body.innerHTML =
    `<p class="pinmeta">${esc(meta)}</p>` +
    (p.address ? `<p class="addr">${esc(p.address)}</p>` : '') +
    (group.length > 1 ? `<p class="pinmeta">이 사업장 기록 ${group.length}건</p>` : '') +
    `<p class="sheet-links">${links}</p>` +
    `<section class="block"><h2>주변 월세</h2><div id="rent-box"><p class="pinmeta">불러오는 중…</p></div></section>` +
    `<section class="block"><h2>주변 생활 <span>반경 2km</span></h2><ul id="infra-list"><li class="pinmeta">불러오는 중…</li></ul></section>`;
  sheet.classList.add('on');
  document.body.classList.add('detail-open');
  dataReady.then(() => { if (token === selectionId) fillContext(group); });
}

function fillContext(group) {
  const p = group[0];
  const rentBox = document.getElementById('rent-box');
  const infraList = document.getElementById('infra-list');
  if (!rentBox) return;
  if (!rentRows) {
    rentBox.innerHTML = '<p class="pinmeta">월세 정보를 불러오지 못했습니다.</p>';
  } else {
    const rent = Ilteo.matchRent(rentRows, p.city, p.address);
    if (!rent || !rent.bands.length) {
      rentBox.innerHTML = '<p class="pinmeta">이 지역 월세 집계가 없습니다.</p>';
    } else {
      const note = rent.level === 'city' ? '주소에서 동·읍면을 특정하지 못해 시 전체 값입니다.' :
        (rent.level === 'eupmyeon' ? '읍·면 안의 리 거래를 합쳤습니다. 월세는 거래건수로 가중했습니다.' : '');
      rentBox.innerHTML =
        `<p class="where">${esc(rent.label)}</p>` +
        '<table class="rent"><thead><tr><th>유형</th><th>보증금</th><th>월세</th><th>거래</th></tr></thead><tbody>' +
        rent.bands.map(b => `<tr><td>${esc(b.short)}</td><td>${b.dep}만</td><td>${b.rent}만</td><td>${b.n.toLocaleString()}</td></tr>`).join('') +
        '</tbody></table>' +
        (note ? `<p class="pinmeta">${esc(note)}</p>` : '') +
        '<p class="src-line">국토교통부 실거래가 (2025.10~2026.09)</p>';
    }
  }
  infraLayer.clearLayers();
  if (!infraData) {
    infraList.innerHTML = '<li class="pinmeta">주변 시설을 불러오지 못했습니다.</li>';
    return;
  }
  const spots = Ilteo.nearbyInfra(infraData, Number(p.lat), Number(p.lng), 2000);
  if (!spots.length) {
    infraList.innerHTML = '<li class="pinmeta">반경 2km 안에서 찾지 못했습니다.</li>';
    return;
  }
  infraList.innerHTML = spots.map(s =>
    `<li><i class="dot infra-${s.kind}"></i><span>${esc(s.name)}</span><em>${Ilteo.formatDistance(s.d)}</em></li>`
  ).join('') + '<li class="src-line">주변 시설: OpenStreetMap</li>';
  spots.forEach(s => {
    L.marker([s.lat, s.lng], { icon: infraIcon(s.kind), interactive: true, keyboard: false })
      .bindTooltip(s.name + ' · ' + Ilteo.formatDistance(s.d), { direction: 'top', offset: [0, -8] })
      .addTo(infraLayer);
  });
}

function chips(id, arr, key) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  arr.forEach(v => {
    const b = document.createElement('button');
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
  clearSelection();
  document.getElementById('count').textContent = '불러오는 중…';
  const body = { p_category: st.cat, p_city: st.city, p_limit: 5000 };
  if (st.bbox) Object.assign(body, st.bbox);
  let rows = await searchPlaces(body);
  rows = rows.filter(p => p.lat > 36.6 && p.lat < 37.2 && p.lng > 126.7 && p.lng < 127.4);
  const groups = Ilteo.groupPlaces(rows);
  const sites = Ilteo.clusterSites(groups);
  window.__groups = groups;
  window.__sites = sites;
  groupByPid = new Map();
  groups.forEach(g => g.forEach(p => groupByPid.set(p.pid, g)));
  cl.clearLayers();
  siteMarkers = new Map();
  const ms = [];
  sites.forEach(site => {
    const n = site.groups.length;
    const markerOpts = { companyCount: n, bubblingMouseEvents: false };
    if (n > 1) markerOpts.icon = countIcon(n);
    const marker = L.marker([site.lat, site.lng], markerOpts);
    if (n > 1) marker.bindPopup(sitePopupHtml(site), { autoPan: true, maxWidth: 280, minWidth: 220, className: 'pin-popup' });
    marker.on('click', () => {
      if (n === 1) selectGroup(site.groups[0]);
    });
    siteMarkers.set(site.key, marker);
    ms.push(marker);
  });
  cl.addLayers(ms);
  if (ms.length && !st.bbox) map.fitBounds(cl.getBounds(), { padding: [24, 24], maxZoom: 13, animate: false });
  document.getElementById('count').innerHTML = `${esc(st.cat)} <span style="color:#EC4600">${groups.length.toLocaleString()}</span>곳`;
  const ul = document.getElementById('list');
  ul.innerHTML = '';
  groups.slice(0, 200).forEach(group => {
    const p = group[0];
    const li = document.createElement('li');
    li.dataset.pid = p.pid;
    const extra = group.length > 1 ? ` · ${group.length}건` : '';
    li.innerHTML = `<b>${esc(p.name)}</b><span class="tag">${p.kind === 'factory' ? '공장' : '사업장'}</span><small>${esc(p.city)} · ${esc(p.industry || '')}${p.headcount ? ' · 가입자 ' + p.headcount + '명' : ''}${extra}</small>`;
    li.onclick = () => selectGroup(group);
    ul.appendChild(li);
  });
  if (groups.length > 200) {
    const li = document.createElement('li');
    li.style.cursor = 'default';
    li.innerHTML = '<small>목록은 200곳까지 표시 · 지도를 확대해 "이 지역 검색"을 눌러보세요</small>';
    ul.appendChild(li);
  }
}

document.getElementById('sheet-back').onclick = () => clearSelection();
document.getElementById('area').onclick = () => {
  const b = map.getBounds();
  st.bbox = { min_lat: b.getSouth(), min_lng: b.getWest(), max_lat: b.getNorth(), max_lng: b.getEast() };
  load();
};
document.getElementById('me').onclick = () => navigator.geolocation && navigator.geolocation.getCurrentPosition(pos => {
  map.setView([pos.coords.latitude, pos.coords.longitude], 14);
  L.circleMarker([pos.coords.latitude, pos.coords.longitude], { color: '#EC4600', radius: 6 }).addTo(map);
}, () => alert('위치 권한이 필요합니다'));
map.on('click', () => {
  if (suppressMapClick) return;
  if (document.body.classList.contains('detail-open')) clearSelection();
});
chips('cats', CATS, 'cat');
chips('cities', CITIES, 'city');
load();
