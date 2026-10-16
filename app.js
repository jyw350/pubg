/* No build step, network requests, paid services, or account required. */
(() => {
  'use strict';
  const D=window.BENTLEY,C=window.BentleyCore,$=id=>document.getElementById(id);
  const KEY='bentley-personal-simulator-v1',fmt=n=>Number(n).toLocaleString('ko-KR');
  const byId=new Map(D.items.map(x=>[x.id,x]));
  const names={bronze:'일반',silver:'실버',gold:'레전더리',pink:'얼티밋'};
  const colors={bronze:'#af8662',silver:'#ced9e2',gold:'#ffdc79',pink:'#ff83b2'};
  let state=C.fresh(),saveAvailable=true,screen='home',batch=null,isPreview=false,busy=false,revealingAll=false;
  let openingTimers=[],spotTimers=[],spotResolve=null,toastTimer=null,activePanel=null,lastFocus=null,inventoryFilter='all';
  try {state=C.restore(JSON.parse(localStorage.getItem(KEY)));} catch {saveAvailable=false;}
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset=x=>x?`assets/items/${x}.webp`:null;
  const art=(item,cls='')=>item.asset?`<img class="${cls}" src="${asset(item.asset)}" alt="${esc(item.name)}" draggable="false">`:`<span class="blank ${cls}">꽝</span>`;
  const duration=n=>state.settings.reducedMotion?Math.min(n,100):n*(state.settings.fast?.45:1);
  const wait=n=>new Promise(r=>setTimeout(r,duration(n)));
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state));saveAvailable=true;}catch{saveAvailable=false;}
    $('saveStatus').textContent=saveAvailable?'기록 자동 저장':'저장 불가 · 설정에서 내보내기';
  }
  function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
  function resize(){const scale=Math.min(innerWidth/1920,innerHeight/1080);$('stage').style.transform=`scale(${scale})`;}
  addEventListener('resize',resize);resize();
  function applySettings(){
    $('stage').classList.toggle('reduced-motion',state.settings.reducedMotion);
    $('toggleSound').textContent=state.settings.sound?'♪ 사운드 켜짐':'♪ 사운드 꺼짐';
  }
  function setScreen(next){
    screen=next;for(const name of ['home','opening','results'])$(name).hidden=name!==next;
  }
  // Procedural sounds, intentionally no voice/music from the YouTube recordings.
  let audio=null;
  function unlockAudio(){
    if(!state.settings.sound)return;
    try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();}catch{}
  }
  function tone(freq,start=.0,length=.25,gain=.06,type='sine',endFreq=null){
    if(!state.settings.sound||!audio)return;
    const t=audio.currentTime+start,o=audio.createOscillator(),g=audio.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(endFreq,t+length);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+length);
    o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+length+.02);
  }
  function noise(length=.5,gain=.08){
    if(!state.settings.sound||!audio)return;const count=Math.floor(audio.sampleRate*length),buffer=audio.createBuffer(1,count,audio.sampleRate),v=buffer.getChannelData(0);
    for(let i=0;i<count;i++)v[i]=(Math.random()*2-1)*Math.pow(1-i/count,2);
    const s=audio.createBufferSource(),g=audio.createGain(),f=audio.createBiquadFilter();s.buffer=buffer;f.type='lowpass';f.frequency.value=1800;g.gain.value=gain;s.connect(f);f.connect(g);g.connect(audio.destination);s.start();
  }
  function sound(kind){
    if(kind==='open'){noise(.7,.11);tone(95,0,.6,.09,'triangle',33);}
    else if(kind==='gold'){noise(.8,.08);[220,330,440,660].forEach((f,i)=>tone(f,i*.12,.8,.035));tone(52,0,1,.1,'sine');}
    else if(kind==='pink'){noise(.65,.09);[330,440,660,880,1320].forEach((f,i)=>tone(f,i*.09,1.1,.035));tone(45,0,1.2,.09);}
    else {tone(kind==='silver'?620:360,0,.15,.035,'triangle',kind==='silver'?950:200);noise(.1,.025);}
  }
  // Small particle bursts are only active while an effect is playing.
  const ctx=$('particles').getContext('2d');let particles=[],raf=0,lastTime=0;
  function burst(tier,x=960,y=520,count=80){
    if(state.settings.reducedMotion)return;
    for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=100+Math.random()*470;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-100,life:.7+Math.random()*1.2,age:0,size:1+Math.random()*3,color:colors[tier]});}
    if(!raf){lastTime=performance.now();raf=requestAnimationFrame(paint);}
  }
  function paint(now){const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;ctx.clearRect(0,0,1920,1080);particles=particles.filter(p=>p.age<p.life);
    for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=80*dt;ctx.globalAlpha=Math.max(0,1-p.age/p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size*1.9);}ctx.globalAlpha=1;
    if(particles.length)raf=requestAnimationFrame(paint);else{raf=0;ctx.clearRect(0,0,1920,1080);}
  }
  function renderHome(){
    $('totalCount').textContent=fmt(state.total);$('tokenCount').textContent=fmt(state.tokens);$('creditCount').textContent=fmt(state.credits);$('ticketCount').textContent=fmt(state.tickets);
    $('collectionCount').textContent=fmt(Object.keys(state.inventory).length);
    const oldScroll=$('milestoneList').scrollTop;
    $('milestoneList').innerHTML=D.milestones.map(m=>{
      const claimed=state.claimed.includes(m.at),ready=state.total>=m.at&&!claimed;
      return `<div class="milestone-row"><span>${ready?'◆':'◇'} ×${m.at}</span><div class="reward-art" title="${esc(m.name)}">${m.asset?`<img src="${asset(m.asset)}" alt="${esc(m.name)}">`:'<span class="blank-reward">꽝</span>'}<small>${fmt(m.qty)}</small></div><button class="game-button" data-claim="${m.at}" ${ready?'':'disabled'}>${claimed?'완료':'받기'}</button></div>`;
    }).join('');$('milestoneList').scrollTop=oldScroll;
    $('claimAll').disabled=!D.milestones.some(m=>m.at<=state.total&&!state.claimed.includes(m.at));
    $('drawOne').querySelector('span').innerHTML=state.pending?'이어서 열기':'<em>1</em>개 열기';
    $('drawTen').querySelector('span').innerHTML=state.pending?'이어서 열기':'<em>10</em>개 열기';
  }
  function draw(count){
    if(screen==='opening'||busy)return;unlockAudio();closePanel();isPreview=false;
    if(state.pending){batch=state.pending;setScreen('results');renderCards();return;}
    batch=C.draw(state,count);save();renderHome();startOpening();
  }
  function startOpening(){
    clearOpening();setScreen('opening');const tier=C.highest(batch.ids.map(id=>byId.get(id)));
    $('opening').dataset.quality=C.ranks[tier]>=2?'gold':'low';$('opening').classList.remove('is-charging','is-burst');
    sound('open');
    openingTimers.push(setTimeout(()=>$('opening').classList.add('is-charging'),duration(700)));
    openingTimers.push(setTimeout(()=>{$('opening').classList.add('is-burst');sound(C.ranks[tier]>=2?'gold':'silver');burst(C.ranks[tier]>=2?'gold':'silver',1120,450,C.ranks[tier]>=2?130:28);},duration(1700)));
    openingTimers.push(setTimeout(finishOpening,duration(3200)));
  }
  function clearOpening(){openingTimers.forEach(clearTimeout);openingTimers=[];}
  function finishOpening(){if(screen!=='opening')return;clearOpening();setScreen('results');renderCards();$('revealAll').focus({preventScroll:true});}
  function renderCards(){
    $('cardGrid').classList.toggle('single',batch.ids.length===1);
    $('cardGrid').innerHTML=batch.ids.map((id,i)=>{
      const item=byId.get(id),open=batch.revealed[i];
      return `<button class="loot-card tier-${item.tier} ${open?'revealed':''}" data-card="${i}" style="animation-delay:${i*.045}s" aria-label="${open?esc(item.asset?item.name:'꽝 · '+item.name):`${i+1}번 ${C.ranks[item.tier]>=2?'황금':names[item.tier]} 카드 열기`}" aria-pressed="${open}"><span class="card-back" aria-hidden="true"></span><span class="card-front" aria-hidden="true">${art(item)}${item.grade==='재화'?`<span class="card-qty">×${fmt(item.quantity)}</span>`:''}</span><span class="card-caption" aria-hidden="true">${esc(item.asset?item.name:'꽝')}</span><span class="card-index" aria-hidden="true">${i===9?'0':i+1}</span></button>`;
    }).join('');
    $('previewBadge').hidden=!isPreview;$('batchLabel').textContent=`벤틀리 화물 × ${batch.ids.length}`;
    $('batchBonus').innerHTML=isPreview?'연출 미리보기 · 기록 및 재화 변동 없음':`포함 <span>♧ 벤틀리 토큰 ${batch.ids.length*15}</span>`;
    updateResultActions();
  }
  function updateResultActions(){
    const n=batch.revealed.filter(Boolean).length,done=n===batch.ids.length;
    $('revealedCount').textContent=`${n} / ${batch.ids.length} 공개`;
    $('revealAll').hidden=done;$('resultDone').hidden=!done;$('againTen').hidden=!done||isPreview;
    $('revealAll').disabled=busy||revealingAll;$('resultBack').disabled=busy||revealingAll;
    $('revealHint').textContent=done?'모든 아이템을 확인했습니다.':revealingAll?'아이템을 순서대로 확인하고 있습니다.':'카드를 눌러 아이템을 확인하세요.';
  }
  async function revealCard(index,automatic=false){
    if(screen!=='results'||busy||(!automatic&&revealingAll)||!batch||index>=batch.ids.length||index<0)return;
    const item=byId.get(batch.ids[index]);
    if(batch.revealed[index]){if(!automatic)openItemPanel(item);return;}
    busy=true;updateResultActions();const card=$('cardGrid').querySelector(`[data-card="${index}"]`);
    card.classList.add('revealing');sound(C.ranks[item.tier]>=2?'gold':item.tier);
    const rect=card.getBoundingClientRect(),stageRect=$('stage').getBoundingClientRect(),scale=stageRect.width/1920;
    burst(C.ranks[item.tier]>=2?'gold':item.tier,(rect.left+rect.width/2-stageRect.left)/scale,(rect.top+rect.height/2-stageRect.top)/scale,35);
    if(C.ranks[item.tier]>=2){await wait(380);await showSpotlight(item,automatic);}else await wait(280);
    batch.revealed[index]=true;if(!isPreview){C.reveal(state,index);save();}
    card.classList.remove('revealing');card.classList.add('revealed');card.setAttribute('aria-label',item.asset?item.name:'꽝 · '+item.name);card.setAttribute('aria-pressed','true');
    busy=false;updateResultActions();
  }
  function showSpotlight(item,automatic){
    return new Promise(resolve=>{
      spotResolve=resolve;spotTimers.forEach(clearTimeout);spotTimers=[];
      $('spotlight').hidden=false;$('spotlight').className='spotlight is-building';
      $('spotGrade').textContent='LEGENDARY';$('spotName').textContent=item.asset?item.name:'꽝';$('spotNote').textContent=item.asset?`${item.grade} · ${item.vehicle?'스페셜 탈 것 도안':'벤틀리 화물 보상'}`:`${item.grade} · ${item.name} · 이미지 미제공`;
      $('spotArt').innerHTML=art(item);$('closeSpotlight').disabled=true;
      const reveal=()=>{
        if(item.tier==='pink'){$('spotlight').classList.add('is-pink');$('spotGrade').textContent='ULTIMATE';sound('pink');burst('pink',960,500,170);}
        else{sound('gold');burst('gold',960,500,100);}
        $('spotlight').classList.remove('is-building');$('closeSpotlight').disabled=false;
        if(automatic)spotTimers.push(setTimeout(closeSpotlight,duration(item.tier==='pink'?1600:1100)));
        else $('closeSpotlight').focus({preventScroll:true});
      };
      spotTimers.push(setTimeout(reveal,duration(item.tier==='pink'?1350:650)));
    });
  }
  function closeSpotlight(){
    if($('spotlight').hidden||$('closeSpotlight').disabled)return;
    spotTimers.forEach(clearTimeout);spotTimers=[];$('spotlight').hidden=true;
    const resolve=spotResolve;spotResolve=null;if(resolve)resolve();
  }
  async function revealAll(){
    if(busy||revealingAll||screen!=='results')return;unlockAudio();revealingAll=true;updateResultActions();
    for(let i=0;i<batch.ids.length;i++){if(!batch.revealed[i]){await revealCard(i,true);await wait(130);}}
    revealingAll=false;updateResultActions();$('resultDone').focus({preventScroll:true});
  }
  function goHome(){
    if(busy||revealingAll)return;clearOpening();
    if(!isPreview&&batch){C.finish(state);save();}
    batch=null;isPreview=false;setScreen('home');renderHome();$('drawTen').focus({preventScroll:true});
  }
  function preview(tier){
    if(busy)return;unlockAudio();closePanel();isPreview=true;
    const selected=tier==='mix'?['cargo-0','cargo-1','cargo-2','cargo-3','cargo-12','cargo-26','cargo-52','cargo-90','cargo-110','cargo-126']:Array(10).fill(D.items.find(x=>x.tier===tier&&x.asset)?.id||D.items.find(x=>x.tier===tier).id);
    batch={ids:selected,revealed:selected.map(()=>false)};startOpening();
  }
  function openPanel(title,content,key){
    if(busy||revealingAll)return;lastFocus=document.activeElement;activePanel=key;$('panelTitle').textContent=title;$('panelBody').innerHTML=content;$('panelOverlay').hidden=false;$('panelBody').scrollTop=0;$('closePanel').focus({preventScroll:true});
  }
  function closePanel(){if($('panelOverlay').hidden)return;$('panelOverlay').hidden=true;activePanel=null;lastFocus?.focus?.({preventScroll:true});}
  function summary(){return `<div class="summary-strip"><div class="stat"><span>누적 개봉</span><strong>${fmt(state.total)}</strong><small>회</small></div><div class="stat"><span>벤틀리 토큰</span><strong>${fmt(state.tokens)}</strong></div><div class="stat"><span>차량 도안 획득</span><strong>${fmt(D.items.filter(x=>x.vehicle).reduce((n,x)=>n+(state.inventory[x.id]||0),0))}</strong><small>개</small></div><div class="stat"><span>가상 사용 G-COIN</span><strong>${fmt(state.total*250)}</strong><small>실제 결제 없음</small></div></div>`;}
  function renderCraft(filter=''){
    const body=`<p class="panel-note">보유 토큰 <b>${fmt(state.tokens)}</b> · 화물 1개마다 15 토큰을 받습니다. 사진에 있는 제작 전용 상품도 이곳에서 교환할 수 있습니다.</p><div class="panel-tabs"><span>특수 제작 · 전체 ${D.crafting.length}종</span><input id="craftSearch" aria-label="제작 아이템 검색" placeholder="차량, 색상, 번호판 검색" value="${esc(filter)}"></div><div class="item-gallery" id="craftGallery"></div>`;
    openPanel('특수 제작',body,'craft');fillCraft(filter);$('craftSearch').addEventListener('input',e=>fillCraft(e.target.value));
  }
  function fillCraft(filter){
    const list=D.crafting.filter(x=>x.name.toLowerCase().includes(filter.toLowerCase()));
    $('craftGallery').innerHTML=list.length?list.map(item=>`<article class="gallery-card">${art(item)}${state.crafted[item.id]?`<span class="owned">보유 ${state.crafted[item.id]}</span>`:''}<h3>${esc(item.name.replace(/ 도안$/,''))}</h3><div class="tag">${item.exclusive?'특수 제작 전용':'화물에서도 획득 가능'}</div><button class="game-button" data-craft="${item.id}" ${state.tokens>=item.cost?'':'disabled'}>♧ ${fmt(item.cost)} · 제작</button></article>`).join(''):'<div class="empty-state">검색 결과가 없습니다.</div>';
  }
  function showInventory(filter='all'){
    inventoryFilter=filter;const owned=D.items.filter(x=>state.inventory[x.id]);
    const content=`${summary()}<div class="panel-tabs">${[['all','전체'],['bentley','벤틀리'],['vehicle','차량'],['crafted','제작한 아이템'],['history','최근 기록']].map(([k,v])=>`<button data-inventory-filter="${k}" class="${filter===k?'active':''}">${v}</button>`).join('')}</div><div id="inventoryContents"></div>`;
    openPanel('획득 내역',content,'inventory');
    if(filter==='history'){$('inventoryContents').innerHTML=state.history.length?`<table class="history-list"><tbody>${state.history.map(h=>{const x=byId.get(h.id);return `<tr><td>${fmt(h.number)}회</td><td>${x.asset?`<img class="mini-art" src="${asset(x.asset)}" alt="">`:'꽝 · '}${esc(x.name)}</td><td>${x.grade}</td></tr>`;}).join('')}</tbody></table>`:'<div class="empty-state">아직 개봉 기록이 없습니다.</div>';return;}
    const list=filter==='crafted'?D.crafting.filter(x=>state.crafted[x.id]):owned.filter(x=>filter==='bentley'?x.id&&Number(x.id.split('-')[1])<52:filter==='vehicle'?x.vehicle:true);
    $('inventoryContents').innerHTML=list.length?`<div class="item-gallery">${list.map(x=>`<article class="gallery-card">${x.asset?art(x):'<div class="gallery-blank">꽝</div>'}<span class="owned">× ${fmt((filter==='crafted'?state.crafted:state.inventory)[x.id])}</span><h3>${esc(x.name)}</h3><span class="tag">${x.grade}${x.asset?'':' · 이미지 미제공'}</span></article>`).join('')}</div>`:'<div class="empty-state"><strong>아직 획득한 아이템이 없습니다.</strong>보급고에서 화물을 열어 컬렉션을 채워 보세요.</div>';
  }
  function showRates(){
    openPanel('벤틀리 화물 · 획득 확률',`<p class="panel-note">${D.version} 공식 공개 확률 · 총 ${D.items.length}종 · 합계 100%<br>1회마다 벤틀리 토큰 15개를 함께 받습니다. 모든 뽑기는 독립 추첨입니다. 이미지가 없는 결과는 ‘꽝’으로 표시하며, 해당 확률을 다른 보상에 나누지 않습니다.</p><p class="fine-print">연출 색상은 요청에 맞춰 얼티밋=황금 후 분홍, 레전더리=황금, 에픽·엘리트=은색, 레어·스페셜·재화=갈색으로 묶었습니다. <a href="${D.source}" target="_blank" rel="noopener noreferrer">공식 확률표 ↗</a></p><table class="probability-table"><thead><tr><th>아이템</th><th>공식 등급</th><th>이미지</th><th>1회 확률</th></tr></thead><tbody>${D.items.map(x=>`<tr><td><span class="tier-label tier-${x.tier}"></span>${esc(x.name)}</td><td>${x.grade}</td><td>${x.asset?'제공됨':'꽝 표시'}</td><td>${x.probability.toFixed(x.probability<.1?5:4)}%</td></tr>`).join('')}</tbody></table>`,'rates');
  }
  function showSettings(){
    openPanel('설정',`<div class="settings-grid">${[['sound','효과음','직접 만든 개봉 효과음과 등급별 사운드'],['fast','빠른 연출','같은 효과를 짧게 재생합니다'],['reducedMotion','움직임 줄이기','섬광과 입자를 줄이고 빠르게 공개합니다']].map(([k,label,note])=>`<label class="setting"><input type="checkbox" data-setting="${k}" ${state.settings[k]?'checked':''}><span><strong>${label}</strong><small>${note}</small></span></label>`).join('')}</div><p>뽑기 결과, 재화, 제작 내역은 이 브라우저에 저장됩니다. 다른 기기로 옮길 때는 저장 파일을 내보내세요.</p><div class="settings-actions"><button class="game-button" id="exportSave">저장 파일 내보내기</button><button class="game-button" id="importSave">저장 파일 가져오기</button><input id="saveFile" type="file" accept=".json,application/json" hidden><button class="game-button danger-button" id="resetSave">진행 기록 초기화</button></div><p class="fine-print">${saveAvailable?'자동 저장을 사용할 수 있습니다.':'이 브라우저에서는 자동 저장에 실패했습니다. 종료 전에 저장 파일을 내보내세요.'} 실제 계정이나 G-COIN에는 영향을 주지 않습니다.</p>`,'settings');
    $('exportSave').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='bentley-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('저장 파일을 내보냈습니다.');};
    $('importSave').onclick=()=>$('saveFile').click();$('saveFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw new Error();const raw=JSON.parse(await file.text());if(raw.version!==1||!Number.isSafeInteger(raw.total))throw new Error();state=C.restore(raw);batch=null;isPreview=false;save();applySettings();setScreen('home');renderHome();closePanel();toast('저장 기록을 불러왔습니다.');}catch{toast('올바른 벤틀리 저장 파일이 아닙니다.');}};
    $('resetSave').onclick=()=>{openPanel('진행 기록 초기화',`<p>누적 ${fmt(state.total)}회, 보유 아이템과 제작 내역을 초기화합니다.</p><p>보관하려면 설정에서 먼저 저장 파일을 내보내세요.</p><div class="settings-actions"><button class="game-button" id="cancelReset">취소</button><button class="game-button danger-button" id="confirmReset">기록 초기화</button></div>`,'reset');$('cancelReset').onclick=showSettings;$('confirmReset').onclick=()=>{state=C.fresh();batch=null;isPreview=false;save();applySettings();setScreen('home');renderHome();closePanel();toast('진행 기록을 초기화했습니다.');};};
  }
  function showPreview(){openPanel('연출 미리보기',`<p>확률이나 획득 기록을 바꾸지 않고 네 가지 연출을 확인할 수 있습니다. 일반 뽑기는 항상 공식 확률을 사용합니다.</p><div class="preview-options">${['bronze','silver','gold','pink'].map(t=>`<article class="preview-option tier-${t}"><img src="assets/back-${C.ranks[t]>=2?'gold':t}.webp" alt="${names[t]} 카드"><h3>${names[t]}</h3><p>${t==='pink'?'황금 → 분홍색 추가 공개':t==='gold'?'금빛 상자와 황금 카드 공개':t==='silver'?'일반 상자와 은색 카드':'일반 상자와 갈색 카드'}</p><button class="game-button" data-preview="${t}">연출 보기</button></article>`).join('')}</div><div class="settings-actions"><button class="game-button primary" data-preview="mix">10개 혼합 결과 미리보기</button></div>`,'preview');}
  function showHelp(){openPanel('제작소 가이드',`<p>돈을 쓰지 않고 즐기는 나만의 벤틀리 보급고입니다.</p><div class="help-grid"><div><h3>01 · 화물 열기</h3><p>1개 또는 10개 열기를 누르세요. 황금 이상 보상이 포함되면 상자가 금빛으로 빛납니다.</p></div><div><h3>02 · 카드 공개</h3><p>카드를 하나씩 누르거나 모두 열기를 선택하세요. 얼티밋은 황금 연출 뒤 분홍색으로 바뀝니다.</p></div><div><h3>03 · 모으고 제작하기</h3><p>1회마다 토큰 15개를 받고 누적 보상을 수령할 수 있습니다. 특수 제작에서 원하는 아이템을 교환하세요.</p></div></div><p class="panel-note">SPACE: 건너뛰기 / 모두 열기 / 특별 공개 계속<br>1–9, 0: 해당 카드 열기 · ESC: 창 닫기 / 보급고<br>미공개 카드는 저장됩니다. 다시 열어도 같은 결과가 이어집니다.</p><p class="fine-print">실제 게임과 연결되지 않는 개인용 팬 시뮬레이터입니다. 원본 표지·아이템·카드 이미지를 사용하고 애니메이션과 효과음은 웹에서 재현했습니다. 이미지가 없는 보상은 꽝으로 표시됩니다. 도안 획득과 특수 제작 내역을 따로 저장하며, 실제 게임의 일반 제작·분해·패스는 구현 범위에 포함하지 않습니다.</p>`,'help');}
  function openItemPanel(item){openPanel(item.asset?'획득 아이템':'꽝 · 이미지 미제공',`<div style="display:flex;align-items:center;gap:40px;padding:25px"><div style="width:300px;flex:none">${item.asset?`<img src="${asset(item.asset)}" alt="${esc(item.name)}" style="width:100%">`:'<div class="gallery-blank">꽝</div>'}</div><div><h3>${esc(item.name)}</h3><p>${item.grade} · 획득 확률 ${item.probability}%</p><p>${isPreview?'연출 미리보기입니다.':`보유 ${fmt(state.inventory[item.id]||0)}개`}</p></div></div>`,'item');}
  const panels={craft:renderCraft,inventory:showInventory,rates:showRates,settings:showSettings,preview:showPreview,help:showHelp};
  document.addEventListener('click',e=>{
    const target=e.target.closest('button');if(!target||target.disabled)return;
    if(target.dataset.panel)panels[target.dataset.panel]();
    if(target.dataset.card!==undefined){unlockAudio();revealCard(Number(target.dataset.card));}
    if(target.dataset.claim){if(C.claim(state,Number(target.dataset.claim))){save();renderHome();toast('누적 보상을 받았습니다.');}}
    if(target.dataset.craft){const item=D.crafting.find(x=>x.id===target.dataset.craft);if(C.craft(state,item.id)){save();renderHome();renderCraft();toast(`${item.name.replace(/ 도안$/,'')} 제작 완료`);}else toast('벤틀리 토큰이 부족합니다.');}
    if(target.dataset.preview)preview(target.dataset.preview);
    if(target.dataset.inventoryFilter)showInventory(target.dataset.inventoryFilter);
  });
  document.addEventListener('change',e=>{const key=e.target.dataset.setting;if(key){state.settings[key]=e.target.checked;save();applySettings();if(key==='sound')unlockAudio();}});
  $('drawOne').onclick=()=>draw(1);$('drawTen').onclick=()=>draw(10);$('skipOpening').onclick=finishOpening;
  $('revealAll').onclick=revealAll;$('closeSpotlight').onclick=closeSpotlight;$('resultBack').onclick=goHome;$('resultDone').onclick=goHome;
  $('againTen').onclick=()=>{if(busy||revealingAll)return;goHome();draw(10);};
  $('claimAll').onclick=()=>{let n=0;D.milestones.forEach(m=>{if(C.claim(state,m.at))n++;});if(n){save();renderHome();toast(`누적 보상 ${n}개를 받았습니다.`);}};
  $('closePanel').onclick=closePanel;$('panelOverlay').onclick=e=>{if(e.target===$('panelOverlay'))closePanel();};
  $('toggleSound').onclick=()=>{state.settings.sound=!state.settings.sound;save();applySettings();unlockAudio();};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('브라우저의 F11 키로 전체 화면을 사용할 수 있습니다.');}};
  document.addEventListener('keydown',e=>{
    if(e.repeat)return;
    if(!$('panelOverlay').hidden){
      if(e.key==='Escape'){e.preventDefault();closePanel();}
      if(e.key==='Tab'){const els=[...$('panel').querySelectorAll('button,a,input,select')].filter(x=>!x.disabled&&!x.hidden&&x.offsetParent!==null);const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
      return;
    }
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(!$('spotlight').hidden){if([' ','Escape','Enter'].includes(e.key)){e.preventDefault();closeSpotlight();}return;}
    if(e.key===' '){e.preventDefault();if(screen==='opening')finishOpening();else if(screen==='results'){if(batch.revealed.every(Boolean))goHome();else revealAll();}}
    else if(e.key==='Escape'){if(screen==='opening')finishOpening();else if(screen==='results')goHome();}
    else if(screen==='results'&&/^[0-9]$/.test(e.key)){e.preventDefault();revealCard(e.key==='0'?9:Number(e.key)-1);}
  });
  applySettings();save();renderHome();
  if(state.pending)toast('공개하지 않은 카드가 있습니다. 열기를 누르면 이어집니다.');
})();
