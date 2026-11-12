/* Fixed oyster beds, visible black urchins and bounded predator pursuit. */
var PEARL_BEDS=[],PEARL_INTERVAL=55;
function paintWreckDetails(g,ship){
 g.save();g.lineCap='round';
 // Texture only the solid planks, leaving both entrances and the hatch clear.
 ship.planks.forEach(function(p,i){var grad=g.createLinearGradient(p[0],p[1]-8,p[0],p[1]+10);grad.addColorStop(0,'#b1966b');grad.addColorStop(.35,'#766451');grad.addColorStop(1,'#3d4547');g.strokeStyle=grad;g.lineWidth=17;g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(p[2],p[3]);g.stroke();g.strokeStyle='#322e2b99';g.lineWidth=1;for(var j=0;j<3;j++){g.beginPath();g.moveTo(p[0]+6,p[1]-5+j*4);g.bezierCurveTo(p[0]+35,p[1]+j*3,p[2]-40,p[1]-6+j*4,p[2]-7,p[1]-4+j*4);g.stroke();}for(var x=p[0]+18;x<p[2]-10;x+=110){g.fillStyle='#b6a585';g.beginPath();g.arc(x,p[1],2.3,0,Math.PI*2);g.fill();}});
 for(var mast of [[-300,-155,-345,-830],[320,-160,350,-560]]){g.strokeStyle='#323c40';g.lineWidth=23;g.beginPath();g.moveTo(mast[0],mast[1]);g.lineTo(mast[2],mast[3]);g.stroke();g.strokeStyle='#9a8059';g.lineWidth=12;g.stroke();g.strokeStyle='#cead7880';g.lineWidth=2;g.stroke();}
 g.strokeStyle='#b1a58188';g.lineWidth=2;for(var end of [-650,-120,500]){g.beginPath();g.moveTo(-345,-800);g.quadraticCurveTo((end-345)/2,-420,end,-170);g.stroke();}
 var sail=g.createLinearGradient(-330,-760,80,-320);sail.addColorStop(0,'#c4b992aa');sail.addColorStop(1,'#536b6688');g.fillStyle=sail;g.beginPath();g.moveTo(-328,-755);g.bezierCurveTo(-150,-670,4,-433,75,-340);g.lineTo(25,-358);g.lineTo(11,-327);g.lineTo(-42,-349);g.lineTo(-61,-303);g.lineTo(-99,-334);g.lineTo(-125,-305);g.quadraticCurveTo(-232,-358,-308,-390);g.closePath();g.fill();g.strokeStyle='#d0c09b66';g.lineWidth=1.5;for(var i=0;i<5;i++){g.beginPath();g.moveTo(-320,-712+i*57);g.quadraticCurveTo(-195,-605+i*50,-80+i*25,-390+i*12);g.stroke();}
 g.strokeStyle='#6b777b';g.lineWidth=6;g.beginPath();g.moveTo(580,147);g.quadraticCurveTo(625,225,672,204);g.lineTo(672,255);g.moveTo(647,221);g.lineTo(697,221);g.moveTo(633,238);g.quadraticCurveTo(672,294,711,238);g.stroke();
 // Small attached barnacle clusters stay outside the traversable openings.
 for(var i=0;i<35;i++){var x=-650+(i*137)%1300,y=-148+(i%2)*300;if(rkField(ship.rock,x,y)>-4)continue;g.strokeStyle='#b5b6a0';g.lineWidth=1.5;g.fillStyle='#45585b';g.beginPath();g.ellipse(x,y,4+i%4,3+i%3,0,0,Math.PI*2);g.fill();g.stroke();}g.restore();
}
var WRECK_DETAIL_ART=null;
drawShallowWreck=function(time){var s=SHALLOW_WRECK;if(!WRECK_DETAIL_ART||Math.abs(s.x-cam.x)>W/(2*cam.z)+1000||Math.abs(s.y-cam.y)>H/(2*cam.z)+1200)return;ctx.drawImage(WRECK_DETAIL_ART,s.x-850,s.y-940,1700,1240);};
var seabedSpawn=spawnFood;spawnFood=function(type,bx,by){if(type!=='pearl'){var n=foods.length;seabedSpawn(type,bx,by);for(var i=n;i<foods.length;i++)foods[i].pearlBed=null;}};
leaveEmptyOyster=function(f){if(f.pearlBed){f.pearlBed.ready=false;f.pearlBed.timer=PEARL_INTERVAL;}else EMPTY_OYSTERS.push({x:f.x,y:f.y});};
function stockPearlBed(b){if(foods.some(f=>!f.dead&&f.pearlBed===b))return;var f=foodPool.length?foodPool.pop():newFood();Object.assign(f,{type:'pearl',x:b.x,y:b.y-12,r:15,t:0,seed:b.seed,life:-1,biome:zoneAt(b.x,b.y),dead:false,stingCd:0,dir:1,pearlBed:b});foods.push(f);b.ready=true;b.timer=0;}
var seabedBake=bakeBackgrounds;bakeBackgrounds=function(){seabedBake();BACKGROUND_SHELLS=[];PEARL_BEDS=[];
 for(var x=2600,i=0;x<18700;x+=430,i++){var floor=shallowGround(x);if(floor===null||plantTouchesIce({x:x,y:floor})||rkInside(x,floor-42,18))continue;PEARL_BEDS.push({x:x,y:floor-18,seed:i,ready:false,timer:8+(i%6)*5});}
 // Lift bottom-dwelling art clear of rock and remove accidental duplicates.
 var lookup=new Map(DECOR_CATALOGUE.map(e=>[e.canvas,e]));WORLD_DECORS.forEach(d=>{var e=lookup.get(DECOR[d.z][d.spr]);if(e&&(e.kind==='海胆'||e.name.includes('牡蛎'))){d.y-=9;d.s=e.kind==='海胆'?1.5:1.35;}});buildDecorChunks();
 var note=decorCanvas(52,44,function(g){g.fillStyle='#3b302b';g.fillRect(18,25,82,122);g.fillStyle='#bda87b';g.beginPath();g.moveTo(25,20);g.lineTo(100,29);g.lineTo(95,143);g.lineTo(24,136);g.closePath();g.fill();g.strokeStyle='#e2cda0';g.lineWidth=2;g.stroke();g.fillStyle='#7e6950';g.fillRect(23,22,9,113);g.strokeStyle='#685d4d';g.lineWidth=1.6;for(var y=47;y<115;y+=12){g.beginPath();g.moveTo(43,y);g.lineTo(84-(y%4)*3,y+3);g.stroke();}g.strokeStyle='#64818b';g.lineWidth=3;g.beginPath();g.arc(63,118,10,0,Math.PI*2);g.moveTo(63,104);g.lineTo(63,130);g.stroke();});SP.note=note;
 DECOR_CATALOGUE.push({name:'沉船航海笔记',kind:'遗物',zone:'shallow',region:'沉船船舱',canvas:note,width:52,height:44,note:'皮革书脊、旧纸页与航海印记'});
 WRECK_DETAIL_ART=document.createElement('canvas');WRECK_DETAIL_ART.width=1700;WRECK_DETAIL_ART.height=1240;var wg=WRECK_DETAIL_ART.getContext('2d');wg.translate(850,940);paintWreckDetails(wg,SHALLOW_WRECK);
 SP.wreck=WRECK_DETAIL_ART;
 DECOR_CATALOGUE.push({name:'潮汐号沉船',kind:'地标',zone:'shallow',region:'浅海沉船区',canvas:WRECK_DETAIL_ART,width:1700,height:1240,note:'风化木板、铆钉、断桅与破帆；船舱通道保持畅通'});
};
var seabedReset=resetGame;resetGame=function(){seabedReset();PEARL_BEDS.forEach((b,i)=>{b.ready=false;b.timer=10+(i%6)*5;});PEARL_BEDS.filter((b,i)=>i%4===0).forEach(stockPearlBed);};
var seabedUpdate=update;update=function(dt){seabedUpdate(dt);if(gameState!=='playing'||!player.alive)return;PEARL_BEDS.forEach(b=>{var f=foods.find(f=>f.pearlBed===b&&!f.dead);if(f){f.x=b.x;f.y=b.y-12;b.ready=true;return;}if(b.ready){b.ready=false;b.timer=PEARL_INTERVAL;}b.timer-=dt;if(b.timer<=0)stockPearlBed(b);});};
var seabedFoodDraw=drawFood;drawFood=function(f,time){if(f.type==='pearl'&&f.pearlBed)return;seabedFoodDraw(f,time);};
var seabedWorld=drawExpeditionWorld;drawExpeditionWorld=function(time){seabedWorld(time);PEARL_BEDS.forEach(b=>{if(Math.abs(b.x-cam.x)>W/(2*cam.z)+100||Math.abs(b.y-cam.y)>H/(2*cam.z)+100)return;paintClam(ctx,b.x,b.y,.52,false,!b.ready);});var journal=SUPPLY_CACHES.find(p=>p.id==='shallow-wreck');if(journal&&!(V6.supplies&&V6.supplies[journal.id])&&Math.abs(journal.x-cam.x)<W/(2*cam.z)+80&&Math.abs(journal.y-cam.y)<H/(2*cam.z)+80)ctx.drawImage(SP.note,journal.x-34,journal.y-32,68,58);};
GUIDE_FOOD_HABITAT.pearl='浅海固定珍珠贝床 · 采集后约 55 秒再次产珠';
var seabedGuide=buildGuideEntries;buildGuideEntries=function(){var entries=seabedGuide();entries.forEach(e=>{if(e.food==='pearl')e.lines[0]=GUIDE_FOOD_HABITAT.pearl;});return entries;};
// Home coordinates are immutable for a spawned fish. Return gently rather than teleporting.
function fishHomeLimit(f){return f.spec.n==='冰牙鲨'?1300:f.size>140?2100:1650;}
function releasePlayerPursuit(f){f.playerTrackTime=0;f.chaseElapsed=0;f.playerChaseCooldown=6;f.huntT=0;f.huntCd=6;f.aggroTimer=0;f.chasingPlayer=false;f.targetKind=null;f.returningHome=true;}
var boundedPursuit=playerPursuit;playerPursuit=function(f,eligible,range,dt){
 var home=dist2(f.x,f.y,f.hx,f.hy),limit=fishHomeLimit(f),homeRegion=oceanRegion(f.hx,f.hy),outside=(homeRegion===1&&oceanRegion(f.x,f.y)!==1)||home>limit*limit;
 if(f.returningHome&&home<360*360)f.returningHome=false;
 if(outside||(f.chasingPlayer&&(dist2(f.x,f.y,player.x,player.y)>Math.pow(range+180,2)||(f.chaseElapsed||0)>7))){releasePlayerPursuit(f);}
 if(f.returningHome){f.playerChaseCooldown=Math.max(2,(f.playerChaseCooldown||0)-dt);f.huntT=0;return false;}
 var active=boundedPursuit(f,eligible,range,dt);if(active||f.huntT>0)f.chaseElapsed=(f.chaseElapsed||0)+dt;else f.chaseElapsed=0;return active;
};
var boundedSteering=ecologySteering;ecologySteering=function(f,x,y){if(f.returningHome){var dx=f.hx-f.x,dy=f.hy-f.y,d=Math.hypot(dx,dy)||1;f.state='return';f.chasingPlayer=false;return {x:dx/d,y:dy/d};}return boundedSteering(f,x,y);};
