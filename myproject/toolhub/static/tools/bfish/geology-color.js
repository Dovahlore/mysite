/* Shared main/worker palette. Ordinary adjoining rocks share world-space colour. */
function geologyTint(r,x,y,out){
 if(r.ice||r.temple||r.mine||r.glow)return r.tint||(r.ice?[133,184,205]:[81,49,54]);
 var t=Math.max(0,Math.min(1,(y-2800)/4000)),u=Math.max(0,Math.min(1,(y-7200)/4000));t=t*t*(3-2*t);u=u*u*(3-2*u);
 out=out||[0,0,0];out[0]=90+(72-90)*t+(48-72)*u;out[1]=117+(99-117)*t+(68-99)*u;out[2]=106+(112-106)*t+(88-112)*u;return out;
}
