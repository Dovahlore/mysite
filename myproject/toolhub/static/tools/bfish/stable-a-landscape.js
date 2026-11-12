/* Three opaque relief planes. Their terraces and ecology belong to world space. */
var STABLE_A=[{x:.05,y:.84,base:1750,amplitude:430,blur:2.2},{x:.1,y:.93,base:2550,amplitude:230,blur:.8},{x:.18,y:1,base:3150,amplitude:105,blur:0}],A_FAR_CANVAS=null;
var A_TERRACES=[0,3000,6200,9500,12500],A_ROCK_ART=new Map();
function aMountainCrest(layer,u,camY,band){var l=STABLE_A[layer],anchor=l.base+(A_TERRACES[band||0]||0),ridge=Math.sin(u*.0014+layer*1.8)*l.amplitude+Math.sin(u*.0031+layer)*l.amplitude*.22;return anchor+ridge+camY*(1-l.y);}
function aBackdropPatch(layer,cell,band){var l=STABLE_A[layer],anchor=(cell*1100+550)/l.x,zone=sceneryZoneAt(clamp(anchor,0,CONF.WORLD_W),l.base+(A_TERRACES[band||0]||0));return {zone:zone,seed:Math.abs(cell*31+layer*17+(band||0)*13)%5};}
function aRockArt(zone,seed){var key=zone+':'+seed%6;if(A_ROCK_ART.has(key))return A_ROCK_ART.get(key);var c=newCanvas(360,480),g=c.getContext('2d');g.scale(3,3);paintRockVariant(g,seed%6,(zone==='shallow'?0:zone==='shelf'?100:zone==='deep'||zone==='volcano'?200:300)+seed,zone==='ice',zone==='deep'||zone==='volcano');A_ROCK_ART.set(key,c);return c;}
function aReliefStyle(zone,layer){var deep=zone==='deep'||zone==='volcano',ice=zone==='ice';return {top:(zone==='volcano'?['#293b47','#34454f','#40515a']:deep?['#354c60','#3d5566','#496173']:ice?['#698d9e','#7c9eaa','#89aeb7']:['#527e82','#628d8c','#749b94'])[layer],bottom:deep?'#182f43':ice?'#375e73':'#244b59'};}
function aBotanicalPool(zone){return zone==='shallow'?['grass','pink','orange','grass','fan','table','anemone']:zone==='shelf'?['pink','orange','table','fan','sponge','grass']:zone==='kelp'?['kelp','grass','kelp','anemone','kelp','sponge']:zone==='ice'?['anemone','sponge']:['cold','pen','sponge','cold','anemone'];}
function drawAWorldLayer(g,layer,zone,view){var l=STABLE_A[layer],hw=view.w/(2*view.z),hh=view.h/(2*view.z),shift=view.x*(1-l.x),left=view.x-hw-650,right=view.x+hw+650;
 for(var band=0;band<A_TERRACES.length;band++){
  var center=aMountainCrest(layer,view.x-shift,view.y,band);if(center>view.y+hh+950)continue;
  var root=u=>aMountainCrest(layer,u,view.y,band),slope=u=>(root(u+2)-root(u-2))/4,patchAt=cell=>view.forceZone?{zone:view.forceZone,seed:Math.abs(cell)%5}:aBackdropPatch(layer,cell,band);
  // Outcrops share the same tangent as the continuous bed and are buried at their roots.
  for(var cell=Math.floor((left-shift)/450);cell<=(right-shift)/450;cell++){
   var u=cell*450+60,x=u+shift,y=root(u),seed=Math.abs(cell*7+layer*11+band*19),patch=patchAt(Math.floor(u/1100)),height=[270,210,100][layer]+decorNoise(seed,31)*[350,220,140][layer],width=180+decorNoise(seed,44)*220;
   if(y-height>view.y+hh||y<view.y-hh-100)continue;g.save();g.translate(x,y+22);g.rotate(Math.atan(slope(u)));g.drawImage(aRockArt(patch.zone,seed),-width/2,-height*157/160,width,height);g.restore();
  }
  var first=Math.floor((left-shift)/1100),last=Math.ceil((right+20-shift)/1100),fill=g.createLinearGradient(first*1100+shift,0,last*1100+shift,0);for(var stop=first;stop<=last;stop++){var patch=patchAt(stop);fill.addColorStop((stop-first)/(last-first),aReliefStyle(patch.zone,layer).top);}g.fillStyle=fill;g.beginPath();for(var x=left;x<=right+20;x+=20){var y=root(x-shift);if(x===left)g.moveTo(x,y);else g.lineTo(x,y);}g.lineTo(right+20,CONF.WORLD_H+4000);g.lineTo(left,CONF.WORLD_H+4000);g.closePath();g.fill();
  // Texture follows the same continuous contour, with no rectangular tile boundaries.
  g.save();g.clip();g.lineWidth=1.4;for(var row=0;row<8;row++){g.strokeStyle=row%2?'#b4c4b422':'#112c3e40';g.beginPath();for(var x=left;x<=right+30;x+=30){var y=root(x-shift)+14+row*32+Math.sin((x-shift)*.008+row)*8;if(x===left)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();}g.restore();
  var spacing=layer===0?145:layer===1?135:120;for(var cell=Math.floor((left-shift)/spacing);cell<=(right-shift)/spacing;cell++){
   var u=(cell+.25+decorNoise(cell,19)*.45)*spacing,x=u+shift,y=root(u)+7,seed=Math.abs(cell*7+layer*11+band*17),patch=patchAt(Math.floor(u/1100)),pool=aBotanicalPool(patch.zone),kind=pool[Math.floor(decorNoise(seed,117)*pool.length)],height=(kind==='kelp'?300:90)+decorNoise(seed,81)*(kind==='kelp'?210:135),width=height*(kind==='kelp'?.43:kind==='grass'?.58:.76);height*=[.72,.88,1][layer];width*=[.72,.88,1][layer];if(y-height>view.y+hh||y<view.y-hh-50||(patch.zone==='volcano'&&decorNoise(seed,333)<.65)||(patch.zone==='ice'&&decorNoise(seed,334)<.35))continue;
   g.save();g.translate(x,y);if(kind==='grass'||kind==='kelp')g.transform(1,slope(u),0,1,0,0);else g.rotate(Math.atan(slope(u)));g.drawImage(backdropBotanical(kind,seed),-width/2,-height*157/160,width,height);g.restore();
  }
 }
}
var A_PLANE_CACHE=[];
function drawStableALayers(time){var zone=sceneryZoneAt(cam.x,cam.y),margin=128;
 for(var layer=0;layer<3;layer++){var l=STABLE_A[layer],cache=A_PLANE_CACHE[layer],res=[.55,.8,1][layer],cw=W+margin*2,ch=H+margin*2,changed=!cache||cache.w!==W||cache.h!==H||Math.abs(cam.z/cache.z-1)>.025||Math.abs(cam.x-cache.x)*l.x*cam.z>64||Math.abs(cam.y-cache.y)*l.y*cam.z>64;
  if(changed){if(!cache)cache=A_PLANE_CACHE[layer]={};var pw=Math.ceil(cw*res),ph=Math.ceil(ch*res);if(!cache.raw||cache.raw.width!==pw||cache.raw.height!==ph){cache.raw=newCanvas(pw,ph);cache.canvas=l.blur?newCanvas(pw,ph):cache.raw;}var g=cache.raw.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,pw,ph);g.setTransform(cam.z*res,0,0,cam.z*res,pw/2-cam.x*cam.z*res,ph/2-cam.y*cam.z*res);drawAWorldLayer(g,layer,zone,{x:cam.x,y:cam.y,z:cam.z,w:cw,h:ch});if(l.blur){var out=cache.canvas.getContext('2d');out.clearRect(0,0,pw,ph);out.filter='blur('+(l.blur*res)+'px)';out.drawImage(cache.raw,0,0);out.filter='none';}cache.x=cam.x;cache.y=cam.y;cache.z=cam.z;cache.w=W;cache.h=H;cache.worldW=cw/cam.z;cache.worldH=ch/cam.z;}
  var x=cache.x-cache.worldW/2+(cam.x-cache.x)*(1-l.x),y=cache.y-cache.worldH/2+(cam.y-cache.y)*(1-l.y);ctx.drawImage(cache.canvas,x,y,cache.worldW,cache.worldH);
 }
}
var bakeBeforeStableA=bakeBackgrounds;bakeBackgrounds=function(){bakeBeforeStableA();A_ROCK_ART.clear();A_PLANE_CACHE=[];DECOR_CATALOGUE.forEach(e=>{if(e.kind!=='视差背景'||e.name.includes('船舱'))return;var layer=e.name.includes('远景')?0:e.name.includes('中景')?1:2,c=newCanvas(768,768),g=c.getContext('2d'),view={x:8000,y:5400,z:.45,w:768,h:768,forceZone:e.zone};g.setTransform(view.z,0,0,view.z,384-view.x*view.z,384-view.y*view.z);drawAWorldLayer(g,layer,e.zone,view);e.canvas=STABLE_A[layer].blur?blurBackdropCanvas(c,STABLE_A[layer].blur):c;e.note='连续岩床与法线贴合 · 近层清晰、远层景深 · 世界固定生态与分层高度';});};
