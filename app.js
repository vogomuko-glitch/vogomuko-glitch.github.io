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
function nowHTML(day){
  const n=now(); if(day.d!==n.key) return `<div class="legend"><span><i class="o"></i>장소</span><span><i class="d"></i>이동 (점선 따라 내려가면 됨)</span></div>`;
  const toMin=t=>{const m=/(\d{1,2}):(\d{2})/.exec(t||'');return m?+m[1]*60+ +m[2]:null;};
  const timed=day.items.map((it,i)=>({it,i,m:toMin(it.t)})).filter(x=>x.m!=null);
  let curI=null,nextI=null; for(const x of timed){ if(x.m<=n.hm) curI=x; else { nextI=x; break; } }
  if(!curI&&nextI) curI=null;
  const lab=x=>x.it.k==='p'?esc(x.it.name):('이동 → '+esc(x.it.to));
  const dir=x=>x.it.k==='l'?gdir(x.it.q1,x.it.q2):gmap(x.it.q||x.it.name);
  return `<div class="now">
    <div class="nr"><span class="k">지금</span><b>${curI?lab(curI):'아직 시작 전'}</b></div>
    ${nextI?`<div class="nr"><span class="k">다음 ${esc(nextI.it.t)}</span><b>${lab(nextI)}</b><a class="go" target="_blank" rel="noopener" href="${dir(nextI)}">${ms('directions','s')}길찾기</a></div>`:`<div class="nr"><span class="k">다음</span><b>오늘 일정 끝</b></div>`}
  </div>`;
}
const STATUS={user:['내가 정한 시간','schedule',''],tt:['공식 시간표','verified','ok'],est:['예상 · 현장 확인','help','v'],v:['확인 필요','help','v']};

let INDEX=null, TRIP=null, cur=null;
let flights=LS.get('trip.flight',{});

