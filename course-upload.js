/* Course HW2 wire format. Full local exports are never mutated or silently truncated. */
(function(root){
  'use strict';
  const SCHEMA='hw2-flat-v1';
  // 256000 is conservative if the service interprets "256 KB" as decimal KB.
  const LIMITS=Object.freeze({bytes:256000,trials:2000,fields:40,string:2000,array:500});
  const AOIS=Object.freeze(['road','left_mirror','right_mirror','phone','sign','car','person','bicycle','tree','building','bench','flowers','scene_other','outside']);
  const QUALITY=Object.freeze(['calibrated','sampleCount','validCount','coveredMs','coverage','durationMs','medianErrorPx']);
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed={bike_video_seev:['road_only','road_plus_video'],change_blind:['task_relevant','background']};
  const bikeFields=['event','source','hit','miss','falseAlarm','correctReject','roadOmission','anticipations','videoCorrect','videoRt','videoResponse','collisions','outsideMs','minDistance','block','recruitmentOrder','scriptSet','scriptId','videoCategory','clip'];
  const changeFields=['sceneId','target','pairId','layout','variant','found','reportCorrect','timeout','response','clickX','clickY','clickedDuringMask','cycles','limitMs','changeKind','beforeState','afterState','cueVersion','stimulusVersion','changeDescription'];
  function put(out,key,value){if(value!==undefined&&value!==null)out[key]=value}
  function bit(v){return v===true||v===1?1:0}
  function measurement(value,field){if(value===null||value===undefined)return -1;if(!finite(value)||value<0)throw Error(field+'不是非负有限测量值。');return value}
  function validateRow(row,index){
    const entries=Object.entries(row);if(entries.length>LIMITS.fields)throw Error(`第${index+1}试次超过${LIMITS.fields}字段，未发送。`);
    for(const [key,value] of entries){
      if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))throw Error('字段名不符合接口规则：'+key);
      if(typeof value==='string'){if(value.length>LIMITS.string)throw Error(`第${index+1}试次 ${key} 超过${LIMITS.string}字符；未截断，未发送。`)}
      else if(typeof value==='number'){if(!finite(value))throw Error(`第${index+1}试次 ${key} 含NaN/Infinity；未发送。`)}
      else if(typeof value==='boolean'){}
      else if(Array.isArray(value)){if(value.length>LIMITS.array||!value.every(finite))throw Error(`第${index+1}试次 ${key} 必须为≤${LIMITS.array}项的有限数字数组。`)}
      else throw Error(`第${index+1}试次 ${key} 含对象、null或其他不支持类型。`);
    }
    return row;
  }
  function modelFields(model){
    if(!model)return {};
    if(typeof model.version!=='string')throw Error('模型版本缺失。');
    const keys=['road','left_mirror','right_mirror','phone'],p=[];
    for(const c of ['road_only','road_plus_video'])for(const k of keys){const values=model.parameters?.[c]?.[k];if(!Array.isArray(values)||values.length!==4||!values.every(finite))throw Error('冻结模型参数不完整，未发送。');p.push(...values)}
    return {model_v:model.version,model_p:p};
  }
  function eyeFields(eye){
    const out={eye_on:bit(eye?.requested),eye_ok:bit(eye?.summary?.usable)};
    if(!eye){out.eye_ok=0;return out}
    put(out,'eye_v',eye.version);
    if(!eye.requested){out.eye_ok=0;return out}
    const s=eye.summary||{},cal=eye.calibration;
    out.eye_q=[bit(eye.calibrated),measurement(s.sampleCount,'眼动样本数'),measurement(s.validCount,'眼动有效数'),measurement(s.coveredMs,'眼动覆盖时长'),measurement(s.coverage,'眼动覆盖率'),measurement(eye.durationMs,'眼动时长'),measurement(cal?.medianErrorPx,'校准误差')];
    if(finite(s.coverage)&&(s.coverage<0||s.coverage>1.01))throw Error('眼动覆盖率异常。');
    const dwell=s.dwellMs||{},first=s.firstEntryMs||{};
    out.eye_d=AOIS.map(k=>{
      const values=k==='phone'?[dwell.phone,dwell.phone_idle]:[dwell[k]];
      for(const v of values)if(v!==undefined&&v!==null&&(!finite(v)||v<0))throw Error('AOI停留值异常。');
      return values.reduce((sum,v)=>sum+(v??0),0);
    });
    out.eye_f=AOIS.map(k=>{
      const values=k==='phone'?[first.phone,first.phone_idle]:[first[k]];
      const available=values.filter(v=>v!==undefined&&v!==null);
      return available.length?Math.min(...available.map(v=>measurement(v,'AOI首次进入'))):-1;
    });
    return out;
  }
  function timingSummary(row){
    const times=row.phaseTimes;if(!Array.isArray(times)||!times.length)return undefined;
    const t=times.map(p=>p.atMs);if(!t.every(v=>finite(v)&&v>=0))throw Error('闪烁回调时间含无效值。');
    const gaps=t.slice(1).map((v,i)=>v-t[i]);if(gaps.some(v=>v<0))throw Error('闪烁回调时间未递增。');
    return [times.length,gaps.length?Math.max(...gaps):0,t[t.length-1]];
  }
  function compact(row,session,model){
    if(row.valid!==undefined&&row.valid!==1)throw Error('正式试次有效性标记异常。');
    if(!allowed[session.experiment].includes(row.cond)||!Number.isInteger(row.trial)||row.trial<1)throw Error('正式试次的条件或编号异常。');
    if(![0,1,true,false].includes(row.correct))throw Error('正式试次正确性字段缺失。');
    if(row.rt!==undefined&&row.rt!==null&&(!finite(row.rt)||row.rt<0))throw Error('RT含非有限值或负数，未发送。');
    const out={data_v:SCHEMA,stim_v:session.meta.version,session_id:session.meta.sessionId,cond:row.cond,trial:row.trial,valid:1,correct:bit(row.correct),rt_missing:Number(row.rt===null||row.rt===undefined),...eyeFields(row.eyeTracking),...model};
    put(out,'rt',row.rt);put(out,'attempt',row.attempt);put(out,'ts',row.ts);
    for(const key of (session.experiment==='bike_video_seev'?bikeFields:changeFields))put(out,key,row[key]);
    if(session.experiment==='bike_video_seev'){
      if(!['hazard','clear'].includes(row.event))throw Error('骑行危险类型缺失。');
      for(const k of ['hit','miss','falseAlarm','correctReject','collisions','outsideMs'])if(!finite(row[k])||row[k]<0)throw Error('骑行主计分字段缺失或异常：'+k);
      put(out,'eventOnset',row.actualOnsetMs);
    }else{
      for(const k of ['found','reportCorrect','timeout'])if(![0,1].includes(row[k]))throw Error('变化盲主计分字段缺失或异常：'+k);
      put(out,'flash_q',timingSummary(row));
    }
    return out;
  }
  function build(session,{project,test=false}={}){
    if(!/^[A-Z0-9]{6}$/.test(project||''))throw Error('请配置真实6位项目码。');
    if(!session||!own(allowed,session.experiment)||!Array.isArray(session.trials))throw Error('不支持的实验或会话数据。');
    if(typeof session.participant!=='string'||!session.participant.trim()||session.participant.length>24)throw Error('请使用1–24字符的匿名编号。');
    if(!session.meta?.version||!session.meta.sessionId)throw Error('会话版本或sessionId缺失；请开始新一轮正式实验。');
    if(typeof session.meta.version!=='string'||typeof session.meta.sessionId!=='string'||session.meta.version.length>100||session.meta.sessionId.length>100)throw Error('会话元信息格式异常。');
    const formal=session.trials.filter(r=>!r.practice),valid=formal.filter(r=>r.valid!==0),model=modelFields(session.meta.predictionModel);
    if(!valid.length)throw Error('没有可上传的有效正式试次。请先下载完整备份。');
    if(valid.length>LIMITS.trials)throw Error(`有效正式试次超过${LIMITS.trials}，不会自动拆成多次提交。`);
    const trials=valid.map(r=>compact(r,session,model));trials.forEach(validateRow);
    const ids=trials.map(r=>r.cond+':'+r.trial);if(new Set(ids).size!==ids.length)throw Error('同一条件/编号有多个有效尝试，未上传。');
    const experiment=(test?'test_':'')+session.experiment;
    const counts=Object.fromEntries(allowed[session.experiment].map(c=>[c,valid.filter(r=>r.cond===c).length]));
    const meta={source:'attention-lab-course-project',upload_schema:SCHEMA,version:session.meta.version,session_id:session.meta.sessionId,analysis_version:session.meta.analysisVersion||'',model_version:model.model_v||'',formal_total:formal.length,excluded_invalid:formal.length-valid.length,excluded_practice:session.trials.length-formal.length,test_mode:test};
    for(const [c,n] of Object.entries(counts))meta[c+'_n']=n;
    const payload={project,experiment,participant:session.participant,condition:'',trials,meta};
    const body=JSON.stringify(payload),bytes=new TextEncoder().encode(body).byteLength;
    if(bytes>LIMITS.bytes)throw Error(`精简后的请求仍为${bytes}字节，超过保守上限${LIMITS.bytes}；未截断、未拆分、未发送，请下载完整备份。`);
    const maxFields=Math.max(...trials.map(r=>Object.keys(r).length));
    return {payload,body,report:{schema:SCHEMA,bytes,maxBytes:LIMITS.bytes,maxFields,trials:trials.length,counts,excludedInvalid:meta.excluded_invalid,excludedPractice:meta.excluded_practice,test},
      // One successful submission per local session, even if the test checkbox is later changed.
      key:[project,session.experiment,session.participant,session.meta.sessionId].join('|')};
  }
  function warningData(response){
    const messages=response?.warnings==null?[]:Array.isArray(response.warnings)?response.warnings:[response.warnings];
    const details=response?.warning_details==null?[]:Array.isArray(response.warning_details)?response.warning_details:[response.warning_details];
    return {messages,details,has:messages.length>0||details.length>0,critical:details.some(d=>/truncated|too_many_fields|non_finite|key_renamed/.test(d?.kind||''))};
  }
  function describe(value){return typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'—')}
  function responseHTML(response,report,{already=false}={}){
    const w=warningData(response),id=response.record_id,people=response.participants;
    let html=`<div class="upload-receipt ${w.has?'has-warning':'is-saved'}"><strong>${already?'此会话已提交，未重复发送。':w.has?'服务器已保存，但返回了数据警告。':'服务器确认已保存。'}</strong><p>${id!==undefined?'记录编号：'+esc(id)+'。':''}${people!==undefined?'项目被试数：'+esc(people)+'。':''}上传${report.trials}条有效正式试次，${(report.bytes/1024).toFixed(1)} KiB，单试次最多${report.maxFields}字段。${report.test?'本次为test_测试实验，不计正式招募。':''}</p>`;
    html+='<p>各条件有效数：'+esc(Object.entries(report.counts).map(([c,n])=>c+' '+n).join(' / '))+'；排除无效原记录 '+report.excludedInvalid+' 条。完整眼动/车辆轨迹与无效原记录仍在本机JSON/CSV备份中；请在离开或刷新前下载。</p>';
    if(w.has){
      html+='<details open><summary>查看服务器 warnings / warning_details</summary>';
      if(w.messages.length)html+='<ul>'+w.messages.map(m=>'<li>'+esc(describe(m))+'</li>').join('')+'</ul>';
      if(w.details.length)html+='<div class="upload-warning-table"><table><tr><th>字段</th><th>调整类型</th><th>涉及试次</th><th>原长度</th></tr>'+w.details.map(d=>`<tr><td>${esc(d?.field??describe(d))}</td><td>${esc(d?.kind??'未标明')}</td><td>${esc(d?.n_trials??'—')}</td><td>${esc(describe(d?.original_length))}</td></tr>`).join('')+'</table></div>';
      html+='</details><p class="analysis-warning">'+(w.critical?'出现截断、字段丢失或数值/字段名修改，请先下载本机完整备份，核对课程CSV；不能认定本次已完整入库。':'请核对课程CSV中发生转换或调整的字段。')+'数据已保存，不要再次点击提交来消除警告。</p>';
    }
    return html+'</div>';
  }
  function createClient(){
    const states=new Map();
    return {async submit(session,options={}){
      const wire=build(session,options),previous=states.get(wire.key);
      if(previous?.state==='saved')return {...previous,already:true};
      if(previous?.state==='pending')return {state:'pending',already:true,report:wire.report};
      states.set(wire.key,{state:'pending'});const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),options.timeoutMs||30000);
      try{
        const response=await (options.fetchFn||root.fetch)(options.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:wire.body,signal:controller.signal});
        let data;try{data=await response.json()}catch(_){throw Object.assign(Error('服务器未返回可读取的JSON回执；是否已保存未知，请先到课程页核对记录再决定重试。'),{uncertain:true})}
        if(!response.ok||data?.ok!==true){const error=Error(data?.msg||'HTTP '+response.status+'：提交未获成功确认。');if(response.status>=500)error.uncertain=true;throw error}
        const result={state:'saved',response:data,report:wire.report,already:false};states.set(wire.key,result);return result;
      }catch(error){states.delete(wire.key);if(error.name==='AbortError'||error instanceof TypeError){error.uncertain=true;error.message='网络中断或等待回执超时；是否已保存未知，请先核对课程后台记录再重试。'}throw error}
      finally{clearTimeout(timeout)}
    }};
  }
  const api={SCHEMA,LIMITS,AOIS,QUALITY,build,validateRow,warningData,responseHTML,createClient};root.CourseUpload=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
