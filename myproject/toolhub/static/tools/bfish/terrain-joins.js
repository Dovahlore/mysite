/* Stitch only thin, opposing seams between major landforms; all carved voids survive. */
var TERRAIN_JOINS=[];
var terrainBeforeSeamJoins=RK_init;
RK_init=function(){terrainBeforeSeamJoins();TERRAIN_JOINS=[];var rocks=RK_list.filter(r=>!r.ship&&r.w*r.h>3000000&&!r.name.includes('石柱')),bases=rocks.map(r=>Object.assign({},r,{caves:[],rectCuts:[]}));
 for(var a=0;a<rocks.length;a++)for(var b=a+1;b<rocks.length;b++){var ra=rocks[a],rb=rocks[b],left=Math.max(ra.wx0,rb.wx0)-90,right=Math.min(ra.wx1,rb.wx1)+90,top=Math.max(ra.wy0,rb.wy0)-90,bottom=Math.min(ra.wy1,rb.wy1)+90;if(left>=right||top>=bottom)continue;var blobs=[],na={x:0,y:0},nb={x:0,y:0};
  for(var y=top;y<bottom;y+=80)for(var x=left;x<right;x+=80){var da=rkField(bases[a],x-ra.ax,y-ra.ay);if(da<=0||da>110)continue;var db=rkField(bases[b],x-rb.ax,y-rb.ay);if(db<=0||da+db>145)continue;rkGrad(bases[a],x-ra.ax,y-ra.ay,na);rkGrad(bases[b],x-rb.ax,y-rb.ay,nb);if(na.x*nb.x+na.y*nb.y>-.25)continue;blobs.push(x,y,Math.max(110,(da+db)*.7+50));}
  if(!blobs.length)continue;var ice=!!(ra.ice||rb.ice),r={name:'岩体接合 '+ra.name+' / '+rb.name,ax:0,ay:0,blobs:blobs,boxes:[],caves:[],rectCuts:[],k:35,z:ice?3:2,ice:ice,tint:ice?[115,164,188]:[48,66,84],seamJoin:true};rockBounds(r);
  // Copy intersecting cuts into world coordinates, so a joint never plugs a tunnel.
  RK_list.forEach(q=>{if(q.ship||q.wx1<r.wx0||q.wx0>r.wx1||q.wy1<r.wy0||q.wy0>r.wy1)return;for(var i=0;i<q.caves.length;i+=5)r.caves.push(q.ax+q.caves[i],q.ay+q.caves[i+1],q.ax+q.caves[i+2],q.ay+q.caves[i+3],q.caves[i+4]+40);for(var i=0;i<(q.rectCuts||[]).length;i+=5)r.rectCuts.push(q.ax+q.rectCuts[i],q.ay+q.rectCuts[i+1],q.rectCuts[i+2]+30,q.rectCuts[i+3]+30,q.rectCuts[i+4]);});rkBake(r);TERRAIN_JOINS.push(r);
 }
 RK_list.push(...TERRAIN_JOINS);
};
