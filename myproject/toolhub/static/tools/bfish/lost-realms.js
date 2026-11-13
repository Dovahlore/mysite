/* Human-built shelves connect the frozen sea, central volcano and western mine. */
var LOST_REALMS={temple:null,mine:null,rooms:[],mineRooms:[],links:[],facades:[],volcanoShift:{x:-8500,y:600}};
var originalVolcanicRoutes=WORLD_ROUTES.filter(p=>p.name==='火山烟囱'||p.name==='熔岩顺流管').map(p=>({name:p.name,points:p.points.map(q=>q.slice())}));
function cutRectWorld(r,room){if(!r.rectCuts)r.rectCuts=[];r.rectCuts.push(room[0]-r.ax,room[1]-r.ay,room[2],room[3],room[4]||36);}
function architecturalRock(name,x,y,boxes,kind){var r=expansionRock(name,x,y,boxes,[],false);r.organic=kind==='mine'?15:5;r.terrainWave=null;r.k=kind==='mine'?45:26;r.tint=kind==='mine'?[83,91,99]:[76,111,117];r[kind]=true;r.rectCuts=[];return r;}
function carveArchitecture(rooms,paths,targets){targets.forEach(function(r){if(r.ship)return;rooms.forEach(q=>{if(q[0]+q[2]<r.wx0||q[0]-q[2]>r.wx1||q[1]+q[3]<r.wy0||q[1]-q[3]>r.wy1)return;cutRectWorld(r,q);});paths.forEach(p=>{var xs=p.p.map(q=>q[0]),ys=p.p.map(q=>q[1]);if(Math.max(...xs)+p.r<r.wx0||Math.min(...xs)-p.r>r.wx1||Math.max(...ys)+p.r<r.wy0||Math.min(...ys)-p.r>r.wy1)return;carvePath(r,p.p,p.r);});r.surfaceCache=null;r.rearUnderlay=null;rkBake(r);});}
var terrainBeforeLostRealms=RK_init;
RK_init=function(){originalVolcanicRoutes.forEach(original=>{var path=WORLD_ROUTES.find(p=>p.name===original.name);if(path)path.points=original.points.map(q=>q.slice());});terrainBeforeLostRealms();var shift=LOST_REALMS.volcanoShift;
 // Translate the volcanic solids and their local cuts together: geometry and hazards stay aligned.
 RK_list.forEach(function(r){if(['深层火山','熔岩管外壳','火山深部玄武基座'].includes(r.name)){r.ax+=shift.x;r.ay+=shift.y;r.surfaceCache=null;r.rearUnderlay=null;rkBake(r);}else if(r.name==='第三层：火山玄武层'||r.name==='火山侧洞群'){r.name=r.name==='火山侧洞群'?'冰下神庙前庭遗址':'冰下神庙上层石基';r.temple=true;r.tint=[76,111,117];r.terrainWave=[35,.7];r.organic=8;rkBake(r);}});
 var temple=architecturalRock('冰下神秘神庙遗迹',23800,14500,[0,0,3400,2450,220,650,-3300,1700,950,160,900,-4250,850,550,100,-4400,900,1400,850,120,-6000,750,1500,200,65],'temple');LOST_REALMS.temple=temple;rockBounds(temple);RK_list.push(temple);
 var rooms=[
  [24700,11250,1100,500,55],[24400,12800,2450,500,70],
  [23500,14500,2500,650,70],[24700,16300,1850,430,65],
  [19400,14900,1300,480,45],[21800,15750,850,500,50],
  [22800,13700,360,1400,40],[25700,14400,330,2100,40],
  [23800,12000,330,1400,35]
 ];LOST_REALMS.rooms=rooms;
 var links=[
  {p:[[24800,9040],[25100,9700],[24700,10300],[24700,11250],[23800,12000],[23800,12800]],r:280},
  {p:[[20200,12800],[22000,12800],[24400,12800],[27600,12800]],r:290},
  {p:[[16900,14800],[18000,14900],[19400,14900],[21100,14500],[23500,14500],[27500,14500]],r:300},
  {p:[[21400,17400],[21800,15750],[22800,14500]],r:270},
  {p:[[24700,16300],[25600,17000],[26700,17800]],r:280}
 ];LOST_REALMS.links=links;
 carveArchitecture(rooms,links,RK_list.filter(r=>!r.ship&&r.wx1>16500&&r.wy1>9000));
 // Real columns remain solid inside the carved sanctuary.
 [[22100,14500,120,380],[23900,14500,135,390],[25200,12800,110,270],[23200,16300,115,250]].forEach((p,i)=>{var r=architecturalRock('神庙残存石柱 '+i,p[0],p[1],[0,0,p[2],p[3],22,0,-p[3],p[2]+60,65,20],'temple');rkBake(r);RK_list.push(r);});
 var mine=architecturalRock('西部沉没矿井陆架',2800,5650,[0,0,2600,1300,250,-800,-1150,1700,350,120,-2000,-400,800,800,180,2100,500,900,850,180],'mine');LOST_REALMS.mine=mine;rockBounds(mine);RK_list.push(mine);
 var mineRooms=[[2200,5100,1250,420,45],[4600,6100,1000,430,50],[1800,6100,650,400,45],[2700,5550,260,1200,35]],minePaths=[{p:[[-300,5050],[2200,5100],[3700,5200],[6700,5300]],r:260},{p:[[2200,5100],[2500,5700],[4600,6100],[6900,6300]],r:260},{p:[[1800,6100],[2700,6500],[3500,7200]],r:245},{p:[[2700,4000],[2700,5100],[2700,6500],[2700,7200]],r:250}];LOST_REALMS.mineRooms=mineRooms;
 carveArchitecture(mineRooms,minePaths,RK_list.filter(r=>!r.ship&&!r.ice&&r.wx0<7200&&r.wy1>3900&&r.wy0<7600));
 if(!DEN_DEFS.some(d=>d.id==='temple-sanctum'))DEN_DEFS.push({id:'temple-sanctum',name:'神庙隐秘圣所',x:24800,y:16300,entry:[26700,17800],r:220,min:75,size:30,rock:temple});
 SITES.forEach(p=>{if(p.name==='熔火前哨'){p.x=VOLCANO.x;p.y=VOLCANO.y-500;}});
 if(!SITES.some(p=>p.name==='冰下神庙'))SITES.push({x:23500,y:14500,name:'冰下神庙',sub:'沉没的神秘文明',color:'#95d6d5'});
 if(!SITES.some(p=>p.name==='沉没矿井'))SITES.push({x:2200,y:5100,name:'沉没矿井',sub:'废弃巷道与矿脉',color:'#baad85'});
};
// The old right-hand fire biome is now a cold archaeological shelf.
VOLCANO.x=14700;VOLCANO.y=13000;
REGIONS[5].name='幽暗深海';REGIONS[5].hint='巨型乌贼 · 稀疏深水鱼类';
REGIONS[4].contains=(x,y)=>Math.abs(x-VOLCANO.x)<3900&&y>12000&&y<17900;
REGIONS.push({id:'temple',name:'冰下神秘神庙',hint:'失落文明 · 石柱殿厅与阶梯通道',min:90,color:'#9edbdc',indices:[SPECIES.indexOf(coelacanthSpec),SPECIES.indexOf(blackscaleSpec)],contains:(x,y)=>x>18300&&y>10400&&y<17500});
REGIONS.push({id:'mine',name:'沉没矿井',hint:'矿脉 · 废弃巷道与升降井',min:30,color:'#c4ba8e',indices:[SPECIES.indexOf(cardinalSpec),SPECIES.indexOf(bigeyeSpec),SPECIES.indexOf(snapperSpec)],contains:(x,y)=>x<6800&&y>4200&&y<6900});
var regionBeforeLostRealms=oceanRegion;
oceanRegion=function(x,y){if(y>=18100)return 6;if(REGIONS[8].contains(x,y))return 8;if(REGIONS[7].contains(x,y))return 7;if(REGIONS[4].contains(x,y))return 4;if(y>=6900&&y<10600)return 3;var r=regionBeforeLostRealms(x,y);return r===4?(y<10600?3:5):r;};
var sceneryBeforeLostRealms=sceneryZoneAt;sceneryZoneAt=function(x,y){var region=oceanRegion(x,y);return region===7?'deep':region===8?'shelf':sceneryBeforeLostRealms(x,y);};
var choiceBeforeLostRealms=chooseHabitatSpecies;
chooseHabitatSpecies=function(x,y,small){var region=oceanRegion(x,y);if(region===8)return chooseAbyssNative([[cardinalSpec,2],[bigeyeSpec,3],[mackerelSpec,2],[snapperSpec,1.4],[pineconeSpec,2]],x,y);if(region===7)return chooseAbyssNative([[coelacanthSpec,1.5],[blackscaleSpec,2],[hatchetSpec,2],[lanternSpec,2],[fangSpec,1]],x,y);return choiceBeforeLostRealms(x,y,small);};
var bakeBeforeLostRealms=bakeBackgrounds;
bakeBackgrounds=async function(){await bakeBeforeLostRealms();await bootYield();var ventCache=SUPPLY_CACHES.find(p=>p.id==='vent');if(ventCache){ventCache.x=VOLCANO.x;ventCache.y=VOLCANO.y+1300;}SITES.forEach(p=>{if(p.name==='远古回声'){p.x=17500;p.y=21000;}});VENTS=[{x:VOLCANO.x,y:VOLCANO.y+200,off:0},{x:VOLCANO.x-800,y:VOLCANO.y+1100,off:3},{x:VOLCANO.x+1000,y:VOLCANO.y+1100,off:6}];SITES.forEach(p=>{if(p.name==='熔火前哨'){p.x=VOLCANO.x;p.y=VOLCANO.y-500;}});OCEAN_CURRENTS.forEach(c=>{if(c.id==='lava'){c.a=[11700,13800];c.b=[17800,13800];}});WORLD_ROUTES.forEach(p=>{if(p.name==='火山烟囱')p.points=[[14700,12100],[14700,14900]];if(p.name==='熔岩顺流管')p.points=[[11400,13800],[18100,13800]];});buildDecorChunks();OCEAN.atlasGeometry=null;buildWorldAtlas();};
