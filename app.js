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
  TRIP=null; document.body.classList.remove('cards'); document.title='여행';
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
const TYPE={walk:['걷기','directions_walk'],ride:['타기','directions_bus'],taxi:['택시','local_taxi'],buy:['사기·맡기기','confirmation_number'],see:['보기','visibility'],do:['하기','task_alt'],arrive:['도착','flag']};
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
  document.body.classList.remove('cards');
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

/* ---------- 리허설 카드 ---------- */
let stepIdx=LS.get('trip.step',{});
function renderCards(day){
  const n=day.steps.length; let i=Math.min(stepIdx[TRIP.id+':'+day.id]||0,n-1); if(i<0)i=0;
  const s=day.steps[i]; const [tn,ti]=TYPE[s.type]||TYPE.do;
  const sayItem=s.say!=null?TRIP.phrases[s.say-1]:null;
  let view;
  if(CAN_EMBED){
    const src=s.v?svurl(s.v.lat,s.v.lng,s.v.h||0):mapurl(s.q||s.a);
    view=`<div class="cv"><div class="ph">${s.v?'로드뷰':'지도'} 불러오는 중</div><iframe title="장면" data-src="${src}" loading="eager" referrerpolicy="no-referrer-when-downgrade"></iframe>${s.v&&s.v.cap?`<span class="cap">${esc(s.v.cap)}</span>`:''}${!s.v?`<span class="cap">지도 · ${esc(s.q||'')}</span>`:''}</div>`;
  } else view=`<div class="cv flat"><a class="big" target="_blank" rel="noopener" href="${s.v?pano(s.v.lat,s.v.lng):gmap(s.q||s.a)}">${ms(s.v?'streetview':'map')} ${s.v?'로드뷰 열기':'지도 열기'}</a></div>`;
  const meta=[s.t?`<b class="num">${esc(s.t)}</b>`:'',s.dur?esc(s.dur):'',s.fare?esc(s.fare):''].filter(Boolean).join('<i>·</i>');
  // 왼쪽 세로 타임라인: 장소(see/arrive/do)만 점으로. 지금 장소 = 채운 점, 이동 중 = 두 점 사이 굵은 선
  const isPlace=st=>!!st.place;
  const anchors=day.steps.map((st,k)=>isPlace(st)?k:-1).filter(k=>k>=0);
  let at=-1; anchors.forEach((k,ai)=>{ if(k<=i) at=ai; });            // 지나온 마지막 장소
  const atPlace=at>=0&&anchors[at]===i;                               // 지금 장소에 있음
  const moving=!atPlace;                                              // 장소 사이 이동/준비 중
  const nextA=at+1<anchors.length?anchors[at+1]:null;
  const shortName=st=>st.place||st.a.slice(0,5);
  const rail=`<aside class="rail" aria-label="오늘 장소">${anchors.map((k,ai)=>{
    const st=day.steps[k]; const cls=ai===at&&atPlace?'now':(ai<=at?'past':'');
    const seg=ai<anchors.length-1?`<i class="seg ${moving&&ai===at?'live':''} ${ai<at?'past':''}"></i>`:'';
    return `<button class="rd ${cls}" data-k="${k}"><b></b><span>${esc(shortName(st))}</span></button>${seg}`; }).join('')}</aside>`;
  const ctx=atPlace?`${ms('location_on','s')}지금 ${at+1}/${anchors.length} · <b>${esc(shortName(day.steps[anchors[at]]))}</b>`
    :(nextA!=null?`${ms('directions_walk','s')}이동 중 → <b>${esc(shortName(day.steps[nextA]))}</b>${at>=0?` <span class="dim">(${esc(shortName(day.steps[anchors[at]]))}에서)</span>`:''}`:`${ms('flag','s')}오늘 마지막`);
  document.body.classList.add('cards');
  $('#main').innerHTML=`<div class="rw">${rail}<section class="rc">
    <div class="ctx">${ctx}</div>
    <div class="rh"><span class="ty">${ms(ti)}${tn}</span><span class="rm">${meta}</span><span class="pg num">${i+1} / ${n}</span></div>
    ${view}
    <h2 class="ra">${esc(s.a)}</h2>
    ${s.b?`<p class="rb">${ms('visibility','s')}${esc(s.b)}</p>`:''}
    ${sayItem?`<button class="say" id="saySheet">${ms('translate','s')}보여줄 말: <b>${esc(sayItem[1])}</b></button>`:''}
    ${s.more?`<details class="rmore"><summary>자세히</summary><p>${esc(s.more)}</p></details>`:''}
    <div class="racts">
      <a target="_blank" rel="noopener" href="${s.v?gmap(s.v.lat+','+s.v.lng):gmap(s.q||s.a)}">${ms('map','s')}지도</a>
      ${s.v?`<a target="_blank" rel="noopener" href="${pano(s.v.lat,s.v.lng)}">${ms('streetview','s')}로드뷰 크게</a>`:''}
      <button id="lost">${ms('sos','s')}길 잃음</button>
    </div>
  </section></div>
  <nav class="rn"><button id="prev" ${i===0?'disabled':''}>${ms('arrow_back')}이전</button><button id="next" class="pri" ${i===n-1?'disabled':''}>다음${ms('arrow_forward')}</button></nav>`;
  const go=d=>{stepIdx[TRIP.id+':'+day.id]=Math.max(0,Math.min(n-1,i+d));LS.set('trip.step',stepIdx);renderCards(day);window.scrollTo(0,0);};
  $('#prev').onclick=()=>go(-1); $('#next').onclick=()=>go(1);
  document.querySelectorAll('.rail .rd').forEach(b=>b.onclick=()=>go(+b.dataset.k-i));
  if(sayItem) $('#saySheet').onclick=()=>openSheet(`<h3>이거 보여줘</h3><p class="lead">${esc(sayItem[0])}</p><div class="bigsay">${esc(sayItem[1])}</div><p class="ro" style="color:var(--accent);font-size:16px">${esc(sayItem[2])}</p>`);
  $('#lost').onclick=()=>openSheet(`<h3>길 잃었을 때</h3><p class="lead">당황하지 말고 둘 중 하나.</p>
    <a class="cta" target="_blank" rel="noopener" href="${s.v?gdir('현재 위치',s.v.lat+','+s.v.lng):gdir('현재 위치',s.q||s.a)}">${ms('directions','s')} 지금 가려던 곳으로 길찾기</a>
    <a class="cta" target="_blank" rel="noopener" href="${gdir('현재 위치',TRIP.home.q,'driving')}">${ms('local_taxi','s')} 택시 타고 숙소</a>
    <div class="kv" style="margin-top:14px">${ms('badge')}<div><b>택시 기사에게</b><p>${esc(TRIP.phrases[0][1])}</p><small>${esc(TRIP.home.address)}</small></div></div>`);
  // 스와이프
  let x0=null; const rc=$('.rc'); rc.ontouchstart=e=>{x0=e.touches[0].clientX}; rc.ontouchend=e=>{ if(x0==null)return; const dx=e.changedTouches[0].clientX-x0; x0=null; if(Math.abs(dx)>60) go(dx<0?1:-1); };
  document.querySelectorAll('iframe[data-src]').forEach(f=>{f.src=f.dataset.src;f.removeAttribute('data-src');});
  renderBar();
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
