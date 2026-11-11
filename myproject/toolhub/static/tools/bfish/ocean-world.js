/* V5 — an authored, connected ocean. Geometry is shared by rendering, AI and navigation. */
'use strict';
window.CUSTOM_MAP=true;
var OCEAN={name:'群山之下',region:-1,seen:{},dens:[],harvested:{},denTimer:0,atlas:null};
var REGIONS=[
 {id:'lagoon',name:'潮汐浅湾',hint:'海草床 · 鱼苗与小型鱼群',min:10,color:'#73dbc4',indices:[0,0,1,1,2,3,4],contains:function(x,y){return y<3100;}},
 {id:'emerald',name:'翡翠山腹',hint:'双层洞厅 · 西口进入，竖井通往下层',min:18,color:'#80ddad',indices:[0,1,2,3,4,5,6,7],contains:function(x,y){return x<11200&&y<10400;}},
 {id:'cathedral',name:'珊瑚大教堂',hint:'巨型穹顶 · 中央竖井连接深渊',min:30,color:'#efb4b8',indices:[1,3,4,5,6,7,8,9],contains:function(x,y){return x<19300&&y<10800;}},
 {id:'east',name:'鲸落迷宫',hint:'东侧贯通洞厅 · 南支路藏着海草绿洲',min:38,color:'#9dbfea',indices:[1,4,6,7,8,9,12,13],contains:function(x,y){return x>=19300&&y<11900;}},
 {id:'abyss',name:'星陨深渊',hint:'裂口之下 · 鲜少阳光，大型猎手出没',min:58,color:'#a5a2e7',indices:[6,7,8,9,10,10,11,12,14,15],contains:function(){return true;}}
];
function oceanRegion(x,y){for(var i=0;i<REGIONS.length;i++)if(REGIONS[i].contains(x,y))return i;return 4;}
zoneAt=function(x,y){var r=oceanRegion(x,y);return r===0?0:r===1||r===2?1:r===4?2:3;};
zoneW=function(x,y){
 return [clamp((3400-y)/1000,0,1),clamp((11000-y)/1800,0,1)*clamp((y-2400)/1200,0,1),clamp((y-9900)/2400,0,1)];
};
ZONES[0].name='潮汐浅湾';ZONES[1].name='山腹珊瑚';ZONES[2].name='星陨深渊';ZONES[3].name='鲸落迷宫';
bakeFloor=function(){
 for(var i=0;i<FLOOR.length;i++){
  var x=i*10;
  var left=(x-900)/1700,right=(x-25800)/1900;
  FLOOR[i]=clamp(15050-2200*Math.exp(-left*left)-1900*Math.exp(-right*right)+Math.sin(x*.0007)*280+Math.sin(x*.0021)*85,12400,15580);
 }
};
function carvePath(rock,points,radius){for(var i=1;i<points.length;i++)rock.caves.push(points[i-1][0]-rock.ax,points[i-1][1]-rock.ay,points[i][0]-rock.ax,points[i][1]-rock.ay,radius);}
function carveChamber(rock,x,y,radius){rock.caves.push(x-rock.ax,y-rock.ay,x-rock.ax,y-rock.ay,radius);RK_chambers.push({x:x,y:y,r:radius});}
function makeMountain(name,x,y,blobs,z){var r={name:name,ax:x,ay:y,blobs:blobs,caves:[],k:220,glow:z===2,z:z,hang:false,spr:null};RK_list.push(r);return r;}
var WORLD_ROUTES=[
 {name:'西侧潮口',points:[[2900,2700],[4600,3600],[6100,4400],[7500,4600],[9000,5400],[11200,5600]],r:340},
 {name:'翡翠下潜井',points:[[7500,4600],[7000,6000],[6000,6800],[6700,8400],[7000,10300],[7400,12000],[8300,13600],[10000,13700]],r:320},
 {name:'珊瑚横廊',points:[[11200,5600],[12600,6100],[14300,6300],[15900,7400],[18400,7300],[20000,7000]],r:360},
 {name:'星陨裂口',points:[[14300,6300],[13800,8200],[14900,9500],[17200,11600],[18300,13800]],r:360},
 {name:'鲸落东口',points:[[19600,7000],[21500,7400],[23500,8000],[25800,7300],[27200,6800]],r:350},
 {name:'鲸落下层',points:[[23500,8000],[22600,10100],[23300,12100],[22000,13700],[20000,14400]],r:330},
 {name:'回音竖井',points:[[14900,9500],[14700,11600],[14900,13000],[16300,14400],[17700,14800]],r:330},
 {name:'黑曜地廊',points:[[7600,13700],[10000,13700],[12600,14000]],r:360}
];
var CAVE_HINTS=[
 {x:3000,y:2600,title:'西侧潮口',sub:'进入翡翠山腹 ↓',min:18},
 {x:11200,y:5400,title:'珊瑚横廊',sub:'双向贯通 · 深处有下潜裂口 →',min:30},
 {x:13800,y:8200,title:'星陨裂口',sub:'继续向下 · 高风险深海 ↓',min:58},
 {x:19700,y:6850,title:'鲸落东口',sub:'进入鲸落迷宫 →',min:38},
 {x:22750,y:10900,title:'鲸落南井',sub:'通往海底热泉 ↓',min:58}
];
SITES.splice(0,SITES.length,
 {x:3600,y:1500,name:'潮汐摇篮',sub:'阳光下的海草与鱼苗',color:'#80f0d0'},
 {x:7500,y:4600,name:'翡翠双厅',sub:'山腹中的第一座巨型洞厅',color:'#8de6b3'},
 {x:14300,y:6300,name:'珊瑚穹顶',sub:'从中央竖井继续下潜',color:'#ffb7a6'},
 {x:17200,y:11600,name:'星陨裂谷',sub:'穿越山腹，抵达无光深处',color:'#b9a3ff'},
 {x:23500,y:8000,name:'鲸落圣所',sub:'贯通东西的古老洞厅',color:'#9cbfff'}
);
var DEN_DEFS=[
 {id:'jade',x:4300,y:7100,entry:[6000,6800],r:520,name:'蕨影密室',min:25},
 {id:'heart',x:16600,y:9000,entry:[14900,9500],r:550,name:'珊瑚内湾',min:29},
 {id:'east',x:24700,y:10300,entry:[22600,10100],r:560,name:'鲸落海草床',min:33}
];
RK_init=function(){
 RK_list=[];RK_chambers=[];RUINS=[];
 var a=makeMountain('翡翠群山',6800,6100,[-1800,0,1900,0,-500,2600,2000,200,1900,500,2000,1900,0,6400,3300],1);
 carvePath(a,WORLD_ROUTES[0].points,340);carvePath(a,WORLD_ROUTES[1].points,320);
 carveChamber(a,7500,4600,1050);carveChamber(a,6000,6800,920);carveChamber(a,7400,12000,1050);
 carvePath(a,[DEN_DEFS[0].entry,[4300,7100]],205);carveChamber(a,4300,7100,520);
 var b=makeMountain('珊瑚大教堂',14800,7900,[-1300,0,2300,1000,-1500,2500,1600,1600,2200,-800,2400,1700,0,5500,2500],1);
 carvePath(b,WORLD_ROUTES[2].points,360);carvePath(b,WORLD_ROUTES[3].points,360);
 carveChamber(b,14300,6300,1200);carveChamber(b,14900,9500,1050);carveChamber(b,17200,11600,850);carvePath(b,WORLD_ROUTES[6].points,330);carveChamber(b,14700,11600,1000);carveChamber(b,14900,13000,850);
 carvePath(b,[DEN_DEFS[1].entry,[16600,9000]],210);carveChamber(b,16600,9000,550);
 var c=makeMountain('鲸落迷宫',23200,7600,[-1600,0,2100,700,-1600,2600,700,1900,2400,400,5700,2800],3);
 carvePath(c,WORLD_ROUTES[4].points,350);carvePath(c,WORLD_ROUTES[5].points,330);
 carveChamber(c,23500,8000,1200);carveChamber(c,22600,10100,950);carveChamber(c,23300,12100,1000);
 carvePath(c,[DEN_DEFS[2].entry,[24700,10300]],210);carveChamber(c,24700,10300,560);
 var d=makeMountain('黑曜海脊',10000,14500,[-700,250,1450,600,200,1750,0,-250,1400],2);
 carvePath(d,WORLD_ROUTES[7].points,360);carveChamber(d,10000,13700,720);
 RK_list.forEach(function(r){
  // A route crossing overlapping mountain roots must cut both solids.
  rockBounds(r);
  WORLD_ROUTES.forEach(function(route){for(var i=1;i<route.points.length;i++){
   var a=route.points[i-1],b=route.points[i],pad=route.r;
   if(Math.max(a[0],b[0])+pad<r.wx0||Math.min(a[0],b[0])-pad>r.wx1||Math.max(a[1],b[1])+pad<r.wy0||Math.min(a[1],b[1])-pad>r.wy1)continue;
   carvePath(r,[a,b],route.r);
  }});rkBake(r);
 });
 DEN_DEFS.forEach(function(den,i){den.rock=[a,b,c][i];});
 // Floor-rooted spires and ceiling pendants make giant halls readable at swimming scale.
 [[7500,4600,1050],[6000,6800,920],[14300,6300,1200],[14900,9500,1050],[23500,8000,1200],[22600,10100,950],[7400,12000,1050]].forEach(function(p,i){
  var z=p[1]>10500?2:1;
  var base={name:'洞厅石笋',ax:p[0]-p[2]*.57,ay:p[1]+p[2]*.78,blobs:[0,0,220,20,-220,170,0,-410,130],caves:[],k:60,glow:z===2,z:z,hang:false};
  protectRouteClearance(base);rkBake(base);RK_list.push(base);
  var roof={name:'洞顶钟乳',ax:p[0]+p[2]*.64,ay:p[1]-p[2]*.72,blobs:[0,0,170,15,170,100,30,300,65],caves:[],k:40,glow:false,z:z,hang:false};
  protectRouteClearance(roof);rkBake(roof);RK_list.push(roof);
 });
 // The surface remains a continuous lane. Smaller hanging shelves give it structure.
 for(var i=0;i<22;i++){
  var x=1000+i*1190,y=980+(i%3)*410;
  var r={name:'浅湾礁架',ax:x,ay:y,blobs:[-100,20,135,80,0,155,240,30,120],caves:[],k:55,glow:false,z:0,hang:false};
  rkBake(r);RK_list.push(r);
 }
};
function addFloraOnSurface(r,x,ceiling,index){
 var step=24,prev=rkField(r,x-r.ax,r.oy);
 for(var y=r.wy0+step;y<r.wy1;y+=step){
  var d=rkField(r,x-r.ax,y-r.ay);
  if(prev>=0&&d<0){
   var lo=y-step,hi=y;for(var k=0;k<5;k++){var mid=(lo+hi)/2;if(rkField(r,x-r.ax,mid-r.ay)<0)hi=mid;else lo=mid;}
   var biome=y>10500?2:y<3000?0:r.z;
   WORLD_DECORS.push({x:x,y:hi+2,z:biome,spr:index%DECOR[biome].length,s:.4+(index%3)*.2,ph:index});
  }
  prev=d;
 }
}
var backgroundBeforeWorld=bakeBackgrounds;
bakeBackgrounds=function(){
 backgroundBeforeWorld();WORLD_DECORS=[];WORLD_CAVES=[];SPIRES=[];SARG=[];VKELP=[];SEEPS=[];
 RK_list.forEach(function(r,ri){
  var spacing=r.w>2000?380:80;
  for(var x=r.wx0+40,j=0;x<r.wx1-40;x+=spacing,j++)addFloraOnSurface(r,x,false,j+ri);
 });
 for(var i=0;i<70;i++){
  var x=250+i*385,y=floorAt(x)+4,z=zoneAt(x,y-30);
  if(!rkInside(x,y-40,5))WORLD_DECORS.push({x:x,y:y,z:z,spr:i%DECOR[z].length,s:.6+(i%3)*.25,ph:i});
 }
 WRECK.x=20000;WRECK.y=floorAt(20000)-15;
 VENTS=[{x:18500,y:floorAt(18500)-5,off:0},{x:21100,y:floorAt(21100)-5,off:2},{x:7100,y:floorAt(7100)-5,off:4}];
 SEEPS=VENTS.map(function(v,i){return {x:v.x+120,ph:i};});
 buildWorldAtlas();
};
function buildWorldAtlas(){
 var c=newCanvas(430,Math.round(430*CONF.WORLD_H/CONF.WORLD_W)),g=c.getContext('2d'),im=g.createImageData(c.width,c.height),sc=c.width/CONF.WORLD_W;
 for(var y=0;y<c.height;y++)for(var x=0;x<c.width;x++){
  var wx=(x+.5)/sc,wy=(y+.5)/sc,region=oceanRegion(wx,wy),solid=wy>floorAt(wx)||rkInside(wx,wy,0),k=(y*c.width+x)*4;
  var depth=clamp(wy/CONF.WORLD_H,0,1),v=depth*depth;
  var col=solid?[lerp(58,19,v),lerp(92,30,v),lerp(91,47,v)]:[lerp(53,4,depth),lerp(133,17,depth),lerp(151,39,depth)];
  im.data[k]=col[0];im.data[k+1]=col[1];im.data[k+2]=col[2];im.data[k+3]=255;
 }g.putImageData(im,0,0);OCEAN.atlas=c;
 MINIMAP_BASE=newCanvas(180,Math.round(180*CONF.WORLD_H/CONF.WORLD_W));MINIMAP_BASE.getContext('2d').drawImage(c,0,0,MINIMAP_BASE.width,MINIMAP_BASE.height);
}
// Large massifs are drawn from a cheap full silhouette, then enhanced by nearby tiles.
RK_draw=function(time){
 var l=cam.x-W/(2*cam.z)-60,r=cam.x+W/(2*cam.z)+60,t=cam.y-H/(2*cam.z)-60,b=cam.y+H/(2*cam.z)+60;
 for(var i=0;i<RK_list.length;i++){
  var rock=RK_list[i];if(rock.wx1<l||rock.wx0>r||rock.wy1<t||rock.wy0>b)continue;
  if(!rock.tiles){ctx.drawImage(rock.spr,rock.wx0,rock.wy0,rock.w,rock.h);continue;}
  for(var j=0;j<rock.tiles.length;j++){
   var tile=rock.tiles[j];if(tile.wx1<l||tile.wx0>r||tile.wy1<t||tile.wy0>b)continue;
   if(tile.streamBytes)ctx.drawImage(tile.spr,tile.wx0,tile.wy0,tile.w,tile.h);
   else ctx.drawImage(rock.preview,(tile.ox-rock.ox)/rock.w*rock.preview.width,(tile.oy-rock.oy)/rock.h*rock.preview.height,tile.w/rock.w*rock.preview.width,tile.h/rock.h*rock.preview.height,tile.wx0,tile.wy0,tile.w,tile.h);
  }
 }
};
// Local ecology depends on actual location, not a randomly chosen target biome.
function chooseHabitatSpecies(x,y,small){
 var options=REGIONS[oceanRegion(x,y)].indices;
 for(var i=0;i<10;i++){
  var sp=SPECIES[options[Math.floor(rand(0,options.length))]],tier=tierOf(sp);
  if((!small||tier===0)&&(tier===0||aliveTierCount(tier)<TIER_CAP[tier]))return sp;
 }return SPECIES[0];
}
function initHabitatFish(f,sp,x,y,size){
 if(tierOf(sp)===3&&player.size>90)size*=Math.min(1.6,1+(player.size-90)/100);
 var angle=rand(-Math.PI,Math.PI);
 Object.assign(f,{specIdx:SPECIES.indexOf(sp),spec:sp,size:size,x:x,y:y,hx:x,hy:y,vx:0,vy:0,angle:angle,wanderA:angle,tailPhase:rand(0,6.28),hunger:rand(55,85),state:'wander',fleeTimer:0,lungeT:0,huntT:0,huntCd:rand(4,10),aggroTimer:0,aggroCd:4,turnTimer:0,turnInterval:rand(2,5),biome:zoneAt(x,y),dead:false,inflated:0,born:survivalTime,terrainSteer:null,rareDen:null});
 return f;
}
spawnFish=function(){
 var dangers=0;
 for(var i=0;i<fishes.length;i++)if(!fishes[i].dead&&fishes[i].size>player.size*1.15&&dist2(fishes[i].x,fishes[i].y,player.x,player.y)<1100*1100)dangers++;
 var minR=Math.max(600,Math.hypot(W,H)/(2*Math.max(cam.z,.52))+130);
 for(var attempt=0;attempt<24;attempt++){
  var angle=rand(0,Math.PI*2),radius=rand(minR,minR+1200),x=clamp(player.x+Math.cos(angle)*radius,160,CONF.WORLD_W-160),y=clamp(player.y+Math.sin(angle)*radius,100,floorAt(player.x)-120);
  // Cavern chambers get a real population even when their surrounding rock dominates the annulus.
  if(attempt>6&&RK_chambers.length){var chamber=RK_chambers[Math.floor(rand(0,RK_chambers.length))];x=chamber.x+rand(-.6,.6)*chamber.r;y=chamber.y+rand(-.6,.6)*chamber.r;if(dist2(x,y,player.x,player.y)>3000*3000)continue;}
  if(Math.abs(x-cam.x)<W/(2*cam.z)+70&&Math.abs(y-cam.y)<H/(2*cam.z)+70)continue;
  if(y>floorAt(x)-90||rkInside(x,y,55))continue;
  var sp=chooseHabitatSpecies(x,y,dangers>=3),size=rand(sp.sMin,sp.sMax);
  var f=fishPool.length?fishPool.pop():newFish();initHabitatFish(f,sp,x,y,size);fishes.push(f);return;
 }
};
function steerAroundTerrain(f,dx,dy,dt){
 f.terrainSteer=null;if(dx*dx+dy*dy<.02)return;
 var ahead=80+f.size*.55,margin=f.size*.36+12;
 if(!rkInside(f.x+dx*ahead,f.y+dy*ahead,margin))return;
 var a=Math.atan2(dy,dx),best=null,score=-Infinity;
 for(var i=0;i<7;i++){
  var offset=[.6,-.6,1.2,-1.2,1.9,-1.9,Math.PI][i],angle=a+offset,x=Math.cos(angle),y=Math.sin(angle);
  if(rkInside(f.x+x*ahead,f.y+y*ahead,margin))continue;
  var value=Math.cos(offset)+.18*(x*Math.cos(f.angle)+y*Math.sin(f.angle));
  if(value>score){score=value;best={x:x,y:y};}
 }if(best)f.terrainSteer=best;
}
// Gentle rare prey lives in hidden side chambers and never attacks the player.
var dugongSpec={n:'儒艮',sMin:20,sMax:28,spd:32,ry:.55,shape:'oval',c1:'#b7c6c1',c2:'#e2e8d9',c3:'#758d89',pat:'none',tail:'round',bio:[0,0,0,0],rareDugong:true};
SPECIES.push(dugongSpec);
var growthBeforeDugong=fishGrowth;
fishGrowth=function(f){return f.spec.rareDugong?4.5:growthBeforeDugong(f);};
var eatBeforeDugong=playerEatFish;
playerEatFish=function(f){
 eatBeforeDugong(f);
 if(f.spec.rareDugong){OCEAN.harvested[f.rareDen]=true;expedition.species['儒艮']=true;score+=120;addPopup(player.x,player.y-50,'秘境营养 · 体长 +4.5','#c3f1bb',true);banner('发现稀有儒艮 · 本处本局仅一只');}
};
var updateFishBeforeDugong=updateFish;
updateFish=function(f,dt){
 if(!f.spec.rareDugong){updateFishBeforeDugong(f,dt);return;}
 var den=DEN_DEFS.find(function(d){return d.id===f.rareDen;});if(!den){f.dead=true;return;}
 f.turnTimer+=dt;
 var away=dist2(f.x,f.y,den.x,den.y)>210*210;
 if(away)f.wanderA=Math.atan2(den.y-f.y,den.x-f.x);
 else if(f.turnTimer>5){f.turnTimer=0;f.wanderA=f.angle+rand(-.7,.7);}
 var desired=f.wanderA,speed=29;
 if(player.alive&&dist2(f.x,f.y,player.x,player.y)<200*200&&player.size>f.size){desired=Math.atan2(f.y-player.y,f.x-player.x);speed=43;}
 f.angle=lerpAngle(f.angle,desired,Math.min(1,dt*1.6));f.vx=Math.cos(f.angle)*speed;f.vy=Math.sin(f.angle)*speed;
 f.x+=f.vx*dt;f.y+=f.vy*dt;f.tailPhase+=dt*3;rkCollide(f,false);
 if(player.alive&&gameState==='playing'&&f.size<player.size*CONF.EAT_RATIO&&dist2(f.x,f.y,player.x,player.y)<Math.pow((f.size+player.size)*.45,2)){playerEatFish(f);f.dead=true;}
};
function updateDugongDens(dt){
 OCEAN.denTimer+=dt;if(OCEAN.denTimer<1)return;OCEAN.denTimer=0;
 DEN_DEFS.forEach(function(d,i){
  if(OCEAN.harvested[d.id]||dist2(player.x,player.y,d.x,d.y)>2200*2200)return;
  if(!OCEAN.seen[d.id]&&dist2(player.x,player.y,d.x,d.y)<420*420){OCEAN.seen[d.id]=true;banner('隐藏区域 · '+d.name+' · 海草深处有温顺的巨影');}
  if(fishes.some(function(f){return !f.dead&&f.rareDen===d.id;}))return;
  var f=fishPool.length?fishPool.pop():newFish();initHabitatFish(f,dugongSpec,d.x,d.y,20+i*3);f.rareDen=d.id;fishes.push(f);
 });
}
var resetBeforeWorld=resetGame;
resetGame=function(){
 resetBeforeWorld();OCEAN.seen={};OCEAN.harvested={};OCEAN.denTimer=0;OCEAN.region=-1;OCEAN.stocked={};OCEAN.schoolTimer=0;
 // Shift the whole opening shoal together with the player into the actual nursery.
 var dx=SITES[0].x-player.x,dy=SITES[0].y-player.y;player.x+=dx;player.y+=dy;
 fishes.forEach(function(f){if(f.born===-1){f.x+=dx;f.y+=dy;f.hx=f.x;f.hy=f.y;}else f.dead=true;});
 foods.forEach(function(f){f.dead=true;});
 cam.x=player.x;cam.y=player.y;
 for(var i=0;i<12;i++)spawnFood('shrimp');
};
var updateBeforeWorld=update;
update=function(dt){
 updateBeforeWorld(dt);if(gameState!=='playing'||!player.alive)return;
 updateDugongDens(dt);updateCaveSchools(dt);
 var region=oceanRegion(player.x,player.y);
 if(region!==OCEAN.region){OCEAN.region=region;banner(REGIONS[region].name+' · 建议体长 '+REGIONS[region].min+'+');}
};
var fishDrawBeforeDugong=drawFishSprite;
drawFishSprite=function(f,x,y,s,a,t,inflate,isPlayer,time){
 if(isPlayer||!f.spec.rareDugong){fishDrawBeforeDugong(f,x,y,s,a,t,inflate,isPlayer,time);return;}
 ctx.save();ctx.translate(x,y);ctx.rotate(a);if(Math.cos(a)<0)ctx.scale(1,-1);
 var g=ctx.createLinearGradient(0,-s*.65,0,s*.65);g.addColorStop(0,'#b8cdc6');g.addColorStop(1,'#7b9995');ctx.fillStyle=g;
 ctx.beginPath();ctx.ellipse(0,0,s*1.2,s*.6,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#829e99';ctx.save();ctx.translate(-s,0);ctx.rotate(Math.sin(t)*.13);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-s*.8,-s*.7,-s*.95,-s*.45);ctx.lineTo(-s*.7,0);ctx.lineTo(-s*.95,s*.45);ctx.quadraticCurveTo(-s*.8,s*.7,0,0);ctx.fill();ctx.restore();
 ctx.fillStyle='#75958e';ctx.beginPath();ctx.ellipse(s*.2,s*.45,s*.45,s*.12,.45,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#d7ddd0';ctx.beginPath();ctx.ellipse(s*.97,s*.16,s*.34,s*.23,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#172c31';ctx.beginPath();ctx.arc(s*.86,-s*.16,s*.065,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#e6e3c4';ctx.lineWidth=1;for(var i=0;i<3;i++){ctx.beginPath();ctx.moveTo(s*1.12,s*.15+i*2);ctx.lineTo(s*1.45,s*.1+i*3);ctx.stroke();}
 ctx.restore();
 if(dist2(x,y,player.x,player.y)<430*430){ctx.save();ctx.textAlign='center';ctx.fillStyle='#c7e8bf';ctx.font='12px system-ui';ctx.fillText('儒艮 · 温顺 · '+(s<player.size*.85?'稀有营养':'体长 '+Math.ceil(s/.85)+' 可捕食'),x,y-s-20);ctx.restore();}
};
// Depth, entrances and discovered side chambers provide visual navigation.
var worldDrawBeforeCaves=drawExpeditionWorld;
drawExpeditionWorld=function(time){
 worldDrawBeforeCaves(time);ctx.save();
 CAVE_HINTS.forEach(function(p){
  if(Math.abs(p.x-cam.x)>W/(2*cam.z)+100||Math.abs(p.y-cam.y)>H/(2*cam.z)+100)return;
  ctx.textAlign='center';ctx.font='600 17px system-ui';ctx.fillStyle=player.size<p.min?'#f0b993':'#a4dfd0';ctx.fillText(p.title,p.x,p.y-35);ctx.font='12px system-ui';ctx.fillText(p.sub+' · 建议体长 '+p.min+'+',p.x,p.y-12);
 });
 DEN_DEFS.forEach(function(d){
  if(Math.abs(d.x-cam.x)>W/(2*cam.z)+500||Math.abs(d.y-cam.y)>H/(2*cam.z)+500)return;
  // A readable little sea-grass meadow marks the reward chamber itself.
  ctx.strokeStyle='#77bea5';ctx.lineWidth=3;
  for(var i=0;i<16;i++){var x=d.x-230+i*30,bands=surfaceBands(d.rock,x),y=bands.find(function(y){return y>d.y+60;});if(!y)continue;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-15+Math.sin(time+i)*8,y-45,x+Math.sin(time*.7+i)*18,y-90-i%3*16);ctx.stroke();}
  if(OCEAN.seen[d.id]){ctx.font='14px system-ui';ctx.fillStyle='#b5e0bf';ctx.textAlign='center';ctx.fillText(d.name+(OCEAN.harvested[d.id]?' · 已探索':' · 隐秘海草床'),d.x,d.y-85);}
 });ctx.restore();
};
var hudBeforeDepth=drawHUD;
drawHUD=function(time){
 hudBeforeDepth(time);ctx.save();var region=REGIONS[oceanRegion(player.x,player.y)];
 ctx.font='12px system-ui';ctx.fillStyle=region.color;ctx.textAlign='center';ctx.fillText(region.name+' · 水深 '+Math.round(player.y/10)+' m · 建议体长 '+region.min+'+',W/2,Math.min(H-85,80));
 ctx.restore();
};
drawChart=function(){
 var c=el('t-chart'),rect=c.getBoundingClientRect();if(!rect.width||!OCEAN.atlas)return;
 c.width=Math.round(rect.width*DPR);c.height=Math.round(rect.height*DPR);var g=c.getContext('2d');g.scale(DPR,DPR);
 var scale=Math.min(rect.width/CONF.WORLD_W,(rect.height-40)/CONF.WORLD_H),ox=(rect.width-CONF.WORLD_W*scale)/2,oy=28;
 g.save();g.translate(ox,oy);g.imageSmoothingEnabled=true;g.drawImage(OCEAN.atlas,0,0,CONF.WORLD_W*scale,CONF.WORLD_H*scale);
 g.lineWidth=1;g.setLineDash([3,4]);g.strokeStyle='#b2e8db65';
 WORLD_ROUTES.forEach(function(route){g.beginPath();route.points.forEach(function(p,i){if(!i)g.moveTo(p[0]*scale,p[1]*scale);else g.lineTo(p[0]*scale,p[1]*scale);});g.stroke();});g.setLineDash([]);
 SITES.forEach(function(p,i){g.fillStyle=expedition.sites[i]?'#98edbd':'#f4d4a5';g.beginPath();g.arc(p.x*scale,p.y*scale,4,0,Math.PI*2);g.fill();g.font='11px system-ui';g.fillText(p.name,p.x*scale+7,p.y*scale-7);});
 var labels=[{x:3600,y:700,t:'浅湾 · 10+'},{x:6000,y:9000,t:'翡翠山腹 · 18+'},{x:14600,y:4300,t:'珊瑚穹顶 · 30+'},{x:23000,y:4700,t:'鲸落迷宫 · 38+'},{x:17200,y:13400,t:'星陨深渊 · 58+'}];
 labels.forEach(function(p){g.font='12px system-ui';g.fillStyle='#cbe1e1';g.fillText(p.t,p.x*scale,p.y*scale);});
 DEN_DEFS.forEach(function(d){if(!OCEAN.seen[d.id])return;g.fillStyle='#b7e7b3';g.beginPath();g.arc(d.x*scale,d.y*scale,3,0,Math.PI*2);g.fill();g.fillText(d.name,d.x*scale+5,d.y*scale+12);});
 g.fillStyle='#fff6ad';g.beginPath();g.arc(player.x*scale,player.y*scale,4,0,Math.PI*2);g.fill();g.restore();
 g.font='11px system-ui';g.fillStyle='#adc5ce';g.fillText('虚线为可穿行洞道 · 区域数字为建议体长 · 绿色标记为已发现秘境',10,14);
};
el('t-map').querySelector('span').textContent='深蓝海图 · 群山与洞厅';
el('t-description').innerHTML='沿西侧潮口潜入群山，穿越巨型洞厅与下潜竖井。<br>隐秘海草床藏着温顺的儒艮；星陨裂口之下，大型猎手正在巡游。';
el('t-menu').querySelector('.t-grid div:nth-child(2)').innerHTML='<b>发现山体内部的世界</b>沿洞道记录 5 座信标，成长至体长 58<br>支路藏着高营养儒艮，每处每局仅一只';
// Cache the exposed surfaces of each x-column, including the floors inside caves.
// Shrimp reuse these profiles instead of rescanning a mountain from its summit every frame.
function surfaceBands(rock,x){
 if(x<rock.wx0+10||x>rock.wx1-10)return [];
 if(!rock.surfaceCache)rock.surfaceCache=new Map();
 var key=Math.floor((x-rock.wx0)/32);if(rock.surfaceCache.has(key))return rock.surfaceCache.get(key);
 var sampleX=rock.wx0+key*32+16,result=[],previous=rkField(rock,sampleX-rock.ax,rock.oy);
 for(var y=rock.wy0+32;y<rock.wy1;y+=32){
  var d=rkField(rock,sampleX-rock.ax,y-rock.ay);
  if(previous>=0&&d<0){var lo=y-32,hi=y;for(var n=0;n<5;n++){var mid=(lo+hi)/2;if(rkField(rock,sampleX-rock.ax,mid-rock.ay)<0)hi=mid;else lo=mid;}result.push(hi);}
  previous=d;
 }rock.surfaceCache.set(key,result);return result;
}
shrimpSurface=function(rock,x,hint){
 if(!rock)return floorAt(x);
 var bands=surfaceBands(rock,x);if(!bands.length)return null;
 if(!Number.isFinite(hint))return bands[0];
 var best=bands[0];for(var i=1;i<bands.length;i++)if(Math.abs(bands[i]-hint)<Math.abs(best-hint))best=bands[i];
 return Math.abs(best-hint)>220?null:best;
};
chooseShrimpHabitat=function(){
 for(var attempt=0;attempt<16;attempt++){
  var x=clamp(player.x+rand(-1500,1500),160,CONF.WORLD_W-160),probe=clamp(player.y+rand(-450,450),80,CONF.WORLD_H-100);
  if(rkInside(x,probe,20))continue;
  var candidates=[{surface:floorAt(x),reef:null}];
  RK_list.forEach(function(r){if(x<r.wx0||x>r.wx1||r.wy1<probe||r.wy0>probe+1400)return;surfaceBands(r,x).forEach(function(y){if(y>probe)candidates.push({surface:y,reef:r});});});
  candidates.sort(function(a,b){return a.surface-b.surface;});
  var hit=candidates[0],y=hit.surface-38;
  if(y<probe||dist2(x,y,player.x,player.y)>1900*1900||rkInside(x,y,14))continue;
  if(survivalTime>1&&Math.abs(x-cam.x)<W/(2*cam.z)+50&&Math.abs(y-cam.y)<H/(2*cam.z)+50)continue;
  return {x:x,y:y,reef:hit.reef,surface:hit.surface};
 }return null;
};

function updateCaveSchools(dt){
 OCEAN.schoolTimer=(OCEAN.schoolTimer||0)+dt;if(OCEAN.schoolTimer<1.4)return;OCEAN.schoolTimer=0;
 if(!OCEAN.stocked)OCEAN.stocked={};
 for(var i=0;i<RK_chambers.length;i++){
  var chamber=RK_chambers[i];if(chamber.r<700||OCEAN.stocked[i]||dist2(chamber.x,chamber.y,player.x,player.y)>2400*2400)continue;
  var count=0;
  for(var j=0;j<6&&fishes.length<190;j++){
   var x=chamber.x+rand(-.6,.6)*chamber.r,y=chamber.y+rand(-.6,.6)*chamber.r;
   if(rkInside(x,y,45)||y>floorAt(x)-80)continue;
   if(Math.abs(x-cam.x)<W/(2*cam.z)+80&&Math.abs(y-cam.y)<H/(2*cam.z)+80)continue;
   var sp=chooseHabitatSpecies(x,y,j<4),f=fishPool.length?fishPool.pop():newFish();initHabitatFish(f,sp,x,y,rand(sp.sMin,sp.sMax));fishes.push(f);count++;
  }
  if(count)OCEAN.stocked[i]=true;
 }
}
var reliefBeforeCaveLight=drawOceanRelief;
drawOceanRelief=function(time){
 reliefBeforeCaveLight(time);var cave=false;
 for(var i=0;i<4;i++){
  var r=RK_list[i];if(!r)continue;
  if(!r.shell)r.shell={blobs:r.blobs,caves:[],k:r.k};
  if(rkField(r.shell,player.x-r.ax,player.y-r.ay)<-50&&rkField(r,player.x-r.ax,player.y-r.ay)>0){cave=true;break;}
 }
 if(!cave)return;
 ctx.save();ctx.fillStyle='rgba(1,14,28,.46)';ctx.fillRect(cam.x-W/(2*cam.z),cam.y-H/(2*cam.z),W/cam.z,H/cam.z);
 var light=ctx.createRadialGradient(player.x,player.y,40,player.x,player.y,700);light.addColorStop(0,'rgba(68,156,164,.07)');light.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=light;ctx.fillRect(player.x-700,player.y-700,1400,1400);ctx.restore();
};

function protectRouteClearance(rock){
 rockBounds(rock);
 WORLD_ROUTES.forEach(function(route){for(var i=1;i<route.points.length;i++){
  var a=route.points[i-1],b=route.points[i],pad=180;
  if(Math.max(a[0],b[0])+pad<rock.wx0||Math.min(a[0],b[0])-pad>rock.wx1||Math.max(a[1],b[1])+pad<rock.wy0||Math.min(a[1],b[1])-pad>rock.wy1)continue;
  carvePath(rock,[a,b],180);
 }});
}

function oceanZoomCap(){
 for(var i=0;i<4;i++){
  var r=RK_list[i];if(!r)continue;
  if(!r.shell)r.shell={blobs:r.blobs,caves:[],k:r.k};
  if(rkField(r.shell,player.x-r.ax,player.y-r.ay)<-50&&rkField(r,player.x-r.ax,player.y-r.ay)>0)return W<650?.98:.86;
 }return 1.25;
}
