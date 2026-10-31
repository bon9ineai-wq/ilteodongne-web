const U = 'https://zurfdfqfztydhbmjwyqx.supabase.co';
const K = 'sb_publishable_8asTfEEJyyDniSAITehVqg_fNAf1Oh7';
const root = document.getElementById('detail');
const q = new URLSearchParams(location.search);
const RING = '#7EB6E6';
const RINGS = [
  { m: 1000, label: '1km · 도보 15분' },
  { m: 2000, label: '2km · 자전거 10분' },
  { m: 3000, label: '3km · 차 5분' }
];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function row(table, label, value) {
  if (value == null || value === '') return;
  const tr = el('tr');
  tr.appendChild(el('th', null, label));
  tr.appendChild(el('td', null, String(value)));
  table.appendChild(tr);
}

function showError(msg) {
  root.replaceChildren(el('p', null, msg));
  const back = el('a', 'back', '지도로 돌아가기');
  back.href = '/ilteodongne-web/';
  root.appendChild(back);
}

function numParam(name) {
  const raw = q.get(name);
  if (raw == null || raw === '') return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function coordsFromQuery() {
  const lat = numParam('lat');
  const lng = numParam('lng');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return null;
  return { lat, lng };
}

function coordsFromWkb(hex) {
  if (!hex || hex.length < 42 || hex.length % 2) return null;
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < buf.length; i++) buf[i] = parseInt(hex.substr(i * 2, 2), 16);
  const view = new DataView(buf.buffer);
  const le = buf[0] === 1;
  const type = view.getUint32(1, le);
  let offset = 5;
  if (type & 0x20000000) offset += 4;
  if (offset + 16 > buf.length) return null;
  const lng = view.getFloat64(offset, le);
  const lat = view.getFloat64(offset + 8, le);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function addBase(map) {
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  });
  const key = String(window.VWORLD_KEY || '').trim();
  if (!key) { osm.addTo(map); return; }
  let switched = false, errors = 0, loaded = 0;
  const vworld = L.tileLayer('https://api.vworld.kr/req/wmts/1.0.0/' + encodeURIComponent(key) + '/Base/{z}/{y}/{x}.png', {
    maxZoom: 19,
    attribution: '© 국토지리정보원 · 브이월드'
  });
  vworld.on('tileload', () => { loaded++; });
  vworld.on('tileerror', () => {
    errors++;
    if (!switched && loaded === 0 && errors >= 4) {
      switched = true;
      map.removeLayer(vworld);
      osm.addTo(map);
    }
  });
  vworld.addTo(map);
}

function drawMap(lat, lng, parts) {
  const map = L.map('place-map', { maxZoom: 16, minZoom: 9, zoomAnimation: false });
  addBase(map);
  RINGS.forEach(s => {
    L.circle([lat, lng], {
      radius: s.m, color: RING, weight: 2, dashArray: '7 7', fillColor: RING, fillOpacity: 0.05, interactive: false
    }).addTo(map);
    const latOff = s.m / 111320;
    L.marker([lat + latOff, lng], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: 'ring-label',
        html: '<span>' + s.label + '</span>',
        iconSize: [150, 22],
        iconAnchor: [75, 11]
      })
    }).addTo(map);
  });
  L.marker([lat, lng], {
    zIndexOffset: 800,
    interactive: false,
    icon: L.divIcon({ className: 'sel-wrap', html: '<div class="sel-pin"></div>', iconSize: [42, 42], iconAnchor: [21, 40] })
  }).addTo(map);
  (parts || []).forEach(part => part.nearest.forEach(s => {
    L.marker([s.lat, s.lng], {
      keyboard: false,
      icon: L.divIcon({ className: 'infra-icon infra-' + s.kind, html: '<span></span>', iconSize: [14, 14], iconAnchor: [7, 7] })
    }).bindTooltip(s.name + ' · ' + Ilteo.formatDistance(s.d), { direction: 'top', offset: [0, -8] }).addTo(map);
  }));
  map.fitBounds(L.latLng(lat, lng).toBounds(6800), { padding: [18, 18], maxZoom: 14, animate: false });
  setTimeout(() => map.invalidateSize(), 60);
  return map;
}

function fillInfra(box, list, infra, lat, lng) {
  const parts = Ilteo.infraSummary(infra, lat, lng, 2000);
  const shown = parts.filter(part => part.n);
  list.replaceChildren();
  if (!shown.length) {
    list.appendChild(el('li', 'pinmeta', '반경 2km 안에서 찾지 못했습니다.'));
  } else {
    shown.forEach(part => {
      const block = el('details', 'fac');
      if (part.kind === 'pharmacy' || part.kind === 'bus') block.open = true;
      block.appendChild(el('summary', null, part.label + ' ' + part.n));
      const items = el('ul');
      part.nearest.forEach(s => {
        const li = el('li');
        li.appendChild(el('i', 'dot infra-' + s.kind));
        const span = el('span');
        span.appendChild(el('b', null, s.name));
        if (s.hoursText) span.appendChild(el('small', s.open ? 'open' : null, s.hoursText + (s.open ? ' · 지금 열림' : '')));
        (s.badges || []).forEach(b => {
          span.appendChild(el('i', 'pill' + (b === '응급실' ? ' em' : b === '야간' ? ' night' : ' weekend'), b));
        });
        li.appendChild(span);
        li.appendChild(el('em', null, Ilteo.formatDistance(s.d)));
        items.appendChild(li);
      });
      block.appendChild(items);
      list.appendChild(block);
    });
  }
  box.appendChild(el('p', 'src-line', '약국·의료기관: 국립중앙의료원 (공공데이터포털)'));
  box.appendChild(el('p', 'src-line', '버스정류장·편의점: OpenStreetMap'));
  return parts;
}

