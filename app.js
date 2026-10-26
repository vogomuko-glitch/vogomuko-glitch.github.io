/* 여행 앱 셸. 여행 데이터는 trips/*.json — 화면 코드는 나라와 무관. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ms=(n,c='')=>`<span class="ms ${c}" aria-hidden="true">${n}</span>`;
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const gmap=q=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
const gdir=(a,b,m='transit')=>'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(a)+'&destination='+encodeURIComponent(b)+'&travelmode='+m;
const pano=(lat,lng)=>'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='+lat+','+lng;
const svurl=(lat,lng,h=0)=>'https://maps.google.com/maps?q=&layer=c&cbll='+lat+','+lng+'&cbp=11,'+h+',0,0,0&output=svembed';
const mapurl=q=>'https://maps.google.com/maps?q='+encodeURIComponent(q)+'&z=16&hl=ko&output=embed';
const CAN_EMBED=!/claude|artifact/.test(location.hostname);
const STATUS={user:['내가 정한 시간','schedule',''],tt:['공식 시간표','verified','ok'],est:['예상 · 현장 확인','help','v'],v:['확인 필요','help','v']};

let INDEX=null, TRIP=null, cur=null;
let marks=LS.get('trip.marks',{}), flights=LS.get('trip.flight',{});

async function loadJSON(p){ if(window.__BUNDLE__&&window.__BUNDLE__[p]) return window.__BUNDLE__[p]; const r=await fetch(p,{cache:'no-cache'}); return r.json(); }

/* ---------- 라우팅 ---------- */
function tripIdFromHash(){ const h=location.hash.replace(/^#/,''); return h||null; }
async function boot(){
  INDEX=await loadJSON('trips/index.json');
  const id=tripIdFromHash()||LS.get('trip.last',null);
  const t=INDEX.trips.find(x=>x.id===id);
  if(t) await openTrip(t); else renderHome();
  window.addEventListener('hashchange',()=>{const id=tripIdFromHash();const t=INDEX.trips.find(x=>x.id===id);if(t)openTrip(t);else renderHome();});
}
function fail(e){ $('#main').innerHTML=`<p style="padding:40px 0;color:var(--ink2)">데이터를 못 불러왔어. 새로고침 해봐.<br><small>${esc(e&&e.message||e)}</small></p>`; }
async function openTrip(meta){
  try{ TRIP=await loadJSON(meta.file); }catch(e){ return fail(e); }
  LS.set('trip.last',TRIP.id);
  if(location.hash!=='#'+TRIP.id) history.replaceState(null,'','#'+TRIP.id);
  document.title=TRIP.title;
  cur=LS.get('trip.day.'+TRIP.id,null); if(!TRIP.days.some(d=>d.id===cur)) cur=TRIP.days[todayIndex()].id;
  renderTrip(); window.scrollTo(0,0);
}

/* ---------- 시작 화면 ---------- */
function renderHome(){
  TRIP=null; document.title='여행';
  $('#top').innerHTML=`<div class="top-row"><h1>여행</h1></div>`;
  $('#bar').hidden=true;
  $('#main').innerHTML=`<section class="home">
    <h2>내 여행</h2><p class="lead">날짜별 동선, 가는 법, 요금, 로드뷰까지 한 화면에.</p>
    ${INDEX.trips.map(t=>`<button class="trip" data-id="${t.id}"><div><b>${esc(t.title)}</b><span>${esc(t.subtitle||'')} · ${esc(t.dates)}</span></div>${ms('chevron_right')}</button>`).join('')}
    <button class="trip new" id="newTrip"><div><b>새 여행 만들기</b><span>나라를 고르면 취향에 맞춰 플랜을 짜줘요</span></div>${ms('add')}</button>
  </section>`;
  $('#newTrip').onclick=newTripSheet;
  document.querySelectorAll('.trip[data-id]').forEach(b=>b.onclick=()=>{const t=INDEX.trips.find(x=>x.id===b.dataset.id);if(t)openTrip(t);});
}
function newTripSheet(){
  const countries=['일본','대만','태국','베트남','홍콩','싱가포르','프랑스','이탈리아','스페인','포르투갈','영국','미국'];
  let pick=null;
  openSheet(`<h3>새 여행</h3><p class="lead">어디로 가? 날짜랑 취향 몇 개만 알려주면 맞춤 일정을 만들어줄게.</p>
    <div class="sect">나라</div><div class="chips" id="cc">${countries.map(c=>`<button class="chip" data-c="${c}">${c}</button>`).join('')}</div>
    <div class="field"><label>도시 (선택)</label><input id="nc" placeholder="예: 교토"></div>
    <div class="field"><label>날짜</label><input id="nd" placeholder="예: 2027-03-01 ~ 03-05"></div>
    <div class="sect">취향</div><div class="chips">${['건축·공간','미술관','차·카페','자연·산책','시장·식도락','러닝','쇼핑은 최소'].map(c=>`<button class="chip" data-t="${c}">${c}</button>`).join('')}</div>
    <button class="cta dis" id="go">플랜 만들기 — 준비 중</button>
    <p class="fine">지금은 Claude에게 이 조건을 말하고 trips 폴더에 JSON으로 받아 넣으면 바로 앱에 떠. 자동 생성은 다음 버전.</p>`);
  $('#pn').querySelectorAll('.chip').forEach(b=>b.onclick=()=>{ if(b.dataset.c){ $('#pn').querySelectorAll('[data-c]').forEach(x=>x.classList.remove('on')); b.classList.add('on'); pick=b.dataset.c; } else b.classList.toggle('on'); });
}

/* ---------- 여행 화면 ---------- */
function now(){ const n=new Date(); return {key:(n.getMonth()+1)+'/'+n.getDate(),hm:n.getHours()*60+n.getMinutes()}; }
function todayIndex(){ const k=now().key; const i=TRIP.days.findIndex(d=>d.d===k); return i<0?0:i; }
function renderTrip(){
  const tk=now().key;
  $('#top').innerHTML=`<div class="top-row"><a class="ib" href="#" aria-label="여행 목록">${ms('arrow_back')}</a><h1>${esc(TRIP.title)}</h1><button class="ib r" id="bInfo" aria-label="정보">${ms('info')}</button></div>
    <div class="days" role="tablist">${TRIP.days.map(d=>`<button role="tab" class="day ${d.id===cur?'on':''} ${d.d===tk?'today':''}" data-id="${d.id}" aria-selected="${d.id===cur}"><small>${esc(d.w)}</small><b class="num">${esc(d.d)}</b></button>`).join('')}</div>`;
  $('#top').querySelectorAll('.day').forEach(b=>b.onclick=()=>{cur=b.dataset.id;LS.set('trip.day.'+TRIP.id,cur);renderTrip();window.scrollTo(0,0);});
  $('#bInfo').onclick=()=>openSheet(`<h3>${esc(TRIP.title)}</h3><p class="lead">${esc(TRIP.dates)} · ${esc(TRIP.tzNote||TRIP.timezone)}</p>
    <div class="kv">${ms('home')}<div><b>${esc(TRIP.home.name)}</b><p>${esc(TRIP.home.address)}</p><small>${esc(TRIP.home.note||'')}</small></div></div>
    <div class="kv">${ms('rule')}<div><b>표시 규칙</b><p>${ms('verified','s')} 공식 시간표 · ${ms('schedule','s')} 내가 정한 시간 · ${ms('help','s')} 예상, 현장에서 확인</p><small>"위치 근사"는 지도 핀이 대략적이라는 뜻. 가게 이름으로 지도 열기 눌러서 확인.</small></div></div>`);
  const day=TRIP.days.find(d=>d.id===cur);
  const nv=day.items.filter(i=>i.st==='v'||i.st==='est').length, np=day.items.filter(i=>i.k==='p').length;
  let h=`<div class="dh"><h2>${esc(day.title)}</h2><div class="city">${esc(day.city)}</div>
    <div class="meta">${day.home?`<span>${ms('home','s')}${esc(day.home)}</span>`:''}<span>${ms('location_on','s')}${np}곳</span>${nv?`<span class="warn">${ms('help','s')}현장 확인 ${nv}건</span>`:''}</div></div>`;
  if(day.flight&&TRIP.returnCalc) h+=calcHTML();
  h+=`<div class="tl">${day.items.map((it,i)=>it.k==='p'?placeHTML(day,it,i):legHTML(day,it,i)).join('')}</div>`;
  $('#main').innerHTML=h;
  bindDay(day);
  document.querySelectorAll('iframe[data-src]').forEach(f=>{f.src=f.dataset.src;f.removeAttribute('data-src');});
  renderBar();
}
const mk=(day,i)=>marks[TRIP.id+':'+day.id+':'+i]||'';
function factsHTML(it){
  const [sl,si,sc]=STATUS[it.st]||STATUS.est;
  const tags=(it.tags||[]).map(t=>{
    const money=/엔|€|₩|\$|무료|표$/.test(t), hours=/\d{1,2}:\d{2}|휴무|개문|마감|영업/.test(t);
    return `<span class="${money?'money':''}">${ms(money?'payments':hours?'schedule':'sell','s')}${esc(t)}</span>`; });
  return `<div class="facts"><span class="${sc}">${ms(si,'s')}${sl}</span>${tags.join('')}</div>`;
}
function placeHTML(day,it,i){
  const m=mk(day,i);
  let frame='';
  if(CAN_EMBED){
    const src=(it.lat&&!it.approx)?svurl(it.lat,it.lng,it.h||0):mapurl(it.q||it.name);
    frame=`<div class="sv"><div class="ph">${it.lat&&!it.approx?'로드뷰':'지도'} 불러오는 중</div><iframe title="${esc(it.name)}" data-src="${src}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;
  }
  return `<article class="it ${m}" data-i="${i}">
    <div class="tc"><b class="num">${esc(it.t)}</b>${it.approx?'위치 근사':''}</div>
    <div class="bd">
      <h3 class="nm">${esc(it.name)}</h3><div class="ja">${esc(it.ja)}</div>
      ${it.what?`<p class="what">${esc(it.what)}</p>`:''}${it.why?`<p class="why">${esc(it.why)}</p>`:''}
      ${factsHTML(it)}
      ${it.todo?`<div class="todo">${it.todo.map(t=>`<div>${ms('check_box_outline_blank','s')}<span>${esc(t)}</span></div>`).join('')}</div>`:''}
      ${frame}
      <div class="acts">
        <a class="ab" target="_blank" rel="noopener" href="${gmap(it.q||it.name)}">${ms('map')}지도</a>
        ${it.lat?`<a class="ab" target="_blank" rel="noopener" href="${pano(it.lat,it.lng)}">${ms('streetview')}로드뷰</a>`:''}
        <button class="ab ${m==='done'?'on':''}" data-m="done">${ms(m==='done'?'check_circle':'radio_button_unchecked')}다녀옴</button>
        <button class="ab muted" data-m="skip">${ms(m==='skip'?'undo':'skip_next')}${m==='skip'?'되돌리기':'건너뜀'}</button>
      </div>
    </div></article>`;
}
function legHTML(day,it,i){
  const m=mk(day,i); const [sl,si,sc]=STATUS[it.st]||STATUS.est;
  const modes=[...new Set(it.steps.map(s=>s.icon))].map(n=>ms(n,'s')).join('');
  const total=(it.total||'').replace(/\s*·\s*(Suica OK|카드 OK)/,''); const card=/Suica OK|카드 OK/.test(it.total||'');
  return `<article class="it leg ${m}" data-i="${i}">
    <div class="tc"><b class="num">${esc(it.t)}</b></div>
    <div class="bd">
      <div class="lh"><span class="modes">${modes}</span><b>${esc(total)}</b><span class="dest">${esc(it.to)}까지</span>${card?`<span class="ok">${ms('contactless','s')}${esc(TRIP.transit.card.split(' ')[0])}</span>`:''}</div>
      <ul class="steps">${it.steps.map(s=>`<li>${ms(s.icon)}<span class="s">${esc(s.text)}${s.sub?`<small>${esc(s.sub)}</small>`:''}</span><span class="r num"><b>${esc(s.time)}</b>${esc(s.fare)}</span></li>`).join('')}</ul>
      ${it.alt?`<p class="note">대안 · ${esc(it.alt)}</p>`:''}${it.note?`<p class="note">${esc(it.note)}</p>`:''}
      <div class="acts"><a class="ab" target="_blank" rel="noopener" href="${gdir(it.q1,it.q2)}">${ms('directions')}길찾기</a><span class="ab muted ${sc}">${ms(si)}${sl}</span><button class="ab ${m==='done'?'on':''}" data-m="done">${ms(m==='done'?'check_circle':'radio_button_unchecked')}완료</button></div>
    </div></article>`;
}
function bindDay(day){
  document.querySelectorAll('.it [data-m]').forEach(b=>b.onclick=()=>{const i=b.closest('.it').dataset.i,k=TRIP.id+':'+day.id+':'+i,v=b.dataset.m;marks[k]=marks[k]===v?'':v;LS.set('trip.marks',marks);renderTrip();});
  const f=$('#flight'); if(f) f.oninput=()=>{flights[TRIP.id]=f.value;LS.set('trip.flight',flights);$('#calcOut').innerHTML=calcRows();};
}
function calcHTML(){ const rc=TRIP.returnCalc; return `<div class="calc"><label for="flight">${esc(rc.label)}</label><input id="flight" type="time" value="${esc(flights[TRIP.id]||'')}"><div id="calcOut">${calcRows()}</div><p class="hint">${rc.steps.map(s=>s[0].replace(/\s*\(.*\)/,'')+' '+s[1]+'분').join(' · ')}. ${esc(rc.hint||'')}</p></div>`; }
function calcRows(){
  const v=flights[TRIP.id]; if(!v) return '<table><tr><td>시각을 넣으면 몇 시에 나가야 하는지 나와</td><td>—</td></tr></table>';
  const [h,m]=v.split(':').map(Number); let t=h*60+m; const f=x=>{x=((x%1440)+1440)%1440;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');};
  return '<table>'+TRIP.returnCalc.steps.map(s=>{t-=s[1];return `<tr><td>${esc(s[0])}</td><td class="num">${f(t)}</td></tr>`;}).join('')+'</table>';
}

/* ---------- 하단 바 / 시트 ---------- */
function renderBar(){
  const b=$('#bar'); b.hidden=false;
  b.innerHTML=`<div class="wrap"><button id="bKit">${ms('contactless')}교통</button><button id="bSay">${ms('translate')}한마디</button><a href="${gdir('현재 위치',TRIP.home.q)}" target="_blank" rel="noopener">${ms('home')}숙소로</a></div>`;
  $('#bKit').onclick=()=>openSheet(`<h3>교통</h3><p class="lead">${esc(TRIP.transit.card)} 하나로 거의 다 됨.</p>${TRIP.transit.kit.map(k=>`<div class="kv">${ms(k.icon)}<div><b>${esc(k.title)}</b><p>${esc(k.body)}</p>${k.sub?`<small>${esc(k.sub)}</small>`:''}</div></div>`).join('')}`);
  $('#bSay').onclick=()=>openSheet(`<h3>한마디</h3><p class="lead">화면 그대로 보여줘도 됨.</p>${TRIP.phrases.map(p=>`<div class="ph"><div class="ko">${esc(p[0])}</div><div class="jp">${esc(p[1])}</div><div class="ro">${esc(p[2])}</div></div>`).join('')}`);
}
const sheet=$('#sheet'), pn=$('#pn');
function openSheet(html){ pn.innerHTML=`<div class="grab"></div>${html}<button class="close" id="cl">닫기</button>`; sheet.hidden=false; $('#cl').onclick=()=>sheet.hidden=true; }
sheet.onclick=e=>{ if(e.target===sheet) sheet.hidden=true; };

(document.fonts?document.fonts.load('300 24px "Material Symbols Outlined"'):Promise.resolve()).then(()=>document.documentElement.classList.add('icons')).catch(()=>document.documentElement.classList.add('icons'));
setTimeout(()=>document.documentElement.classList.add('icons'),4000);
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
boot().catch(e=>{ $('#main').innerHTML=`<p style="padding:40px 0;color:var(--ink2)">데이터를 못 불러왔어. 새로고침 해봐.<br><small>${esc(e.message)}</small></p>`; });
})();
