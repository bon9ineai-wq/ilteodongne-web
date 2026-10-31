const U = 'https://zurfdfqfztydhbmjwyqx.supabase.co';
const K = 'sb_publishable_8asTfEEJyyDniSAITehVqg_fNAf1Oh7';
const root = document.getElementById('detail');
const q = new URLSearchParams(location.search);

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

function addRent(city, address) {
  const box = el('section', 'block');
  box.appendChild(el('h2', null, '주변 월세'));
  root.appendChild(box);
  fetch('/ilteodongne-web/data/rent.json').then(r => r.json()).then(rows => {
    const rent = Ilteo.matchRent(rows, city, address);
    if (!rent || !rent.bands.length) {
      box.appendChild(el('p', 'pinmeta', '이 지역 월세 집계가 없습니다.'));
      return;
    }
    box.appendChild(el('p', 'where', rent.label));
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

function addInfra(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const box = el('section', 'block');
  const h = el('h2', null, '주변 생활');
  h.appendChild(el('span', null, ' 반경 2km'));
  box.appendChild(h);
  const ul = el('ul', null);
  ul.id = 'infra-list';
  box.appendChild(ul);
  root.appendChild(box);
  fetch('/ilteodongne-web/data/infra.json').then(r => r.json()).then(infra => {
    const parts = Ilteo.infraSummary(infra, lat, lng, 2000).filter(part => part.n);
    if (!parts.length) {
      ul.appendChild(el('li', 'pinmeta', '반경 2km 안에서 찾지 못했습니다.'));
      return;
    }
    parts.forEach(part => {
      const block = el('details', 'fac');
      block.appendChild(el('summary', null, part.label + ' ' + part.n));
      const items = el('ul');
      part.nearest.forEach(s => {
        const li = el('li');
        li.appendChild(el('i', 'dot infra-' + s.kind));
        const span = el('span');
        span.appendChild(el('b', null, s.name));
        if (s.hoursText) {
          const small = el('small', s.open ? 'open' : null, s.hoursText + (s.open ? ' · 지금 열림' : ''));
          span.appendChild(small);
        }
        (s.badges || []).forEach(b => {
          const pill = el('i', 'pill' + (b === '응급실' ? ' em' : b === '야간' ? ' night' : ' weekend'), b);
          span.appendChild(pill);
        });
        li.appendChild(span);
        li.appendChild(el('em', null, Ilteo.formatDistance(s.d)));
        items.appendChild(li);
      });
      block.appendChild(items);
      ul.appendChild(block);
    });
    box.appendChild(el('p', 'src-line', '약국·의료기관: 국립중앙의료원 (공공데이터포털)'));
    box.appendChild(el('p', 'src-line', '버스정류장·편의점: OpenStreetMap'));
  }).catch(() => ul.appendChild(el('li', 'pinmeta', '주변 시설을 불러오지 못했습니다.')));
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
    ? 'id,name,city,address,industry,headcount,size_band,source'
    : 'id,name,city,address,products,source';
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
  root.replaceChildren();
  root.appendChild(el('p', 'kicker', company ? '사업장' : '공장'));
  root.appendChild(el('h1', null, rec.name));
  const kv = el('table', 'kv');
  row(kv, '지역', city);
  row(kv, '주소', address);
  row(kv, '업종', rec.industry);
  row(kv, '생산품', rec.products);
  row(kv, '가입자', rec.headcount != null ? rec.headcount + '명' : '');
  row(kv, '규모', rec.size_band);
  row(kv, '출처', rec.source);
  root.appendChild(kv);
  addRent(city, address);
  addInfra(Number(q.get('lat')), Number(q.get('lng')));
  const back = el('a', 'back', '지도로 돌아가기');
  back.href = '/ilteodongne-web/';
  root.appendChild(back);
}

main();
