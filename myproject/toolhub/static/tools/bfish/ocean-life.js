/* V6.9: ecological habitats, one-shot ink defence and earned field-guide records. */
var ICE_CRAB_MIN=36,ICE_CRAB_DAMAGE=18;
function chooseIceCrabHabitat(){
 for(var i=0;i<36;i++){var x=clamp(player.x+rand(-1800,1800),19750,26900),probe=clamp(player.y+rand(-500,500),450,6200);if(oceanRegion(x,probe)!==1||rkInside(x,probe,25))continue;var hit=foodSurfaceAt(x,probe),y=hit.surface-13;if(oceanRegion(x,y)!==1||Math.abs(y-player.y)>1900||rkInside(x,y,9))continue;if(survivalTime>1&&Math.abs(x-cam.x)<W/(2*cam.z)+80&&Math.abs(y-cam.y)<H/(2*cam.z)+80)continue;return {x:x,y:y,surface:hit.surface,reef:hit.reef};}return null;
}
function canCollectOceanFood(f){return !FOOD_INFO[f.type].hazard&&(f.type!=='bluecrab'||player.size>=ICE_CRAB_MIN);}
function oceanContactDamage(entity,amount,label,slow){
 if(!player.alive||gameState!=='playing'||player.spawnProt>0||player.invulnTimer>0||(entity.stingCd||0)>0)return false;
 entity.stingCd=1.6;if(player.buffs.shield>0){player.buffs.shield=0;player.invulnTimer=1.2;addPopup(player.x,player.y-30,'庇护挡住了攻击','#b1e8ee');return false;}
 player.hunger=Math.max(0,player.hunger-amount);player.invulnTimer=1.6;player.slowTimer=Math.max(player.slowTimer||0,slow||0);player.hurtFlash=.5;
 var dx=player.x-entity.x,dy=player.y-entity.y,d=Math.hypot(dx,dy)||1;player.vx+=dx/d*220;player.vy+=dy/d*220;addPopup(player.x,player.y-35,label+' · 饱食 -'+amount,'#db9df5',true);return true;
}
FOOD_INFO.toxicjelly={cap:7,respawn:9,score:0,hunger:0,grow:0,pIdx:3,hazard:true,damage:28};
GUIDE_FOOD_NAMES.toxicjelly='剧毒水母';GUIDE_FOOD_HABITAT.toxicjelly='浅水区以外部分海廊、断层与洞口 · 有绕行空隙';
var TOXIC_JELLY_AREAS=[{x:12600,y:5400,r:750},{x:17700,y:6450,r:700},{x:8500,y:9000,r:650},{x:15000,y:9500,r:750},{x:20100,y:9400,r:650},{x:9000,y:12800,r:800}];
var lifeSpawn=spawnFood;spawnFood=function(type,bx,by){
 if(type!=='toxicjelly'){lifeSpawn(type,bx,by);return;}
 if(player.y<3400||oceanRegion(player.x,player.y)===1||foodCount(type)>=FOOD_INFO[type].cap)return;
 for(var i=0;i<24;i++){var area=TOXIC_JELLY_AREAS[Math.floor(rand(0,TOXIC_JELLY_AREAS.length))];if(dist2(area.x,area.y,player.x,player.y)>2600*2600)continue;var x=area.x+rand(-area.r,area.r),y=area.y+rand(-area.r*.55,area.r*.55),distance=dist2(x,y,player.x,player.y);if(y<3400||oceanRegion(x,y)===1||rkInside(x,y,75)||distance<500*500||distance>2500*2500)continue;var f=foodPool.length?foodPool.pop():newFood();Object.assign(f,{type:type,x:x,y:y,anchorX:x,anchorY:y,r:28,t:rand(0,6),seed:rand(0,10),life:-1,biome:zoneAt(x,y),dead:false,stingCd:0,dir:1});foods.push(f);return;}
};
var cuttleSpec={n:'墨鱼',sMin:18,sMax:32,spd:92,ry:.46,shape:'cuttle',c1:'#a78c90',c2:'#e5ccbb',c3:'#534a63',pat:'spots',tail:'none',bio:[0,0,5,0],passive:true,cuttle:true,nativeSize:true,deepNative:true};
SPECIES.push(cuttleSpec);FISH_MEAL_PROFILES['墨鱼']=[1.2,1.35];
var lifeChoose=chooseHabitatSpecies;chooseHabitatSpecies=function(x,y,small){
 if(!small&&y>4200&&y<10500&&oceanRegion(x,y)!==1&&dist2(x,y,VOLCANO.x,VOLCANO.y)>2000*2000&&Math.random()<.13&&fishes.filter(function(f){return !f.dead&&f.spec.cuttle;}).length<6)return cuttleSpec;
 return lifeChoose(x,y,small);
};
var INK_CLOUDS=[],lifeClock=0;
var lifeInit=initHabitatFish;initHabitatFish=function(f,sp,x,y,size){lifeInit(f,sp,x,y,size);f.inkUsed=false;f.inkEscape=0;f.inkAngle=0;return f;};
function releaseCuttleInk(f){
 if(f.inkUsed||f.dead)return false;f.inkUsed=true;f.inkEscape=2.8;f.inkAngle=Math.atan2(f.y-player.y,f.x-player.x);INK_CLOUDS.push({x:f.x,y:f.y,r:460,age:0,life:7.5,seed:f.seed||0});if(INK_CLOUDS.length>8)INK_CLOUDS.shift();addPopup(f.x,f.y-f.size,'墨鱼喷墨！绕出墨团追踪','#e4bbdf',true);return true;
}
var lifeFishUpdate=updateFish;updateFish=function(f,dt){
 if(f.spec.cuttle&&!f.inkUsed&&player.alive&&shouldCuttleReleaseInk(f))releaseCuttleInk(f);
 lifeFishUpdate(f,dt);if(!f.spec.cuttle||f.dead)return;
 if(f.inkEscape>0){f.inkEscape=Math.max(0,f.inkEscape-dt);var speed=f.spec.spd*fishDepthSpeed(f)*2.8;f.vx=Math.cos(f.inkAngle)*speed;f.vy=Math.sin(f.inkAngle)*speed;f.angle=lerpAngle(f.angle,f.inkAngle,Math.min(1,dt*9));}
};
var lifeFoodUpdate=updateFoods;updateFoods=function(dt){
 for(var i=0;i<foods.length;i++){var f=foods[i];if(f.dead)continue;
 if(f.type==='bluecrab'){f.stingCd=Math.max(0,(f.stingCd||0)-dt);if(player.size<ICE_CRAB_MIN&&dist2(f.x,f.y,player.x,player.y)<Math.pow(player.size*.48+23,2)){oceanContactDamage(f,18,'蓝冰梭子蟹钳伤',.6);}}
 if(f.type!=='toxicjelly')continue;
 if(dist2(f.x,f.y,player.x,player.y)>3600*3600){f.dead=true;continue;}
 f.stingCd=Math.max(0,f.stingCd-dt);f.x=f.anchorX+Math.sin(survivalTime*.35+f.seed)*55;f.y=f.anchorY+Math.sin(survivalTime*.6+f.seed)*42;var b={x:f.x,y:f.y,size:40,vx:0,vy:0};rkCollide(b,false);f.x=b.x;f.y=b.y;
 if(dist2(f.x,f.y,player.x,player.y)<Math.pow(player.size*.43+50,2))oceanContactDamage(f,28,'剧毒水母蜇伤',2.1);
 }lifeFoodUpdate(dt);
};
var lifeUpdate=update;update=function(dt){lifeUpdate(dt);if(gameState!=='playing')return;
 for(var i=INK_CLOUDS.length-1;i>=0;i--){INK_CLOUDS[i].age+=dt;if(INK_CLOUDS[i].age>=INK_CLOUDS[i].life)INK_CLOUDS.splice(i,1);}
 lifeClock+=dt;if(lifeClock>2){lifeClock=0;if(oceanRegion(player.x,player.y)===1&&foodCount('bluecrab')<3)spawnFood('bluecrab');if(foodCount('toxicjelly')<4)spawnFood('toxicjelly');observeDangerGuide();}
};
var lifeReset=resetGame;resetGame=function(){INK_CLOUDS.length=0;lifeClock=0;lifeReset();};
var lifeVisibility=drawDepthVisibility;drawDepthVisibility=function(time){lifeVisibility(time);if(gameState!=='playing'&&gameState!=='paused')return;ctx.save();ctx.setTransform(DPR,0,0,DPR,0,0);
 INK_CLOUDS.forEach(function(ink){var r=ink.r*cam.z*(.45+.55*Math.min(1,ink.age/.8)),x=(ink.x-cam.x)*cam.z+W/2,y=(ink.y-cam.y)*cam.z+H/2;if(x+r<0||x-r>W||y+r<0||y-r>H)return;var a=Math.min(1,ink.age/.15)*Math.min(1,(ink.life-ink.age)/2),g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(9,3,20,'+(.97*a)+')');g.addColorStop(.55,'rgba(17,8,30,'+(.9*a)+')');g.addColorStop(1,'rgba(28,11,39,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);});ctx.restore();
};
function paintJelly(g,x,y,s,t,toxic){
 g.save();g.translate(x,y);var pulse=1+Math.sin(t*2.7)*.065;g.scale(pulse,2-pulse);g.lineCap='round';
 for(var i=0;i<14;i++){var xx=(i-6.5)*s*.115,len=s*(1.6+(i%4)*.24);g.strokeStyle=toxic?(i%2?'#b9f876aa':'#d994ef99'):'rgba(174,200,239,.57)';g.lineWidth=s*(i%3===0?.07:.025);g.beginPath();g.moveTo(xx,s*.25);g.bezierCurveTo(xx+s*.35*Math.sin(t+i),s*.85,xx-s*.25*Math.cos(t*1.2+i),len*.7,xx+s*.32*Math.sin(t*.8+i),len);g.stroke();}
 var grad=g.createRadialGradient(-s*.25,-s*.45,s*.05,0,-s*.12,s);grad.addColorStop(0,toxic?'rgba(204,255,142,.88)':'rgba(224,222,255,.8)');grad.addColorStop(.65,toxic?'rgba(131,67,176,.65)':'rgba(112,126,204,.5)');grad.addColorStop(1,'rgba(92,90,166,.12)');g.fillStyle=grad;g.strokeStyle=toxic?'#a8e979aa':'#c9d8f2aa';g.lineWidth=s*.035;
 g.beginPath();g.moveTo(-s,s*.2);g.bezierCurveTo(-s,-s*1.1,s,-s*1.1,s,s*.2);g.quadraticCurveTo(s*.75,s*.42,s*.5,s*.23);g.quadraticCurveTo(s*.25,s*.48,0,s*.25);g.quadraticCurveTo(-s*.25,s*.48,-s*.5,s*.23);g.quadraticCurveTo(-s*.75,s*.42,-s,s*.2);g.closePath();g.fill();g.stroke();
 g.strokeStyle=toxic?'#d8ffa977':'#e2d9ff66';g.lineWidth=s*.025;for(var i=-2;i<=2;i++){g.beginPath();g.moveTo(i*s*.38,s*.2);g.quadraticCurveTo(i*s*.1,-s*.9,0,-s*.76);g.stroke();}
 g.fillStyle=toxic?'#e4ffbf99':'#f3d6f788';for(var i=0;i<4;i++){g.beginPath();g.ellipse(Math.cos(i*Math.PI/2)*s*.2,-s*.1+Math.sin(i*Math.PI/2)*s*.16,s*.17,s*.08,i*Math.PI/2,0,Math.PI*2);g.fill();}g.restore();
}
var lifeFoodDraw=drawFood;drawFood=function(f,t){
 if(f.type==='jelly'||f.type==='toxicjelly'){paintJelly(ctx,f.x,f.y,f.type==='toxicjelly'?29:22,t+f.seed,f.type==='toxicjelly');return;}
 if(f.type==='crab'){ctx.save();ctx.translate(f.x,f.y);ctx.scale(.5,.5);ctx.filter='sepia(.7) saturate(1.4) hue-rotate(320deg)';drawBlueCrab(ctx,0,0,1,t,f.dir);ctx.restore();return;}
 lifeFoodDraw(f,t);
 if(f.type==='bluecrab'&&dist2(f.x,f.y,player.x,player.y)<450*450){ctx.save();ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle=player.size<36?'#ffb59b':'#adebdc';ctx.fillText(player.size<36?'蓝冰梭子蟹 · 体长 36 可吃 · 钳伤 -18':'蓝冰梭子蟹 · 可捕食',f.x,f.y-38);ctx.restore();}
};
function drawRibbonFish(g,s,t,oar){
 var length=oar?3.1:2.6,thick=oar?.15:.29;
 function cy(u){return Math.sin(t-u*5)*s*.1*(1-u);}
 g.fillStyle=oar?'#bd5166':'#326d65';g.beginPath();g.moveTo(-s*2,cy(0));for(var i=0;i<=20;i++){var u=i/20,x=(-2+u*length)*s;g.lineTo(x,cy(u)-s*(thick+.15)*Math.sin(u*Math.PI*.85));}for(var i=20;i>=0;i--){var u=i/20;g.lineTo((-2+u*length)*s,cy(u)-s*thick*Math.sin(u*Math.PI*.85));}g.closePath();g.fill();
 var grad=g.createLinearGradient(0,-s*.4,0,s*.4);grad.addColorStop(0,oar?'#7c9eaf':'#305f58');grad.addColorStop(.45,oar?'#e5f1f3':'#80b2a0');grad.addColorStop(1,oar?'#8aaabd':'#264b45');g.fillStyle=grad;g.strokeStyle=oar?'#e1edf377':'#234d45';g.lineWidth=s*.018;
 g.beginPath();for(var i=0;i<=24;i++){var u=i/24;g.lineTo((-2+u*length)*s,cy(u)-s*thick*Math.sin(u*Math.PI*.85));}for(var i=24;i>=0;i--){var u=i/24;g.lineTo((-2+u*length)*s,cy(u)+s*thick*Math.sin(u*Math.PI*.85));}g.closePath();g.fill();g.stroke();
 if(oar){g.strokeStyle='#f2a4a8';g.lineWidth=s*.025;for(var i=0;i<17;i++){var u=i/18+.03,x=(-2+u*length)*s;g.beginPath();g.moveTo(x,cy(u)-s*thick*Math.sin(u*Math.PI*.85));g.lineTo(x-s*.04,cy(u)-s*(thick+.14)*Math.sin(u*Math.PI*.85));g.stroke();}g.strokeStyle='#e07487';for(var i=0;i<3;i++){g.beginPath();g.moveTo(s*.78,-s*.15);g.bezierCurveTo(s*.6,-s*.65,s*.2,-s*.55,s*.36-i*s*.13,-s*.86+i*s*.08);g.stroke();}g.beginPath();g.moveTo(s*.7,s*.07);g.bezierCurveTo(s*.6,s*.6,0,s*.3,-s*.2,s*.8);g.stroke();}
 else{g.fillStyle='#a6c9ab';for(var i=0;i<20;i++){var u=i/21,x=(-1.8+u*2.6)*s;g.beginPath();g.ellipse(x,cy(u)+(i%2?1:-1)*s*.09,s*.025,s*.04,.4,0,Math.PI*2);g.fill();}}
 var hx=oar?1.02:.5;g.fillStyle='#112e33';g.beginPath();g.arc(s*hx,-s*.06,s*.045,0,Math.PI*2);g.fill();g.fillStyle='#eff8dd';g.beginPath();g.arc(s*(hx+.012),-s*.075,s*.013,0,Math.PI*2);g.fill();g.strokeStyle='#263f45';g.lineWidth=s*.02;g.beginPath();g.moveTo(s*(oar?1.06:.58),s*.04);g.lineTo(s*(oar?.88:.37),s*.09);g.stroke();
}
var lifeFishDraw=drawFishSprite;drawFishSprite=function(f,x,y,s,a,t,inflate,isPlayer,time){
 if(isPlayer||f.spec.leviathan||(!f.spec.cuttle&&!f.spec.flying&&f.spec.shape!=='ray'&&f.spec.shape!=='eel')){lifeFishDraw(f,x,y,s,a,t,inflate,isPlayer,time);return;}
 ctx.save();ctx.translate(x,y);ctx.rotate(a);if(Math.cos(a)<0)ctx.scale(1,-1);var g=ctx,sp=f.spec;
 if(sp.shape==='eel'){drawRibbonFish(g,s,t,sp.n==='皇带鱼');}
 else if(sp.shape==='ray'){
 var wave=Math.sin(t*1.2)*.18;g.strokeStyle='#648fa6';g.lineWidth=s*.045;g.beginPath();g.moveTo(-s*.65,0);g.bezierCurveTo(-s*1.7,s*.05,-s*2,s*.35,-s*2.4,s*.2);g.stroke();var grad=g.createLinearGradient(0,-s*1.4,0,s*1.4);grad.addColorStop(0,'#203e57');grad.addColorStop(.5,'#597f8e');grad.addColorStop(1,'#182f49');g.fillStyle=grad;g.lineWidth=s*.018;g.strokeStyle='#8bbac3';g.beginPath();g.moveTo(s*.8,-s*.18);g.bezierCurveTo(s*.15,-s*.4,-s*.1,-s*(1.55+wave),-s*.75,-s*(1.65+wave));g.quadraticCurveTo(-s*.4,-s*.55,-s*.8,0);g.quadraticCurveTo(-s*.4,s*.55,-s*.75,s*(1.65+wave));g.bezierCurveTo(-s*.1,s*(1.55+wave),s*.15,s*.4,s*.8,s*.18);g.closePath();g.fill();g.stroke();g.fillStyle='#b1cace55';g.beginPath();g.ellipse(s*.1,0,s*.55,s*.25,0,0,Math.PI*2);g.fill();g.strokeStyle='#99bbc6';g.lineWidth=s*.08;for(var side=-1;side<=1;side+=2){g.beginPath();g.moveTo(s*.68,side*s*.21);g.quadraticCurveTo(s*1.12,side*s*.38,s*.95,side*s*.08);g.stroke();g.fillStyle='#0f2735';g.beginPath();g.arc(s*.6,side*s*.18,s*.045,0,Math.PI*2);g.fill();}}
 else if(sp.flying){
 var spread=f.airTime>0?1:.55;for(var side=-1;side<=1;side+=2){g.fillStyle='rgba(137,208,221,.46)';g.strokeStyle='#b7e8edaa';g.lineWidth=s*.018;g.beginPath();g.moveTo(s*.3,side*s*.09);g.bezierCurveTo(0,side*s*.6*spread,-s*.7,side*s*1.8*spread,-s*1.1,side*s*1.3*spread);g.lineTo(-s*.6,side*s*.12);g.closePath();g.fill();g.stroke();for(var i=0;i<7;i++){g.beginPath();g.moveTo(s*.23,side*s*.1);g.lineTo(s*(-.55-i*.08),side*s*(.35+i*.14)*spread);g.stroke();}}
 var grad=g.createLinearGradient(0,-s*.25,0,s*.25);grad.addColorStop(0,'#24567b');grad.addColorStop(.5,'#9bd9e5');grad.addColorStop(1,'#e4f7ed');g.fillStyle=grad;g.beginPath();g.ellipse(0,0,s*1.1,s*.2,0,0,Math.PI*2);g.fill();g.fillStyle='#4a8ba5';g.beginPath();g.moveTo(-s*.85,0);g.lineTo(-s*1.4,-s*.35);g.lineTo(-s*1.15,0);g.lineTo(-s*1.5,s*.5);g.closePath();g.fill();g.fillStyle='#113449';g.beginPath();g.arc(s*.79,-s*.045,s*.055,0,Math.PI*2);g.fill();}
 else{
 // Cuttlefish mantle, rippling lateral skirt, chromatophores and ten forward arms.
 g.fillStyle='#bc96ab88';g.strokeStyle='#edb9c6';g.lineWidth=s*.02;g.beginPath();g.moveTo(s*.4,-s*.32);for(var i=0;i<=18;i++){var u=i/18,xx=(.4-u*1.8)*s,yy=-s*(.18+Math.sin(u*Math.PI)*.45)+Math.sin(t*1.8+i)*s*.045;g.lineTo(xx,yy);}for(var i=18;i>=0;i--){var u=i/18;g.lineTo((.4-u*1.8)*s,s*(.18+Math.sin(u*Math.PI)*.45)+Math.sin(t*1.8+i)*s*.045);}g.closePath();g.fill();g.stroke();var grad=g.createLinearGradient(0,-s*.5,0,s*.5);grad.addColorStop(0,'#746579');grad.addColorStop(.5,'#c5aaa2');grad.addColorStop(1,'#665b70');g.fillStyle=grad;g.beginPath();g.ellipse(-s*.45,0,s*.93,s*.4,0,0,Math.PI*2);g.fill();g.fillStyle='#e1c7b6';g.beginPath();g.ellipse(s*.5,0,s*.28,s*.28,0,0,Math.PI*2);g.fill();g.strokeStyle='#bda3a7';g.lineCap='round';for(var i=0;i<10;i++){var yy=(i-4.5)*s*.045;g.lineWidth=s*(i%4===0?.055:.035);g.beginPath();g.moveTo(s*.62,yy);g.bezierCurveTo(s*.95,yy+s*.1*Math.sin(t+i),s*1.35,yy+s*.4*Math.sin(i),s*(1.15+(i%3)*.12),yy+s*.32*Math.sin(t*.7+i));g.stroke();}g.fillStyle='#58485988';for(var i=0;i<18;i++){g.beginPath();g.ellipse(s*(-1.12+(i%6)*.25),s*(-.22+Math.floor(i/6)*.2),s*.04,s*.025,0,0,Math.PI*2);g.fill();}g.fillStyle='#ead7a2';g.beginPath();g.arc(s*.55,-s*.16,s*.115,0,Math.PI*2);g.fill();g.strokeStyle='#192b35';g.lineWidth=s*.045;g.beginPath();g.moveTo(s*.47,-s*.17);g.lineTo(s*.52,-s*.12);g.lineTo(s*.57,-s*.18);g.lineTo(s*.62,-s*.13);g.stroke();}
 ctx.restore();
};
var GUIDE_RECORDS={};try{var stored=JSON.parse(localStorage.getItem('bfish-guide-v69')||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))GUIDE_RECORDS=stored;}catch(_){}
function guideKey(entry){return entry.food?'food:'+entry.food:'fish:'+entry.spec.n;}
function unlockGuideRecord(key,name){if(GUIDE_RECORDS[key])return;GUIDE_RECORDS[key]=true;try{localStorage.setItem('bfish-guide-v69',JSON.stringify(GUIDE_RECORDS));}catch(_){}addPopup(player.x,player.y-65,'图鉴解锁 · '+name,'#acedd9',true);}
function unlockFoodGuide(type){unlockGuideRecord('food:'+type,GUIDE_FOOD_NAMES[type]||type);}
var lifeEat=playerEatFish;playerEatFish=function(f){var before=eatCount,result=lifeEat(f);if(eatCount>before)unlockGuideRecord('fish:'+f.spec.n,f.spec.n);return result;};
function observeDangerGuide(){
 foods.forEach(function(f){if(!f.dead&&(f.type==='jelly'||FOOD_INFO[f.type].hazard)&&dist2(f.x,f.y,player.x,player.y)<240*240&&fishCanSeePlayer(f))unlockFoodGuide(f.type);});
 fishes.forEach(function(f){if(!f.dead&&f.spec.leviathan&&dist2(f.x,f.y,player.x,player.y)<700*700&&fishCanSeePlayer(f))unlockGuideRecord('fish:'+f.spec.n,f.spec.n);});
}
function guideEntryView(entry){var unlocked=!!GUIDE_RECORDS[guideKey(entry)];return {unlocked:unlocked,name:unlocked?entry.name:'未知生物 · '+String(GUIDE_ENTRIES.indexOf(entry)+1).padStart(2,'0'),lines:unlocked?entry.lines:[entry.edible?'尚未捕食':'尚未近距离观察','首次'+(entry.edible?'捕食 / 采集':'观察')+'后解锁外观与数值','探索不同海域，记录新的生命','解锁记录保存在当前浏览器']};}
function prepareGuideImage(entry){
 var art=guideIllustration(entry);entry.art=art.toDataURL('image/png');var g=art.getContext('2d'),image=g.getImageData(0,0,art.width,art.height);for(var i=0;i<image.data.length;i+=4){var alpha=image.data[i+3];image.data[i]=40;image.data[i+1]=67;image.data[i+2]=80;image.data[i+3]=alpha>85?255:0;}g.putImageData(image,0,0);entry.silhouette=art.toDataURL('image/png');entry.image=GUIDE_RECORDS[guideKey(entry)]?entry.art:entry.silhouette;
}
function refreshGuideImages(){GUIDE_ENTRIES.forEach(function(entry){entry.image=GUIDE_RECORDS[guideKey(entry)]?entry.art:entry.silhouette;});var unlocked=GUIDE_ENTRIES.filter(function(e){return GUIDE_RECORDS[guideKey(e)];}).length;guide.querySelector('h2').textContent='海洋图鉴 · 已解锁 '+unlocked+' / '+GUIDE_ENTRIES.length;}
// Correct the species notes without making locked entries reveal their data.
var lifeGuideEntries=buildGuideEntries;buildGuideEntries=function(){var entries=lifeGuideEntries();entries.forEach(function(e){if(e.food==='bluecrab'){e.lines[1]='体长至少 36 可吃 · 不足时钳伤 -18';e.lines[2]='饱食 +11 · 基础成长 +0.065 · 刷新 32 秒';}if(e.spec&&e.spec.cuttle){e.lines=['陆架下方与暮光岩礁 · 避开冰海和火山热区','体长 18–32 · 遇到更大猎手会喷墨','每只仅能喷墨一次 · 墨团约 7.5 秒消散','喷墨后高速逃跑 · 绕出墨团追踪'];}});return entries;};
// Rock-crevice morays: wait at an actual solid boundary, lunge briefly, then retreat.
function findMorayDen(x,y,size){
 for(var ring=100;ring<=600;ring+=100){for(var i=0;i<16;i++){var a=i*Math.PI/8,dx=Math.cos(a),dy=Math.sin(a),rx=x+dx*ring,ry=y+dy*ring;if(ry<400||ry>10500||!rkInside(rx,ry,0))continue;var lo=Math.max(0,ring-100),hi=ring;if(rkInside(x+dx*lo,y+dy*lo,0))continue;for(var k=0;k<9;k++){var mid=(lo+hi)/2;if(rkInside(x+dx*mid,y+dy*mid,0))hi=mid;else lo=mid;}var px=x+dx*(lo-size*.6-18),py=y+dy*(lo-size*.6-18);if(!rkInside(px,py,size*.43+10))return {x:px,y:py,angle:Math.atan2(-dy,-dx)};}}return null;
}
var denInit=initHabitatFish;initHabitatFish=function(f,sp,x,y,size){denInit(f,sp,x,y,size);f.morayDen=null;f.morayState='wait';f.morayTimer=rand(1,3);f.morayCooldown=0;if(sp.n==='海鳗'){f.morayDen=findMorayDen(x,y,f.size);if(f.morayDen){f.x=f.hx=f.morayDen.x;f.y=f.hy=f.morayDen.y;f.angle=f.morayDen.angle;}}return f;};
function morayLineClear(x,y,tx,ty){var len=Math.hypot(tx-x,ty-y);for(var d=25;d<len;d+=25)if(rkInside(x+(tx-x)*d/len,y+(ty-y)*d/len,9))return false;return true;}
function updateMoray(f,dt){
 if(canRecycleFish(f)){f.dead=true;return;}var den=f.morayDen;f.morayCooldown=Math.max(0,f.morayCooldown-dt);f.morayTimer-=dt;f.tailPhase+=dt*(f.morayState==='wait'?1.5:9);var target=null;
 if(player.alive&&player.spawnProt<=0&&f.size>=player.size*CONF.EAT_RATIO&&dist2(den.x,den.y,player.x,player.y)<430*430&&morayLineClear(f.x,f.y,player.x,player.y))target=player;
 if(!target){for(var i=0;i<fishes.length;i++){var other=fishes[i];if(other===f||other.dead||other.puffBlocked||other.size>f.size*.75||dist2(den.x,den.y,other.x,other.y)>320*320||!morayLineClear(f.x,f.y,other.x,other.y))continue;target=other;break;}}
 f.chasingPlayer=target===player;f.targetKind=target===player?'player':target?'fish':null;
 if(f.morayState==='wait'&&target&&f.morayCooldown<=0){f.morayState='warning';f.morayTimer=1.15;f.morayAim=target?Math.atan2(target.y-f.y,target.x-f.x):den.angle;}
 if(f.morayState==='warning'&&f.morayTimer<=0){f.morayState='strike';f.morayTimer=.95;f.morayStrikeX=f.x;f.morayStrikeY=f.y;}
 if(f.morayState==='strike'&&(f.morayTimer<=0||!target||dist2(f.x,f.y,den.x,den.y)>235*235)){f.morayState='return';f.morayCooldown=5.5;}
 var tx=den.x,ty=den.y,speed=95*Math.min(1.15,fishDepthSpeed(f));if(f.morayState==='strike'&&target){tx=f.morayStrikeX+Math.cos(f.morayAim)*240;ty=f.morayStrikeY+Math.sin(f.morayAim)*240;speed=145*Math.min(1.15,fishDepthSpeed(f));}
 var dx=tx-f.x,dy=ty-f.y,d=Math.hypot(dx,dy);if(f.morayState==='wait'||f.morayState==='warning'){f.vx=f.vy=0;f.angle=lerpAngle(f.angle,den.angle,Math.min(1,dt*4));}else if(d>5){f.vx=dx/d*speed;f.vy=dy/d*speed;f.x+=f.vx*dt;f.y+=f.vy*dt;f.angle=lerpAngle(f.angle,Math.atan2(dy,dx),Math.min(1,dt*9));rkCollide(f,false);}else{f.morayState='wait';f.vx=f.vy=0;}
 if(target&&target!==player&&f.morayState==='strike'&&dist2(f.x,f.y,target.x,target.y)<Math.pow((f.size+target.size)*.4,2)){target.dead=true;f.morayState='return';f.morayCooldown=3.5;}
 if(player.alive&&gameState==='playing'&&dist2(f.x,f.y,player.x,player.y)<Math.pow((f.size+player.size)*.45,2)){
  if(f.size<player.size*CONF.EAT_RATIO){playerEatFish(f);f.dead=true;}
  else if(f.size>player.size*CONF.KILL_RATIO){if(player.invulnTimer<=0&&player.spawnProt<=0){if(player.buffs.shield>0)consumeShield(f);else playerDie('被洞口海鳗吞掉了');}}
  else if(f.morayState==='strike'){playerBitten(f);f.morayState='return';f.morayCooldown=3.5;}
 }
}
var denFishUpdate=updateFish;updateFish=function(f,dt){if(f.spec.n==='海鳗'&&f.morayDen){updateMoray(f,dt);return;}denFishUpdate(f,dt);};
// Angler anatomy: dark mantle, cavernous jaw, irregular needle teeth and a flexible lure.
var lifeAnglerBody=bakeFishBody;bakeFishBody=function(g,sp,R){
 if(sp.shape!=='angler'){lifeAnglerBody(g,sp,R);return;}
 g.save();var grad=g.createRadialGradient(-R*.3,-R*.3,R*.1,0,0,R*1.15);grad.addColorStop(0,'#60676f');grad.addColorStop(.6,'#2e3b46');grad.addColorStop(1,'#101f2b');g.fillStyle=grad;g.strokeStyle='#71939c';g.lineWidth=R*.022;g.beginPath();g.moveTo(R*.9,-R*.16);g.bezierCurveTo(R*.72,-R*1.02,-R*.85,-R*.98,-R*1.04,-R*.12);g.bezierCurveTo(-R*1.15,R*.65,R*.05,R*.91,R*.86,R*.42);g.lineTo(R*.53,R*.17);g.closePath();g.fill();g.stroke();
 g.fillStyle='#70939a55';for(var i=0;i<38;i++){var a=i*2.399,rr=R*(.2+(i%5)*.13),x=-R*.2+Math.cos(a)*rr,y=Math.sin(a)*rr*.8;g.beginPath();g.arc(x,y,R*(.012+(i%3)*.006),0,Math.PI*2);g.fill();}
 g.fillStyle='#46616b';g.beginPath();g.moveTo(-R*.4,R*.4);g.quadraticCurveTo(-R*.85,R*1.1,R*.06,R*.66);g.closePath();g.fill();g.stroke();g.beginPath();g.moveTo(-R*.5,-R*.5);g.lineTo(-R*.75,-R*.97);g.lineTo(-R*.1,-R*.66);g.closePath();g.fill();
 g.fillStyle='#07131d';g.beginPath();g.moveTo(R*.95,-R*.17);g.quadraticCurveTo(R*.13,-R*.09,R*.37,R*.52);g.quadraticCurveTo(R*.78,R*.62,R*1.02,R*.36);g.quadraticCurveTo(R*.7,R*.18,R*.95,-R*.17);g.fill();g.strokeStyle='#8b9894';g.lineWidth=R*.037;g.beginPath();g.moveTo(R*.97,-R*.18);g.quadraticCurveTo(R*.17,-R*.04,R*.39,R*.51);g.quadraticCurveTo(R*.82,R*.67,R*1.02,R*.36);g.stroke();
 g.fillStyle='#d3dfc5';for(var i=0;i<9;i++){var u=i/8,x=R*(.43+u*.5),top=-R*.1+Math.sin(u*Math.PI)*R*.045,len=R*(.14+(i%3)*.055);g.beginPath();g.moveTo(x,top);g.lineTo(x-R*.025,top+len);g.lineTo(x+R*.035,top+R*.02);g.closePath();g.fill();var bx=R*(.42+u*.55),by=R*(.48+Math.sin(u*Math.PI)*.06);g.beginPath();g.moveTo(bx,by);g.lineTo(bx+R*.015,by-len*.8);g.lineTo(bx+R*.045,by);g.fill();}
 g.fillStyle='#b5b999';g.beginPath();g.arc(R*.39,-R*.33,R*.105,0,Math.PI*2);g.fill();g.fillStyle='#05131c';g.beginPath();g.arc(R*.41,-R*.32,R*.055,0,Math.PI*2);g.fill();g.fillStyle='#dcffe4';g.beginPath();g.arc(R*.43,-R*.35,R*.018,0,Math.PI*2);g.fill();
 g.strokeStyle='#9cb7b5';g.lineWidth=R*.045;g.beginPath();g.moveTo(-R*.08,-R*.67);g.bezierCurveTo(R*.07,-R*1.48,R*.81,-R*1.48,R*.95,-R*sp.ry*1.3);g.stroke();var lx=R*.95,ly=-R*sp.ry*1.3,glow=g.createRadialGradient(lx,ly,0,lx,ly,R*.28);glow.addColorStop(0,'#efffdc');glow.addColorStop(.3,'#b6ffbcbb');glow.addColorStop(1,'#87f0c000');g.fillStyle=glow;g.beginPath();g.arc(lx,ly,R*.28,0,Math.PI*2);g.fill();g.fillStyle='#e7ffd6';g.beginPath();g.ellipse(lx,ly,R*.09,R*.13,0,0,Math.PI*2);g.fill();g.restore();
};
var denArt=drawFishSprite;drawFishSprite=function(f,x,y,s,a,t,inflate,isPlayer,time){
 if(!isPlayer&&f.spec.n==='海鳗'&&f.morayDen&&(f.morayState==='wait'||f.morayState==='warning')){ctx.save();ctx.translate(x,y);ctx.rotate(a);if(Math.cos(a)<0)ctx.scale(1,-1);ctx.beginPath();ctx.rect(-s*.4,-s,s*1.4,s*2);ctx.clip();drawRibbonFish(ctx,s,t,false);ctx.restore();if(f.morayState==='warning'){ctx.save();ctx.fillStyle='#ffb694';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('海鳗蓄势 · 避开洞口',x,y-s-15);ctx.restore();}return;}
 denArt(f,x,y,s,a,t,inflate,isPlayer,time);
};
var denGuide=buildGuideEntries;buildGuideEntries=function(){var entries=denGuide();entries.forEach(function(e){if(e.spec&&e.spec.n==='海鳗')e.lines=['岩壁裂隙与洞口 · 平时探头守候','猎物靠近会蓄势短扑，随后退回洞口','同体型扑咬 -14 饱食 · 大体型会吞食你','先避开扑击，再从侧面捕食'];});return entries;};

var denChoose=chooseHabitatSpecies;chooseHabitatSpecies=function(x,y,small){var sp=denChoose(x,y,small);if(sp.n==='海鳗'&&!findMorayDen(x,y,sp.sMax))return SPECIES[9];return sp;};
