/* Expanded world: upper three seas keep their scale; abyss continues without a floor. */
var ABYSS_WORLD={fourthTop:12100,fifthTop:18100,bottom:23800,left:null,iceFoot:null,iceShelf:null,paths:[]};
CONF.WORLD_H=ABYSS_WORLD.bottom;
bakeFloor=function(){for(var i=0;i<FLOOR.length;i++)FLOOR[i]=CONF.WORLD_H+4500;};
function expansionRock(name,x,y,boxes,blobs,ice){return {name:name,ax:x,ay:y,boxes:boxes||[],blobs:blobs||[],caves:[],k:85,z:ice?3:2,tint:ice?[115,164,188]:[48,66,84],ice:!!ice,organic:ice?16:25,terrainWave:[ice?65:95,.8],hang:false};}
var terrainBeforeAbyssWorld=RK_init;
RK_init=function(){
 terrainBeforeAbyssWorld();
 var olderIce=RK_list.find(r=>r.name==='冰下多层洞窟');if(olderIce)for(var n=0;n<5;n++)olderIce.blobs.push(-2050+Math.sin(n*1.7)*110,-900+n*450,390+(n%3)*65);
 RK_list=RK_list.filter(r=>r.name!=='深渊海山');
 // Join the ice body to the underside of the second shelf, with a genuine interior.
 var ice=expansionRock('冰冠贯层冰洞根部',25500,5200,[0,150,1450,3100,360],[-1050,-900,680,1050,600,600],true);
 var icePaths=[{p:[[20600,4600],[23800,4600]],r:360},{p:[[20600,6000],[24000,6000]],r:300},{p:[[25500,3200],[25600,3950],[25000,4800],[25400,5450],[26100,5900],[26600,6800]],r:270},{p:[[23800,4600],[24400,4700],[25000,4800],[26000,4750],[27150,4900]],r:360},{p:[[24000,6000],[24700,5800],[25400,5450],[26300,5300],[27300,5500]],r:300},{p:[[25000,4800],[24700,5800],[24600,6500],[24550,7650],[24500,8500]],r:260}];
 for(var n=0;n<10;n++){var yy=-2500+n*540;ice.blobs.push(-1380+Math.sin(n*1.7)*180,yy,390+(n%3)*75);}
 ABYSS_WORLD.iceFoot=ice;RK_list.push(ice);
 var glacier=expansionRock('第三层冰光洞穴陆架',25200,9100,[0,0,1850,720,300],[-1450,-300,650,1350,150,730],true);
 icePaths.push({p:[[22400,8850],[23900,8750],[24800,9040],[25800,8840],[27400,9100]],r:330},{p:[[24500,8500],[24800,9040],[25100,9700],[25500,10400]],r:250});
 for(var n=0;n<4;n++)glacier.blobs.push(-1700+Math.sin(n*2)*130,-580+n*380,330+(n%2)*100);
 ABYSS_WORLD.iceShelf=glacier;RK_list.push(glacier);
 RK_list.forEach(function(r){if(r.ship||r.name==='冰冠主冰盖'||r.wx1<23000||r.wy0>10700)return;icePaths.forEach(p=>carvePath(r,p.p,p.r));});
 // The left continent occupies a corner, leaving the fourth/fifth central water open.
 var land=expansionRock('西侧远古洞穴大陆架',2600,13500,[0,0,3100,4400,1000], [3100,-700,1900,3000,2000,1650,3300,3400,1400]);
 ABYSS_WORLD.left=land;RK_list.push(land);
 var routes=[
  {p:[[3800,8400],[3800,9100],[3100,10000]],r:300},
  {p:[[-500,9100],[1600,9300],[3100,10000],[4200,10750],[5600,11800],[8200,12400]],r:350},
  {p:[[8500,13700],[6800,13600],[5200,13200],[3500,13500],[1700,12800],[-700,13000]],r:470},
  {p:[[8100,16400],[6500,15900],[4800,16200],[3100,15600],[1300,16400],[-600,16000]],r:520},
  {p:[[8200,17500],[6500,17400],[5000,17300],[3300,17600],[1200,17300],[-600,17600]],r:400},
  {p:[[3100,10000],[2900,11600],[3500,13500],[3100,15600],[3300,17400],[3400,18600]],r:340},
  {p:[[5600,11800],[5200,13200],[5700,14500],[4800,16200],[5300,17900],[5600,18800]],r:310},
  {p:[[1300,16400],[1400,17700],[1200,18800]],r:280},
  {p:[[4200,10750],[5500,10000],[6800,9600]],r:230}
 ];
 ABYSS_WORLD.paths=routes;
 // Cut every overlapping body as well, so exits never end at an invisible second wall.
 RK_list.forEach(function(r){if(r.ship||r.ice)return;routes.forEach(p=>{var xs=p.p.map(v=>v[0]),ys=p.p.map(v=>v[1]);if(r!==land&&(r.wx1<Math.min(...xs)-p.r||r.wx0>Math.max(...xs)+p.r||r.wy1<Math.min(...ys)-p.r||r.wy0>Math.max(...ys)+p.r))return;carvePath(r,p.p,p.r);});});
 // Offset galleries widen the halls, preserving pillars instead of round chambers.
 [[[2800,13000],[4500,13200],[5500,13700]],[[2600,15800],[4100,16200],[5300,15800]],[[3200,17400],[4700,17500],[5800,17300]]].forEach(p=>carvePath(land,p,700));
 var volcanicBase=expansionRock('火山深部玄武基座',23900,15800,[0,0,2200,950,500],[-1000,-350,1050,1150,-300,1000],false);volcanicBase.tint=[65,45,52];volcanicBase.glow=true;carvePath(volcanicBase,[[23200,14300],[23100,15300],[24200,15800],[26500,16500]],300);RK_list.push(volcanicBase);
 RK_list.forEach(function(r){r.surfaceCache=null;r.rearUnderlay=null;rkBake(r);});
 if(!WORLD_ROUTES.some(p=>p.name==='西侧远古洞穴'))WORLD_ROUTES.push({name:'西侧远古洞穴',points:routes[2].p,r:470});
 [{id:'ancient-west-1',x:4500,y:13200,size:28},{id:'ancient-west-2',x:4800,y:16200,size:30}].forEach(d=>{if(!DEN_DEFS.some(old=>old.id===d.id))DEN_DEFS.push(Object.assign(d,{entry:[8200,d.y],r:280,name:'远古洞厅隐湾',min:60,rock:land}));});
 if(!SITES.some(p=>p.name==='无光深渊'))SITES.push({x:14300,y:20300,name:'无光深渊',sub:'远古回声',color:'#86b9cd'});
};
var regionBeforeAbyssWorld=oceanRegion;
oceanRegion=function(x,y){if(y>=ABYSS_WORLD.fifthTop)return 6;if(x>22800&&y>=6800&&y<10300)return 3;return regionBeforeAbyssWorld(x,y);};
REGIONS.push({id:'hadal',name:'无光深渊',hint:'无尽黑水 · 远古深海生物',min:160,color:'#879fc9',indices:[],contains:function(x,y){return y>=ABYSS_WORLD.fifthTop;}});
var zoneBeforeAbyssWorld=zoneAt;zoneAt=function(x,y){return y>=ABYSS_WORLD.fifthTop?2:zoneBeforeAbyssWorld(x,y);};
var waterBeforeAbyssWorld=biomeWater;
function biomeWater(x,y){
 var depth=clamp(Math.min(y,15800)/15800,0,1),r=lerp(60,2,depth),g=lerp(165,11,depth),b=lerp(186,34,depth),ice=clamp((x-18800)/1400,0,1)*clamp((7200-y)/1600,0,1);
 r=lerp(r,75,ice*.55);g=lerp(g,135,ice*.55);b=lerp(b,179,ice*.65);var fire=clamp(1-Math.abs(x-14700)/4200,0,1)*clamp((y-11500)/1400,0,1)*clamp((18000-y)/1100,0,1),a=clamp((y-12000)/7200,0,1);
 return [lerp(lerp(r,52,fire*.8),2,a),lerp(lerp(g,23,fire*.8),5,a),lerp(lerp(b,37,fire*.8),13,a)];
}
var bakeBeforeAbyssWorld=bakeBackgrounds;
bakeBackgrounds=async function(){await bakeBeforeAbyssWorld();await bootYield();if(WRECK)WRECK.y=CONF.WORLD_H+3000;FSTRIP=[];STREAM.entries=null;WORLD_DECORS=WORLD_DECORS.filter(p=>p.y<CONF.WORLD_H&&p.y<17500);VKELP=VKELP.filter(p=>p.y<8000);SPIRES=SPIRES.filter(p=>p.y<17000);buildDecorChunks();OCEAN.atlasGeometry=null;buildWorldAtlas();};
// Region-local native depth bands; there is no horizontal barrier at 18100.
var initBeforeAbyssBand=initHabitatFish;
initHabitatFish=function(f,sp,x,y,size){initBeforeAbyssBand(f,sp,x,y,size);f.ecologyBand=y<3200?0:y<6900?1:y<10600?2:y<ABYSS_WORLD.fifthTop?3:4;return f;};
var steerBeforeAbyssBand=ecologySteering;
ecologySteering=function(f,x,y){if(f.ecologyBand>=3&&!f.returningHome){var low=f.ecologyBand===4?18400:12200,high=f.ecologyBand===4?CONF.WORLD_H-300:17800;if(f.y<low&&y<0)y=Math.abs(y)+.5;if(f.y>high&&y>0)y=-Math.abs(y)-.5;var norm=Math.hypot(x,y)||1;return {x:x/norm,y:y/norm};}return steerBeforeAbyssBand(f,x,y);};
var populationBeforeAbyss=ecologyPopulationTarget;
ecologyPopulationTarget=function(x,y){return y>=18100?18:y>12100?24:populationBeforeAbyss(x,y);};

var sceneryBeforeGlacialShelf=sceneryZoneAt;sceneryZoneAt=function(x,y){return x>22800&&y>6800&&y<10300?'ice':sceneryBeforeGlacialShelf(x,y);};
