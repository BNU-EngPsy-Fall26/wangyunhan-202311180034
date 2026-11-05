/* Shared local analysis. No network, persistence, generated participant data, or fitting to gaze. */
(function(root){
  'use strict';
  const VERSION='analysis-2026-11-05-v1';
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const sd=a=>a.length>1?Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1)):null;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(x,n=1)=>finite(x)?x.toFixed(n):'—';
  const CONDITIONS={bike_video_seev:['road_only','road_plus_video'],change_blind:['task_relevant','background']};
  const LABELS={road_only:'道路单任务',road_plus_video:'道路＋短视频',task_relevant:'安全相关变化',background:'背景变化',road:'道路区域',left_mirror:'左后视镜',right_mirror:'右后视镜',phone:'手机区域'};
  const METRICS={bike_video_seev:[['hit','危险命中率','百分点'],['rt','正确危险RT','ms'],['miss','漏报率','百分点'],['falseAlarm','误报率','百分点'],['reject','正确拒绝率','百分点'],['collision','碰撞试次比例','百分点'],['outside','每试次越界','ms']],change_blind:[['accuracy','定位正确率','百分点'],['rt','正确定位RT','ms'],['timeout','超时率','百分点'],['error','错误定位率','百分点']]};
  const versionFor=exp=>exp==='bike_video_seev'?'cycling-v3.3-gaze1':'change-safety-v5.1-gaze1';
  function summarize(rows,exp){
    return Object.fromEntries(CONDITIONS[exp].map(cond=>{
      const all=rows.filter(r=>!r.practice&&r.cond===cond),a=all.filter(r=>r.valid!==0),n=a.length;
      const rate=(xs,key)=>xs.length?100*xs.filter(r=>r[key]===1||r[key]===true).length/xs.length:null;
      const eyeRows=a.filter(r=>r.eyeTracking?.summary?.usable===1);
      let covered=0,modeled=0;const dwell={road:0,left_mirror:0,right_mirror:0,phone:0};
      for(const r of eyeRows){const e=r.eyeTracking.summary;covered+=e.coveredMs||0;
        for(const [k,v] of Object.entries(e.dwellMs||{})){const key=k==='phone_idle'?'phone':k;if(key in dwell&&finite(v)&&v>=0){dwell[key]+=v;modeled+=v}}
      }
      const base={n,total:all.length,invalid:all.length-n,eyeN:eyeRows.length,coveredMs:covered,modeledMs:modeled,
        coverage:mean(a.filter(r=>r.eyeTracking?.requested).map(r=>r.eyeTracking.summary.coverage).filter(finite)),
        aoi:modeled?Object.fromEntries(Object.entries(dwell).map(([k,v])=>[k,v/modeled])):null,
        mirrorsPercent:covered?100*(dwell.left_mirror+dwell.right_mirror)/covered:null,
        targetFirstEntryMs:mean(eyeRows.map(r=>r.eyeTracking.summary.firstEntryMs?.[r.target]).filter(finite)),
        targetFirstEntryN:eyeRows.map(r=>r.eyeTracking.summary.firstEntryMs?.[r.target]).filter(finite).length,
        targetDwellPercent:mean(eyeRows.filter(r=>r.target&&r.eyeTracking.summary.coveredMs>0).map(r=>100*(r.eyeTracking.summary.dwellMs?.[r.target]||0)/r.eyeTracking.summary.coveredMs))};
      if(exp==='bike_video_seev'){
        const h=a.filter(r=>r.event==='hazard'),c=a.filter(r=>r.event==='clear');
        const rts=h.filter(r=>r.hit===1&&finite(r.roadRt)&&r.roadRt>=150).map(r=>r.roadRt);
        return [cond,{...base,hazardN:h.length,clearN:c.length,hit:rate(h,'hit'),reject:rate(c,'correctReject'),miss:rate(h,'miss'),falseAlarm:rate(c,'falseAlarm'),
          rt:mean(rts),rtN:rts.length,collision:n?100*a.filter(r=>r.collisions>0).length/n:null,
          outside:mean(a.map(r=>r.outsideMs).filter(finite)),video:cond==='road_plus_video'?rate(a,'videoCorrect'):null}];
      }
      const correct=a.filter(r=>r.reportCorrect===1||r.reportCorrect===true),rts=correct.map(r=>r.rt).filter(x=>finite(x)&&x>=150);
      return [cond,{...base,accuracy:n?100*correct.length/n:null,rt:mean(rts),rtN:rts.length,timeout:rate(a,'timeout'),error:n?100*a.filter(r=>r.found&&!r.reportCorrect).length/n:null}];
    }));
  }
  // Ordinal project-specific SEEV operationalization. Frozen weights=1, no empirical fitting.
  const MODEL={version:'seev-ordinal-v1',formula:'wᵢ=max(0,Sᵢ−EFᵢ+EXᵢ+Vᵢ); Pᵢ=wᵢ/Σw',
    parameters:{road_only:{road:[2,0,3,3],left_mirror:[1,1,2,3],right_mirror:[1,1,1,3],phone:[0,2,0,0]},
      road_plus_video:{road:[2,0,3,3],left_mirror:[1,1,2,3],right_mirror:[1,1,1,3],phone:[3,2,2,1]}}};
  function predict(cond){const raw=Object.fromEntries(Object.entries(MODEL.parameters[cond]).map(([k,[s,e,x,v]])=>[k,Math.max(0,s-e+x+v)]));const sum=Object.values(raw).reduce((a,b)=>a+b,0);return Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v/sum]))}
  function stats(d){
    const n=d.length,m=mean(d),s=sd(d);if(!n)return {n:0,mean:null,sd:null,dz:null,ci:null,p:null};
    let ci=null,p=null,method=null;
    if(n>=2){let seed=47203;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      const boot=Array.from({length:4000},()=>mean(Array.from({length:n},()=>d[Math.floor(random()*n)]))).sort((a,b)=>a-b);ci=[boot[99],boot[3899]];
      if(n>=5){const target=Math.abs(d.reduce((a,b)=>a+b,0)),total=n<=18?2**n:20000;let extreme=0;
        for(let k=0;k<total;k++){let sum=0;for(let i=0;i<n;i++)sum+=d[i]*(n<=18?((k>>i)&1?1:-1):(random()<.5?1:-1));if(Math.abs(sum)>=target-1e-9)extreme++}
        p=n<=18?extreme/total:(extreme+1)/(total+1);method=n<=18?'exact-sign-flip':'monte-carlo-sign-flip';
      }
    }return {n,mean:m,sd:s,dz:s>0?m/s:null,ci,p,method};
  }
  function paired(sessions,exp,metric){
    const [a,b]=CONDITIONS[exp],pairs=[];
    for(const s of sessions){const z=summarize(s.trials,exp);if(z[a].n>=10&&z[b].n>=10&&finite(z[a][metric])&&finite(z[b][metric]))pairs.push({participant:s.participant,a:z[a][metric],b:z[b][metric],difference:z[b][metric]-z[a][metric]})}
    return {pairs,...stats(pairs.map(p=>p.difference))};
  }
  function validateSession(s){
    if(!s||!CONDITIONS[s.experiment]||!Array.isArray(s.trials)||!s.trials.length||!s.meta?.version||![3,4].includes(s.schemaVersion))throw Error('不是本项目的正式会话导出（需schemaVersion、experiment、participant、meta.version及trials）。课程文献/QA清单不能导入。');
    if(typeof s.participant!=='string'||!s.participant.trim()||/^(QA|TEST|SYNTHETIC|DEMO|guest-)/i.test(s.participant))throw Error('匿名编号缺失或为测试/访客编号；测试数据不进入正式分析。');
    const allowed=s.experiment==='bike_video_seev'?['cycling-v3.3','cycling-v3.3-gaze1']:['change-safety-v5.1','change-safety-v5.1-gaze1'];
    if(!allowed.includes(s.meta.version))throw Error('不支持此版本；请先核对版本和分析口径，不自动混合历史设计。');
    if(s.trials.length>1000)throw Error('单会话试次数异常。');
    for(const r of s.trials){
      if(r.practice||!CONDITIONS[s.experiment].includes(r.cond)||!Number.isInteger(r.trial)||r.trial<1||![0,1,undefined].includes(r.valid))throw Error('试次包含练习、未知条件、编号或有效性标记异常。');
      if(s.experiment==='bike_video_seev'){
        if(!['hazard','clear'].includes(r.event))throw Error('骑行事件类型缺失。');
        if(r.valid!==0&&!['hit','correctReject','miss','falseAlarm','roadCorrect','videoCorrect'].every(k=>r[k]===null||[0,1,true,false,undefined].includes(r[k])))throw Error('骑行计分值异常。');
        if(r.valid!==0&&!['hit','correctReject','miss','falseAlarm'].every(k=>[0,1].includes(r[k])))throw Error('骑行主计分字段缺失。');
      }else if(r.valid!==0&&(![0,1].includes(r.reportCorrect)||![0,1].includes(r.timeout)||![0,1].includes(r.found)))throw Error('变化盲计分字段缺失。');
      if(r.rt!==undefined&&r.rt!==null&&(!finite(r.rt)||r.rt<0))throw Error('RT须为非负数或null。');
      if(r.eyeTracking?.summary){const e=r.eyeTracking.summary;if(!finite(e.coverage)||e.coverage<0||e.coverage>1.01||!finite(e.coveredMs)||e.coveredMs<0)throw Error('眼动覆盖数据异常。');
        for(const v of Object.values(e.dwellMs||{}))if(!finite(v)||v<0)throw Error('AOI停留值异常。');
      }
    }
    // Valid attempts must identify unique condition/trial IDs; retries preserve the same ID but invalid originals are separate.
    const ids=s.trials.filter(r=>r.valid!==0).map(r=>r.cond+':'+r.trial);if(new Set(ids).size!==ids.length)throw Error('同一条件/试次含多个有效记录，需先选择一个有效尝试。');
    return s;
  }
  function mergeSessions(current,incoming){
    const result=[...current];let duplicates=0;
    for(const s of incoming){validateSession(s);const match=result.find(x=>x.participant===s.participant&&x.experiment===s.experiment&&x.meta.version===s.meta.version);
      if(match){if(JSON.stringify(match.trials)===JSON.stringify(s.trials)){duplicates++;continue}throw Error('同一匿名编号 '+s.participant+' 有重复会话；请只选择一份完整会话，不能拼接/重复计人数。')}
      result.push(s);
    }return {sessions:result,duplicates};
  }
  function parseCSV(text){
    text=text.replace(/^\uFEFF/,'');
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else if(quoted||field==='')quoted=!quoted;else throw Error('CSV引号位置异常。')}
      else if(c===','&&!quoted){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field=''}else field+=c;
    }if(quoted)throw Error('CSV引号未闭合。');if(field||row.length){row.push(field);rows.push(row)}
    const headers=rows.shift()?.map(s=>s.replace(/^\uFEFF/,''));if(!headers||!headers.includes('trial_json'))throw Error('请导入本项目导出的CSV（包含trial_json）；其他平台格式不能自动猜测映射。');
    const grouped=new Map();for(const r of rows){if(r.length!==headers.length)throw Error('CSV列数不一致。');const x=Object.fromEntries(headers.map((k,i)=>[k,r[i]]));const key=[x.participant,x.experiment,x.version,x.session_id].join('|');
      const meta=x.meta_json?JSON.parse(x.meta_json):{version:x.version,sessionId:x.session_id};
      if(meta.version!==x.version)throw Error('CSV版本列与meta_json不一致。');
      if(!grouped.has(key))grouped.set(key,{schemaVersion:Number(x.schema_version),participant:x.participant,experiment:x.experiment,meta,trials:[]});
      if(JSON.stringify(grouped.get(key).meta)!==JSON.stringify(meta))throw Error('同会话CSV的元信息不一致。');grouped.get(key).trials.push(JSON.parse(x.trial_json));
    }return [...grouped.values()];
  }
  function parse(text,name){let sessions;if(name.toLowerCase().endsWith('.csv'))sessions=parseCSV(text);else{const data=JSON.parse(text);sessions=Array.isArray(data)?data:data.sessions||[data]}if(!Array.isArray(sessions))throw Error('sessions必须为数组。');return sessions.map(validateSession)}
  function csv(session){const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
    const headers=['schema_version','participant','experiment','version','session_id','cond','trial','valid','rt','correct','meta_json','trial_json'];
    return '\uFEFF'+[headers,...session.trials.map(r=>[session.schemaVersion,session.participant,session.experiment,session.meta.version,session.meta.sessionId||'',r.cond,r.trial,r.valid??1,r.rt,r.correct,JSON.stringify(session.meta),JSON.stringify(r)])].map(r=>r.map(quote).join(',')).join('\r\n');
  }
  function chart(title,points,unit='%',max=100){
    const h=points.length*46+46;let body='';
    points.forEach((p,i)=>{const y=30+i*46,value=finite(p.value)?p.value:null,w=value===null?0:Math.max(0,Math.min(1,value/max))*330;
      body+=`<text x="5" y="${y+17}">${esc(p.label)}</text><rect x="190" y="${y}" width="330" height="25" fill="#edf1f5"/>${value===null?'':`<rect x="190" y="${y}" width="${w}" height="25" fill="${p.prediction?'#c49738':'#2463a6'}"/>`}<text x="535" y="${y+17}">${fmt(value)}${value===null?'':esc(unit)}</text>`;
    });return `<figure class="analysis-chart"><figcaption>${esc(title)}</figcaption><svg viewBox="0 0 680 ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${body}<text x="190" y="${h-5}">0</text><text x="490" y="${h-5}">${fmt(max,0)}${esc(unit)}</text></svg></figure>`;
  }
  function trialChart(rows,exp){
    const a=rows.filter(r=>!r.practice),finiteRows=a.filter(r=>r.valid!==0&&finite(r.rt)),max=exp==='change_blind'?20000:Math.max(2500,...finiteRows.map(r=>r.rt));
    if(!finiteRows.length)return '<p>没有可绘制的有效RT；超时与无反应保留为缺失，不绘制为0或时限。</p>';
    const dots=finiteRows.map(r=>{const i=a.indexOf(r),x=55+i/Math.max(1,a.length-1)*550,y=180-r.rt/max*140;return `<circle cx="${x}" cy="${y}" r="5" fill="${r.correct?'#2463a6':'#bd5c24'}"><title>第${i+1}次 ${esc(LABELS[r.cond])}，${r.rt}ms，${r.correct?'正确':'错误'}；本图为实际响应RT</title></circle>`}).join('');
    return `<figure class="analysis-chart"><figcaption>本次逐试次实际响应时间：蓝＝正确，橙＝错误；无效/无RT不绘点</figcaption><svg viewBox="0 0 680 225" role="img" aria-label="逐试次响应时间散点图"><path d="M55 35V180H610" fill="none" stroke="#8090a5"/><text x="3" y="45">${Math.round(max/1000)}s</text><text x="25" y="182">0</text><text x="55" y="210">试次1</text><text x="565" y="210">试次${a.length}</text>${dots}</svg></figure>`;
  }
  function modelHTML(summaries){
    let html='<section class="analysis-card"><h2>SEEV：事先预测与本次估计视线</h2><p>项目序数模型 '+esc(MODEL.version)+'：'+esc(MODEL.formula)+'。系数均为1；参数来自任务设计，未用你的眼动拟合。金色为预测，蓝色为实测。</p>';
    for(const cond of CONDITIONS.bike_video_seev){const p=predict(cond),s=summaries[cond],points=[];
      for(const k of Object.keys(p)){points.push({label:LABELS[k]+'·预测',value:p[k]*100,prediction:true});points.push({label:LABELS[k]+'·实测',value:s?.aoi?s.aoi[k]*100:null})}
      html+=chart(LABELS[cond],points);
      html+=`<p>可用眼动试次 ${s?.eyeN??0}；实测分母仅为四AOI内的有效停留。四AOI覆盖占有效时间 ${s?.coveredMs?fmt(s.modeledMs/s.coveredMs*100)+'%':'—'}。${s?.aoi?'预测对实测平均绝对误差 '+fmt(mean(Object.keys(p).map(k=>Math.abs(p[k]-s.aoi[k])))*100)+' 百分点。':'没有合格眼动数据，实测栏留空。'}</p>`;
    }
    html+='<details><summary>查看冻结参数 S / EF / EX / V 与解释</summary><table><tr><th>条件</th><th>AOI</th><th>S</th><th>EF</th><th>EX</th><th>V</th></tr>';
    for(const [c,aois] of Object.entries(MODEL.parameters))for(const [k,values] of Object.entries(aois))html+=`<tr><td>${LABELS[c]}</td><td>${LABELS[k]}</td>${values.map(v=>'<td>'+v+'</td>').join('')}</tr>`;
    return html+'</table><p>道路持续控制的期望/价值高；左/右镜事件分配不同；短视频提高手机显著性与采样期望。EF为序数查看代价。它是SEEV启发的课程操作化，不是Horrey原论文公式的精确参数复刻，也不直接预测命中率或RT。四个AOI不是四名被试；不把跨AOI拟合当显著性检验。</p></details></section>';
  }
  function paperHTML(exp,z){
    if(exp==='bike_video_seev'){
      return `<section class="analysis-card"><h2>与经典驾驶研究对照</h2><p><a href="https://doi.org/10.1177/154193120304701614" target="_blank" rel="noreferrer">Zheng、McConkie与Tai（2003）</a>比较正常驾驶与言语/空间次任务。本项目改为骑行与视觉短视频，保留连续控制、镜面监控及双任务对照结构，属于应用改编。</p><table><tr><th>左右侧镜合计</th><th>正常</th><th>言语次任务</th><th>空间次任务</th></tr><tr><td>课程站转录的原论文组均值</td><td>2.27%</td><td>0.90%</td><td>1.08%</td></tr><tr><td>本次骑行（有效覆盖时间分母）</td><td>${fmt(z.road_only?.mirrorsPercent)}%</td><td colspan="2">短视频 ${fmt(z.road_plus_video?.mirrorsPercent)}%</td></tr></table><p>原值为左、右镜相加，不含车内后视镜；来源：<a href="https://attention-lab-production.up.railway.app/data/zheng2003.json" target="_blank" rel="noreferrer">课程文献转录表</a>，未经本文独立重算原始记录。原研究条件、AOI、眼动精度、分母均不同，仅比较方向，不作等效或因果强度比较；无眼动时留空。原研究不是短视频条件，也没有与本任务可直接对应的危险RT效应值。</p></section>`;
    }
    return `<section class="analysis-card"><h2>与变化盲原论文对照</h2><table><tr><th>Rensink等（1997）实验1</th><th>原文均值</th><th>本次概念对应条件</th><th>本次正确RT</th></tr><tr><td>中心兴趣CI</td><td>4.7秒</td><td>安全相关（概念近似）</td><td>${fmt(z.task_relevant?.rt===null?null:z.task_relevant?.rt/1000,2)}秒</td></tr><tr><td>边缘兴趣MI</td><td>10.9秒</td><td>背景（概念近似）</td><td>${fmt(z.background?.rt===null?null:z.background?.rt/1000,2)}秒</td></tr></table><p>原文图3a/实验1报告CI与MI识别时间，原图240ms、空白80ms，原序列重复图像后切换。本项目为原创SVG、400/400ms、首次位置点击和20秒限时，安全/背景也不等同CI/MI。仅作机制与方向对照；不可把RT数值差称为复现同等效应。类别、位置和变化显著性混淆仍在。</p><a href="https://www.cs.ubc.ca/~rensink/publications/download/PsychSci97-RR.pdf" target="_blank" rel="noreferrer">原论文（作者公开版，368–373页）</a></section>`;
  }
  function personal(rows,exp){
    const z=summarize(rows,exp),[a,b]=CONDITIONS[exp],metrics=METRICS[exp];
    let html='<section class="analysis-card"><h2>你的本次结果</h2><p>这是个人描述性结果，不是群体显著性结论。每条件目标10次有效正式试次；正确RT不足时显示缺失。</p>';
    html+=chart(exp==='bike_video_seev'?'危险命中率':'定位正确率',[{label:LABELS[a],value:z[a][metrics[0][0]]},{label:LABELS[b],value:z[b][metrics[0][0]]}]);
    html+=chart('正确反应时间（ms）',[{label:LABELS[a],value:z[a].rt},{label:LABELS[b],value:z[b].rt}],' ms',Math.max(1000,...[z[a].rt,z[b].rt].filter(finite))*1.2);
    html+='<table><tr><th>指标</th><th>'+LABELS[a]+'</th><th>'+LABELS[b]+'</th><th>后者−前者</th></tr>';
    for(const [k,label,unit] of metrics)html+=`<tr><td>${label}</td><td>${fmt(z[a][k])}</td><td>${fmt(z[b][k])}</td><td>${fmt(finite(z[a][k])&&finite(z[b][k])?z[b][k]-z[a][k]:null)} ${unit}</td></tr>`;
    if(exp==='bike_video_seev')html+=`<tr><td>视频分类正确率</td><td>不适用</td><td>${fmt(z[b].video)}%</td><td>单任务无视频，不计算差值</td></tr>`;
    html+=`<tr><td>有效/正式记录</td><td>${z[a].n}/${z[a].total}</td><td>${z[b].n}/${z[b].total}</td><td>正确RT样本：${z[a].rtN}/${z[b].rtN}</td></tr></table>`;
    if(z[a].n<10||z[b].n<10)html+='<p class="analysis-warning">本次有效数不足每条件10次，不能作为满足课程试次数的完整配对；不自动补造记录。</p>';
    html+=trialChart(rows,exp)+'</section>';
    if(exp==='bike_video_seev')html+=modelHTML(z);
    else html+='<section class="analysis-card"><h2>眼动质量与目标区域</h2>'+chart('目标AOI停留占有效覆盖时间',[{label:LABELS[a],value:z[a].targetDwellPercent},{label:LABELS[b],value:z[b].targetDwellPercent}])+'<table><tr><th>条件</th><th>可用眼动试次</th><th>平均覆盖率</th><th>首次估计进入目标（ms）</th></tr>'+CONDITIONS[exp].map(c=>`<tr><td>${LABELS[c]}</td><td>${z[c].eyeN}</td><td>${fmt(z[c].coverage===null?null:z[c].coverage*100)}%</td><td>${fmt(z[c].targetFirstEntryMs)}（n=${z[c].targetFirstEntryN}）</td></tr>`).join('')+'</table><p>首次估计进入不是首次注视；没有进入的试次不填0，均值仅在有该指标的合格试次计算。未启用或质量不足时显示缺失。</p></section>';
    return html+paperHTML(exp,z)+'<p><a href="results.html" target="_blank" rel="noreferrer">打开群体数据分析页</a> · <a href="研究设计与文献对照.md" target="_blank">研究设计、预测和文献</a>。个人差值不能证明改进有效；实际检验需要多名他人配对数据。</p>';
  }
  function pairChart(pairs,label){
    if(!pairs.length)return '<p>尚无满足每条件≥10有效试次的完整配对。</p>';
    const values=pairs.flatMap(p=>[p.a,p.b]),lo=Math.min(0,...values),hi=Math.max(1,...values),y=v=>190-(v-lo)/(hi-lo||1)*150;
    let body='';pairs.forEach((p,i)=>{const shift=(i%9-4)*3;body+=`<path d="M${180+shift} ${y(p.a)}L${480+shift} ${y(p.b)}" stroke="#a5b7ca" fill="none"/><circle cx="${180+shift}" cy="${y(p.a)}" r="4" fill="#2463a6"><title>${esc(p.participant)}：${fmt(p.a)}</title></circle><circle cx="${480+shift}" cy="${y(p.b)}" r="4" fill="#c49738"><title>${esc(p.participant)}：${fmt(p.b)}</title></circle>`});
    return `<figure class="analysis-chart"><figcaption>${esc(label)}：每条线是一名参与者，条件顺序见表</figcaption><svg viewBox="0 0 680 235" role="img" aria-label="群体被试内配对图"><text x="10" y="40">${fmt(hi)}</text><text x="10" y="192">${fmt(lo)}</text><text x="145" y="220">前一条件</text><text x="445" y="220">后一条件</text>${body}</svg></figure>`;
  }
  function groupHTML(sessions,exp){
    const [a,b]=CONDITIONS[exp];let html=`<h2>${exp==='bike_video_seev'?'骑行：短视频新增条件检验':'变化盲：安全/背景探索比较'}</h2><p>导入会话 ${sessions.length}；差值方向：${LABELS[b]} − ${LABELS[a]}。只有每条件≥10有效试次且指标齐全者进入该指标配对分析；RT人数可能少于正确率人数。</p>`;
    html+='<table><tr><th>指标</th><th>配对人数</th><th>平均差</th><th>差值SD</th><th>自助95%区间</th><th>dz</th><th>双侧p</th></tr>';
    for(const [k,label,unit] of METRICS[exp]){const s=paired(sessions,exp,k);html+=`<tr><td>${label}（${unit}）</td><td>${s.n}</td><td>${fmt(s.mean)}</td><td>${fmt(s.sd)}</td><td>${s.ci?s.ci.map(x=>fmt(x)).join(' 至 '):'—'}</td><td>${fmt(s.dz,2)}</td><td>${fmt(s.p,4)}</td></tr>`}
    html+='</table><p>p为配对差值符号翻转检验（≤18人穷举，否则固定种子20,000次）；不足5人不计算p。区间为固定种子4,000次参与者配对自助法，小样本不稳定；差值SD=0时dz缺失。多指标为探索性，未校正多重比较；不以p值单独宣称改进成功。5对样本的双侧精确检验最小p为0.0625。</p>';
    const primary=paired(sessions,exp,METRICS[exp][0][0]);html+=pairChart(primary.pairs,METRICS[exp][0][1]);
    html+='<table><tr><th>匿名编号</th><th>'+LABELS[a]+'有效数</th><th>'+LABELS[b]+'有效数</th><th>纳入主指标</th></tr>'+sessions.map(s=>{const z=summarize(s.trials,exp);return `<tr><td>${esc(s.participant)}</td><td>${z[a].n}</td><td>${z[b].n}</td><td>${primary.pairs.some(p=>p.participant===s.participant)?'是':'否'}</td></tr>`}).join('')+'</table>';
    const average={};for(const c of CONDITIONS[exp]){const z=sessions.map(s=>summarize(s.trials,exp)[c]),eligible=z.filter(x=>x.n>=10);average[c]={rt:mean(eligible.map(x=>x.rt).filter(finite)),mirrorsPercent:mean(eligible.map(x=>x.mirrorsPercent).filter(finite))};
      const qualified=sessions.filter(s=>JSON.stringify(s.meta.predictionModel)===JSON.stringify(MODEL)).map(s=>summarize(s.trials,exp)[c]).filter(x=>x.n>=10&&x.aoi);if(qualified.length)average[c]={...average[c],aoi:Object.fromEntries(Object.keys(predict('road_only')).map(k=>[k,mean(qualified.map(x=>x.aoi[k]))])),eyeParticipants:qualified.length,eyeN:qualified.reduce((n,x)=>n+x.eyeN,0),coveredMs:qualified.reduce((n,x)=>n+x.coveredMs,0),modeledMs:qualified.reduce((n,x)=>n+x.modeledMs,0)};
    }
    html+=paperHTML(exp,average);if(exp==='bike_video_seev')html+='<p>SEEV实测仅纳入导出中携带相同模型参数快照的会话；缺少快照的旧版数据不充当事先预测检验。条件眼动人数：'+(average.road_only.eyeParticipants||0)+' / '+(average.road_plus_video.eyeParticipants||0)+'。实测为参与者比例等权平均，覆盖说明为合并时长。</p>'+modelHTML(average);
    return html;
  }
  function freeze(o){Object.freeze(o);for(const v of Object.values(o))if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v)}freeze(MODEL);
  const api={VERSION,MODEL,CONDITIONS,LABELS,METRICS,mean,sd,fmt,esc,versionFor,summarize,predict,stats,paired,validateSession,mergeSessions,parse,csv,personal,groupHTML,modelHTML,paperHTML};
  root.LabAnalysis=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
