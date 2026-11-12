/* V4.2 viewport streaming: collision data is permanent; visual assets are disposable. */
'use strict';
var STREAM={worker:null,busy:null,disabled:false,job:0,resident:0,maxBytes:(window.innerWidth<700?32:64)*1024*1024,loaded:0,evicted:0,failed:0,fallback:null,frame:0};
var streamWorkerURL=new URL('streaming-worker.js',document.currentScript.src).href;
var originalRockBake=rkBake;
function rockBounds(r){
 var x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(var i=0;i<r.blobs.length;i+=3){var x=r.blobs[i],y=r.blobs[i+1],radius=r.blobs[i+2];x0=Math.min(x0,x-radius);y0=Math.min(y0,y-radius);x1=Math.max(x1,x+radius);y1=Math.max(y1,y+radius);}
 var boxes=r.boxes||[];
 for(var j=0;j<boxes.length;j+=5){x0=Math.min(x0,boxes[j]-boxes[j+2]);y0=Math.min(y0,boxes[j+1]-boxes[j+3]);x1=Math.max(x1,boxes[j]+boxes[j+2]);y1=Math.max(y1,boxes[j+1]+boxes[j+3]);}
 var pad=(r.organic||0)*2+Math.max(26,r.k*.5+10)+(r.terrainWave?r.terrainWave[0]*1.3:0);
 r.ox=x0-pad;r.oy=y0-pad;r.w=Math.ceil(x1-x0+pad*2);r.h=Math.ceil(y1-y0+pad*2);
 r.wx0=r.ax+r.ox;r.wy0=r.ay+r.oy;r.wx1=r.wx0+r.w;r.wy1=r.wy0+r.h;
}
function rockPixels(r,width,height){
 var c=newCanvas(width,height),g=c.getContext('2d'),im=g.createImageData(c.width,c.height);
 fillRockRows(r,im,0,im.height);g.putImageData(im,0,0);return c;
}
function fillRockRows(r,im,from,to){
 var tint=r.tint||RK_TINT[r.z];
 for(var y=from;y<to;y++)for(var x=0;x<im.width;x++){
  var px=r.ox+(x+.5)*r.w/im.width,py=r.oy+(y+.5)*r.h/im.height,d=rkField(r,px,py),i=(y*im.width+x)*4;
  if(d>Math.max(r.w/im.width,r.h/im.height))continue;
  var shade=(.72+.28*Math.exp(Math.min(d,0)/180))*(1+.06*Math.sin(py*.017+r.ax*.013));
  shade*=.96+.04*Math.sin(px*.035+Math.sin(py*.022)*2);
  var rim=1+.22*Math.exp(Math.min(d,0)/14);
  im.data[i]=tint[0]*shade*rim;im.data[i+1]=tint[1]*shade*rim;im.data[i+2]=tint[2]*shade*rim;
  im.data[i+3]=clamp(.5-d/Math.max(r.w/im.width,r.h/im.height),0,1)*255;
 }
}
rkBake=function(r){
 rockBounds(r);
 var scale=Math.min(1,128/Math.max(r.w,r.h));
 r.preview=rockPixels(r,Math.max(8,Math.ceil(r.w*scale)),Math.max(8,Math.ceil(r.h*scale)));
 r.spr=r.preview;r.streamBytes=0;r.streamTouch=0;r.streamPending=false;
};
function makeSeabedPreview(x,w){
 var c=newCanvas(96,Math.ceil(96*FSTRIP_H/w)),g=c.getContext('2d');
 g.scale(c.width/w,c.height/FSTRIP_H);g.beginPath();
 for(var dx=0;dx<=w;dx+=w/95){var y=floorAt(x+dx)-FSTRIP_Y0;if(dx===0)g.moveTo(dx,y);else g.lineTo(dx,y);}
 g.lineTo(w,FSTRIP_H);g.lineTo(0,FSTRIP_H);g.closePath();
 var color=['#d8c48a','#e0b4a0','#22334a','#b8a87e'][zoneAt(x+w/2,floorAt(x+w/2)-30)];
 var gr=g.createLinearGradient(0,0,0,FSTRIP_H);gr.addColorStop(0,color);gr.addColorStop(1,'#08121e');g.fillStyle=gr;g.fill();return c;
}
var terrainTiles=[];
function buildTerrainTiles(){
 terrainTiles=[];
 RK_list.forEach(function(r){
  if(r.w*r.h<1100000){r.textureScale=window.innerWidth<700?1:1.35;terrainTiles.push(r);return;}
  r.tiles=[];
  for(var y=0;y<r.h;y+=768)for(var x=0;x<r.w;x+=768){
   var t={ax:r.ax,ay:r.ay,blobs:r.blobs,boxes:r.boxes,tint:r.tint,organic:r.organic,ship:!!r.ship,ice:!!r.ice,terrainWave:r.terrainWave,caves:r.caves,k:r.k,glow:r.glow,z:r.z,ox:r.ox+x,oy:r.oy+y,w:Math.min(768,r.w-x),h:Math.min(768,r.h-y),wx0:r.wx0+x,wy0:r.wy0+y,tile:true,textureScale:window.innerWidth<700?1:1.35,streamBytes:0,streamPending:false,streamTouch:0,preview:null,spr:null};
   t.wx1=t.wx0+t.w;t.wy1=t.wy0+t.h;
   // Skip rectangles entirely outside a rock or wholly within a large cave.
   var padding=Math.hypot(t.w,t.h)/2,centerDistance=rkField(r,t.ox+t.w/2,t.oy+t.h/2);
   if(centerDistance>padding+10)continue;
   terrainTiles.push(t);r.tiles.push(t);
  }
 });
}
function streamEntryList(){return terrainTiles.concat(FSTRIP);}
function textureOf(e){return e.blobs?e.spr:e.c;}
function setTexture(e,t){if(e.blobs)e.spr=t;else e.c=t;}
function evictStreamEntry(e){
 if(!e.streamBytes)return;var t=textureOf(e);if(t&&typeof t.close==='function')t.close();
 STREAM.resident-=e.streamBytes;e.streamBytes=0;setTexture(e,e.preview);STREAM.evicted++;
}
function finishStream(e,texture){
 e.streamPending=false;e.streamTouch=performance.now();
 var bytes=texture.width*texture.height*4;
 var entries=streamEntryList().filter(function(other){return other!==e&&other.streamBytes&&(other.streamPriority>e.streamPriority+1);});
 entries.sort(function(a,b){return b.streamPriority-a.streamPriority;});
 var reclaimable=entries.reduce(function(sum,other){return sum+other.streamBytes;},0);
 if(bytes<=STREAM.maxBytes && STREAM.resident+bytes-reclaimable>STREAM.maxBytes){if(texture.close)texture.close();e.streamRetry=performance.now()+1500;return;}
 while(STREAM.resident+bytes>STREAM.maxBytes&&entries.length)evictStreamEntry(entries.shift());
 if(bytes>STREAM.maxBytes){if(texture.close)texture.close();e.streamNoHigh=true;return;}
 setTexture(e,texture);e.streamBytes=bytes;STREAM.resident+=bytes;STREAM.loaded++;
}
function startStreamWorker(){
 if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'){STREAM.disabled=true;if(window.requestWorldAtlas)requestWorldAtlas(true);return;}
 try{
  STREAM.worker=new Worker(streamWorkerURL);
  STREAM.worker.onmessage=function(event){
   var m=event.data,job=STREAM.busy;if(m.id<=-1000&&window.finishCaveBacking){finishCaveBacking(m);return;}
   if(m.id===-1){if(m.error){if(window.requestWorldAtlas)requestWorldAtlas(true);}else{var atlas=newCanvas(m.bitmap.width,m.bitmap.height);atlas.getContext('2d').drawImage(m.bitmap,0,0);m.bitmap.close();replaceWorldAtlas(atlas);}return;}
   if(!job||m.id!==job.id){if(m.bitmap&&m.bitmap.close)m.bitmap.close();return;}
   STREAM.busy=null;
   if(m.error){job.entry.streamPending=false;disableStreamWorker();return;}
   finishStream(job.entry,m.bitmap);
  };
  STREAM.worker.onerror=function(event){event.preventDefault();disableStreamWorker();};
  STREAM.worker.postMessage({type:'init',floor:FLOOR});
  if(window.requestWorldAtlas)requestWorldAtlas();
 }catch(_){disableStreamWorker();}
}
function disableStreamWorker(){
 if(STREAM.worker)STREAM.worker.terminate();STREAM.worker=null;STREAM.disabled=true;STREAM.failed++;
 if(window.requestWorldAtlas)requestWorldAtlas(true);
 if(STREAM.busy)STREAM.busy.entry.streamPending=false;STREAM.busy=null;
}
function requestStreamTexture(e){
 var estimate=e.blobs?Math.ceil(e.w*(e.textureScale||1))*Math.ceil(e.h*(e.textureScale||1))*4:Math.ceil(e.w*FSTRIP_BS)*Math.ceil(FSTRIP_H*FSTRIP_BS)*4;
 if(estimate>STREAM.maxBytes){e.streamNoHigh=true;return;}
 var reclaimable=streamEntryList().reduce(function(sum,other){return sum+(other.streamBytes&&other.streamPriority>e.streamPriority+1?other.streamBytes:0);},0);
 if(STREAM.resident+estimate-reclaimable>STREAM.maxBytes){e.streamRetry=performance.now()+1500;return;}
 e.streamPending=true;
 if(STREAM.worker){
  var id=++STREAM.job;STREAM.busy={id:id,entry:e,time:performance.now()};
  var m={id:id,seed:((e.ax||e.x)*1009+(e.ay||0)*917)|0};
  if(e.blobs){m.type='rockTile';m.rock={ax:e.ax,ay:e.ay,blobs:e.blobs,boxes:e.boxes,tint:e.tint,organic:e.organic,ship:!!e.ship,ice:!!e.ice,terrainWave:e.terrainWave,caves:e.caves,k:e.k,glow:e.glow,z:e.z,ox:e.ox,oy:e.oy,w:e.w,h:e.h};m.scale=e.textureScale||1;}
  else{m.type='seabed';m.x=e.x;m.w=e.w;}
  try{STREAM.worker.postMessage(m);}catch(_){e.streamPending=false;disableStreamWorker();}
 }else if(e.blobs){
  // Unsupported/CSP-blocked workers: yield between small raster row batches.
  var scale=Math.min(1,1280/Math.max(e.w,e.h));
  var c=newCanvas(e.w*scale,e.h*scale),g=c.getContext('2d');
  STREAM.fallback={entry:e,canvas:c,g:g,image:g.createImageData(c.width,c.height),row:0};
 }else{
  // The preview is permanent in fallback mode: no large synchronous seabed task.
  e.streamPending=false;e.streamNoHigh=true;
 }
}
function stepStreamFallback(){
 var job=STREAM.fallback;if(!job)return;
 var deadline=performance.now()+2;
 do{var to=Math.min(job.row+3,job.image.height);fillRockRows(job.entry,job.image,job.row,to);job.row=to;}
 while(job.row<job.image.height&&performance.now()<deadline);
 if(job.row===job.image.height){job.g.putImageData(job.image,0,0);finishStream(job.entry,job.canvas);STREAM.fallback=null;}
}
function streamTick(){
 var now=performance.now();STREAM.frame++;
 if(STREAM.busy&&now-STREAM.busy.time>8000)disableStreamWorker();
 stepStreamFallback();
 var hw=W/(2*cam.z),hh=H/(2*cam.z),pad=650;
 var cx=cam.x+player.vx*.6,cy=cam.y+player.vy*.6;
 var nearest=null,best=Infinity,entries=streamEntryList();
 for(var i=0;i<entries.length;i++){
  var e=entries[i],x=e.blobs?e.wx0:e.x,y=e.blobs?e.wy0:FSTRIP_Y0,h=e.blobs?e.h:FSTRIP_H;
  var visible=x<cx+hw+pad&&x+e.w>cx-hw-pad&&y<cy+hh+pad&&y+h>cy-hh-pad;
  var distance=Math.hypot(x+e.w/2-cam.x,y+h/2-cam.y);
  var onScreen=x<cam.x+hw&&x+e.w>cam.x-hw&&y<cam.y+hh&&y+h>cam.y-hh;
  e.streamPriority=(onScreen?0:visible?1000000:1000000000)+distance;
  if(visible){
   e.streamTouch=now;
   if(!e.streamBytes&&!e.streamPending&&!e.streamNoHigh&&(!e.streamRetry||now>e.streamRetry)){if(e.streamPriority<best){best=e.streamPriority;nearest=e;}}
  }else if(e.streamBytes&&now-e.streamTouch>12000)evictStreamEntry(e);
 }
 if(nearest&&!STREAM.busy&&!STREAM.fallback)requestStreamTexture(nearest);
}
var decorChunks=new Map();
function buildDecorChunks(){
 decorChunks.clear();
 for(var i=0;i<WORLD_DECORS.length;i++){var d=WORLD_DECORS[i],key=Math.floor(d.x/1024)+','+Math.floor(d.y/1024);if(!decorChunks.has(key))decorChunks.set(key,[]);decorChunks.get(key).push(d);}
}
var visibleDecorScratch=[];
function streamedDecors(left,top,right,bottom){
 visibleDecorScratch.length=0;
 for(var x=Math.floor((left-250)/1024);x<=Math.floor((right+250)/1024);x++)for(var y=Math.floor((top-50)/1024);y<=Math.floor((bottom+700)/1024);y++){
  var items=decorChunks.get(x+','+y);if(items)for(var i=0;i<items.length;i++)visibleDecorScratch.push(items[i]);
 }return visibleDecorScratch;
}
var bakeBeforeStreaming=bakeBackgrounds;
bakeBackgrounds=function(){
 bakeBeforeStreaming();
 for(var i=0;i<FSTRIP.length;i++){var e=FSTRIP[i];e.preview=e.c;e.streamBytes=0;e.streamTouch=0;e.streamPending=false;}
 buildTerrainTiles();buildDecorChunks();startStreamWorker();
};
var renderBeforeStreaming=render;
render=function(time){streamTick();renderBeforeStreaming(time);};
// Only clear occupied fish-grid buckets; the whole world has thousands of empty buckets.
var activeGridBuckets=[],insertBeforeStreaming=gridInsert;
gridInsert=function(f){
 var x=clamp(Math.floor((f.x+GRID_MX)/GRID_CELL),0,gridCols-1),y=clamp(Math.floor((f.y+GRID_MY)/GRID_CELL),0,gridRows-1),index=y*gridCols+x;
 if(gridCells[index].length===0)activeGridBuckets.push(index);insertBeforeStreaming(f);
};
gridClear=function(){for(var i=0;i<activeGridBuckets.length;i++)gridCells[activeGridBuckets[i]].length=0;activeGridBuckets.length=0;};
window.addEventListener('pagehide',function(){if(STREAM.worker)STREAM.worker.terminate();});

// Prevent gameplay input before the incremental boot has initialized object pools.
STREAM.ready=false;el('t-start').disabled=true;el('t-start').textContent='海域准备中…';
var startBeforeStreaming=startOrRestart;
startOrRestart=function(){if(STREAM.ready)startBeforeStreaming();};
