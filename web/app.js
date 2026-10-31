const U='https://zurfdfqfztydhbmjwyqx.supabase.co',K='sb_publishable_8asTfEEJyyDniSAITehVqg_fNAf1Oh7';
const CATS=['제조/생산','건설/공사','물류/운송','의료/요양/복지','IT/연구/기술','도소매/유통','시설관리/환경','사무/전문서비스','음식/숙박','교육','기타'];
const CITIES=['전체','천안시','아산시','평택시'];
let st={cat:new URLSearchParams(location.search).get('c')||'제조/생산',city:null,bbox:null};
const map=L.map('map').setView([36.88,127.05],10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
const cl=L.markerClusterGroup({chunkedLoading:true});map.addLayer(cl);
const esc=s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function chips(id,arr,key){const el=document.getElementById(id);el.innerHTML='';arr.forEach(v=>{const b=document.createElement('button');b.textContent=v;const val=v==='전체'?null:v;if(st[key]===val)b.className='on';b.onclick=()=>{st[key]=val;st.bbox=null;chips(id,arr,key);load()};el.appendChild(b)})}
async function load(){document.getElementById('count').textContent='불러오는 중…';
 const body={p_category:st.cat,p_city:st.city,p_limit:5000};if(st.bbox)Object.assign(body,st.bbox);
 let rows=[];for(let off=0;off<5000;off+=1000){const r=await fetch(U+'/rest/v1/rpc/search_places',{method:'POST',headers:{apikey:K,'Content-Type':'application/json',Range:off+'-'+(off+999)},body:JSON.stringify(body)});const d=await r.json();if(!Array.isArray(d))break;rows=rows.concat(d);if(d.length<1000)break}
 rows=rows.filter(p=>p.lat>36.6&&p.lat<37.2&&p.lng>126.7&&p.lng<127.4);window.__rows=rows.length;cl.clearLayers();const ms=[];
 rows.forEach(p=>{const m=L.marker([p.lat,p.lng]).bindPopup(`<b>${esc(p.name)}</b><br>${esc(p.address)}<br><span style="color:#808080">${esc(p.industry)}${p.headcount?' · 가입자 '+p.headcount+'명':''}</span>`);p.m=m;ms.push(m)});cl.addLayers(ms);
 if(ms.length&&!st.bbox)map.fitBounds(cl.getBounds(),{padding:[20,20]});
 document.getElementById('count').innerHTML=`${esc(st.cat)} <span style="color:#EC4600">${rows.length.toLocaleString()}</span>곳`;
 const ul=document.getElementById('list');ul.innerHTML='';
 rows.slice(0,200).forEach(p=>{const li=document.createElement('li');li.innerHTML=`<b>${esc(p.name)}</b><span class="tag">${p.kind==='factory'?'공장':'사업장'}</span><small>${esc(p.city)} · ${esc(p.industry)}${p.headcount?' · 가입자 '+p.headcount+'명':''}</small>`;li.onclick=()=>{cl.zoomToShowLayer(p.m,()=>p.m.openPopup());window.scrollTo({top:0,behavior:'smooth'})};ul.appendChild(li)});
 if(rows.length>200){const li=document.createElement('li');li.style.cursor='default';li.innerHTML='<small>목록은 200곳까지 표시 · 지도를 확대해 "이 지역 검색"을 눌러보세요</small>';ul.appendChild(li)}}
document.getElementById('area').onclick=()=>{const b=map.getBounds();st.bbox={min_lat:b.getSouth(),min_lng:b.getWest(),max_lat:b.getNorth(),max_lng:b.getEast()};load()};
document.getElementById('me').onclick=()=>navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{map.setView([p.coords.latitude,p.coords.longitude],14);L.circleMarker([p.coords.latitude,p.coords.longitude],{color:'#EC4600'}).addTo(map)},()=>alert('위치 권한이 필요합니다'));
chips('cats',CATS,'cat');chips('cities',CITIES,'city');load();
