/* Static screen simulation with optional, consented local WebGazer estimates. */
const LAB='https://attention-lab-production.up.railway.app';
const PROJECT='P86GHC';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const views={home:$('#view-home'),task:$('#view-task'),run:$('#view-run'),result:$('#view-result')};
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const experiments={
 bike:{name:'bike_video_seev',title:'实验一：模拟骑行与短视频',text:'请坐在安全、静止的环境中完成第一人称屏幕骑行模拟。请观察道路，并在手机播放时观看短片。按住 ←/→ 连续左右移动并避开车辆，同时监控前方及左右后视镜。发现危险立即按 F；道路结束后才按 D 确认无危险。左下角手机播放短片时请观看，稍后按 J（运动）或 K（风景）。道路安全与危险判断优先。先完成练习，再完成正式任务。',conditions:['road_only','road_plus_video']},
change:{name:'change_blind',title:'实验二：图像找不同',text:'场景 A 与变化场景 A′交替呈现，中间插入短暂灰屏。发现变化后，直接点击图中发生变化的位置，不再按空格或选择物体名称。第一次点击即提交本段答案；灰屏时也可以点击记住的变化位置。20 秒未点击会结束本段。练习反馈后手动继续，正式试次自动进入下一段。整个任务始终优先关注交通安全信息：通行方向、车辆和行人的位置、骑行照明。同时寻找全图任何变化。请保持窗口大小不变并留在本页。先完成 4 次练习，再完成 20 次正式任务。',conditions:['task_relevant','background']}
};
let restedBlock=null;
let cancelChange=null;
const researchView=(window.location?.search||'').slice(1).split('&').includes('research=1');
function completionContent(report){return globalThis.LabAnalysis?LabAnalysis.personal(trials,current.name):report}
let current=null,phase='practice',trials=[],index=0,t0=0,timer=null,keyHandler=null,activeList=[],sessionId=null;
function show(which){Object.values(views).forEach(x=>x.classList.remove('active'));views[which].classList.add('active')}
function participant(){return $('#participant').value.trim()||'guest-'+Math.random().toString(36).slice(2,7)}
function startTask(id){globalThis.GazeLab?.check();cancelChange?.();BikeLab.stop();current=experiments[id];if(!$('#consent').checked){alert('请先阅读参与说明并勾选同意。');return}if(!$('#participant').value.trim()){$('#participant').focus();$('#participant').placeholder='请先填写匿名编号';return}const isBike=current.name==='bike_video_seev';if(isBike&&(!Number.isInteger(Number($('#order-number').value))||Number($('#order-number').value)<1)){alert('请由实验者填写正整数招募顺序。');return}if(isBike&&(window.innerWidth<960||window.innerHeight<650)){alert('骑行实验需使用桌面键盘，窗口至少 960×650。请放大窗口后开始。');return}const requirement=isBike?'共 8 次练习、20 次正式任务。每试次约 7–11 秒；分块进行，块间可休息。':'共 4 次练习、20 次正式任务；每试次最多 20 秒。';$('#task-content').innerHTML=`<div class="taskbox"><span class="tag">${current.name}</span><h1>${current.title}</h1><p>${current.text}</p><p><b>试次安排：</b>${requirement}</p><p>参与者编号请使用匿名代号，不要填写姓名或学号。骑行模拟请在安全、静止环境中完成。数据只在结果页手动提交；也可下载 JSON 备份。</p></div>`;if(isBike){$('#task-content').innerHTML=BikeLab.instructions();BikeLab.preload()}$('#begin').textContent='开始练习';$('#begin').onclick=()=>run('practice');show('task')}
function makeTrials(which){const out=[],practice=which==='practice';if(current.name==='bike_video_seev'){return BikeLab.sequence(current.conditions,practice,participant(),Number($('#order-number').value)||1)}else if(current.name==='change_blind'){return ChangeScenes.trials(practice,Number($('#order-number').value)||1)}return shuffle(out)}
function run(which){cancelChange?.();BikeLab.stop();phase=which;if(which==='practice'||which==='formal')trials=[];if(which==='formal')sessionId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);index=0;restedBlock=null;activeList=makeTrials(which);show('run');nextTrial()}
function nextTrial(){if(index>=activeList.length){finish();return}const item=activeList[index];$('#phase-label').textContent=phase==='practice'?'练习':'正式试次';$('#progress').textContent=`${index+1} / ${activeList.length}`;if(current.name==='bike_video_seev'&&restedBlock!==item.block){restedBlock=item.block;$('#run-feedback').textContent='本块开始前可休息，准备好再继续。';$('#stimulus').innerHTML=`<div class="block-break"><p class="eyebrow">${phase==='practice'?'练习':'正式'} · 第 ${item.block} / 2 块</p><h2>${item.cond==='road_only'?'骑行观察':'骑行与短片'}</h2><p>← → 移动避障；前方和两侧后视镜均需监控。<br>危险按 F；结束后确认无危险按 D。${item.cond==='road_plus_video'?'<br>左下角短片：稍后 J＝运动 / K＝风景。':''}</p><button id="continue-block">准备好了，开始本块</button></div>`;$('#response-area').innerHTML='';$('#continue-block').onclick=nextTrial;return}$('#phase-label').textContent=phase==='practice'?'练习':'正式试次';$('#progress').textContent=`${index+1} / ${activeList.length}`;$('#run-feedback').textContent='';$('#response-area').innerHTML='';item.started=performance.now();if(current.name==='change_blind'){flashTrial(item);return}renderRoad(item)}
function renderRoad(item){
  BikeLab.run(item,row=>{
    row.eyeTracking ??= globalThis.GazeLab?.end();trials.push(row);index++;
    if(phase==='practice'){
      $('#stimulus').innerHTML=BikeLab.practiceFeedback(row);$('#response-area').innerHTML='';
      $('#run-feedback').textContent='读完反馈后点击继续；本页不会自动跳转。';
      $('#practice-next').textContent=index>=activeList.length?'查看练习总结':'读完了，下一段练习';
      $('#practice-next').onclick=nextTrial;$('#practice-next').focus();
    }else{ $('#run-feedback').textContent='本段完成，正在进入下一段。';timer=setTimeout(nextTrial,80) }
  },row=>{
    row.eyeTracking ??= globalThis.GazeLab?.end();trials.push(row);const redo={...item,attempt:item.attempt+1,retryOf:`${item.cond}-${item.trial}-${item.attempt}`};
    const pos=activeList.findIndex((x,i)=>i>index&&x.block!==item.block);activeList.splice(pos<0?activeList.length:pos,0,redo);index++;nextTrial();
  });
}
function flashTrial(item,ready=false){
  cancelChange?.();clearTimeout(timer);
  if(!ready){
    let cueActive=true;cancelChange=()=>{cueActive=false;$('#stimulus').onclick=null};
    $('#stimulus').onclick=null;
    $('#stimulus').innerHTML=`<div class="block-break"><p class="eyebrow">本轮关注目标</p><h2>${ChangeScenes.cueText(item)}</h2><p>整个任务都请优先观察交通安全信息，同时寻找<strong>整幅图中的任何变化</strong>。<br>其他物体也可能变化，发现后同样直接点击。<br>变化可能涉及位置、方向、照明或外观结构。灰屏也可以点击。</p><button id="change-ready">记住关注目标，开始本轮</button></div>`;
    $('#response-area').innerHTML='';$('#run-feedback').textContent='提示阶段不计时；点击开始后才开始本轮计时。';
    $('#change-ready').onclick=e=>{e?.stopPropagation?.();if(cueActive)flashTrial(item,true)};return;
  }
  $('#run-feedback').textContent='';
  const st=$('#stimulus'),limit=20000,invalidReasons=new Set(),phaseTimes=[{phase:0,atMs:0}];let started=performance.now(),lastFrame=started,phaseIndex=0,cycles=0,done=false,cancelled=false,flashTimer=null,deadlineTimer=null,advanceTimer=null;
  const onBlur=()=>invalidReasons.add('focus_lost'),onResize=()=>invalidReasons.add('window_resized'),onVisibility=()=>{if(document.hidden)invalidReasons.add('page_hidden')};
  window.addEventListener('blur',onBlur);window.addEventListener('resize',onResize);document.addEventListener?.('visibilitychange',onVisibility);
  const stopSearch=()=>{clearTimeout(deadlineTimer);clearInterval(flashTimer);st.onclick=null;window.removeEventListener('blur',onBlur);window.removeEventListener('resize',onResize);document.removeEventListener?.('visibilitychange',onVisibility)};
  cancelChange=()=>{cancelled=true;done=true;stopSearch();clearTimeout(advanceTimer);globalThis.GazeLab?.end()};
  const render=()=>{if(done)return;st.innerHTML=ChangeScenes.scene(item,phaseIndex%4===2,phaseIndex%2===1)};
  const finishClick=(click=null)=>{
    if(done)return;done=true;stopSearch();
    const timeout=click===null,correct=!!click&&click.object===item.target;
    trials.push({experiment:current.name,cond:item.cond,trial:item.trial,sceneId:item.sceneId,target:item.target,pairId:item.pairId,layout:item.layout,variant:item.variant,beforeState:item.beforeState,afterState:item.afterState,changeDescription:item.changeDescription,cueObjects:item.cueObjects,changeKind:item.changeKind,cueVersion:item.cueVersion,stimulusVersion:item.stimulusVersion,
      eyeTracking:globalThis.GazeLab?.end(),response:click?.object||null,responseMode:'location_click_all_phases',clickedDuringMask:click?.masked??null,clickX:click?.x??null,clickY:click?.y??null,valid:Number(invalidReasons.size===0),invalidReasons:[...invalidReasons],phaseTimes,
      found:Number(!timeout),rt:click?Math.round(click.rt):null,reportCorrect:Number(correct),correct:Number(correct),
      timeout:Number(timeout),cycles,practice:phase==='practice',limitMs:limit,ts:Date.now()});
    index++;$('#response-area').innerHTML='';
    if(phase==='practice'){
      st.innerHTML=ChangeScenes.scene(item,true,false,true);
      $('#run-feedback').textContent=timeout?'练习：20 秒内没有点击，本段已结束。框出的区域是变化位置。':correct?'练习：点击正确。框出的区域是变化位置。':'练习：点击位置不正确。框出的区域是实际变化位置；下一段请直接点击该物体。';
      $('#response-area').innerHTML='<button id="change-next">看完反馈，继续</button>';$('#change-next').onclick=nextTrial;
    }else{
      st.innerHTML='<div class="change-mask">'+(timeout?'本段已超时':'点击已记录')+'</div>';
      $('#run-feedback').textContent=timeout?'20 秒内未点击，本段已结束；即将进入下一段。':'本段已提交，正式试次不显示正确答案。';
      advanceTimer=setTimeout(()=>{if(!cancelled)nextTrial()},timeout?1200:600);
    }
  };
  $('#response-area').innerHTML=`<p class="change-hint"><strong>本轮优先关注：${ChangeScenes.cueText(item)}</strong><br>仍需寻找全图任何变化。直接点击，灰屏也可点击；第一次点击即提交。每段限时 20 秒。</p>`;
  st.onclick=e=>{
    if(done)return;
    const rt=performance.now()-started;if(rt>=limit){finishClick();return}
    const scene=st.querySelector('.change-scene');if(!scene||!scene.contains(e.target))return;
    const rect=scene.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
    const x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;
    finishClick({object:ChangeScenes.hit(item,x,y),masked:phaseIndex%2===1,x:(e.clientX-rect.left)/rect.width,y:(e.clientY-rect.top)/rect.height,rt});
  };
  started=performance.now();lastFrame=started;render();globalThis.GazeLab?.begin('change',item,()=>phaseIndex%4,started);flashTimer=setInterval(()=>{const now=performance.now();if(now-lastFrame>650)invalidReasons.add('late_flash_frame');lastFrame=now;phaseIndex++;phaseTimes.push({phase:phaseIndex%4,atMs:Math.round(now-started)});if(phaseIndex%4===0)cycles++;render()},400);
  deadlineTimer=setTimeout(()=>finishClick(),limit);
}
function changeScene(item,changed){return ChangeScenes.scene(item,changed)}
function finish(){if(phase!=='practice')resetUploadUI();if(phase==='practice'){show('task');if(current.name==='bike_video_seev'){$('#task-content').innerHTML=BikeLab.practiceSummary(trials);$('#practice-repeat').onclick=()=>run('practice')}$('#begin').textContent='我已理解规则，开始正式实验';$('#begin').onclick=()=>run('formal');return}show('result');if(current.name==='bike_video_seev'){$('#result-title').textContent=current.title;$('#submit-status').textContent='';$('#result-content').innerHTML=completionContent(BikeLab.results(trials));$('#submit').onclick=submitCurrent;$('#download').onclick=downloadCurrent;return}$('#result-title').textContent=current.title;$('#submit-status').textContent='';let html='<p>正式试次完成；练习、失焦、窗口变化和闪烁延迟异常试次不计入结果汇总。有效数不足时须另行报告，不自动补做。</p><table><tr><th>条件</th><th>试次数</th><th>定位正确率</th><th>正确点击 RT</th><th>超时</th><th>错误定位</th><th>点击中正确</th></tr>';for(const c of current.conditions){const a=trials.filter(x=>x.cond===c&&!x.practice&&x.valid!==0);{const found=a.filter(x=>x.found),correct=found.filter(x=>x.reportCorrect),rts=correct.map(x=>x.rt).filter(x=>Number.isFinite(x)&&x>=150),m=rts.length?Math.round(rts.reduce((u,v)=>u+v,0)/rts.length):'—';html+='<tr><td>'+(c==='task_relevant'?'任务相关变化':'任务无关变化')+'</td><td>'+a.length+'</td><td>'+(a.length?Math.round(correct.length/a.length*100):0)+'%（点击报告 '+(a.length?Math.round(found.length/a.length*100):0)+'%）</td><td>'+m+(m==='—'?'':' ms')+'</td><td>'+a.filter(x=>x.timeout).length+'</td><td>'+a.filter(x=>x.found&&!x.reportCorrect).length+'</td><td>'+correct.length+'/'+(found.length||0)+'</td></tr>'}}html+='</table><p>本实验始终关注交通安全。相关变化具有通行方向、停止线、斑马线或骑行照明意义；背景变化为树冠、遮阳篷、座椅靠背和花簇外观。物体类别及变化内容与条件混淆，不能将条件差异单独归因于注意优先级。反应时从搜索开始至首次位置点击计算，包含鼠标定位时间；灰屏点击同样有效。</p><p>骑行危险命中率只按危险试次计算，正确拒绝率只按无危险试次计算；反应时只纳入正确危险命中或正确变化报告。骑行模块为静止屏幕模拟；可选 webcam 仅提供估计视线，不将 AOI 命中解释为精确注视或“看了却没看见”。小样本结果以描述性比较为主。</p>';$('#result-content').innerHTML=completionContent(html);$('#submit').onclick=submitCurrent;$('#download').onclick=downloadCurrent}const uploadReceipts=new Map();
let courseUploadClient=null;
function resetUploadUI(){
  $('#submit').disabled=false;
  $('#submit').textContent='提交本实验数据';
}
async function submitCurrent(){
  const status=$('#submit-status'),button=$('#submit');
  if(!$('#consent').checked){status.textContent='未勾选参与同意，未发送数据。';return}
  if(!$('#participant').value.trim()){status.textContent='匿名编号为空，未发送数据。';return}
  if(!globalThis.CourseUpload){status.textContent='课程上传模块未加载。请先下载完整备份，再检查本地文件或网页资源。';return}
  const data=exportCurrentData(),sid=data.meta.sessionId,experiment=data.experiment;
  const options={project:PROJECT,test:!!$('#upload-test').checked,endpoint:LAB+'/api/hw2/submit'};
  const isCurrent=()=>sessionId===sid&&current?.name===experiment;
  let saved=false,pending=false;
  try{
    const wire=CourseUpload.build(data,options);
    button.disabled=true;
    status.textContent=`正在提交 ${wire.report.trials} 条有效正式试次（${(wire.report.bytes/1024).toFixed(1)} KiB，单试次最多 ${wire.report.maxFields} 字段）${options.test?'；当前为test_测试实验':'；当前为正式实验'}…`;
    courseUploadClient??=CourseUpload.createClient();
    const result=await courseUploadClient.submit(data,options);
    if(result.state==='pending'){pending=true;if(isCurrent())status.textContent='本会话正在提交，请等待回执；没有重复发送。';return}
    saved=true;
    uploadReceipts.set(sid,{at:new Date().toISOString(),response:result.response,report:result.report});
    if(isCurrent()){
      status.innerHTML=CourseUpload.responseHTML(result.response,result.report,{already:result.already});
      button.textContent=CourseUpload.warningData(result.response).has?'已保存（请核查警告）':'已提交';
    }
  }catch(error){
    if(isCurrent()){
      status.textContent=(error.uncertain?'未取得明确回执：':'提交未成功：')+error.message+' 请保留本机完整JSON/CSV。';
      button.textContent=error.uncertain?'核对后台后再重试':'重试提交';
    }
  }finally{if(isCurrent())button.disabled=saved||pending}
}
function exportCurrentData(){return {schemaVersion:4,experiment:current.name,participant:participant(),meta:{simulation:true,courseUpload:uploadReceipts.get(sessionId),rtMinimumMs:150,practiceExcluded:true,sessionId,analysisVersion:globalThis.LabAnalysis?.VERSION,predictionModel:globalThis.LabAnalysis?.MODEL,version:current.name==='bike_video_seev'?'cycling-v3.3-gaze1':'change-safety-v5.1-gaze1',eyeTrackingVersion:globalThis.GazeLab?.version,timing:current.name==='bike_video_seev'?BikeLab.cfg:null,conditionOrder:[...new Set(trials.map(x=>x.cond))]},trials:trials.filter(x=>!x.practice)}}
function downloadCurrent(){const blob=new Blob([JSON.stringify(exportCurrentData(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${current.name}_${participant()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function downloadCSV(){if(!globalThis.LabAnalysis)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([LabAnalysis.csv(exportCurrentData())],{type:'text/csv;charset=utf-8'}));a.download=`${current.name}_${participant()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$('#download-csv').onclick=downloadCSV;
// Local development defaults to test_; use ?test=1 for QA on a public HTTPS site.
const uploadLocation=window.location||{};
$('#upload-test').checked=(uploadLocation.search||'').slice(1).split('&').includes('test=1')||uploadLocation.protocol==='file:'||['localhost','127.0.0.1'].includes(uploadLocation.hostname);
globalThis.GazeLab?.init();
$$('[data-start]').forEach(b=>b.onclick=()=>startTask(b.dataset.start));$$('[data-home]').forEach(b=>b.onclick=()=>{cancelChange?.();BikeLab.stop();globalThis.GazeLab?.end();show('home')});;
