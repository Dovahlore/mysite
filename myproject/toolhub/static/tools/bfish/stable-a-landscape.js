/* A scenery has a crest, not a rectangular bottom: every mountain reaches the ocean bed. */
var STABLE_A=[{x:.05,y:.035,base:800,amplitude:270},{x:.1,y:.07,base:2400,amplitude:430},{x:.18,y:.12,base:3900,amplitude:620}],A_FAR_CANVAS=null;
function aMountainCrest(layer,u,camY){var l=STABLE_A[layer],depth=clamp(camY/5000,0,1),offset=l.base*(1-depth)+[-600,100,900][layer]*depth;return Math.max(350,camY+offset+Math.sin(u*.0014+layer*1.8)*l.amplitude+Math.sin(u*.0031+layer)*l.amplitude*.22);}
/* Each distant outcrop owns its biome. Crossing a boundary never repaints the whole view. */
function aBackdropPatch(layer,cell){var l=STABLE_A[layer],anchor=(cell*1100+550)/l.x,zone=sceneryZoneAt(clamp(anchor,0,CONF.WORLD_W),[1500,2800,5200][layer]);return {zone:zone,seed:Math.abs(cell*31+layer*17)%5};}
var A_RICH_PATCHES=new Map();
function aRichPatch(tile){if(A_RICH_PATCHES.has(tile))return A_RICH_PATCHES.get(tile);var c=newCanvas(tile.width,tile.height),g=c.getContext('2d');g.drawImage(tile,0,0);g.globalCompositeOperation='destination-in';var edge=g.createLinearGradient(0,0,c.width,0);edge.addColorStop(0,'transparent');edge.addColorStop(.055,'white');edge.addColorStop(.945,'white');edge.addColorStop(1,'transparent');g.fillStyle=edge;g.fillRect(0,0,c.width,c.height);var bottom=g.createLinearGradient(0,0,0,c.height);bottom.addColorStop(0,'white');bottom.addColorStop(.88,'white');bottom.addColorStop(1,'transparent');g.fillStyle=bottom;g.fillRect(0,0,c.width,c.height);A_RICH_PATCHES.set(tile,c);while(A_RICH_PATCHES.size>30)A_RICH_PATCHES.delete(A_RICH_PATCHES.keys().next().value);return c;}
function drawAWorldLayer(g,layer,zone,view){var l=STABLE_A[layer],hw=view.w/(2*view.z),hh=view.h/(2*view.z),shift=view.x*(1-l.x),pitch=1100,size=1500,left=view.x-hw-size,right=view.x+hw+size;
 g.fillStyle='#24434f';g.beginPath();for(var bx=left;bx<=right+40;bx+=40){var by=Math.max(350,aMountainCrest(layer,bx-shift,view.y)-size*.64)+size*.81;if(bx===left)g.moveTo(bx,by);else g.lineTo(bx,by);}g.lineTo(right+40,CONF.WORLD_H+3000);g.lineTo(left,CONF.WORLD_H+3000);g.closePath();g.fill();
 for(var cell=Math.floor((left-shift)/pitch);cell<=Math.ceil((right-shift)/pitch);cell++){
  var u=cell*pitch,x=u+shift,crest=aMountainCrest(layer,u,view.y),top=Math.max(350,crest-size*.64),patch=aBackdropPatch(layer,cell),tile=oceanBackdropTile(patch.zone,layer,patch.seed,true);
  if(!tile)continue;
  // The original detailed relief supplies rocks, strata and dense rooted botanical clusters.
  // Only its height and small parallax change; the opaque bed continues to the world floor.
  g.drawImage(aRichPatch(tile),x,top,size,size);
 }
}
function drawStableALayers(time){var zone=sceneryZoneAt(cam.x,cam.y);if(cam.y>4200&&(zone==='shallow'||zone==='shelf'))zone='deep';var view={x:cam.x,y:cam.y,z:cam.z,w:W,h:H};ctx.save();ctx.globalAlpha=1;
 if(qLevel>0){if(!A_FAR_CANVAS)A_FAR_CANVAS=newCanvas(canvas.width,canvas.height);if(A_FAR_CANVAS.width!==canvas.width||A_FAR_CANVAS.height!==canvas.height){A_FAR_CANVAS.width=canvas.width;A_FAR_CANVAS.height=canvas.height;}var g=A_FAR_CANVAS.getContext('2d'),matrix=ctx.getTransform();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,A_FAR_CANVAS.width,A_FAR_CANVAS.height);g.setTransform(matrix);drawAWorldLayer(g,0,zone,view);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.filter='blur(1.2px)';ctx.drawImage(A_FAR_CANVAS,0,0);ctx.restore();}else drawAWorldLayer(ctx,0,zone,view);drawAWorldLayer(ctx,1,zone,view);drawAWorldLayer(ctx,2,zone,view);ctx.restore();}
var bakeBeforeStableA=bakeBackgrounds;bakeBackgrounds=function(){bakeBeforeStableA();DECOR_CATALOGUE.forEach(e=>{if(e.kind!=='视差背景'||e.name.includes('船舱'))return;var layer=e.name.includes('远景')?0:e.name.includes('中景')?1:2,c=newCanvas(768,768),g=c.getContext('2d'),view={x:8000,y:5500,z:.45,w:768,h:768};g.setTransform(view.z,0,0,view.z,384-view.x*view.z,384-view.y*view.z);drawAWorldLayer(g,layer,e.zone,view);e.canvas=layer===0?blurBackdropCanvas(c,1.2):c;e.note='恢复三层精细礁岩与密集植被 · 固定空间生态 · 山体延伸海底';});};
