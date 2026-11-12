/* Distinct abyss anatomy, sparse gelatinous life and coastal electric rays. */
var glassSquidSpec=abyssSpecies('玻璃乌贼',16,27,39,.32,'glasssquid',['#b1d8df','#e2f1ea','#466b7c'],0,[5]);
var combJellySpec=abyssSpecies('红腹栉水母',12,21,25,.66,'combjelly',['#9475b0','#d8d3ed','#6b335d'],0,[5,6]);
var glowCopepodSpec=abyssSpecies('发光桡足类',6,10,44,.28,'copepod',['#7bbac7','#d4f1d8','#3c728d'],0,[5,6]);
var electricRaySpec=oceanSpecies('电鳐',29,46,48,'ray',.49,['#8d8270','#d2c7a5','#4b504b'],'spots',[0,2],{electricRay:true,passive:true,nativeSize:true});electricRaySpec.abyssKind='electricray';
[glassSquidSpec,combJellySpec,glowCopepodSpec].forEach(s=>{s.passive=true;s.sparseDrifter=true;FISH_MEAL_PROFILES[s.n]=[.6,.7];});
combJellySpec.luminous=true;glowCopepodSpec.luminous=true;FISH_BITE_DAMAGE['电鳐']=18;
var SHOAL_ONLY_SPECIES=new Set([anchovySpec,sardineSpec,anthiasSpec,cardinalSpec,fusilierSpec]);
var chooseBeforeDiversity=chooseHabitatSpecies;
function chooseSparseDrifter(x,y){
 var near=fishes.filter(f=>!f.dead&&f.spec.sparseDrifter&&dist2(f.x,f.y,x,y)<2600*2600);if(near.length>=3)return null;
 var options=(y<18100?[glassSquidSpec,combJellySpec,glowCopepodSpec]:[combJellySpec,glowCopepodSpec]).filter(s=>near.filter(f=>f.spec===s).length<1);return options.length?options[Math.floor(Math.random()*options.length)]:null;
}
function electricRayHabitat(x,y){var region=oceanRegion(x,y);if((region!==0&&region!==2)||y<1400||y>6900)return false;var hit=foodSurfaceAt(x,y-35),gap=hit.surface-y;return gap>35&&gap<280&&!rkInside(x,y,30);}
chooseHabitatSpecies=function(x,y,small){
 if(y>=10600&&oceanRegion(x,y)!==7&&Math.random()<.065){var rare=chooseSparseDrifter(x,y);if(rare)return rare;}
 if(!small&&electricRayHabitat(x,y)&&Math.random()<.065&&!fishes.some(f=>!f.dead&&f.spec===electricRaySpec&&dist2(f.x,f.y,x,y)<2600*2600))return electricRaySpec;
 for(var i=0;i<24;i++){var sp=chooseBeforeDiversity(x,y,small);if(!SHOAL_ONLY_SPECIES.has(sp))return sp;}
 var r=oceanRegion(x,y);return r===0?SPECIES[0]:r===1?polarCodSpec:r===2||r===8?bigeyeSpec:r===6?blindCuskSpec:hatchetSpec;
};
var spawnBeforeShoalOnly=spawnFish;
spawnFish=function(){var region=oceanRegion(player.x,player.y);if((region===0||region===2||region===8)&&spawnRegionalShoal(region))return;spawnBeforeShoalOnly();};
var initBeforeElectricRay=initHabitatFish;
initHabitatFish=function(f,sp,x,y,size){initBeforeElectricRay(f,sp,x,y,size);f.electricState='rest';f.electricTimer=0;f.electricCooldown=0;f.electricFlash=0;f.rayBedTimer=0;f.rayBedY=y+120;if(sp===electricRaySpec)f.stingCd=0;return f;};
var steeringBeforeElectricRay=ecologySteering;
ecologySteering=function(f,x,y){if(f.spec===electricRaySpec){y+=clamp(((f.rayBedY||f.hy+120)-120-f.y)/160,-1.5,1.5);var len=Math.hypot(x,y)||1;x/=len;y/=len;}return steeringBeforeElectricRay(f,x,y);};
function updateRayElectricity(f,dt){
 f.electricCooldown=Math.max(0,f.electricCooldown-dt);f.electricFlash=Math.max(0,f.electricFlash-dt);f.stingCd=Math.max(0,(f.stingCd||0)-dt);
 if(f.electricState==='charge'){f.electricTimer-=dt;if(f.electricTimer<=0){f.electricState='rest';f.electricCooldown=8;f.electricFlash=.32;var radius=f.size*2.1+player.size*.25;if(player.alive&&dist2(f.x,f.y,player.x,player.y)<radius*radius)oceanContactDamage(f,22,'电鳐放电',1.1);}}
 else if(f.electricCooldown<=0&&player.alive&&player.spawnProt<=0&&dist2(f.x,f.y,player.x,player.y)<Math.pow(f.size*2.7+player.size*.3,2)){f.electricState='charge';f.electricTimer=.7;}
}
var fishBeforeElectricRay=updateFish;
updateFish=function(f,dt){fishBeforeElectricRay(f,dt);if(f.dead||f.spec!==electricRaySpec)return;f.rayBedTimer-=dt;if(f.rayBedTimer<=0){f.rayBedTimer=.5;var bed=foodSurfaceAt(f.x,f.y-35);if(bed.surface<6900)f.rayBedY=bed.surface;}updateRayElectricity(f,dt);};
var drawingBeforeElectricRay=drawFishSprite;
drawFishSprite=function(f,x,y,size,angle,tail,inflate,isPlayer,time){drawingBeforeElectricRay(f,x,y,size,angle,tail,inflate,isPlayer,time);if(isPlayer||f.spec!==electricRaySpec||!(f.electricState==='charge'||f.electricFlash>0))return;ctx.save();ctx.translate(x,y);ctx.rotate(angle);var pulse=f.electricFlash>0;ctx.strokeStyle=pulse?'#d9fbff':'#99d8e5';ctx.lineWidth=pulse?2.5:1.2;ctx.globalAlpha=pulse?.9:.25+.35*(1-f.electricTimer/.7);for(var side=-1;side<=1;side+=2){ctx.beginPath();for(var i=0;i<9;i++){var a=-1.2+i*.3,r=size*(pulse?2.1:1.45)+(i%2?size*.1:-size*.08);var xx=Math.cos(a)*r*side,yy=Math.sin(a)*r;if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}ctx.stroke();}ctx.restore();};
var paintBeforeDiversity=paintAncient;
function abyssFin(g,x,y,rx,ry,angle,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,angle,0,Math.PI*2);g.fill();g.stroke();}
paintAncient=function(g,sp,t){var k=sp.abyssKind;if(!['hagfish','blindcusk','snailfish','glasssquid','combjelly','copepod','electricray'].includes(k)){paintBeforeDiversity(g,sp,t);return;}g.lineCap='round';g.lineJoin='round';g.lineWidth=.014;g.strokeStyle=sp.c2+'a0';
 if(k==='hagfish'){
  var wave=Math.sin(t)*.1,skin=g.createLinearGradient(0,-.2,0,.22);skin.addColorStop(0,'#544e65');skin.addColorStop(.45,'#9c8499');skin.addColorStop(.8,'#c8a8b5');skin.addColorStop(1,'#6b5a73');g.fillStyle=skin;
  g.beginPath();g.moveTo(1.03,-.02);g.bezierCurveTo(.91,-.22,.45,-.19,-.15,-.13);g.bezierCurveTo(-.75,-.11,-1.12,wave-.09,-1.69,wave);g.bezierCurveTo(-1.2,wave+.09,-.7,.17,-.15,.17);g.bezierCurveTo(.41,.19,.95,.2,1.03,-.02);g.fill();g.stroke();
  g.strokeStyle='#dcc4c07a';g.lineWidth=.012;g.beginPath();g.moveTo(-1.58,wave);g.bezierCurveTo(-.8,-.04,.2,-.04,.78,-.03);g.stroke();g.fillStyle='#3a3447';for(var i=0;i<7;i++){g.beginPath();g.ellipse(.1+i*.068,.07,.014,.029,-.2,0,Math.PI*2);g.fill();}g.fillStyle='#3d2d40';g.beginPath();g.ellipse(.94,.06,.052,.034,0,0,Math.PI*2);g.fill();g.strokeStyle='#d5b3bd';for(var i=0;i<6;i++){var side=i<3?-1:1;g.beginPath();g.moveTo(.89+Math.abs(i-2.5)*.025,side*.035);g.quadraticCurveTo(1.12,side*(.1+(i%3)*.04),1.2,side*(.14+(i%3)*.055));g.stroke();}return;
 }
 if(k==='blindcusk'){
  var skin=g.createLinearGradient(-1.2,0,.95,0);skin.addColorStop(0,'#bbc9e735');skin.addColorStop(.55,'#c5bfd28c');skin.addColorStop(1,'#e8d4dcda');g.fillStyle=skin;
  g.beginPath();g.moveTo(-1.42,Math.sin(t)*.06);g.bezierCurveTo(-.8,-.07,-.25,-.29,.4,-.32);g.bezierCurveTo(.72,-.36,.99,-.25,.98,-.06);g.bezierCurveTo(.96,.22,.53,.3,.12,.2);g.bezierCurveTo(-.52,.14,-1.05,.1,-1.42,Math.sin(t)*.06);g.fill();g.stroke();
  g.strokeStyle='#e1d8ee6b';g.lineWidth=.02;g.beginPath();g.moveTo(-1.16,.015);g.quadraticCurveTo(-.3,-.015,.55,-.02);g.stroke();g.strokeStyle='#b6abd890';g.lineWidth=.012;for(var i=0;i<16;i++){var x=-.95+i*.085;g.beginPath();g.moveTo(x,.01);g.lineTo(x+.03,-.025);g.stroke();}abyssFin(g,.38,.2,.32,.13,.4,'#d4c5e355');g.strokeStyle='#dfd1e4';for(var i=0;i<2;i++){g.beginPath();g.moveTo(.56,.19);g.quadraticCurveTo(.38,.44+i*.07,-.05,.48+i*.1);g.stroke();}g.strokeStyle='#9c7d90';g.beginPath();g.moveTo(.93,.11);g.quadraticCurveTo(.84,.145,.76,.12);g.stroke();return;
 }
 if(k==='snailfish'){
  g.fillStyle='#bca1b745';g.beginPath();g.moveTo(-.87,.02);g.bezierCurveTo(-.55,-.27,-.24,-.53,.31,-.5);g.bezierCurveTo(.84,-.49,1.08,-.22,.94,.14);g.bezierCurveTo(.8,.51,.37,.58,-.07,.34);g.quadraticCurveTo(-.47,.16,-.87,.02);g.fill();g.stroke();
  var skin=g.createRadialGradient(.44,-.08,.04,.25,.02,.85);skin.addColorStop(0,'#f0d4c9e0');skin.addColorStop(.58,'#d5a9b8b5');skin.addColorStop(1,'#a886a744');g.fillStyle=skin;g.beginPath();g.moveTo(-1.03,.06);g.bezierCurveTo(-.55,-.04,-.24,-.4,.24,-.4);g.bezierCurveTo(.82,-.48,1.03,-.13,.88,.18);g.bezierCurveTo(.7,.48,.24,.46,-.1,.24);g.quadraticCurveTo(-.59,.13,-1.03,.06);g.fill();g.stroke();
  abyssFin(g,.19,.29,.37,.39,.45,'#efc1c766');g.strokeStyle='#efd5cfaa';g.lineWidth=.01;for(var i=0;i<8;i++){var a=.35+i*.23;g.beginPath();g.moveTo(.28,.16);g.lineTo(.19-Math.sin(a)*.27,.24+Math.cos(a)*.46);g.stroke();}abyssFin(g,.41,.36,.095,.035,0,'#edc8b9');g.fillStyle='#36303b';g.beginPath();g.arc(.73,-.08,.026,0,Math.PI*2);g.fill();g.strokeStyle='#ac7a8c';g.beginPath();g.moveTo(.87,.12);g.quadraticCurveTo(.77,.17,.67,.14);g.stroke();return;
 }
 if(k==='glasssquid'){
  var sheen=g.createLinearGradient(0,-.37,0,.35);sheen.addColorStop(0,'#c5e7f055');sheen.addColorStop(.4,'#9ed5e51a');sheen.addColorStop(1,'#e2edf05a');g.fillStyle=sheen;g.strokeStyle='#b9e0e7b0';g.beginPath();g.moveTo(-1.04,0);g.bezierCurveTo(-.87,-.45,-.14,-.48,.45,-.2);g.quadraticCurveTo(.65,0,.45,.2);g.bezierCurveTo(-.14,.48,-.87,.45,-1.04,0);g.fill();g.stroke();for(var side=-1;side<=1;side+=2)abyssFin(g,-.64,side*.22,.27,.14,side*.4,'#9dcfdf44');abyssFin(g,-.15,.04,.13,.075,0,'#697b8e77');g.strokeStyle='#b5dbdba0';for(var i=0;i<8;i++){g.beginPath();g.moveTo(.45,(i-3.5)*.035);g.bezierCurveTo(.8,(i-3.5)*.06,1.03,(i-3.5)*.09+Math.sin(t+i)*.04,1.26,(i-3.5)*.07);g.stroke();}abyssFin(g,.42,-.09,.11,.105,0,'#7b9aab');abyssFin(g,.46,-.09,.052,.069,0,'#0e2a40');return;
 }
 if(k==='combjelly'){
  var swell=1+Math.sin(t)*.035;g.scale(1,swell);var gel=g.createRadialGradient(0,0,.05,0,0,.85);gel.addColorStop(0,'#aab4da30');gel.addColorStop(.8,'#a0cce12b');gel.addColorStop(1,'#d9e1f175');g.fillStyle=gel;g.strokeStyle='#d1d5ef95';g.beginPath();g.ellipse(0,0,.74,.64,0,0,Math.PI*2);g.fill();g.stroke();abyssFin(g,.15,.03,.24,.26,.3,'#8b365eae');for(var row=0;row<6;row++){var offset=(row-2.5)*.17;g.strokeStyle='#a6c6e444';g.beginPath();g.ellipse(0,0,.68,Math.abs(offset)+.07,0,0,Math.PI*2);g.stroke();for(var i=0;i<15;i++){var a=i/14*Math.PI*1.7+.5,x=Math.cos(a)*.69,y=Math.sin(a)*(.12+row*.08);g.fillStyle='hsla('+((i*24+row*50+t*30)%360)+',70%,80%,.85)';g.beginPath();g.ellipse(x,y,.018,.027,a,0,Math.PI*2);g.fill();}}return;
 }
 if(k==='copepod'){
  for(var side=-1;side<=1;side+=2){g.strokeStyle='#a5e5e4b0';g.lineWidth=.012;g.beginPath();g.moveTo(.51,side*.07);g.bezierCurveTo(.2,side*.4,-.61,side*.56,-1.31,side*(.6+Math.sin(t)*.05));g.stroke();for(var i=0;i<4;i++){g.beginPath();g.moveTo(.25-i*.19,side*.13);g.lineTo(.07-i*.23,side*(.31+i*.035));g.stroke();}}
  for(var i=4;i>=0;i--){abyssFin(g,.48-i*.24,0,.23-i*.02,.18-i*.022,0,'#b1d9d868');g.fillStyle='#b5f2dc';g.beginPath();g.arc(.35-i*.22,.02,.025,0,Math.PI*2);g.fill();}g.strokeStyle='#91c9df';for(var side=-1;side<=1;side+=2){g.beginPath();g.moveTo(-.6,side*.04);g.lineTo(-1.03,side*.19);g.stroke();}return;
 }
 if(k==='electricray'){
  g.fillStyle='#616b62';g.beginPath();g.moveTo(-.45,0);g.bezierCurveTo(-.95,-.07,-1.13,-.13,-1.37,-.04);g.lineTo(-1.62,-.16);g.lineTo(-1.55,.17);g.lineTo(-1.34,.08);g.quadraticCurveTo(-.93,.18,-.45,.11);g.closePath();g.fill();g.stroke();var skin=g.createLinearGradient(0,-.6,0,.6);skin.addColorStop(0,'#a99b7f');skin.addColorStop(.5,'#8c846e');skin.addColorStop(1,'#c2b697');g.fillStyle=skin;g.beginPath();g.ellipse(.02,0,.91,.6,0,0,Math.PI*2);g.fill();g.stroke();g.strokeStyle='#ddd0b04d';for(var side=-1;side<=1;side+=2){g.beginPath();g.ellipse(.03,side*.31,.48,.2,0,0,Math.PI*2);g.stroke();abyssFin(g,.53,side*.12,.057,.035,0,'#202e32');}g.fillStyle='#4b544d88';for(var i=0;i<22;i++){var a=i*2.399,r=Math.sqrt(i/22)*.58;g.beginPath();g.arc(Math.cos(a)*r,Math.sin(a)*r*.7,.022+i%3*.008,0,Math.PI*2);g.fill();}return;
 }
};
var guideBeforeDiversity=buildGuideEntries;
buildGuideEntries=function(){var entries=guideBeforeDiversity();entries.forEach(e=>{var sp=e.spec;if(!sp)return;if(SHOAL_ONLY_SPECIES.has(sp))e.lines[3]='仅鱼群生成 · 不加入常规单鱼池';if(sp===electricRaySpec)e.lines=['体长 29–46 · 浅海至第二层近底','接近后蓄电 0.7 秒 · 放电后休息 8 秒','近距放电：饱食 -22 · 短暂减速','海洋电鳐 · 体型足够可吞食'];if(sp===combJellySpec)e.lines[3]='四、五层稀疏出现 · 无刺细胞 · 彩色梳板表现含美术强化';if(sp===glassSquidSpec)e.lines[3]='第四层稀疏出现 · 半透明身体 · 不主动发光';if(sp===glowCopepodSpec)e.lines[3]='四、五层稀疏出现 · 小型发光甲壳动物';if(sp===blindCuskSpec)e.lines[3]='半透明鳗状身体 · 尖细尾部与细长腹鳍丝';if(sp===hagfishSpec)e.lines[3]='细长无鳞身体 · 口须、鳃孔 · 无成对胸鳍';if(sp===snailfishSpec)e.lines[3]='胶质圆头 · 宽胸鳍 · 腹部吸盘与逐渐收窄的尾';});return entries;};