async function loadJSON(p){ if(window.__BUNDLE__&&window.__BUNDLE__[p]) return window.__BUNDLE__[p]; const r=await fetch(p+(p.includes('?')?'&':'?')+'v='+(window.__V__||Date.now()),{cache:'no-store'}); return r.json(); }

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
  TRIP=null; document.body.classList.remove('cards'); window.onscroll=null; document.title='여행';
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
let mode=LS.get('trip.mode','cards'); // cards=리허설(기본) / list=전체 보기
const TYPE={walk:['도보','directions_walk'],ride:['탑승','directions_bus'],taxi:['택시','local_taxi'],buy:['창구','confirmation_number'],see:['관람','visibility'],do:['할 일','task_alt'],arrive:['도착','flag']};
const RIDE={directions_bus:'버스',subway:'지하철',train:'열차',tram:'전철',directions_boat:'배'};
function stepLabel(s){ // 한국 앱에서 익숙한 말로
  if(s.label) return [s.label,(TYPE[s.type]||TYPE.do)[1]];
  if(s.type==='ride'){ const m=/(バス|버스)/.test(s.a)?'directions_bus':/(지하철|가라스마선|요츠바시線|요츠바시선|四つ橋|肥後橋)/.test(s.a)?'subway':/(하루카|하시다테|新快速|신쾌속|긴테쓰|急行|JR)/.test(s.a)?'train':'directions_bus'; return [RIDE[m],m]; }
  return TYPE[s.type]||TYPE.do;
}
function renderTrip(){
  const tk=now().key;
  $('#top').innerHTML=`<div class="top-row"><a class="ib" href="#" aria-label="여행 목록">${ms('arrow_back')}</a><h1>${esc(TRIP.title)}</h1><button class="ib r" id="bMode" aria-label="보기 전환">${ms(mode==='cards'?'view_list':'view_carousel')}</button><button class="ib r" id="bInfo" aria-label="정보">${ms('info')}</button></div>
    <div class="days" role="tablist">${TRIP.days.map(d=>`<button role="tab" class="day ${d.id===cur?'on':''} ${d.d===tk?'today':''}" data-id="${d.id}" aria-selected="${d.id===cur}"><small>${esc(d.w)}</small><b class="num">${esc(d.d)}</b></button>`).join('')}</div>`;
  $('#top').querySelectorAll('.day').forEach(b=>b.onclick=()=>{cur=b.dataset.id;LS.set('trip.day.'+TRIP.id,cur);renderTrip();window.scrollTo(0,0);});
  $('#bMode').onclick=()=>{mode=mode==='cards'?'list':'cards';LS.set('trip.mode',mode);renderTrip();window.scrollTo(0,0);};
  $('#bInfo').onclick=()=>openSheet(`<h3>${esc(TRIP.title)}</h3><p class="lead">${esc(TRIP.dates)} · ${esc(TRIP.tzNote||TRIP.timezone)}</p>
    <div class="kv">${ms('home')}<div><b>${esc(TRIP.home.name)}</b><p>${esc(TRIP.home.address)}</p><small>${esc(TRIP.home.note||'')}</small></div></div>
    <div class="kv">${ms('view_carousel')}<div><b>리허설</b><p>한 장에 한 동작. 집에서 넘겨보며 장면을 외우는 용도. 사진이 이상하면 카드 번호를 알려줘.</p></div></div>
    <div class="kv">${ms('view_list')}<div><b>전체 보기</b><p>하루 전체 시간표. ${ms('verified','s')} 공식 시간표 · ${ms('schedule','s')} 내가 정한 시간 · ${ms('help','s')} 예상, 현장에서 확인</p></div></div>`);
  const day=TRIP.days.find(d=>d.id===cur);
  document.body.classList.remove('cards'); window.onscroll=null;
  if(mode==='cards'&&day.steps&&day.steps.length){ renderCards(day); return; }
  const nv=day.items.filter(i=>i.st==='v'||i.st==='est').length, np=day.items.filter(i=>i.k==='p').length;
  let h=`<div class="dh"><h2>${esc(day.title)}</h2><div class="city">${esc(day.city)}</div>
    <div class="meta">${day.home?`<span>${ms('home','s')}${esc(day.home)}</span>`:''}<span>${ms('location_on','s')}${np}곳</span>${nv?`<span class="warn">${ms('help','s')}현장 확인 ${nv}건</span>`:''}</div></div>`;
  h+=nowHTML(day);
  if(day.flight&&TRIP.returnCalc) h+=calcHTML();
  h+=`<div class="tl">${day.items.map((it,i)=>it.k==='p'?placeHTML(day,it,i):legHTML(day,it,i)).join('')}</div>`;
  $('#main').innerHTML=h;
  bindDay(day);
  document.querySelectorAll('iframe[data-src]').forEach(f=>{f.src=f.dataset.src;f.removeAttribute('data-src');});
  renderBar();
}
function factsHTML(it){
  const [sl,si,sc]=STATUS[it.st]||STATUS.est;
  const tags=(it.tags||[]).map(t=>{
    const money=/엔|€|₩|\$|무료|표$/.test(t), hours=/\d{1,2}:\d{2}|휴무|개문|마감|영업/.test(t);
    return `<span class="${money?'money':''}">${ms(money?'payments':hours?'schedule':'sell','s')}${esc(t)}</span>`; });
  return `<div class="facts"><span class="${sc}">${ms(si,'s')}${sl}</span>${tags.join('')}</div>`;
}
function placeHTML(day,it,i){
  let frame='';
  if(CAN_EMBED){
    const src=(it.lat&&!it.approx)?svurl(it.lat,it.lng,it.h||0):mapurl(it.q||it.name);
    frame=`<div class="sv"><div class="ph">${it.lat&&!it.approx?'로드뷰':'지도'} 불러오는 중</div><iframe title="${esc(it.name)}" data-src="${src}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;
  }
  return `<article class="it" data-i="${i}">
    <div class="tc"><b class="num">${esc(it.t)}</b>${it.approx?'위치 근사':''}</div>
    <div class="bd">
      <h3 class="nm">${esc(it.name)}</h3><div class="ja">${esc(it.ja)}</div>
      ${it.what?`<p class="what">${esc(it.what)}</p>`:''}${it.why?`<p class="why">${esc(it.why)}</p>`:''}
      ${factsHTML(it)}
      ${it.todo?`<div class="todo"><div class="cap">여기서 할 일</div>${it.todo.map(t=>`<div>${esc(t)}</div>`).join('')}</div>`:''}
      ${frame}
      <div class="acts">
        <a class="ab" target="_blank" rel="noopener" href="${gmap(it.q||it.name)}">${ms('map')}지도</a>
        ${it.lat?`<a class="ab" target="_blank" rel="noopener" href="${pano(it.lat,it.lng)}">${ms('streetview')}로드뷰</a>`:''}
      </div>
    </div></article>`;
}
function legHTML(day,it,i){
  const [sl,si,sc]=STATUS[it.st]||STATUS.est;
  const modes=[...new Set(it.steps.map(s=>s.icon))].map(n=>ms(n,'s')).join('');
  const total=(it.total||'').replace(/\s*·\s*(Suica OK|카드 OK)/,''); const card=/Suica OK|카드 OK/.test(it.total||'');
  return `<article class="it leg" data-i="${i}">
    <div class="tc"><b class="num">${esc(it.t)}</b></div>
    <div class="bd">
      <div class="lh"><span class="word">이동</span><span class="modes">${modes}</span><b>${esc(total)}</b><span class="dest">${esc(it.to)}까지</span>${card?`<span class="ok">${ms('contactless','s')}${esc(TRIP.transit.card.split(' ')[0])}</span>`:''}</div>
      <ul class="steps">${it.steps.map(s=>`<li>${ms(s.icon)}<span class="s">${esc(s.text)}${s.sub?`<small>${esc(s.sub)}</small>`:''}</span><span class="r num"><b>${esc(s.time)}</b>${esc(s.fare)}</span></li>`).join('')}</ul>
      ${it.alt?`<p class="note">대안 · ${esc(it.alt)}</p>`:''}${it.note?`<p class="note">${esc(it.note)}</p>`:''}
      <div class="acts"><a class="ab" target="_blank" rel="noopener" href="${gdir(it.q1,it.q2)}">${ms('directions')}길찾기</a><span class="ab muted ${sc}">${ms(si)}${sl}</span></div>
    </div></article>`;
}
function bindDay(day){
  const f=$('#flight'); if(f) f.oninput=()=>{flights[TRIP.id]=f.value;LS.set('trip.flight',flights);$('#calcOut').innerHTML=calcRows();};
}
function calcHTML(){ const rc=TRIP.returnCalc; return `<div class="calc"><label for="flight">${esc(rc.label)}</label><input id="flight" type="time" value="${esc(flights[TRIP.id]||'')}"><div id="calcOut">${calcRows()}</div><p class="hint">${rc.steps.map(s=>s[0].replace(/\s*\(.*\)/,'')+' '+s[1]+'분').join(' · ')}. ${esc(rc.hint||'')}</p></div>`; }
function calcRows(){
  const v=flights[TRIP.id]; if(!v) return '<table><tr><td>시각을 넣으면 몇 시에 나가야 하는지 나와</td><td>—</td></tr></table>';
  const [h,m]=v.split(':').map(Number); let t=h*60+m; const f=x=>{x=((x%1440)+1440)%1440;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');};
  return '<table>'+TRIP.returnCalc.steps.map(s=>{t-=s[1];return `<tr><td>${esc(s[0])}</td><td class="num">${f(t)}</td></tr>`;}).join('')+'</table>';
}

/* ---------- 리허설: 세로로 쭉, 왼쪽 점이 스크롤 따라 움직임 ---------- */
let stepIdx=LS.get('trip.step',{});
/* ---------- 리허설 v4: 한 덩어리 = 한 장소. 안에 동작 줄들. ---------- */
function rowHTML(s,k,n){
  const [tn,ti]=stepLabel(s); const sayItem=s.say!=null?TRIP.phrases[s.say-1]:null;
  let head='';
  if(s.type==='ride'){
    head=`<div class="r1">${s.line?`<span class="line">${esc(s.line)}</span>`:''}<b>${tn}</b>${s.dur?` ${esc(s.dur)}`:''}${s.fare?`<span class="dot">·</span>${esc(s.fare)}`:''}${s.t?`<span class="tm num">${esc(s.t)}</span>`:''}</div>
          ${(s.on||s.off)?`<div class="r2">${s.on?esc(s.on):''}${s.on&&s.off?' <span class="arr">→</span> ':''}${s.off?esc(s.off):''}${s.stops?` <span class="dim">(${esc(s.stops)})</span>`:''}</div>`:''}`;
  } else {
    head=`<div class="r1"><b>${tn}</b>${s.dur?` ${esc(s.dur)}`:''}${s.fare?`<span class="dot">·</span>${esc(s.fare)}`:''}${(s.t&&!s.place)?`<span class="tm num">${esc(s.t)}</span>`:''}</div>`;
  }
  let img='';
  if(CAN_EMBED&&s.v){ img=`<div class="cv"><div class="ph">로드뷰</div><iframe title="장면" data-src="${svurl(s.v.lat,s.v.lng,s.v.h||0)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><span class="cap">${esc(s.v.cap||'')}</span></div>`; }
  else if(s.v){ img=`<a class="imglink" target="_blank" rel="noopener" href="${pano(s.v.lat,s.v.lng)}">${ms('streetview','s')}${esc(s.v.cap||'로드뷰')}</a>`; }
  return `<div class="row" id="s${k}" data-k="${k}">${ms(ti)}<div class="rbd">
    ${head}
    <p class="r3">${esc(s.text||[s.a,s.b,s.more].filter(Boolean).join(' '))}</p>
    ${sayItem?`<button class="say" data-say="${s.say-1}">${ms('translate','s')}<b>${esc(sayItem[1])}</b></button>`:''}
    ${img}
  </div></div>`;
}
function renderCards(day){
  const steps=day.steps, n=steps.length;
  const anchors=steps.map((st,k)=>st.place?k:-1).filter(k=>k>=0);
  // 그룹: 장소(anchor)부터 다음 장소 전까지. 첫 장소 전 단계는 첫 그룹에 포함
  const groups=[]; anchors.forEach((k,ai)=>{ const from=ai===0?0:k, to=ai+1<anchors.length?anchors[ai+1]:n; groups.push({k,ai,from,to}); });
  const rail=`<aside class="rail" aria-label="오늘 장소">${anchors.map((k,ai)=>`<button class="rd" data-k="${k}"><b></b><span>${esc(steps[k].place)}</span></button>${ai<anchors.length-1?`<i class="seg" data-ai="${ai}"></i>`:''}`).join('')}</aside>`;
  const mins=x=>{if(!x)return 0;let m=0;const h=/(\d+)\s*시간/.exec(x);if(h)m+=+h[1]*60;const mm=/(\d+)\s*분/.exec(x);if(mm)m+=+mm[1];return m;};
  const fmt=m=>m>=60?`${Math.floor(m/60)}시간${m%60?' '+m%60+'분':''}`:`${m}분`;
  const walk=steps.filter(x=>x.type==='walk').reduce((a,x)=>a+mins(x.dur),0), move=steps.filter(x=>/^(ride|taxi)$/.test(x.type)).reduce((a,x)=>a+mins(x.dur),0);
  const fare=steps.reduce((a,x)=>{const m=/([\d,]+)\s*엔/.exec(x.fare||'');return a+(m?+m[1].replace(/,/g,''):0);},0);
  const summ=`<div class="dsum"><span><b>${fmt(move+walk)}</b> 이동</span><span>도boo</span></div>`.replace('<span>도boo</span>',`<span>도보 <b>${fmt(walk)}</b></span>${fare?`<span>교통비 약 <b>${fare.toLocaleString()}엔</b></span>`:''}`);
  const body=groups.map(g=>{ const p=steps[g.k];
    const rows=[]; for(let k=g.from;k<g.to;k++) rows.push(rowHTML(steps[k],k,n));
    const q=p.v?gmap(p.v.lat+','+p.v.lng):gmap(p.q||p.a);
    return `<section class="grp" id="g${g.ai}" data-ai="${g.ai}">
      <h3 class="stop"><span>${esc(p.place)}</span>${p.t?`<small class="num">${esc(p.t)}</small>`:''}</h3>
      ${rows.join('')}
      <div class="gft"><a target="_blank" rel="noopener" href="${q}">${ms('map','s')}${esc(p.place)} 지도</a><button class="lost" data-k="${g.k}">${ms('sos','s')}길 잃음</button></div>
    </section>`; }).join('');
  document.body.classList.add('cards');
  $('#main').innerHTML=`<div class="rw">${rail}<div class="col"><div class="ctx" id="ctx"></div>${summ}${body}<p class="end">오늘 끝</p></div></div>`;
  renderBar();
  const hdr=()=>(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr'))||150);
  const setNow=ai=>{
    document.querySelectorAll('.rail .rd').forEach((b,i)=>{ b.classList.toggle('now',i===ai); b.classList.toggle('past',i<ai); });
    document.querySelectorAll('.rail .seg').forEach((sg,i)=>{ sg.classList.toggle('past',i<ai); sg.classList.remove('live'); });
    $('#ctx').innerHTML=`${ms('location_on','s')}<b>${esc(steps[anchors[ai]].place)}</b><span class="dim">${ai+1} / ${anchors.length}</span>`;
    stepIdx[TRIP.id+':'+day.id]=ai; LS.set('trip.step',stepIdx);
  };
  const gs=[...document.querySelectorAll('.grp')];
  const io=new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting){ e.target.querySelectorAll('iframe[data-src]').forEach(f=>{f.src=f.dataset.src;f.removeAttribute('data-src');}); } }); },{rootMargin:'500px 0px'});
  gs.forEach(g=>io.observe(g));
  const pick=()=>{ const line=hdr()+30; let best=gs[0]; for(const g of gs){ if(g.getBoundingClientRect().top<=line) best=g; else break; } setNow(+best.dataset.ai); };
  let raf=0; window.onscroll=()=>{ if(!raf) raf=requestAnimationFrame(()=>{raf=0;pick();}); };
  const jump=ai=>{ const el=$('#g'+ai); window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-hdr()+6,behavior:'smooth'}); };
  document.querySelectorAll('.rail .rd').forEach((b,i)=>b.onclick=()=>jump(i));
  document.querySelectorAll('.say').forEach(b=>b.onclick=()=>{ const ph=TRIP.phrases[+b.dataset.say]; openSheet(`<h3>이거 보여줘</h3><p class="lead">${esc(ph[0])}</p><div class="bigsay">${esc(ph[1])}</div><p style="color:var(--accent);font-size:16px">${esc(ph[2])}</p>`); });
  document.querySelectorAll('.lost').forEach(b=>b.onclick=()=>{ const s=steps[+b.dataset.k]; openSheet(`<h3>길 잃었을 때</h3><p class="lead">당황하지 말고 둘 중 하나.</p>
    <a class="cta" target="_blank" rel="noopener" href="${s.v?gdir('현재 위치',s.v.lat+','+s.v.lng):gdir('현재 위치',s.q||s.a)}">${ms('directions','s')} ${esc(s.place||'가려던 곳')}으로 길찾기</a>
    <a class="cta" target="_blank" rel="noopener" href="${gdir('현재 위치',TRIP.home.q,'driving')}">${ms('local_taxi','s')} 택시 타고 숙소</a>
    <div class="kv" style="margin-top:14px">${ms('badge')}<div><b>택시 기사에게</b><p>${esc(TRIP.phrases[0][1])}</p><small>${esc(TRIP.home.address)}</small></div></div>`); });
  const ai0=stepIdx[TRIP.id+':'+day.id]||0; setNow(0);
  if(ai0>0&&gs[ai0]){ requestAnimationFrame(()=>{ window.scrollTo(0,gs[ai0].getBoundingClientRect().top+window.scrollY-hdr()+6); setTimeout(pick,50); }); }
}

