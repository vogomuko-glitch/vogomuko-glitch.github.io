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

let INDEX=null, TRIP=null, cur=null; let GL=[], NM={}; // 일본어 이름 → {ko,en,code}
let flights=LS.get('trip.flight',{});

async function loadJSON(p){ if(window.__BUNDLE__&&window.__BUNDLE__[p]) return window.__BUNDLE__[p];
  const k='trip.cache.'+p;
  try{ const r=await fetch(p+(p.includes('?')?'&':'?')+'v='+(window.__V__||Date.now()),{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json(); LS.set(k,j); return j; }
  catch(e){ const c=LS.get(k,null); if(c){ window.__OFFLINE__=true; return c; } throw e; } }

/* ---------- 라우팅 ---------- */
function tripIdFromHash(){ const h=location.hash.replace(/^#/,''); return h||null; }
async function boot(){
  INDEX=await loadJSON('trips/index.json');
  const id=tripIdFromHash()||LS.get('trip.last',null);
  const t=INDEX.trips.find(x=>x.id===id);
  if(t) await openTrip(t); else renderHome();
  window.addEventListener('hashchange',()=>{const id=tripIdFromHash();const t=INDEX.trips.find(x=>x.id===id);if(t)openTrip(t);else renderHome();});
}
function fail(e){ $('#main').innerHTML=`<div class="col" style="padding:40px 0"><p style="color:var(--t1);font-size:16px;font-weight:600;margin:0 0 6px">일정을 못 불러왔어</p><p style="color:var(--t2);margin:0 0 18px;font-size:14px">인터넷이 끊겼거나 서버가 잠깐 안 됨. 한 번 열어본 뒤엔 오프라인에서도 열려.</p><button class="cta" id="retry">다시 시도</button><small style="display:block;margin-top:10px;color:var(--t2)">${esc(e&&e.message||e)}</small></div>`; const b=$('#retry'); if(b) b.onclick=()=>location.reload(); }
async function openTrip(meta){
  try{ TRIP=await loadJSON(meta.file); }catch(e){ return fail(e); }
  NM=TRIP.names||{}; GL=Object.keys(NM).sort((a,b)=>b.length-a.length); GLRE=null;
  LS.set('trip.last',TRIP.id);
  if(location.hash!=='#'+TRIP.id) history.replaceState(null,'','#'+TRIP.id);
  document.title=TRIP.title;
  cur=LS.get('trip.day.'+TRIP.id,null); if(!TRIP.days.some(d=>d.id===cur)) cur=TRIP.days[todayIndex()].id;
  renderTrip(); window.scrollTo(0,0);
}

/* ---------- 시작 화면 ---------- */
function renderHome(){
  TRIP=null; document.body.classList.remove('cards'); window.onscroll=null; document.documentElement.classList.remove('scrolled'); document.title='여행';
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
let mode='cards'; let view=LS.get('trip.view','home'); // home|days|stay|prep
const TYPE={walk:['도보','directions_walk'],ride:['탑승','directions_bus'],taxi:['택시','local_taxi'],buy:['창구','confirmation_number'],see:['관람','visibility'],do:['할 일','task_alt'],arrive:['도착','flag']};
const RIDE={directions_bus:'버스',subway:'지하철',train:'열차',tram:'전철',directions_boat:'배'};
const MODEICON={walk:'directions_walk',taxi:'local_taxi',citybus:'directions_bus',loop:'directions_bus',flat:'directions_bus',kyotobus:'directions_bus',tankai:'directions_bus',bus:'directions_bus','subway-k':'subway','subway-y':'subway','subway-t':'subway','subway-m':'subway',jr:'train',ltd:'train',kintetsu:'train',nankai:'train'};
function stepLabel(s){ // 한국 앱에서 익숙한 말로
  if(s.label) return [s.label,(TYPE[s.type]||TYPE.do)[1]];
  if(s.type==='ride'){ const m=/(バス|버스)/.test(s.a)?'directions_bus':/(지하철|가라스마선|요츠바시線|요츠바시선|四つ橋|肥後橋)/.test(s.a)?'subway':/(하루카|하시다테|新快速|신쾌속|긴테쓰|急行|JR)/.test(s.a)?'train':'directions_bus'; return [RIDE[m],m]; }
  return TYPE[s.type]||TYPE.do;
}
function setView(v){ view=v; LS.set('trip.view',v); renderTrip(); window.scrollTo(0,0); }
function renderTrip(){
  if(view==='home') return renderCover();
  if(view==='stay') return renderStay();
  if(view==='prep') return renderPrep();
  const tk=now().key;
  $('#top').innerHTML=`<div class="top-row"><button class="ib" id="bHome" aria-label="표지">${ms('arrow_back')}</button><h1>${esc(TRIP.title)}</h1><button class="ib r" id="bInfo" aria-label="정보">${ms('info')}</button></div>
    <div class="days" role="tablist">${TRIP.days.map(d=>`<button role="tab" class="day ${d.id===cur?'on':''} ${d.d===tk?'today':''}" data-id="${d.id}" aria-selected="${d.id===cur}" style="--dc:${esc(d.color||'#000')}"><small>${esc(d.w)}</small><b class="num">${esc(d.d)}</b><i class="dcb"></i></button>`).join('')}</div><div class="pbar" id="pbar" hidden></div>`;
  $('#top').querySelectorAll('.day').forEach(b=>b.onclick=()=>{cur=b.dataset.id;LS.set('trip.day.'+TRIP.id,cur);renderTrip();window.scrollTo(0,0);});
  $('#bHome').onclick=()=>setView('home'); $('#bInfo').onclick=()=>openSheet(`<h3>${esc(TRIP.title)}</h3><p class="lead">${esc(TRIP.dates)} · ${esc(TRIP.tzNote||TRIP.timezone)}</p>${(TRIP.info||[]).map(k=>`<div class="kv">${ms(k.icon)}<div><b>${esc(k.title)}</b><p>${esc(k.body)}</p>${k.sub?`<small>${esc(k.sub)}</small>`:''}</div></div>`).join('')}`);
  const day=TRIP.days.find(d=>d.id===cur);
  document.body.classList.remove('cards'); window.onscroll=null; const pb0=$('#pbar'); if(pb0) pb0.hidden=true;
  if(!day.steps||!day.steps.length){ document.body.classList.add('cards'); $('#main').innerHTML=`<div class="col"><p class="end" style="padding:60px 0;color:var(--t2)">아직 비어 있음</p></div>`; const pb=$('#pbar'); if(pb) pb.hidden=true; renderBar(); return; }
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
let GLRE=null;
/* 표지 글자: 한글(굵게) + 회색 작게 日本語 · English · 역번호 */
const nmHTML=(ja,full)=>{ const n=NM[ja]; if(!n) return esc(ja); const sub=full?[ja,n.en,n.code].filter(Boolean).join(' · '):ja; return `<span class="kj"><b>${esc(n.ko)}</b><i>${esc(sub)}</i></span>`; };
const KO=ja=>nmHTML(ja,true);
function koify(txt){ // {{...}} 안은 그대로(주소 등)
  if(!GLRE){ const keys=GL.map(g=>g.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')); GLRE=keys.length?new RegExp(keys.join('|'),'g'):null; }
  return String(txt).split(/\{\{(.+?)\}\}/).map((seg,i)=> i%2 ? esc(seg) : (GLRE? esc(seg).replace(GLRE,m=>nmHTML(m,false)) : esc(seg)) ).join('');
}
const dirHTML=ja=>{ // "竹田·奈良" 방면
  const parts=ja.split('·'); const ko=parts.map(x=>NM[x]?NM[x].ko:x).join('·'), en=parts.map(x=>NM[x]?NM[x].en:x).filter(Boolean).join('/');
  return `<span class="kj"><b>${esc(ko)} 방면</b><i>${esc(ja)}方面${en?' · For '+esc(en):''}</i></span>`; };
function mdfmt(x){ // **X** 방면 → 방면 표기, 나머지 ** ** 는 굵게
  const out=[]; let last=0; const re=/\*\*(.+?)\*\*(\s*방면)?/g; let m;
  while((m=re.exec(x))){ out.push(koify(x.slice(last,m.index))); out.push(m[2]&&!m[1].includes('{{')?dirHTML(m[1]):`<b>${koify(m[1])}</b>`); last=re.lastIndex; }
  out.push(koify(x.slice(last))); return out.join('');
}
function rowHTML(s,k,n){
  let [tn,ti]=stepLabel(s); if(MODEICON[s.mode]) ti=MODEICON[s.mode]; const sayItem=s.say!=null?TRIP.phrases[s.say-1]:null;
  const P=(TRIP.places||{})[s.pid];
  const tm=(s.t&&!s.place)?`<span class="tm num">${esc(s.t)}</span>`:'';
  let head='', body='';
  if(s.type==='ride'){
    const meta=[s.kind||tn,s.stops?esc(s.stops):'',s.dur?esc(s.dur):'',s.pay?esc(s.pay):(s.fare?esc(s.fare):'')].filter(Boolean).join(' · ');
    head=`${s.onName?`<div class="node on">${KO(s.onName)}${s.onSub?`<em>${esc(s.onSub)}</em>`:''}</div>`:''}
      <div class="bl"><span class="badge">${esc(s.line||tn)}</span><span class="sub">${meta}</span>${tm}</div>`;
    const kv=(lb,v)=>v?`<div class="kv2"><span class="lb">${lb}</span><span class="vl">${mdfmt(v)}</span></div>`:'';
    body=`<div class="kvs">${kv('승강장',s.plat)}${kv('내려서',s.after)}${kv('참고',s.see)}</div>`;
  } else if(s.type==='walk'){
    head=`<div class="hl"><b>도보${s.dur?' '+esc(s.dur):''}</b>${tm}</div>`;
  } else if(s.type==='taxi'){
    head=`<div class="hl"><b>택시${s.dur?' '+esc(s.dur):''}</b>${s.fare?`<span class="sub">${esc(s.fare)}${s.pay?' · '+esc(s.pay):''}</span>`:''}${tm}</div>`;
  } else {
    head=`<div class="hl"><b>${esc(tn)}${s.dur?' '+esc(s.dur):''}</b>${s.fare?`<span class="sub">${esc(s.fare)}</span>`:''}${tm}</div>`;
  }
  const intro=P&&P.intro?`<p class="intro">${koify(P.intro)}${P.note?`<span class="note">${koify(P.note)}</span>`:''}</p>`:'';
  const bul=s.lines&&s.lines.length?`<ul class="bul">${s.lines.map(l=>`<li>${mdfmt(l)}</li>`).join('')}</ul>`:'';
  let img='';
  if(CAN_EMBED&&s.v){ const useMap=s.v.map===true; img=`<div class="cv ${useMap?'ismap':''}"><div class="ph">${useMap?'지도':'로드뷰'}</div><iframe title="장면" data-src="${useMap?mapurl(s.v.q||(s.v.lat+','+s.v.lng)):svurl(s.v.lat,s.v.lng,s.v.h||0)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><span class="cap">${esc(s.v.cap||'')}</span><button class="swap" data-lat="${s.v.lat}" data-lng="${s.v.lng}" data-h="${s.v.h||0}" data-map="${useMap?1:0}">${ms(useMap?'streetview':'map','s')}${useMap?'로드뷰':'지도'}</button></div>`; }
  const links=[];
  if(s.type==='ride'||s.type==='walk'||s.type==='taxi'){ links.push(`<a class="live" target="_blank" rel="noopener" href="${gdir(s.q1||(s.onName||''),s.q2||(s.offName||s.q||''),s.type==='taxi'?'driving':s.type==='walk'?'walking':'transit')}">${ms('directions','s')}${s.type==='ride'?'실시간 도착':'구글맵 길찾기'}</a>`); }
  if(P&&P.ig) links.push(`<a target="_blank" rel="noopener" href="https://www.instagram.com/${esc(P.ig)}/">${ms('photo_camera','s')}인스타</a>`);
  if(P&&P.web) links.push(`<a target="_blank" rel="noopener" href="${esc(P.web)}">${ms('language','s')}홈페이지</a>`);
  const off=s.type==='ride'&&s.offName?`<div class="node off">${KO(s.offName)}${s.offSub?`<em>${esc(s.offSub)}</em>`:''}<span class="lbl">하차</span></div>`:'';
  return `<div class="row m-${s.mode||'stay'} ${off?'has-off':''}" id="s${k}" data-k="${k}"><div class="lc"><span class="ic">${ms(ti)}</span><i class="rl"></i></div><div class="rbd">
    ${head}${intro}
    ${body}${bul}
    ${sayItem?`<button class="say" data-say="${s.say-1}">${ms('translate','s')}<b>${esc(sayItem[1])}</b></button>`:''}
    ${img}
    ${links.length?`<div class="plinks">${links.join('')}</div>`:''}
    ${off}
  </div></div>`;
}
function renderCards(day){
  const steps=day.steps, n=steps.length;
  const anchors=steps.map((st,k)=>st.place?k:-1).filter(k=>k>=0);
  // 그룹: 장소(anchor)부터 다음 장소 전까지. 첫 장소 전 단계는 첫 그룹에 포함
  const groups=[]; anchors.forEach((k,ai)=>{ const from=ai===0?0:k, to=ai+1<anchors.length?anchors[ai+1]:n; groups.push({k,ai,from,to}); });
  const mins=x=>{if(!x)return 0;let m=0;const h=/(\d+)\s*시간/.exec(x);if(h)m+=+h[1]*60;const mm=/(\d+)\s*분/.exec(x);if(mm)m+=+mm[1];return m;};
  const fmt=m=>m>=60?`${Math.floor(m/60)}시간${m%60?' '+m%60+'분':''}`:`${m}분`;
  const walk=steps.filter(x=>x.type==='walk').reduce((a,x)=>a+mins(x.dur),0), move=steps.filter(x=>/^(ride|taxi)$/.test(x.type)).reduce((a,x)=>a+mins(x.dur),0);
  const fare=steps.filter(x=>/^(ride|taxi)$/.test(x.type)).reduce((a,x)=>{const m=/([\d,]+)\s*엔/.exec(x.fare||'');return a+(m?+m[1].replace(/,/g,''):0);},0);
  const rides=steps.filter(x=>x.type==='ride').length;
  const cnt={}; steps.forEach(x=>{ if(/^(ride|taxi)$/.test(x.type)) cnt[x.mode]=(cnt[x.mode]||0)+1; });
  const MN={citybus:'버스',loop:'버스',flat:'버스',kyotobus:'교토버스',tankai:'단카이버스',bus:'버스','subway-k':'지하철','subway-t':'지하철','subway-y':'지하철','subway-m':'지하철',jr:'JR',ltd:'특급',kintetsu:'긴테쓰',nankai:'난카이',taxi:'택시'};
  const modes=`<div class="mline">${Object.entries(cnt).map(([m,c])=>`<span class="m-${m}"><i class="ic">${ms(MODEICON[m]||'directions_bus','s')}</i>${MN[m]||m} ${c}</span>`).join('')}<span class="m-walk"><i class="ic">${ms('directions_walk','s')}</i>도보 ${fmt(walk)}</span></div>`;
  const hm=x=>{const m=/(\d{1,2}):(\d{2})/.exec(x||'');return m?+m[1]*60+ +m[2]:null;}, f2=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const dl=(day.ret&&day.target)?`<div class="line3">${ms('wb_twilight','s')}해 짐 ${esc(day.sunset||'17:00')} · <b>${esc(day.target)}</b> 귀가하려면 마지막 장소 <b>${f2(hm(day.target)-day.ret)}</b> 출발${day.max?` · 최대 ${esc(day.max)} 귀가 → ${f2(hm(day.max)-day.ret)} 출발`:''}${day.dlNote?`<span class="dim"> · ${esc(day.dlNote)}</span>`:''}</div>`:'';
  const lastT=[...steps].reverse().find(x=>x.t); const endT=day.home?day.home.replace(/\s*숙소.*$/,''):(lastT?lastT.t:''); const endL=day.home?'숙소 도착':(lastT&&lastT.place?lastT.place+' 도착':'');
  const summ=`<div class="dsum"><div class="big"><b class="num">${esc((steps.find(x=>x.t)||{}).t||'')} → ${esc(endT)}</b><span>${esc(endL)}</span></div><div class="line2">${fare?`교통비 약 ${fare.toLocaleString()}엔 (사전 구매 표 포함)`:''}</div>${dl}</div>`;
  // 이동 줄 길찾기 목적지 보강: 다음 장소(q) 기준
  steps.forEach((st,k)=>{ if(/^(walk|taxi)$/.test(st.type)&&!st.q2){ const nx=steps.slice(k+1).find(x=>x.q||x.v||x.onName); st.q1=st.q1||'현재 위치'; st.q2=st.q||(nx?(nx.v?nx.v.lat+','+nx.v.lng:(nx.q||nx.onName)):TRIP.home.q); } if(st.type==='ride'&&!st.q2){ st.q1=st.q1||st.onName||'현재 위치'; st.q2=st.offName||TRIP.home.q; } });
  const lastPlaceAi=(()=>{ let r=-1; anchors.forEach((k,ai)=>{ if(steps[k].place!=='숙소') r=ai; }); return r; })();
  const body=groups.map(g=>{ const p=steps[g.k];
    const rows=[]; for(let k=g.from;k<g.to;k++) rows.push(rowHTML(steps[k],k,n));
    const q=p.v?gmap(p.v.lat+','+p.v.lng):gmap(p.q||p.a);
    const dlb=(g.ai===lastPlaceAi&&day.ret&&day.target)?`<div class="dl">${ms('schedule','s')}<div><b>${esc(day.target)} 귀가 → 여기서 ${f2(hm(day.target)-day.ret)} 출발</b>${day.max?`<span>최대 ${esc(day.max)} 귀가 → ${f2(hm(day.max)-day.ret)} 출발</span>`:''}</div></div>`:'';
    return `<section class="grp ${p.opt?'opt':''}" id="g${g.ai}" data-ai="${g.ai}">
      <h3 class="stop"><i class="pd"></i><span>${esc(p.place)}${p.opt?'<i class="optag">선택</i>':''}</span>${p.t?`<small class="num">${esc(p.t)}</small>`:''}</h3>${dlb}
      ${rows.join('')}
      <div class="gft"><a target="_blank" rel="noopener" href="${q}">${ms('map','s')}${esc(p.place)} 지도</a><button class="lost" data-k="${g.k}">${ms('sos','s')}길 잃음</button></div>
    </section>`; }).join('');
  document.body.classList.add('cards');
  $('#main').innerHTML=`<div class="col">${summ}${body}<p class="end">오늘 끝</p></div>`;
  const pb=$('#pbar'); pb.hidden=false;
  pb.innerHTML=anchors.map((k,ai)=>`<button class="pb ${steps[k].opt?'opt':''}" data-ai="${ai}"><i></i><span>${esc(steps[k].place)}</span></button>`).join('<i class="pseg"></i>');
  renderBar();
  const hdr=()=>($('#top').offsetHeight||150);
  const setNow=ai=>{
    pb.querySelectorAll('.pb').forEach((b,i)=>{ b.classList.toggle('now',i===ai); b.classList.toggle('past',i<ai); });
    pb.querySelectorAll('.pseg').forEach((sg,i)=>sg.classList.toggle('past',i<ai));
    const nb=pb.querySelector('.pb.now'); if(nb) nb.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
    stepIdx[TRIP.id+':'+day.id]=ai; LS.set('trip.step',stepIdx);
  };
  const gs=[...document.querySelectorAll('.grp')];
  const io=new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting){ e.target.querySelectorAll('iframe[data-src]').forEach(f=>{f.src=f.dataset.src;f.removeAttribute('data-src');}); } }); },{rootMargin:'500px 0px'});
  gs.forEach(g=>io.observe(g));
  const pick=()=>{ const line=hdr()+30; let best=gs[0]; for(const g of gs){ if(g.getBoundingClientRect().top<=line) best=g; else break; } setNow(+best.dataset.ai); };
  let raf=0; window.onscroll=()=>{ if(!raf) raf=requestAnimationFrame(()=>{raf=0; const y=window.scrollY; const h=document.documentElement; if(y>140&&!h.classList.contains('scrolled')) h.classList.add('scrolled'); else if(y<30&&h.classList.contains('scrolled')) h.classList.remove('scrolled'); pick();}); };
  const jump=ai=>{ const el=$('#g'+ai); window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-hdr()+6,behavior:'smooth'}); };
  pb.querySelectorAll('.pb').forEach((b,i)=>b.onclick=()=>jump(i));
  document.querySelectorAll('.swap').forEach(b=>b.onclick=()=>{ const cv=b.closest('.cv'); const f=cv.querySelector('iframe'); const toMap=b.dataset.map!=='1'; f.src=toMap?mapurl(b.dataset.lat+','+b.dataset.lng):svurl(b.dataset.lat,b.dataset.lng,b.dataset.h); b.dataset.map=toMap?'1':'0'; b.innerHTML=ms(toMap?'streetview':'map','s')+(toMap?'로드뷰':'지도'); cv.classList.toggle('ismap',toMap); });
  document.querySelectorAll('.say').forEach(b=>b.onclick=()=>{ const ph=TRIP.phrases[+b.dataset.say]; openSheet(`<h3>이거 보여줘</h3><p class="lead">${esc(ph[0])}</p><div class="bigsay">${esc(ph[1])}</div><p style="color:var(--accent);font-size:16px">${esc(ph[2])}</p>`); });
  document.querySelectorAll('.lost').forEach(b=>b.onclick=()=>{ const s=steps[+b.dataset.k]; openSheet(`<h3>길 잃었을 때</h3><p class="lead">당황하지 말고 둘 중 하나.</p>
    <a class="cta" target="_blank" rel="noopener" href="${s.v?gdir('현재 위치',s.v.lat+','+s.v.lng):gdir('현재 위치',s.q||s.a)}">${ms('directions','s')} ${esc(s.place||'가려던 곳')}으로 길찾기</a>
    <a class="cta" target="_blank" rel="noopener" href="${gdir('현재 위치',TRIP.home.q,'driving')}">${ms('local_taxi','s')} 택시 타고 숙소</a>
    <div class="kv" style="margin-top:14px">${ms('badge')}<div><b>택시 기사에게</b><p>${esc(TRIP.phrases[0][1])}</p><small>${esc(TRIP.home.address)}</small></div></div>`); });
  const ai0=stepIdx[TRIP.id+':'+day.id]||0; setNow(0);
  if(ai0>0&&gs[ai0]){ requestAnimationFrame(()=>{ window.scrollTo(0,gs[ai0].getBoundingClientRect().top+window.scrollY-hdr()+6); setTimeout(pick,50); }); }
}

/* ---------- 표지 / 숙소·요약 / 준비 ---------- */
function clearShell(){ document.body.classList.remove('cards'); window.onscroll=null; document.documentElement.classList.remove('scrolled'); }
function renderCover(){
  clearShell();
  $('#top').innerHTML='';
  const c=TRIP.cover||{}; const W={'토':'SAT','일':'SUN','월':'MON','화':'TUE','수':'WED','목':'THU','금':'FRI'};
  const pill=(d,i)=>{ const date=d.d.replace('/','.').replace(/^(\d)\./,'$1.').replace(/^(\d{2})\.(\d)$/,'$1.0$2'); const wk=W[(d.w||'').slice(0,1)]||'';
    return `<article class="jday" style="--color:${esc(d.color)};--text:${esc(d.text||'#171717')}"><button class="jt" data-i="${i}" aria-expanded="false"><span class="jd">${date} <span class="jw">${wk}</span></span><span></span><span class="jsign">+</span></button>
      <div class="jr"><div class="jri"><ol class="jpl">${(d.coverPlaces||[]).map(p=>`<li><span class="jen">${esc(p[0])}</span><div class="jloc"><span lang="ja">${esc(p[1])}</span><span>${esc(p[2])}</span></div></li>`).join('')}</ol>
      <div class="jfoot"><span></span><button class="jgo" data-id="${d.id}">${esc(d.d)} 일정 보기 ↗</button></div></div></div></article>`; };
  const ex=c.extra?`<article class="jday" style="--color:${esc(c.extra.color)};--text:${esc(c.extra.text||'#fff')}"><div class="jt static"><span class="jd">${esc(c.extra.date)} <span class="jw">${esc(c.extra.week)}</span></span><span class="jcity">${esc(c.extra.city)}</span><span></span></div></article>`:'';
  $('#main').innerHTML=`<section class="journal"><header class="mast"><span>${esc((c.masthead||[])[0]||'')}</span><span>${esc((c.masthead||[])[1]||'')}</span></header>
    <div class="hero"><h1 class="ct">${esc(c.title||TRIP.title)}</h1></div><div class="jspace"></div>
    <div class="jdays">${TRIP.days.map(pill).join('')}${ex}</div>
    </section>`;
  const cards=[...document.querySelectorAll('.jday')];
  const setDay=(idx,open)=>{ cards.forEach((cd,i)=>{ const on=i===idx&&open; cd.classList.toggle('open',on); const sg=cd.querySelector('.jsign'); if(sg) sg.textContent=on?'−':'+'; const bt=cd.querySelector('.jt'); if(bt) bt.setAttribute('aria-expanded',String(on)); }); $('.journal').classList.toggle('has-open',open); };
  document.querySelectorAll('.jt:not(.static)').forEach(b=>b.onclick=()=>{ const i=+b.dataset.i; setDay(i,!cards[i].classList.contains('open')); });
  cards.forEach((cd,i)=>{ cd.addEventListener('click',e=>{ if(e.target.closest('.jgo')) return; if(cd.classList.contains('open')&&!e.target.closest('.jt')) setDay(-1,false); }); });
  document.querySelectorAll('.jgo').forEach(b=>b.onclick=()=>{cur=b.dataset.id;LS.set('trip.day.'+TRIP.id,cur);setView('days');});
  renderBar();
}
function renderStay(){
  clearShell();
  const H=TRIP.home;
  $('#top').innerHTML=`<div class="top-row"><h1>숙소 · 6일 요약</h1></div>`;
  const anchors=d=>d.steps.filter(s=>s.place&&!/^숙소/.test(s.place)).map(s=>s.place).filter((v,i,arr)=>arr.indexOf(v)===i);
  const endT=d=>d.home?d.home.replace(/\s*숙소.*$/,''):(([...d.steps].reverse().find(s=>s.t)||{}).t||'');
  const endL=d=>d.home?'숙소':'공항';
  $('#main').innerHTML=`<div class="col">
    <section class="stay">
      <div class="sl">숙소</div>
      <div class="sn">${esc(H.name)}</div>
      <div class="sa">${esc(H.address)}</div>
      <div class="sacts"><button class="ab" id="cpAddr">${ms('content_copy','s')}주소 복사</button><a class="ab" target="_blank" rel="noopener" href="${gdir('현재 위치',H.q,'driving')}">${ms('directions','s')}길찾기</a><a class="ab" target="_blank" rel="noopener" href="${gmap(H.q)}">${ms('map','s')}지도</a></div>
      <div class="ssay"><div class="sl">택시 기사에게</div><div class="bigsay">${esc(TRIP.phrases[0][1])}</div><div class="sa">${esc(H.address)}</div></div>
      <div class="sbus">${ms('directions_bus','s')}<span>정류장 ${KO(H.bus)} · 도보 5분 · 6번 ${nmHTML('京都駅',false)} · 北1 ${nmHTML('北大路',false)}</span></div>
    </section>
    <section class="sum">
      <div class="sl">6일 한눈에</div>
      ${TRIP.days.filter(d=>d.steps&&d.steps.length).map(d=>`<button class="sd" data-id="${d.id}" style="--dc:${esc(d.color||'#000')}"><i class="sdc"></i><div class="sdb">
        <div class="sdh"><b class="num">${esc(d.d)}</b><span>${esc(d.w)}</span><span class="num sdt">${esc((d.steps.find(s=>s.t)||{}).t||'')} → ${esc(endT(d))} ${endL(d)}</span></div>
        <div class="sdp">${anchors(d).map(esc).join(' · ')}</div>
        ${(d.must||[]).length?`<ul class="sdm">${d.must.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:''}
      </div></button>`).join('')}
    </section></div>`;
  $('#cpAddr').onclick=()=>{ navigator.clipboard&&navigator.clipboard.writeText(H.address).then(()=>{$('#cpAddr').innerHTML=ms('check','s')+'복사됨';}); };
  document.querySelectorAll('.sd').forEach(b=>b.onclick=()=>{cur=b.dataset.id;LS.set('trip.day.'+TRIP.id,cur);setView('days');});
  renderBar();
}
function renderPrep(){
  clearShell();
  $('#top').innerHTML=`<div class="top-row"><h1>준비</h1></div>`;
  $('#main').innerHTML=`<div class="col">
    ${(TRIP.prep||[]).map(g=>`<section class="pg"><div class="sl">${esc(g.title)}</div><ul class="pl">${(g.items||[]).map(i=>`<li>${mdfmt(i)}</li>`).join('')}</ul></section>`).join('')}
    <section class="pg"><div class="sl">보여줄 말 — 화면 그대로 보여주면 됨</div>${TRIP.phrases.map((p,i)=>`<div class="ph"><div class="ko">${i+1}. ${esc(p[0])}</div><div class="jp">${esc(p[1])}</div><div class="ro">${esc(p[2])}</div></div>`).join('')}</section>
  </div>`;
  renderBar();
}
/* ---------- 하단 바 / 시트 ---------- */
function renderBar(){
  const b=$('#bar'); b.hidden=false;
  const tab=(v,ic,lb)=>`<button data-v="${v}" class="${view===v?'on':''}">${ms(ic)}<span>${lb}</span></button>`;
  b.innerHTML=`<div class="wrap">${tab('home','home','홈')}${tab('days','route','일정')}${tab('stay','hotel','숙소·요약')}${tab('prep','checklist','준비')}</div>`;
  b.querySelectorAll('button').forEach(x=>x.onclick=()=>setView(x.dataset.v));
}
const sheet=$('#sheet'), pn=$('#pn');
function openSheet(html){ pn.innerHTML=`<div class="grab"></div>${html}<button class="close" id="cl">닫기</button>`; sheet.hidden=false; $('#cl').onclick=()=>sheet.hidden=true; }
sheet.onclick=e=>{ if(e.target===sheet) sheet.hidden=true; };

(document.fonts?document.fonts.load('300 24px "Material Symbols Outlined"'):Promise.resolve()).then(()=>document.documentElement.classList.add('icons')).catch(()=>document.documentElement.classList.add('icons'));
setTimeout(()=>document.documentElement.classList.add('icons'),4000);
(function(){ const b=document.createElement('button'); b.id='toTop'; b.className='totop'; b.setAttribute('aria-label','맨 위로'); b.innerHTML=ms('arrow_upward'); b.hidden=true; document.body.appendChild(b); b.onclick=()=>window.scrollTo({top:0,behavior:'smooth'}); window.addEventListener('scroll',()=>{ b.hidden=window.scrollY<400; },{passive:true}); })();
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js?v='+(window.__V__||'0')).catch(()=>{});
boot().catch(fail);
})();