function addRent(parent, city, address) {
  const box = el('section', 'block');
  box.appendChild(el('h2', null, '주변 월세'));
  parent.appendChild(box);
  return fetch(Ilteo.BASE + 'data/rent.json').then(r => {
    if (!r.ok) throw new Error('rent');
    return r.json();
  }).then(rows => {
    const rent = Ilteo.matchRent(rows, city, address);
    if (!rent || !rent.bands.length) {
      box.appendChild(el('p', 'pinmeta', '이 지역 월세 집계가 없습니다.'));
      return;
    }
    const level = rent.level === 'dong' ? '동' : rent.level === 'eupmyeon' ? '읍·면' : '시';
    const where = el('p', 'where', rent.label + ' ');
    where.appendChild(el('span', 'badge', level));
    box.appendChild(where);
    const table = el('table', 'rent');
    table.innerHTML = '<thead><tr><th>유형</th><th>보증금</th><th>월세</th><th>거래</th></tr></thead>';
    const tb = el('tbody');
    rent.bands.forEach(b => {
      const tr = el('tr');
      [b.short, b.dep + '만', b.rent + '만', b.n.toLocaleString()].forEach(v => tr.appendChild(el('td', null, v)));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(table);
    if (rent.level === 'city') box.appendChild(el('p', 'pinmeta', '주소에서 동·읍면을 특정하지 못해 시 전체 값입니다.'));
    if (rent.level === 'eupmyeon') box.appendChild(el('p', 'pinmeta', '읍·면 안의 리 거래를 합쳤습니다. 월세는 거래건수로 가중했습니다.'));
    box.appendChild(el('p', 'src-line', '국토교통부 실거래가 (2025.10~2026.09)'));
  }).catch(() => box.appendChild(el('p', 'pinmeta', '월세 정보를 불러오지 못했습니다.')));
}

async function main() {
  const pid = q.get('pid') || '';
  const m = /^([cf])(\d+)$/.exec(pid);
  if (!m) {
    showError('사업장을 찾을 수 없습니다.');
    return;
  }
  const company = m[1] === 'c';
  const select = company
    ? 'id,name,city,address,industry,headcount,size_band,source,location'
    : 'id,name,city,address,products,source,location';
  const table = company ? 'companies' : 'factories';
  let rec;
  try {
    const r = await fetch(`${U}/rest/v1/${table}?id=eq.${m[2]}&select=${select}`, {
      headers: { apikey: K, Accept: 'application/json' }
    });
    const d = await r.json();
    rec = Array.isArray(d) ? d[0] : null;
  } catch (e) {
    showError('사업장 정보를 불러오지 못했습니다.');
    return;
  }
  if (!rec) {
    showError('사업장을 찾을 수 없습니다.');
    return;
  }
  document.title = `${rec.name} | 일터동네`;
  const city = rec.city || q.get('city') || '';
  const address = rec.address || q.get('address') || '';
  const coords = coordsFromQuery() || coordsFromWkb(rec.location);

  root.replaceChildren();
  const grid = el('div', 'detail-grid');
  const mainCol = el('div', 'detail-main');
  const rest = el('div', 'detail-rest');
  const mapCol = el('aside', 'detail-map');
  const mapEl = el('div');
  mapEl.id = 'place-map';
  mapCol.appendChild(mapEl);
  mainCol.appendChild(el('p', 'kicker', company ? '사업장' : '공장'));
  mainCol.appendChild(el('h1', null, rec.name));
  const kv = el('table', 'kv');
  row(kv, '지역', city);
  row(kv, '주소', address);
  row(kv, '업종', rec.industry);
  row(kv, '생산품', rec.products);
  row(kv, '가입자', rec.headcount != null ? rec.headcount + '명' : '');
  row(kv, '규모', rec.size_band);
  row(kv, '출처', rec.source);
  mainCol.appendChild(kv);

  const infraBox = el('section', 'block');
  const heading = el('h2', null, '주변 생활');
  heading.appendChild(el('span', null, '반경 2km'));
  infraBox.appendChild(heading);
  const infraList = el('div');
  infraList.id = 'infra-list';
  infraBox.appendChild(infraList);

  grid.appendChild(mainCol);
  grid.appendChild(mapCol);
  grid.appendChild(rest);
  root.appendChild(grid);

  addRent(rest, city, address);
  rest.appendChild(infraBox);
  const back = el('a', 'back', '지도로 돌아가기');
  back.href = '/ilteodongne-web/' + (pid ? '?pid=' + encodeURIComponent(pid) : '');
  rest.appendChild(back);

  if (!coords) {
    infraList.appendChild(el('p', 'pinmeta', '이 사업장의 좌표가 없어 주변 시설을 표시할 수 없습니다.'));
    mapCol.remove();
    return;
  }

  let infra = null;
  try {
    const r = await fetch(Ilteo.BASE + 'data/infra.json');
    if (!r.ok) throw new Error('infra ' + r.status);
    infra = await r.json();
  } catch (e) {
    infraList.appendChild(el('p', 'pinmeta', '주변 시설을 불러오지 못했습니다.'));
  }
  const parts = infra ? fillInfra(infraBox, infraList, infra, coords.lat, coords.lng) : [];
  drawMap(coords.lat, coords.lng, parts);
}

main();
