/* Distant relief is visual only: three cached parallax planes, no collision. */
var BACKDROP_CACHE=new Map(),BACKDROP_STATE=null,SHIP_BACKDROP=null;
var BACKDROP_LAYERS=[{p:.18,alpha:.32},{p:.43,alpha:.4},{p:.7,alpha:.48}];
function paintOceanBackdrop(g,zone,layer,seed){
 var noise=i=>decorNoise(i+seed*17,93+layer),deep=zone==='deep'||zone==='volcano',cold=zone==='ice';
 var palette=deep?['#081e30','#102c3c','#193a48']:cold?['#335e73','#497c89','#639b9c']:['#17414c','#25575c','#356965'];
 g.fillStyle=palette[layer];g.strokeStyle=deep?'#42606a66':'#80a29344';g.lineWidth=2;
 for(var i=0;i<4;i++){var x=70+i*155,y=330+noise(i)*130,w=80+noise(i+7)*95,h=70+noise(i+13)*(deep?250:150);g.beginPath();g.moveTo(x-w,y+60);g.bezierCurveTo(x-w*.8,y-h*.3,x-w*.55,y-h,x-10,y-h);g.bezierCurveTo(x+w*.5,y-h*1.2,x+w*.65,y-h*.4,x+w,y+50);g.quadraticCurveTo(x,y+95,x-w,y+60);g.fill();g.stroke();}
 if(deep){
  // A rear cavern wall with a dim recessed chamber, rather than empty blue water.
  var shade=g.createRadialGradient(320,260,55,320,280,310);shade.addColorStop(0,'#030d19');shade.addColorStop(.65,'#0b2230');shade.addColorStop(1,'#183747');g.fillStyle=shade;g.beginPath();g.moveTo(65,440);g.bezierCurveTo(30,330,54,130,160,88);g.bezierCurveTo(260,24,440,58,540,152);g.bezierCurveTo(607,245,594,370,565,460);g.bezierCurveTo(480,414,445,420,410,470);g.bezierCurveTo(320,438,218,456,65,440);g.fill();g.strokeStyle='#44616a55';for(var j=0;j<5;j++){g.beginPath();g.ellipse(320,285,190+j*12,165+j*14,.13,Math.PI,Math.PI*2);g.stroke();}
  g.fillStyle=palette[layer];for(var i=0;i<10;i++){var x=120+i*45,len=35+noise(i+40)*110;g.beginPath();g.moveTo(x-12,120);g.quadraticCurveTo(x,165,x+4,120+len);g.quadraticCurveTo(x+7,150,x+22,120);g.closePath();g.fill();}
  g.strokeStyle=zone==='volcano'?'#aa65413a':'#66899b33';for(var i=0;i<8;i++){var x=80+i*67;g.beginPath();g.moveTo(x,160);g.lineTo(x+28,220);g.lineTo(x+8,275);g.lineTo(x+45,325);g.stroke();}
 }else{
  // Rooted vegetation belongs to the rear rock plane, not floating in open water.
  for(var i=0;i<18;i++){var x=55+i*30,y=415+Math.sin(i*.8)*24,height=zone==='kelp'?100+noise(i+70)*220:35+noise(i+70)*95;if(cold)height*=.12;g.strokeStyle=cold?'#92c5c244':'#6b9d7c66';g.lineWidth=2+layer;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x-14,y-height*.4,x+16,y-height*.7,x+8,y-height);g.stroke();if(!cold)for(var j=0;j<6;j++){var yy=y-j*height/7,side=j%2?1:-1;g.fillStyle='#68907844';g.beginPath();g.ellipse(x+side*10,yy,15,4,side*.5,0,Math.PI*2);g.fill();}}
 }
}
function oceanBackdropTile(zone,layer,seed){var key=zone+':'+layer+':'+seed;if(BACKDROP_CACHE.has(key))return BACKDROP_CACHE.get(key);var c=document.createElement('canvas');c.width=c.height=384;var g=c.getContext('2d');g.scale(.6,.6);paintOceanBackdrop(g,zone,layer,seed);BACKDROP_CACHE.set(key,c);while(BACKDROP_CACHE.size>36)BACKDROP_CACHE.delete(BACKDROP_CACHE.keys().next().value);return c;}
function paintShipBack(g){
 g.save();g.beginPath();g.moveTo(25,43);g.bezierCurveTo(150,27,505,23,620,48);g.lineTo(604,145);g.quadraticCurveTo(320,190,37,148);g.closePath();g.clip();var wood=g.createLinearGradient(0,30,0,180);wood.addColorStop(0,'#635341');wood.addColorStop(.45,'#343b39');wood.addColorStop(1,'#192c32');g.fillStyle=wood;g.fillRect(0,0,640,192);
 for(var y=40,i=0;y<190;y+=13,i++){g.fillStyle=i%2?'#ac906519':'#050f1840';g.fillRect(0,y,640,11);g.strokeStyle='#a8996e22';g.lineWidth=.7;g.beginPath();g.moveTo(0,y);g.bezierCurveTo(180,y+5,440,y-4,640,y+2);g.stroke();}
 for(var x=60;x<620;x+=73){g.strokeStyle='#101d24';g.lineWidth=13;g.beginPath();g.moveTo(x,30);g.quadraticCurveTo(x-12,100,x+9,178);g.stroke();g.strokeStyle='#8a76594d';g.lineWidth=4;g.stroke();}
 for(var x=108;x<600;x+=137){g.fillStyle='#071a27';g.strokeStyle='#9d8c63';g.lineWidth=4;g.beginPath();g.ellipse(x,81,17,20,0,0,Math.PI*2);g.fill();g.stroke();g.strokeStyle='#54768388';g.lineWidth=1;g.beginPath();g.arc(x-2,80,11,3.5,5.4);g.stroke();}
 g.fillStyle='#8c806329';g.fillRect(285,108,50,32);g.strokeStyle='#baa77d4d';g.lineWidth=2;g.strokeRect(285,108,50,32);g.restore();
}
var bakeBeforeBackdrops=bakeBackgrounds;bakeBackgrounds=function(){bakeBeforeBackdrops();BACKDROP_CACHE.clear();BACKDROP_STATE=null;SHIP_BACKDROP=document.createElement('canvas');SHIP_BACKDROP.width=1280;SHIP_BACKDROP.height=384;var sg=SHIP_BACKDROP.getContext('2d');sg.scale(2,2);paintShipBack(sg);
 SCENERY_BIOMES.forEach(b=>BACKDROP_LAYERS.forEach((l,i)=>{var c=document.createElement('canvas');c.width=c.height=320;var g=c.getContext('2d');g.scale(.5,.5);paintOceanBackdrop(g,b.id,i,2);DECOR_CATALOGUE.push({name:b.name+' · '+['远景','中景','近背景'][i],kind:'视差背景',zone:b.id,region:b.name,canvas:c,width:2300,height:2300,note:'独立后景平面 · 镜头位移系数 '+l.p+' · 仅作背景，无碰撞'});}));DECOR_CATALOGUE.push({name:'沉船船舱后壁',kind:'视差背景',zone:'shallow',region:'浅海沉船区',canvas:SHIP_BACKDROP,width:1460,height:420,note:'船板、后侧肋骨与舷窗 · 船舱内透视背景，不阻挡通行'});
};
var reliefBeforeBackdrops=drawOceanRelief;drawOceanRelief=function(time){reliefBeforeBackdrops(time);var zone=sceneryZoneAt(cam.x,cam.y);if(cam.y>4200&&(zone==='shelf'||zone==='shallow'))zone='deep';if(!BACKDROP_STATE)BACKDROP_STATE={zone:zone,previous:zone,changed:time};if(zone!==BACKDROP_STATE.zone){BACKDROP_STATE.previous=BACKDROP_STATE.zone;BACKDROP_STATE.zone=zone;BACKDROP_STATE.changed=time;}var blend=clamp((time-BACKDROP_STATE.changed)/1.2,0,1);
 function plane(which,weight){if(weight<=.001)return;for(var layer=0;layer<3;layer++){if(qLevel===0&&layer===0)continue;var l=BACKDROP_LAYERS[layer],pitch=2048,px=cam.x*l.p,py=cam.y*l.p;var left=Math.floor((px-W/(2*cam.z)-1200)/pitch),right=Math.floor((px+W/(2*cam.z)+1200)/pitch),top=Math.floor((py-H/(2*cam.z)-1200)/pitch),bottom=Math.floor((py+H/(2*cam.z)+1200)/pitch);ctx.globalAlpha=l.alpha*weight;for(var x=left;x<=right;x++)for(var y=top;y<=bottom;y++){var seed=Math.abs(x*31+y*17)%5,tile=oceanBackdropTile(which,layer,seed);ctx.drawImage(tile,cam.x+x*pitch-px-1150,cam.y+y*pitch-py-1150,2300,2300);}}}
 ctx.save();plane(BACKDROP_STATE.previous,1-blend);plane(BACKDROP_STATE.zone,blend);ctx.restore();
 var ship=SHALLOW_WRECK;if(SHIP_BACKDROP&&Math.abs(ship.x-cam.x)<W/(2*cam.z)+900&&Math.abs(ship.y-cam.y)<H/(2*cam.z)+400){ctx.save();var shift=clamp((cam.x-ship.x)*.025,-18,18);ctx.drawImage(SHIP_BACKDROP,ship.x-770+shift,ship.y-230,1540,460);ctx.restore();}
};
