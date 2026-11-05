/* Explicit local file analysis; no server calls or automatic persistence. */
(() => {
  const A=LabAnalysis,$=id=>document.getElementById(id);let sessions=[],lastReport=null;
  $('personal-file').onchange=async()=>{
    const f=$('personal-file').files[0];if(!f)return;
    try{if(f.size>30*1024*1024)throw Error('文件超过30MB。');const one=A.parse(await f.text(),f.name);if(one.length!==1)throw Error('个人回看只接受一份完整会话。');const s=one[0];
      const snapshot=JSON.stringify(s.meta.predictionModel)===JSON.stringify(A.MODEL);
      $('personal-replay').innerHTML=(snapshot?'':'<p class="analysis-warning">此文件不含相同冻结模型快照：下方SEEV仅作当前模型回顾性参考，不充当收数前预测检验。</p>')+A.personal(s.trials,s.experiment);
      $('personal-status').textContent='已回看 '+s.participant+' 的一份会话；未加入群体统计。';
    }catch(e){$('personal-status').textContent='无法回看：'+e.message;$('personal-replay').innerHTML=''}
  };
  function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function groups(){return [...new Set(sessions.map(s=>s.experiment+'|'+s.meta.version))]}
  function render(){
    const value=$('result-version').value;if(!value){$('group-results').innerHTML='<p>待收集：尚无参与者数据。</p>';$('export-summary').disabled=true;return}
    const [exp,version]=value.split('|'),selected=sessions.filter(s=>s.experiment===exp&&s.meta.version===version);
    $('group-results').innerHTML=A.groupHTML(selected,exp);$('export-summary').disabled=false;
    lastReport={analysisVersion:A.VERSION,at:new Date().toISOString(),researcherAttested:true,experiment:exp,version,
      participantCount:selected.length,participants:selected.map(s=>({participant:s.participant,sessionId:s.meta.sessionId||null,summary:A.summarize(s.trials,exp)})),
      effects:Object.fromEntries(A.METRICS[exp].map(([key])=>[key,A.paired(selected,exp,key)])),model:A.MODEL,
      notes:['Each person receives equal weight in group effects.','No inference about real participant identity can be made by software.','Literature reference values are not participant observations.']};
  }
  $('analyze').onclick=async()=>{
    if(!$('confirm-real').checked){$('import-status').textContent='请先确认数据来源；未导入任何数据。';return}
    const files=[...$('result-files').files];if(!files.length){$('import-status').textContent='请先选择本项目的匿名JSON/CSV。';return}
    $('analyze').disabled=true;
    try{
      const incoming=[];for(const f of files){if(f.size>30*1024*1024)throw Error('单文件超过30MB，请分会话导入。');try{incoming.push(...A.parse(await f.text(),f.name))}catch(e){throw Error(f.name+'：'+e.message)}}
      const merged=A.mergeSessions(sessions,incoming);sessions=merged.sessions;
      const previous=$('result-version').value;$('result-version').innerHTML=groups().map(k=>'<option value="'+A.esc(k)+'">'+A.esc(k.replace('|',' · '))+'</option>').join('');
      if(groups().includes(previous))$('result-version').value=previous;
      $('import-status').textContent='已在本机载入 '+sessions.length+' 份会话；本批忽略相同重复文件 '+merged.duplicates+' 份。不同实验/版本分开分析，不能相加为独立被试人数。';render();
    }catch(e){$('import-status').textContent='导入失败，原数据保持不变：'+e.message}
    finally{$('analyze').disabled=false}
  };
  $('clear-results').onclick=()=>{sessions=[];lastReport=null;$('result-version').innerHTML='<option value="">尚无数据</option>';$('result-files').value='';$('confirm-real').checked=false;$('import-status').textContent='已清除本页内存数据。';render()};
  $('result-version').onchange=render;$('export-summary').onclick=()=>{if(lastReport)download(lastReport,'attention-analysis-'+lastReport.experiment+'.json')};
  $('model-preview').innerHTML=A.modelHTML({});
})();
