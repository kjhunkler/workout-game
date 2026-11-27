import type { Pose } from './types';
export function arm(pose: Pose, side: number) {
  const [s,e,w] = [pose[11+side],pose[13+side],pose[15+side]];
  if (![s,e,w].every(p=>p && (p.visibility ?? 0) > .45)) return;
  const ax=e.x-s.x, ay=e.y-s.y, bx=w.x-e.x, by=w.y-e.y;
  const length=Math.hypot(ax,ay)*Math.hypot(bx,by);
  if(length < .0004 || (ax*bx+ay*by)/length < .85) return;
  return {x:1-w.x,y:w.y,dx:s.x-w.x,dy:w.y-s.y};
}
export class SpaceRide {
  poses: Pose[]=[];
  seen=0;
  private nextId=0;
  private tracks: {id:number;x:number;y:number;at:number}[]=[];
  private ids:number[]=[];
  accept(poses:Pose[]) {
    const now=performance.now(), available=this.tracks.filter(t=>now-t.at<700);
    this.ids=poses.map(p=>{
      const x=p[11]?.x ?? 0,y=p[11]?.y ?? 0;
      const nearest=available.reduce<typeof available[number]|undefined>((best,t)=>Math.hypot(t.x-x,t.y-y)<.18 && (!best || Math.hypot(t.x-x,t.y-y)<Math.hypot(best.x-x,best.y-y))?t:best,undefined);
      if(nearest){available.splice(available.indexOf(nearest),1);Object.assign(nearest,{x,y,at:now});return nearest.id;}
      const t={id:this.nextId++,x,y,at:now};this.tracks.push(t);return t.id;
    });
    this.tracks=this.tracks.filter(t=>now-t.at<700);this.poses=poses;this.seen=now;
  }
  time=0;
  score=0;
  pointer?: {x:number;y:number};
  charges=new Map<string,number>();
  rocks=Array.from({length:24},()=>({x:Math.random(),y:Math.random(),z:Math.random()}));
  beams: {x:number;y:number;dx:number;dy:number;life:number}[]=[];
  constructor(private canvas:HTMLCanvasElement){}
  draw(dt:number, colors:string[]) {
    this.time+=dt;
    const c=this.canvas.getContext('2d')!, w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    this.canvas.width=w*devicePixelRatio;this.canvas.height=h*devicePixelRatio;
    c.scale(devicePixelRatio,devicePixelRatio);
    const g=c.createRadialGradient(w*.5,h*.4,0,w*.5,h*.5,w);
    g.addColorStop(0,'#242354');g.addColorStop(.5,'#090b25');g.addColorStop(1,'#020411');c.fillStyle=g;c.fillRect(0,0,w,h);
    const cx=w*(.5+Math.sin(this.time*.2)*.12),cy=h*(.4+Math.sin(this.time*.3)*.08);
    c.strokeStyle='#8474ff';c.lineWidth=2;
    for(let i=0;i<36;i++) {const z=((i/36+this.time*.12)%1);const a=i*2.399; c.beginPath();c.moveTo(cx+Math.cos(a)*w*z*z,cy+Math.sin(a)*h*z*z);c.lineTo(cx+Math.cos(a)*w*(z*z+.016),cy+Math.sin(a)*h*(z*z+.016));c.stroke();}
    for(let i=0;i<18;i++){const z=(i/18+this.time*.18)%1;c.strokeStyle=`rgba(70,215,255,${z*.6})`;c.beginPath();c.ellipse(cx,cy+h*z*z,w*z*z*.7,h*z*z*.3,Math.sin(this.time*.2)*.15,0,Math.PI*2);c.stroke();}
    const projected=this.rocks.map(r=>{r.z+=dt*.08;if(r.z>1){r.z=.02;r.x=Math.random();r.y=Math.random();}return {r,x:cx+(r.x-.5)*w*r.z*2,y:cy+(r.y-.5)*h*r.z*2,size:12+45*r.z};});
    for(const p of projected){c.fillStyle='#706480';c.strokeStyle='#c1a9c9';c.lineWidth=2;c.beginPath();for(let i=0;i<9;i++){const a=i/9*Math.PI*2+this.time*.1;const radius=p.size*(i%2?.8:1);const x=p.x+Math.cos(a)*radius,y=p.y+Math.sin(a)*radius;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();c.stroke();}
    const aims:{key:string;x:number;y:number;dx:number;dy:number;color:string}[]=[];
    if(performance.now()-this.seen<350) this.poses.forEach((p,index)=>{for(let side=0;side<2;side++){const a=arm(p,side);if(a)aims.push({...a,key:`${this.ids[index]}:${side}`,color:colors[this.ids[index]%colors.length]||colors[0]});}});
    if(this.pointer) aims.push({key:'pointer',x:.5,y:.9,dx:this.pointer.x-.5,dy:this.pointer.y-.9,color:colors[0]});
    const present=new Set<string>();
    for(const a of aims){present.add(a.key);const x=a.x*w,y=a.y*h,len=Math.max(.001,Math.hypot(a.dx*w,a.dy*h)),dx=a.dx*w/len,dy=a.dy*h/len;
      const charge=(this.charges.get(a.key)||0)+dt;this.charges.set(a.key,charge);
      c.strokeStyle=a.color;c.lineWidth=2;c.setLineDash([8,12]);c.beginPath();c.moveTo(x,y);c.lineTo(x+dx*w*2,y+dy*w*2);c.stroke();c.setLineDash([]);
      c.lineWidth=6;c.beginPath();c.arc(x,y,20,-Math.PI/2,-Math.PI/2+Math.min(1,charge)*Math.PI*2);c.stroke();
      if(charge>=1){this.charges.set(a.key,0);this.beams.push({x,y,dx,dy,life:.22});for(const p of projected){const vx=p.x-x,vy=p.y-y;if(vx*dx+vy*dy>0 && Math.abs(vx*dy-vy*dx)<p.size+20){p.r.z=0;this.score+=100;}}}
    }
    for(const key of this.charges.keys())if(!present.has(key))this.charges.delete(key);
    this.beams=this.beams.filter(b=>(b.life-=dt)>0);for(const b of this.beams){c.strokeStyle='#bdffff';c.shadowColor='#54eaff';c.shadowBlur=24;c.lineWidth=10;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x+b.dx*w*2,b.y+b.dy*w*2);c.stroke();}c.shadowBlur=0;
    c.fillStyle='white';c.font='600 26px Outfit';c.fillText(`✦ ${this.score}`,24,85);
  }
}
