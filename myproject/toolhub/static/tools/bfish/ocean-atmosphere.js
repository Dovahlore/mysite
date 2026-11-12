/* World-anchored transitions and rear geology; nothing depends on the player's layer ID. */
function oceanEase(a,b,v){var t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);}
var PASSAGE_REARS=[],PASSAGE_GEOLOGY=new Path2D();
var bakeBeforePassageAtmosphere=bakeBackgrounds;
bakeBackgrounds=function(){bakeBeforePassageAtmosphere();PASSAGE_REARS=[];PASSAGE_GEOLOGY=new Path2D();
 RK_list.forEach(function(r){if(r.ship)return;for(var i=0;i<r.blobs.length;i+=3){var x=r.ax+r.blobs[i],y=r.ay+r.blobs[i+1],radius=r.blobs[i+2];PASSAGE_GEOLOGY.moveTo(x+radius,y);PASSAGE_GEOLOGY.arc(x,y,radius,0,Math.PI*2);}for(var i=0;i<(r.boxes||[]).length;i+=5){var b=r.boxes;PASSAGE_GEOLOGY.roundRect(r.ax+b[i]-b[i+2],r.ay+b[i+1]-b[i+3],b[i+2]*2,b[i+3]*2,Math.min(b[i+4],b[i+2],b[i+3]));}});

 // A passage through a shelf has a continuous rear wall, even where neighbouring
 // rock envelopes fail to overlap. Open-water stretches of a route stay open.
 WORLD_ROUTES.forEach(function(route){var p=new Path2D(),has=false;
  for(var i=1;i<route.points.length;i++){var a=route.points[i-1],b=route.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(len/65);
   for(var j=0;j<steps;j++){var t=(j+.5)/steps,x=lerp(a[0],b[0],t),y=lerp(a[1],b[1],t),band=y>2750&&y<4350||y>6350&&y<7950||y>9800&&y<11000;
    if(!band)continue;var near=RK_list.some(r=>!r.ship&&x>r.wx0-80&&x<r.wx1+80&&y>r.wy0-80&&y<r.wy1+80);if(!near)continue;
    var radius=route.r+45;p.moveTo(x+radius,y);p.arc(x,y,radius,0,Math.PI*2);has=true;
   }
  }if(has)PASSAGE_REARS.push({path:p,ice:route.name.includes('冰'),name:route.name});
 });
};
var wallsBeforePassageAtmosphere=drawCavernRearWalls;
drawCavernRearWalls=function(){ctx.save();ctx.clip(PASSAGE_GEOLOGY);for(var r of PASSAGE_REARS){ctx.fillStyle=r.ice?'#3f7799':'#1d2b36';ctx.fill(r.path);ctx.save();ctx.clip(r.path);var left=cam.x-W/(2*cam.z),right=cam.x+W/(2*cam.z),top=cam.y-H/(2*cam.z),bottom=cam.y+H/(2*cam.z);ctx.strokeStyle=r.ice?'#8dbdcb55':'#6d84952b';ctx.lineWidth=3;for(var y=Math.floor(top/130)*130;y<bottom;y+=130){ctx.beginPath();for(var x=left;x<right+40;x+=40){var yy=y+Math.sin(x*.008+y)*18;if(x===left)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();}ctx.restore();}ctx.restore();wallsBeforePassageAtmosphere();};
function drawLivingSky(time,left,right,top){
 ctx.save();ctx.clip();var sky=ctx.createLinearGradient(0,Math.min(top,-1700),0,0);sky.addColorStop(0,'#477fae');sky.addColorStop(.55,'#86c4df');sky.addColorStop(.86,'#c9e6e9');sky.addColorStop(1,'#e4eee4');ctx.fillStyle=sky;ctx.fillRect(left,top,right-left,-top+30);
 var sx=cam.x+(3200-cam.x)*.12,sy=-650;var glow=ctx.createRadialGradient(sx,sy,20,sx,sy,400);glow.addColorStop(0,'#fff6d5a0');glow.addColorStop(1,'#fff3d000');ctx.fillStyle=glow;ctx.fillRect(sx-400,sy-400,800,800);ctx.fillStyle='#fff6df';ctx.beginPath();ctx.arc(sx,sy,42,0,Math.PI*2);ctx.fill();
 for(var i=Math.floor((left-cam.x*.92)/800)-1;i<(right-cam.x*.92)/800+1;i++){var cx=i*800+cam.x*.92+Math.sin(i*2.1)*180+time*2,cy=-220-((i*173%460)+460)%460;ctx.fillStyle='#f5f4e3b5';ctx.beginPath();ctx.ellipse(cx,cy,155,24,0,0,Math.PI*2);ctx.ellipse(cx-67,cy-13,66,35,0,0,Math.PI*2);ctx.ellipse(cx+28,cy-22,77,43,0,0,Math.PI*2);ctx.fill();}
 for(var i=0;i<3;i++){var ix=cam.x+(2500+i*9000-cam.x)*.07;if(ix<left-550||ix>right+550)continue;ctx.fillStyle=['#6d9ca9','#568696','#3c7084'][i];ctx.beginPath();ctx.moveTo(ix-400,4);ctx.bezierCurveTo(ix-330,-4,ix-280,-80,ix-190,-65);ctx.bezierCurveTo(ix-110,-52,ix-50,-165,ix+55,-125);ctx.bezierCurveTo(ix+170,-90,ix+220,-10,ix+420,4);ctx.closePath();ctx.fill();}
 ctx.strokeStyle='#4e7587';ctx.lineWidth=2;for(var i=0;i<9;i++){var x=left+((i*379+time*14)%(right-left)),y=-110-((i*83)%420),wing=7+Math.sin(time*2+i)*3;ctx.beginPath();ctx.moveTo(x-12,y-wing);ctx.quadraticCurveTo(x-5,y-wing-3,x,y);ctx.quadraticCurveTo(x+5,y-wing-3,x+12,y-wing);ctx.stroke();}ctx.restore();
}

oceanZoomCap=function(){var ice=oceanEase(18400,20200,player.x)*(1-oceanEase(6200,7200,player.y)),upper=lerp(1.2,.95,oceanEase(2700,3900,player.y));return lerp(lerp(upper,.95,ice),.72,oceanEase(6200,7800,player.y));};
