/* Regional food webs retain sparse small prey at depth instead of enlarging every spawn. */
var NEW_OCEAN_SPECIES=[];
function oceanSpecies(name,min,max,speed,shape,ry,colors,pat,regions,extra){var sp=Object.assign({n:name,sMin:min,sMax:max,spd:speed,shape:shape,ry:ry,c1:colors[0],c2:colors[1],c3:colors[2],pat:pat,tail:'fork',bio:[1,1,1,1],nativeSize:true,deepNative:regions.some(function(r){return r>=3;}),ecoRegions:regions},extra||{});SPECIES.push(sp);NEW_OCEAN_SPECIES.push(sp);return sp;}
var anchovySpec=oceanSpecies('银纹鳀鱼',6,11,88,'slim',.3,['#6398b2','#e0f4ec','#295979'],'lat',[0,2]);
var sardineSpec=oceanSpecies('青背沙丁鱼',11,18,91,'slim',.38,['#4d9b9e','#d5ece1','#316375'],'line',[0,2]);
var mackerelSpec=oceanSpecies('竹荚鱼',22,36,115,'slim',.38,['#75aaa5','#e0e6c8','#396d72'],'band',[2,3]);
var polarCodSpec=oceanSpecies('北极鳕鱼',16,30,66,'oval',.42,['#b1c5c6','#edf0dc','#718e9c'],'spots',[1]);
var pineconeSpec=oceanSpecies('红松球鱼',22,35,55,'tall',.67,['#d38a70','#f1d0a4','#914a50'],'spots',[2,3]);
var hatchetSpec=oceanSpecies('银斧鱼',12,22,68,'tall',.8,['#7ca6b3','#e6f1df','#3f627d'],'line',[3,5]);
var lanternSpec=oceanSpecies('深水灯笼鱼',9,17,77,'slim',.4,['#49798b','#a7c1bd','#233e5d'],'spots',[3,5],{luminous:true});
var fangSpec=oceanSpecies('尖牙鱼',28,46,106,'slim',.48,['#625a6a','#b4a5a2','#342f48'],'spots',[5],{aggr:.5});
var blackscaleSpec=oceanSpecies('黑棘鳞鱼',44,72,105,'oval',.52,['#4e6d86','#a0bbc4','#293e61'],'band',[4,5],{aggr:.4});
var penguinSpec=oceanSpecies('冰海企鹅',34,50,108,'penguin',.43,['#243b4e','#f0e9d3','#1c2d3c'],'none',[1],{penguin:true,passive:true});
FISH_MEAL_PROFILES['银纹鳀鱼']=[.7,.8];FISH_MEAL_PROFILES['青背沙丁鱼']=[.9,.95];FISH_MEAL_PROFILES['竹荚鱼']=[1.05,1.1];FISH_MEAL_PROFILES['北极鳕鱼']=[1.1,1.05];FISH_MEAL_PROFILES['红松球鱼']=[1,1.2];FISH_MEAL_PROFILES['银斧鱼']=[.9,1.15];FISH_MEAL_PROFILES['深水灯笼鱼']=[.8,1];FISH_MEAL_PROFILES['尖牙鱼']=[1.1,1.25];FISH_MEAL_PROFILES['黑棘鳞鱼']=[1.2,1.3];FISH_MEAL_PROFILES['冰海企鹅']=[1.15,1.15];
var WEB_POOLS=[[anchovySpec,anchovySpec,sardineSpec],[polarCodSpec,polarCodSpec,penguinSpec],[anchovySpec,sardineSpec,mackerelSpec,pineconeSpec,cuttleSpec],[hatchetSpec,lanternSpec,mackerelSpec,pineconeSpec,cuttleSpec],[blackscaleSpec],[lanternSpec,hatchetSpec,fangSpec,fangSpec,blackscaleSpec]];
var chooseBeforeWeb=chooseHabitatSpecies;chooseHabitatSpecies=function(x,y,small){
 var region=oceanRegion(x,y),prob=[.3,.42,.4,.42,.17,.33][region];
 if(Math.random()<prob){var pool=WEB_POOLS[region],sp=pool[Math.floor(Math.random()*pool.length)];if(sp.penguin&&(y>2600||y<160))sp=polarCodSpec;if(region===4&&dist2(x,y,VOLCANO.x,VOLCANO.y)<1700*1700)return chooseBeforeWeb(x,y,small);if(sp.cuttle&&(y<4200||y>10500))sp=mackerelSpec;return sp;}
 return chooseBeforeWeb(x,y,small);
};
var initBeforeWeb=initHabitatFish;initHabitatFish=function(f,sp,x,y,size){initBeforeWeb(f,sp,x,y,size);f.lastPlayerEncounter=-100;if(sp.nativeSize)f.size=clamp(size,sp.sMin,sp.sMax);if(sp.penguin){f.ecologyBand=0;f.flightCooldown=999;f.y=clamp(f.y,180,2400);f.hy=f.y;}return f;};
var steeringBeforeWeb=ecologySteering;ecologySteering=function(f,x,y){if(f.spec.penguin){if(f.y<180&&y<0)y=Math.abs(y)+.5;if(f.y>2550&&y>0)y=-Math.abs(y)-.5;if(f.x<19700&&x<0)x=Math.abs(x)+.5;var len=Math.hypot(x,y)||1;return {x:x/len,y:y/len};}return steeringBeforeWeb(f,x,y);};
var drawingBeforeWeb=drawFishSprite;drawFishSprite=function(f,x,y,s,a,t,inflate,isPlayer,time){
 if(!isPlayer&&f.spec.penguin){
  if(ctx.canvas===canvas&&canHighlightPrey(f)&&(gameState==='playing'||gameState==='paused'))drawPreyMarker(x,y,s*1.7+6,s+5,a,0);
  ctx.save();ctx.translate(x,y);ctx.rotate(a);if(Math.cos(a)<0)ctx.scale(1,-1);var g=ctx;g.fillStyle='#233a4a';g.strokeStyle='#9db8ba';g.lineWidth=s*.018;g.beginPath();g.ellipse(-s*.2,0,s*1.05,s*.48,0,0,Math.PI*2);g.fill();g.stroke();g.fillStyle='#e5e8d9';g.beginPath();g.ellipse(s*.02,s*.17,s*.76,s*.27,-.08,0,Math.PI*2);g.fill();g.fillStyle='#233a4a';g.beginPath();g.ellipse(s*.76,-s*.04,s*.38,s*.33,.1,0,Math.PI*2);g.fill();g.fillStyle='#e8e4c7';g.beginPath();g.ellipse(s*.87,s*.06,s*.21,s*.15,-.4,0,Math.PI*2);g.fill();g.fillStyle='#d39e69';g.beginPath();g.moveTo(s*1.02,-s*.01);g.lineTo(s*1.36,s*.06);g.lineTo(s*1.03,s*.13);g.closePath();g.fill();g.fillStyle='#101f2a';g.beginPath();g.arc(s*.87,-s*.13,s*.04,0,Math.PI*2);g.fill();g.fillStyle='#eaf2df';g.beginPath();g.arc(s*.88,-s*.14,s*.013,0,Math.PI*2);g.fill();g.fillStyle='#355365';var flap=Math.sin(t)*.35;g.beginPath();g.moveTo(s*.05,s*.11);g.quadraticCurveTo(-s*.2,s*(1+flap),-s*.78,s*(.75+flap));g.quadraticCurveTo(-s*.4,s*.35,-s*.15,s*.1);g.closePath();g.fill();g.fillStyle='#ad8363';for(var i=0;i<2;i++){g.beginPath();g.moveTo(-s*.98,s*(.05+i*.12));g.lineTo(-s*1.37,s*(.02+i*.2));g.lineTo(-s*1.16,s*(.18+i*.15));g.closePath();g.fill();}ctx.restore();return;
 }
 drawingBeforeWeb(f,x,y,s,a,t,inflate,isPlayer,time);
 if(!isPlayer&&f.spec.luminous){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#b2f9e0';for(var i=0;i<5;i++){ctx.beginPath();ctx.arc((-s*.5+i*s*.19),s*.19,Math.max(.7,s*.025),0,Math.PI*2);ctx.fill();}ctx.restore();}
};
// Cover both sides of the moving wave: WATER starts at y=0, while wave crests can rise above it.
var surfaceBeforeWeb=SF_draw;SF_draw=function(time){
 var left=cam.x-W/(2*cam.z)-100,right=cam.x+W/(2*cam.z)+100,top=cam.y-H/(2*cam.z)-100;
 if(top<90){ctx.save();var sky=ctx.createLinearGradient(0,Math.min(top,-600),0,20);sky.addColorStop(0,'#497eaa');sky.addColorStop(.6,'#9fcad5');sky.addColorStop(1,'#d6e6d7');ctx.fillStyle=sky;ctx.fillRect(left,top,right-left,Math.max(0,40-top));var water=ctx.createLinearGradient(0,-38,0,95);water.addColorStop(0,'#4f91a7');water.addColorStop(.3,'#4b94a8');water.addColorStop(1,'rgba(73,148,169,0)');ctx.fillStyle=water;ctx.fillRect(left,-38,right-left,133);ctx.restore();}
 surfaceBeforeWeb(time);

};
var webGuide=buildGuideEntries;buildGuideEntries=function(){var entries=webGuide();entries.forEach(function(e){if(!e.spec)return;var sp=e.spec;if(sp.ecoRegions){e.lines[0]='体长 '+sp.sMin+'–'+sp.sMax+' · '+sp.ecoRegions.map(function(r){return REGIONS[r].name;}).join(' / ');if(sp.penguin)e.lines[3]='冰盖附近潜水觅食 · 中型、温顺、游速灵活';if(sp.luminous)e.lines[3]='稀疏深水小鱼 · 腹部发光器';}if(sp.n==='海鳗')e.lines[1]='预警 1.15 秒 · 直线短扑，不连续追踪';});return entries;};
// Swimming rhythm follows body size and actual movement, rather than raw velocity * .12.
var depthBeforeRhythm=fishDepthSpeed;fishDepthSpeed=function(f){return depthBeforeRhythm(f)*clamp(1-Math.max(0,f.size-70)*.002,.65,1);};
function swimPhaseSpeed(size,speed){return (size<20?5.2:size<50?3.6:2.5)/(1+Math.max(0,size-40)*.006)+Math.min(3,speed/110);}
var updateBeforeRhythm=updateFish;updateFish=function(f,dt){
 var phase=f.tailPhase||0,x=f.x,y=f.y;updateBeforeRhythm(f,dt);if(f.dead)return;
 var dx=f.x-x,dy=f.y-y,speed=dt>0?Math.hypot(dx,dy)/dt:Math.hypot(f.vx,f.vy);
 f.tailPhase=phase+dt*swimPhaseSpeed(f.size,speed);
 if(speed>10&&Math.hypot(dx,dy)>.02&&!(f.morayDen&&(f.morayState==='wait'||f.morayState==='warning')))f.angle=Math.atan2(dy,dx);
};
var updatePlayerRhythm=update;update=function(dt){var phase=player.tailPhase||0,px=player.x,py=player.y;updatePlayerRhythm(dt);if(gameState!=='playing'||!player.alive)return;var speed=Math.hypot(player.vx,player.vy);player.tailPhase=phase+dt*swimPhaseSpeed(player.size,speed);if(speed>10&&Math.hypot(player.x-px,player.y-py)>.02)player.angle=Math.atan2(player.y-py,player.x-px);};

var webBody=bakeFishBody;bakeFishBody=function(g,sp,R){webBody(g,sp,R);if(sp===fangSpec){g.fillStyle='#162433';g.beginPath();g.moveTo(R*.68,-R*.03);g.lineTo(R*1.13,R*.06);g.lineTo(R*.7,R*.29);g.closePath();g.fill();g.fillStyle='#d7e6d6';for(var i=0;i<4;i++){var x=R*(.72+i*.09);g.beginPath();g.moveTo(x,R*.01);g.lineTo(x+R*.015,R*(i%2?.25:.18));g.lineTo(x+R*.04,R*.03);g.fill();}}else if(sp===polarCodSpec){g.fillStyle=sp.c3;for(var i=0;i<2;i++){g.beginPath();g.moveTo(R*(-.7+i*.45),-R*.25);g.quadraticCurveTo(R*(-.62+i*.45),-R*.61,R*(-.42+i*.45),-R*.29);g.fill();}}else if(sp===hatchetSpec){g.fillStyle='#a4c9d0aa';g.beginPath();g.moveTo(-R*.5,R*.2);g.lineTo(-R*.24,R*.98);g.quadraticCurveTo(R*.6,R*.9,R*.7,R*.2);g.closePath();g.fill();g.strokeStyle='#d8efe9';g.lineWidth=R*.02;g.stroke();}};
function ecologyPopulationTarget(x,y){var target=y<3200?136:y<6900?Math.round(100-(y-3200)/3700*20):y<10600?Math.round(64-(y-6900)/3700*16):Math.round(38-(y-10600)/5200*10),region=oceanRegion(x,y);if(region===1)target*=.78;if(region===4)target*=.78;if(window.MOBILE_INPUT&&MOBILE_INPUT.enabled)target*=.85;return Math.round(clamp(target,22,136));}
populationUpdate=function(dt){spawnTimerAcc+=dt;if(spawnTimerAcc<.4)return;spawnTimerAcc=0;var target=ecologyPopulationTarget(player.x,player.y),near=0;for(var i=0;i<fishes.length;i++)if(!fishes[i].dead&&dist2(fishes[i].x,fishes[i].y,player.x,player.y)<3000*3000)near++;
 if(near<target&&fishes.length<195){spawnFish();if(near<target-8&&fishes.length<195)spawnFish();}
 else if(near>target+18){var budget=Math.min(3,near-target-12);for(var i=fishes.length-1;i>=0&&budget>0;i--){var f=fishes[i];if(f.dead||f.spec.rareDugong||f.spec.leviathan||dist2(f.x,f.y,player.x,player.y)<1100*1100)continue;if(canRecycleFish(f)){f.dead=true;budget--;}}}
};
var drawBeforeTailWeight=drawFishSprite;drawFishSprite=function(f,x,y,s,a,t,inflate,isPlayer,time){var sprite=isPlayer?SP.player:f.spec.spr;if(!sprite){drawBeforeTailWeight(f,x,y,s,a,t,inflate,isPlayer,time);return;}var previous=sprite.tailAmp;sprite.tailAmp=previous*clamp(1-Math.max(0,s-35)*.003,.52,1);try{drawBeforeTailWeight(f,x,y,s,a,t,inflate,isPlayer,time);}finally{sprite.tailAmp=previous;}};

function fishRetentionRadius(){return Math.max(4800,Math.hypot(W,H)/(2*Math.max(.3,cam.z))+2000);}
function canRecycleFish(f){if(!f||f.dead)return false;var radius=fishRetentionRadius();if(dist2(f.x,f.y,player.x,player.y)<=radius*radius)return false;if(Math.abs(f.x-cam.x)<W/(2*cam.z)+1600&&Math.abs(f.y-cam.y)<H/(2*cam.z)+1600)return false;if(survivalTime-(f.lastPlayerEncounter===undefined?-100:f.lastPlayerEncounter)<20)return false;return true;}
// Ice must not inherit either baked rock flora or separately streamed reef vegetation.
function plantTouchesIce(p){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.y>2200||p.x<17200)return false;for(var i=0;i<RK_list.length;i++){var r=RK_list[i];if(!r.ice||p.x<r.wx0-100||p.x>r.wx1+100||p.y<r.wy0-100||p.y>r.wy1+100)continue;if(rkField(r,p.x-r.ax,p.y-r.ay)<100)return true;}return false;}
var bakeBeforeIcePlants=bakeBackgrounds;bakeBackgrounds=function(){bakeBeforeIcePlants();WORLD_DECORS=WORLD_DECORS.filter(function(p){return !plantTouchesIce(p);});if(window.SHALLOW_SCENERY){SHALLOW_SCENERY.plants=SHALLOW_SCENERY.plants.filter(function(p){return !plantTouchesIce(p);});SHALLOW_SCENERY.chunks.clear();SHALLOW_SCENERY.plants.forEach(function(p){var key=Math.floor(p.x/1024);if(!SHALLOW_SCENERY.chunks.has(key))SHALLOW_SCENERY.chunks.set(key,[]);SHALLOW_SCENERY.chunks.get(key).push(p);});}if(Array.isArray(VKELP))VKELP=VKELP.filter(function(p){return !plantTouchesIce(p);});if(Array.isArray(SARG))SARG=SARG.filter(function(p){return !plantTouchesIce(p);});buildDecorChunks();};