/* ---------- 하단 바 / 시트 ---------- */
function renderBar(){
  const b=$('#bar'); b.hidden=false;
  b.innerHTML=`<div class="wrap"><button id="bKit">${ms('contactless')}<span>교통</span></button><button id="bSay">${ms('translate')}<span>한마디</span></button><a href="${gdir('현재 위치',TRIP.home.q)}" target="_blank" rel="noopener">${ms('home')}<span>숙소</span></a></div>`;
  $('#bKit').onclick=()=>openSheet(`<h3>교통</h3><p class="lead">${esc(TRIP.transit.card)} 하나로 거의 다 됨.</p>${TRIP.transit.kit.map(k=>`<div class="kv">${ms(k.icon)}<div><b>${esc(k.title)}</b><p>${esc(k.body)}</p>${k.sub?`<small>${esc(k.sub)}</small>`:''}</div></div>`).join('')}`);
  $('#bSay').onclick=()=>openSheet(`<h3>한마디</h3><p class="lead">화면 그대로 보여줘도 됨.</p>${TRIP.phrases.map(p=>`<div class="ph"><div class="ko">${esc(p[0])}</div><div class="jp">${esc(p[1])}</div><div class="ro">${esc(p[2])}</div></div>`).join('')}`);
}
const sheet=$('#sheet'), pn=$('#pn');
function openSheet(html){ pn.innerHTML=`<div class="grab"></div>${html}<button class="close" id="cl">닫기</button>`; sheet.hidden=false; $('#cl').onclick=()=>sheet.hidden=true; }
sheet.onclick=e=>{ if(e.target===sheet) sheet.hidden=true; };

(document.fonts?document.fonts.load('300 24px "Material Symbols Outlined"'):Promise.resolve()).then(()=>document.documentElement.classList.add('icons')).catch(()=>document.documentElement.classList.add('icons'));
setTimeout(()=>document.documentElement.classList.add('icons'),4000);
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js?v='+(window.__V__||'0')).catch(()=>{});
boot().catch(e=>{ $('#main').innerHTML=`<p style="padding:40px 0;color:var(--ink2)">데이터를 못 불러왔어. 새로고침 해봐.<br><small>${esc(e.message)}</small></p>`; });
})();
