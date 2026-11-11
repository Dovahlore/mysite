/* V6.7: directional bill defence, depth visibility and cached fish illustration. */
function fishSatiety(f,size){return Math.min(14,2+18*f.size/size);}
function swordContactGeometry(f){
 var dx=player.x-f.x,dy=player.y-f.y,c=Math.cos(f.angle),s=Math.sin(f.angle);
 var x=dx*c+dy*s,y=-dx*s+dy*c;
 if(c<0)y=-y;
 var ax=f.size*1.05,ay=-f.size*f.spec.ry*.1,bx=f.size*1.7,by=-f.size*f.spec.ry*.35;
 var t=clamp(((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)*(bx-ax)+(by-ay)*(by-ay)),0,1);
 return {hit:Math.hypot(x-ax-(bx-ax)*t,y-ay-(by-ay)*t)<player.size*.43+f.size*.055,x:x};
}
function handleSwordContact(f){
 if(!player.alive||gameState!=='playing')return false;
 var contact=swordContactGeometry(f);if(!contact.hit)return false;
 if(player.spawnProt<=0&&player.invulnTimer<=0){
  if(player.buffs.shield>0)consumeShield(f);
  else{player.hunger=Math.max(0,player.hunger-24);player.invulnTimer=1.4;player.hurtFlash=.5;addPopup(player.x,player.y-35,'剑鱼尖刺 · 饱食 -24','#ffad98',true);}
 }
 var dx=player.x-f.x,dy=player.y-f.y,d=Math.hypot(dx,dy)||1;
 player.vx+=dx/d*140;player.vy+=dy/d*140;return true;
}
var polishEat=playerEatFish;
playerEatFish=function(f){if(f.spec.shape==='sword'&&swordContactGeometry(f).hit){handleSwordContact(f);return false;}return polishEat(f);};
// Bake once alongside existing species assets; high zoom uses the same vector art.
var plainBody=bakeFishBody;
bakeFishBody=function(g,sp,R){
 var sh=sp.shape,ry=R*sp.ry;
 if(['oval','tall','slim'].indexOf(sh)<0){plainBody(g,sp,R);if(['shark','sword','eel','angler'].indexOf(sh)<0)return;}
 else {
  g.save();
  g.fillStyle=sp.c3;g.strokeStyle=sp.c2;g.lineWidth=R*.018;
  g.beginPath();g.moveTo(-R*.65,-ry*.5);g.bezierCurveTo(-R*.5,-ry*1.8,R*.1,-ry*1.55,R*.5,-ry*.55);g.closePath();g.fill();g.stroke();
  for(var j=0;j<7;j++){var u=j/7;g.beginPath();g.moveTo(R*(-.57+u*.85),-ry*.7);g.lineTo(R*(-.48+u*.7),-ry*(1.25+.2*Math.sin(u*3)));g.stroke();}
  var grad=g.createLinearGradient(0,-ry,0,ry);grad.addColorStop(0,sp.c3);grad.addColorStop(.35,sp.c1);grad.addColorStop(.76,sp.c2);grad.addColorStop(1,sp.c3);
  g.fillStyle=grad;g.strokeStyle=sp.c3;g.lineWidth=R*.025;
  g.beginPath();g.moveTo(R,ry*.04);g.bezierCurveTo(R*.72,-ry*1.15,-R*.25,-ry*1.3,-R*.92,0);g.bezierCurveTo(-R*.3,ry*1.08,R*.65,ry*.95,R,ry*.04);g.closePath();g.fill();g.stroke();g.save();g.clip();
  if(sp.pat==='clown'||sp.pat==='band'){for(var j=0;j<3;j++){g.strokeStyle=sp.pat==='clown'?'#fff8dc':'#263541';g.lineWidth=R*.13;g.beginPath();g.moveTo(R*(-.5+j*.47),-ry);g.quadraticCurveTo(R*(-.65+j*.47),0,R*(-.4+j*.47),ry);g.stroke();}}
  else {g.strokeStyle='rgba(255,255,255,.19)';g.lineWidth=R*.018;for(var row=-2;row<=2;row++)for(var col=0;col<8;col++){g.beginPath();g.arc(R*(-.65+col*.16+(row%2)*.06),ry*row*.26,R*.09,-1.1,1.1);g.stroke();}}
  if(sp.pat==='spots'){g.fillStyle=sp.c3;for(var j=0;j<15;j++){g.beginPath();g.ellipse(R*(-.65+(j%5)*.26),ry*(-.5+Math.floor(j/5)*.4),R*.055,R*.035,.3,0,Math.PI*2);g.fill();}}
  g.fillStyle='rgba(255,255,255,.23)';g.beginPath();g.ellipse(-R*.08,-ry*.45,R*.55,ry*.16,-.1,0,Math.PI*2);g.fill();g.restore();
  g.strokeStyle=sp.c3;g.lineWidth=R*.025;g.beginPath();g.ellipse(R*.45,0,R*.17,ry*.65,0,-1.3,1.3);g.stroke();
  g.fillStyle=sp.c3;g.beginPath();g.moveTo(R*.18,ry*.1);g.quadraticCurveTo(-R*.35,ry*1.2,-R*.32,ry*.5);g.closePath();g.fill();
  g.fillStyle='#162b36';g.beginPath();g.ellipse(R*.68,-ry*.22,R*.105,R*.12,0,0,Math.PI*2);g.fill();g.fillStyle=sp.c2;g.beginPath();g.arc(R*.7,-ry*.27,R*.037,0,Math.PI*2);g.fill();
  g.strokeStyle=sp.c3;g.beginPath();g.moveTo(R*.8,ry*.22);g.quadraticCurveTo(R*.94,ry*.27,R,ry*.04);g.stroke();g.restore();return;
 }
 // Subtle sculpted skin, pectoral fins and visible gill slits on large predators.
 g.save();g.strokeStyle='rgba(224,248,255,.35)';g.lineWidth=R*.025;g.beginPath();g.ellipse(-R*.03,-ry*.28,R*.75,ry*.45,0,Math.PI,Math.PI*1.85);g.stroke();
 g.fillStyle=sp.c3;g.beginPath();g.moveTo(R*.1,ry*.35);g.quadraticCurveTo(-R*.45,ry*1.75,-R*.25,ry*.65);g.closePath();g.fill();
 g.strokeStyle='rgba(13,30,41,.5)';g.lineWidth=R*.026;for(var j=0;j<4;j++){g.beginPath();g.moveTo(R*(.25+j*.075),-ry*.25);g.quadraticCurveTo(R*(.32+j*.075),0,R*(.24+j*.075),ry*.4);g.stroke();}g.restore();
};
function anglerLamp(f){var c=Math.cos(f.angle),s=Math.sin(f.angle),lx=f.size*.95,ly=-f.size*f.spec.ry*1.3;if(c<0)ly=-ly;return {x:f.x+lx*c-ly*s,y:f.y+lx*s+ly*c};}
var polishFishDraw=drawFishSprite;
drawFishSprite=function(f,x,y,size,angle,tail,inflate,isPlayer,time){
 if(!isPlayer&&f.spec.shape==='angler'){
  var l=anglerLamp(f),r=240+size*2,g=ctx.createRadialGradient(l.x,l.y,0,l.x,l.y,r);g.addColorStop(0,'rgba(170,255,213,.25)');g.addColorStop(.35,'rgba(80,204,174,.08)');g.addColorStop(1,'rgba(50,180,140,0)');ctx.save();ctx.fillStyle=g;ctx.fillRect(l.x-r,l.y-r,r*2,r*2);ctx.restore();
 }
 polishFishDraw(f,x,y,size,angle,tail,inflate,isPlayer,time);
};
var depthMask=document.createElement('canvas'),depthCtx=depthMask.getContext('2d');
function drawDepthVisibility(time){
 if(gameState!=='playing'&&gameState!=='paused')return;
 var depth=clamp((player.y-4700)/7500,0,1);if(depth<=0)return;
 var w=Math.ceil(W*.5),h=Math.ceil(H*.5);if(depthMask.width!==w||depthMask.height!==h){depthMask.width=w;depthMask.height=h;}
 var g=depthCtx;g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);g.fillStyle='rgba(1,7,18,'+(.84*depth)+')';g.fillRect(0,0,w,h);g.globalCompositeOperation='destination-out';
 function light(x,y,r,strength){var sx=((x-cam.x)*cam.z+W/2)*.5,sy=((y-cam.y)*cam.z+H/2)*.5,sr=r*cam.z*.5;if(sx+sr<0||sx-sr>w||sy+sr<0||sy-sr>h)return;var q=g.createRadialGradient(sx,sy,sr*.18,sx,sy,sr);q.addColorStop(0,'rgba(0,0,0,'+strength+')');q.addColorStop(.55,'rgba(0,0,0,'+(strength*.65)+')');q.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=q;g.fillRect(sx-sr,sy-sr,sr*2,sr*2);}
 light(player.x,player.y,Math.max(290,player.size*2.8),.93);
 for(var i=0;i<fishes.length;i++){var f=fishes[i];if(f.dead||f.spec.shape!=='angler')continue;var l=anglerLamp(f);light(l.x,l.y,240+f.size*2,.98);}
 g.globalCompositeOperation='source-over';ctx.save();ctx.setTransform(DPR,0,0,DPR,0,0);ctx.drawImage(depthMask,0,0,W,H);ctx.restore();
}
