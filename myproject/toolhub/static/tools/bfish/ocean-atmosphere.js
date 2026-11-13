/* World-anchored transitions and rear geology; nothing depends on the player's layer ID. */
function oceanEase(a,b,v){var t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);}
// Only the interior of the horizontal separating shelves is a crossing tunnel.
// Its open approach ramps retain water/A behind them, not a widened rear-wall capsule.
var PASSAGE_CORES=new Map();
function buildLayerPassageCore(r){
 var base=Object.assign({},r,{caves:[],rectCuts:[]}),upper=[],lower=[],margin=145;
 for(var x=r.wx0+20;x<=r.wx1-20;x+=40){
  var hits=[];for(var y=r.wy0;y<=r.wy1;y+=40)if(rkField(base,x-r.ax,y-r.ay)<-margin)hits.push(y);
  if(!hits.length)continue;
  function edge(lo,hi){for(var i=0;i<9;i++){var mid=(lo+hi)/2;if(rkField(base,x-r.ax,mid-r.ay)<-margin)hi=mid;else lo=mid;}return (lo+hi)/2;}
  var top=edge(hits[0]-40,hits[0]),bottomLo=hits[hits.length-1],bottomHi=bottomLo+40;
  for(var i=0;i<9;i++){var mid=(bottomLo+bottomHi)/2;if(rkField(base,x-r.ax,mid-r.ay)<-margin)bottomLo=mid;else bottomHi=mid;}
  upper.push([x,top]);lower.push([x,(bottomLo+bottomHi)/2]);
 }
 var path=new Path2D();upper.forEach((v,i)=>i?path.lineTo(v[0],v[1]):path.moveTo(v[0],v[1]));lower.reverse().forEach(v=>path.lineTo(v[0],v[1]));path.closePath();
 // Keep pre-existing side chambers and hidden dens: the restriction applies
 // only to route cuts crossing these horizontal shelves.
 for(var i=0;i<r.caves.length;i+=5){var a=[r.ax+r.caves[i],r.ay+r.caves[i+1]],b=[r.ax+r.caves[i+2],r.ay+r.caves[i+3]],radius=r.caves[i+4],crossing=WORLD_ROUTES.some(route=>route.points.some((q,j)=>j&&Math.hypot(q[0]-b[0],q[1]-b[1])<1&&Math.hypot(route.points[j-1][0]-a[0],route.points[j-1][1]-a[1])<1));if(crossing)continue;
  path.moveTo(a[0]+radius,a[1]);path.arc(a[0],a[1],radius,0,Math.PI*2);path.moveTo(b[0]+radius,b[1]);path.arc(b[0],b[1],radius,0,Math.PI*2);
  var dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len){var nx=-dy/len*radius,ny=dx/len*radius;path.moveTo(a[0]+nx,a[1]+ny);path.lineTo(a[0]-nx,a[1]-ny);path.lineTo(b[0]-nx,b[1]-ny);path.lineTo(b[0]+nx,b[1]+ny);path.closePath();}
 }
 return {path:path,upper:upper,lower:lower};
}
var bakeBeforePassageAtmosphere=bakeBackgrounds;
bakeBackgrounds=async function(){await bakeBeforePassageAtmosphere();await bootYield();PASSAGE_CORES.clear();RK_list.forEach(r=>{if(/^第[一二三]层：/.test(r.name))PASSAGE_CORES.set(r,buildLayerPassageCore(r));});};
function clipLayerPassageRear(r){var core=PASSAGE_CORES.get(r);if(core)ctx.clip(core.path);}
function drawLivingSky(time,left,right,top){
 ctx.save();ctx.clip();var sky=ctx.createLinearGradient(0,Math.min(top,-1700),0,0);sky.addColorStop(0,'#477fae');sky.addColorStop(.55,'#86c4df');sky.addColorStop(.86,'#c9e6e9');sky.addColorStop(1,'#e4eee4');ctx.fillStyle=sky;ctx.fillRect(left,top,right-left,-top+30);
 var sx=cam.x+(3200-cam.x)*.12,sy=-650;var glow=ctx.createRadialGradient(sx,sy,20,sx,sy,400);glow.addColorStop(0,'#fff6d5a0');glow.addColorStop(1,'#fff3d000');ctx.fillStyle=glow;ctx.fillRect(sx-400,sy-400,800,800);ctx.fillStyle='#fff6df';ctx.beginPath();ctx.arc(sx,sy,42,0,Math.PI*2);ctx.fill();
 for(var i=Math.floor((left-cam.x*.92)/800)-1;i<(right-cam.x*.92)/800+1;i++){var cx=i*800+cam.x*.92+Math.sin(i*2.1)*180+time*2,cy=-220-((i*173%460)+460)%460;ctx.fillStyle='#f5f4e3b5';ctx.beginPath();ctx.ellipse(cx,cy,155,24,0,0,Math.PI*2);ctx.ellipse(cx-67,cy-13,66,35,0,0,Math.PI*2);ctx.ellipse(cx+28,cy-22,77,43,0,0,Math.PI*2);ctx.fill();}
 for(var i=0;i<3;i++){var ix=cam.x+(2500+i*9000-cam.x)*.07;if(ix<left-550||ix>right+550)continue;ctx.fillStyle=['#6d9ca9','#568696','#3c7084'][i];ctx.beginPath();ctx.moveTo(ix-400,4);ctx.bezierCurveTo(ix-330,-4,ix-280,-80,ix-190,-65);ctx.bezierCurveTo(ix-110,-52,ix-50,-165,ix+55,-125);ctx.bezierCurveTo(ix+170,-90,ix+220,-10,ix+420,4);ctx.closePath();ctx.fill();}
 ctx.strokeStyle='#4e7587';ctx.lineWidth=2;for(var i=0;i<9;i++){var x=left+((i*379+time*14)%(right-left)),y=-110-((i*83)%420),wing=7+Math.sin(time*2+i)*3;ctx.beginPath();ctx.moveTo(x-12,y-wing);ctx.quadraticCurveTo(x-5,y-wing-3,x,y);ctx.quadraticCurveTo(x+5,y-wing-3,x+12,y-wing);ctx.stroke();}ctx.restore();
}

oceanZoomCap=function(){var ice=oceanEase(18400,20200,player.x)*(1-oceanEase(6200,7200,player.y)),upper=lerp(1.2,.95,oceanEase(2700,3900,player.y));return lerp(lerp(upper,.95,ice),.72,oceanEase(6200,7800,player.y));};
