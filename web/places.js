/* Grouping, detail URLs, rent matching, and nearby-place distance.
   The site is served under /ilteodongne-web/. */
(function (root) {
  var BASE = '/ilteodongne-web/';
  var BAND_RANK = ['원룸', '투룸', '쓰리룸', '85'];

  function norm(s) {
    return String(s || '').replace(/\s+/g, '').toLowerCase();
  }

  function normalizeName(s) {
    var t = String(s || '')
      .replace(/[\u00a0\u3000\u2000-\u200B\uFEFF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    t = t.replace(/[（(]\s*주\s*[)）]/g, '(주)');
    t = t.replace(/㈜/g, '(주)');
    t = t.replace(/주식회사/g, '(주)');
    t = t.replace(/\(주\)\s+/g, '(주)');
    if (/\(주\)$/.test(t) && t.indexOf('(주)') !== 0) t = '(주)' + t.slice(0, -3);
    t = t.replace(/^(?:\(주\)){2,}/, '(주)');
    return t.replace(/\s+/g, ' ').trim();
  }

  function placeUrl(p) {
    var pid = typeof p === 'string' ? p : p.pid;
    var q = new URLSearchParams();
    q.set('pid', pid);
    if (p && typeof p === 'object') {
      if (p.lat != null) q.set('lat', String(p.lat));
      if (p.lng != null) q.set('lng', String(p.lng));
      if (p.city) q.set('city', p.city);
      if (p.address) q.set('address', p.address);
    }
    return BASE + 'place/?' + q.toString();
  }

  function coordKey(p) {
    var lat = Number(p.lat), lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
    return lat.toFixed(5) + ',' + lng.toFixed(5);
  }

  function workplaceKey(p) {
    var name = norm(p.name);
    var addr = norm(p.address);
    var coord = coordKey(p);
    if (name && addr) return 'na:' + name + '|' + addr;
    if (name && coord) return 'nc:' + name + '|' + coord;
    return 'id:' + (p.pid || '');
  }

  function groupPlaces(rows) {
    var byPid = new Map();
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      if (!p || p.pid == null || p.lat == null || p.lng == null) continue;
      if (!byPid.has(p.pid)) byPid.set(p.pid, p);
    }
    var groups = new Map();
    byPid.forEach(function (p) {
      var key = workplaceKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    return Array.from(groups.values());
  }

  function clusterSites(groups) {
    var sites = new Map();
    groups.forEach(function (g) {
      var p = g[0];
      var key = coordKey(p);
      if (!key) return;
      if (!sites.has(key)) sites.set(key, { key: key, lat: Number(p.lat), lng: Number(p.lng), groups: [] });
      sites.get(key).groups.push(g);
    });
    return Array.from(sites.values());
  }

  function adminParts(address) {
    var s = String(address || '');
    var found = [];
    var re = /([가-힣]{1,12}(?:동|읍|면|리))/g;
    var m;
    while ((m = re.exec(s))) found.push(m[1]);
    return {
      gu: s.indexOf('동남구') !== -1 ? '동남구' : (s.indexOf('서북구') !== -1 ? '서북구' : ''),
      eupmyeon: found.filter(function (t) { return /(?:읍|면)$/.test(t); }),
      dong: found.filter(function (t) { return /동$/.test(t); }),
      ri: found.filter(function (t) { return /리$/.test(t); })
    };
  }

  function scopedRent(rows, city, address) {
    var parts = adminParts(address);
    return rows.filter(function (r) {
      var rc = r.city || '';
      if (city === '천안시' || rc.indexOf('천안시') === 0 && String(city || '').indexOf('천안') !== -1) {
        if (rc.indexOf('천안시') !== 0) return false;
        if (parts.gu && rc.indexOf(parts.gu) === -1) return false;
        return true;
      }
      return rc === city;
    });
  }

  function bandRank(band) {
    for (var i = 0; i < BAND_RANK.length; i++) {
      if (String(band).indexOf(BAND_RANK[i]) === 0) return i;
    }
    return 9;
  }

  function aggregateBands(rows) {
    var by = new Map();
    rows.forEach(function (r) {
      var g = by.get(r.band);
      var n = Number(r.n) || 0;
      if (!g) {
        g = { band: r.band, n: 0, depW: 0, rentW: 0 };
        by.set(r.band, g);
      }
      g.n += n;
      g.depW += Number(r.dep) * n;
      g.rentW += Number(r.rent) * n;
    });
    return Array.from(by.values()).map(function (g) {
      return {
        band: g.band,
        n: g.n,
        dep: g.n ? Math.round(g.depW / g.n) : null,
        rent: g.n ? Math.round(g.rentW / g.n) : null
      };
    }).sort(function (a, b) { return bandRank(a.band) - bandRank(b.band); });
  }

  function shortBand(band) {
    if (band.indexOf('원룸') === 0) return '원룸';
    if (band.indexOf('투룸') === 0) return '투룸';
    if (band.indexOf('쓰리룸') === 0) return '쓰리룸';
    return '85㎡ 초과';
  }

  function matchRent(rows, city, address) {
    if (!rows || !rows.length || !city) return null;
    var scoped = scopedRent(rows, city, address);
    if (!scoped.length) return null;
    var parts = adminParts(address);
    var eup = parts.eupmyeon.length ? parts.eupmyeon[parts.eupmyeon.length - 1] : '';
    var dong = parts.dong.length ? parts.dong[parts.dong.length - 1] : '';
    var ri = parts.ri.length ? parts.ri[parts.ri.length - 1] : '';
    var cityLabel = city === '천안시' && parts.gu ? '천안시 ' + parts.gu : city;

    function pack(hits, place, level) {
      return { label: cityLabel + ' ' + place, level: level, bands: aggregateBands(hits).map(function (b) {
        b.short = shortBand(b.band);
        return b;
      }) };
    }

    if (eup && ri) {
      var exactRi = scoped.filter(function (r) { return r.umd === eup + ' ' + ri; });
      if (exactRi.length) return pack(exactRi, eup + ' ' + ri, 'dong');
    }
    if (dong) {
      var exactDong = scoped.filter(function (r) { return r.umd === dong; });
      if (exactDong.length) return pack(exactDong, dong, 'dong');
    }
    if (eup) {
      var em = scoped.filter(function (r) { return r.umd === eup || r.umd.indexOf(eup + ' ') === 0; });
      if (em.length) return pack(em, eup, 'eupmyeon');
    }
    var whole = city === '천안시' && !parts.gu ? '천안시 전체' : cityLabel + ' 전체';
    return { label: whole, level: 'city', bands: aggregateBands(scoped).map(function (b) {
      b.short = shortBand(b.band);
      return b;
    }) };
  }

  function haversine(aLat, aLng, bLat, bLng) {
    var R = 6371000;
    var p1 = aLat * Math.PI / 180, p2 = bLat * Math.PI / 180;
    var dphi = (bLat - aLat) * Math.PI / 180, dl = (bLng - aLng) * Math.PI / 180;
    var s = Math.sin(dphi / 2) * Math.sin(dphi / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  var CLINIC_GROUP = {
    '의원': ['clinic', '의원'],
    '치과의원': ['dental', '치과'],
    '치과병원': ['dental', '치과'],
    '한의원': ['korean', '한의원'],
    '한방병원': ['korean', '한의원'],
    '병원': ['hospital', '병원'],
    '요양병원': ['hospital', '병원'],
    '종합병원': ['hospital', '병원'],
    '보건소': ['health', '보건소']
  };
  var WEEKDAY = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };

  function pointOf(p) {
    if (Array.isArray(p)) return { lat: p[0], lng: p[1], name: p[2] || '', rec: null };
    return { lat: p.lat, lng: p.lon, name: p.n || '', rec: p };
  }

  function seoulClock(now) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now || new Date());
    var o = {};
    parts.forEach(function (p) { if (p.type !== 'literal') o[p.type] = p.value; });
    var hour = o.hour === '24' ? '00' : o.hour;
    return { day: WEEKDAY[o.weekday] || 'mon', hm: hour + ':' + o.minute };
  }

  function inSpan(hm, span) {
    if (!span || !span[0] || !span[1]) return false;
    if (span[1] > span[0]) return hm >= span[0] && hm < span[1];
    return hm >= span[0] || hm < span[1];
  }

  function placeHours(rec, now) {
    if (!rec || !rec.h) return { text: '', open: false };
    var clock = seoulClock(now);
    var span = rec.h[clock.day];
    if (!span) return { text: '오늘 휴무', open: false };
    return { text: span[0] + '–' + span[1], open: inSpan(clock.hm, span) };
  }

  function placeBadges(rec) {
    if (!rec) return [];
    var out = [];
    if (rec.night) out.push('야간');
    if (rec.sat || rec.sun) out.push('주말');
    if (rec.em) out.push('응급실');
    return out;
  }

  function collect(pts, lat, lng, radiusM, kind, label) {
    var scored = [];
    for (var i = 0; i < pts.length; i++) {
      var pt = pointOf(pts[i]);
      var d = haversine(lat, lng, pt.lat, pt.lng);
      if (d > radiusM) continue;
      var hours = placeHours(pt.rec);
      scored.push({
        kind: kind, label: label, lat: pt.lat, lng: pt.lng, name: pt.name || label, d: d,
        hoursText: hours.text, open: hours.open, badges: placeBadges(pt.rec)
      });
    }
    scored.sort(function (a, b) { return a.d - b.d; });
    return scored;
  }

  function infraSummary(infra, lat, lng, radiusM) {
    infra = infra || {};
    var groups = [
      ['bus', '버스정류장', infra.bus || []],
      ['convenience', '편의점', infra.convenience || []],
      ['pharmacy', '약국', infra.pharmacy || []]
    ];
    var clinics = { clinic: [], dental: [], korean: [], hospital: [], health: [] };
    (infra.clinic || []).forEach(function (rec) {
      var g = CLINIC_GROUP[rec.t];
      if (g) clinics[g[0]].push(rec);
    });
    groups.push(['clinic', '의원', clinics.clinic]);
    groups.push(['dental', '치과', clinics.dental]);
    groups.push(['korean', '한의원', clinics.korean]);
    groups.push(['hospital', '병원', clinics.hospital]);
    groups.push(['health', '보건소', clinics.health]);
    return groups.map(function (g) {
      var scored = collect(g[2], lat, lng, radiusM, g[0], g[1]);
      return { kind: g[0], label: g[1], n: scored.length, nearest: scored.slice(0, 3), items: scored };
    });
  }

  function formatDistance(m) {
    if (m < 1000) return Math.max(1, Math.round(m / 10) * 10) + 'm';
    return (m / 1000).toFixed(1) + 'km';
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function infraRowHtml(s) {
    var badges = (s.badges || []).map(function (b) {
      var cls = b === '응급실' ? ' em' : b === '야간' ? ' night' : ' weekend';
      return '<i class="pill' + cls + '">' + escapeHtml(b) + '</i>';
    }).join('');
    var hours = s.hoursText
      ? '<small class="' + (s.open ? 'open' : '') + '">' + escapeHtml(s.hoursText) + (s.open ? ' · 지금 열림' : '') + '</small>'
      : '';
    return '<li class="infra-item" data-kind="' + s.kind + '" data-lat="' + s.lat + '" data-lng="' + s.lng + '"><i class="dot infra-' + s.kind + '"></i><span><b>' + escapeHtml(s.name) + '</b>' + hours + badges + '</span><em>' + formatDistance(s.d) + '</em></li>';
  }

  function infraGroupHtml(part, open) {
    var preview = (part.items || part.nearest || []).slice(0, 3).map(infraRowHtml).join('');
    var rest = (part.items || []).slice(3).map(infraRowHtml).join('');
    var more = part.n > 3
      ? '<button type="button" class="more-infra" data-n="' + part.n + '">모두 보기 (' + part.n + '곳)</button>'
      : '';
    return '<details class="fac"' + (open ? ' open' : '') + '><summary><i class="chev" aria-hidden="true"></i><span>' + escapeHtml(part.label) + ' ' + part.n + '</span></summary><ul>' + preview + '</ul><ul class="infra-rest" hidden>' + rest + '</ul>' + more + '</details>';
  }

  root.Ilteo = {
    BASE: BASE,
    placeUrl: placeUrl,
    normalizeName: normalizeName,
    coordKey: coordKey,
    groupPlaces: groupPlaces,
    clusterSites: clusterSites,
    matchRent: matchRent,
    infraSummary: infraSummary,
    placeHours: placeHours,
    formatDistance: formatDistance,
    infraGroupHtml: infraGroupHtml
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
