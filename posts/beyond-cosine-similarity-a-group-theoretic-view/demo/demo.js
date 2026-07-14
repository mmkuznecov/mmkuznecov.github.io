(() => {
  const C = {
    bg: '#0e1116', panel: '#151a21', line: '#222a35', fg: '#d7dde6', muted: '#8a94a3',
    accent: '#4aa3ff', accent2: '#e0a458', green: '#2a9d8f', red: '#d1495b', purple: '#c792ea', cyan: '#56b4d3'
  };

  class RNG {
    constructor(seed = 123456789) { this.s = seed >>> 0; }
    next() { this.s = (1664525 * this.s + 1013904223) >>> 0; return this.s / 4294967296; }
    normal() {
      const u1 = Math.max(1e-12, this.next()), u2 = this.next();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
  }

  const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
  const norm = a => Math.sqrt(dot(a,a));
  const cosine = (a,b) => { const d=norm(a)*norm(b); return d ? dot(a,b)/d : 0; };
  const decos = (a,b) => { const d=.5*(dot(a,a)+dot(b,b)); return d ? dot(a,b)/d : 0; };
  const recos = (a,b) => {
    const s=dot(a,b); if (Math.abs(s)<1e-14) return 0;
    const as=[...a].sort((x,y)=>x-y), bs=[...b].sort((x,y)=>x-y);
    const maxD=dot(as,bs), minD=dot(as,[...bs].reverse());
    const den=s>0?Math.abs(maxD):Math.abs(minD);
    return den>1e-14?s/den:0;
  };
  const fmt = x => (Math.abs(x)<1e-10?'0.000':x.toFixed(3));

  function shell(root, title, note) {
    root.innerHTML = `<section class="interactive-card"><div class="interactive-head"><div><h4>${title}</h4><p>${note}</p></div></div><div class="interactive-controls"></div><canvas></canvas><div class="interactive-readout"></div></section>`;
    const card=root.querySelector('.interactive-card'), controls=card.querySelector('.interactive-controls'), canvas=card.querySelector('canvas'), readout=card.querySelector('.interactive-readout');
    const ctx=canvas.getContext('2d');
    function resize(h=350){ const w=Math.max(320,Math.floor(card.clientWidth-2)); const dpr=window.devicePixelRatio||1; canvas.style.width=w+'px'; canvas.style.height=h+'px'; canvas.width=Math.floor(w*dpr); canvas.height=Math.floor(h*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); return {w,h}; }
    return {card,controls,canvas,ctx,readout,resize};
  }
  function addSelect(parent,label,options,value,onChange){ const wrap=document.createElement('label'); wrap.className='control'; wrap.innerHTML=`<span>${label}</span>`; const s=document.createElement('select'); options.forEach(o=>{const op=document.createElement('option'); op.value=o.value;op.textContent=o.label;if(o.value===value)op.selected=true;s.appendChild(op)}); s.addEventListener('change',()=>onChange(s.value)); wrap.appendChild(s); parent.appendChild(wrap); return s; }
  function addSlider(parent,label,min,max,step,value,format,onInput){ const wrap=document.createElement('label'); wrap.className='control'; const top=document.createElement('span'); top.innerHTML=`${label} <b>${format(value)}</b>`; const inp=document.createElement('input'); inp.type='range'; inp.min=min;inp.max=max;inp.step=step;inp.value=value; inp.addEventListener('input',()=>{top.querySelector('b').textContent=format(+inp.value);onInput(+inp.value)}); wrap.append(top,inp); parent.appendChild(wrap); return inp; }
  function addButton(parent,text,onClick){ const b=document.createElement('button'); b.type='button'; b.textContent=text; b.addEventListener('click',onClick); parent.appendChild(b); return b; }
  function clear(ctx,w,h){ ctx.fillStyle=C.panel; ctx.fillRect(0,0,w,h); }
  function line(ctx,x1,y1,x2,y2,col=C.line,lw=1){ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function text(ctx,s,x,y,col=C.muted,size=12,align='left'){ctx.fillStyle=col;ctx.font=`${size}px JetBrains Mono, monospace`;ctx.textAlign=align;ctx.fillText(s,x,y);}

  function metricPlayground(root){
    const ui=shell(root,'Metric playground','Change the relationship between two coordinate vectors. Recos saturates on ordinal agreement, cosine on proportionality.');
    let preset='monotone', power=3, noise=0, scale=1.2, perm=0;
    const base=[-1.5,-.8,-.2,.4,1.1,1.7], eps=[.55,-.3,.2,-.45,.32,-.18];
    addSelect(ui.controls,'relation',[{label:'linear',value:'linear'},{label:'monotone nonlinear',value:'monotone'},{label:'coordinate permutation',value:'perm'},{label:'decreasing nonlinear',value:'anti'},{label:'independent',value:'random'}],preset,v=>{preset=v;draw()});
    addSlider(ui.controls,'power',1,5,.1,power,v=>v.toFixed(1),v=>{power=v;draw()});
    addSlider(ui.controls,'noise',0,1,.02,noise,v=>v.toFixed(2),v=>{noise=v;draw()});
    addSlider(ui.controls,'scale',.2,2.5,.05,scale,v=>v.toFixed(2),v=>{scale=v;draw()});
    addSlider(ui.controls,'permutation',0,5,1,perm,v=>String(v|0),v=>{perm=v|0;draw()});
    const perms=[[0,1,2,3,4,5],[2,0,5,1,4,3],[5,4,3,2,1,0],[1,3,5,0,2,4],[4,2,0,5,3,1],[3,5,1,4,0,2]];
    function vectors(){
      let v;
      if(preset==='linear') v=base.map(x=>scale*x);
      else if(preset==='monotone') v=base.map((x,i)=>scale*Math.sign(x)*Math.pow(Math.abs(x),power)+noise*eps[i]);
      else if(preset==='anti') v=base.map((x,i)=>-scale*Math.sign(x)*Math.pow(Math.abs(x),power)+noise*eps[i]);
      else if(preset==='perm') v=perms[perm].map(i=>scale*base[i]+noise*eps[i]);
      else v=base.map((_,i)=>scale*[.25,-1.1,.8,-.5,1.35,-.15][i]+noise*eps[i]);
      return [base,v];
    }
    function draw(){
      const {w,h}=ui.resize(360),ctx=ui.ctx; clear(ctx,w,h); const [u,v]=vectors();
      const left=45,right=w*.62,top=34,bottom=270; const maxVal=Math.max(2.2,...u.map(Math.abs),...v.map(Math.abs)); const zero=(top+bottom)/2, sy=(bottom-top)/(2*maxVal); const barW=Math.max(9,(right-left)/(u.length*2.7));
      line(ctx,left,zero,right,zero,C.line,1.2);
      u.forEach((x,i)=>{const cx=left+(i+.55)*(right-left)/u.length; ctx.fillStyle=C.accent; ctx.fillRect(cx-barW-2,zero-Math.max(0,x*sy),barW,Math.abs(x*sy)); ctx.fillStyle=C.accent2; ctx.fillRect(cx+2,zero-Math.max(0,v[i]*sy),barW,Math.abs(v[i]*sy)); text(ctx,String(i+1),cx,292,C.muted,10,'center');});
      text(ctx,'coordinate values',left,20,C.fg,12); text(ctx,'u',left,315,C.accent,11); text(ctx,'v',left+35,315,C.accent2,11);
      const scores=[['decos',decos(u,v),C.muted],['cosine',cosine(u,v),C.accent],['recos',recos(u,v),C.green]]; const x0=w*.69, y0=68, bw=Math.max(65,w*.25);
      scores.forEach((q,j)=>{text(ctx,q[0],x0,y0+j*78,C.fg,12); ctx.strokeStyle=C.line;ctx.strokeRect(x0,y0+12+j*78,bw,20);ctx.fillStyle=q[2];const val=q[1];ctx.fillRect(x0+bw/2,y0+12+j*78,val*bw/2,20);line(ctx,x0+bw/2,y0+8+j*78,x0+bw/2,y0+36+j*78,C.muted,1);text(ctx,fmt(val),x0+bw+8,y0+29+j*78,q[2],11);});
      const orderU=[...u.keys()].sort((i,j)=>u[i]-u[j]).map(i=>i+1).join(' < '); const orderV=[...v.keys()].sort((i,j)=>v[i]-v[j]).map(i=>i+1).join(' < ');
      ui.readout.innerHTML=`<b>u order:</b> ${orderU}<br><b>v order:</b> ${orderV}<br><b>dot:</b> ${fmt(dot(u,v))}`;
    }
    new ResizeObserver(draw).observe(ui.card); draw();
  }

  function orbitLab(root){
    const ui=shell(root,'Orbit-normalization laboratory','The observed dot product is divided by the best alignment available under the chosen transformation group.');
    let angle=28, spread=1;
    addSlider(ui.controls,'direction of u',0,360,1,angle,v=>`${v|0}°`,v=>{angle=v;draw()});
    addSlider(ui.controls,'orbit anisotropy',.4,1.8,.02,spread,v=>v.toFixed(2),v=>{spread=v;draw()});
    function draw(){
      const {w,h}=ui.resize(350),ctx=ui.ctx; clear(ctx,w,h); const mid=w/2; const cy=170; const rad=Math.min(110,w*.18); const a=angle*Math.PI/180;
      text(ctx,'O(d): sphere orbit',mid*.5,24,C.fg,12,'center'); text(ctx,'S₃: permutation orbit',mid*1.5,24,C.fg,12,'center'); line(ctx,mid,20,mid,h-20,C.line,1);
      // sphere
      ctx.strokeStyle=C.muted;ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(mid*.5,cy,rad,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
      const ux=Math.cos(a),uy=-Math.sin(a); line(ctx,mid*.5,cy,mid*.5+ux*rad*1.25,cy+uy*rad*1.25,C.accent,3); line(ctx,mid*.5,cy,mid*.5+ux*rad,cy+uy*rad,C.green,5); text(ctx,'u',mid*.5+ux*rad*1.38,cy+uy*rad*1.38,C.accent,12,'center');
      text(ctx,'denominator = ||u|| ||v||',mid*.5,h-34,C.muted,10,'center');
      // hex permutohedron
      const cx=mid*1.5, rr=rad; const pts=[]; for(let k=0;k<6;k++){const t=Math.PI/6+k*Math.PI/3;pts.push([cx+rr*Math.cos(t)*(1+.18*spread*Math.sin(2*t)),cy+rr*Math.sin(t)*(1-.10*spread*Math.cos(3*t))]);}
      ctx.strokeStyle=C.muted;ctx.lineWidth=2;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();
      pts.forEach(p=>{ctx.fillStyle=C.accent2;ctx.beginPath();ctx.arc(p[0],p[1],5,0,2*Math.PI);ctx.fill();});
      let best=0,bestProj=-Infinity;pts.forEach((p,i)=>{const pr=(p[0]-cx)*ux+(p[1]-cy)*uy;if(pr>bestProj){bestProj=pr;best=i;}}); ctx.strokeStyle=C.green;ctx.lineWidth=3;ctx.beginPath();ctx.arc(pts[best][0],pts[best][1],10,0,2*Math.PI);ctx.stroke(); line(ctx,cx,cy,cx+ux*rad*1.25,cy+uy*rad*1.25,C.accent,3);
      text(ctx,'best permutation',pts[best][0],pts[best][1]-16,C.green,10,'center'); text(ctx,'denominator = support of permutohedron',cx,h-34,C.muted,10,'center');
      const sphereDen=rad, permDen=bestProj; ui.readout.innerHTML=`The permutation group is a subset of the orthogonal group, so its orbit maximum is no larger. In this projection: <b>sphere support ${sphereDen.toFixed(1)}</b>, <b>permutation support ${permDen.toFixed(1)}</b>.`;
    }
    new ResizeObserver(draw).observe(ui.card); draw();
  }

  function rotationLab(root){
    const ui=shell(root,'Basis-rotation test','Rotate both vectors by the same orthogonal map. Cosine is unchanged; recos generally is not.');
    let angle=0; addSlider(ui.controls,'common rotation',0,360,1,angle,v=>`${v|0}°`,v=>{angle=v;draw()});
    const u0=[2.2,.4,-1.5],v0=[1.5,-.3,-.9];
    function rotate(t,x){const c=Math.cos(t),s=Math.sin(t);return[c*x[0]-s*x[1],s*x[0]+c*x[1],x[2]];}
    const curve=[];for(let i=0;i<=360;i++){const t=i*Math.PI/180;curve.push(recos(rotate(t,u0),rotate(t,v0)));}
    function draw(){
      const {w,h}=ui.resize(360),ctx=ui.ctx; clear(ctx,w,h); const t=angle*Math.PI/180,u=rotate(t,u0),v=rotate(t,v0),c=cosine(u,v),r=recos(u,v);
      const split=w*.42,zero=160,sy=48; line(ctx,split,20,split,h-30,C.line,1);
      text(ctx,'rotated coordinates',split*.5,24,C.fg,12,'center'); for(let i=0;i<3;i++){const x=55+i*(split-90)/2;ctx.fillStyle=C.accent;ctx.fillRect(x-18,zero-Math.max(0,u[i]*sy),14,Math.abs(u[i]*sy));ctx.fillStyle=C.accent2;ctx.fillRect(x+4,zero-Math.max(0,v[i]*sy),14,Math.abs(v[i]*sy));text(ctx,String(i+1),x,292,C.muted,10,'center');} line(ctx,32,zero,split-20,zero,C.line,1);
      const x0=split+42,x1=w-28,y0=48,y1=278; line(ctx,x0,y1,x1,y1,C.line,1); line(ctx,x0,y0,x0,y1,C.line,1); const ymin=Math.min(...curve)-.03,ymax=1.01; const xp=d=>x0+(x1-x0)*d/360, yp=s=>y1-(y1-y0)*(s-ymin)/(ymax-ymin);
      ctx.strokeStyle=C.green;ctx.lineWidth=2;ctx.beginPath();curve.forEach((q,i)=>i?ctx.lineTo(xp(i),yp(q)):ctx.moveTo(xp(i),yp(q)));ctx.stroke(); line(ctx,x0,yp(c),x1,yp(c),C.accent,2); ctx.fillStyle=C.accent2;ctx.beginPath();ctx.arc(xp(angle),yp(r),5,0,2*Math.PI);ctx.fill();
      text(ctx,'0°',x0,y1+18,C.muted,10,'center');text(ctx,'180°',xp(180),y1+18,C.muted,10,'center');text(ctx,'360°',x1,y1+18,C.muted,10,'center');text(ctx,'similarity over common rotation',x0,24,C.fg,12);
      ui.readout.innerHTML=`<b>cosine:</b> ${fmt(c)} (constant) &nbsp; <b>recos:</b> ${fmt(r)} &nbsp; <b>recos range:</b> ${fmt(Math.min(...curve))}–${fmt(Math.max(...curve))}`;
    }
    new ResizeObserver(draw).observe(ui.card); draw();
  }

  function randomLab(root){
    const ui=shell(root,'Random-vector laboratory','Compare score distributions under independence, linear correlation, and nonlinear monotone dependence.');
    let d=16,relation='independent',strength=.7,seed=15;
    addSelect(ui.controls,'relation',[{label:'independent Gaussian',value:'independent'},{label:'correlated Gaussian',value:'linear'},{label:'monotone cubic + noise',value:'cubic'}],relation,v=>{relation=v;draw()});
    addSlider(ui.controls,'dimension',2,64,2,d,v=>String(v|0),v=>{d=v|0;draw()});
    addSlider(ui.controls,'signal strength',0,1,.02,strength,v=>v.toFixed(2),v=>{strength=v;draw()});
    addButton(ui.controls,'resample',()=>{seed+=17;draw()});
    function sample(){const rng=new RNG(seed),n=1200,Cs=[],Rs=[];for(let k=0;k<n;k++){const u=[],v=[];for(let i=0;i<d;i++){const x=rng.normal(),z=rng.normal();u.push(x);if(relation==='independent')v.push(z);else if(relation==='linear')v.push(strength*x+Math.sqrt(Math.max(0,1-strength*strength))*z);else v.push(strength*Math.sign(x)*Math.pow(Math.abs(x),3)+(1-strength)*z);}Cs.push(cosine(u,v));Rs.push(recos(u,v));}return[Cs,Rs];}
    function hist(vals,bins,min,max){const h=new Array(bins).fill(0);vals.forEach(x=>{let i=Math.floor((x-min)/(max-min)*bins);i=Math.max(0,Math.min(bins-1,i));h[i]++;});return h;}
    function mean(a){return a.reduce((s,x)=>s+x,0)/a.length;} function sd(a){const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)*(x-m))));}
    function draw(){const {w,h}=ui.resize(360),ctx=ui.ctx;clear(ctx,w,h);const [cs,rs]=sample();const bins=54,min=-1,max=1,hc=hist(cs,bins,min,max),hr=hist(rs,bins,min,max),mx=Math.max(...hc,...hr);const x0=48,x1=w-24,y0=40,y1=285;line(ctx,x0,y1,x1,y1,C.line,1);line(ctx,x0,y0,x0,y1,C.line,1);const bw=(x1-x0)/bins;for(let i=0;i<bins;i++){ctx.fillStyle=C.accent;ctx.globalAlpha=.45;ctx.fillRect(x0+i*bw,y1-hc[i]/mx*(y1-y0),bw, hc[i]/mx*(y1-y0));ctx.fillStyle=C.green;ctx.globalAlpha=.35;ctx.fillRect(x0+i*bw,y1-hr[i]/mx*(y1-y0),bw,hr[i]/mx*(y1-y0));}ctx.globalAlpha=1;text(ctx,'-1',x0,y1+18,C.muted,10,'center');text(ctx,'0',(x0+x1)/2,y1+18,C.muted,10,'center');text(ctx,'1',x1,y1+18,C.muted,10,'center');text(ctx,'cosine',x0,22,C.accent,11);text(ctx,'recos',x0+85,22,C.green,11);ui.readout.innerHTML=`<b>cosine:</b> mean ${fmt(mean(cs))}, sd ${fmt(sd(cs))} &nbsp; <b>recos:</b> mean ${fmt(mean(rs))}, sd ${fmt(sd(rs))}`;}
    new ResizeObserver(draw).observe(ui.card);draw();
  }

  const STS={
    datasets:['STS12','STS13','STS14','STS15','STS16','STS-B','SICK-R'],
    models:{
      'Word2Vec':{cos:[52.78,70.12,65.74,75.54,67.69,64.51,58.00],recos:[52.80,70.14,65.77,75.55,67.69,64.53,58.06]},
      'FastText':{cos:[58.55,71.66,65.23,74.03,64.49,63.99,56.62],recos:[58.55,71.98,65.58,74.37,64.79,64.32,56.71]},
      'GloVe':{cos:[57.49,70.99,60.70,70.85,63.84,50.74,55.42],recos:[57.68,71.37,61.44,71.09,64.14,51.29,55.62]},
      'BERT':{cos:[72.52,78.05,73.86,79.48,74.47,76.74,73.54],recos:[72.52,78.30,74.01,79.66,74.57,76.82,73.64]},
      'SGPT':{cos:[66.44,70.13,63.71,75.54,71.75,72.89,68.00],recos:[66.54,70.15,63.79,75.58,71.75,72.92,68.08]},
      'DPR':{cos:[47.96,63.97,53.22,67.25,66.70,58.53,62.45],recos:[49.09,64.11,53.74,67.40,67.28,59.22,63.78]},
      'E5':{cos:[60.42,70.00,65.30,74.92,77.43,73.53,68.86],recos:[60.70,70.16,65.44,75.05,77.44,73.57,68.93]},
      'BGE':{cos:[49.97,32.19,33.64,35.01,63.81,65.61,57.94],recos:[50.28,31.88,33.82,35.12,63.94,65.71,57.99]},
      'GTE':{cos:[74.82,86.64,78.76,85.39,83.10,85.42,75.72],recos:[75.00,86.77,78.98,85.50,83.17,85.45,75.72]},
      'SPECTER':{cos:[62.49,58.70,54.87,62.54,64.28,61.26,56.39],recos:[63.01,59.70,55.45,63.10,64.47,61.50,56.71]},
      'CLIP-ViT':{cos:[76.92,63.96,57.98,66.19,72.41,65.29,70.53],recos:[77.39,64.81,59.34,67.55,72.78,66.53,71.61]}
    }
  };
  function stsLab(root){
    const ui=shell(root,'Reported STS results explorer','Values transcribed from Table 1 of the paper. Select an embedding model to inspect the size and consistency of the gain.');
    let model='CLIP-ViT'; addSelect(ui.controls,'embedding model',Object.keys(STS.models).map(x=>({label:x,value:x})),model,v=>{model=v;draw()});
    function draw(){const {w,h}=ui.resize(360),ctx=ui.ctx;clear(ctx,w,h);const d=STS.models[model],n=STS.datasets.length,x0=58,x1=w-22,y0=38,y1=282,yMin=Math.min(...d.cos,...d.recos)-3,yMax=Math.max(...d.cos,...d.recos)+2,bw=(x1-x0)/n*.28;const xp=i=>x0+(i+.5)*(x1-x0)/n,yp=v=>y1-(v-yMin)/(yMax-yMin)*(y1-y0);line(ctx,x0,y1,x1,y1,C.line,1);line(ctx,x0,y0,x0,y1,C.line,1);for(let i=0;i<n;i++){const x=xp(i);ctx.fillStyle=C.accent;ctx.fillRect(x-bw-2,yp(d.cos[i]),bw,y1-yp(d.cos[i]));ctx.fillStyle=C.green;ctx.fillRect(x+2,yp(d.recos[i]),bw,y1-yp(d.recos[i]));text(ctx,STS.datasets[i],x,y1+18,C.muted,9,'center');text(ctx,(d.recos[i]-d.cos[i]>=0?'+':'')+(d.recos[i]-d.cos[i]).toFixed(2),x,yp(Math.max(d.cos[i],d.recos[i]))-7,C.accent2,9,'center');}text(ctx,'cosine',x0,20,C.accent,11);text(ctx,'recos',x0+80,20,C.green,11);const gains=d.recos.map((x,i)=>x-d.cos[i]),avg=gains.reduce((a,b)=>a+b,0)/n;ui.readout.innerHTML=`<b>${model}</b>: mean gain <b>${avg>=0?'+':''}${avg.toFixed(2)}</b> Spearman points; wins ${gains.filter(x=>x>0).length}, ties ${gains.filter(x=>Math.abs(x)<1e-9).length}, losses ${gains.filter(x=>x<0).length}.`;}
    new ResizeObserver(draw).observe(ui.card);draw();
  }

  const registry={'metric-playground':metricPlayground,'orbit-lab':orbitLab,'rotation-lab':rotationLab,'random-lab':randomLab,'sts-lab':stsLab};
  document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-demo]').forEach(root=>{const fn=registry[root.dataset.demo];if(fn)fn(root);});});
})();
