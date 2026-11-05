/* Presentation only: uses the existing scoring/statistics and never creates observations. */
(function(root){
  'use strict';
  const A=root.LabAnalysis;if(!A)return;
  const {esc:E,fmt:F,CONDITIONS:C,LABELS:L}=A;
  const ok=x=>typeof x==='number'&&Number.isFinite(x),mean=A.mean;
  const colors=['#2766ab','#bc8530'],states={correct:'#2766ab',error:'#bc5f37',timeout:'#7c8da0',invalid:'#b6bec9'};
  const names={...L,tree:'树冠',building:'遮阳篷',flowers:'花簇',sign:'路牌',person:'行人',bicycle:'自行车',car:'车辆',bench:'座椅',scene_other:'图内其他',outside:'窗口其他',phone_idle:'手机待机'};
  const gazeReasons={not_enabled:'未启用或已手动关闭',calibration_required:'未通过验证或需重新校准',calibration_failed:'五点独立验证未通过',startup_failed:'摄像头/模型启动失败',calibration_interrupted:'校准被窗口或前台变化打断',participant_changed:'匿名编号改变',camera_stopped:'摄像头被关闭',camera_disconnected:'摄像头断开',resume_failed:'前台恢复采样失败',viewport_changed:'窗口尺寸改变',viewport_scrolled:'试次内页面滚动',focus_lost:'试次内失焦',page_hidden:'试次进入后台',no_predictions:'没有收到预测',no_valid_predictions:'预测均无效或超出窗口',sample_count_below_10:'有效预测不足10条',coverage_below_50pct:'有效时间覆盖不足50%'};
  function reasonsFor(row){
    const e=row.eyeTracking,reasons=[...(row.invalidReasons||[]),...(e?.invalidReasons||[])];
    if(row.invalidReason)reasons.push(row.invalidReason);
    if(!e)reasons.push('not_enabled');
    else if(!e.summary?.usable){
      if(!e.requested)reasons.push('not_enabled');
      else{if(!e.calibrated)reasons.push('calibration_required');if(!e.summary?.sampleCount)reasons.push('no_predictions');if((e.summary?.validCount||0)<10)reasons.push('sample_count_below_10');if((e.summary?.coverage||0)<.5)reasons.push('coverage_below_50pct')}
    }return [...new Set(reasons)];
  }
  function diagnosisHTML(rows){
    return '<details class="viz-methods" open><summary>为什么眼动试次没有纳入？</summary><p>九点点击之后还需五点独立验证通过。以下逐次列出采样、质量与异常原因；原因可重叠，质量门槛未降低。</p><div class="viz-table-scroll"><table><tr><th>记录</th><th>启用/校准</th><th>记录/有效预测</th><th>覆盖率</th><th>最大采样间隔</th><th>眼动纳入</th><th>原因</th></tr>'+rows.map((r,i)=>{const e=r.eyeTracking,s=e?.summary,why=reasonsFor(r);return `<tr><td>${i+1}</td><td>${e?.requested?'是':'否'} / ${e?.calibrated?'是':'否'}</td><td>${s?.sampleCount??0} / ${s?.validCount??0}</td><td>${ok(s?.coverage)?F(s.coverage*100)+'%':'—'}</td><td>${ok(s?.maxPredictionGapMs)?F(s.maxPredictionGapMs,0)+'ms':'—'}</td><td>${r.valid!==0&&s?.usable?'是':'否'}</td><td>${E(why.length?why.map(k=>gazeReasons[k]||k).join('；'):'无已记录异常')}</td></tr>`}).join('')+'</table></div><p>覆盖只累计相邻≤200ms的有效样本，覆盖率须≥50%，有效预测须≥10；有预测但间隔过长也可能不纳入。修改后的程序会在页面持续显示眼动状态，JSON含诊断快照。</p></details>';
  }
  let counter=0;const records=new Map();
  function svg(title,body,height=280,width=760){return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${E(title)}"><title>${E(title)}</title>${body}</svg>`}
  function figure(title,subtitle,body){return `<figure class="viz-figure"><figcaption><strong>${E(title)}</strong><span>${E(subtitle)}</span></figcaption>${body}</figure>`}
  function empty(title,text){return `<div class="viz-empty"><span class="viz-empty-mark" aria-hidden="true">○</span><strong>${E(title)}</strong><p>${E(text)}</p></div>`}
  function card(label,value,unit,note){return `<div class="viz-stat"><span>${E(label)}</span><strong>${E(value)}<small>${E(unit)}</small></strong><p>${E(note)}</p></div>`}
  function diff(x,unit){return ok(x)?`${x>0?'+':''}${F(x)} ${unit}`:'数据不足'}
  function quantile(values,p){if(!values.length)return null;const a=[...values].sort((a,b)=>a-b),i=(a.length-1)*p;return a[Math.floor(i)]+(a[Math.ceil(i)]-a[Math.floor(i)])*(i%1)}
  function rtOf(r,exp){const x=exp==='bike_video_seev'?r.roadRt:r.rt;return r.valid!==0&&r.correct&&ok(x)&&x>=150?x:null}
  function outcome(r){return r.valid===0?'invalid':r.timeout?'timeout':r.correct?'correct':'error'}
  function tabs(id,items){return `<nav class="viz-tabs" role="tablist" aria-label="结果视图">${items.map(([key,label],i)=>`<button type="button" role="tab" id="${id}-tab-${key}" aria-selected="${i===0}" aria-controls="${id}-${key}" data-result-tab="${key}">${label}</button>`).join('')}</nav>`}
  function panel(id,key,html,first=false){return `<section id="${id}-${key}" role="tabpanel" aria-labelledby="${id}-tab-${key}" data-result-panel="${key}" ${first?'':'hidden'}>${html}</section>`}
  function compare(z,exp,key,title,unit,max=100){
    const conds=C[exp],values=conds.map(c=>z[c][key]);if(!values.some(ok))return figure(title,'无合格数据',empty('暂无可计算结果','无反应与超时保留为缺失，不填为0。'));
    max=unit==='%'?100:Math.ceil(Math.max(max,...values.filter(ok))*1.05/100)*100;const x0=178,w=440,body=[];
    for(let i=0;i<=4;i++){const x=x0+i/4*w;body.push(`<path d="M${x} 28V148" class="viz-gridline"/><text x="${x}" y="174" text-anchor="middle">${F(max*i/4,max>200?0:1)}</text>`)}
    conds.forEach((c,i)=>{const v=z[c][key],y=47+i*58;body.push(`<text x="8" y="${y+17}">${E(L[c])}</text><rect x="${x0}" y="${y}" width="${w}" height="24" rx="4" fill="#edf2f7"/>${ok(v)?`<rect x="${x0}" y="${y}" width="${v/max*w}" height="24" rx="4" fill="${colors[i]}"/>`:''}<text x="638" y="${y+17}" class="viz-value">${F(v)}${ok(v)?E(unit):''}</text>`)});
    const delta=ok(values[0])&&ok(values[1])?values[1]-values[0]:null;
    return figure(title,`${L[conds[1]]} − ${L[conds[0]]}：${diff(delta,unit==='%'?'百分点':unit)}`,svg(title,body.join(''),195));
  }
  function distribution(rows,exp){
    const sets=C[exp].map(c=>rows.filter(r=>!r.practice&&r.cond===c).map(r=>rtOf(r,exp)).filter(ok)),max=Math.max(1000,...sets.flat())*1.08;
    if(!sets.flat().length)return empty('暂无正确反应时间分布','至少一次有效、正确且≥150ms的响应，才会显示分布。');
    const x=v=>170+v/max*460;let b='';for(let i=0;i<=4;i++)b+=`<path d="M${x(max*i/4)} 25V190" class="viz-gridline"/><text x="${x(max*i/4)}" y="213" text-anchor="middle">${F(max*i/4,0)}</text>`;
    sets.forEach((v,j)=>{const y=65+j*85;b+=`<text x="8" y="${y-8}">${E(L[C[exp][j]])}</text><text x="8" y="${y+14}" class="viz-muted">n=${v.length}</text>`;if(!v.length)return;
      const q1=quantile(v,.25),q2=quantile(v,.5),q3=quantile(v,.75);b+=`<path d="M${x(Math.min(...v))} ${y}H${x(Math.max(...v))}" stroke="${colors[j]}"/><rect x="${x(q1)}" y="${y-15}" width="${Math.max(1,x(q3)-x(q1))}" height="30" fill="${colors[j]}" opacity=".18"/><path d="M${x(q2)} ${y-19}V${y+19}" stroke="${colors[j]}" stroke-width="3"/>`;
      v.forEach((t,i)=>{b+=`<circle cx="${x(t)}" cy="${y+(i%5-2)*5}" r="4" fill="${colors[j]}" opacity=".7" tabindex="0"><title>${E(L[C[exp][j]])}：${F(t,0)}ms</title></circle>`});
      b+=`<text x="650" y="${y+5}">${F(q2,0)} ms</text>`;
    });return figure('正确反应时间分布','点＝实际试次；盒＝25%–75%分位；竖线＝中位数；须线＝最小至最大；横轴ms',svg('正确RT箱线与试次散点',b,235));
  }
  function outcomeBars(rows,exp){
    let b='';const labels={correct:'正确',error:'错误',timeout:'超时',invalid:'无效'};
    C[exp].forEach((c,i)=>{const a=rows.filter(r=>!r.practice&&r.cond===c),counts=Object.fromEntries(Object.keys(states).map(k=>[k,a.filter(r=>outcome(r)===k).length]));let x=170;const y=35+i*65;
      b+=`<text x="8" y="${y+18}">${E(L[c])}</text>`;if(!a.length){b+=`<text x="170" y="${y+18}">暂无记录</text>`;return}
      for(const [k,n] of Object.entries(counts)){if(!n)continue;const w=n/a.length*460;b+=`<rect x="${x}" y="${y}" width="${w}" height="30" fill="${states[k]}"><title>${E(L[c])} ${labels[k]} ${n}/${a.length}</title></rect>${w>30?`<text x="${x+w/2}" y="${y+20}" text-anchor="middle" fill="white" class="viz-on-color">${n}</text>`:''}`;x+=w}
      b+=`<text x="648" y="${y+20}">${a.length}条</text>`;
    });return figure('每个条件如何完成','分母为正式记录数，包含无效原记录；骑行“正确”合并命中与正确拒绝',svg('正确错误超时无效构成',b,165))+`<div class="viz-legend">${Object.entries(states).map(([k,c])=>`<span><i style="background:${c}"></i>${labels[k]}</span>`).join('')}</div>`;
  }
  function timeline(rows,exp){
    const max=Math.max(exp==='change_blind'?20000:2500,...rows.filter(r=>r.valid!==0).map(r=>r.rt).filter(ok)),x=i=>58+i/Math.max(1,rows.length-1)*625,y=v=>225-v/max*175;let b='';
    for(let i=0;i<=4;i++){const yy=y(max*i/4);b+=`<path d="M58 ${yy}H683" class="viz-gridline"/><text x="46" y="${yy+5}" text-anchor="end">${F(max*i/4/1000,1)}</text>`}
    b+='<text x="8" y="22">秒</text><text x="5" y="278">无RT/无效</text>';
    rows.forEach((r,i)=>{const status=outcome(r),xx=x(i),finiteRT=r.valid!==0&&ok(r.rt),yy=finiteRT?y(r.rt):274;
      const tip=`第${i+1}次 · ${L[r.cond]} · ${status==='correct'?'正确':status==='error'?'错误':status==='timeout'?'超时':'无效'} · ${finiteRT?r.rt+'ms':'无有效RT'}`;
      b+=`<g tabindex="0"><title>${E(tip)}</title>${status==='error'?`<path d="M${xx-4} ${yy-4}l8 8m-8 0l8-8" stroke="${states.error}" stroke-width="2"/>`:`<circle cx="${xx}" cy="${yy}" r="5" fill="${finiteRT?colors[C[exp].indexOf(r.cond)]:states[status]}"/>`}</g>`;
      if(i===0||i===rows.length-1||(i+1)%5===0)b+=`<text x="${xx}" y="310" text-anchor="middle">${i+1}</text>`;
    });b+='<text x="682" y="334" text-anchor="end">正式记录顺序（含无效尝试）</text>';
    return figure('逐试次反应时间','有RT点蓝/金＝两个条件，×＝错误；无RT/无效在独立行按结果着色，不落在0秒轴上',svg('逐试次响应时间与缺失记录',b,350));
  }
  function trialDetail(row,i,exp){
    const state=outcome(row),labels={correct:'正确',error:'错误',timeout:'超时',invalid:'无效'};
    const fields=[['条件',L[row.cond]],['结果',labels[state]],['实际响应RT',row.valid===0?'不纳入统计':ok(row.rt)?F(row.rt,0)+' ms':'无响应时间'],['事件/目标',exp==='bike_video_seev'?`${row.event==='hazard'?'危险':'无危险'} · ${{front:'前方',left:'左镜',right:'右镜'}[row.source]||'未记录来源'}`:names[row.target]||row.target],['眼动可用',row.eyeTracking?.summary?.usable===1?'是':'否'],['异常原因',reasonsFor(row).map(k=>gazeReasons[k]||k).join('；')||'无已记录异常']];
    return `<div class="viz-trial-heading"><b>记录 ${i+1}</b><span class="viz-state" style="--state-color:${states[state]}">${labels[state]}</span></div><dl class="viz-detail-grid">${fields.map(([k,v])=>`<div><dt>${E(k)}</dt><dd>${E(v)}</dd></div>`).join('')}</dl>`;
  }
  function trialExplorer(id,rows,exp){return `<div class="analysis-card">${timeline(rows,exp)}<h3>点击查看单次记录</h3><div class="viz-trial-grid">${rows.map((r,i)=>`<button type="button" data-inspect-trial="${i}" class="viz-trial ${outcome(r)}" aria-label="记录${i+1} ${E(L[r.cond])}" aria-pressed="${i===0}"><small>${C[exp].indexOf(r.cond)===0?'A':'B'}</small><b>${i+1}</b><span>${{correct:'✓',error:'×',timeout:'超时',invalid:'无效'}[outcome(r)]}</span></button>`).join('')}</div><div data-trial-detail aria-live="polite">${rows.length?trialDetail(rows[0],0,exp):empty('暂无试次','完成正式任务后显示。')}</div></div>`}
  function gazeMap(row){
    const e=row?.eyeTracking,v=e?.snapshot?.viewport,raw=e?.samples;
    if(!v?.width||!v?.height||!raw?.length)return empty('暂无视线轨迹','本次未启用眼动、未获得估计坐标，或数据文件不包含逐样本记录。');
    const w=760,h=w*v.height/v.width,sx=x=>x/v.width*w,sy=y=>y/v.height*h;let b=`<rect x="1" y="1" width="${w-2}" height="${h-2}" rx="8" fill="#f1f5f9"/>`;
    // Draw the background region first, then the smaller semantic AOIs.
    for(const a of [...(e.snapshot.aois||[])].reverse()){const r=a.rect;if(!r)continue;const target=a.name===row.target;
      b+=`<rect x="${sx(r.x)}" y="${sy(r.y)}" width="${sx(r.w)}" height="${sy(r.h)}" fill="${target?'#f6e7c9':'#dce6ef'}" stroke="${target?'#bc8530':'#a9bacb'}" stroke-width="${target?2:1}" opacity=".8"/><text x="${sx(r.x)+5}" y="${sy(r.y)+17}" class="viz-aoi-label">${E(names[a.name]||a.name)}${target?' · 目标':''}</text>`;
    }
    let path='';for(let i=0;i<raw.length;i++){const p=raw[i],prev=raw[i-1];if(!p.valid||!ok(p.x)||!ok(p.y))continue;
      if(prev?.valid&&p.t-prev.t<=200&&ok(prev.x)&&ok(prev.y))path+=`M${sx(prev.x)} ${sy(prev.y)}L${sx(p.x)} ${sy(p.y)}`;
    }b+=`<path d="${path}" stroke="#2766ab" stroke-width="1.5" opacity=".35" fill="none"/>`;
    const valid=raw.filter(p=>p.valid&&ok(p.x)&&ok(p.y)),step=Math.max(1,Math.ceil(valid.length/160));
    valid.forEach((p,i)=>{if(i%step)return;b+=`<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.4" fill="${p.aoi===row.target?'#bc5f37':'#2766ab'}" opacity=".65"><title>${p.t}ms · ${E(names[p.aoi]||p.aoi)} · (${F(p.x,0)}, ${F(p.y,0)})</title></circle>`});
    return figure('本次记录的估计视线轨迹','背景为窗口与AOI边界示意，并非刺激截图；线仅连接≤200ms相邻有效样本，点最多抽稀显示160个',svg('视线轨迹与兴趣区位置',b,h))+`<p class="viz-footnote">实际保留 ${raw.length} 条回调记录；${e.summary?.usable?'达到预设眼动质量门槛':'未达到眼动质量门槛，仅供排查，不进入主眼动汇总'}。坐标是webcam估计，不代表精确注视或眼跳。</p>`;
  }
  function quality(rows,exp,z){
    return `<div class="viz-grid two">${C[exp].map((c,i)=>{const a=rows.filter(r=>r.cond===c&&r.valid!==0),requested=a.filter(r=>r.eyeTracking?.requested).length,s=z[c],cov=s.coverage;return `<div class="viz-quality"><div><span class="viz-condition" style="--condition:${colors[i]}">${E(L[c])}</span><strong>${ok(cov)?F(cov*100,0)+'%':'未启用'}</strong><p>平均有效时间覆盖率</p></div><div class="viz-quality-track"><span style="width:${ok(cov)?Math.max(0,Math.min(100,cov*100)):0}%;background:${colors[i]}"></span></div><p>${s.eyeN}条可用眼动试次 / ${requested}条启用试次 / ${a.length}条有效行为试次</p></div>`}).join('')}</div>`;
  }
  function modelHTML(z){
    let html='<section class="analysis-card"><div class="viz-section-head"><div><span class="viz-kicker">SEEV · PREDICTION / OBSERVATION</span><h2>模型预测与视线分配，差在哪里？</h2></div><span class="viz-tag">固定参数 · 未拟合实测</span></div><p>金色空心菱形为设计预测，蓝色圆点为合格实测；连接线长度表示差距。没有合格眼动时只显示预测。</p><div class="viz-grid two">';
    for(const c of C.bike_video_seev){const p=A.predict(c),s=z[c],actual=s?.aoi;let b='';for(let i=0;i<=4;i++){const x=155+i*120;b+=`<path d="M${x} 20V230" class="viz-gridline"/><text x="${x}" y="251" text-anchor="middle">${i*25}%</text>`}
      Object.keys(p).forEach((k,i)=>{const y=47+i*52,x=155+p[k]*480,m=actual&&ok(actual[k])?155+actual[k]*480:null;b+=`<text x="4" y="${y+5}">${E(L[k])}</text>${m!==null?`<path d="M${x} ${y}H${m}" stroke="#a6b7ca" stroke-width="3"/><circle cx="${m}" cy="${y}" r="6" fill="#2766ab"><title>实测 ${F(actual[k]*100)}%</title></circle>`:''}<path d="M${x} ${y-6}l6 6l-6 6l-6-6Z" fill="#fff" stroke="#bc8530" stroke-width="2"><title>预测 ${F(p[k]*100)}%</title></path><text x="655" y="${y+5}">${actual?diff((actual[k]-p[k])*100,'pp'):'无实测'}</text>`});
      const mae=actual?mean(Object.keys(p).map(k=>Math.abs(p[k]-actual[k])))*100:null;
      html+='<div>'+figure(L[c],`可用眼动 ${s?.eyeN||0} 条 · MAE ${ok(mae)?F(mae)+'百分点':'待实测'}`,svg('SEEV预测实测哑铃图',b,275))+`<p class="viz-footnote">${E(L[c])}四AOI占有效覆盖时间 ${s?.coveredMs?F(s.modeledMs/s.coveredMs*100)+'%':'—'}；实测比例仅在这四AOI内归一化，pp＝百分点。</p></div>`;
    }
    html+='</div><details class="viz-methods"><summary>模型公式、冻结参数与适用边界</summary><p>'+E(A.MODEL.formula)+'；系数均1，版本 '+E(A.MODEL.version)+'。这是本项目按SEEV的序数操作化，不直接预测RT或命中率。</p><div class="viz-table-scroll"><table><tr><th>条件</th><th>AOI</th><th>S</th><th>EF</th><th>EX</th><th>V</th></tr>';
    for(const [c,aois] of Object.entries(A.MODEL.parameters))for(const [k,v] of Object.entries(aois))html+=`<tr><td>${E(L[c])}</td><td>${E(L[k])}</td>${v.map(x=>'<td>'+x+'</td>').join('')}</tr>`;
    return html+'</table></div><p>不同眼动人数、估计误差与缺失会影响对照。四个AOI不是四名被试，不作跨AOI显著性推断；参数不随本次结果调整。</p></details></section>';
  }
  function eyePanel(id,rows,exp,z){
    const available=rows.map((r,i)=>({r,i})).filter(({r})=>r.eyeTracking?.samples?.length),selected=available[0];
    let html='<section class="analysis-card"><h2>眼动数据质量</h2>'+quality(rows,exp,z)+diagnosisHTML(rows)+'</section>';
    if(exp==='bike_video_seev')html+=modelHTML(z);
    else html+='<section class="analysis-card">'+compare(z,exp,'targetDwellPercent','目标AOI停留占比','%')+compare(z,exp,'targetFirstEntryMs','首次估计进入目标',' ms',Math.max(1000,...C[exp].map(c=>z[c].targetFirstEntryMs).filter(ok)))+'<p class="viz-footnote">首次进入仅在有目标进入记录的试次计算，样本数 '+C[exp].map(c=>L[c]+' '+z[c].targetFirstEntryN).join(' / ')+'；不是首次注视。未进入保留缺失。</p></section>';
    html+='<section class="analysis-card"><div class="viz-section-head"><h2>单次视线轨迹</h2>'+(available.length?'<label>选择记录 <select data-gaze-select>'+available.map(({r,i})=>`<option value="${i}">记录${i+1} · ${E(L[r.cond])}${r.eyeTracking.summary.usable?'':' · 质量未达标'}</option>`).join('')+'</select></label>':'')+'</div><div data-gaze-map>'+gazeMap(selected?.r)+'</div></section>';return html;
  }
  function literature(exp,z){
    let visual='';if(exp==='change_blind'){
      visual=figure('原论文与本次：分开看时间尺度','仅为概念与方向参照；原文CI/MI不等同安全/背景，不进行跨研究显著性比较',svg('原论文和本次反应时间参考',
        [ ['原文 CI',4700,true],['原文 MI',10900,true],['本次 安全',z.task_relevant?.rt,false],['本次 背景',z.background?.rt,false] ].map(([label,v,ref],i)=>{const x=190,y=30+i*49,max=Math.max(12000,z.task_relevant?.rt||0,z.background?.rt||0)*1.08;return `<text x="8" y="${y+18}">${E(label)}</text>${ok(v)?`<rect x="${x}" y="${y}" width="${v/max*420}" height="25" rx="4" fill="${ref?'#a6b5c5':'#2766ab'}"/>`:''}<text x="630" y="${y+18}">${ok(v)?F(v/1000,2)+'s':'无实测'}</text>`}).join(''),250));
    }else{
      visual=figure('左右侧镜分配：原文参考与本次','灰色＝课程转录发表均值，蓝色＝本次；AOI、条件与有效时间分母不同',svg('镜面分配参考',
        [['原文 正常',2.27,true],['原文 言语',.90,true],['原文 空间',1.08,true],['本次 单任务',z.road_only?.mirrorsPercent,false],['本次 短视频',z.road_plus_video?.mirrorsPercent,false]].map(([label,v,ref],i)=>{const y=25+i*44,max=Math.max(3,z.road_only?.mirrorsPercent||0,z.road_plus_video?.mirrorsPercent||0)*1.1;return `<text x="8" y="${y+18}">${E(label)}</text>${ok(v)?`<rect x="190" y="${y}" width="${v/max*420}" height="24" rx="4" fill="${ref?'#a6b5c5':'#2766ab'}"/>`:''}<text x="632" y="${y+18}">${ok(v)?F(v,2)+'%':'无实测'}</text>`}).join(''),270));
    }
    return '<section class="analysis-card">'+visual+'</section>'+A.paperHTML(exp,z);
  }
  function personal(rows,exp){
    rows=rows.filter(r=>!r.practice);const id='rv'+(++counter);records.set(id,{rows,exp});if(records.size>8)records.delete(records.keys().next().value);
    const z=A.summarize(rows,exp),[a,b]=C[exp],valid=rows.filter(r=>r.valid!==0),hazard=valid.filter(r=>r.event==='hazard'),rts=valid.map(r=>rtOf(r,exp)).filter(ok),mainKey=A.METRICS[exp][0][0],rate=exp==='bike_video_seev'?(hazard.length?100*hazard.filter(r=>r.hit).length/hazard.length:null):(valid.length?100*valid.filter(r=>r.correct).length/valid.length:null),eye=valid.filter(r=>r.eyeTracking?.summary?.usable===1).length;
    const delta=ok(z[a][mainKey])&&ok(z[b][mainKey])?z[b][mainKey]-z[a][mainKey]:null,rtDelta=ok(z[a].rt)&&ok(z[b].rt)?z[b].rt-z[a].rt:null;
    const summary=`${L[b]}相对${L[a]}：${exp==='bike_video_seev'?'危险命中率':'定位正确率'}差 ${diff(delta,'百分点')}，正确RT差 ${diff(rtDelta,'ms')}。`;
    let html=`<div class="viz-report" data-viz-root="${id}"><header class="viz-hero"><div><span class="viz-kicker">YOUR ATTENTION · SESSION REPORT</span><h2>你的本次结果</h2><p>${exp==='bike_video_seev'?'骑行与短视频':'闪烁变化盲'} · ${rows.length}条正式记录 · 个人描述性反馈</p></div><span class="viz-tag">${valid.length}条有效 / ${eye}条眼动可用</span></header><div class="viz-stat-grid">`+
      card(exp==='bike_video_seev'?'总体危险命中':'总体定位正确',F(rate,0),ok(rate)?'%':'',exp==='bike_video_seev'?`${hazard.length}次有效危险事件为分母`:`${valid.length}次有效试次为分母`)+card('正确反应时间',F(mean(rts),0),rts.length?'ms':'',`${rts.length}次正确且≥150ms`)+card('有效正式记录',String(valid.length),' / '+rows.length,'失焦等无效原记录单独保留')+card('合格眼动试次',String(eye),' / '+valid.length,eye?'通过校准与覆盖质量门槛':'未启用或未达到质量门槛')+'</div>'+
      tabs(id,[['overview','01 概览'],['trials','02 逐试次'],['gaze','03 眼动与模型'],['paper','04 文献对照']]);
    let overview=`<div class="viz-insight"><span>本次条件差异</span><p>${E(summary)}</p><small>正值＝后者较高或较慢；差值不代表能力评分、因果证明或群体显著性。</small></div><div class="viz-grid two"><section class="analysis-card">${compare(z,exp,mainKey,A.METRICS[exp][0][1],'%')}</section><section class="analysis-card">${compare(z,exp,'rt','正确反应时间',' ms',Math.max(1000,...[z[a].rt,z[b].rt].filter(ok)))}</section></div><section class="analysis-card">${distribution(rows,exp)}</section><section class="analysis-card">${outcomeBars(rows,exp)}</section>`;
    if(z[a].n<10||z[b].n<10)overview+='<p class="analysis-warning">至少一个条件不足10次有效正式试次，当前不是完整配对。</p>';
    overview+='<details class="analysis-card viz-methods"><summary>全部行为指标与统计口径</summary><div class="viz-table-scroll"><table><tr><th>指标</th><th>'+E(L[a])+'</th><th>'+E(L[b])+'</th><th>后者−前者</th></tr>'+A.METRICS[exp].map(([k,l,u])=>`<tr><td>${E(l)}</td><td>${F(z[a][k])}</td><td>${F(z[b][k])}</td><td>${diff(ok(z[a][k])&&ok(z[b][k])?z[b][k]-z[a][k]:null,u)}</td></tr>`).join('')+(exp==='bike_video_seev'?`<tr><td>视频分类正确率</td><td>不适用</td><td>${F(z[b].video)}%</td><td>无单任务对应值</td></tr>`:'')+`<tr><td>有效/记录</td><td>${z[a].n}/${z[a].total}</td><td>${z[b].n}/${z[b].total}</td><td>正确RT n=${z[a].rtN}/${z[b].rtN}</td></tr></table></div><p>正确RT排除无效、错误和&lt;150ms响应。超时及无反应为缺失，不用0或时限填补。骑行危险命中/漏报以危险试次为分母，误报/正确拒绝以无危险试次为分母。</p></details>`;
    html+=panel(id,'overview',overview,true)+panel(id,'trials',trialExplorer(id,rows,exp))+panel(id,'gaze',eyePanel(id,rows,exp,z))+panel(id,'paper',literature(exp,z));
    return html+'<p class="viz-footnote">这是你本次的结果，不是全班结果。<a href="results.html" target="_blank" rel="noreferrer">群体分析</a> · <a href="研究设计与文献对照.md" target="_blank">研究设计和完整文献</a></p></div>';
  }
  function pairPlot(pairs,exp,title,unit){
    if(!pairs.length)return empty('暂无完整配对','两条件均≥10有效试次且该指标齐全，才显示参与者连线。');
    const vals=pairs.flatMap(p=>[p.a,p.b]),max=Math.max(1,...vals)*1.1,y=v=>260-v/max*210;let b='';
    for(let i=0;i<=4;i++){const yy=y(max*i/4);b+=`<path d="M85 ${yy}H680" class="viz-gridline"/><text x="70" y="${yy+5}" text-anchor="end">${F(max*i/4,max>200?0:1)}</text>`}
    pairs.forEach((p,i)=>{const offset=(i%11-5)*3;b+=`<path d="M${235+offset} ${y(p.a)}L${550+offset} ${y(p.b)}" stroke="#bdcbd9" opacity=".65"/><circle cx="${235+offset}" cy="${y(p.a)}" r="5" fill="${colors[0]}"><title>${E(p.participant)} ${F(p.a)}${E(unit)}</title></circle><circle cx="${550+offset}" cy="${y(p.b)}" r="5" fill="${colors[1]}"><title>${E(p.participant)} ${F(p.b)}${E(unit)}；差 ${diff(p.difference,unit)}</title></circle>`});
    C[exp].forEach((c,i)=>{b+=`<text x="${i?550:235}" y="299" text-anchor="middle">${E(L[c])}</text>`});return figure(title,`n=${pairs.length}对 · 每条线代表一名参与者 · 单位${unit}`,svg('参与者配对变化图',b,320));
  }
  function effectPlot(metrics,statistics,unit){
    const selected=metrics.filter(m=>m[2]===unit),values=selected.flatMap(([k])=>{const s=statistics[k];return s.ci?[...s.ci,s.mean]:ok(s.mean)?[s.mean]:[]}),extent=Math.max(unit==='ms'?100:5,...values.map(Math.abs))*1.15;
    if(!values.length)return empty('暂无'+unit+'效应','完整配对数据不足，均值与区间留空。');
    const x=v=>440+v/extent*180,h=selected.length*56+70;let b=`<path d="M440 20V${h-40}" stroke="#8396ab" stroke-dasharray="4 4"/>`;
    selected.forEach(([k,l],i)=>{const s=statistics[k],y=40+i*56;b+=`<text x="5" y="${y+5}">${E(l)}</text><text x="190" y="${y+5}" class="viz-muted">n=${s.n}</text>`;if(s.ci)b+=`<path d="M${x(s.ci[0])} ${y}H${x(s.ci[1])}" stroke="#91afcc" stroke-width="4"/>`;if(ok(s.mean))b+=`<circle cx="${x(s.mean)}" cy="${y}" r="6" fill="#2766ab"><title>均差${F(s.mean)} ${unit}${s.ci?'；95%区间 '+s.ci.map(v=>F(v)).join(' 至 '):'；区间缺失'}</title></circle>`;b+=`<text x="655" y="${y+5}">${ok(s.mean)?(s.mean>0?'+':'')+F(s.mean):'缺失'}</text>`});
    for(const v of [-extent,0,extent])b+=`<text x="${x(v)}" y="${h-12}" text-anchor="middle">${F(v,0)}</text>`;
    return figure('条件差值与不确定性 · '+unit,'圆点＝配对均差；线段＝95%自助区间；虚线＝零差值。不同单位分图。',svg('配对效应区间图',b,h));
  }
  function groupHTML(sessions,exp){
    const id='gv'+(++counter),metrics=A.METRICS[exp],stats=Object.fromEntries(metrics.map(([k])=>[k,A.paired(sessions,exp,k)])),primary=stats[metrics[0][0]],[a,b]=C[exp];
    let html=`<div class="viz-report" data-viz-root="${id}"><header class="viz-hero"><div><span class="viz-kicker">PAIRED EVIDENCE · GROUP REPORT</span><h2>${exp==='bike_video_seev'?'短视频双任务：群体结果':'安全与背景变化：群体结果'}</h2><p>${E(L[b])} − ${E(L[a])}；按参与者配对计算，不把试次当人数。</p></div><span class="viz-tag">${primary.n>=5?'人数门槛已达到（按导入声明）':'尚不足5对'}</span></header><div class="viz-stat-grid">`+card('导入会话',String(sessions.length),'份','同一实验及版本')+card('完整主指标配对',String(primary.n),'人','每条件至少10有效试次')+card('主指标平均差',ok(primary.mean)?F(primary.mean):'—',ok(primary.mean)?'pp':'',metrics[0][1]+'，后者−前者')+card('双侧配对p',ok(primary.p)?F(primary.p,4):'未计算','',primary.n<5?'不足5人不计算p':'符号翻转检验')+'</div>'+
      tabs(id,[['overview','01 效应概览'],['pairs','02 每人变化'],['gaze','03 眼动与模型'],['detail','04 明细与文献']]);
    const overview='<div class="viz-grid two"><section class="analysis-card">'+effectPlot(metrics,stats,'百分点')+'</section><section class="analysis-card">'+effectPlot(metrics,stats,'ms')+'</section></div><p class="viz-footnote">区间跨零并不证明没有效应，方向一致也不等于因果成立。小样本自助区间不稳定；多指标p未作多重比较校正。</p>';
    const pairs='<div class="viz-grid two"><section class="analysis-card">'+pairPlot(primary.pairs,exp,metrics[0][1],'%')+'</section><section class="analysis-card">'+pairPlot(stats.rt.pairs,exp,'正确反应时间','ms')+'</section></div>';
    const avg={};for(const c of C[exp]){const eligible=sessions.map(s=>A.summarize(s.trials,exp)[c]).filter(z=>z.n>=10),qualified=sessions.filter(s=>JSON.stringify(s.meta.predictionModel)===JSON.stringify(A.MODEL)).map(s=>A.summarize(s.trials,exp)[c]).filter(z=>z.n>=10&&z.aoi);avg[c]={rt:mean(eligible.map(s=>s.rt).filter(ok)),mirrorsPercent:mean(eligible.map(s=>s.mirrorsPercent).filter(ok)),eyeN:qualified.reduce((a,b)=>a+b.eyeN,0),eyeParticipants:qualified.length,coveredMs:qualified.reduce((a,b)=>a+b.coveredMs,0),modeledMs:qualified.reduce((a,b)=>a+b.modeledMs,0),aoi:qualified.length?Object.fromEntries(Object.keys(A.predict('road_only')).map(k=>[k,mean(qualified.map(s=>s.aoi[k]))])):null}}
    const gaze=exp==='bike_video_seev'?`<p>模型对照仅纳入携带相同模型快照的合格会话；各参与者比例等权平均。眼动人数：${avg[a].eyeParticipants} / ${avg[b].eyeParticipants}。</p>`+modelHTML(avg):empty('群体眼动以质量与目标指标为准','单次轨迹在各参与者完成页查看；不同布局不叠加为一张热图。')+'<div class="analysis-card"><table><tr><th>匿名编号</th><th>安全眼动可用</th><th>背景眼动可用</th></tr>'+sessions.map(s=>{const z=A.summarize(s.trials,exp);return `<tr><td>${E(s.participant)}</td><td>${z[a].eyeN}</td><td>${z[b].eyeN}</td></tr>`}).join('')+'</table></div>';
    let detail='<section class="analysis-card"><h2>统计明细</h2><div class="viz-table-scroll"><table><tr><th>指标</th><th>n</th><th>平均差</th><th>差值SD</th><th>95%区间</th><th>dz</th><th>p</th></tr>'+metrics.map(([k,l,u])=>{const s=stats[k];return `<tr><td>${E(l)}（${E(u)}）</td><td>${s.n}</td><td>${F(s.mean)}</td><td>${F(s.sd)}</td><td>${s.ci?s.ci.map(v=>F(v)).join(' 至 '):'—'}</td><td>${F(s.dz,2)}</td><td>${F(s.p,4)}</td></tr>`}).join('')+'</table></div><details class="viz-methods"><summary>计算方法与缺失处理</summary><p>每名参与者先算条件差，再求群体均值。正确RT≥150ms且仅正确有效；每条件不足10有效试次或指标缺失不进入该指标配对。95%区间用固定种子4000次配对自助法；符号翻转≤18人穷举，否则20,000次；n&lt;5不计算p。差值SD=0时dz缺失。5对样本最小双侧精确p=0.0625。</p></details></section>';
    detail+='<section class="analysis-card"><h2>参与者与有效数</h2><div class="viz-table-scroll"><table><tr><th>匿名编号</th><th>'+E(L[a])+'</th><th>'+E(L[b])+'</th><th>主指标纳入</th></tr>'+sessions.map(s=>{const z=A.summarize(s.trials,exp);return `<tr><td>${E(s.participant)}</td><td>${z[a].n}</td><td>${z[b].n}</td><td>${primary.pairs.some(p=>p.participant===s.participant)?'是':'否'}</td></tr>`}).join('')+'</table></div></section>'+literature(exp,avg);
    return html+panel(id,'overview',overview,true)+panel(id,'pairs',pairs)+panel(id,'gaze',gaze)+panel(id,'detail',detail)+'</div>';
  }
  function bind(doc){
    doc.addEventListener('click',e=>{const tab=e.target.closest?.('[data-result-tab]'),trial=e.target.closest?.('[data-inspect-trial]');
      if(tab){const host=tab.closest('[data-viz-root]'),key=tab.dataset.resultTab;host.querySelectorAll('[data-result-tab]').forEach(t=>t.setAttribute('aria-selected',String(t===tab)));host.querySelectorAll('[data-result-panel]').forEach(p=>p.hidden=p.dataset.resultPanel!==key)}
      if(trial){const host=trial.closest('[data-viz-root]'),data=records.get(host.dataset.vizRoot),i=Number(trial.dataset.inspectTrial);if(!data?.rows[i])return;host.querySelectorAll('[data-inspect-trial]').forEach(t=>t.setAttribute('aria-pressed',String(t===trial)));host.querySelector('[data-trial-detail]').innerHTML=trialDetail(data.rows[i],i,data.exp)}
    });
    doc.addEventListener('change',e=>{if(!e.target.matches?.('[data-gaze-select]'))return;const host=e.target.closest('[data-viz-root]'),data=records.get(host.dataset.vizRoot);if(data)host.querySelector('[data-gaze-map]').innerHTML=gazeMap(data.rows[Number(e.target.value)])});
    doc.addEventListener('keydown',e=>{const tab=e.target.closest?.('[data-result-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const list=[...tab.parentElement.querySelectorAll('[data-result-tab]')],i=list.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?list.length-1:(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;e.preventDefault();list[next].click();list[next].focus()});
  }
  A.paperHTML=A.paperHTML||(()=> '');A.personal=personal;A.groupHTML=groupHTML;A.modelHTML=modelHTML;
  const V={personal,groupHTML,modelHTML,gazeMap,distribution,timeline,trialDetail,bind};root.LabResultsViz=V;if(typeof module!=='undefined')module.exports=V;
  if(typeof document!=='undefined'&&document.addEventListener)bind(document);
})(globalThis);
