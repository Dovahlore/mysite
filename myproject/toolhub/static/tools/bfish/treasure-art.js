/* Treasure V6.10: cached detailed collectible illustrations, shared with the guide. */
FOOD_INFO.star.hunger=2;FOOD_INFO.star.grow=.12;FOOD_INFO.star.score=45;
GUIDE_FOOD_NAMES.star='美人鱼星星';GUIDE_FOOD_HABITAT.star='美人鱼沿途掉落 · 高积分、低饱食补给';
var TREASURE_ART={};
function treasureSprite(type){
 if(TREASURE_ART[type])return TREASURE_ART[type];
 var c=document.createElement('canvas');c.width=c.height=200;var g=c.getContext('2d');g.translate(100,100);
 if(type==='starfish'){
  var grad=g.createRadialGradient(-15,-20,3,0,0,65);grad.addColorStop(0,'#ffd6a3');grad.addColorStop(.4,'#e99a6c');grad.addColorStop(1,'#974b50');g.fillStyle=grad;g.strokeStyle='#ffd0a3';g.lineWidth=1.4;
  g.beginPath();g.moveTo(Math.cos(-Math.PI/2-Math.PI/5)*20,Math.sin(-Math.PI/2-Math.PI/5)*20);for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,b=a+Math.PI/5,rad=56+(i%2)*3;g.quadraticCurveTo(Math.cos(a-.19)*rad,Math.sin(a-.19)*rad,Math.cos(a)*rad,Math.sin(a)*rad);g.quadraticCurveTo(Math.cos(a+.22)*rad,Math.sin(a+.22)*rad,Math.cos(b)*20,Math.sin(b)*20);}g.closePath();g.fill();g.stroke();
  for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5;g.strokeStyle='#93464e88';g.lineWidth=2;g.beginPath();g.moveTo(Math.cos(a)*8,Math.sin(a)*8);g.lineTo(Math.cos(a)*47,Math.sin(a)*47);g.stroke();for(var j=0;j<8;j++){var r=12+j*5;for(var side=-1;side<=1;side+=2){var x=Math.cos(a)*r-Math.sin(a)*side*4,y=Math.sin(a)*r+Math.cos(a)*side*4;g.fillStyle=j%2?'#f8c58f':'#ffdcb1';g.beginPath();g.arc(x,y,1.2,0,Math.PI*2);g.fill();}}}
  g.fillStyle='#fbd6aa';g.beginPath();g.arc(0,0,6,0,Math.PI*2);g.fill();g.strokeStyle='#e3ad83';g.lineWidth=.8;for(var i=0;i<12;i++){var a=i*Math.PI/6;g.beginPath();g.moveTo(Math.cos(a)*9,Math.sin(a)*9);g.lineTo(Math.cos(a)*15,Math.sin(a)*15);g.stroke();}
 }else if(type==='pearl'){
  // Open nacre oyster anchors the pearl to the seabed instead of a plain white dot.
  g.fillStyle='#6f727e';g.strokeStyle='#c1abb9';g.lineWidth=1.5;g.beginPath();g.moveTo(-57,18);g.bezierCurveTo(-67,-12,-35,-34,2,-25);g.bezierCurveTo(35,-37,66,-10,56,18);g.quadraticCurveTo(0,48,-57,18);g.closePath();g.fill();g.stroke();
  var shell=g.createLinearGradient(0,-22,0,40);shell.addColorStop(0,'#b7a7b5');shell.addColorStop(.4,'#e9d2cd');shell.addColorStop(1,'#9d8ba5');g.fillStyle=shell;g.beginPath();g.ellipse(0,22,58,20,0,0,Math.PI*2);g.fill();g.stroke();g.strokeStyle='#f6e5db88';g.lineWidth=1;for(var i=0;i<13;i++){var x=-52+i*8.7;g.beginPath();g.moveTo(x,23);g.quadraticCurveTo(x*.65,33,x*.3,35);g.stroke();}
  var pearl=g.createRadialGradient(-13,-20,2,0,-3,39);pearl.addColorStop(0,'#fffef4');pearl.addColorStop(.3,'#f1e6f0');pearl.addColorStop(.56,'#c7dae2');pearl.addColorStop(.78,'#d9bacd');pearl.addColorStop(1,'#877eae');g.fillStyle=pearl;g.beginPath();g.arc(0,-4,33,0,Math.PI*2);g.fill();g.strokeStyle='#f6f0ef99';g.lineWidth=1.4;g.beginPath();g.arc(-1,-5,29,Math.PI*.85,Math.PI*1.8);g.stroke();g.fillStyle='#ffffffb0';g.beginPath();g.ellipse(-12,-19,11,6,-.65,0,Math.PI*2);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(-15,-21,3,0,Math.PI*2);g.fill();
 }else{
  var points=[];for(var i=0;i<10;i++){var a=-Math.PI/2+i*Math.PI/5,r=i%2?25:63;points.push([Math.cos(a)*r,Math.sin(a)*r]);}
  var halo=g.createRadialGradient(0,0,8,0,0,87);halo.addColorStop(0,'#ffeebc88');halo.addColorStop(.55,'#78e4d92c');halo.addColorStop(1,'#76d9ef00');g.fillStyle=halo;g.fillRect(-95,-95,190,190);
  var colors=['#ffeab2','#afeee6','#d5fff0','#73cbd4','#ffe6a1','#d0f5eb','#f8d595','#78bfcf','#fff2c4','#b1e1e5'];for(var i=0;i<10;i++){g.fillStyle=colors[i];g.beginPath();g.moveTo(0,0);g.lineTo(points[i][0],points[i][1]);g.lineTo(points[(i+1)%10][0],points[(i+1)%10][1]);g.closePath();g.fill();}g.strokeStyle='#efffe5';g.lineWidth=1.7;g.beginPath();points.forEach(function(p,i){if(!i)g.moveTo(p[0],p[1]);else g.lineTo(p[0],p[1]);});g.closePath();g.stroke();g.fillStyle='#fff9d7';g.beginPath();g.arc(0,0,9,0,Math.PI*2);g.fill();g.strokeStyle='#fffde6';g.lineWidth=1;g.beginPath();g.moveTo(-11,-9);g.lineTo(12,11);g.moveTo(-8,9);g.lineTo(9,-12);g.stroke();
 }
 TREASURE_ART[type]=c;return c;
}
var treasureDraw=drawFood;drawFood=function(f,time){
 if(f.type!=='starfish'&&f.type!=='pearl'&&f.type!=='star'){treasureDraw(f,time);return;}
 var sprite=treasureSprite(f.type),bob=f.type==='star'?Math.sin((f.t||0)*2.2+(f.seed||0))*3:0;
 ctx.save();ctx.translate(f.x,f.y+bob);if(f.type==='star')ctx.rotate(Math.sin((f.t||0)*1.3+(f.seed||0))*.16);else if(f.type==='starfish')ctx.rotate((f.seed||0)*.3);var size=f.type==='pearl'?47:f.type==='star'?46:43;ctx.drawImage(sprite,-size/2,-size/2,size,size);
 if(f.type!=='starfish'){var glint=.25+.75*Math.max(0,Math.sin(time*2.7+(f.seed||0)));ctx.globalAlpha*=glint;ctx.fillStyle=f.type==='pearl'?'#f6eaff':'#d5fff2';ctx.beginPath();ctx.moveTo(12,-25);ctx.lineTo(12.8,-21);ctx.lineTo(17,-20);ctx.lineTo(12.8,-19);ctx.lineTo(12,-15);ctx.lineTo(11.2,-19);ctx.lineTo(7,-20);ctx.lineTo(11.2,-21);ctx.closePath();ctx.fill();}ctx.restore();
};
