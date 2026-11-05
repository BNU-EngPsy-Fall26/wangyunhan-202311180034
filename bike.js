/* Original cycling simulation. Shared world coordinates drive road and mirrors. */
const BikeLab = (() => {
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const cfg={prepare:600,observe:6000,roadReport:2000,videoReport:2500,gap:120,speed:9,steer:1.7};
  let stopCurrent=null;
  const mediaPool=new Map();
  function media(category,clip){
    const src=`assets/${category}-${clip}.mp4`;
    if(!mediaPool.has(src)){
      const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=src;v.load();mediaPool.set(src,v);
    }
    return mediaPool.get(src);
  }
  function preload(){for(const category of ['sport','scenery'])for(let clip=0;clip<4;clip++)media(category,clip)}
  function instructions(){return `<div class="bike-instructions"><p class="eyebrow">先记住：移动避障和报告危险，是两项任务</p><h1>模拟骑行 · 操作说明</h1>
    <div class="instruction-grid"><article><b>① 骑行时</b><p>车会自动前进。按住 <kbd>←</kbd> / <kbd>→</kbd> 横向移动，松开停止横移。观察前方、左后视镜和右后视镜，尽量留在道路内并避开车辆。</p></article>
    <article><b>② 什么算危险？</b><p>前车或侧后车辆向<strong>起始的中央骑行通道</strong>侵入，可能撞上直行骑行者。仅有车辆经过不算危险。即使你已成功避开，也要报告这次危险。</p></article>
    <article><b>③ 发现危险就按 F</b><p>尽快按 <kbd>F</kbd>，并继续移动避障。请根据看到的车辆运动作答，不要提前猜测。按 F 不会自动避障，也不会提前结束道路画面。</p></article>
    <article><b>④ 道路停止后再判断</b><p>整段未发现危险，等出现“本段无危险”按钮再按 <kbd>D</kbd>。已按 F 就不必按 D。骑行时按 D 不计作答。</p></article>
    <article><b>⑤ 手机播放时看短片</b><p>左下角手机播放 3 秒无声短片。短片结束后画面会隐藏，不保留最后一帧。记住属于运动还是风景；出现类别提示后按 <kbd>J</kbd> 运动 / <kbd>K</kbd> 风景。播放时先不按 J/K。</p></article>
    <article><b>⑥ 先练习，再正式</b><p>先完成 8 段练习，读完反馈后点击继续。之后完成 20 段正式任务，正式阶段不显示对错；每组之间可休息。道路安全与危险判断优先。</p></article></div>
    <div class="instruction-timeline">准备 → 骑行观察 6 秒 → 需要时确认无危险 → 按提示判断短片 → 下一段</div>
    <p>道路观察固定 6 秒，按 F 后仍需继续避障；道路结束后，已报告危险会自动进入下一步。D 确认最多 2 秒，视频判断最多 2.5 秒，作答后立即进入下一步；手机未播放时，无需回答短片问题。试次切换时位置复位。页面失焦会暂停当前试次；恢复后按说明继续。随时可关闭页面退出。</p></div>`}
  const sourceName=s=>({front:'前方',left:'左后视镜',right:'右后视镜'}[s]||'道路');
  function practiceFeedback(row){
    const hazard=row.event==='hazard',f=(row.rawKeys||[]).filter(k=>k.key==='KeyF'),d=(row.rawKeys||[]).some(k=>k.key==='KeyD'),
      late=f.some(k=>k.t>row.actualOnsetMs+2500),early=f.some(k=>k.t<row.actualOnsetMs);
    let road=hazard?(row.hit?'判断正确：你在发现危险后按了 F。':late?'你按了 F，但较晚。下次看到危险时请尽快报告，并继续避让。':early?'F 按得过早。请根据看到的车辆运动报告危险，不要提前猜测。':d?'本段有危险，你选择了 D。下次发现危险时请按 F。':'本段有危险，但没有及时按 F。下次发现后请尽快报告。')
      :row.falseAlarm?'本段车辆安全通过，无需按 F。请在道路结束后按 D。':row.correctReject?'判断正确：本段无危险，你在道路结束后按了 D。':'未作答：本段无危险，需要在道路结束后的提示中按 D。';
    const category=row.videoCategory==='sport'?'运动':'风景',chosen=row.videoResponse==='KeyJ'?'运动':row.videoResponse==='KeyK'?'风景':'未作答';
    const video=row.cond==='road_plus_video'?`<article><b>手机判断：${row.videoCorrect?'正确':'未正确回答'}</b><p>正确类别：${category}；你的答案：${chosen}。</p><p>只在类别提示出现后按 J（运动）或 K（风景）。</p></article>`:'';
    return `<div class="practice-review"><p class="eyebrow">练习反馈 · 不计入正式结果</p><h2>${row.roadCorrect?'道路判断正确':'看看这一段发生了什么'}</h2><div class="review-grid"><article><b>场景与道路判断</b><p>${sourceName(row.source)}的车辆${hazard?'向中央骑行通道侵入，构成危险。':'保持安全距离通过，没有侵入中央通道。'}</p><p>${road}</p>${early?'<p>你有提前按 F；应根据车辆轨迹报告，不要在准备阶段猜测。</p>':''}</article>
    <article><b>移动与避让</b><p>${row.collisions?'本段发生了接触。':'本段未发生接触。'}${row.outsideMs?'请留意道路边界。':''}</p><p>${row.collisions?'报告 F 不会让车辆消失；还需横向移动到空余位置避让。':'没有发生碰撞。避开危险后仍需按 F 报告。'}</p><p>移动避让和按 F 报告都需要完成。</p></article>${video}</div><p>反馈不会自动消失。读完后继续下一段。</p><button id="practice-next">读完了，继续练习</button></div>`;
  }
  function practiceSummary(rows){
    const a=rows.filter(x=>x.valid!==0),road=a.filter(x=>x.roadCorrect).length,v=a.filter(x=>x.cond==='road_plus_video');
    return `<div class="practice-review"><p class="eyebrow">练习完成 · 接下来是正式实验</p><h2>先确认操作规则</h2><p>你已完成练习。请确认已熟悉方向键、F/D 和 J/K 的使用时机。</p><p>${road<a.length||v.some(x=>!x.videoCorrect)?'还有未正确完成的练习，建议先再练一次。':'你已完成所有练习。'}</p><p>骑行时 ← → 移动，发现危险按 F；道路结束后无危险按 D；视频提示出现后 J/K。正式试次不再显示正确答案。道路观察固定 6 秒；其后的确认与类别判断作答后自动继续。</p><button id="practice-repeat" class="secondary">再练一次</button></div>`;
  }
  const hash=s=>[...s].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
  function sequence(conditions,practice,id,ordinal=1) {
    const n=hash(id),order=ordinal%2?[...conditions]:[...conditions].reverse(),rows=[];
    order.forEach((cond,block)=>{
      const count=practice?4:10,b=[];
      for(let i=0;i<count;i++){
        const hazard=i<count/2,within=i%(count/2),source=practice?
          (hazard?[['front','left'],['right','front']]:[['right','front'],['left','right']])[block][within]:
          (within<2?'front':within<4?'left':'right');
        b.push({cond,block:block+1,trial:i+1,event:hazard?'hazard':'clear',source,
          scriptSet:Math.floor((ordinal-1)/2)%2?1-block:block,recruitmentOrder:ordinal,scriptId:within,videoCategory:(within+(hazard?0:1))%2?'scenery':'sport',clip:(within+block)%4,
          onsetMs:1500+((within*211+n%997)%1001),practice,attempt:1});
      }
      // Shuffle with no run of more than three equal event labels.
      for(let attempt=0;attempt<100;attempt++){
        shuffle(b);
        if(!b.some((r,i)=>i>=3&&b.slice(i-3,i+1).every(x=>x.event===r.event)))break;
      }
      rows.push(...b);
    });
    return rows;
  }
  function vehicles(item,t){
    const dt=(t-item.onsetMs)/1000,hazard=item.event==='hazard';
    const side=item.source==='left'?-1:1;
    const enter=clamp(dt/1.6,0,1);
    const target=item.source==='front'
      ?{id:'target',x:hazard?1.5*(1-clamp(dt/.9,0,1)):1.5,z:25-Math.max(0,dt)*8,color:'#df8756'}
      :{id:'target',x:side*(hazard?(1.55-enter*1.55):1.55),z:-18+Math.max(0,dt)*14,color:side<0?'#7597cd':'#ddad54'};
    // Keep rear target in the mirror before the first informative trajectory cue.
    const salt=item.scriptSet?1:-1;
    return [target,{id:'oncoming',x:-2.45,z:65-t/1000*15+item.scriptId*2,color:'#c4cbd0'},
      {id:'traffic',x:2.2,z:28-t/1000*2+salt*2,color:'#75928b'}];
  }
  function score(item,s){
    const hazard=item.event==='hazard',validF=s.keys.find(k=>k.key==='KeyF'&&k.t>=s.actualOnset&&k.t<=s.actualOnset+2500),
      anyF=s.keys.some(k=>k.key==='KeyF'&&k.stage==='observe'),d=s.keys.find(k=>k.key==='KeyD'&&k.stage==='road'),
      hit=hazard&&!!validF,reject=!hazard&&!anyF&&!!d,video=s.keys.find(k=>['KeyJ','KeyK'].includes(k.key)&&k.stage==='video');
    return {experiment:'bike_video_seev',...item,eyeTracking:s.eyeTracking??null,valid:1,roadResponse:hit||(!hazard&&anyF)?'KeyF':d?'KeyD':'miss',
      hit:Number(hit),correctReject:Number(reject),roadCorrect:Number(hit||reject),correct:Number(hit||reject),
      rt:hit?Math.round(validF.t-s.actualOnset):null,roadRt:hit?Math.round(validF.t-s.actualOnset):null,
      miss:Number(hazard&&!hit),falseAlarm:Number(!hazard&&anyF),roadOmission:Number(!anyF&&!d),
      anticipations:s.keys.filter(k=>k.key==='KeyF'&&k.t<s.actualOnset).length,
      videoResponse:video?.key||null,videoCorrect:item.cond==='road_plus_video'?Number(!!video&&video.key===(item.videoCategory==='sport'?'KeyJ':'KeyK')):null,
      videoRt:video?Math.round(video.t-s.videoPromptAt):null,actualOnsetMs:s.actualOnset,
      videoStartedMs:s.videoStarted,videoEndedMs:s.videoEnded,videoHiddenMs:s.videoHidden,videoPromptMs:s.videoPromptAt,roadReportEndMs:s.roadEndMs,completedMs:s.completedMs,
      collisions:s.collisions,outsideMs:Math.round(s.outsideMs),samples:s.samples,rawKeys:s.keys,
      minDistance:Number.isFinite(s.minDistance)?+s.minDistance.toFixed(3):null,ts:Date.now()};
  }
  function summary(rows,cond){
    const a=rows.filter(x=>x.cond===cond&&x.valid!==0&&!x.practice),h=a.filter(x=>x.event==='hazard'),c=a.filter(x=>x.event==='clear');
    const mean=xs=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:null;
    const percent=xs=>xs.length?mean(xs)*100:null;
    return {n:a.length,h:h.length,c:c.length,hit:percent(h.map(x=>x.hit)),reject:percent(c.map(x=>x.correctReject)),
      rt:mean(h.filter(x=>x.hit&&x.roadRt>=150).map(x=>x.roadRt)),miss:h.filter(x=>x.miss).length,
      falseAlarm:c.filter(x=>x.falseAlarm).length,video:cond==='road_plus_video'?percent(a.map(x=>x.videoCorrect)):null,
      collision:a.filter(x=>x.collisions>0).length,outside:a.reduce((n,x)=>n+x.outsideMs,0),
      omissions:a.filter(x=>x.roadOmission).length,fast:h.filter(x=>x.hit&&x.roadRt<150).length};
  }
  function results(rows){
    const f=(x,s='')=>x==null?'—':`${Math.round(x*10)/10}${s}`;
    let html='<p>正式骑行完成。练习及无效原试次不纳入统计；危险判断与避障分别计分。</p><div class="table-scroll"><table><tr><th>条件</th><th>有效试次</th><th>命中 / 正确拒绝</th><th>命中 RT</th><th>漏报 / 误报 / 未答</th><th>碰撞试次 / 越界</th><th>视频正确率</th></tr>';
    const sums=['road_only','road_plus_video'].map(c=>summary(rows,c));
    sums.forEach((s,i)=>html+=`<tr><td>${i?'道路＋视频':'道路单任务'}</td><td>${s.n}（危险 ${s.h} / 安全 ${s.c}）</td><td>${f(s.hit,'%')} / ${f(s.reject,'%')}</td><td>${f(s.rt,' ms')}</td><td>${s.miss} / ${s.falseAlarm} / ${s.omissions}</td><td>${s.collision} / ${f(s.outside/1000,' s')}</td><td>${f(s.video,'%')}</td></tr>`);
    const [a,b]=sums;
    html+=`</table></div><div class="effect-box"><strong>本人的双任务效应（双任务 − 单任务）</strong><p>危险命中率：${a.hit==null||b.hit==null?'—':f(b.hit-a.hit,' 个百分点')}；正确危险 RT：${a.rt==null||b.rt==null?'—':f(b.rt-a.rt,' ms')}；碰撞试次：${b.collision-a.collision}。</p></div><p>正确 RT 均值排除 &lt;150 ms（共 ${a.fast+b.fast} 次）。无效原试次 ${rows.filter(x=>x.valid===0).length} 次，保留于 JSON 并关联补做。视频未答计错误。未采集眼动；这是屏幕骑行模拟，个人差值不代表群体结论。</p>`;
    return html;
  }
  function run(item,onComplete,onInvalid){
    stopCurrent?.();
    const dual=item.cond==='road_plus_video',state={keys:[],samples:[],collisions:0,outsideMs:0,minDistance:Infinity,actualOnset:null,
      videoStarted:null,videoEnded:null,videoHidden:null,videoStopped:false,videoPromptAt:null,x:0,held:new Set(),contacts:new Set(),stage:'loading'},
      stim=document.querySelector('#stimulus'),response=document.querySelector('#response-area');
    stim.innerHTML=`<div class="cycle-lab"><canvas id="cycle-road" aria-label="骑行前方道路与左右后视镜"></canvas><div class="cycle-banner"><b>${dual?'骑行与短片':'骑行观察'}</b><span id="cycle-stage">准备素材…</span></div><div class="cycle-phone"><div class="phone-notch"></div>${dual?'<div id="cycle-video-slot"></div>':'<div class="phone-idle">待机</div>'}<span id="phone-caption">${dual?'短片待播放':'手机待机'}</span></div><div id="cycle-overlay" class="cycle-overlay">准备 · 位置复位</div><div class="cycle-controls">← → 连续移动 · F 报告危险<br>前方 / 左后镜 / 右后镜均需监控</div></div>`;
    const canvas=document.querySelector('#cycle-road'),ctx=canvas.getContext('2d'),video=dual?media(item.videoCategory,item.clip):null,overlay=document.querySelector('#cycle-overlay'),stageLabel=document.querySelector('#cycle-stage'),caption=document.querySelector('#phone-caption');
    if(video){video.id='cycle-video';video.hidden=true;video.pause();video.currentTime=0;document.querySelector('#cycle-video-slot').replaceChildren(video)}
    let raf=0,start=null,last=0,lastSample=0,finished=false,ready=false,prompted='',loadTimer,observed=false,lastStage='',lastSecond=-1,roadEndAt=null,doneAt=null;
    const size={w:canvas.clientWidth,h:canvas.clientHeight},dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(size.w*dpr);canvas.height=Math.round(size.h*dpr);
    function cleanup(){if(observed&&!state.eyeTracking)state.eyeTracking=globalThis.GazeLab?.end();cancelAnimationFrame(raf);clearTimeout(loadTimer);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize);if(video){video.pause();video.removeEventListener('ended',ended);video.removeEventListener('error',mediaError);video.removeEventListener('canplaythrough',begin)}stopCurrent=null}
    function invalid(reason){if(finished)return;finished=true;cleanup();response.innerHTML='<button id="retry-cycle">继续，块末补做此试次</button>';overlay.hidden=false;overlay.textContent='本试次已暂停';document.querySelector('#run-feedback').textContent=reason+'；记录保留，不计入正式结果。';document.querySelector('#retry-cycle').onclick=()=>onInvalid({...item,experiment:'bike_video_seev',valid:0,invalidReason:reason,rawKeys:state.keys,samples:state.samples,eyeTracking:state.eyeTracking??null,practice:item.practice,ts:Date.now()})}
    function blur(){if(ready)invalid('页面失去焦点')}
    function visibility(){if(document.hidden&&ready)invalid('页面进入后台')}
    function resize(){if(ready&&(Math.abs(canvas.clientWidth-size.w)>4||Math.abs(canvas.clientHeight-size.h)>4))invalid('实验区域尺寸改变')}
    function keyDown(e){if(!['ArrowLeft','ArrowRight','KeyF','KeyD','KeyJ','KeyK'].includes(e.code))return;e.preventDefault();if(e.repeat||!ready||finished)return;
      if(['ArrowLeft','ArrowRight'].includes(e.code)){state.held.add(e.code);return}
      input(e.code);
    }
    function keyUp(e){state.held.delete(e.code)}
    // UI acknowledges any F, independent of hidden correctness / scoring window.
    function reported(){return state.keys.some(k=>k.key==='KeyF'&&k.stage==='observe')}
    function hideVideo(pause=true){
      if(!video)return;
      if(!video.hidden)video.hidden=true;
      if(pause&&!state.videoStopped){video.pause();state.videoStopped=true}
      if(state.videoStarted!==null&&state.videoHidden===null){
        state.videoHidden=performance.now()-start-cfg.prepare;
        caption.textContent='短片已隐藏 · 请凭刚才观看的内容判断';
      }
    }
    function input(key){const t=performance.now()-start-cfg.prepare,stage=state.stage;
      if((key==='KeyF'&&stage==='observe')||(key==='KeyD'&&stage==='road'&&!reported())||(['KeyJ','KeyK'].includes(key)&&stage==='video'&&dual)){
        if(key!=='KeyF'&&state.keys.some(k=>k.stage===stage))return;
        state.keys.push({key,t,stage});
        document.querySelector('#run-feedback').textContent=key==='KeyF'?'已记录危险报告；继续移动避障，等待道路结束。':key==='KeyD'?'已记录“本段无危险”，正在进入下一步。':`已记录${key==='KeyJ'?'运动':'风景'}，正在进入下一步。`;
        if(key!=='KeyF')response.querySelectorAll('[data-action]').forEach(b=>b.disabled=true);
      }else if(item.practice){
        document.querySelector('#run-feedback').textContent=key==='KeyD'?'现在仍在骑行。请等道路停止、出现 D 提示后再确认无危险。':['KeyJ','KeyK'].includes(key)?'现在还不能判断类别。记住短片，等 J/K 提示出现后作答。':'请在道路观察阶段按 F；现在的按键不计作答。';
      }
    }
    function buttons(stage){if(prompted===stage)return;prompted=stage;response.innerHTML=stage==='observe'?'<button data-action="KeyF">报告危险 F</button>':stage==='road'?(reported()?'<span>已记录危险报告，请等待</span>':'<button data-action="KeyD">本段无危险 D</button>'):stage==='video'&&dual?'<button data-action="KeyJ">运动 J</button><button data-action="KeyK">风景 K</button>':'';
      response.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>input(b.dataset.action));
    }
    function draw(t){
      const w=size.w,h=size.h;ctx.setTransform(dpr,0,0,dpr,0,0);
      // The camera translation must use the same world-to-screen scale as vehicles.
      const horizon=h*.36,roadBottom=h,offset=-state.x*w*.15;
      ctx.fillStyle='#9cbfd1';ctx.fillRect(0,0,w,h);ctx.fillStyle='#7c957c';ctx.fillRect(0,horizon,w,h);
      for(let side of [-1,1])for(let j=0;j<8;j++){let d=((j/8+t/14000)%1),y=horizon+d*d*(h-horizon),x=w/2+side*(w*.16+d*w*.5)+offset*d;ctx.fillStyle=j%2?'#687d7c':'#a6aaa0';ctx.fillRect(x,y-15-d*110,20+d*70,15+d*110)}
      ctx.fillStyle='#48555c';ctx.beginPath();ctx.moveTo(w*.44,horizon);ctx.lineTo(w*.56,horizon);ctx.lineTo(w+offset,roadBottom);ctx.lineTo(offset,roadBottom);ctx.closePath();ctx.fill();
      const project=(x,z)=>{const d=clamp(1-z/90,0,1);return {x:w/2+x*w*.15*d+offset*d,y:horizon+d*d*(h-horizon),scale:.12+d*1.5}};
      for(let lane of [-3,-1,1,3]){ctx.strokeStyle=Math.abs(lane)===3?'#e8dfb5':'#c7d2d5';ctx.lineWidth=3;ctx.beginPath();const a=project(lane,90),b=project(lane,0);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
      for(let j=0;j<18;j++){const z=(j*7-t/1000*cfg.speed%7),p=project(0,z);ctx.fillStyle='#f5e2ab';ctx.fillRect(p.x-2,p.y,4,Math.max(2,p.scale*9))}
      const cars=vehicles(item,t);
      function car(x,y,s,color,front){ctx.fillStyle='#1d2931';ctx.fillRect(x-17*s,y-3*s,34*s,8*s);ctx.fillStyle=color;ctx.fillRect(x-16*s,y-26*s,32*s,29*s);ctx.fillStyle='#b4d5df';ctx.fillRect(x-11*s,y-21*s,22*s,10*s);ctx.fillStyle=front?'#f1dda2':'#bc4e4e';ctx.fillRect(x-14*s,y-2*s,7*s,4*s);ctx.fillRect(x+7*s,y-2*s,7*s,4*s)}
      [...cars].filter(c=>c.z>=0&&c.z<90).sort((a,b)=>b.z-a.z).forEach(c=>{const p=project(c.x,c.z);car(p.x,p.y,p.scale,c.color,c.id==='oncoming')});
      // Both mirrors render the same world vehicles behind the rider.
      for(const side of [-1,1]){const mx=side<0?18:w-w*.245-18,my=58,mw=w*.245,mh=h*.2;ctx.fillStyle='#182a34';ctx.fillRect(mx-5,my-5,mw+10,mh+10);ctx.fillStyle='#a3beca';ctx.fillRect(mx,my,mw,mh);ctx.fillStyle='#5d6a70';ctx.fillRect(mx,my+mh*.43,mw,mh*.57);ctx.save();ctx.beginPath();ctx.rect(mx,my,mw,mh);ctx.clip();cars.filter(c=>c.z<0&&Math.sign(c.x||side)===side).forEach(c=>{const d=clamp(1-Math.abs(c.z)/35,0,1);car(mx+mw*.5+(c.x-state.x)*mw*.1,my+mh*.48+d*mh*.4,.25+d*.65,c.color,true)});ctx.restore();ctx.fillStyle='#f3f7f8';ctx.font='12px sans-serif';ctx.fillText(side<0?'左后视镜':'右后视镜',mx+9,my+16)}
      ctx.strokeStyle=state.contacts.size?'#f59575':'#cedde0';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(w*.38,h*.95);ctx.lineTo(w*.44,h*.89);ctx.lineTo(w*.56,h*.89);ctx.lineTo(w*.62,h*.95);ctx.stroke();
      ctx.font='13px sans-serif';ctx.fillStyle='#e6eeee';ctx.fillText('固定速度 · 请保持在道路内',w*.38,h-12);
    }
    function frame(now){if(finished)return;if(start===null){start=now;last=now}const elapsed=now-start,dt=now-last;last=now;
      if(observed&&dt>250){invalid('帧间隔超过 250 ms');return}
      const t=elapsed-cfg.prepare;let stage=t<0?'prepare':'observe';
      if(t>=cfg.observe){
        if(roadEndAt===null&&(reported()||state.keys.some(k=>k.key==='KeyD'&&k.stage==='road')||t>=cfg.observe+cfg.roadReport))roadEndAt=t;
        stage=roadEndAt===null?'road':dual&&!state.keys.some(k=>k.stage==='video')&&t<roadEndAt+cfg.videoReport?'video':'gap';
        if(stage==='gap'&&doneAt===null)doneAt=t;
      }
      if(observed&&stage!=='observe'&&!state.eyeTracking)state.eyeTracking=globalThis.GazeLab?.end();
      state.stage=stage;
      if(stage==='observe'){
        if(!observed)globalThis.GazeLab?.begin('bike',item,()=>state.videoStarted!==null&&state.videoHidden===null?'video_visible':'road_only_frame',now-t);
        observed=true;state.x=clamp(state.x+((state.held.has('ArrowRight')?1:0)-(state.held.has('ArrowLeft')?1:0))*cfg.steer*dt/1000,-3.8,3.8);
        if(state.actualOnset===null&&t>=item.onsetMs)state.actualOnset=t;
        if(Math.abs(state.x)>2.8)state.outsideMs+=dt;
        const contacts=new Set();vehicles(item,t).forEach(c=>{const distance=Math.hypot((c.x-state.x),c.z);state.minDistance=Math.min(state.minDistance,distance);if(Math.abs(c.z)<2.1&&Math.abs(c.x-state.x)<.67){contacts.add(c.id);if(!state.contacts.has(c.id))state.collisions++}});state.contacts=contacts;
        if(t>=lastSample){state.samples.push({t:Math.round(t),x:+state.x.toFixed(3),vehicles:vehicles(item,t)});lastSample+=50}
        if(dual&&t>=1000&&state.videoStarted===null){state.videoStarted=t;video.hidden=false;caption.textContent='短片播放中 · 先记住类别';video.play().catch(()=>invalid('视频未能开始播放'))}
        if(dual&&t>1800&&t<3700&&video.currentTime<.1){invalid('视频播放停滞');return}
      }
      // Remove the final frame too: otherwise category remains visible after playback.
      // At the scheduled cutoff hide immediately; allow a short hidden decode tail
      // so a normal ended event is not prevented by pausing at the boundary.
      if(dual&&t>=4000&&state.videoHidden===null)hideVideo(false);
      if(dual&&stage!=='observe'&&stage!=='prepare')hideVideo();
      if(stage==='video'&&state.videoPromptAt===null)state.videoPromptAt=t;
      if(dual&&t>=4400&&state.videoEnded===null){invalid('视频未按时完成');return}
      // No layout reads or per-frame DOM writes: only update text at stage/second changes.
      if(stage==='observe'||stage!==lastStage)draw(clamp(t,0,cfg.observe));buttons(stage);
      const end=stage==='observe'?cfg.observe:stage==='road'?cfg.observe+cfg.roadReport:(roadEndAt||cfg.observe)+cfg.videoReport;
      const second=Math.max(0,Math.ceil((end-t)/1000));
      if(stage!==lastStage||second!==lastSecond){
        overlay.hidden=stage==='observe'||stage==='gap';overlay.textContent=stage==='prepare'?'准备 · 位置复位':stage==='road'?`本段无危险？请按 D · 剩余 ${second} 秒`:stage==='video'?`短片类别：J 运动 / K 风景 · 剩余 ${second} 秒`:'';
        stageLabel.textContent=stage==='observe'?`骑行观察 · 还剩 ${second} 秒`:stage==='prepare'?'准备':stage==='road'?`道路确认 · ${second} 秒`:stage==='video'?`视频判断 · ${second} 秒`:'本段完成';
        if(stage!==lastStage)document.querySelector('#run-feedback').textContent='';
        lastStage=stage;lastSecond=second;
      }
      if(doneAt!==null&&t>=doneAt+cfg.gap){finished=true;state.roadEndMs=roadEndAt;state.completedMs=t;cleanup();onComplete(score(item,state));return}
      raf=requestAnimationFrame(frame);
    }
    function ended(){state.videoEnded=performance.now()-start-cfg.prepare;hideVideo()}
    function mediaError(){invalid('视频素材加载失败')}
    function begin(){if(ready||finished)return;clearTimeout(loadTimer);ready=true;state.stage='prepare';draw(0);raf=requestAnimationFrame(frame)}
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);
    stopCurrent=()=>{finished=true;cleanup()};
    if(video){video.addEventListener('ended',ended);video.addEventListener('error',mediaError);video.addEventListener('canplaythrough',begin);loadTimer=setTimeout(()=>invalid('视频加载超时'),10000);if(video.readyState>=3)begin()}else begin();
  }
  return {sequence,vehicles,score,summary,results,run,instructions,practiceFeedback,practiceSummary,preload,stop:()=>stopCurrent?.(),cfg};
})();
