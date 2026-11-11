/* V6 — open seas, broad continental floors, selective shafts and biome-specific ecology. */
'use strict';
window.EXPEDITION_TARGET=110;
OCEAN.name='深蓝群域';
var V6={clock:0,ecologyTimer:0,bossTimer:0,gateCooldown:0,heatCooldown:0,thermal:0,flyLaunches:0};
var flyingSpec={n:'飞鱼',sMin:7,sMax:13,spd:105,ry:.32,shape:'slim',c1:'#8bd6e3',c2:'#d5f9ed',c3:'#438eae',pat:'line',tail:'fork',bio:[0,0,0,0],flying:true};
var iceShark={n:'冰牙鲨',sMin:52,sMax:91,spd:90,ry:.43,shape:'shark',c1:'#a3cad9',c2:'#edf7f7',c3:'#608eae',pat:'gill',tail:'fork',bio:[0,0,0,0],aggr:.8};
var giantShark={n:'深海巨鲨',sMin:115,sMax:175,spd:102,ry:.46,shape:'shark',c1:'#405578',c2:'#8097ac',c3:'#243d5e',pat:'gill',tail:'fork',bio:[0,0,0,0],aggr:1};
var leviathanSpec={n:'利维坦',sMin:280,sMax:280,spd:72,ry:.4,shape:'eel',c1:'#243d57',c2:'#507c94',c3:'#5ae4e0',pat:'spots',tail:'ribbon',bio:[0,0,0,0],leviathan:true,aggr:1};
SPECIES.push(flyingSpec,iceShark,giantShark,leviathanSpec);
var FLY=SPECIES.indexOf(flyingSpec),ICE_SHARK=SPECIES.indexOf(iceShark),GIANT=SPECIES.indexOf(giantShark);
REGIONS=[
 {id:'coral',name:'阳光珊瑚海',hint:'开放浅水 · 密集鱼群 · 飞鱼跃浪',min:10,color:'#8be8cb',indices:[0,0,1,1,2,3,3,4,FLY,FLY],contains:function(x,y){return y<3200&&x<19500;}},
 {id:'ice',name:'冰冠海域',hint:'浮冰顶盖 · 冷水减速 · 冰牙鲨',min:40,color:'#badfff',indices:[4,6,7,8,9,13,ICE_SHARK,ICE_SHARK],contains:function(x,y){return x>=19500&&y<6800;}},
 {id:'shelf',name:'蓝潮陆架',hint:'开阔横向海廊 · 水母关口 · 中型猎手',min:28,color:'#8bbfe2',indices:[4,5,6,7,7,8,9],contains:function(x,y){return y<6900;}},
 {id:'twilight',name:'暮光断层',hint:'食物稀少 · 大型鱼类巡游',min:65,color:'#a9acd6',indices:[8,9,10,11,12,13,14,15],contains:function(x,y){return y<10600&&x<19000;}},
 {id:'volcano',name:'熔火海域',hint:'火山喷发 · 熔岩管 · 单向激流',min:100,color:'#ffb28a',indices:[10,11,12,12,15,GIANT,GIANT],contains:function(x,y){return x>=19000&&y>=6800;}},
 {id:'abyss',name:'利维坦深渊',hint:'巨型鱼类 · 无浅海鱼群 · 利维坦领地',min:125,color:'#7ab7dd',indices:[11,12,13,GIANT,GIANT,GIANT],contains:function(){return true;}}
];
oceanRegion=function(x,y){for(var i=0;i<REGIONS.length;i++)if(REGIONS[i].contains(x,y))return i;return 5;};
zoneAt=function(x,y){var region=oceanRegion(x,y);return region===0?0:region===1?3:region===2?1:2;};
zoneW=function(x,y){return [clamp((3500-y)/1300,0,1),clamp((7600-y)/1500,0,1)*clamp((y-2500)/1100,0,1),clamp((y-7300)/2400,0,1)];};
WORLD_ROUTES=[
 {name:'珊瑚潜井',points:[[6800,2500],[6800,4800]],r:400},
 {name:'蓝潮中井',points:[[14700,2500],[14700,4800]],r:460},
 {name:'冰冠裂口',points:[[23800,2500],[23800,4800]],r:440},
 {name:'西侧返程井',points:[[3800,6200],[3800,9000]],r:420},
 {name:'单向落潮',points:[[10400,6400],[12000,9000]],r:440,oneWay:true},
 {name:'水母大门',points:[[17700,6200],[17700,9000]],r:540},
 {name:'深渊入口',points:[[8500,9700],[8500,12600]],r:470},
 {name:'火山烟囱',points:[[23200,9700],[23200,13800]],r:570},
 {name:'东侧回升井',points:[[26000,9700],[26000,12600]],r:400},
 {name:'熔岩顺流管',points:[[19900,13200],[26600,13200]],r:330,oneWay:true}
];
var OCEAN_CURRENTS=[
 {id:'down',a:[10400,6400],b:[12000,9000],radius:480,speed:850,name:'单向下潜激流',returnHint:'返程走西侧竖井'},
 {id:'lava',a:[20200,13200],b:[26300,13200],radius:390,speed:720,name:'单向熔岩激流',returnHint:'返程走东侧回升井'}
];
var JELLY_GATES=[
 {x:6800,y:3710,name:'珊瑚水母口',half:340,count:4,span:520},
 {x:17700,y:7540,name:'暮光水母帘',half:450,count:6,span:800},
 {x:8500,y:11150,name:'深渊水母哨',half:370,count:4,span:650}
];
var VOLCANO={x:23200,y:12400,period:11,warning:2,active:3.2};
CAVE_HINTS=[
 {x:6800,y:2800,title:'珊瑚潜井',sub:'水母缓慢摆动，等待空隙 ↓',min:28},
 {x:23800,y:2800,title:'冰冠裂口',sub:'冰层之下是开阔冷水海 →',min:40},
 {x:10400,y:6350,title:'单向落潮',sub:'只可顺流下潜，返程走西侧井 ↓',min:65},
 {x:17700,y:6380,title:'暮光水母帘',sub:'下层缺少小鱼，准备好再前进 ↓',min:65},
 {x:8500,y:9850,title:'利维坦深渊入口',sub:'下方无鱼群补给，巨兽正在巡游 ↓',min:125},
 {x:23200,y:9820,title:'火山烟囱',sub:'红光预警后即将喷发 ↓',min:100}
];
SITES.splice(0,SITES.length,
 {x:4300,y:2550,name:'珊瑚摇篮',sub:'鱼群与海草，旅程从这里开始',color:'#86eccb'},
 {x:24500,y:1800,name:'冰冠观测站',sub:'穿过冰蓝色的冷水海',color:'#c0e9ff'},
 {x:12500,y:5400,name:'蓝潮海廊',sub:'沿大片陆架横向探索',color:'#94c5f3'},
 {x:22500,y:9600,name:'熔火前哨',sub:'下方是火山烟囱与熔岩管',color:'#ffb18d'},
 {x:9000,y:13700,name:'远古回声',sub:'利维坦领地，建议体长 125+',color:'#a9a3f0'}
);
DEN_DEFS.splice(0,DEN_DEFS.length,
 {id:'jade',x:4700,y:3680,entry:[4000,2700],r:300,name:'珊瑚隐湾',min:25},
 {id:'heart',x:15800,y:3790,entry:[14700,3000],r:320,name:'海草夹层',min:29},
 {id:'east',x:8900,y:7460,entry:[8300,6200],r:310,name:'蓝潮暗袋',min:33}
);
function shelf(name,x,y,width,height,z,tint){
 var r={name:name,ax:x,ay:y,blobs:[],boxes:[0,0,width/2,height/2,Math.min(140,height*.2)],caves:[],k:45,z:z,tint:tint,glow:false,hang:false,spr:null};RK_list.push(r);return r;
}
bakeFloor=function(){for(var i=0;i<FLOOR.length;i++){var x=i*10;FLOOR[i]=clamp(15280+Math.sin(x*.0005)*200+Math.sin(x*.002)*75,14950,15600);}};
RK_init=function(){
 RK_list=[];RK_chambers=[];RUINS=[];
 var first=shelf('第一层：珊瑚大陆架',13600,3750,28500,1100,1,[90,117,106]);
 var second=shelf('第二层：蓝潮断层',13600,7550,28500,1250,3,[62,86,111]);
 var thirdA=shelf('第三层：深渊顶板',8000,11150,16600,1800,2,[39,53,77]);
 var thirdB=shelf('第三层：火山玄武层',23900,11150,7100,1300,2,[73,49,58]);
 first.terrainWave=[145,.4];second.terrainWave=[190,1.7];thirdA.terrainWave=[130,2.1];thirdB.terrainWave=[120,.7];
 // Only designated shafts connect broad open-water floors.
 [first,second,thirdA,thirdB].forEach(function(r){
  rockBounds(r);WORLD_ROUTES.forEach(function(path){for(var i=1;i<path.points.length;i++){
   var a=path.points[i-1],b=path.points[i],pad=path.r;
   if(Math.max(a[0],b[0])+pad<r.wx0||Math.min(a[0],b[0])-pad>r.wx1||Math.max(a[1],b[1])+pad<r.wy0||Math.min(a[1],b[1])-pad>r.wy1)continue;
   carvePath(r,[a,b],path.r);
  }});
 });
 DEN_DEFS.forEach(function(d,i){var r=i<2?first:second;carvePath(r,[d.entry,[d.x,d.y]],175);carveChamber(r,d.x,d.y,d.r);d.rock=r;});
 // One optional winding labyrinth is embedded in the third floor; open seas dominate elsewhere.
 carvePath(thirdA,MAZE_ROUTE.points,MAZE_ROUTE.r);
 carvePath(thirdA,[[12100,10800],[11400,10700]],220);carveChamber(thirdA,11400,10700,330);
 carvePath(thirdA,[[13800,11500],[14500,10800]],210);carveChamber(thirdA,14500,10800,330);
 [[11400,11500],[12900,10800],[14900,11500]].forEach(function(p){carveChamber(thirdA,p[0],p[1],390);});
 carvePath(thirdA,NARROW_SHORTCUTS[0].points,95);
 DEN_DEFS.forEach(function(d){if(d.vault)d.rock=thirdA;});
 // Upper coral has scattered solid outcrops; the majority of each sea is open water.
 for(var i=0;i<11;i++){
  var x=1100+i*1620,top=3200-(Math.sin(x*.00062+.4)+Math.sin(x*.0018+.4)*.3)*145,y=top-170-(i%3)*25;
  RK_list.push({name:'浅海珊瑚礁',ax:x,ay:y,blobs:[-130,80,210,60,20,180,180,60,140],caves:[],k:50,z:1,tint:[105,115,109],hang:false});
 }
 // Floating ice is a physical roof, not just a blue colour filter.
 var ice=shelf('浮冰顶盖',23900,190,8500,450,3,[173,215,232]);ice.ice=true;
 for(i=0;i<6;i++)RK_list.push({name:'冰下倒挂冰柱',ax:20100+i*1270,ay:410,blobs:[0,0,155,20,170,105,35,310,55],caves:[],k:35,z:3,tint:[150,199,224],ice:true,hang:false});
 var volcano={name:'深层火山',ax:23200,ay:14200,blobs:[0,700,2100,0,-100,1300,0,-1000,900,0,-1500,500],boxes:[],caves:[],k:100,z:2,tint:[81,49,54],glow:true,hang:false};
 carvePath(volcano,[[23200,11900],[23200,14300]],200);carvePath(volcano,WORLD_ROUTES[9].points,330);carvePath(volcano,WORLD_ROUTES[8].points,400);RK_list.push(volcano);
 var tube=shelf('熔岩管外壳',23200,13200,6400,1200,2,[71,43,54]);carvePath(tube,WORLD_ROUTES[9].points,330);carvePath(tube,[[23200,11900],[23200,14300]],220);carvePath(tube,WORLD_ROUTES[8].points,400);
 // The chimney must pass through both overlapping volcanic solids.
 RK_list.forEach(function(r){
  if(r.name==='浅海珊瑚礁')DEN_DEFS.filter(function(d){return !d.vault;}).forEach(function(d){carvePath(r,[d.entry,[d.x,d.y]],210);});
  rkBake(r);
 });
};
function biomeWater(x,y){
 var depth=clamp(y/CONF.WORLD_H,0,1),r=lerp(60,2,depth),g=lerp(165,11,depth),b=lerp(186,34,depth);
 var ice=clamp((x-18800)/1400,0,1)*clamp((7200-y)/1600,0,1);
 r=lerp(r,75,ice*.55);g=lerp(g,135,ice*.55);b=lerp(b,179,ice*.65);
 var fire=clamp((x-18300)/1800,0,1)*clamp((y-8100)/2400,0,1);
 return [lerp(r,52,fire*.8),lerp(g,23,fire*.8),lerp(b,37,fire*.8)];
}
buildWorldAtlas=function(){
 if(OCEAN.atlasGeometry===RK_list)return;OCEAN.atlasGeometry=RK_list;
 var c=newCanvas(160,Math.round(160*CONF.WORLD_H/CONF.WORLD_W)),g=c.getContext('2d'),im=g.createImageData(c.width,c.height),sc=c.width/CONF.WORLD_W;
 for(var y=0;y<c.height;y++)for(var x=0;x<c.width;x++){
  var wx=(x+.5)/sc,wy=(y+.5)/sc,k=(y*c.width+x)*4,col=biomeWater(wx,wy),solid=wy>floorAt(wx);
  for(var j=0;j<RK_list.length;j++){var r=RK_list[j];if(wx<r.wx0||wx>r.wx1||wy<r.wy0||wy>r.wy1)continue;if(rkField(r,wx-r.ax,wy-r.ay)<0){col=r.tint||RK_TINT[r.z];solid=true;break;}}
  if(solid&&wy>floorAt(wx))col=[19,25,38];im.data[k]=col[0];im.data[k+1]=col[1];im.data[k+2]=col[2];im.data[k+3]=255;
 }g.putImageData(im,0,0);OCEAN.atlas=c;MINIMAP_BASE=newCanvas(180,Math.round(180*CONF.WORLD_H/CONF.WORLD_W));MINIMAP_BASE.getContext('2d').drawImage(c,0,0,MINIMAP_BASE.width,MINIMAP_BASE.height);
};
var bakeBeforeBiomes=bakeBackgrounds;
bakeBackgrounds=function(){
 bakeBeforeBiomes();
 WORLD_DECORS=WORLD_DECORS.filter(function(d){return d.y<8500&&d.x<19000;});
 // Dense, distinct coral gardens live on the uppermost shelf only.
 for(var x=500,i=0;x<18500;x+=180,i++){
  var surfaces=[];RK_list.forEach(function(r){if(r.wy0<4000&&x>r.wx0&&x<r.wx1)surfaces=surfaces.concat(surfaceBands(r,x));});
  if(!surfaces.length)continue;var y=Math.min.apply(null,surfaces);
  WORLD_DECORS.push({x:x,y:y+2,z:1,spr:i%DECOR[1].length,s:.7+(i%4)*.19,ph:i});
 }
 VENTS=[{x:23200,y:12600,off:0},{x:22400,y:13500,off:3},{x:24200,y:13500,off:6}];SEEPS=[];
 WRECK.x=14900;WRECK.y=14920;SARG=[];VKELP=[];SPIRES=[];
 var g=WATER.getContext('2d'),im=g.createImageData(WATER.width,WATER.height);
 for(var y=0;y<im.height;y++)for(var x=0;x<im.width;x++){var col=biomeWater((x+.5)*64,(y+.5)*64),k=(y*im.width+x)*4;im.data[k]=col[0];im.data[k+1]=col[1];im.data[k+2]=col[2];im.data[k+3]=255;}g.putImageData(im,0,0);
 buildWorldAtlas();
};
function foodSurfaceAt(x,probe){
 var candidates=[{surface:floorAt(x),reef:null}];
 for(var i=0;i<RK_list.length;i++){var r=RK_list[i];if(x<r.wx0||x>r.wx1||r.wy1<probe||r.wy0>probe+2200)continue;var bands=surfaceBands(r,x);for(var j=0;j<bands.length;j++)if(bands[j]>probe+20)candidates.push({surface:bands[j],reef:r});}
 candidates.sort(function(a,b){return a.surface-b.surface;});return candidates[0];
}
var habitatBeforeBiomes=chooseShrimpHabitat;
chooseShrimpHabitat=function(){
 if(player.y>5500||oceanRegion(player.x,player.y)===1)return null;
 for(var attempt=0;attempt<16;attempt++){
  var x=clamp(player.x+rand(-1500,1500),180,CONF.WORLD_W-180),probe=clamp(player.y+rand(-300,300),100,5200);
  if(oceanRegion(x,probe)===1||rkInside(x,probe,20))continue;
  var hit=foodSurfaceAt(x,probe),y=hit.surface-38;
  if(y>6000||dist2(x,y,player.x,player.y)>2000*2000||rkInside(x,y,16))continue;
  if(survivalTime>1&&Math.abs(x-cam.x)<W/(2*cam.z)+50&&Math.abs(y-cam.y)<H/(2*cam.z)+50)continue;
  return {x:x,y:y,reef:hit.reef,surface:hit.surface};
 }return null;
};
var spawnFoodBeforeBiomes=spawnFood;
spawnFood=function(type,bx,by){
 if(type==='star'){if(by>6500||player.y>6500)return;spawnFoodBeforeBiomes(type,bx,by);return;}
 if(type==='shrimp'){spawnFoodBeforeBiomes(type,bx,by);return;}
 if(type==='jelly'){if(player.y>6500)return;spawnFoodBeforeBiomes(type,bx,by);return;}
 if((type==='crab'||type==='starfish')&&(player.y>5800||oceanRegion(player.x,player.y)===1))return;
 var info=FOOD_INFO[type];if(foodCount(type)>=info.cap)return;
 var hit;
 if(type==='pearl'){
  var x=clamp(player.x+rand(-1800,1800),180,CONF.WORLD_W-180),probe=clamp(player.y+rand(-250,250),80,14800);
  if(rkInside(x,probe,20))return;hit=foodSurfaceAt(x,probe);hit.x=x;hit.y=hit.surface-20;
  if(Math.abs(hit.y-player.y)>1800)return;
 }else{hit=chooseShrimpHabitat();if(!hit)return;}
 if(rkInside(hit.x,hit.y,20))return;
 var f=foodPool.length?foodPool.pop():newFood();Object.assign(f,{type:type,x:hit.x,y:hit.y,r:type==='crab'?13:11,t:rand(0,6),seed:rand(0,10),life:-1,biome:zoneAt(hit.x,hit.y),dead:false,stingCd:0,dir:Math.random()<.5?-1:1,dartT:0,turnT:rand(1,3),groundRef:hit.reef,floorHint:hit.surface});foods.push(f);
};
function oceanFoodFloor(f){if(f.groundRef){var y=shrimpSurface(f.groundRef,f.x,f.floorHint);if(y!==null){f.floorHint=y;return y;}f.dir=-f.dir;return f.floorHint;}return floorAt(f.x);}
var foodsBeforeBiomes=updateFoods;
updateFoods=function(dt){
 for(var i=0;i<foods.length;i++){
  var f=foods[i];
  if((f.type==='shrimp'||f.type==='crab'||f.type==='starfish'||f.type==='star')&&f.y>6500)f.dead=true;
 }
 foodsBeforeBiomes(dt);
};
var mermaidBeforeBiomes=updateMermaid;
updateMermaid=function(dt){if(player.y>6200){mermaid=null;mermaidNext=survivalTime+25;return;}mermaidBeforeBiomes(dt);};
// No generic cave-filling shoals: small prey belongs to upper seas.
updateCaveSchools=function(){};
var shallowSchoolBeforeBiomes=spawnShallowSchool;
spawnShallowSchool=function(){if(player.y<2600&&oceanRegion(player.x,player.y)===0)shallowSchoolBeforeBiomes();};
chooseHabitatSpecies=function(x,y,forceSmall){
 var region=oceanRegion(x,y),options=REGIONS[region].indices;
 for(var attempt=0;attempt<14;attempt++){
  var sp=SPECIES[options[Math.floor(rand(0,options.length))]],tier=tierOf(sp);
  if(region<=2&&forceSmall&&region===0&&tier>0)continue;
  if(region>=3&&sp.sMax<45)continue;
  if(tier>0&&aliveTierCount(tier)>=TIER_CAP[tier]&&region<3)continue;
  return sp;
 }
 // The fallback is still a member of the depth biome, never a shallow lanternfish.
 return SPECIES[options[options.length-1]];
};
var initBeforeBiomes=initHabitatFish;
initHabitatFish=function(f,sp,x,y,size){
 initBeforeBiomes(f,sp,x,y,size);
 if(!sp.aggr&&!sp.leviathan&&tierOf(sp)===3)f.size=size;
 var band=y<3200?0:y<6900?1:y<10600?2:3;
 f.ecologyBand=band;f.airTime=0;f.airVy=0;f.airVx=0;f.flightCooldown=rand(2,6);f.levState='patrol';f.levTimer=0;f.levCool=4;f.levTarget=0;
 return f;
};
function ecologySteering(f,x,y){
 if(!f.ecoSteer)f.ecoSteer={x:x,y:y};
 var mins=[60,4400,8400,12100],maxs=[2900,6600,10100,15000],band=f.ecologyBand;
 if(band===undefined||f.spec.rareDugong){f.ecoSteer.x=x;f.ecoSteer.y=y;return f.ecoSteer;}
 if(f.y<mins[band]+100&&y<0)y=Math.abs(y)+.3;
 if(f.y>maxs[band]-100&&y>0)y=-Math.abs(y)-.3;
 var length=Math.hypot(x,y)||1;f.ecoSteer.x=x/Math.max(1,length);f.ecoSteer.y=y/Math.max(1,length);return f.ecoSteer;
}
spawnFish=function(){
 var minR=Math.max(650,Math.hypot(W,H)/(2*Math.max(cam.z,.52))+150),maxR=minR+1050;
 for(var attempt=0;attempt<22;attempt++){
  var a=rand(-Math.PI,Math.PI),r=rand(minR,maxR),x=clamp(player.x+Math.cos(a)*r,180,CONF.WORLD_W-180),y=clamp(player.y+Math.sin(a)*r*.65,100,floorAt(player.x)-180);
  if(Math.abs(x-cam.x)<W/(2*cam.z)+90&&Math.abs(y-cam.y)<H/(2*cam.z)+90)continue;
  if(y>floorAt(x)-180||rkInside(x,y,110))continue;
  var sp=chooseHabitatSpecies(x,y,false),size=rand(sp.sMin,sp.sMax),region=oceanRegion(x,y);
  if(region===3)size=Math.max(size,48);
  if(region>=4)size=Math.max(size,70);
  if(region===5)size=Math.max(size,90);
  if(sp.flying)y=Math.min(y,350);
  if(rkInside(x,y,size*.4+20))continue;
  var f=fishPool.length?fishPool.pop():newFish();initHabitatFish(f,sp,x,y,size);fishes.push(f);return;
 }
};
populationUpdate=function(dt){
 spawnTimerAcc+=dt;if(spawnTimerAcc<.4)return;spawnTimerAcc=0;
 var region=oceanRegion(player.x,player.y),target=[120,58,78,40,30,24][region],near=0;
 for(var i=0;i<fishes.length;i++)if(!fishes[i].dead&&dist2(fishes[i].x,fishes[i].y,player.x,player.y)<3000*3000)near++;
 if(near<target&&fishes.length<185){spawnFish();if(region<3)spawnFish();}
};
function currentSample(current,x,y){
 var dx=current.b[0]-current.a[0],dy=current.b[1]-current.a[1],length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
 var along=(x-current.a[0])*ux+(y-current.a[1])*uy,side=Math.abs((x-current.a[0])*uy-(y-current.a[1])*ux);
 return {active:along>0&&along<length&&side<current.radius,ux:ux,uy:uy,along:along,length:length};
}
function applyOceanCurrents(entity,dt){
 for(var i=0;i<OCEAN_CURRENTS.length;i++){
  var flow=OCEAN_CURRENTS[i],sample=currentSample(flow,entity.x,entity.y);if(!sample.active)continue;
  var progress=entity.vx*sample.ux+entity.vy*sample.uy,boost=Math.max(flow.speed,180-progress);
  entity.x+=sample.ux*boost*dt;entity.y+=sample.uy*boost*dt;V6.current=flow.name;
 }
}
function oceanSpeedFactor(x,y){return oceanRegion(x,y)===1?.84:1;}
function volcanoPhase(){var phase=survivalTime%VOLCANO.period;return {warning:phase<VOLCANO.warning,active:phase>=VOLCANO.warning&&phase<VOLCANO.warning+VOLCANO.active,phase:phase};}
function hurtEnvironment(message,cost){
 if(player.spawnProt>0||player.invulnTimer>0)return;
 if(player.buffs.shield>0){player.buffs.shield=0;player.invulnTimer=1;banner('庇护挡下了环境伤害');return;}
 player.hunger=Math.max(0,player.hunger-cost);player.slowTimer=Math.max(player.slowTimer,1);player.hurtFlash=.45;player.invulnTimer=1.15;
 addPopup(player.x,player.y-35,message,'#ffb0a0');sfx(140,.12,'sawtooth',.04);
}
function gateJellies(gate,time){
 var result=[];
 for(var i=0;i<gate.count;i++){
  var t=gate.count===1?.5:i/(gate.count-1),y=gate.y+(t-.5)*gate.span;
  // Offset, slowly moving columns leave room to time a crossing.
  var x=gate.x+Math.sin(time*.65+i*1.7)*gate.half*.62+(i%2?.12:-.12)*gate.half;
  result.push({x:x,y:y+Math.sin(time*.8+i)*20,r:31+(i%2)*4});
 }return result;
}
function updateBiomeHazards(dt){
 V6.current='';V6.thermal=Math.max(0,V6.thermal-dt);
 if(oceanRegion(player.x,player.y)===1)player.hunger=Math.max(0,player.hunger-.25*dt);
 for(var k=0;k<JELLY_GATES.length;k++){
  var gate=JELLY_GATES[k];if(dist2(player.x,player.y,gate.x,gate.y)>1300*1300)continue;
  var jellies=gateJellies(gate,survivalTime);
  for(var j=0;j<jellies.length;j++)if(dist2(player.x,player.y,jellies[j].x,jellies[j].y)<Math.pow(player.size*.4+jellies[j].r,2))hurtEnvironment('水母蜇伤 · 饱食 -14',14);
 }
 var phase=volcanoPhase();
 if(phase.active&&Math.abs(player.x-VOLCANO.x)<170&&player.y>VOLCANO.y-1150&&player.y<VOLCANO.y+350){hurtEnvironment('火山热流 · 饱食 -18',18);V6.thermal=1;}
 if(phase.active&&player.y>13390&&player.y<13680&&player.x>21300&&player.x<25300){hurtEnvironment('熔岩管灼伤 · 饱食 -14',14);V6.thermal=1;}
}
function attemptFlight(f){
 if(f.flightCooldown>0||f.y>370||f.x>19000)return false;
 var threat=player.alive&&player.size>f.size*1.1&&dist2(f.x,f.y,player.x,player.y)<240*240?player:null;
 if(!threat){var count=queryNearby(f.x,f.y,220);for(var i=0;i<count;i++){var other=nearbyScratch[i];if(other!==f&&!other.dead&&other.size>f.size*1.4){threat=other;break;}}}
 if(!threat)return false;
 if(f.y>80){f.vy-=240;f.wanderA=-Math.PI/2;return false;}
 f.airTime=2.5;f.airVy=-350;f.airVx=(f.x<threat.x?-1:1)*300;f.flightCooldown=7;V6.flyLaunches++;
 emitRipple(f.x,0,30);emitParticles(f.x,0,5,0);return true;
}
function updateFlyingFish(f,dt){
 f.flightCooldown=Math.max(0,f.flightCooldown-dt);
 if(f.airTime>0){
  f.airTime-=dt;f.airVy+=530*dt;f.x+=f.airVx*dt;f.y+=f.airVy*dt;f.vx=f.airVx;f.vy=f.airVy;f.angle=Math.atan2(f.airVy*.35,f.airVx);f.tailPhase+=dt*6;
  if(f.x<150||f.x>19000){f.airVx=-f.airVx;f.x=clamp(f.x,150,19000);}
  if(f.y>=22&&f.airVy>0){f.y=30;f.airTime=0;f.vy=60;f.wanderA=Math.atan2(70,f.airVx);emitRipple(f.x,0,35);emitParticles(f.x,0,6,0);}
  if(player.alive&&f.size<player.size*CONF.EAT_RATIO&&dist2(f.x,f.y,player.x,player.y)<Math.pow((f.size+player.size)*.45,2)){playerEatFish(f);f.dead=true;}
  return;
 }
 updateFishBeforeBiomes(f,dt);if(!f.dead)attemptFlight(f);
}
function updateLeviathan(f,dt){
 var distance=Math.hypot(player.x-f.x,player.y-f.y);f.levCool=Math.max(0,f.levCool-dt);f.levTimer-=dt;
 var desired=f.angle,speed=105;
 if(f.levState==='patrol'){
  desired=Math.atan2(13700+Math.sin(survivalTime*.16)*420-f.y,10000+Math.sin(survivalTime*.07)*4200-f.x);
  if(player.alive&&player.y>11900&&distance<1350&&f.levCool<=0){f.levState='warning';f.levTimer=1.5;f.levTarget=Math.atan2(player.y-f.y,player.x-f.x);banner('利维坦蓄势 · 立即横向避让！');sfx(65,.4,'sine',.06);}
 }else if(f.levState==='warning'){
  desired=f.levTarget;speed=22;if(f.levTimer<=0){f.levState='charge';f.levTimer=2.1;emitRipple(f.x,f.y,260);}
 }else if(f.levState==='charge'){
  desired=f.levTarget;speed=500;if(f.levTimer<=0){f.levState='recover';f.levTimer=2.5;}
 }else{speed=43;if(f.levTimer<=0){f.levState='patrol';f.levCool=5;}}
 f.angle=lerpAngle(f.angle,desired,Math.min(1,dt*(f.levState==='charge'?1.2:1.8)));
 f.vx=Math.cos(f.angle)*speed;f.vy=Math.sin(f.angle)*speed;f.x+=f.vx*dt;f.y+=f.vy*dt;f.tailPhase+=dt*(f.levState==='charge'?7:2.5);
 f.x=clamp(f.x,650,17900);f.y=clamp(f.y,12100,floorAt(f.x)-160);rkCollide(f,false);
 if(player.alive&&gameState==='playing'&&distance<f.size*.48+player.size*.35){
  if(player.spawnProt>0||player.invulnTimer>0)return;
  if(player.buffs.shield>0){consumeShield(f);f.levState='recover';f.levTimer=3;player.invulnTimer=2;}
  else playerDie('被利维坦吞没了 · 蓄势时横向躲开冲锋');
 }
}
var updateFishBeforeBiomes=updateFish;
updateFish=function(f,dt){
 if(f.spec.leviathan){updateLeviathan(f,dt);return;}
 if(f.spec.flying){updateFlyingFish(f,dt);return;}
 updateFishBeforeBiomes(f,dt);
};
function ensureLeviathan(dt){
 V6.bossTimer+=dt;if(V6.bossTimer<2)return;V6.bossTimer=0;
 if(player.y<11600||player.x>18000||fishes.some(function(f){return !f.dead&&f.spec.leviathan;}))return;
 var halfW=W/(2*cam.z),x=player.x+(player.x>12500?-1:1)*(halfW+650),y=clamp(player.y+400,12500,14500);
 x=clamp(x,900,17200);if(Math.abs(x-cam.x)<halfW+450&&Math.abs(y-cam.y)<H/(2*cam.z)+200)return;
 var f=fishPool.length?fishPool.pop():newFish();initHabitatFish(f,leviathanSpec,x,y,280);f.size=280;f.levCool=5;fishes.push(f);
}
var updateBeforeBiomes=update;
update=function(dt){
 updateBeforeBiomes(dt);if(gameState!=='playing'||!player.alive)return;
 V6.clock+=dt;updateBiomeHazards(dt);ensureLeviathan(dt);
 V6.ecologyTimer+=dt;
 if(V6.ecologyTimer>1){
  V6.ecologyTimer=0;
  // Deep water never acquires lanternfish through a small-prey fallback or an old shoal.
  for(var i=0;i<fishes.length;i++){
   var f=fishes[i];if(f.dead||f.spec.leviathan||f.spec.rareDugong)continue;
   if(f.size<45&&f.y>8200){
    if(Math.abs(f.x-cam.x)>W/(2*cam.z)+100||Math.abs(f.y-cam.y)>H/(2*cam.z)+100)f.dead=true;
    else{f.vy=-Math.max(100,Math.abs(f.vy));f.wanderA=-Math.PI/2;}
   }
  }
 }
};
var resetBeforeBiomes=resetGame;
resetGame=function(){
 resetBeforeBiomes();V6.clock=0;V6.bossTimer=0;V6.ecologyTimer=0;V6.flyLaunches=0;V6.thermal=0;V6.growthUntil=0;NARROW_SHORTCUTS.forEach(function(g){g.inside=false;g.compressed=false;g.warnUntil=0;});
 for(var i=0;i<fishes.length;i++)if(!fishes[i].dead&&fishes[i].born===-1)fishes[i].ecologyBand=0;
 // Early surface flyers are visible during normal shallow-water exploration.
 for(i=0;i<5;i++){var x=player.x+rand(-600,600),y=rand(80,250),f=fishPool.length?fishPool.pop():newFish();initHabitatFish(f,flyingSpec,x,y,rand(7,9));f.flightCooldown=0;fishes.push(f);}
};
var distantShoalsBeforeBiomes=FF_draw;
FF_draw=function(time){if(cam.y-H/(2*cam.z)<3000&&cam.x<19300)distantShoalsBeforeBiomes(time);};
oceanZoomCap=function(){var region=oceanRegion(player.x,player.y);return region>=3?.72:region===1?.95:player.y>3200?.95:1.2;};

