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
bakeBackgrounds=async function(){
 var nativeRandom=Math.random, seed=972113;
 Math.random=function(){seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
 try {await baseBake();} finally {Math.random=nativeRandom;}
 // Remove painted, non-collidable caves; actual carved SDF caves are retained.
 WORLD_CAVES=[];
 if(window.CUSTOM_MAP)return;
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
 if(!expedition.won && expedition.discovered===5 && player.size>=(window.EXPEDITION_TARGET||58)){
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
<div class="t-menu" id="t-menu"><div class="t-panel t-card"><div class="t-kicker">AN OCEAN TO BECOME</div><h1 id="t-title">潮 汐</h1><h2 id="t-subtitle">深蓝远征</h2><p id="t-description">从一尾金色鱼苗，到深海的传奇。<br>追逐鱼群，穿越翡翠礁门，记录五座失落信标。</p><div class="t-grid"><div><b>捕食，才会成长</b>绿色小鱼可吃 · 红圈大鱼危险<br>同类食物收益递减，螃蟹主要充饥</div><div><b>给每次冒险一个方向</b>记录 5 座信标，成长至体长 58<br>完成远征后可继续挑战海洋霸主</div><div><b>自由游动</b>鼠标 / WASD / 方向键<br>手机：左侧摇杆，右侧按住冲刺</div><div><b>把握节奏</b>Shift / 按住左键冲刺 · 空格暂停<br>Tab 海图 · M 静音 · R 重新开始</div></div><button class="t-primary" id="t-start">启程探索 →</button><div class="t-small" id="t-record" style="margin-top:14px"></div></div></div>`;
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
 if(W>650 && !(window.MOBILE_INPUT && MOBILE_INPUT.enabled)){var x=W-mw-24,y=H-mh-24;ctx.globalAlpha=.8;ctx.drawImage(MINIMAP_BASE,x,y);ctx.globalAlpha=1;ctx.fillStyle='#ffe29b';ctx.beginPath();ctx.arc(x+player.x/CONF.WORLD_W*mw,y+player.y/CONF.WORLD_H*mh,4,0,Math.PI*2);ctx.fill();}
 if(bannerTimer>0){ctx.textAlign='center';ctx.font='600 14px system-ui';ctx.fillStyle='#d8fff1';ctx.fillText(bannerText,W/2,H-30);}
 ctx.restore();
};
drawStartScreen=function(){};drawPauseOverlay=function(){};drawDeathScreen=function(){};
var oldRender=render;
render=function(time){oldRender(time);syncUI();};
// Readable prey affordance, drawn behind the fish rather than over its silhouette.
var baseFishDraw=drawFishSprite;
drawFishSprite=function(f,x,y,s,a,t,inflated,isPlayer,time){
 baseFishDraw(f,x,y,s,a,t,inflated,isPlayer,time);
};
// Rich reef dressing uses the very same SDF surface as collision.
var v4Bake=bakeBackgrounds;
bakeBackgrounds=async function(){await v4Bake();await bootYield();
 if(window.CUSTOM_MAP)return;
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

// V4.1: persistent shrimp steering and an inhabited sunlit reef belt.
function swimShrimp(f, dt){
 if(!Number.isFinite(f.swimAngle)){f.swimAngle=f.dir<0?Math.PI:0;f.swimTarget=f.swimAngle;f.swimTurn=5;f.swimBlocked=0;}
 f.swimTurn-=dt;f.swimBlocked=Math.max(0,f.swimBlocked-dt);
 var fleeing=player.alive && dist2(f.x,f.y,player.x,player.y)<145*145;
 if(fleeing){f.swimTarget=Math.atan2(f.y-player.y,f.x-player.x);f.swimTurn=Math.max(f.swimTurn,1.2);}
 else if(f.swimTurn<=0){f.swimTarget=f.swimAngle+rand(-.65,.65);f.swimTurn=rand(4,8);}
 var aheadX=f.x+Math.cos(f.swimTarget)*45,aheadY=f.y+Math.sin(f.swimTarget)*45;
 if(aheadX<100 || aheadX>CONF.WORLD_W-100){f.swimTarget=Math.atan2(Math.sin(f.swimTarget),-Math.cos(f.swimTarget));f.swimTurn=3;}
 if(aheadY<65 || aheadY>floorAt(clamp(aheadX,0,CONF.WORLD_W))-18){f.swimTarget=Math.atan2(-Math.sin(f.swimTarget),Math.cos(f.swimTarget));f.swimTurn=3;}
 if(f.swimBlocked<=0 && rkInside(aheadX,aheadY,12)){
  // Choose a clear tangent and hold it, rather than reverse on every frame.
  var turn=f.swimAngle+Math.PI*.6;
  if(rkInside(f.x+Math.cos(turn)*65,f.y+Math.sin(turn)*65,12))turn=f.swimAngle-Math.PI*.6;
  f.swimTarget=turn;f.swimBlocked=1.4;f.swimTurn=3;
 }
 f.swimAngle=lerpAngle(f.swimAngle,f.swimTarget,Math.min(1,dt*(fleeing?5:2.2)));
 var speed=fleeing?83:32+Math.sin(f.t*2+f.seed)*5;
 f.x=clamp(f.x+Math.cos(f.swimAngle)*speed*dt,90,CONF.WORLD_W-90);
 f.y=clamp(f.y+Math.sin(f.swimAngle)*speed*dt,55,floorAt(f.x)-16);
 f.dir=Math.cos(f.swimAngle)<0?-1:1;
}
var shallowReefs=[];
var bakeBeforeShallows=bakeBackgrounds;
bakeBackgrounds=async function(){await bakeBeforeShallows();await bootYield();shallowReefs=[];
 if(window.CUSTOM_MAP)return;
 // Staggered islands leave wide open channels and an uninterrupted surface lane.
 for(var i=0;i<48;i++){
  var col=i%24, satellite=i>=24;
  var x=650+col*1115+(satellite?480:0);
  var y=satellite?450+(col%2)*850:680+(col%3)*410+Math.sin(col*1.7)*90;
  var r=satellite?55+(col%3)*12:82+(col%4)*18;
  var rock={ax:x,ay:y,blobs:[-r*.8,15,r,0,-r*.28,r*.82,r*.85,20,r*.72],caves:[],k:35,glow:false,z:i%3===0?1:0,spr:null};
  rkBake(rock);rock.hang=false;RK_list.push(rock);shallowReefs.push(rock);
  for(var j=0;j<9;j++){
   var fx=rock.wx0+25+(rock.w-50)*(j+.5)/9,fy=rock.wy0;
   while(fy<rock.wy1 && rkField(rock,fx-rock.ax,fy-rock.ay)>-2)fy+=2;
   if(fy>=rock.wy1)continue;
   var biome=j%3===0?1:0;
   WORLD_DECORS.push({x:fx,y:fy+3,z:biome,spr:(i+j)%DECOR[biome].length,s:.25+(j%4)*.11,ph:i+j*.8});
  }
 }
 // Bake real silhouettes into the navigation chart instead of rectangular placeholders.
 var g=MINIMAP_BASE.getContext('2d'),sc=MINIMAP_BASE.width/CONF.WORLD_W;
 shallowReefs.forEach(function(r){g.drawImage(r.spr,r.wx0*sc,r.wy0*sc,r.w*sc,r.h*sc);});
};
function spawnShallowSchool(){
 if(fishes.length>=196)return;
 var halfW=W/(2*cam.z),halfH=H/(2*cam.z),a=rand(0,Math.PI*2);
 var distance=Math.hypot(halfW,halfH)+170;
 var sx=clamp(player.x+Math.cos(a)*distance,200,CONF.WORLD_W-200);
 var sy=clamp(player.y+Math.sin(a)*distance*.45,220,1850);
 // At the surface choose a side entrance instead of clamping a visible spawn.
 if(Math.abs(sx-cam.x)<halfW+120 && Math.abs(sy-cam.y)<halfH+120){
  sx=player.x+(player.x>CONF.WORLD_W-2200?-1:1)*(halfW+220);
 }
 sx=clamp(sx,200,CONF.WORLD_W-200);
 var direction=sx>player.x?Math.PI:0,spIdx=Math.floor(rand(0,5)),sp=SPECIES[spIdx];
 for(var i=0;i<6 && fishes.length<196;i++){
  var x=clamp(sx+rand(-65,65),160,CONF.WORLD_W-160),y=clamp(sy+rand(-65,65),100,2000);
  if(rkInside(x,y,30))continue;
  if(Math.abs(x-cam.x)<halfW+70 && Math.abs(y-cam.y)<halfH+70)continue;
  var f=fishPool.length?fishPool.pop():newFish();
  Object.assign(f,{specIdx:spIdx,spec:sp,size:rand(sp.sMin,sp.sMax),x:x,y:y,hx:x,hy:y,vx:Math.cos(direction)*sp.spd*.7,vy:0,angle:direction,wanderA:direction,tailPhase:rand(0,6.28),hunger:65,state:'wander',fleeTimer:0,lungeT:0,huntT:0,huntCd:8,aggroTimer:0,aggroCd:5,turnTimer:0,turnInterval:rand(3,5),biome:0,dead:false,inflated:0,born:survivalTime});
  fishes.push(f);
 }
}
var shallowTimer=0,updateBeforeShallows=update;
update=function(dt){
 updateBeforeShallows(dt);if(gameState!=='playing'||!player.alive)return;
 shallowTimer+=dt;if(shallowTimer<1.2)return;shallowTimer=0;
 if(player.y>2200)return;
 var small=0;for(var i=0;i<fishes.length;i++){
  var f=fishes[i];if(!f.dead && f.size<24 && f.y<2400 && dist2(f.x,f.y,player.x,player.y)<1900*1900)small++;
 }
 if(small<32)spawnShallowSchool();
};
var resetBeforeShallows=resetGame;
resetGame=function(){shallowTimer=0;resetBeforeShallows();};
// Fine suspended particles drift through the sunlit water behind all solid objects.
var reliefBeforeShallows=drawOceanRelief;
drawOceanRelief=function(time){
 reliefBeforeShallows(time);if(cam.y-H/(2*cam.z)>2300)return;
 ctx.save();
 var left=cam.x-W/(2*cam.z)-100,right=cam.x+W/(2*cam.z)+100;
 var top=Math.max(90,cam.y-H/(2*cam.z)-40),bottom=Math.min(2200,cam.y+H/(2*cam.z)+40);
 ctx.fillStyle='#b8f5d6';
 for(var col=Math.floor(left/140);col<=Math.ceil(right/140);col++)for(var row=Math.floor(top/180);row<=Math.ceil(bottom/180);row++){
  var phase=col*2.13+row*3.72,x=col*140+Math.sin(phase+time*.11)*24,y=row*180+Math.cos(phase+time*.17)*28;
  ctx.globalAlpha=.08+.1*(.5+.5*Math.sin(time*.5+phase));ctx.beginPath();ctx.arc(x,y,1.2+(row%2)*.6,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
};
function shrimpSurface(reef,x){
 if(!reef)return floorAt(x);
 if(x<reef.wx0+10||x>reef.wx1-10)return null;
 var y=reef.wy0;
 while(y<reef.wy1 && rkField(reef,x-reef.ax,y-reef.ay)>0)y+=6;
 if(y>=reef.wy1)return null;
 return y;
}
function chooseShrimpHabitat(){
 var nearby=[];
 for(var i=0;i<RK_list.length;i++){
  var r=RK_list[i];if(dist2(r.ax,r.ay,player.x,player.y)<2100*2100)nearby.push(r);
 }
 for(i=0;i<14;i++){
  var reef=nearby.length?nearby[Math.floor(rand(0,nearby.length))]:null;
  var x=reef?rand(reef.wx0+35,reef.wx1-35):clamp(player.x+rand(-1000,1000),180,CONF.WORLD_W-180);
  var surface=shrimpSurface(reef,x);if(surface===null)continue;
  var y=surface-rand(25,55);
  if(dist2(x,y,player.x,player.y)>2100*2100||rkInside(x,y,14))continue;
  // Normal respawns enter outside the viewport; opening habitat is populated on reset.
  if(survivalTime>1 && Math.abs(x-cam.x)<W/(2*cam.z)+40 && Math.abs(y-cam.y)<H/(2*cam.z)+40)continue;
  return {x:x,y:y,reef:reef};
 }
 return null;
}
var swimBeforeHabitat=swimShrimp;
swimShrimp=function(f,dt){
 var reef=f.shrimpReef;
 if(!reef){swimBeforeHabitat(f,dt);var floor=floorAt(f.x);f.y=lerp(f.y,floor-34,Math.min(1,dt*4));return;}
 if(!f.travelDir){f.travelDir=f.dir||1;f.directionHold=0;f.habitatTurn=rand(5,9);}
 f.directionHold=Math.max(0,f.directionHold-dt);f.habitatTurn-=dt;
 var left=reef.wx0+30,right=reef.wx1-30;
 var fleeing=player.alive&&dist2(f.x,f.y,player.x,player.y)<145*145;
 if(f.directionHold<=0){
  var desired=f.travelDir;
  if(f.x<left+30&&desired<0)desired=1;
  else if(f.x>right-30&&desired>0)desired=-1;
  else if(fleeing&&Math.abs(f.x-player.x)>25)desired=f.x>player.x?1:-1;
  else if(f.habitatTurn<=0){desired=-desired;f.habitatTurn=rand(5,9);}
  if(desired!==f.travelDir){f.travelDir=desired;f.directionHold=1.5;}
 }
 var speed=fleeing?70:31+Math.sin(f.t*2+f.seed)*4;
 var nextX=clamp(f.x+f.travelDir*speed*dt,left,right);
 var surface=shrimpSurface(reef,nextX,f.shrimpFloorY);
 if(surface===null){f.travelDir=-f.travelDir;f.directionHold=1.5;return;}
 f.shrimpFloorY=surface;
 var target=surface-34-Math.sin(f.t*1.2+f.seed)*7;
 var slope=clamp((target-f.y)/40,-.45,.45);
 var heading=f.travelDir>0?slope:Math.PI-slope;
 f.swimAngle=lerpAngle(f.swimAngle,heading,Math.min(1,dt*4));f.swimTarget=heading;
 f.x=nextX;f.y=lerp(f.y,target,Math.min(1,dt*5));f.y=Math.min(f.y,surface-16);f.dir=f.travelDir;
};
var spritesBeforeShrimp=bakeAllSprites;
bakeAllSprites=function(){
 spritesBeforeShrimp();
 var c=newCanvas(160,96),g=c.getContext('2d');
 g.scale(4,4);g.lineCap='round';g.lineJoin='round';
 // Right-facing shrimp: a curved, articulated abdomen, clear limbs and antennae.
 g.strokeStyle='#efae91';g.lineWidth=.6;
 for(var i=0;i<5;i++){
  g.beginPath();g.moveTo(15+i*1.6,14);g.quadraticCurveTo(14+i*1.6,18,17+i*1.6,19+i*.4);g.stroke();
 }
 g.strokeStyle='#ffceb0';g.lineWidth=.55;
 g.beginPath();g.moveTo(25,10);g.bezierCurveTo(30,5,35,3,39,4);g.moveTo(26,11);g.bezierCurveTo(31,8,36,8,39,10);g.stroke();
 var gradient=g.createLinearGradient(10,6,22,17);gradient.addColorStop(0,'#ffe5b6');gradient.addColorStop(.45,'#f69d80');gradient.addColorStop(1,'#c95c66');
 g.fillStyle=gradient;
 g.beginPath();g.moveTo(25,8);g.quadraticCurveTo(27,12,24,14);g.quadraticCurveTo(20,16,15,15);g.quadraticCurveTo(9,14,9,9);g.quadraticCurveTo(9,6,12,6);g.quadraticCurveTo(11,11,16,11);g.quadraticCurveTo(21,9,25,8);g.fill();
 g.strokeStyle='#a84d57';g.lineWidth=.45;
 for(i=0;i<5;i++){g.beginPath();g.moveTo(13+i*2.1,10.7-i*.35);g.quadraticCurveTo(14+i*2.1,13,14+i*2.1,14.6);g.stroke();}
 g.fillStyle='#f5b390';g.beginPath();g.moveTo(10,8);g.lineTo(5,5);g.lineTo(6,10);g.lineTo(3,12);g.lineTo(10,12);g.fill();
 g.fillStyle='#ffdab0';g.beginPath();g.moveTo(25,9);g.lineTo(30,8);g.lineTo(26,11);g.fill();
 g.fillStyle='#1e2831';g.beginPath();g.arc(25.2,9,1,0,Math.PI*2);g.fill();g.fillStyle='#fff7e6';g.beginPath();g.arc(25.4,8.7,.3,0,Math.PI*2);g.fill();
 SP.shrimp=c;
};
