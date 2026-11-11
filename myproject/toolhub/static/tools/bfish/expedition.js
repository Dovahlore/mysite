/* Tide expedition V4. No dependencies or remote assets. */
'use strict';
var expedition = {stamina:100, diet:[], sites:[], discovered:0, species:{}, won:false, best:0, map:false};
try { expedition.best = Number(localStorage.getItem('bfish-best-v4')) || 0; } catch (_) {}
var SITES = [
 {x:13600,y:7900,name:'潮汐摇篮',sub:'从这里开始，追逐银色鱼群',color:'#80f0d0'},
 {x:12100,y:6500,name:'翡翠回廊',sub:'穿过拱门，寻找生命的微光',color:'#8de6b3'},
 {x:15100,y:5900,name:'珊瑚圣所',sub:'暖流交汇，鱼群在此聚集',color:'#ffb7a6'},
 {x:16500,y:8600,name:'失落星环',sub:'旧世界留下的蓝色信标',color:'#9cbfff'},
 {x:11900,y:10300,name:'幽蓝之眼',sub:'黑暗深处，仍有星光',color:'#b9a3ff'}
];
CONF.HUNGER_DRAIN = 0.95;
CONF.GROW_FISH = 0.038;
FOOD_INFO.crab.grow = 0.04; FOOD_INFO.crab.hunger = 7; FOOD_INFO.crab.respawn = 24; FOOD_INFO.crab.cap = 5;
FOOD_INFO.pearl.grow = 0; FOOD_INFO.starfish.grow = 0.03; FOOD_INFO.star.grow = 0.06; FOOD_INFO.shrimp.grow = 0.12;
function dietWeight(key){
 var count = 0;
 for(var i=0;i<expedition.diet.length;i++) if(expedition.diet[i].key===key) count++;
 return Math.max(0.12, 1/(1+count*0.65));
}
function recordMeal(key){ expedition.diet.push({key:key,time:survivalTime}); }
function foodNutrition(type,amount){ return amount*(0.45+0.55*dietWeight(type)); }
function foodGrowth(type){
 var gain = FOOD_INFO[type].grow * dietWeight(type) * Math.min(1,12/player.size);
 recordMeal(type); return gain;
}
function fishGrowth(f){
 var key=f.spec.n, ratio=f.size/player.size;
 var gain=f.size*CONF.GROW_FISH * clamp(ratio/0.62,0.18,1.25) * (0.5+0.5*dietWeight(key));
 expedition.species[key]=true; recordMeal(key); return gain;
}
// Fixed seed makes terrain reproducible while wildlife stays different each run.
var baseBake=bakeBackgrounds;
bakeBackgrounds=function(){
 var nativeRandom=Math.random, seed=972113;
 Math.random=function(){seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
 try {baseBake();} finally {Math.random=nativeRandom;}
 // Remove painted, non-collidable caves; actual carved SDF caves are retained.
 WORLD_CAVES=[];
 // Floating giant plants had no supporting rock. Keep plants attached to seabed.
 SPIRES=[]; SARG=SARG.filter(function(s){return s.y<2200;});
 for(var i=0;i<VKELP.length;i++) VKELP[i].y=floorAt(VKELP[i].x);
 // Designed traversable reef islands around the central expedition circuit.
 for(i=1;i<SITES.length;i++){
  var p=SITES[i];
  var rk={ax:p.x,ay:p.y+60,blobs:[-300,40,210,300,40,210,0,-210,360],caves:[0,-40,0,550,160],k:80,glow:i===4,z:i===2?1:i===4?2:3,spr:null};
  rkBake(rk); rk.hang=false; RK_list.push(rk);
 }
 // Every tangible rock appears on the same map used for navigation.
 if(MINIMAP_BASE){var g=MINIMAP_BASE.getContext('2d'), sc=MINIMAP_BASE.width/CONF.WORLD_W;
  g.fillStyle='#284f65'; RK_list.forEach(function(r){g.fillRect(r.wx0*sc,r.wy0*sc,(r.wx1-r.wx0)*sc,Math.max(2,(r.wy1-r.wy0)*sc));});
 }
};
var oldReset=resetGame;
resetGame=function(){
 expedition.stamina=100; expedition.diet=[]; expedition.sites=SITES.map(function(){return false;});
 expedition.discovered=0; expedition.species={}; expedition.won=false; expedition.map=false;
 oldReset();
 // A safe opening shoal: enough edible prey to learn the first growth loop.
 for(var i=0;i<16;i++){
  var f=newFish(),sp=SPECIES[i%2], a=i*2.39996,r=180+i*25;
  Object.assign(f,{specIdx:i%2,spec:sp,size:rand(6,8),x:player.x+Math.cos(a)*r,y:player.y+Math.sin(a)*r,vx:0,vy:0,angle:a,tailPhase:a,hunger:70,state:'wander',fleeTimer:0,lungeT:0,huntT:0,huntCd:8,aggroTimer:0,aggroCd:5,turnTimer:0,turnInterval:2,biome:3,dead:false,inflated:0,born:-1});
  f.hx=f.x; f.hy=f.y; fishes.push(f);
 }
};
var oldUpdate=update;
update=function(dt){
 oldUpdate(dt); if(gameState!=='playing'||!player.alive)return;
 expedition.diet=expedition.diet.filter(function(m){return survivalTime-m.time<55;});
 for(var i=0;i<SITES.length;i++) if(!expedition.sites[i] && dist2(player.x,player.y,SITES[i].x,SITES[i].y)<240*240){
  expedition.sites[i]=true; expedition.discovered++; score+=100;
  player.hunger=Math.min(100,player.hunger+20); player.buffs.shield=Math.max(player.buffs.shield,5);
  banner('发现 '+SITES[i].name+' · +100 · 短暂庇护'); emitRipple(player.x,player.y,180); sfx(880,0.2,'sine',0.06);
 }
 var next=stageOf(player.size); if(next!==stageIdx){stageIdx=next;banner('进化 · '+STAGES[next]);}
 if(!expedition.won && expedition.discovered===5 && player.size>=58){
  expedition.won=true; score+=1500; banner('深蓝远征完成 · +1500 · 继续挑战海洋霸主');
 }
 if(score>expedition.best){expedition.best=Math.floor(score);}
 syncUI();
};
var oldDie=playerDie;
playerDie=function(reason){oldDie(reason);try{localStorage.setItem('bfish-best-v4',String(expedition.best));}catch(_){} syncUI();};
function drawOceanRelief(time){
 // Subtle distant contours live behind collision terrain, never over wildlife.
 var left=cam.x-W/(2*cam.z),top=cam.y-H/(2*cam.z);
 ctx.save();ctx.strokeStyle='rgba(165,233,237,0.045)';ctx.lineWidth=1/cam.z;
 for(var n=0;n<7;n++){
  var y=Math.floor(top/440)*440+n*440;ctx.beginPath();
  for(var x=left-100;x<left+W/cam.z+100;x+=70){var yy=y+Math.sin(x*.002+n)*55; if(x===left-100)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();
 }ctx.restore();
}
function drawExpeditionWorld(time){
 ctx.save();
 for(var i=0;i<SITES.length;i++){
  var p=SITES[i];if(Math.abs(p.x-cam.x)>W/(2*cam.z)+250||Math.abs(p.y-cam.y)>H/(2*cam.z)+250)continue;
  var done=expedition.sites[i];
  ctx.strokeStyle=p.color;ctx.globalAlpha=done?.18:.5;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(p.x,p.y+80,115,25,0,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=.8;ctx.fillStyle=p.color;
  for(var j=0;j<8;j++){var a=j*Math.PI/4+time*.15;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*80,p.y+Math.sin(a)*24,2.5,0,Math.PI*2);ctx.fill();}
  ctx.font='600 18px system-ui';ctx.textAlign='center';ctx.fillText(p.name,p.x,p.y-55);
  ctx.font='11px system-ui';ctx.globalAlpha=.65;ctx.fillText(done?'已记录 · '+p.sub:'靠近记录这片海域',p.x,p.y-32);
 }
 ctx.restore();
}
// UI is DOM-based for sharp text, keyboard access and responsive layouts.
var style=document.createElement('style');style.textContent=`
:root{color-scheme:dark}body{font-family:system-ui,"Microsoft YaHei",sans-serif}button{font:inherit;cursor:pointer}#tide-ui{position:fixed;inset:0;pointer-events:none;color:#e5f4f3}#tide-ui button{pointer-events:auto}.t-panel{background:linear-gradient(140deg,rgba(7,28,40,.91),rgba(4,20,33,.79));border:1px solid #98dece25;box-shadow:0 18px 65px #00121c55;border-radius:18px;backdrop-filter:blur(14px)}.t-top{position:absolute;left:24px;right:24px;top:22px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.t-brand{font-size:11px;letter-spacing:4px;color:#8fb9c1}.t-stats{padding:17px 20px;min-width:230px}.t-stats strong{display:block;font-size:24px;margin:5px 0}.t-small{font-size:12px;color:#97b6c1;line-height:1.9}.t-meters{width:220px;padding:16px 20px}.t-bar{height:5px;background:#ffffff13;border-radius:9px;margin:5px 0 12px;overflow:hidden}.t-bar i{display:block;height:100%;background:#71e4b7;transition:width .15s}.t-bottom{position:absolute;bottom:24px;left:24px;max-width:340px;padding:17px 20px}.t-btn{border:1px solid #b3e6dc38;background:#96e7cc15;color:#dbfff4;border-radius:10px;padding:9px 15px}.t-menu{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(90deg,#03111dda,#031c29a8)}.t-card{width:min(620px,calc(100vw - 36px));padding:42px}.t-kicker{font-size:11px;letter-spacing:5px;color:#77d8c2}.t-card h1{font-size:clamp(40px,7vw,70px);font-weight:500;letter-spacing:10px;margin:18px 0 4px}.t-card h2{font-size:24px;font-weight:400;margin:12px 0}.t-card p{color:#aac6ce;font-size:14px;line-height:2;margin:18px 0}.t-primary{background:#8ce8c7;color:#062c31;border:0;padding:14px 30px;border-radius:12px;font-weight:700}.t-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:25px 0}.t-grid div{border-top:1px solid #a9dbd126;padding-top:12px;color:#a6c5ca;font-size:12px;line-height:1.9}.t-grid b{display:block;color:#e0f0ed;font-weight:500}.t-controls{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}#t-map{position:absolute;inset:100px 12% 90px;padding:24px;background:#061a2bf2;display:none}#t-map canvas{width:100%;height:calc(100% - 50px);cursor:default}#t-dash{display:none;position:absolute;bottom:28px;right:24px;border-radius:50%;width:70px;height:70px;background:#77d8c233;color:#dfffee;border:1px solid #77d8c288;touch-action:none} @media(pointer:coarse){#t-dash{display:block}}@media(max-width:650px){.t-top{left:12px;right:12px;top:12px}.t-stats{min-width:140px;padding:12px}.t-meters{width:145px;padding:12px}.t-stats strong{font-size:19px}.t-bottom{left:12px;bottom:12px;max-width:235px;padding:12px}.t-card{padding:27px}.t-grid{gap:10px;margin:18px 0}#t-map{inset:90px 12px 100px}}`;
document.head.appendChild(style);
var ui=document.createElement('div');ui.id='tide-ui';ui.innerHTML=`
<div id="t-playing"><div class="t-top"><div class="t-panel t-stats"><div class="t-brand">T I D E S / 深蓝远征</div><strong id="t-score"></strong><div class="t-small" id="t-stage"></div><div class="t-bar"><i id="t-growth"></i></div></div><div class="t-panel t-meters"><div class="t-small">饱食 <span id="t-hunger"></span></div><div class="t-bar"><i id="t-foodbar"></i></div><div class="t-small">冲刺体力 <span id="t-energy"></span></div><div class="t-bar"><i id="t-energybar" style="background:#91caff"></i></div><div id="t-buffs" class="t-small"></div></div></div><div class="t-panel t-bottom"><div class="t-kicker">本次远征</div><div id="t-goal" class="t-small"></div><div id="t-nav" class="t-small"></div><div class="t-controls"><button class="t-btn" id="t-mapbtn">海图 Tab</button><button class="t-btn" id="t-pause">暂停</button><button class="t-btn" id="t-mute" aria-label="切换声音">声音</button></div></div><button id="t-dash" aria-label="按住冲刺">冲刺</button></div>
<div class="t-panel" id="t-map"><div style="display:flex;justify-content:space-between"><span>深蓝海图 · 五处信标</span><button class="t-btn" id="t-closemap">关闭</button></div><canvas id="t-chart"></canvas></div>
<div class="t-menu" id="t-menu"><div class="t-panel t-card"><div class="t-kicker">AN OCEAN TO BECOME</div><h1 id="t-title">潮 汐</h1><h2 id="t-subtitle">深蓝远征</h2><p id="t-description">从一尾金色鱼苗，到深海的传奇。<br>追逐鱼群，穿越翡翠礁门，记录五座失落信标。</p><div class="t-grid"><div><b>捕食，才会成长</b>绿色小鱼可吃 · 红圈大鱼危险<br>同类食物收益递减，螃蟹主要充饥</div><div><b>给每次冒险一个方向</b>记录 5 座信标，成长至体长 58<br>完成远征后可继续挑战海洋霸主</div><div><b>自由游动</b>鼠标 / WASD / 方向键<br>触屏拖动，右下角按住冲刺</div><div><b>把握节奏</b>Shift / 按住左键冲刺 · 空格暂停<br>Tab 海图 · M 静音 · R 重新开始</div></div><button class="t-primary" id="t-start">启程探索 →</button><div class="t-small" id="t-record" style="margin-top:14px"></div></div></div>`;
document.body.appendChild(ui);
function el(id){return document.getElementById(id);}
function togglePause(){if(gameState==='playing')gameState='paused';else if(gameState==='paused')gameState='playing';syncUI();}
el('t-start').onclick=function(){if(gameState==='paused')gameState='playing';else startOrRestart();syncUI();};
el('t-pause').onclick=togglePause;
el('t-mute').onclick=function(){muted=!muted;syncUI();};
function toggleMap(){expedition.map=!expedition.map;syncUI();}
el('t-mapbtn').onclick=toggleMap;el('t-closemap').onclick=toggleMap;
el('t-dash').onpointerdown=function(e){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);sprintPointer=true;};
['pointerup','pointercancel','lostpointercapture'].forEach(function(k){el('t-dash').addEventListener(k,function(){sprintPointer=false;});});
document.addEventListener('keydown',function(e){if(e.code==='Tab'){e.preventDefault();if(!e.repeat)toggleMap();}if(e.code==='Escape')togglePause();});
function syncUI(){
 var active=gameState==='playing'||gameState==='paused';el('t-playing').style.display=active?'block':'none';
 el('t-menu').style.display=gameState==='playing'?'none':'grid';
 el('t-map').style.display=active&&expedition.map?'block':'none';
 el('t-score').textContent=Math.floor(score).toLocaleString()+' / 积分';
 el('t-stage').textContent=STAGES[stageIdx]+' · 体长 '+player.size.toFixed(1)+' · '+Math.floor(survivalTime)+'s';
 el('t-growth').style.width=(clamp((player.size-10)%24/24,0,1)*100)+'%';
 el('t-hunger').textContent=Math.ceil(player.hunger);el('t-foodbar').style.width=player.hunger+'%';
 el('t-foodbar').style.background=player.hunger<30?'#ff907f':'#71e4b7';
 el('t-energy').textContent=Math.ceil(expedition.stamina);el('t-energybar').style.width=expedition.stamina+'%';
 el('t-goal').textContent=expedition.won?'远征完成 · 向海洋霸主进发':'信标 '+expedition.discovered+'/5 · 成长 '+Math.min(58,player.size).toFixed(0)+'/58';
 var nearest=-1,nd=Infinity;SITES.forEach(function(p,i){var d=dist2(player.x,player.y,p.x,p.y);if(!expedition.sites[i]&&d<nd){nd=d;nearest=i;}});
 el('t-nav').textContent=nearest<0?'五处海域均已记录': '下一站 '+SITES[nearest].name+' · '+Math.round(Math.sqrt(nd)/10)+'m';
 var names={magnet:'磁力',speed:'疾游',shield:'庇护',double:'双倍'};
 el('t-buffs').textContent=Object.keys(names).filter(function(k){return player.buffs[k]>0;}).map(function(k){return names[k]+' '+Math.ceil(player.buffs[k])+'s';}).join(' · ');
 el('t-mute').textContent=muted?'已静音':'声音开';
 el('t-title').textContent=gameState==='dead'?'归 航':gameState==='paused'?'小 憩':'潮 汐';
 el('t-subtitle').textContent=gameState==='dead'?deathReason:gameState==='paused'?'海洋在等你':'深蓝远征';
 el('t-start').textContent=gameState==='paused'?'继续远征 →':gameState==='dead'?'再次启程 →':'启程探索 →';
 el('t-record').textContent='最佳纪录 '+expedition.best.toLocaleString()+' · 已发现鱼种 '+Object.keys(expedition.species).length;
 if(expedition.map)drawChart();
}
function drawChart(){
 var c=el('t-chart'),r=c.getBoundingClientRect();if(!r.width||!r.height)return;
 c.width=Math.round(r.width*DPR);c.height=Math.round(r.height*DPR);var g=c.getContext('2d');g.scale(DPR,DPR);
 var sc=Math.min(r.width/CONF.WORLD_W,r.height/CONF.WORLD_H),ox=(r.width-CONF.WORLD_W*sc)/2,oy=(r.height-CONF.WORLD_H*sc)/2;
 g.save();g.translate(ox,oy);g.drawImage(MINIMAP_BASE,0,0,CONF.WORLD_W*sc,CONF.WORLD_H*sc);
 SITES.forEach(function(p,i){g.fillStyle=expedition.sites[i]?'#87eac6':'#ffd79b';g.beginPath();g.arc(p.x*sc,p.y*sc,5,0,Math.PI*2);g.fill();g.font='11px system-ui';g.fillText(p.name,p.x*sc+9,p.y*sc-6);});
 g.fillStyle='#fff';g.beginPath();g.arc(player.x*sc,player.y*sc,4,0,Math.PI*2);g.fill();g.restore();
}
var legacyHUD=drawHUD;
drawHUD=function(time){
 // Keep the existing minimap and transient warnings; panels have moved to DOM.
 ctx.save();var mw=MINIMAP_BASE.width,mh=MINIMAP_BASE.height;
 if(W>650){var x=W-mw-24,y=H-mh-24;ctx.globalAlpha=.8;ctx.drawImage(MINIMAP_BASE,x,y);ctx.globalAlpha=1;ctx.fillStyle='#ffe29b';ctx.beginPath();ctx.arc(x+player.x/CONF.WORLD_W*mw,y+player.y/CONF.WORLD_H*mh,4,0,Math.PI*2);ctx.fill();}
 if(bannerTimer>0){ctx.textAlign='center';ctx.font='600 14px system-ui';ctx.fillStyle='#d8fff1';ctx.fillText(bannerText,W/2,H-30);}
 ctx.restore();
};
drawStartScreen=function(){};drawPauseOverlay=function(){};drawDeathScreen=function(){};
var oldRender=render;
render=function(time){oldRender(time);syncUI();};
// Readable prey affordance, drawn behind the fish rather than over its silhouette.
var baseFishDraw=drawFishSprite;
drawFishSprite=function(f,x,y,s,a,t,inflated,isPlayer,time){
 if(!isPlayer && player.alive && s<player.size*CONF.EAT_RATIO && dist2(x,y,player.x,player.y)<650*650){ctx.save();ctx.strokeStyle='rgba(131,242,192,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,s*1.6+5,s*.9+5,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 baseFishDraw(f,x,y,s,a,t,inflated,isPlayer,time);
};
// Rich reef dressing uses the very same SDF surface as collision.
var v4Bake=bakeBackgrounds;
bakeBackgrounds=function(){
 v4Bake();
 var reefs=[{x:13200,y:8120,r:140},{x:14150,y:8160,r:180},{x:13250,y:7120,r:130},{x:14380,y:7380,r:110},
 {x:12720,y:6940,r:155},{x:12980,y:9180,r:175},{x:15380,y:7540,r:180},{x:15760,y:9180,r:160}];
 reefs.forEach(function(p,i){
  var rk={ax:p.x,ay:p.y,blobs:[-p.r*.65,20,p.r, p.r*.65,0,p.r*.8],caves:[],k:50,glow:false,z:i%2?1:3,spr:null};
  rkBake(rk);rk.hang=false;RK_list.push(rk);
 });
 // Flora roots are found against actual solid terrain; no floating decorations.
 RK_list.forEach(function(rk,ri){
  if(rk.ay>11000)return;
  for(var j=0;j<7;j++){
   var x=rk.wx0+40+(rk.wx1-rk.wx0-80)*(j+.5)/7,y=rk.wy0;
   while(y<rk.wy1 && rkField(rk,x-rk.ax,y-rk.ay)>-3)y+=3;
   if(y>=rk.wy1)continue;
   WORLD_DECORS.push({x:x,y:y+4,z:ri%2?1:3,spr:j%DECOR[ri%2?1:3].length,s:.35+(j%3)*.17,ph:j+ri});
  }
 });
 if(MINIMAP_BASE){var g=MINIMAP_BASE.getContext('2d'),sc=MINIMAP_BASE.width/CONF.WORLD_W;
  RK_list.forEach(function(rk){g.fillStyle='#548c96';g.fillRect(rk.wx0*sc,rk.wy0*sc,Math.max(2,(rk.wx1-rk.wx0)*sc),Math.max(2,(rk.wy1-rk.wy0)*sc));});
 }
};
window.addEventListener('pagehide',function(){try{localStorage.setItem('bfish-best-v4',String(expedition.best));}catch(_){}});
// Avoid rewriting every DOM node at the rendering refresh rate.
var fullSync=syncUI,lastUISync=-100;
syncUI=function(){var now=performance.now();if(now-lastUISync<100)return;lastUISync=now;fullSync();};
var responsiveStyle=document.createElement('style');responsiveStyle.textContent=`.t-menu{pointer-events:auto}.t-card{max-height:calc(100dvh - 24px);overflow:auto}#t-menu[style*="none"]{pointer-events:none}@media(max-height:650px){.t-card{padding:22px 30px}.t-card h1{font-size:38px;margin:8px 0}.t-card p{margin:8px 0}.t-grid{margin:12px 0;gap:10px}.t-grid div{padding-top:7px}}`;
document.head.appendChild(responsiveStyle);

