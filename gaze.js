/* Optional webcam estimates. No video recording, automatic uploads or task-click training. */
globalThis.GazeLab = (() => {
  const VERSION='webgazer-aoi-v1.3', MAX_GAP=200, STEP=50;
  let enabled=false, ready=false, busy=false, generation=0, calibration=null;
  let active=null, validation=null, owner=null, lastSample=-Infinity, loadPromise=null;
  let selected=false,paused=false,lastIssue=null,callbacks=0,predictions=0,nullPredictions=0,lastPredictionAt=null,lastBadgeAt=-Infinity,healthTimer=null;
  const el=id=>document.getElementById(id);
  const badge=t=>{const b=el('gaze-live-status');if(b){b.textContent=t;b.hidden=false}};
  const status=t=>{el('gaze-status').textContent=t;badge(t)};
  const viewport=()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1});
  const sameSize=v=>v&&v.width===innerWidth&&v.height===innerHeight;
  const rect=r=>({x:r.left,y:r.top,w:r.width,h:r.height});
  const inside=(r,x,y)=>r&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
  const median=a=>a.length?[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]:null;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function load(){
    if(globalThis.webgazer)return Promise.resolve();
    if(!loadPromise)loadPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='vendor/webgazer/webgazer.js';
      s.onload=resolve;s.onerror=()=>{loadPromise=null;s.remove();reject(Error('本地 WebGazer 加载失败'))};document.head.appendChild(s);
    });
    return loadPromise;
  }
  function note(reason){if(active&&!active.reasons.includes(reason))active.reasons.push(reason)}
  function invalidate(reason,message){note(reason);if(active)active.recording=false;lastIssue=reason;if(message)status(message)}
  function diagnostics(){return {version:VERSION,selected,enabled,ready,paused,callbacks,predictions,nullPredictions,
    lastPredictionAgeMs:lastPredictionAt===null?null:Math.round(performance.now()-lastPredictionAt),lastIssue,
    calibrationPassed:calibration?.passed??null,validationCounts:calibration?.validation?.map(p=>p.n)||[],medianErrorPx:calibration?.medianErrorPx??null}}
  function stop(message='眼动已关闭；可继续行为任务。',reason='camera_stopped',manual=true){
    generation++;enabled=false;ready=false;paused=false;validation=null;
    globalThis.clearInterval?.(healthTimer);healthTimer=null;
    if(manual)selected=false;
    invalidate(reason);lastIssue=reason;
    const wg=globalThis.webgazer;
    wg?.pause();wg?.removeMouseEventListeners();
    // WebGazer.end alone does not stop the webcam stream in the vendored version.
    const feed=el('webgazerVideoFeed');feed?.srcObject?.getTracks().forEach(t=>t.stop());
    if(wg&&feed){try{wg.end()}catch(_){} }
    el('gaze-overlay').hidden=true;el('gaze-stop-live').hidden=true;status(message);
  }
  function receive(data){
    if(!enabled||paused)return;
    callbacks++;
    if(data&&Number.isFinite(data.x)&&Number.isFinite(data.y)){predictions++;lastPredictionAt=performance.now()}else nullPredictions++;
    if(active?.recording||validation)listener(data);
    const now=performance.now();
    renderHealth(now);
  }
  function renderHealth(now=performance.now()){
    if(!enabled||paused||busy)return;
    if(now-lastBadgeAt>=1000){
      lastBadgeAt=now;
      if(active?.recording)badge(active.samples.length===0&&now-active.start>2000?'眼动已进入试次，但2秒未收到预测；请检查脸部、光线和摄像头。':`眼动采集中 · ${active.samples.length}条记录 / ${active.samples.filter(s=>s.valid).length}条有效预测`);
      else if(active?.requested&&!active.recording)badge('当前试次眼动已标异常；数据保留，后续试次会重新检查采样。');
      else if(ready)badge(lastPredictionAt===null||now-lastPredictionAt>2000?'眼动已校准，但最近未收到视线预测；请检查脸部是否在镜头内。':'眼动已就绪 · 正在接收视线预测');
    }
  }
  function suspend(reason,message){
    if(!enabled)return;
    if(busy){stop('校准/验证期间页面离开前台，请重新校准。','calibration_interrupted',false);return}
    invalidate(reason,message);paused=true;globalThis.webgazer?.pause();
  }
  function resume(){
    if(!enabled||!paused||!ready||document.hidden||document.hasFocus?.()===false)return;
    paused=false;
    Promise.resolve(globalThis.webgazer?.resume?.()).then(()=>{if(enabled&&!paused)badge('眼动已恢复；受失焦影响的当前试次仍不纳入，后续试次重新采样。')}).catch(e=>stop('眼动恢复失败：'+e.message,'resume_failed',false));
  }
  function label(snapshot,x,y){
    for(const a of snapshot.aois)if(inside(a.rect,x,y))return a.name;
    return 'outside';
  }
  function listener(data){
    const now=performance.now();
    const ok=!!data&&Number.isFinite(data.x)&&Number.isFinite(data.y);
    if(validation&&ok&&now>=validation.from)validation.errors.push(Math.hypot(data.x-validation.x,data.y-validation.y));
    if(!active||now-lastSample<STEP)return;
    lastSample=now;
    const x=ok?data.x:null,y=ok?data.y:null;
    const inViewport=ok&&x>=0&&y>=0&&x<=innerWidth&&y<=innerHeight;
    active.samples.push({t:Math.round(now-active.start),x:ok?+x.toFixed(1):null,y:ok?+y.toFixed(1):null,
      aoi:inViewport?label(active.snapshot,x,y):'untracked',valid:Number(inViewport&&!document.hidden&&sameSize(active.snapshot.viewport)),
      stimulusPhase:active.phase?.()??null});
  }
  function snapshot(kind,item){
    const aois=[];
    if(kind==='bike'){
      const canvas=document.querySelector('#cycle-road'),phone=document.querySelector('.cycle-phone');
      if(canvas){const r=rect(canvas.getBoundingClientRect()),w=r.w,h=r.h;
        if(phone)aois.push({name:item.cond==='road_plus_video'?'phone':'phone_idle',rect:rect(phone.getBoundingClientRect())});
        for(const side of [-1,1])aois.push({name:side<0?'left_mirror':'right_mirror',rect:{x:r.x+(side<0?18:w-w*.245-18),y:r.y+58,w:w*.245,h:h*.2}});
        aois.push({name:'road',rect:r});
      }
    }else{
      const scene=document.querySelector('.change-scene');
      if(scene){const r=rect(scene.getBoundingClientRect()),boxes=ChangeScenes.boxes(item);
        for(const [name,b] of Object.entries(boxes))aois.push({name,rect:{x:r.x+b.x/900*r.w,y:r.y+b.y/420*r.h,w:b.w/900*r.w,h:b.h/420*r.h}});
        aois.push({name:'scene_other',rect:r});
      }
    }
    return {viewport:viewport(),scroll:{x:window.scrollX||0,y:window.scrollY||0},aois};
  }
  function readiness(){
    check();resume();
    if(!selected)return {ok:true,requested:false,message:'本次未选择眼动'};
    let message='';
    if(busy)message='校准/验证尚未完成，请完成九点校准和五点独立验证。';
    else if(!enabled)message=calibration?.passed===false?'五点独立验证未通过，九点点击完成后仍需验证通过。':`摄像头采样已停止（${lastIssue||'尚未启动'}），请重新校准。`;
    else if(!sameSize(calibration?.viewport))message=`窗口尺寸已变化：校准时 ${calibration?.viewport?.width||'?'}×${calibration?.viewport?.height||'?'}，现在 ${innerWidth}×${innerHeight}。请在当前窗口重新校准。`;
    else if(!ready)message='校准已失效，请在当前窗口重新完成校准和验证。';
    else if(paused||document.hidden)message='页面尚未恢复到前台，请返回本页后重试。';
    return {ok:!message,requested:true,message};
  }
  function begin(kind,item,phase,origin=performance.now()){
    if(active)end();
    // Normalize page position before capturing AOIs. Delayed automatic scroll events
    // at this same position must not terminate the webcam for subsequent trials.
    window.scrollTo?.(0,0);
    resume();
    const requested=selected,calibrated=enabled&&ready&&!paused&&sameSize(calibration?.viewport);
    active={start:origin,requested,calibrated,samples:[],reasons:[],snapshot:snapshot(kind,item),phase,
      calibration:calibration?JSON.parse(JSON.stringify(calibration)):null,startDiagnostics:diagnostics()};lastSample=-Infinity;
    if(requested&&!calibrated)active.reasons.push('calibration_required');
    if(!requested)active.reasons.push('not_enabled');
    if(requested&&!enabled&&lastIssue)active.reasons.push(lastIssue);
    if(!requested||!calibrated)active.recording=false;else active.recording=true;
    if(active.recording&&document.hidden)invalidate('page_hidden');
    if(requested)badge(active.recording?'眼动已开始采样；请保持页面前台与窗口不变。':'眼动未进入采样：'+readiness().message);
  }
  function end(){
    if(!active)return null;
    const a=active;active=null;
    const durationMs=Math.max(0,Math.round(performance.now()-a.start));
    // Keep the samples already captured even when a later event invalidates the trial.
    const samples=a.samples,valid=samples.filter(s=>s.valid),dwellMs={},firstEntryMs={};
    let coveredMs=0;
    for(let i=0;i<samples.length;i++){
      const s=samples[i];if(!s.valid)continue;
      if(firstEntryMs[s.aoi]===undefined)firstEntryMs[s.aoi]=s.t;
      // Only consecutive valid estimates <=200ms apart contribute; never fill long gaps.
      const n=samples[i+1];if(n?.valid&&n.t-s.t<=MAX_GAP){const dt=n.t-s.t;coveredMs+=dt;dwellMs[s.aoi]=(dwellMs[s.aoi]||0)+dt}
    }
    const coverage=durationMs?coveredMs/durationMs:0;
    const reasons=[...a.reasons];
    if(a.requested){
      if(!samples.length)reasons.push('no_predictions');
      else if(!valid.length)reasons.push('no_valid_predictions');
      if(valid.length<10)reasons.push('sample_count_below_10');
      if(coverage<.5)reasons.push('coverage_below_50pct');
    }
    const gaps=samples.slice(1).map((s,i)=>s.t-samples[i].t);
    return {version:VERSION,requested:a.requested,calibrated:a.calibrated,calibration:a.calibration,
      startPerformanceMs:a.start,durationMs,sampleIntervalMinimumMs:STEP,maxBridgeGapMs:MAX_GAP,samples,snapshot:a.snapshot,startDiagnostics:a.startDiagnostics,
      summary:{sampleCount:samples.length,validCount:valid.length,coveredMs,coverage:+coverage.toFixed(4),dwellMs,firstEntryMs,
        maxPredictionGapMs:gaps.length?Math.max(...gaps):null,usable:Number(a.recording&&reasons.length===0&&coverage>=.5&&valid.length>=10)},invalidReasons:[...new Set(reasons)]};
  }
  async function calibrate(){
    if(busy)return;
    if(!el('consent').checked||!el('gaze-consent').checked||!el('participant').value.trim()){
      status('请先填写匿名编号，并勾选参与同意与摄像头眼动同意。');return;
    }
    // Some browsers consider file: secure, but this WebGazer build explicitly requires HTTPS or localhost.
    const location=window.location;
    if(location&&location.protocol!=='https:'&&!(location.protocol==='http:'&&location.hostname==='localhost')){
      status('当前地址不支持眼动。请通过 http://localhost:8000/ 或 HTTPS 打开；不要双击HTML，也不要使用127.0.0.1或局域网HTTP地址。行为任务仍可进行。');return;
    }
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia){status('摄像头需要 HTTPS 或 localhost 安全环境；当前仍可完成行为任务。');return}
    busy=true;el('gaze-enable').disabled=true;stop('正在启动摄像头…');selected=true;calibration=null;lastIssue=null;callbacks=0;predictions=0;nullPredictions=0;lastPredictionAt=null;lastBadgeAt=-Infinity;const token=generation;
    try{
      await load();if(token!==generation)return;
      const wg=globalThis.webgazer;
      wg.saveDataAcrossSessions(false).setRegression('ridge').showPredictionPoints(false);
      await wg.clearData();
      wg.setGazeListener(receive);
      await wg.begin();
      if(token!==generation){stop();return}
      enabled=true;owner=el('participant').value.trim();el('gaze-stop-live').hidden=false;
      healthTimer=globalThis.setInterval?.(()=>renderHealth(),1000);
      el('webgazerVideoFeed')?.srcObject?.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(enabled)stop('摄像头已断开，请重新启用并校准。','camera_disconnected',false)}));
      wg.removeMouseEventListeners();wg.showVideoPreview(true);
      // Warm the local face model before calibration; model failures reach this catch.
      await wg.getTracker().init();if(token!==generation)return;
      const overlay=el('gaze-overlay'),target=el('gaze-target'),info=el('gaze-instructions');
      overlay.hidden=false;wg.showVideoPreview(false);
      const size=viewport(),points=[];
      for(const y of [.12,.5,.88])for(const x of [.1,.5,.9])points.push([x*size.width,y*size.height]);
      for(let i=0;i<points.length;i++){
        if(token!==generation)return;
        const [x,y]=points[i];target.style.left=x+'px';target.style.top=y+'px';target.disabled=false;
        const shownAt=performance.now();
        let clicks=0;info.textContent=`校准 ${i+1}/9：保持头部不动，注视圆点，每隔约半秒点击，共5次。`;
        await new Promise(resolve=>{
          let last=-Infinity;target.onclick=()=>{
            if(performance.now()-shownAt<800||performance.now()-last<500)return;last=performance.now();
            const before=wg.getRegression?.()[0]?.getData?.().length;
            wg.recordScreenPosition(x,y,'click');
            const after=wg.getRegression?.()[0]?.getData?.().length;
            if(before!==undefined&&after!==before+1){info.textContent='未记录到可用眼部特征，请注视圆点，确认脸部在镜头中后再点击。';return}
            clicks++;target.textContent=String(5-clicks);
            if(clicks===5){target.onclick=null;resolve()}
          };
          // A cancellation polling loop releases this promise without capturing camera data.
          const check=()=>{if(token!==generation){resolve();return}if(clicks<5)setTimeout(check,200)};check();
        });target.textContent='●';
      }
      if(token!==generation)return;
      info.textContent='九点点击完成；接下来还需通过五点独立验证。只看圆点，不点击。';target.disabled=true;
      const results=[];
      for(const [nx,ny] of [[.25,.25],[.75,.25],[.5,.5],[.25,.75],[.75,.75]]){
        if(token!==generation)return;
        const x=nx*size.width,y=ny*size.height;target.style.left=x+'px';target.style.top=y+'px';
        info.textContent=`独立验证 ${results.length+1}/5：只看圆点，不点击。九点点击完成不等于验证通过。`;
        validation={x,y,from:performance.now()+1000,errors:[]};await wait(3500);
        if(token!==generation)return;
        results.push({x,y,n:validation.errors.length,medianErrorPx:median(validation.errors)});validation=null;
      }
      const error=median(results.map(r=>r.medianErrorPx).filter(Number.isFinite));
      const threshold=Math.min(size.width,size.height)*.15;
      ready=sameSize(size)&&results.every(r=>r.n>=8)&&error!==null&&error<=threshold;
      calibration={id:Date.now().toString(36),version:VERSION,at:new Date().toISOString(),viewport:size,points:9,clicksPerPoint:5,targetSettleMs:800,validationSettleMs:1000,validationMeasureMs:2500,
        validation:results,medianErrorPx:error,thresholdPx:threshold,passed:ready};
      overlay.hidden=true;
      if(ready){lastIssue=null;status(`眼动已就绪：五点验证通过，误差中位数 ${Math.round(error)} px。窗口或匿名编号变化后需重校准。`)}
      else stop(`五点独立验证未通过：各点有效预测数 ${results.map(r=>r.n).join('/')}（每点至少8）；各点误差 ${results.map(r=>r.medianErrorPx===null?'缺失':Math.round(r.medianErrorPx)+'px').join('/')}；误差中位数 ${error===null?'缺失':Math.round(error)+'px'}，阈值 ${Math.round(threshold)}px。请调整光线/坐姿后重试。`,'calibration_failed',false);
    }catch(e){stop('眼动启动失败：'+e.message+'。可重试或继续行为任务。','startup_failed',false)}
    finally{busy=false;el('gaze-enable').disabled=false}
  }
  function check(){
    if(enabled&&owner!==el('participant').value.trim()){stop('匿名编号变化，眼动已关闭，请重新校准。','participant_changed',false)}
    else if(enabled&&!sameSize(calibration?.viewport)){ready=false;invalidate('viewport_changed','窗口变化，当前眼动校准不再适用，请重新校准。')}
  }
  function report(rows){
    const a=rows.filter(r=>!r.practice&&r.valid!==0&&r.eyeTracking?.requested);
    if(!a.length)return '<p>本次未启用 webcam 眼动，或没有可汇总的眼动试次。</p>';
    let html='<h2>WebGazer 估计视线（个体）</h2><p>AOI停留按相邻有效样本间隔累计，≤200ms；不等于已识别的注视或注意。覆盖率≥50%、≥10有效样本且无异常才纳入。</p><table><tr><th>条件</th><th>可用/启用试次</th><th>平均覆盖率</th><th>AOI停留占有效时间</th></tr>';
    for(const cond of [...new Set(a.map(r=>r.cond))]){
      const all=a.filter(r=>r.cond===cond),good=all.filter(r=>r.eyeTracking.summary.usable),totals={};let covered=0;
      for(const r of good){covered+=r.eyeTracking.summary.coveredMs;for(const [k,v] of Object.entries(r.eyeTracking.summary.dwellMs))totals[k]=(totals[k]||0)+v}
      html+=`<tr><td>${cond}</td><td>${good.length}/${all.length}</td><td>${Math.round(all.reduce((s,r)=>s+r.eyeTracking.summary.coverage,0)/all.length*100)}%</td><td>${covered?Object.entries(totals).map(([k,v])=>`${k}: ${Math.round(v/covered*100)}%`).join('；'):'—'}</td></tr>`;
    }return html+'</table><p>精度不足以支持“看了却没看见”或眼跳/瞳孔结论；变化盲安全/背景仍存在刺激混淆。</p>';
  }
  function init(){
    el('gaze-enable').onclick=calibrate;el('gaze-stop').onclick=()=>stop();el('gaze-stop-live').onclick=()=>stop();el('gaze-cancel').onclick=()=>stop();
    el('gaze-consent').onchange=()=>{if(!el('gaze-consent').checked)stop()};
    el('participant').addEventListener('input',()=>{if(enabled)check()});
    window.addEventListener('resize',()=>{if(enabled&&!sameSize(calibration?.viewport)){if(busy){stop('校准时窗口变化，请重新校准。','calibration_interrupted',false);return}ready=false;invalidate('viewport_changed','窗口尺寸变化，请返回首页重新校准；当前试次不纳入眼动。');paused=true;globalThis.webgazer?.pause()}});
    window.addEventListener('blur',()=>suspend('focus_lost','页面失焦，当前眼动试次不纳入；回到前台后自动恢复后续采样。'));
    window.addEventListener('focus',resume);
    window.addEventListener('scroll',()=>{
      if(active?.recording&&((window.scrollX||0)!==active.snapshot.scroll.x||(window.scrollY||0)!==active.snapshot.scroll.y)){
        invalidate('viewport_scrolled','试次中页面滚动，当前眼动试次不纳入；摄像头保留，下一试次重新定位采样。');
      }
    },{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend('page_hidden','页面进入后台，暂停眼动；回到前台后恢复后续试次。');else resume()});
    window.addEventListener('pagehide',()=>stop());
  }
  return {init,begin,end,stop,check,readiness,calibrate,report,diagnostics,version:VERSION};
})();
