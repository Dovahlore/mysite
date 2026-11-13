/* Three opaque relief planes. Their terraces and ecology belong to world space. */
var STABLE_A=[{x:.05,y:.84,base:1750,amplitude:430,blur:2.2},{x:.1,y:.93,base:2550,amplitude:230,blur:.8},{x:.18,y:1,base:3150,amplitude:105,blur:0}],A_FAR_CANVAS=null;
var A_TERRACES=[0,3700,7050],A_ROCK_ART=new Map();
var A_BED_PROFILES=[],A_STRATUM_CLIPS=[],A_ALL_STRATA_CLIP=null;
function aLayerBedAt(x,band){var row=A_BED_PROFILES[band];if(!row)return [3200,6900,10600][band];var u=clamp(x/80,0,row.length-1),i=Math.floor(u),j=Math.min(i+1,row.length-1);return lerp(row[i],row[j],u-i);}
function buildABedProfiles(){A_BED_PROFILES=[];A_STRATUM_CLIPS=[];A_ALL_STRATA_CLIP=new Path2D();
 var names=[['第一层：珊瑚大陆架'],['第二层：蓝潮断层'],['第三层：深渊顶板','冰下神庙上层石基']];
 for(var band=0;band<3;band++){var rocks=RK_list.filter(r=>names[band].includes(r.name)),row=[];
  for(var x=0;x<=CONF.WORLD_W+80;x+=80){var bed=Infinity;for(var r of rocks){if(x<r.wx0||x>r.wx1)continue;var lo=r.wy0,hi=null;for(var y=r.wy0;y<=r.ay;y+=80){if(rkField(r,x-r.ax,y-r.ay)<0){hi=y;break;}lo=y;}if(hi===null)continue;for(var j=0;j<10;j++){var m=(lo+hi)/2;if(rkField(r,x-r.ax,m-r.ay)<0)hi=m;else lo=m;}bed=Math.min(bed,(lo+hi)/2);}row.push(Number.isFinite(bed)?bed:[3200,6900,10600][band]);}
  A_BED_PROFILES.push(row);var clip=new Path2D(),top=[0,4350,8250][band];clip.moveTo(0,top);clip.lineTo(CONF.WORLD_W,top);for(var x=CONF.WORLD_W;x>=0;x-=40)clip.lineTo(x,[3750,7550,11150][band]);clip.closePath();A_STRATUM_CLIPS.push(clip);A_ALL_STRATA_CLIP.addPath(clip);
 }
}
function aMountainCrest(layer,u,camY,band){var l=STABLE_A[layer],floor=[3200,6900,10250,16600][band||0],rise=[1000,470,80][layer],amplitude=[230,110,42][layer],ridge=Math.sin(u*.0011+layer*1.8)*amplitude+Math.sin(u*.0031+layer)*amplitude*.28;return floor*l.y-rise+ridge+camY*(1-l.y);}
function aBackdropPatch(layer,cell,band){var l=STABLE_A[layer],anchor=(cell*1100+550)/l.x,depth=[3100,6700,10000,16300][band||0],zone=sceneryZoneAt(clamp(anchor,0,CONF.WORLD_W),depth);return {zone:zone,seed:Math.abs(cell*31+layer*17+(band||0)*13)%5};}
function aRockArt(zone,seed){var key=zone+':'+seed%6;if(A_ROCK_ART.has(key))return A_ROCK_ART.get(key);var c=newCanvas(360,480),g=c.getContext('2d');g.scale(3,3);paintRockVariant(g,seed%6,(zone==='shallow'?0:zone==='shelf'?100:zone==='deep'||zone==='volcano'?200:300)+seed,zone==='ice',zone==='deep'||zone==='volcano');A_ROCK_ART.set(key,c);return c;}
function aReliefStyle(zone,layer,band){var colors=zone==='ice'?['#345970','#487b90','#6398a8']:(band===1?['#203e55','#2d5669','#3a6f7b']:band===2?['#172b45','#233e59','#2e5267']:['#31595d','#417369','#568775']);return {top:colors[layer],bottom:band===2?'#0c2034':'#173b49'};}
function aBotanicalPool(zone){return zone==='shallow'?['grass','pink','orange','grass','fan','table','anemone']:zone==='shelf'?['pen','cold','fan','sponge','pen','cold']:zone==='kelp'?['kelp','grass','kelp','anemone','kelp','sponge']:zone==='ice'?['pen','sponge','anemone','cold']:zone==='volcano'?['tubeworm','mussel','tubeworm']:['frond','pen','sponge','cold','crinoid','frond'];}
function drawAWorldLayer(g,layer,zone,view){var l=STABLE_A[layer],hw=view.w/(2*view.z),hh=view.h/(2*view.z),shift=view.x*(1-l.x),left=view.x-hw-650,right=view.x+hw+650;
 for(var band=0;band<3;band++){
  // Each ocean owns its own three parallax planes. Their lower silhouettes
  // cannot spill through the separating shelf into the next ocean.
  var bandTop=[0,4350,8250][band],bandBottom=[3750,7550,11150][band];
  if(view.y-hh>bandBottom||view.y+hh<bandTop)continue;
  var root=u=>aMountainCrest(layer,u,view.y,band),slope=u=>(root(u+2)-root(u-2))/4,patchAt=cell=>view.forceZone?{zone:view.forceZone,seed:Math.abs(cell)%5}:aBackdropPatch(layer,cell,band),bottom=([4350,8250,12250,17400][band])*l.y+view.y*(1-l.y);
  if(bottom<view.y-hh-40||root(view.x-shift)>view.y+hh+800)continue;
  g.save();g.beginPath();if(A_STRATUM_CLIPS[band])g.clip(A_STRATUM_CLIPS[band]);else{g.rect(left,bandTop,right-left+20,bandBottom-bandTop);g.clip();}
  // Widely spaced outcrops leave low meadows between them.
  for(var cell=Math.floor((left-shift)/700);cell<=(right-shift)/700;cell++){
   var u=cell*700+80,x=u+shift,y=root(u),seed=Math.abs(cell*7+layer*11+band*19),patch=patchAt(Math.floor(u/1100)),height=[180,125,55][layer]+decorNoise(seed,31)*[230,150,95][layer],width=160+decorNoise(seed,44)*150;
   if(y-height>view.y+hh||y<view.y-hh-100||decorNoise(seed,14)<.28)continue;g.save();g.translate(x,y+22);g.rotate(Math.atan(slope(u)));g.drawImage(aRockArt(patch.zone,seed),-width/2,-height*157/160,width,height);g.restore();
  }
  var first=Math.floor((left-shift)/1100),last=Math.ceil((right+20-shift)/1100),fill=g.createLinearGradient(first*1100+shift,0,last*1100+shift,0);for(var stop=first;stop<=last;stop++)fill.addColorStop((stop-first)/(last-first),aReliefStyle(patchAt(stop).zone,layer,band).top);
  g.fillStyle=fill;g.beginPath();for(var x=left;x<=right+20;x+=20){var y=root(x-shift);if(x===left)g.moveTo(x,y);else g.lineTo(x,y);}for(var bx=right+20;bx>=left;bx-=20)g.lineTo(bx,[3750,7550,11150][band]+450);g.closePath();g.fill();
  g.save();g.clip();g.lineWidth=1.4;for(var row=0;row<7;row++){g.strokeStyle=row%2?'#b4c4b419':'#112c3e40';g.beginPath();for(var x=left;x<=right+30;x+=30){var y=root(x-shift)+14+row*35+Math.sin((x-shift)*.008+row)*8;if(x===left)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();}g.restore();
  // Three offset growth rows occupy flat benches too, rather than one line of ridge-top coral.
  var spacing=(layer===0?220:layer===1?180:155)*(band?.86:1);
  for(var row=0;row<(band===0?1:3);row++)for(var cell=Math.floor((left-shift)/spacing);cell<=(right-shift)/spacing;cell++){
   var u=(cell+.15+decorNoise(cell,row+19)*.7)*spacing,x=u+shift,y=root(u)+7+row*90,seed=Math.abs(cell*7+layer*11+band*17+row*53),patch=patchAt(Math.floor(u/1100)),pool=band===1?(patch.zone==='ice'?['leafpen','pen','sponge','frond']:['broadweed','kelp','grass','broadweed','fan','sponge']):band===2?['leafpen','frond','leafpen','pen','cold','sponge']:aBotanicalPool(patch.zone),kind=pool[Math.floor(decorNoise(seed,117)*pool.length)],height=(kind==='broadweed'?420:kind==='leafpen'?290:kind==='kelp'?300:kind==='frond'||kind==='pen'?180:80)+decorNoise(seed,81)*(kind==='broadweed'?250:kind==='leafpen'?230:kind==='kelp'?210:kind==='frond'||kind==='pen'?220:140),width=height*(kind==='broadweed'?.52:kind==='leafpen'?.62:kind==='kelp'||kind==='frond'?.43:kind==='pen'?.32:.76);
   height*=[.66,.85,1][layer]*(row? .6:1);width*=[.66,.85,1][layer]*(row?.6:1);
   if(y-height>view.y+hh||y<view.y-hh-50||decorNoise(seed,333)<(row?(band?.36:.5):(band?.08:.14)))continue;
   g.save();g.translate(x,y);if(['grass','kelp','pen','frond','broadweed','leafpen'].includes(kind))g.transform(1,slope(u),0,1,0,0);else g.rotate(Math.atan(slope(u)));g.drawImage(backdropBotanical(kind,seed),-width/2,-height*157/160,width,height);g.restore();
  }
  g.restore();
 }
}
var A_PLANE_CACHE=[];
function drawStableALayers(time){var zone=sceneryZoneAt(cam.x,cam.y),margin=128;
 for(var layer=0;layer<3;layer++){var l=STABLE_A[layer],cache=A_PLANE_CACHE[layer],res=[.55,.8,1][layer],cw=W+margin*2,ch=H+margin*2,changed=!cache||cache.w!==W||cache.h!==H||Math.abs(cam.z/cache.z-1)>.025||Math.abs(cam.x-cache.x)*l.x*cam.z>64||Math.abs(cam.y-cache.y)*l.y*cam.z>64;
  if(changed){if(!cache)cache=A_PLANE_CACHE[layer]={};var pw=Math.ceil(cw*res),ph=Math.ceil(ch*res);if(!cache.raw||cache.raw.width!==pw||cache.raw.height!==ph){cache.raw=newCanvas(pw,ph);cache.canvas=l.blur?newCanvas(pw,ph):cache.raw;}var g=cache.raw.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,pw,ph);g.setTransform(cam.z*res,0,0,cam.z*res,pw/2-cam.x*cam.z*res,ph/2-cam.y*cam.z*res);drawAWorldLayer(g,layer,zone,{x:cam.x,y:cam.y,z:cam.z,w:cw,h:ch});if(l.blur){var out=cache.canvas.getContext('2d');out.clearRect(0,0,pw,ph);out.filter='blur('+(l.blur*res)+'px)';out.drawImage(cache.raw,0,0);out.filter='none';}cache.x=cam.x;cache.y=cam.y;cache.z=cam.z;cache.w=W;cache.h=H;cache.worldW=cw/cam.z;cache.worldH=ch/cam.z;}
  var x=cache.x-cache.worldW/2+(cam.x-cache.x)*(1-l.x),y=cache.y-cache.worldH/2+(cam.y-cache.y)*(1-l.y);ctx.save();ctx.beginPath();if(A_ALL_STRATA_CLIP)ctx.clip(A_ALL_STRATA_CLIP);ctx.drawImage(cache.canvas,x,y,cache.worldW,cache.worldH);ctx.restore();
 }
}
var bakeBeforeStableA=bakeBackgrounds;bakeBackgrounds=async function(){await bakeBeforeStableA();await bootYield();buildABedProfiles();A_ROCK_ART.clear();A_PLANE_CACHE=[];DECOR_CATALOGUE.forEach(e=>{if(e.kind!=='视差背景'||e.name.includes('船舱'))return;var layer=e.name.includes('远景')?0:e.name.includes('中景')?1:2,c=newCanvas(768,768),g=c.getContext('2d'),view={x:8000,y:5400,z:.45,w:768,h:768,forceZone:e.zone};g.setTransform(view.z,0,0,view.z,384-view.x*view.z,384-view.y*view.z);drawAWorldLayer(g,layer,e.zone,view);e.canvas=STABLE_A[layer].blur?blurBackdropCanvas(c,STABLE_A[layer].blur):c;e.note='连续岩床与法线贴合 · 近层清晰、远层景深 · 世界固定生态与分层高度';});};
