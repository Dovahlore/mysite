'use strict';
importScripts('geology-color.js?v=6.30','cavern-paint.js?v=6.30');
var CONF={WORLD_W:27200,WORLD_H:15800};var FLOOR;var FSTRIP_H=3350,FSTRIP_BS=.35,FSTRIP_Y0=12450;var RK_TINT=[[96,112,116],[98,104,120],[54,72,94],[80,98,112]];var seed=1;
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function rand(a,b){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+(b-a)*seed/4294967296;}
function newCanvas(w,h){return new OffscreenCanvas(Math.max(2,Math.ceil(w)),Math.max(2,Math.ceil(h)));}
function floorAt(x){
  var fi = x / 10, i = Math.floor(fi);
  if (i < 0) return FLOOR[0];
  if (i >= FLOOR.length - 1) return FLOOR[FLOOR.length - 1];
  return FLOOR[i] + (FLOOR[i + 1] - FLOOR[i]) * (fi - i); // 列间线性插值→连续曲面(螃蟹爬坡/游动不再台阶)
}
function zoneW(x, y){
  var shLine = 1350 + Math.sin(x * 0.0008) * 220 + Math.sin(x * 0.00028 + 2) * 140;
  var wS = clamp(1 - (y - shLine) / 430, 0, 1);
  var coralEdge = 18800 + Math.sin(y * 0.0012) * 280 + Math.sin(y * 0.0004 + 1) * 170;
  var wC = clamp(1 - (coralEdge - x) / 500, 0, 1);
  var dx = x - 3800, dy = y - 10600;
  var wD = clamp(1 - Math.sqrt(dx * dx + dy * dy) / 6400, 0, 1);
  if (x < 9500 && y > 12200){
    var corner = Math.min(1, (9500 - x) / 800) * Math.min(1, (y - 12200) / 500);
    if (corner > wD) wD = corner;
  }
  return [wS, wC, wD];
}
function zoneAt(x,y){if(x>=19500&&y<6800)return 3;if(y<3200)return 0;if(y<6900)return 1;return 2;}
function rkField(rk, px, py){
  if(rk.organic){var xx=px,yy=py;px+=Math.sin((yy+rk.ay)*.007)*rk.organic;py+=Math.sin((xx+rk.ax)*.006+1.3)*rk.organic;}
  var bl = rk.blobs, d = 1e9, k = rk.k, i;
  for (i = 0; i < bl.length; i += 3){
    var dx = px - bl[i], dy = py - bl[i + 1];
    var dd = Math.sqrt(dx * dx + dy * dy) - bl[i + 2];
    var h = clamp(0.5 + 0.5 * (dd - d) / k, 0, 1);
    d = dd * (1 - h) + d * h - k * h * (1 - h); // smooth-min: 有机曲面融合
  }
  var boxes=rk.boxes||[];
  for(i=0;i<boxes.length;i+=5){
    var wave=rk.terrainWave?(Math.sin((px+rk.ax)*.00062+rk.terrainWave[1])+Math.sin((px+rk.ax)*.0018+rk.terrainWave[1])*.3)*rk.terrainWave[0]:0;
    var qx=Math.abs(px-boxes[i])-boxes[i+2]+boxes[i+4],qy=Math.abs(py+wave-boxes[i+1])-boxes[i+3]+boxes[i+4];
    var bd=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-boxes[i+4];
    var bh=clamp(.5+.5*(bd-d)/k,0,1);d=bd*(1-bh)+d*bh-k*bh*(1-bh);
  }
  var cv = rk.caves,cpx=px,cpy=py;
  if(cv.length&&!rk.ship){cpx+=Math.sin((py+rk.ay)*.009+rk.ax*.0003)*18+Math.sin((py+rk.ay)*.027)*5;cpy+=Math.sin((px+rk.ax)*.011+rk.ay*.0004)*17+Math.sin((px+rk.ax)*.031)*5;}
  for (i = 0; i < cv.length; i += 5){
    var ax = cv[i], ay = cv[i + 1];
    var abx = cv[i + 2] - ax, aby = cv[i + 3] - ay;
    var t = ((cpx - ax) * abx + (cpy - ay) * aby) / (abx * abx + aby * aby + 0.001);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var qx = cpx - ax - abx * t, qy = cpy - ay - aby * t,radius=cv[i+4];
    if(!rk.ship&&abx*abx+aby*aby<1){var theta=Math.atan2(qy,qx);qx/=1.22;qy/=.84;radius*=1+.09*Math.sin(theta*3+ax*.003)+.045*Math.sin(theta*5+ay*.002);}
    var cd = Math.sqrt(qx * qx + qy * qy) - radius;
    if (-cd > d) d = -cd; // 洞穴减法: 洞内变自由空间
  }
  // Architectural rooms retain flat dressed walls and rounded broken corners.
  var cuts=rk.rectCuts||[];
  for(i=0;i<cuts.length;i+=5){
    var rr=cuts[i+4],qx=Math.abs(px-cuts[i])-cuts[i+2]+rr,qy=Math.abs(py-cuts[i+1])-cuts[i+3]+rr;
    var room=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-rr;
    d=Math.max(d,-room);
  }
  return d;
}
function rkFlora(g, z, x, y){
  var j, an;
  if (z === 2){
    for (j = 0; j < 3; j++){
      g.strokeStyle = "rgba(29,233,182,0.8)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + j * 4 - 4, y + 2);
      g.quadraticCurveTo(x + j * 4 - 4 + (j % 2 ? 5 : -5), y - 10, x + j * 4 - 4 + (j % 2 ? 8 : -8), y - 20);
      g.stroke();
    }
  } else if (z === 1){
    g.strokeStyle = "rgba(255,127,165,0.75)"; g.lineWidth = 3;
    for (j = 0; j < 3; j++){
      an = -Math.PI / 2 + (j - 1) * 0.5;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(an) * 8, y - 8, x + Math.cos(an) * 14, y - 15);
      g.stroke();
    }
  } else if (z === 0){
    g.strokeStyle = "rgba(255,209,128,0.7)"; g.lineWidth = 2;
    for (j = 0; j < 4; j++){
      an = -Math.PI / 2 + (j - 1.5) * 0.4;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(an) * 7, y - 9, x + Math.cos(an) * 12, y - 16);
      g.stroke();
    }
  } else {
    g.strokeStyle = "rgba(46,125,80,0.8)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y + 2);
    g.quadraticCurveTo(x + 8, y - 14, x + 3, y - 30);
    g.stroke();
  }
}
function rkBake(rk){
  var bl = rk.blobs, i;
  var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (i = 0; i < bl.length; i += 3){
    if (bl[i] - bl[i + 2] < x0) x0 = bl[i] - bl[i + 2];
    if (bl[i] + bl[i + 2] > x1) x1 = bl[i] + bl[i + 2];
    if (bl[i + 1] - bl[i + 2] < y0) y0 = bl[i + 1] - bl[i + 2];
    if (bl[i + 1] + bl[i + 2] > y1) y1 = bl[i + 1] + bl[i + 2];
  }
  x0 -= 26; y0 -= 26; x1 += 26; y1 += 26;
  var w = Math.ceil(x1 - x0), h = Math.ceil(y1 - y0);
  var step = w * h > 2400000 ? 3 : (w * h > 1000000 ? 2 : 1); // 精度翻倍: 中小岩体 2px 采样
  var gw = Math.ceil(w / step), gh = Math.ceil(h / step);
  var small = newCanvas(gw, gh), sg = small.getContext("2d");
  var img = sg.createImageData(gw, gh), data = img.data;
  var tint = rk.tint || RK_TINT[rk.z], idx = 0;
  for (var cy2 = 0; cy2 < gh; cy2++){
    var py = y0 + (cy2 + 0.5) * step;
    var strata = 1 + Math.sin(py * 0.017 + rk.ax * 0.013) * 0.06; // 水平岩层纹理
    for (var cx2 = 0; cx2 < gw; cx2++, idx += 4){
      var px = x0 + (cx2 + 0.5) * step;
      var d = rkField(rk, px, py);
      if (d < 0){
        var sh = (0.72 + 0.28 * Math.exp(d / 180)) * strata;
        sh *= 0.96 + 0.04 * Math.sin(px * 0.035 + Math.sin(py * 0.022) * 2);
        if (sh < 0.36) sh = 0.36;
        var rim = 1 + 0.22 * Math.exp(d / 14);          // 受光边
        data[idx] = Math.min(255, tint[0] * sh * rim);
        data[idx + 1] = Math.min(255, tint[1] * sh * rim);
        data[idx + 2] = Math.min(255, tint[2] * sh * rim);
        data[idx + 3] = 255;
      } else if (d < step * 1.6){             // 外缘软光晕
        data[idx] = tint[0]; data[idx + 1] = tint[1]; data[idx + 2] = tint[2];
        data[idx + 3] = 90 * (1 - d / (step * 1.6));
      }
    }
  }
  sg.putImageData(img, 0, 0);
  var c = newCanvas(w, h), g = c.getContext("2d");
  g.drawImage(small, 0, 0, gw, gh, 0, 0, w, h);
  // 表面斑点(浅处亮典/深处暗点)
  var nSp = rk.ice ? 0 : Math.round(w * h / 4800);
  for (i = 0; i < nSp; i++){
    var sx = rand(x0 + 10, x1 - 10), sy = rand(y0 + 10, y1 - 10);
    var dd2 = rkField(rk, sx, sy);
    if (dd2 > -4 || dd2 < -110) continue;
    g.fillStyle = dd2 > -30 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.18)";
    g.beginPath(); g.arc(sx - x0, sy - y0, rand(2, 6), 0, Math.PI * 2); g.fill();
  }
  // 裂纹
  var nCr = 4 + Math.floor(bl.length / 8);
  for (i = 0; i < nCr; i++){
    var crx = rand(x0 + 40, x1 - 40), cry = rand(y0 + 40, y1 - 40);
    if (rkField(rk, crx, cry) > -20) continue;
    g.strokeStyle = rk.ice ? "rgba(205,244,255,0.5)" : "rgba(0,0,0,0.28)"; g.lineWidth = 2.5; g.lineCap = "round";
    g.beginPath(); g.moveTo(crx - x0, cry - y0);
    var ang = rand(0, Math.PI * 2);
    for (var st = 0; st < 6; st++){
      ang += rand(-0.7, 0.7);
      crx += Math.cos(ang) * rand(12, 26);
      cry += Math.sin(ang) * rand(12, 26);
      if (rkField(rk, crx, cry) > -6) break;
      g.lineTo(crx - x0, cry - y0);
    }
    g.stroke();
  }
  // 洞口发光晶簇(深渊/发光岩体)
  var cvs = rk.caves;
  if (cvs.length && (rk.z === 2 || rk.glow)){
    for (i = 0; i < cvs.length; i += 5){
      for (var e2 = 0; e2 < 4; e2++){
        var exx = cvs[i] + rand(-34, 34), eyy = cvs[i + 1] + rand(-34, 34);
        var ed = rkField(rk, exx, eyy);
        if (ed > -8 || ed < -46) continue;
        var gg2 = g.createRadialGradient(exx - x0, eyy - y0, 0, exx - x0, eyy - y0, 13);
        gg2.addColorStop(0, "rgba(120,255,225,0.8)");
        gg2.addColorStop(1, "rgba(120,255,225,0)");
        g.fillStyle = gg2;
        g.beginPath(); g.arc(exx - x0, eyy - y0, 13, 0, Math.PI * 2); g.fill();
      }
    }
  }
  // 顶部植被(表面朝上取样)
  var nf2 = 8 + Math.floor(bl.length / 5), placed = 0;
  for (i = 0; !rk.ice && i < 60 && placed < nf2; i++){
    var fx = rand(x0 + 20, x1 - 20), fy = rand(y0 + 10, y0 + h * 0.6);
    var fd = rkField(rk, fx, fy);
    if (fd > -10 || fd < -26) continue;
    rkFlora(g, rk.z, fx - x0, fy - y0);
    placed++;
  }
  rk.ox = x0; rk.oy = y0; rk.w = w; rk.h = h;
  rk.wx0 = rk.ax + x0; rk.wy0 = rk.ay + y0; rk.wx1 = rk.ax + x1; rk.wy1 = rk.ay + y1;
  rk.spr = c;
}
function paintSeabed(sx0,sw){
var sands=["#d8c48a","#e0b4a0","#22334a","#b8a87e"];
    var c = newCanvas(sw * FSTRIP_BS, FSTRIP_H * FSTRIP_BS), g = c.getContext("2d");
    g.scale(FSTRIP_BS, FSTRIP_BS);
    var sandTop = FSTRIP_H;
    for (var fsx = 0; fsx <= sw; fsx += 60){
      var st2 = floorAt(sx0 + fsx) - FSTRIP_Y0;
      if (st2 < sandTop) sandTop = st2;
    }
    if (sandTop < FSTRIP_H + 60){
      var znMid = zoneAt(sx0 + sw / 2, floorAt(sx0 + sw / 2) - 30);
      g.beginPath();
      var pX = 0, pY = floorAt(sx0) - FSTRIP_Y0;
      g.moveTo(pX, pY);
      for (var fx = 20; fx <= sw; fx += 20){
        var fyy = floorAt(sx0 + fx) - FSTRIP_Y0;
        g.quadraticCurveTo(pX, pY, (pX + fx) / 2, (pY + fyy) / 2);
        pX = fx; pY = fyy;
      }
      g.lineTo(pX, pY);
      g.lineTo(sw, FSTRIP_H + 4); g.lineTo(0, FSTRIP_H + 4); g.closePath();
      var sd = g.createLinearGradient(0, sandTop, 0, FSTRIP_H);
      sd.addColorStop(0, sands[znMid]);
      sd.addColorStop(1, "rgba(6,12,20,0.92)");
      g.fillStyle = sd; g.fill();
      g.strokeStyle = "rgba(255,238,196,0.16)";
      g.lineWidth = 3;
      g.beginPath();
      var eX = 0, eY = floorAt(sx0) - FSTRIP_Y0;
      g.moveTo(eX, eY);
      for (var fx3 = 20; fx3 <= sw; fx3 += 20){
        var ey3 = floorAt(sx0 + fx3) - FSTRIP_Y0;
        g.quadraticCurveTo(eX, eY, (eX + fx3) / 2, (eY + ey3) / 2);
        eX = fx3; eY = ey3;
      }
      g.stroke();
      var fgx = g.createLinearGradient(0, FSTRIP_H - 260, 0, FSTRIP_H);
      fgx.addColorStop(0, "rgba(4,10,18,0)"); fgx.addColorStop(1, "rgba(4,10,18,0.55)");
      g.fillStyle = fgx; g.fillRect(0, FSTRIP_H - 260, sw, 260);
      for (var rk2 = 0; rk2 < 10; rk2++){
        var rx = Math.random() * sw, ryF = floorAt(sx0 + rx) - FSTRIP_Y0;
        if (ryF < -30 || ryF > FSTRIP_H + 30) continue;
        g.fillStyle = "rgba(12,22,34,0.6)";
        g.beginPath(); g.ellipse(rx, ryF + 12, rand(14, 52), rand(8, 26), 0, 0, Math.PI * 2); g.fill();
      }
      for (var pb2 = 0; pb2 < 12; pb2++){
        var px3 = Math.random() * sw, pyF = floorAt(sx0 + px3) - FSTRIP_Y0 + rand(6, 70);
        if (pyF > FSTRIP_H) continue;
        g.fillStyle = "rgba(255,255,255," + rand(0.05, 0.15).toFixed(2) + ")";
        g.beginPath(); g.ellipse(px3, pyF, rand(3, 8), rand(2, 4), 0, 0, Math.PI * 2); g.fill();
      }
      // 沙纹(水流波痕, 贴海床曲线)
      for (var rp2 = 0; rp2 < 10; rp2++){
        var rpx = Math.random() * sw, rpf = floorAt(sx0 + rpx) - FSTRIP_Y0 + rand(10, 100);
        if (rpf > FSTRIP_H) continue;
        g.strokeStyle = "rgba(255,244,214,0.07)"; g.lineWidth = 2;
        g.beginPath(); g.arc(rpx, rpf + 30, rand(18, 44), Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      }
      // 贝壳与小海星
      for (var sh2 = 0; sh2 < 5; sh2++){
        var shx = Math.random() * sw, shf = floorAt(sx0 + shx) - FSTRIP_Y0 + rand(4, 40);
        if (shf > FSTRIP_H) continue;
        g.fillStyle = Math.random() < 0.5 ? "rgba(240,225,200,0.5)" : "rgba(255,170,150,0.45)";
        g.beginPath(); g.ellipse(shx, shf, rand(4, 8), rand(3, 5), rand(-0.4, 0.4), 0, Math.PI * 2); g.fill();
      }
    }

return c;
}

function fillRockRows(r,im,from,to){
 var tint=r.tint||RK_TINT[r.z],tintBuffer=[0,0,0];
 for(var y=from;y<to;y++)for(var x=0;x<im.width;x++){
  var px=r.ox+(x+.5)*r.w/im.width,py=r.oy+(y+.5)*r.h/im.height,d=rkField(r,px,py),i=(y*im.width+x)*4;
  if(d>Math.max(r.w/im.width,r.h/im.height))continue;
  var tint=geologyTint(r,px+r.ax,py+r.ay,tintBuffer),shade=(.72+.28*Math.exp(Math.min(d,0)/180))*(1+.06*Math.sin((py+r.ay)*.017+(px+r.ax)*.002));
  shade*=.96+.04*Math.sin((px+r.ax)*.035+Math.sin((py+r.ay)*.022)*2);
  var rim=1+.22*Math.exp(Math.min(d,0)/14);
  if(r.temple||r.mine){var wx=px+r.ax,wy=py+r.ay,row=Math.floor(wy/88),jx=((wx+(row%2)*110)%220+220)%220,jy=((wy%88)+88)%88;shade=r.mine?.7+.07*Math.sin(wx*.013+Math.sin(wy*.011)*2)*Math.sin(wy*.019):(jx<3||jy<3)?.49:.77+.03*Math.sin(wx*.04)*Math.sin(wy*.03);}

  im.data[i]=tint[0]*shade*rim;im.data[i+1]=tint[1]*shade*rim;im.data[i+2]=tint[2]*shade*rim;
  im.data[i+3]=clamp(.5-d/Math.max(r.w/im.width,r.h/im.height),0,1)*255;
 }
}

function paintRockTile(r,scale){var c=newCanvas(r.w*scale,r.h*scale),g=c.getContext('2d'),im=g.createImageData(c.width,c.height);fillRockRows(r,im,0,im.height);g.putImageData(im,0,0);return c;}
function biomeWater(x,y){
 var depth=clamp(Math.min(y,15800)/15800,0,1),r=lerp(60,2,depth),g=lerp(165,11,depth),b=lerp(186,34,depth),ice=clamp((x-18800)/1400,0,1)*clamp((7200-y)/1600,0,1);
 r=lerp(r,75,ice*.55);g=lerp(g,135,ice*.55);b=lerp(b,179,ice*.65);var fire=clamp(1-Math.abs(x-14700)/4200,0,1)*clamp((y-11500)/1400,0,1)*clamp((18000-y)/1100,0,1),a=clamp((y-12000)/7200,0,1);
 return [lerp(lerp(r,52,fire*.8),2,a),lerp(lerp(g,23,fire*.8),5,a),lerp(lerp(b,37,fire*.8),13,a)];
}

function paintAtlas(rocks){var c=newCanvas(500,Math.round(500*CONF.WORLD_H/CONF.WORLD_W)),g=c.getContext('2d'),im=g.createImageData(c.width,c.height);
 for(var y=0;y<c.height;y++)for(var x=0;x<c.width;x++){
  var wx=(x+.5)/c.width*CONF.WORLD_W,wy=(y+.5)/c.height*CONF.WORLD_H,col=biomeWater(wx,wy),k=(y*c.width+x)*4;
  for(var i=0;i<rocks.length;i++){var r=rocks[i];if(wx<r.wx0||wx>r.wx1||wy<r.wy0||wy>r.wy1)continue;if(rkField(r,wx-r.ax,wy-r.ay)<0){col=r.tint||RK_TINT[r.z];break;}}
  if(wy>floorAt(wx))col=[19,25,38];im.data[k]=col[0];im.data[k+1]=col[1];im.data[k+2]=col[2];im.data[k+3]=255;
 }g.putImageData(im,0,0);return c;
}
onmessage=function(event){var m=event.data;if(m.type==='init'){FLOOR=new Float32Array(m.floor);CONF.WORLD_W=m.worldW||27200;CONF.WORLD_H=m.worldH||15800;FSTRIP_Y0=CONF.WORLD_H-FSTRIP_H;return;}try{seed=m.seed||1;var c;if(m.type==='cavernRear'){c=newCanvas(m.rock.w*m.scale,m.rock.h*m.scale);var cg=c.getContext('2d'),ci=cg.createImageData(c.width,c.height);fillCavernRearRows(m.rock,ci,0,ci.height);cg.putImageData(ci,0,0);}else if(m.type==='atlas'){c=paintAtlas(m.rocks);}else if(m.type==='rockTile'){c=paintRockTile(m.rock,m.scale);}else if(m.type==='rock'){rkBake(m.rock);c=m.rock.spr;}else{var oldScale=FSTRIP_BS;FSTRIP_BS=m.scale||oldScale;c=paintSeabed(m.x,m.w);FSTRIP_BS=oldScale;}var bitmap=c.transferToImageBitmap();postMessage({id:m.id,bitmap:bitmap},[bitmap]);}catch(error){postMessage({id:m.id,error:String(error)});}};
