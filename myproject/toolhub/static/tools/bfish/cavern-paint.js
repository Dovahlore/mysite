/* Shared by the viewport worker and catalogue: solid rear geology, exact outer mask. */
function fillCavernRearRows(r,im,from,to){
 var base=Object.assign({},r,{caves:[],rectCuts:[]}),tint=r.ice?[108,152,171]:r.tint||[76,98,114],step=Math.max(r.w/im.width,r.h/im.height),air=r.airPocket,tintBuffer=[0,0,0];
 for(var y=from;y<to;y++)for(var x=0;x<im.width;x++){
  var px=r.ox+(x+.5)*r.w/im.width,py=r.oy+(y+.5)*r.h/im.height,d=rkField(base,px,py),i=(y*im.width+x)*4;if(d>step)continue;
  var cut=rkField(r,px,py),wx=px+r.ax,wy=py+r.ay,tint=geologyTint(r,wx,wy,tintBuffer),depth=Math.max(0,cut),rim=Math.exp(-depth/95),strata=Math.sin(wy*.021+Math.sin(wx*.009)*1.7),grain=Math.sin(wx*.071+wy*.037)*Math.sin(wy*.091-wx*.017),crack=Math.abs(Math.sin(wx*.012+Math.sin(wy*.014)*.85+Math.sin(wy*.035)*.15)),shade=.32+.19*rim+strata*.035+grain*.018;
  if(crack<.035)shade*=.68;var red=tint[0]*shade,green=tint[1]*shade,blue=tint[2]*shade+5;
  if(!r.ice){red=Math.round(tint[0]*.38);green=Math.round(tint[1]*.38);blue=Math.round(tint[2]*.38+5);}
  if(r.temple||r.mine){var row=Math.floor(wy/88),jointX=((wx+(row%2)*110)%220+220)%220,jointY=((wy%88)+88)%88,edge=jointX<3||jointY<3;var v=r.mine?.39+grain*.04+strata*.025:edge?.23:.4+grain*.025;red=tint[0]*v;green=tint[1]*v;blue=tint[2]*v+5;}
  if(r.ice){var frost=Math.max(0,Math.sin(wx*.026)*Math.sin(wy*.031)-.4),vein=Math.abs(Math.sin(wx*.013+wy*.009+Math.sin(wy*.026)*.4));red=63+rim*32+strata*3+frost*18;green=119+rim*38+strata*4+frost*24;blue=153+rim*40+strata*4+frost*28;if(vein<.026){red+=30;green+=33;blue+=32;}}
  if(air&&Math.abs(wx-air.x)<(air.rx||air.r)&&Math.abs(wy-air.y)<(air.ry||air.r)){var baseRed=red,baseGreen=green,baseBlue=blue,influence=clamp(1-Math.max(0,wy-air.waterline-130)/350,0,1),water=air.waterline+Math.sin(wx*.025)*2,light=Math.max(0,1-(air.waterline-wy)/(air.r*1.5)),mix=clamp((wy-water)/Math.max(step,2)+.5,0,1),line=Math.exp(-Math.abs(wy-water)/2);red=(108+light*36+strata*5+grain)*(1-mix)+(61+rim*24)*mix+line*60;green=(156+light*32+strata*6+grain)*(1-mix)+(120+rim*25)*mix+line*66;blue=(184+light*28+strata*6+grain)*(1-mix)+(155+rim*30)*mix+line*66;if(mix<.1){var joint=Math.abs(Math.sin(wx*.017+Math.sin(wy*.024)*.75+Math.sin(wy*.053)*.2));if(joint<.04){red+=20;green+=25;blue+=25;}var lamina=Math.pow(Math.max(0,Math.sin(wy*.042+Math.sin(wx*.016)*.7)),10);red+=lamina*7;green+=lamina*9;blue+=lamina*10;}red=baseRed+(red-baseRed)*influence;green=baseGreen+(green-baseGreen)*influence;blue=baseBlue+(blue-baseBlue)*influence;}
  im.data[i]=red;im.data[i+1]=green;im.data[i+2]=blue;im.data[i+3]=clamp(.5-d/step,0,1)*255;
 }
}
function cavernRearPixels(r,width,height){var c=newCanvas(width,height),g=c.getContext('2d'),im=g.createImageData(c.width,c.height);fillCavernRearRows(r,im,0,im.height);g.putImageData(im,0,0);return c;}
function caveSectionArt(r,width,height){var c=cavernRearPixels(r,width,height),g=c.getContext('2d');g.drawImage(rockPixels(r,width,height),0,0);return c;}
