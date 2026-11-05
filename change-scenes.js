/* Original SVG scene bank: 20 formal scenes + 4 separate practice scenes. */
const ChangeScenes=(()=>{
  const names=['街区','公园','港口','集市','车站','乡间'];
  const types=['car','sign','tree','building','person','bicycle','bench','flowers'];
  const labels={car:'汽车',sign:'路牌',tree:'树木',building:'建筑',person:'行人',bicycle:'自行车',bench:'长椅',flowers:'花盆'};
  const relevant=['sign','car','person','bicycle','sign','car','person','bicycle','sign','car'];
  const background=['tree','building','bench','flowers','tree','building','bench','flowers','tree','building'];
  const changes={sign:['右转','左转','通行方向改变'],car:['停止线前','越过停止线','车辆越过停止线'],person:['人行道上','进入斑马线','行人进入通行路径'],bicycle:['前灯关闭','前灯点亮','骑行照明状态改变'],tree:['阔叶树冠','针叶树冠','树冠造型改变'],building:['条纹遮阳篷','平直遮阳篷','店面遮阳篷改变'],bench:['双层靠背','单层靠背','座椅靠背结构改变'],flowers:['三簇花朵','五簇花朵','花簇数量改变']};
  function trials(practice,ordinal=1){
    ordinal=Math.max(1,Math.trunc(Number(ordinal)||1));
    const out=[];
    for(const cond of ['task_relevant','background'])for(let i=0;i<(practice?2:10);i++){
      const target=(cond==='task_relevant'?relevant:background)[practice?i*3:i],pair=practice?10+i:i;
      out.push({cond,trial:i+1,target,sceneId:(practice?20:0)+i*2+(cond==='background'?1:0),practice,
        pairId:pair,layout:(pair+ordinal-1)%10,variant:(pair+ordinal-1)%3,cueObjects:['traffic_safety'],changeKind:target==='sign'?'arrow_direction':['car','person'].includes(target)?'safety_position':target==='bicycle'?'headlamp':'structure',beforeState:changes[target][0],afterState:changes[target][1],changeDescription:changes[target][2],cueVersion:'fixed-traffic-safety-v1',stimulusVersion:'safety-v5.1'});
    }
    return shuffle(out);
  }
  function cueText(){return '交通安全：通行方向、车辆与行人、骑行照明'}
  function boxes(item){
    const layout=item.layout??Math.floor((item.sceneId||0)/2)%10;
    // Contextual depth, not eight equally spaced icon slots. Mirror the layout
    // between orders; keep object artwork unmirrored so arrows retain meaning.
    const anchors={tree:[62,78,1.35],building:[370,55,1.5],flowers:[745,117,1],sign:[600,169,.95],person:[278,242,.88],bicycle:[104,252,1],car:[425,245,1],bench:[731,281,1]};
    return Object.fromEntries(types.map(type=>{
      let [x,y,scale]=anchors[type];
      if(type===item.target)scale=[1,.95,1.05][layout%3];
      x+=layout%3*5;y+=layout%2*3;
      const width=type==='car'?164:124,height=type==='person'?164:124;
      if(layout%2)x=900-x-width*scale;
      return [type,{x,y,w:width*scale,h:height*scale,scale}];
    }));
  }
  function hit(item,x,y){
    const found=Object.entries(boxes(item)).find(([,b])=>x*900>=b.x&&x*900<=b.x+b.w&&y*420>=b.y&&y*420<=b.y+b.h);
    return found?.[0]||'background';
  }
  function object(type,b,changed,variant,kind='detail'){
    const detail=changed;variant%=3;
    const palette={car:['#176ba5','#e77a22'],sign:['#215f9c','#db9a19'],tree:['#26814b','#9952a1'],building:['#d29142','#397ab2'],person:['#bf404c','#247fa4'],bicycle:['#176ba5','#c13f43'],bench:['#326ba5','#cf7021'],flowers:['#356daa','#d47a23']};
    const color=variant===0?palette[type][0]:variant===1?{car:'#aa744b',sign:'#286c92',tree:'#6d8c52',building:'#b3c8c0',person:'#9e714b',bicycle:'#997548',bench:'#6c8884',flowers:'#ac8a64'}[type]:{car:'#579183',sign:'#286c92',tree:'#538d83',building:'#cba38b',person:'#526f97',bicycle:'#497d75',bench:'#a58256',flowers:'#8e9890'}[type],ink='#233f50';let body='';
    if(type==='car')body=`<path d="M4 47L20 38L31 20H65L80 39L88 48V70H4Z" fill="${color}" stroke="${ink}" stroke-width="2"/><path d="M33 25H59L70 39H24Z" fill="#e4f4fc" stroke="${ink}" stroke-width="2"/><circle cx="22" cy="71" r="11" fill="${ink}"/><circle cx="72" cy="71" r="11" fill="${ink}"/><circle cx="22" cy="71" r="5" fill="#dce5ea"/><circle cx="72" cy="71" r="5" fill="#dce5ea"/><rect x="5" y="50" width="10" height="8" fill="#fff0b0"/>${detail?'<rect x="27" y="3" width="42" height="16" rx="3" fill="#f1b836" stroke="#233f50" stroke-width="2"/>':''}`;
    if(type==='sign')body=`<rect x="42" y="46" width="8" height="43" fill="${ink}"/><rect x="5" y="3" width="82" height="57" rx="6" fill="${color}" stroke="${ink}" stroke-width="2"/><path d="${detail?'M46 12V48M46 48L29 31M46 48L63 31':'M22 31H70M70 31L53 14M70 31L53 48'}" fill="none" stroke="#fffdf4" stroke-width="10" stroke-linejoin="round"/>`;
    if(type==='tree')body=`<rect x="40" y="44" width="13" height="45" fill="#805635" stroke="${ink}" stroke-width="2"/>${detail?`<path d="M46 1L84 38H69L91 61H1L23 38H8Z" fill="${color}" stroke="${ink}" stroke-width="2"/>`:`<path d="M46 3C65 -1 82 13 79 28C97 39 86 64 68 62H24C2 66 -3 38 14 28C10 10 29 -1 46 3Z" fill="${color}" stroke="${ink}" stroke-width="2"/>`}`;
    if(type==='building')body=`<rect x="6" y="19" width="80" height="70" fill="${color}" stroke="${ink}" stroke-width="2"/><path d="M1 19L46 2L91 19Z" fill="#76526c" stroke="${ink}" stroke-width="2"/>${[18,55].map(x=>[30,55].map(y=>`<rect x="${x}" y="${y}" width="21" height="17" fill="${detail?'#ffde55':'#234964'}" stroke="${ink}" stroke-width="2"/>`).join('')).join('')}<rect x="40" y="69" width="14" height="20" fill="#f1e4d0" stroke="${ink}" stroke-width="2"/>`;
    if(type==='person')body=`<circle cx="46" cy="14" r="12" fill="#e4b78d" stroke="${ink}" stroke-width="2"/><path d="M32 31H60L64 64H28Z" fill="${color}" stroke="${ink}" stroke-width="2"/><path d="M38 63L26 88M54 63L66 88M32 35L${detail?'12 10':'12 62'}M60 35L${detail?'80 10':'80 62'}" stroke="${ink}" stroke-width="10" fill="none" stroke-linecap="round"/>`;
    if(type==='bicycle')body=`<circle cx="21" cy="68" r="19" fill="#f4f7f5" stroke="${ink}" stroke-width="5"/><circle cx="73" cy="68" r="19" fill="#f4f7f5" stroke="${ink}" stroke-width="5"/><path d="M21 68L37 37L52 68H21L66 39L73 68M30 32H46M63 38V25H76" fill="none" stroke="${color}" stroke-width="8" stroke-linejoin="round"/>${detail?'<rect x="59" y="10" width="32" height="27" rx="3" fill="#edae2c" stroke="#233f50" stroke-width="3"/><path d="M64 19H86M64 28H86" stroke="#8f6420" stroke-width="2"/>':''}`;
    if(type==='bench')body=`<path d="M15 63V89M77 63V89M11 43V69H83V43" fill="none" stroke="${ink}" stroke-width="7"/><rect x="5" y="33" width="84" height="16" fill="${color}" stroke="${ink}" stroke-width="2"/>${detail?'':`<rect x="5" y="7" width="84" height="18" fill="${color}" stroke="${ink}" stroke-width="2"/>`}<rect x="5" y="57" width="84" height="13" fill="${color}" stroke="${ink}" stroke-width="2"/>`;
    if(type==='flowers')body=`<path d="M22 58H73L64 90H31Z" fill="${color}" stroke="${ink}" stroke-width="2"/><path d="M47 60V17M47 46L20 23M47 46L74 23" stroke="#2c784a" stroke-width="5"/>${(detail?[46]:[18,46,75]).map((x,i)=>`<circle cx="${x}" cy="${i===1?12:25}" r="13" fill="#ecb22c" stroke="#9b631b" stroke-width="2"/><circle cx="${x}" cy="${i===1?12:25}" r="4" fill="#944630"/>`).join('')}`;
    // Three structural models for EVERY category. The same variant is used in A/A′.
    if(type==='car'){
      const profile=variant===0?'M3 48L18 39L31 21H61L77 40L88 48V72H3Z':variant===1?'M3 25Q3 17 12 17H64L82 41L88 48V74H3Z':'M3 44H43V23H66L82 43L88 48V73H3Z';
      const windows=variant===0?'M32 27H45V40H23ZM50 27H59L70 40H50Z':variant===1?'M10 25H28V42H10ZM34 25H52V42H34ZM58 25H63L76 42H58Z':'M50 28H64L76 43H50Z';
      body=`<path d="M96 9V104" stroke="#526a6e" stroke-width="14"/><path d="M96 9V104" stroke="#fff5d8" stroke-width="9"/><g data-road-position="${changed?'over-line':'before-line'}" transform="translate(${changed?60:0} 0)"><path d="${profile}" fill="${color}" stroke="${ink}" stroke-width="2"/><path d="${windows}" fill="#d8edf0" stroke="#537582" stroke-width="1.5"/><path d="M7 51H81M39 44V68" stroke="#edf2dd" stroke-width="1" opacity=".65"/><path d="M48 49H56" stroke="${ink}" stroke-width="2"/><rect x="78" y="49" width="9" height="8" rx="2" fill="#f8e0a0"/><rect x="3" y="53" width="5" height="8" fill="#ad4f40"/><path d="M2 69H88" stroke="#3c5963" stroke-width="4"/>${[21,70].map(x=>`<circle cx="${x}" cy="73" r="11" fill="#29414b"/><circle cx="${x}" cy="73" r="5.5" fill="#c2d0d0"/><circle cx="${x}" cy="73" r="2" fill="#607b85"/>`).join('')}</g>`;
    }
    if(type==='sign'){
      body=body.replace('M46 12V48M46 48L29 31M46 48L63 31','M70 31H22M22 31L39 14M22 31L39 48');
      if(variant===1)body=body.replace('<rect x="5" y="3" width="82" height="57" rx="6"', '<rect x="5" y="3" width="82" height="57" rx="22"');
      if(variant===2)body=body.replace('<rect x="5" y="3" width="82" height="57" rx="6"', '<rect x="5" y="3" width="82" height="57" rx="0"');
      body=`<g data-arrow="${changed?'left':'right'}">${body}</g>`;
    }
    if(type==='person'){
      body=body.replace(/M32 35L12 10M60 35L80 10/,'M32 35L12 62M60 35L80 62');
      body=`<path d="M0 90H117V154H0Z" fill="#738b91"/><path d="M18 97V150M42 97V150M66 97V150M90 97V150" stroke="#fff5de" stroke-width="13"/><path d="M0 90H117" stroke="#e8d6b5" stroke-width="6"/><g data-pedestrian="${changed?'crosswalk':'sidewalk'}" transform="translate(0 ${changed?58:0})">${body}${variant===1?'<path d="M30 7H62" stroke="#bd9155" stroke-width="7"/>':variant===2?'<rect x="21" y="33" width="10" height="27" rx="3" fill="#ca9a42"/>':''}</g>`;
    }
    if(type==='bicycle'){
      body=body.replace(/<rect x="59" y="10"[\s\S]*$/,'');
      body+=`${variant===1?'<path d="M8 42H31V28H8Z" fill="#bd995e" stroke="#233f50" stroke-width="2"/>':variant===2?'<path d="M2 45H29M8 40V50M23 40V50" stroke="#537b83" stroke-width="4"/>':''}<rect x="74" y="22" width="12" height="12" rx="2" fill="#40545e"/><path data-headlamp="${changed?'on':'off'}" d="M84 22L112 9V47L84 34Z" fill="${changed?'#ffe185':'#9aafad'}"/><rect x="81" y="23" width="9" height="10" fill="${changed?'#fff3bf':'#617782'}"/>`;
    }
    if(type==='building'){
      body=body.replaceAll(detail?'#ffde55':'#234964','#496b80');
      body+=`<path data-awning="${changed?'plain':'striped'}" d="M1 49H91L98 65H0Z" fill="${changed?'#417f87':'#b97e57'}"/>${changed?'':'<path d="M16 49L12 65M36 49L34 65M56 49V65M76 49L80 65" stroke="#f1dcb6" stroke-width="8"/>'}`;
      if(variant===1)body=body.replace('M1 19L46 2L91 19Z','M1 19V2H91V19Z');
      if(variant===2)body=body.replace('M1 19L46 2L91 19Z','M1 19L16 2H77L91 19Z');
    }
    if(type==='tree'&&variant===1)body=body.replace('M46 3C65 -1 82 13 79 28C97 39 86 64 68 62H24C2 66 -3 38 14 28C10 10 29 -1 46 3Z','M46 0C85 0 81 70 46 74C10 70 4 0 46 0Z');
    if(type==='tree'&&variant===2)body+= '<path d="M47 62L24 34M48 53L65 25" stroke="#658355" stroke-width="3" fill="none"/>';
    if(type==='bench'&&variant===1)body+= '<path d="M7 4Q45 -8 87 4" stroke="#567887" stroke-width="4" fill="none"/>';
    if(type==='bench'&&variant===2)body=body.replaceAll('width="84" height="16"','width="84" height="16" rx="7"');
    if(type==='flowers'){
      body=`${variant===0?'<path d="M6 63H106L95 100H17Z" fill="#ba805a"/>':variant===1?'<rect x="3" y="63" width="108" height="37" rx="7" fill="#879e97"/>':'<path d="M2 68Q57 46 112 68V95Q57 108 2 95Z" fill="#a28d73"/>'}<g data-flower-count="${changed?5:3}">${(changed?[13,34,55,76,97]:[23,55,87]).map((x,i)=>`<path d="M${x} 78V${17+i%2*15}" stroke="#447b59" stroke-width="3"/><ellipse cx="${x+6}" cy="52" rx="8" ry="4" fill="#65905d"/><circle cx="${x}" cy="${17+i%2*15}" r="12" fill="${['#ce8169','#d4ac46','#b77f9d'][variant]}"/><circle cx="${x}" cy="${17+i%2*15}" r="4" fill="#ffe7a9"/>`).join('')}</g>`;
    }
    const shadow=type==='car'?`<ellipse cx="${49+(changed?60:0)}" cy="98" rx="45" ry="4" fill="#284e58" opacity=".13"/>`:type==='person'?`<ellipse cx="50" cy="${98+(changed?58:0)}" rx="31" ry="4" fill="#284e58" opacity=".13"/>`:'<ellipse cx="60" cy="116" rx="52" ry="5" fill="#284e58" opacity=".13"/>';
    return `<g data-object="${type}" data-model="${variant}" transform="translate(${b.x} ${b.y}) scale(${b.scale??1})">${shadow}<g transform="translate(4 10)">${body}</g></g>`;
  }
  function scene(item,changed,masked=false,answer=false){
    const id=item.sceneId,theme=(Math.floor(id/2)+(id%2)*3)%6,v=item.variant??Math.floor(id/2)%3,sky=['#dce9ec','#edf0df','#e9e5df'][v],b=boxes(item);
    let decor='';
    if(theme===0)decor=Array.from({length:6},(_,i)=>`<rect x="${i*170-30}" y="${100+(i+v)%3*20}" width="115" height="140" fill="${i%2?'#a3b3b5':'#b6beb6'}"/>${[0,1,2].map(k=>`<path d="M${i*170-10} ${130+k*28}h70" stroke="#748f99" stroke-width="9"/>`).join('')}`).join('');
    if(theme===1)decor='<path d="M0 230Q170 50 340 220Q570 60 900 225V290H0Z" fill="#93b099"/><path d="M0 310Q400 190 900 325" fill="none" stroke="#d1c8ac" stroke-width="36"/>';
    if(theme===2)decor='<path d="M0 185H900V310H0Z" fill="#91b5c3"/><path d="M0 230H900M0 260H900" stroke="#c5d7d9" stroke-width="4"/><path d="M420 195H570L548 218H441Z" fill="#797a77"/><path d="M490 195V110L545 180H490" fill="#eee9d5" stroke="#7b8d91" stroke-width="3"/>';
    if(theme===3)decor=Array.from({length:4},(_,i)=>`<rect x="${i*240+12}" y="170" width="155" height="85" fill="#cbbfa4"/><path d="M${i*240} 170L${i*240+90} 110L${i*240+180} 170Z" fill="${i%2?'#b78d77':'#8fa7a0'}"/>`).join('');
    if(theme===4)decor='<rect x="40" y="120" width="820" height="110" rx="12" fill="#a0b3ba"/><path d="M60 228H840" stroke="#6f8089" stroke-width="10"/>'+Array.from({length:9},(_,i)=>`<rect x="${70+i*88}" y="145" width="55" height="40" rx="5" fill="#d7e3df"/>`).join('');
    if(theme===5)decor='<path d="M0 230L130 91L300 235L530 100L760 236L900 150V295H0Z" fill="#8eaa9b"/><path d="M350 420L480 220H510L650 420Z" fill="#c7b99f"/><path d="M0 290H300M650 290H900" stroke="#d5ccb2" stroke-width="8"/>';
    const highlight=answer?`<rect x="${b[item.target].x-4}" y="${b[item.target].y-4}" width="${b[item.target].w+8}" height="${b[item.target].h+8}" fill="none" stroke="#b13f32" stroke-width="3" stroke-dasharray="8 5"/>`:'';
    const road=`<path d="M0 234Q350 202 900 239V420H0Z" fill="${['#e2d6be','#dcd8c9','#e4d8cb'][v]}"/><path d="M0 279Q370 231 900 274V354Q370 299 0 368Z" fill="#899a9d"/><path d="M0 279Q370 231 900 274M0 368Q370 299 900 354" stroke="#f3e9cf" stroke-width="5" fill="none"/><path d="M0 325Q370 262 900 316" stroke="#d8d6bd" stroke-width="3" stroke-dasharray="32 28" fill="none"/>`;
    const texture=Array.from({length:30},(_,i)=>`<path d="M${(i*73+id*13)%900} ${380+i%3*13}h${8+i%3*4}" stroke="#b5b09b" stroke-width="2" opacity=".5"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" class="change-scene change-art" viewBox="0 0 900 420" role="img" aria-label="${names[theme]}场景 ${id+1}" data-scene-id="${id}" preserveAspectRatio="none">${masked?'<rect width="900" height="420" fill="#d9dee0"/>':`<rect width="900" height="420" fill="${sky}"/><circle cx="${100+(id*71)%700}" cy="45" r="23" fill="#efe0b4"/><path d="M25 42Q55 13 83 39H147Q168 59 135 62H35Q8 60 25 42M560 47Q595 16 632 42H696Q719 61 690 65H570Q540 62 560 47" fill="#faf6e9" opacity=".8"/><rect y="220" width="900" height="200" fill="#b8c9ad"/><g opacity=".7">${decor}</g>${road}${texture}${types.map(type=>object(type,b[type],changed&&type===item.target,v,item.changeKind)).join('')}${highlight}`}</svg>`;
  }
  return {scene,hit,boxes,trials,cueText,labels,types,changes,object};
})();
