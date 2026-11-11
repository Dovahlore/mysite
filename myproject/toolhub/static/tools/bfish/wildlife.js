/* Wildlife update: stable player targeting, species/depth speeds, timed puffer defence. */
'use strict';
var WILDLIFE_SPEEDS={
 '蓝灯鱼':74,'金灯鱼':66,'红莓鱼':80,'小丑鱼':58,'蝴蝶鱼':52,'河豚':36,
 '紫罗兰鱼':83,'梭鱼':165,'海鳗':116,'石斑鱼':78,'鮟鱇鱼':58,'剑鱼':205,
 '鲨鱼':150,'蝠鲼':84,'皇带鱼':108,'哥布林鲨':132,'飞鱼':128,'冰牙鲨':157,'深海巨鲨':180
};
SPECIES.forEach(function(sp){if(WILDLIFE_SPEEDS[sp.n])sp.spd=WILDLIFE_SPEEDS[sp.n];if(sp.shape==='puff'){sp.n='刺豚';sp.passive=true;}});
function fishDepthSpeed(f){return [1,1.08,1.1,1.28,1.42,1.55][oceanRegion(f.x,f.y)]||1;}
function fishSenseFactor(f){return [ .9,1.05,1,1.1,1.15,1.25 ][oceanRegion(f.x,f.y)]*(f.spec.aggr?1.05:.95);}
function fishChaseMultiplier(f){
 var sp=f.spec;
 if(sp.shape==='sword')return 1.9;
 if(sp.shape==='shark')return 2.05;
 if(sp.n==='梭鱼')return 1.95;
 if(sp.shape==='eel')return 1.9;
 if(sp.shape==='angler')return 1.75;
 if(sp.shape==='ray')return 1.6;
 return tierOf(sp)>=2?1.65:1.4;
}
function fishCanSeePlayer(f){
 var dx=player.x-f.x,dy=player.y-f.y,length=Math.hypot(dx,dy);if(length<1)return true;
 var ux=dx/length,uy=dy/length,along=0;
 // Distance-guided steps cannot jump over thin rock walls like a fixed sampling grid.
 for(var step=0;step<512&&along<length;step++){
  var x=f.x+ux*along,y=f.y+uy*along,nearest=140;
  for(var i=0;i<RK_list.length;i++){
   var r=RK_list[i],bx=Math.max(r.wx0-x,0,x-r.wx1),by=Math.max(r.wy0-y,0,y-r.wy1);
   if(Math.hypot(bx,by)>nearest)continue;
   nearest=Math.min(nearest,rkField(r,x-r.ax,y-r.ay));
  }
  if(nearest<=2)return false;
  along+=clamp(nearest*.65,2,90);
 }return along>=length;
}
function playerPursuit(f,eligible,range,dt){
 f.playerChaseCooldown=Math.max(0,(f.playerChaseCooldown||0)-dt);
 f.playerTrackTime=Math.max(0,(f.playerTrackTime||0)-dt);
 if(!eligible||f.spec.passive||f.spec.flying||f.spec.rareDugong||f.playerChaseCooldown>0){f.playerTrackTime=0;return false;}
 var d2=dist2(f.x,f.y,player.x,player.y);
 if(d2<range*range&&fishCanSeePlayer(f)){
  f.playerTrackTime=1.6;f.playerTrackX=player.x;f.playerTrackY=player.y;return true;
 }
 return f.playerTrackTime>0&&d2<Math.pow(range+260,2);
}
var initBeforeWildlife=initHabitatFish;
initHabitatFish=function(f,sp,x,y,size){
 initBeforeWildlife(f,sp,x,y,size);
 f.playerTrackTime=0;f.playerTrackX=x;f.playerTrackY=y;f.playerChaseCooldown=0;f.chasingPlayer=false;f.targetKind=null;f.lungeCooldown=0;
 f.puffStage='normal';f.puffTimer=0;f.puffCooldown=0;f.puffBlocked=false;f.inflated=0;
 return f;
};
function updatePufferDefense(f,dt){
 if(!f.puffStage){f.puffStage='normal';f.puffCooldown=0;f.puffTimer=0;}
 f.puffCooldown=Math.max(0,(f.puffCooldown||0)-dt);
 var danger=player.alive&&gameState==='playing'&&dist2(f.x,f.y,player.x,player.y)<Math.pow(175+player.size*.35,2);
 if(!danger){var nearby=queryNearby(f.x,f.y,160);for(var i=0;i<nearby;i++){var other=nearbyScratch[i];if(other!==f&&!other.dead&&other.size>f.size*1.25){danger=true;break;}}}
 if(f.puffStage==='normal'&&f.puffCooldown<=0&&danger){f.puffStage='warning';f.puffTimer=.65;}
 else if(f.puffStage==='warning'){
  f.puffTimer-=dt;if(f.puffTimer<=0){f.puffStage='inflated';f.puffTimer=2.8;emitRipple(f.x,f.y,f.size*3);}
 }else if(f.puffStage==='inflated'){
  f.puffTimer-=dt;if(f.puffTimer<=0){f.puffStage='deflating';f.puffTimer=.45;}
 }else if(f.puffStage==='deflating'){
  f.puffTimer-=dt;if(f.puffTimer<=0){f.puffStage='normal';f.puffCooldown=5;f.inflated=0;}
 }
 var target=f.puffStage==='inflated'?1:f.puffStage==='warning'?.18:0;
 f.inflated=lerp(f.inflated||0,target,Math.min(1,dt*9));
 f.puffBlocked=f.puffStage==='inflated'||f.puffStage==='deflating'&&(f.inflated||0)>.3;
}
function handlePufferContact(f){
 if(!player.alive||gameState!=='playing')return;
 var reach=player.size*.43+f.size*(f.puffBlocked?1.55:.55),dx=player.x-f.x,dy=player.y-f.y,distance=Math.hypot(dx,dy);
 if(distance>=reach)return;
 // Predation uses the real body size, not the temporary inflated silhouette.
 if(f.size>player.size*CONF.KILL_RATIO){
  if(player.spawnProt>0||player.invulnTimer>0)return;
  if(player.buffs.shield>0){consumeShield(f);return;}
  playerDie('被刺豚吞掉了');return;
 }
 if(!f.puffBlocked){if(f.size<player.size*CONF.EAT_RATIO){playerEatFish(f);f.dead=true;}return;}
 var nx=distance>0?dx/distance:1,ny=distance>0?dy/distance:0;
 // Inflated spines are solid even for a much larger player.
 player.x+=nx*(reach-distance+2);player.y+=ny*(reach-distance+2);player.vx+=nx*230;player.vy+=ny*230;
 rkCollide(player,true);
 if(player.spawnProt>0||player.invulnTimer>0)return;
 if(player.buffs.shield>0){consumeShield(f);return;}
 player.hunger=Math.max(0,player.hunger-10);player.invulnTimer=1.1;player.hurtFlash=.5;
 addPopup(player.x,player.y-35,'刺豚扎伤 · 饱食 -10','#ffac93',true);sfx(155,.12,'sawtooth',.05);
}
var eatBeforeWildlife=playerEatFish;
playerEatFish=function(f){
 if(f.puffBlocked)return false;
 eatBeforeWildlife(f);return true;
};
// The defence is explicit in both silhouette and text; the normal state is edible.
var drawBeforeWildlife=drawFishSprite;
drawFishSprite=function(f,x,y,size,angle,tail,inflate,isPlayer,time){
 if(isPlayer||f.spec.shape!=='puff'){drawBeforeWildlife(f,x,y,size,angle,tail,inflate,isPlayer,time);return;}
 var amount=clamp(f.inflated||0,0,1),ease=amount*amount*(3-2*amount),warn=f.puffStage==='warning';
 var rx=size*lerp(1.12,1.22,ease),ry=size*lerp(.39,1.22,ease),spikeLength=size*.38*ease;
 if(warn)ry*=1+Math.sin(time*14)*.04;
 var r=Math.max(rx,ry)+spikeLength;
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);if(Math.cos(angle)<0)ctx.scale(1,-1);
 // A streamlined, folded silhouette becomes a round, warm-coloured defensive ball.
 ctx.fillStyle=amount>.45?'#b88745':'#618d79';
 var tailLength=size*lerp(.78,.32,ease),tailHeight=size*lerp(.34,.16,ease);
 ctx.beginPath();ctx.moveTo(-rx*.8,0);ctx.lineTo(-rx-tailLength,-tailHeight);ctx.lineTo(-rx-tailLength*.7,0);ctx.lineTo(-rx-tailLength,tailHeight);ctx.closePath();ctx.fill();
 if(amount>.08){
  ctx.fillStyle=amount>.45?'#ffe8a0':'#aac48e';ctx.strokeStyle=amount>.45?'#cc8248':'#708e68';ctx.lineWidth=Math.max(.8,size*.025);
  for(var i=0;i<20;i++){
   var a=i*Math.PI/10,px=Math.cos(a)*rx*.97,py=Math.sin(a)*ry*.97,tx=px+Math.cos(a)*spikeLength,ty=py+Math.sin(a)*spikeLength,width=size*.065*ease;
   ctx.beginPath();ctx.moveTo(px-Math.sin(a)*width,py+Math.cos(a)*width);ctx.lineTo(tx,ty);ctx.lineTo(px+Math.sin(a)*width,py-Math.cos(a)*width);ctx.closePath();ctx.fill();ctx.stroke();
  }
 }
 var gradient=ctx.createRadialGradient(-rx*.3,-ry*.4,size*.04,0,0,Math.max(rx,ry)*1.15);
 gradient.addColorStop(0,amount>.45?'#fff3b4':'#c0d4b3');gradient.addColorStop(.55,amount>.45?'#e9c15d':'#91b59b');gradient.addColorStop(1,amount>.45?'#c78a36':'#577e70');
 ctx.fillStyle=gradient;ctx.strokeStyle=amount>.45?'#b57736':'#577e70';ctx.lineWidth=Math.max(1,size*.035);
 ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.fillStyle=amount>.45?'rgba(136,105,47,.4)':'rgba(47,93,73,.42)';
 for(var i=0;i<9;i++){var a=i*2.399,rr=.28+(i%3)*.18;ctx.beginPath();ctx.arc(Math.cos(a)*rx*rr,Math.sin(a)*ry*rr,Math.max(1,size*lerp(.035,.06,ease)),0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='rgba(238,233,188,.5)';ctx.beginPath();ctx.ellipse(rx*.1,ry*.56,rx*.65,ry*.23,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#203c36';var eyeX=rx*.65,eyeY=-ry*.18,eyeR=Math.max(1.4,size*lerp(.085,.12,ease));ctx.beginPath();ctx.arc(eyeX,eyeY,eyeR,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#fffde2';ctx.beginPath();ctx.arc(eyeX+eyeR*.24,eyeY-eyeR*.3,eyeR*.32,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#3c5c46';ctx.lineWidth=Math.max(.8,size*.025);ctx.beginPath();ctx.arc(rx*.87,ry*.17,size*.07,-1,1);ctx.stroke();ctx.restore();
 if(dist2(x,y,player.x,player.y)<650*650){
  ctx.save();ctx.strokeStyle=f.puffBlocked?'rgba(255,140,100,.8)':warn?'rgba(255,215,100,.8)':size<player.size*CONF.EAT_RATIO?'rgba(126,236,176,.6)':'rgba(180,210,160,.3)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y,rx+spikeLength+size*.16,ry+spikeLength+size*.16,angle,0,Math.PI*2);ctx.stroke();ctx.font='12px system-ui';ctx.fillStyle=size>player.size*CONF.KILL_RATIO?'#ffad98':f.puffBlocked?'#ffc09a':warn?'#ffe2a0':'#cce8b1';ctx.textAlign='center';
  var label=f.puffBlocked?'膨胀 · 不可吞食 '+Math.max(0,f.puffTimer).toFixed(1)+'s':warn?'刺豚即将膨胀！':f.puffCooldown>0?'刺豚恢复 · 可吞食窗口 '+f.puffCooldown.toFixed(1)+'s':'刺豚 · 靠近会膨胀';
  if(size>player.size*CONF.KILL_RATIO)label='危险刺豚 · 能吞食你'+(f.puffBlocked?' · 已膨胀':'');
  ctx.fillText(label,x,y-r-size*.2-12);ctx.restore();
 }
};