var MAZE_ROUTE={name:'鲸骨迷宫主道',points:[[10800,9700],[10800,11500],[12100,11500],[12100,10800],[13800,10800],[13800,11500],[15600,11500],[15600,12500]],r:300};
var NARROW_SHORTCUTS=[{name:'鲸骨窄缝捷径',points:[[14900,9700],[14900,11500]],limit:70}];
WORLD_ROUTES.push(MAZE_ROUTE);
for(var herd=0;herd<12;herd++){
 var room=Math.floor(herd/4),centers=[[11400,11500],[12900,10800],[14900,11500]],c=centers[room];
 DEN_DEFS.push({id:'vault-'+herd,x:c[0]+(herd%2?90:-90),y:c[1]+(herd%4<2?-80:80),entry:[10800,9700],r:180,name:'鲸骨迷宫儒艮群',min:38,vault:true,size:24+herd%3*3});
}
updateDugongDens=function(dt){
 OCEAN.denTimer+=dt;if(OCEAN.denTimer<1)return;OCEAN.denTimer=0;
 DEN_DEFS.forEach(function(d,i){
  if(OCEAN.harvested[d.id]||dist2(player.x,player.y,d.x,d.y)>2200*2200)return;
  if(!OCEAN.seen[d.id]&&dist2(player.x,player.y,d.x,d.y)<420*420){OCEAN.seen[d.id]=true;banner(d.vault?'发现鲸骨迷宫 · 深处聚集着限量儒艮群':'发现隐藏海草床 · '+d.name);}
  if(fishes.some(function(f){return !f.dead&&f.rareDen===d.id;}))return;
  var f=fishPool.length?fishPool.pop():newFish();initHabitatFish(f,dugongSpec,d.x,d.y,d.size||20+i*3);f.rareDen=d.id;f.vault=!!d.vault;f.nutrition=d.vault?2.2:4.5;fishes.push(f);
 });
};
var growthBeforeV6Rare=fishGrowth;
fishGrowth=function(f){return f.spec.rareDugong?(f.nutrition||4.5):growthBeforeV6Rare(f);};
playerEatFish=function(f){
 var before=player.size;eatBeforeDugong(f);
 if(f.spec.rareDugong){OCEAN.harvested[f.rareDen]=true;expedition.species['儒艮']=true;score+=f.vault?70:120;addPopup(player.x,player.y-50,'秘境营养 · 体长 +'+(f.nutrition||4.5),'#c3f1bb',true);}
 if(Math.floor(before/10)!==Math.floor(player.size/10)||f.spec.rareDugong){
  V6.growthUntil=survivalTime+8;
  V6.growthText='体长 '+player.size.toFixed(1)+' · '+(player.size>70?'窄缝捷径已不适合；走宽阔主道与东侧出口':'迷宫主道和返程口均可容纳最大体型');
 }
};
var currentPhysicsBeforeNarrow=applyOceanCurrents;
applyOceanCurrents=function(entity,dt){
 currentPhysicsBeforeNarrow(entity,dt);
 if(entity!==player)return;
 NARROW_SHORTCUTS.forEach(function(g){
  var x=g.points[0][0],y0=g.points[0][1],y1=g.points[1][1];
  var inside=Math.abs(entity.x-x)<100&&entity.y>y0&&entity.y<y1;
  if(!inside){g.inside=false;g.compressed=false;return;}
  if(entity.size<=g.limit){g.inside=true;return;}
  if(g.inside){g.compressed=true;return;} // Growth inside a shortcut may always finish the crossing.
  var previousY=entity.y-entity.vy*dt;
  entity.y=previousY<(y0+y1)/2?y0-2:y1+2;entity.vy=0;
  if(!g.warnUntil||survivalTime>g.warnUntil){banner('窄缝仅适合体长 70 以下 · 请走鲸骨迷宫主入口');g.warnUntil=survivalTime+5;}
 });
};
var drawFishBeforeBiomes=drawFishSprite;
drawFishSprite=function(f,x,y,s,a,t,inflate,isPlayer,time){
 if(isPlayer||(!f.spec.flying&&!f.spec.leviathan)){var folded=isPlayer&&NARROW_SHORTCUTS.some(function(g){return g.compressed;});drawFishBeforeBiomes(f,x,y,folded?s*.68:s,a,t,inflate,isPlayer,time);return;}
 ctx.save();ctx.translate(x,y);ctx.rotate(a);if(Math.cos(a)<0)ctx.scale(1,-1);
 if(f.spec.flying){
  var spread=f.airTime>0?1:.5;ctx.fillStyle='rgba(150,218,232,.72)';
  ctx.beginPath();ctx.moveTo(s*.2,-s*.15);ctx.lineTo(-s*.7,-s*1.65*spread);ctx.lineTo(-s*.85,-s*.12);ctx.fill();
  ctx.beginPath();ctx.moveTo(s*.2,s*.15);ctx.lineTo(-s*.7,s*1.65*spread);ctx.lineTo(-s*.85,s*.12);ctx.fill();
  ctx.fillStyle='#b2e5e9';ctx.beginPath();ctx.ellipse(0,0,s*1.25,s*.28,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4287a5';ctx.beginPath();ctx.moveTo(-s,0);ctx.lineTo(-s*1.7,-s*.48);ctx.lineTo(-s*1.4,0);ctx.lineTo(-s*1.7,s*.48);ctx.fill();ctx.fillStyle='#153642';ctx.beginPath();ctx.arc(s*.85,-s*.06,s*.08,0,Math.PI*2);ctx.fill();
 }else{
  // A long, articulated silhouette is unmistakably larger than ordinary sharks.
  for(var i=11;i>=0;i--){
   var xx=-i*s*.22,yy=Math.sin(t-i*.42)*s*.12*(i/11),radius=s*(.43-i*.025);
   ctx.fillStyle=i%2?'#29465e':'#315169';ctx.beginPath();ctx.ellipse(xx,yy,s*.3,radius,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#6cc8d2';ctx.globalAlpha=.65;ctx.beginPath();ctx.arc(xx,yy-radius*.45,Math.max(2,s*.012),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
  ctx.fillStyle='#365870';ctx.beginPath();ctx.moveTo(s*.55,-s*.12);ctx.quadraticCurveTo(s*.3,-s*.5,-s*.35,-s*.42);ctx.lineTo(-s*.55,s*.3);ctx.quadraticCurveTo(s*.35,s*.45,s*.6,s*.18);ctx.closePath();ctx.fill();
  ctx.fillStyle='#152b41';ctx.beginPath();ctx.moveTo(s*.58,s*.04);ctx.lineTo(-s*.05,s*.1);ctx.lineTo(s*.5,s*.3);ctx.fill();
  ctx.fillStyle='#e3e8d2';for(i=0;i<7;i++){var xx=s*(.02+i*.07);ctx.beginPath();ctx.moveTo(xx,s*.09);ctx.lineTo(xx+s*.025,s*.19);ctx.lineTo(xx+s*.045,s*.09);ctx.fill();}
  ctx.strokeStyle='#7799a6';ctx.lineWidth=s*.035;ctx.beginPath();ctx.moveTo(-s*.1,-s*.35);ctx.lineTo(-s*.5,-s*.7);ctx.moveTo(s*.16,-s*.3);ctx.lineTo(s*.1,-s*.68);ctx.stroke();
  ctx.fillStyle=f.levState==='warning'?'#ff7866':'#a4f4dc';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(s*.23,-s*.16,s*.036,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 }
 ctx.restore();
 if(f.spec.leviathan){
  ctx.save();ctx.textAlign='center';ctx.font='600 15px system-ui';ctx.fillStyle=f.levState==='warning'?'#ff9e8a':'#a9d7e4';ctx.fillText('利维坦 · '+(f.levState==='warning'?'蓄势，侧向避让！':f.levState==='charge'?'冲锋':'远古深海巨兽'),x,y-s*.65);
  if(f.levState==='warning'){ctx.strokeStyle='#ff967d99';ctx.setLineDash([10,12]);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(f.levTarget)*1000,y+Math.sin(f.levTarget)*1000);ctx.stroke();}ctx.restore();
 }
};
var reliefBeforeBiomes=drawOceanRelief;
drawOceanRelief=function(time){
 reliefBeforeBiomes(time);ctx.save();
 var left=cam.x-W/(2*cam.z),top=cam.y-H/(2*cam.z),width=W/cam.z,height=H/cam.z;
 if(cam.x>18600&&top<6800){
  ctx.strokeStyle='rgba(194,237,255,.25)';ctx.lineWidth=2;
  // Crystalline water and refracted diagonal light distinguish the frozen sea.
  for(var i=0;i<9;i++){var x=19600+i*900;ctx.beginPath();ctx.moveTo(x,400);ctx.lineTo(x+500,2500);ctx.stroke();}
  ctx.fillStyle='#c7f0ff';for(i=0;i<32;i++){var x=left+((i*137+time*5)%Math.max(1,width)),y=top+((i*93+time*17)%Math.max(1,height));if(x<19500||y>6800)continue;ctx.globalAlpha=.12+i%3*.04;ctx.fillRect(x,y,2/cam.z,3/cam.z);}ctx.globalAlpha=1;
 }
 if(cam.x>18000&&cam.y>8000){
  var glow=ctx.createRadialGradient(VOLCANO.x,VOLCANO.y,60,VOLCANO.x,VOLCANO.y,1800);glow.addColorStop(0,'rgba(255,88,36,.17)');glow.addColorStop(1,'rgba(255,60,20,0)');ctx.fillStyle=glow;ctx.fillRect(VOLCANO.x-1800,VOLCANO.y-1800,3600,3600);
 }
 ctx.restore();
};
function drawCurrentArrows(flow,time){
 var sample=currentSample(flow,flow.a[0]+1,flow.a[1]+1),ux=sample.ux,uy=sample.uy,length=sample.length;
 ctx.save();ctx.strokeStyle='rgba(117,216,242,.48)';ctx.lineWidth=2;
 for(var offset=0;offset<length;offset+=220){var along=(offset+time*130)%length,x=flow.a[0]+ux*along,y=flow.a[1]+uy*along;
  if(Math.abs(x-cam.x)>W/(2*cam.z)+100||Math.abs(y-cam.y)>H/(2*cam.z)+100)continue;
  for(var side=-1;side<=1;side++){
   var xx=x-uy*side*120,yy=y+ux*side*120;
   ctx.beginPath();ctx.moveTo(xx-ux*36,yy-uy*36);ctx.lineTo(xx+ux*20,yy+uy*20);ctx.moveTo(xx+ux*8-uy*10,yy+uy*8+ux*10);ctx.lineTo(xx+ux*20,yy+uy*20);ctx.lineTo(xx+ux*8+uy*10,yy+uy*8-ux*10);ctx.stroke();
  }
 }ctx.restore();
}
drawExpeditionWorld=function(time){
 worldDrawBeforeCaves(time);ctx.save();
 CAVE_HINTS.forEach(function(p){if(Math.abs(p.x-cam.x)>W/(2*cam.z)+100||Math.abs(p.y-cam.y)>H/(2*cam.z)+100)return;ctx.textAlign='center';ctx.font='600 16px system-ui';ctx.fillStyle=player.size<p.min?'#f1bc91':'#abdcd9';ctx.fillText(p.title,p.x,p.y-35);ctx.font='12px system-ui';ctx.fillText(p.sub+' · 建议 '+p.min+'+',p.x,p.y-12);});
 OCEAN_CURRENTS.forEach(function(flow){drawCurrentArrows(flow,time);});
 JELLY_GATES.forEach(function(gate){if(Math.abs(gate.x-cam.x)>W/(2*cam.z)+550||Math.abs(gate.y-cam.y)>H/(2*cam.z)+850)return;var jellies=gateJellies(gate,survivalTime);jellies.forEach(function(j){ctx.globalAlpha=.8;ctx.drawImage(SP.jelly,j.x-j.r,j.y-j.r,j.r*2,j.r*2.5);});ctx.globalAlpha=1;ctx.font='12px system-ui';ctx.fillStyle='#dfb9f4';ctx.textAlign='center';ctx.fillText(gate.name+' · 等待空隙',gate.x,gate.y-gate.span/2-80);});
 var phase=volcanoPhase();
 if(Math.abs(VOLCANO.x-cam.x)<W/(2*cam.z)+900&&Math.abs(VOLCANO.y-cam.y)<H/(2*cam.z)+1800){
  ctx.fillStyle=phase.active?'rgba(255,109,39,.55)':phase.warning?'rgba(255,153,75,.3)':'rgba(230,88,36,.16)';
  ctx.beginPath();ctx.ellipse(VOLCANO.x,VOLCANO.y+230,190,70,0,0,Math.PI*2);ctx.fill();
  if(phase.active||phase.warning){
   var plume=ctx.createLinearGradient(0,VOLCANO.y-1200,0,VOLCANO.y+200);plume.addColorStop(0,'rgba(255,93,30,0)');plume.addColorStop(1,phase.active?'rgba(255,113,34,.56)':'rgba(255,150,55,.2)');ctx.fillStyle=plume;ctx.fillRect(VOLCANO.x-150,VOLCANO.y-1200,300,1450);
  }
  ctx.textAlign='center';ctx.fillStyle='#ffbc8c';ctx.font='14px system-ui';ctx.fillText(phase.active?'火山喷发 · 避开热流':phase.warning?'火山蓄压 · 即将喷发':'火山间歇 · 可以通过',VOLCANO.x,VOLCANO.y-500);
 }
 // Lava seams are inside the one-way tube, leaving a cool central lane.
 if(cam.x>18500&&cam.y>11500){ctx.strokeStyle='rgba(255,116,60,.65)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(20900,13520);ctx.bezierCurveTo(22400,13470,24100,13580,25500,13500);ctx.stroke();}
 DEN_DEFS.forEach(function(d){
  if(d.vault||Math.abs(d.x-cam.x)>W/(2*cam.z)+400||Math.abs(d.y-cam.y)>H/(2*cam.z)+400)return;
  ctx.strokeStyle='#84b69c';ctx.lineWidth=2;
  for(var i=0;i<10;i++){var x=d.x-120+i*25,bands=surfaceBands(d.rock,x),y=bands.find(function(y){return y>d.y+20;});if(!y)continue;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.sin(time+i)*15,y-40,x-10,y-75);ctx.stroke();}
  if(OCEAN.seen[d.id]){ctx.font='13px system-ui';ctx.fillStyle='#c2e1bd';ctx.textAlign='center';ctx.fillText(d.name,d.x,d.y-65);}
 });
 if(Math.abs(cam.x-13300)<W/(2*cam.z)+3000&&cam.y>9800&&cam.y<12600){
  ctx.font='14px system-ui';ctx.fillStyle='#ddd6b2';ctx.textAlign='center';ctx.fillText('鲸骨迷宫 · 主道适合所有体型 · 东侧有宽出口',12900,10400);
 }
 var shortcut=NARROW_SHORTCUTS[0];if(Math.abs(shortcut.points[0][0]-cam.x)<W/(2*cam.z)+250&&Math.abs(shortcut.points[0][1]-cam.y)<H/(2*cam.z)+350){ctx.font='13px system-ui';ctx.fillStyle=player.size>70?'#ffb596':'#cbdbbd';ctx.textAlign='center';ctx.fillText('窄缝捷径 · 体长 ≤70 · 主入口在西侧',14900,9500);}
 ctx.restore();
};
var hudBeforeBiomes=drawHUD;
drawHUD=function(time){
 hudBeforeBiomes(time);ctx.save();ctx.textAlign='center';
 if(NARROW_SHORTCUTS.some(function(g){return g.compressed;})){ctx.fillStyle='#d4f2c6';ctx.font='13px system-ui';ctx.fillText('正在收鳍通过窄缝 · 出口后恢复体型',W/2,H-88);}
 if(V6.growthUntil>survivalTime){ctx.fillStyle='#d4f2c6';ctx.font='13px system-ui';ctx.fillText(V6.growthText,W/2,H-65);}
 if(oceanRegion(player.x,player.y)>=3&&player.size<REGIONS[oceanRegion(player.x,player.y)].min){ctx.fillStyle='#f6bf9d';ctx.font='12px system-ui';ctx.fillText('深层补给稀少 · 先成长再下潜，或及时返回上层',W/2,105);}
 ctx.restore();
};
drawChart=function(){
 var c=el('t-chart'),r=c.getBoundingClientRect();if(!r.width||!OCEAN.atlas)return;
 c.width=Math.round(r.width*DPR);c.height=Math.round(r.height*DPR);var g=c.getContext('2d');g.scale(DPR,DPR);
 var scale=Math.min(r.width/CONF.WORLD_W,(r.height-36)/CONF.WORLD_H),ox=(r.width-CONF.WORLD_W*scale)/2,oy=30;
 g.font='11px system-ui';g.fillStyle='#adc8d4';g.fillText(r.width<650?'紫=水母 · 蓝箭头=单向激流 · 数字=体长':'横向陆架分层 · 紫色水母关口 · 蓝箭头为单向激流 · 数字为建议体长',8,15);
 g.save();g.translate(ox,oy);g.drawImage(OCEAN.atlas,0,0,CONF.WORLD_W*scale,CONF.WORLD_H*scale);
 g.setLineDash([3,4]);g.lineWidth=1;g.strokeStyle='#a8d4df88';WORLD_ROUTES.forEach(function(route){g.beginPath();route.points.forEach(function(p,i){if(!i)g.moveTo(p[0]*scale,p[1]*scale);else g.lineTo(p[0]*scale,p[1]*scale);});g.stroke();});g.setLineDash([]);
 var labels=[{x:900,y:1200,t:'珊瑚海 · 10+'},{x:20600,y:1200,t:'冰冠 · 40+'},{x:8500,y:5400,t:'蓝潮陆架 · 28+'},{x:9000,y:9300,t:'暮光 · 65+'},{x:20900,y:9800,t:'火山 · 100+'},{x:6500,y:14100,t:'利维坦深渊 · 125+'}];
 labels.forEach(function(p){g.font='12px system-ui';g.fillStyle='#e0edef';g.fillText(p.t,p.x*scale,p.y*scale);});
 SITES.forEach(function(p,i){g.fillStyle=expedition.sites[i]?'#a4e9b7':'#ffe1a2';g.beginPath();g.arc(p.x*scale,p.y*scale,3.5,0,Math.PI*2);g.fill();});
 JELLY_GATES.forEach(function(j){g.fillStyle='#e9a8ef';g.font='14px system-ui';g.fillText('◉',j.x*scale-5,j.y*scale+5);});
 OCEAN_CURRENTS.forEach(function(flow){var dx=flow.b[0]-flow.a[0],dy=flow.b[1]-flow.a[1],length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,x=(flow.a[0]+flow.b[0])/2*scale,y=(flow.a[1]+flow.b[1])/2*scale;g.strokeStyle='#8de7ff';g.lineWidth=2;g.beginPath();g.moveTo(x-ux*12,y-uy*12);g.lineTo(x+ux*12,y+uy*12);g.lineTo(x+ux*3-uy*6,y+uy*3+ux*6);g.moveTo(x+ux*12,y+uy*12);g.lineTo(x+ux*3+uy*6,y+uy*3-ux*6);g.stroke();});
 g.fillStyle='#ffad77';g.font='13px system-ui';g.fillText('▲',VOLCANO.x*scale-5,VOLCANO.y*scale);
 g.fillStyle='#e7d8ae';g.font='11px system-ui';g.fillText('鲸骨迷宫 · 窄缝≤70',11000*scale,11000*scale);
 g.fillStyle='#fff6bd';g.beginPath();g.arc(player.x*scale,player.y*scale,4,0,Math.PI*2);g.fill();g.restore();
};
var syncBeforeBiomes=fullSync;
fullSync=function(){
 syncBeforeBiomes();el('t-goal').textContent=expedition.won?'远征完成 · 探索全部秘境':'信标 '+expedition.discovered+'/5 · 成长 '+Math.min(EXPEDITION_TARGET,player.size).toFixed(0)+'/'+EXPEDITION_TARGET;
};
el('t-map').querySelector('span').textContent='深蓝海图 · 海域与陆架分层';
el('t-description').innerHTML='浅海追逐飞鱼，穿过水母关口，在冰冠、火山与深渊间冒险。<br>大片陆架由竖井连接；鲸骨迷宫深处藏着限量儒艮群。';
el('t-menu').querySelector('.t-grid div:nth-child(2)').innerHTML='<b>每层海域，都有不同的生存法则</b>记录 5 座信标并成长至体长 110<br>深层少小鱼；激流单向，喷发前有预警';
el('t-menu').querySelector('.t-grid div:nth-child(1)').innerHTML='<b>捕食与探索，推动成长</b>绿色小鱼可吃，深渊巨兽需要躲避<br>鲸骨秘境的儒艮群每只每局仅奖励一次';
// Authored structures occupy parts of the open floors, not their whole width.
var FEATURE_PATHS=[
 {name:'沉城主廊',points:[[10300,5200],[11700,4800],[12900,4800],[12900,5600],[14100,5600],[15300,5600],[15300,6400],[16600,6400]],r:280},
 {name:'沉城回环',points:[[11700,4800],[11700,6400],[12900,6400],[14100,6400],[14100,4800],[15300,4800],[16600,4800]],r:270},
 {name:'冰下横廊',points:[[21600,4800],[22900,4800],[24000,5400],[25000,4800],[26900,4800]],r:300},
 {name:'冰下回环',points:[[22900,4800],[23000,6100],[25200,6100],[25000,4800]],r:280},
 {name:'冰冠深井',points:[[25200,6100],[25200,9200]],r:360},
 {name:'火山斜谷',points:[[17700,8800],[18200,9600],[19800,9800]],r:350},
 {name:'珊瑚穿礁',points:[[9400,1650],[11000,1700],[12600,1600]],r:290},
 {name:'海藻林回廊',points:[[4650,6150],[5800,5920],[6950,6100]],r:280},
 {name:'火山侧洞',points:[[19400,9500],[20800,9400],[22400,9600]],r:300}
];
WORLD_ROUTES.push.apply(WORLD_ROUTES,FEATURE_PATHS);
var SUPPLY_CACHES=[
 {id:'city',x:12700,y:6650,name:'沉城补给'},
 {id:'ice',x:24200,y:6000,name:'冰冠遗物'},
 {id:'vent',x:20800,y:9900,name:'火山勘探箱'}
];
function extraRock(name,x,y,blobs,z,tint){var r={name:name,ax:x,ay:y,blobs:blobs,boxes:[],caves:[],k:60,z:z,tint:tint,hang:false,feature:true};RK_list.push(r);return r;}
var terrainBeforeFeatures=RK_init;
RK_init=function(){
 terrainBeforeFeatures();
 // Break up the surface with an inhabited arch and a western coastal headland.
 var coast=shelf('西部大陆岬角',1250,2050,2600,2800,1,[87,116,103]);coast.terrainWave=[100,.6];
 carvePath(coast,[[2200,1600],[1900,2400],[2600,2850]],250);carveChamber(coast,1900,2400,430);
 var arch=extraRock('珊瑚穿礁岛',11000,1700,[-600,100,550,0,-100,680,650,100,500],1,[111,121,112]);carvePath(arch,FEATURE_PATHS[6].points,290);
 var forest=extraRock('海藻巨柱林',5800,6100,[-400,0,450,0,-400,550,430,100,450,50,500,750],1,[58,104,95]);carvePath(forest,FEATURE_PATHS[7].points,280);
 // A rectangular multi-room maze, with loops, dead ends and distinct entrances.
 var city=shelf('沉城矩形迷宫',13700,5580,5700,2600,3,[68,90,111]);city.feature=true;
 carvePath(city,FEATURE_PATHS[0].points,280);carvePath(city,FEATURE_PATHS[1].points,270);
 [[11700,4800],[12900,4800],[12900,5600],[14100,5600],[15300,5600],[15300,6400],[11700,6400],[14100,6400],[14100,4800],[15300,4800]].forEach(function(p,i){carveChamber(city,p[0],p[1],i%3===0?410:350);});
 carvePath(city,[[12900,6400],[12700,6650]],200);carveChamber(city,12700,6650,230);
 carvePath(city,[[12900,5600],[13500,5200]],190);carveChamber(city,13500,5200,260);
 carvePath(city,[[12900,5600],[12500,5400]],280);carveChamber(city,12500,5400,340);
 var ice=shelf('冰下多层洞窟',24300,5480,4300,2450,3,[147,190,213]);ice.ice=true;ice.feature=true;
 carvePath(ice,FEATURE_PATHS[2].points,300);carvePath(ice,FEATURE_PATHS[3].points,280);carvePath(ice,FEATURE_PATHS[4].points,360);
 [[22900,4800],[24000,5400],[25000,4800],[23000,6100],[25200,6100]].forEach(function(p){carveChamber(ice,p[0],p[1],370);});carvePath(ice,[[24000,5400],[24200,6000]],210);carveChamber(ice,24200,6000,320);
 [[3400,9700],[6700,9550],[14500,9500]].forEach(function(p,i){
  var bridge=extraRock('鲸骨断桥礁',p[0],p[1],[-430,150,440,0,-230,480,430,160,430,0,500,600],2,[48,70,91]);
  carvePath(bridge,[[p[0]-1100,p[1]+120],[p[0],p[1]-50],[p[0]+1100,p[1]+100]],270);
 });
 var divider=shelf('暮光断崖',18200,9400,1400,3400,2,[49,57,78]);divider.feature=true;carvePath(divider,FEATURE_PATHS[5].points,350);
 var vent=extraRock('火山侧洞群',20800,9500,[-600,150,650,0,-100,750,600,100,600],2,[85,52,60]);carvePath(vent,FEATURE_PATHS[8].points,300);carvePath(vent,[[20800,9400],[20800,9900]],230);carveChamber(vent,20800,9900,320);
 [3000,6200,13400,16900].forEach(function(x,i){extraRock('深渊海山',x,15000,[-160,150,650,160,-200,570,0,-550,330],2,[34,48,67]);});
 // All intended cross-level routes cut every overlapping solid, including new islands.
 RK_list.forEach(function(r){
  rockBounds(r);
  WORLD_ROUTES.forEach(function(route){for(var i=1;i<route.points.length;i++){
   var a=route.points[i-1],b=route.points[i],pad=route.r;
   if(Math.max(a[0],b[0])+pad<r.wx0||Math.min(a[0],b[0])-pad>r.wx1||Math.max(a[1],b[1])+pad<r.wy0||Math.min(a[1],b[1])-pad>r.wy1)continue;
   carvePath(r,[a,b],route.r);
  }});
  NARROW_SHORTCUTS.forEach(function(g){var a=g.points[0],b=g.points[1];if(a[0]+100<r.wx0||a[0]-100>r.wx1||b[1]+100<r.wy0||a[1]-100>r.wy1)return;carvePath(r,g.points,95);});
  // Secret pockets remain connected even where an outcrop meets its parent shelf.
  DEN_DEFS.filter(function(d){return !d.vault;}).forEach(function(d){var x=d.entry[0],y=d.entry[1];if(Math.max(x,d.x)+210<r.wx0||Math.min(x,d.x)-210>r.wx1||Math.max(y,d.y)+210<r.wy0||Math.min(y,d.y)-210>r.wy1)return;carvePath(r,[[x,y],[d.x,d.y]],210);});
  if(r.name!=='第三层：深渊顶板')SUPPLY_CACHES.forEach(function(p){if(p.x>r.wx0&&p.x<r.wx1&&p.y>r.wy0&&p.y<r.wy1)carveChamber(r,p.x,p.y,240);});
  rkBake(r);
 });
};
var resetBeforeFeatures=resetGame;
resetGame=function(){
 resetBeforeFeatures();V6.supplies={};
 fishes.forEach(function(f){if(f.dead||f.born!==-1)return;
  for(var i=0;i<12&&rkInside(f.x,f.y,25);i++){var a=i*2.4;f.x=player.x+Math.cos(a)*(180+i*25);f.y=player.y+Math.sin(a)*240;}
  if(rkInside(f.x,f.y,20))f.dead=true;f.hx=f.x;f.hy=f.y;
 });
};
var updateBeforeFeatures=update;
update=function(dt){
 updateBeforeFeatures(dt);if(gameState!=='playing'||!player.alive)return;
 SUPPLY_CACHES.forEach(function(p){if(!V6.supplies[p.id]&&dist2(p.x,p.y,player.x,player.y)<80*80){V6.supplies[p.id]=true;player.hunger=Math.min(100,player.hunger+55);score+=100;banner(p.name+' · 饱食 +55 · 本局仅一次');emitRipple(p.x,p.y,100);}});
};
var drawBeforeFeatureMarkers=drawExpeditionWorld;
drawExpeditionWorld=function(time){
 drawBeforeFeatureMarkers(time);ctx.save();
 SUPPLY_CACHES.forEach(function(p){
  if(V6.supplies&&V6.supplies[p.id]||Math.abs(p.x-cam.x)>W/(2*cam.z)+100||Math.abs(p.y-cam.y)>H/(2*cam.z)+100)return;
  ctx.fillStyle='#8daf9d';ctx.fillRect(p.x-22,p.y-15,44,30);ctx.strokeStyle='#d9d9ac';ctx.lineWidth=2;ctx.strokeRect(p.x-22,p.y-15,44,30);ctx.beginPath();ctx.moveTo(p.x,p.y-15);ctx.lineTo(p.x,p.y+15);ctx.stroke();ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle='#d8e5ba';ctx.fillText(p.name,p.x,p.y-28);
 });ctx.restore();
};

function replaceWorldAtlas(canvas){OCEAN.atlas=canvas;MINIMAP_BASE.getContext('2d').clearRect(0,0,MINIMAP_BASE.width,MINIMAP_BASE.height);MINIMAP_BASE.getContext('2d').drawImage(canvas,0,0,MINIMAP_BASE.width,MINIMAP_BASE.height);}
function requestWorldAtlas(forceFallback){
 if(V6.atlasRequested&&!forceFallback)return;V6.atlasRequested=true;
 if(STREAM.worker&&!forceFallback){
  var rocks=RK_list.map(function(r){return {ax:r.ax,ay:r.ay,blobs:r.blobs,boxes:r.boxes,caves:r.caves,k:r.k,z:r.z,tint:r.tint,terrainWave:r.terrainWave,wx0:r.wx0,wx1:r.wx1,wy0:r.wy0,wy1:r.wy1};});
  STREAM.worker.postMessage({type:'atlas',id:-1,rocks:rocks});return;
 }
 if(V6.atlasFallbackStarted)return;V6.atlasFallbackStarted=true;
 var c=newCanvas(500,Math.round(500*CONF.WORLD_H/CONF.WORLD_W)),g=c.getContext('2d'),im=g.createImageData(c.width,c.height),row=0;
 function batch(){var end=performance.now()+2;
  do{for(var x=0;x<c.width;x++){
   var wx=(x+.5)/c.width*CONF.WORLD_W,wy=(row+.5)/c.height*CONF.WORLD_H,col=biomeWater(wx,wy),k=(row*c.width+x)*4;
   for(var i=0;i<RK_list.length;i++){var r=RK_list[i];if(wx<r.wx0||wx>r.wx1||wy<r.wy0||wy>r.wy1)continue;if(rkField(r,wx-r.ax,wy-r.ay)<0){col=r.tint||RK_TINT[r.z];break;}}
   if(wy>floorAt(wx))col=[19,25,38];im.data[k]=col[0];im.data[k+1]=col[1];im.data[k+2]=col[2];im.data[k+3]=255;
  }row++;}while(row<c.height&&performance.now()<end);
  if(row<c.height)setTimeout(batch,0);else{g.putImageData(im,0,0);replaceWorldAtlas(c);}
 }setTimeout(batch,0);
}
// V6.3 shallow scenery: rooted broad-leaf kelp and an enterable coastal wreck.
var SHALLOW_SCENERY={plants:[],chunks:new Map(),sprites:[],seen:false,stocked:false};
var SHALLOW_WRECK={x:8750,y:0,ground:0,name:'潮汐号沉船',rock:null};
function shallowGround(x){
 var best=null;
 RK_list.forEach(function(r){
  if(x<r.wx0+10||x>r.wx1-10||r.wy0>3900)return;
  var top=Math.max(650,r.wy0),bottom=Math.min(3850,r.wy1),previous=rkField(r,x-r.ax,top-r.ay);
  for(var y=top+24;y<bottom;y+=24){var d=rkField(r,x-r.ax,y-r.ay);
   if(previous>=0&&d<0){var lo=y-24,hi=y;for(var i=0;i<10;i++){var mid=(lo+hi)/2;if(rkField(r,x-r.ax,mid-r.ay)<0)hi=mid;else lo=mid;}if(best===null||hi<best)best=hi;break;}
   previous=d;
  }
 });return best;
}
var terrainBeforeShallowScenery=RK_init;
RK_init=function(){
 terrainBeforeShallowScenery();
 // Clear a natural berth instead of placing the hull through an existing coral rock.
 RK_list=RK_list.filter(function(r){return r.name!=='浅海珊瑚礁'||Math.abs(r.ax-SHALLOW_WRECK.x)>1100;});
 var ground=Infinity;for(var x=SHALLOW_WRECK.x-680;x<=SHALLOW_WRECK.x+680;x+=80){var y=shallowGround(x);if(y!==null)ground=Math.min(ground,y);}
 SHALLOW_WRECK.ground=ground-4;SHALLOW_WRECK.y=ground-184;
 var r={name:'潮汐号沉船船体',ax:SHALLOW_WRECK.x,ay:SHALLOW_WRECK.y,blobs:[],boxes:[0,0,730,180,85],caves:[],k:30,z:1,tint:[119,86,62],hang:false,ship:true};
 carvePath(r,[[r.ax-1000,r.ay],[r.ax+1000,r.ay]],132);
 carveChamber(r,r.ax-200,r.ay,155);carveChamber(r,r.ax+230,r.ay,155);
 carvePath(r,[[r.ax-220,r.ay-430],[r.ax-220,r.ay]],95);
 rkBake(r);RK_list.push(r);SHALLOW_WRECK.rock=r;
 var cache=SUPPLY_CACHES.find(function(p){return p.id==='shallow-wreck';});
 if(!cache){cache={id:'shallow-wreck',name:'沉船船舱补给'};SUPPLY_CACHES.push(cache);}
 cache.x=r.ax+240;cache.y=r.ay;
 // Precompute short plank segments against the same solid hull used by collision.
 SHALLOW_WRECK.planks=[];
 for(y=-155;y<=155;y+=23){var open=null;for(x=-720;x<=740;x+=12){var solid=x<=720&&rkField(r,x,y)<-7;if(solid&&open===null)open=x;if(!solid&&open!==null){SHALLOW_WRECK.planks.push([open,y,x-12,y]);open=null;}}}
};
function bakeBroadKelp(seed){
 var c=newCanvas(192,1536),g=c.getContext('2d'),bottom=1536;
 var stem=g.createLinearGradient(0,0,0,1536);stem.addColorStop(0,'#75a97c');stem.addColorStop(.5,'#37785f');stem.addColorStop(1,'#214c49');
 g.strokeStyle=stem;g.lineWidth=8;g.lineCap='round';g.beginPath();g.moveTo(96,bottom);
 for(var y=bottom;y>50;y-=30)g.lineTo(96+Math.sin(y*.006+seed)*13,y);g.stroke();
 for(var i=0;i<17;i++){
  var yy=120+i*77,xx=96+Math.sin(yy*.006+seed)*13,side=(i+seed)%2?1:-1,length=38+(i%4)*9;
  g.save();g.translate(xx,yy);g.rotate(side*(.15+Math.sin(i+seed)*.08));
  var leaf=g.createLinearGradient(0,0,side*length,-40);leaf.addColorStop(0,'#367a5c');leaf.addColorStop(.6,seed%2?'#6ca474':'#539b70');leaf.addColorStop(1,'#8db484');g.fillStyle=leaf;
  g.beginPath();g.moveTo(0,7);g.bezierCurveTo(side*length*.65,8,side*length*1.1,-15,side*length,-51);g.bezierCurveTo(side*length*.53,-32,side*length*.22,-12,0,7);g.fill();
  g.strokeStyle='rgba(188,212,143,.3)';g.lineWidth=1.2;g.beginPath();g.moveTo(0,5);g.quadraticCurveTo(side*length*.6,-9,side*length,-47);g.stroke();g.restore();
 }
 return c;
}
var backgroundBeforeShallowScenery=bakeBackgrounds;
bakeBackgrounds=function(){
 backgroundBeforeShallowScenery();
 WORLD_DECORS=WORLD_DECORS.filter(function(d){return Math.abs(d.x-SHALLOW_WRECK.x)>900||Math.abs(d.y-SHALLOW_WRECK.y)>450;});
 SHALLOW_SCENERY.sprites=[bakeBroadKelp(0),bakeBroadKelp(1),bakeBroadKelp(2)];SHALLOW_SCENERY.plants=[];SHALLOW_SCENERY.chunks.clear();
 var bands=[[3000,6200],[6800,7700],[9800,13500],[15000,17900]];
 bands.forEach(function(band,bi){
  for(var x=band[0],i=0;x<band[1];x+=105,i++){
   if(Math.abs(x-SHALLOW_WRECK.x)<850)continue;
   var ground=shallowGround(x);if(ground===null)continue;
   var h=Math.min(820+(i*197+bi*263)%1450,ground-150),p={x:x,y:ground+6,h:h,w:h*(.11+(i%3)*.013),sprite:(i+bi)%3,phase:i*.7+bi,back:i%3===0};
   SHALLOW_SCENERY.plants.push(p);var key=Math.floor(x/1024);if(!SHALLOW_SCENERY.chunks.has(key))SHALLOW_SCENERY.chunks.set(key,[]);SHALLOW_SCENERY.chunks.get(key).push(p);
  }
 }
 );
 // Small foreground sea-grass fills the gaps without covering the swimming fish.
 for(var x=2800,i=0;x<18200;x+=135,i++){
  if(Math.abs(x-SHALLOW_WRECK.x)<780)continue;var ground=shallowGround(x);if(ground===null)continue;
  WORLD_DECORS.push({x:x,y:ground+4,z:0,spr:i%DECOR[0].length,s:.45+(i%4)*.24,ph:i});
 }
};
function drawShallowKelp(time,background){
 if(cam.y-H/(2*cam.z)>3900||cam.x-W/(2*cam.z)>19000)return;
 var l=cam.x-W/(2*cam.z)-350,r=cam.x+W/(2*cam.z)+350,t=cam.y-H/(2*cam.z)-80,b=cam.y+H/(2*cam.z)+80;
 ctx.save();
 for(var chunk=Math.floor(l/1024);chunk<=Math.floor(r/1024);chunk++){
  var plants=SHALLOW_SCENERY.chunks.get(chunk);if(!plants)continue;
  for(var i=0;i<plants.length;i++){
   var p=plants[i];if(qLevel===0&&(background||i%2===1))continue;if(p.back!==background||p.y<t||p.y-p.h>b)continue;
   var sway=Math.sin(time*.5+p.phase)*.016;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(sway);
   ctx.globalAlpha=background?.24:.68;ctx.drawImage(SHALLOW_SCENERY.sprites[p.sprite],-p.w/2,-p.h,p.w,p.h);ctx.restore();
  }
 }ctx.restore();
}
var reliefBeforeShallowScenery=drawOceanRelief;
drawOceanRelief=function(time){
 reliefBeforeShallowScenery(time);drawShallowKelp(time,true);
 if(cam.y-H/(2*cam.z)>3500||cam.x>19400)return;
 ctx.save();var left=cam.x-W/(2*cam.z)-1500,right=cam.x+W/(2*cam.z)+1500;
 for(var x=Math.floor(left/1700)*1700;x<right;x+=1700){
  var gradient=ctx.createLinearGradient(0,0,0,3500);gradient.addColorStop(0,'rgba(205,248,203,.075)');gradient.addColorStop(1,'rgba(205,248,203,0)');ctx.fillStyle=gradient;
  ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+100,0);ctx.lineTo(x+850,3500);ctx.lineTo(x+150,3500);ctx.closePath();ctx.fill();
 }
 ctx.restore();
};
function drawShallowWreck(time){
 var ship=SHALLOW_WRECK;
 if(Math.abs(ship.x-cam.x)>W/(2*cam.z)+1000||ship.y<cam.y-H/(2*cam.z)-150||ship.y-1000>cam.y+H/(2*cam.z)+150)return;
 ctx.save();ctx.translate(ship.x,ship.y);
 // Hull colour and open cabins come from the streamed collision mesh. Add wood detail.
 ctx.strokeStyle='rgba(47,32,28,.48)';ctx.lineWidth=3;
 SHALLOW_WRECK.planks.forEach(function(p){ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[2],p[3]);ctx.stroke();});
 ctx.strokeStyle='#775842';ctx.lineWidth=12;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-300,-155);ctx.lineTo(-345,-830);ctx.moveTo(320,-160);ctx.lineTo(350,-560);ctx.moveTo(-520,-190);ctx.lineTo(-370,-190);ctx.moveTo(-100,-190);ctx.lineTo(590,-190);ctx.stroke();
 ctx.strokeStyle='rgba(189,166,119,.55)';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(-345,-800);ctx.lineTo(-680,-155);ctx.moveTo(-345,-800);ctx.lineTo(480,-175);ctx.moveTo(350,-540);ctx.lineTo(650,-165);ctx.stroke();
 // Torn sail: broad fabric, holes and ragged edges establish the silhouette at a distance.
 ctx.fillStyle='rgba(168,164,133,.5)';ctx.beginPath();ctx.moveTo(-330,-760);ctx.quadraticCurveTo(-80,-600,95,-340);ctx.lineTo(15,-360);ctx.lineTo(30,-320);ctx.lineTo(-65,-340);ctx.lineTo(-90,-290);ctx.quadraticCurveTo(-210,-350,-310,-380);ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(121,168,135,.7)';ctx.lineWidth=5;
 for(var i=0;i<7;i++){var x=-590+i*190;ctx.beginPath();ctx.moveTo(x,-170);ctx.quadraticCurveTo(x-12,-210,x+Math.sin(time*.7+i)*12,-245-i%2*30);ctx.stroke();}
 // Detached anchor and chain are visual clues, clear of the entry passages.
 ctx.strokeStyle='#657d7a';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(580,150);ctx.quadraticCurveTo(640,210,675,200);ctx.lineTo(675,245);ctx.moveTo(650,217);ctx.lineTo(700,217);ctx.moveTo(640,235);ctx.quadraticCurveTo(675,275,710,235);ctx.stroke();
 ctx.restore();
}
var resetBeforeShallowScenery=resetGame;
resetGame=function(){resetBeforeShallowScenery();SHALLOW_SCENERY.seen=false;SHALLOW_SCENERY.stocked=false;};
var updateBeforeShallowScenery=update;
update=function(dt){
 updateBeforeShallowScenery(dt);if(gameState!=='playing'||!player.alive)return;
 var d2=dist2(player.x,player.y,SHALLOW_WRECK.x,SHALLOW_WRECK.y-250);
 if(!SHALLOW_SCENERY.seen&&d2<1100*1100){SHALLOW_SCENERY.seen=true;banner('浅海地标 · 潮汐号沉船 · 从两端破口进入船舱');}
 if(!SHALLOW_SCENERY.stocked&&d2<2100*2100){
  var count=0;for(var i=0;i<10;i++){
   var x=SHALLOW_WRECK.x+Math.sin(i*2.4)*530,y=SHALLOW_WRECK.y-420-(i%3)*75;
   if(rkInside(x,y,30)||Math.abs(x-cam.x)<W/(2*cam.z)+100&&Math.abs(y-cam.y)<H/(2*cam.z)+100)continue;
   var sp=SPECIES[i%4],f=fishPool.length?fishPool.pop():newFish();initHabitatFish(f,sp,x,y,rand(sp.sMin,sp.sMax));fishes.push(f);count++;
  }if(count)SHALLOW_SCENERY.stocked=true;
 }
};
var expeditionBeforeShallowScenery=drawExpeditionWorld;
drawExpeditionWorld=function(time){
 expeditionBeforeShallowScenery(time);
 if(Math.abs(SHALLOW_WRECK.x-cam.x)>W/(2*cam.z)+1100||Math.abs(SHALLOW_WRECK.y-cam.y)>H/(2*cam.z)+1000)return;
 ctx.save();ctx.textAlign='center';ctx.fillStyle='#dfd9b4';ctx.font='600 17px system-ui';ctx.fillText('潮汐号沉船 · 浅海探索点',SHALLOW_WRECK.x,SHALLOW_WRECK.y-920);ctx.font='12px system-ui';ctx.fillStyle='#afc9bc';ctx.fillText('两端破口可进出 · 船舱藏有一次性补给',SHALLOW_WRECK.x,SHALLOW_WRECK.y-890);ctx.restore();
};
var chartBeforeShallowScenery=drawChart;
drawChart=function(){
 chartBeforeShallowScenery();var c=el('t-chart'),rect=c.getBoundingClientRect();if(!rect.width)return;
 var g=c.getContext('2d'),scale=Math.min(rect.width/CONF.WORLD_W,(rect.height-36)/CONF.WORLD_H),ox=(rect.width-CONF.WORLD_W*scale)/2;
 g.save();g.setTransform(DPR,0,0,DPR,0,0);var x=ox+SHALLOW_WRECK.x*scale,y=30+(SHALLOW_WRECK.y-500)*scale;
 g.fillStyle='#ebd6a2';g.fillRect(x-4,y-2,8,4);g.font=rect.width<650?'9px system-ui':'11px system-ui';g.fillText('潮汐号沉船',x+7,y-5);g.restore();
};
el('t-description').innerHTML+=' <br>浅海长叶海藻间，沿地标寻找潮汐号沉船和船舱补给。';

var shallowHint=document.createElement('div');shallowHint.id='t-shallow-hint';shallowHint.className='t-small';shallowHint.style.color='#c9d5b8';el('t-nav').insertAdjacentElement('afterend',shallowHint);
var syncBeforeShallowHints=fullSync;
fullSync=function(){
 syncBeforeShallowHints();
 var active=oceanRegion(player.x,player.y)===0;shallowHint.style.display=active?'block':'none';if(!active)return;
 var claimed=V6.supplies&&V6.supplies['shallow-wreck'],dx=SHALLOW_WRECK.x-player.x,dy=SHALLOW_WRECK.y-player.y;
 var arrow=Math.abs(dx)<700&&dy>150?'↓':dx>0?'→':'←';
 shallowHint.textContent=claimed?'潮汐号沉船 · 已探索':Math.abs(dx)<800&&Math.abs(dy)<850?'沉船探索 · 从两端破口进入船舱':'浅海地标 '+arrow+' 潮汐号 · '+Math.round(Math.hypot(dx,dy)/10)+'m';
};
