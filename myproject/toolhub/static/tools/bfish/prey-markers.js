/* One outer rendering hook covers every fish renderer, including specialised species. */
function canHighlightPrey(f){
 if(!f||f.dead||!player.alive||f.spec.leviathan||f.puffBlocked||f.size>=player.size*CONF.EAT_RATIO)return false;
 if(f.spec.shape==='sword'&&swordContactGeometry(f).hit)return false;
 return true;
}
function drawPreyMarker(x,y,rx,ry,angle,offset){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);ctx.strokeStyle='rgba(137,245,193,.7)';ctx.lineWidth=1.35/Math.max(.52,cam.z);ctx.beginPath();ctx.ellipse(offset||0,0,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
var markerFishDraw=drawFishSprite;drawFishSprite=function(f,x,y,s,a,t,inflate,isPlayer,time){
 if(!isPlayer&&ctx.canvas===canvas&&(gameState==='playing'||gameState==='paused')&&canHighlightPrey(f)){
  var rx=s*1.65+6,ry=s*.95+5,offset=0,sp=f.spec;
  if(sp.shape==='eel'){rx=s*1.85+6;ry=s*(sp.n==='皇带鱼'?.95:.6)+5;offset=-s*.5;}
  else if(sp.shape==='ray'){rx=s*2+6;ry=s*1.9+5;offset=-s*.5;}
  else if(sp.shape==='sword'){rx=s*1.95+6;ry=s*1.05+5;}
  else if(sp.cuttle){rx=s*1.85+6;ry=s*.85+5;}
  else if(sp.flying){rx=s*1.7+6;ry=s*(f.airTime>0?1.75:1.05)+5;}
  drawPreyMarker(x,y,rx,ry,a,offset);
 }
 markerFishDraw(f,x,y,s,a,t,inflate,isPlayer,time);
};
var markerFoodDraw=drawFood;drawFood=function(f,time){
 if(ctx.canvas===canvas&&player.alive&&!f.dead&&f.type==='bluecrab'&&player.size>=ICE_CRAB_MIN&&(gameState==='playing'||gameState==='paused'))drawPreyMarker(f.x,f.y,34,29,0,0);
 markerFoodDraw(f,time);
};
// Map owns only the pause it created, so closing it cannot undo a manual pause.
var mapOwnsPause=false;
toggleMap=function(){
 if(gameState!=='playing'&&gameState!=='paused')return;
 if(!expedition.map){mapOwnsPause=gameState==='playing';if(mapOwnsPause)gameState='paused';expedition.map=true;}
 else{expedition.map=false;if(mapOwnsPause&&gameState==='paused')gameState='playing';mapOwnsPause=false;}
 clearMobileInput();fullSync();
};
el('t-mapbtn').onclick=toggleMap;el('t-closemap').onclick=toggleMap;
var mapFullSync=fullSync;fullSync=function(){mapFullSync();if(expedition.map&&gameState==='paused')el('t-menu').style.display='none';};
var mapReset=resetGame;resetGame=function(){mapOwnsPause=false;mapReset();};
document.addEventListener('keydown',function(e){
 if(guide.style.display==='block')return;
 if(e.code==='Tab'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)toggleMap();}
 else if(expedition.map&&(e.code==='Escape'||e.code==='Space')){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'&&!e.repeat)toggleMap();}
},true);
