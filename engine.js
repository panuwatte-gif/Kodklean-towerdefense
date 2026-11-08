(function(root){
const TYPES=[
{name:'เตากะเพรา',icon:'🍳',cost:100,range:155,damage:20,rate:.8,desc:'เร็ว · เป้าหมายเดี่ยว',color:'#e59b54'},
{name:'กระทะยักษ์',icon:'🥘',cost:180,range:125,damage:17,rate:1.25,desc:'ทำงานเป็นกลุ่ม',color:'#cc7658'},
{name:'เตาซูวี',icon:'♨️',cost:220,range:230,damage:65,rate:2.3,desc:'ไกล · เจาะบิลใหญ่',color:'#729ba2'},
{name:'จัดคิว',icon:'📋',cost:140,range:140,damage:0,rate:1,desc:'ชะลอบิล 35%',color:'#8aa777'},
{name:'ชั้นซอส',icon:'🧂',cost:160,range:155,damage:0,rate:1,desc:'ทีมใกล้ ๆ แรง +30%',color:'#c7a35b'},
{name:'แพ็กสายฟ้า',icon:'🛍️',cost:200,range:125,damage:28,rate:.95,desc:'แรง ×2 เมื่อบิลใกล้เสร็จ',color:'#9b88ab'}];
const EVOLVE=[
{name:'กะเพราเพลิงคู่',cost:180,desc:'ลูกไฟ 2 เป้าหมาย'},
{name:'กระทะคลื่นระเบิด',cost:280,desc:'คลื่นไฟรัศมี 120'},
{name:'ซูวีไฮโดรแคนนอน',cost:340,desc:'คลื่นน้ำ 3 เป้าหมาย'},
{name:'หอคอยหยุดเวลา',cost:240,desc:'ชะลอเพิ่ม 15% (สูงสุด 70%) · คลื่นพลังทุก 1.5 วิ'},
{name:'ซอสทริปเปิลแคนนอน',cost:260,desc:'บัฟเพิ่ม 15% · ยิงซอส 3 เป้าหมาย'},
{name:'แพ็กสายฟ้า',cost:300,desc:'สายฟ้า 3 เป้าหมาย'}];
const PATH=[[-35,150],[200,150]];
function curve(cx,cy,x,y){let a=PATH[PATH.length-1];for(let i=1;i<=12;i++){let t=i/12,u=1-t;PATH.push([u*u*a[0]+2*u*t*cx+t*t*x,u*u*a[1]+2*u*t*cy+t*t*y])}}
curve(250,150,250,200);PATH.push([250,315]);curve(250,360,295,360);PATH.push([435,360]);curve(485,360,485,310);PATH.push([485,220]);curve(485,175,530,175);PATH.push([710,175]);curve(760,175,760,225);PATH.push([760,365]);curve(760,410,810,410);PATH.push([895,410]);
const SLOTS=[[165,245],[155,340],[410,210],[335,255],[180,420],[340,440],[570,425],[650,285],[575,265],[860,210],[855,310],[705,465]];
const WAVES=['เปิดครัว รับบิลแรก','มื้อคลีนของชาวออฟฟิศ','โปรตีนล้วนมาไว','โปรโมชันเข้าแล้ว!','บอส · บริษัทสั่ง 20 กล่อง','กะบ่ายยังไม่พัก','XL ยกทีม','ฝนตก ออร์เดอร์แน่น','เร่งส่งก่อนปิดกะ','บอส · พีกเที่ยงครัวแตก'];
const lengths=PATH.slice(1).map((p,i)=>Math.hypot(p[0]-PATH[i][0],p[1]-PATH[i][1]));const total=lengths.reduce((a,b)=>a+b,0);
function point(d){for(let i=0;i<lengths.length;i++){if(d<=lengths[i]){let t=d/lengths[i];return{x:PATH[i][0]+(PATH[i+1][0]-PATH[i][0])*t,y:PATH[i][1]+(PATH[i+1][1]-PATH[i][1])*t}}d-=lengths[i]}return{x:895,y:410}}
class Game{
constructor(){this.gold=360;this.lives=15;this.wave=0;this.served=0;this.score=0;this.combo=0;this.towers=[];this.enemies=[];this.effects=[];this.queue=[];this.active=false;this.ended=false;this.won=false;this.clock=0;this.spawnTimer=0;this.cooldown=0;this.boost=0;this.focus=0;this.freeze=0;this.bonusDamage=1;this.bonusRange=0;this.bonusSpeed=1;this.onEvent=()=>{}}
build(type,slot){if(this.ended||this.towers.some(t=>t.slot===slot)||this.gold<TYPES[type].cost)return false;this.gold-=TYPES[type].cost;this.towers.push({type,slot,x:SLOTS[slot][0],y:SLOTS[slot][1],evolved:false,damageLevel:0,rateLevel:0,timer:0,spent:TYPES[type].cost});return true}
range(t){return TYPES[t.type].range+this.bonusRange+(t.evolved?25:0)+([3,4].includes(t.type)?t.rateLevel*20:0)}
evolve(t){if(this.ended||!this.towers.includes(t)||t.evolved||this.gold<EVOLVE[t.type].cost)return false;this.gold-=EVOLVE[t.type].cost;t.spent+=EVOLVE[t.type].cost;t.evolved=true;t.timer=0;return true}
upgrade(t,kind){if(this.ended||!this.towers.includes(t))return false;let k=kind==='damage'?'damageLevel':'rateLevel';let cost=this.upgradeCost(t,kind);if(t[k]>=3||this.gold<cost)return false;this.gold-=cost;t.spent+=cost;t[k]++;return true}
upgradeCost(t,kind){return Math.round(TYPES[t.type].cost*.55*(1+(kind==='damage'?t.damageLevel:t.rateLevel)*.65))}
sell(t){this.gold+=Math.floor(t.spent*.65);this.towers=this.towers.filter(x=>x!==t)}
startWave(){if(this.active||this.ended||this.wave>=10)return false;this.wave++;this.active=true;this.spawnTimer=.6;let count=7+this.wave*2;this.queue=Array.from({length:count},(_,i)=>({kind:this.wave>2&&i%4===1?'fast':this.wave>5&&i%4===0?'xl':this.wave>=4&&i%5===2?'combo':i%3===0?'swarm':'normal'}));if(this.wave===5||this.wave===10)this.queue.splice(Math.floor(count/2),0,{kind:'boss'});return true}
spawn(kind,d=0){let w=this.wave;let hp=kind==='boss'?650+w*70:kind==='xl'?180+w*24:kind==='fast'?45+w*10:kind==='combo'?115+w*18:70+w*15;let e={kind,hp,max:hp,d,speed:kind==='fast'?88:kind==='boss'?25:kind==='xl'?35:48,reward:kind==='boss'?180:kind==='xl'?35:20,split:false,...point(d)};this.enemies.push(e);return e}
useSkill(chef){if(this.cooldown>0||!this.active||this.ended)return false;this.cooldown=42;if(chef===0)this.boost=8;if(chef===1)this.enemies.forEach(e=>{e.d=Math.max(0,e.d-180);Object.assign(e,point(e.d))});if(chef===2){this.gold+=75;}if(chef===3)this.focus=8;if(chef===4)this.freeze=6;if(chef===5)this.enemies.forEach(e=>{e.hp-=e.kind==='boss'?180:90});this.onEvent('skill');return true}
step(dt){if(this.ended)return;this.clock+=dt;this.effects=this.effects.filter(e=>(e.life-=dt)>0);this.cooldown=Math.max(0,this.cooldown-dt);this.boost=Math.max(0,this.boost-dt);this.focus=Math.max(0,this.focus-dt);this.freeze=Math.max(0,this.freeze-dt);if(!this.active)return;
this.spawnTimer-=dt;if(this.queue.length&&this.spawnTimer<=0){this.spawn(this.queue.shift().kind);this.spawnTimer=this.wave===4||this.wave===8?.62:1.05}
for(const t of this.towers){const def=TYPES[t.type],support=[3,4].includes(t.type);if(support&&!t.evolved)continue;t.timer-=dt;if(t.timer>0)continue;
let targets=this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-t.x,e.y-t.y)<=this.range(t)).sort((a,b)=>b.d-a.d);if(!targets.length)continue;let e=targets[0];
let buff=Math.max(1,...this.towers.filter(s=>s!==t&&s.type===4&&Math.hypot(s.x-t.x,s.y-t.y)<=this.range(s)).map(s=>1.3+s.damageLevel*.12+(s.evolved?.15:0)));
let damage=(t.type===3?12:t.type===4?18:def.damage)*(1+t.damageLevel*.45)*this.bonusDamage*buff*(this.focus>0?1.6:1)*(t.evolved&&!support?1.35:1);
let hits=t.type===1?targets.filter(x=>Math.hypot(x.x-e.x,x.y-e.y)<(t.evolved?120:85)):t.type===3?targets:targets.slice(0,t.evolved?(t.type===0?2:3):1);
for(let hit of hits){hit.hp-=damage*(t.type===5&&hit.hp/hit.max<.35?2:1);this.effects.push({x:t.x,y:t.y,tx:hit.x,ty:hit.y,color:def.color,life:t.evolved?.42:.2,duration:.42,attack:t.evolved?t.type:null})}
t.timer=(t.type===3?1.5:t.type===4?1.4:def.rate)/(1+t.rateLevel*.28)/this.bonusSpeed/(this.boost>0?1.8:1)}
for(const e of [...this.enemies]){if(e.hp<=0){this.enemies.splice(this.enemies.indexOf(e),1);this.gold+=e.reward;this.served++;this.combo++;this.score+=Math.round(e.reward*10*(1+Math.min(20,this.combo)*.025));this.effects.push({kind:'served',x:e.x,y:e.y,life:.75});this.onEvent('serve');continue}if(e.kind==='boss'&&!e.split&&e.hp<e.max*.5){e.split=true;for(let i=0;i<4;i++)this.spawn('fast',Math.max(0,e.d-i*35));this.onEvent('split')}
let slows=this.towers.filter(t=>t.type===3&&Math.hypot(t.x-e.x,t.y-e.y)<=this.range(t));let slow=slows.length?Math.max(.3,.65-Math.max(...slows.map(t=>t.damageLevel*.08+(t.evolved?.15:0)))):1;e.slow=slow<1;e.d+=e.speed*slow*(this.freeze>0?.15:1)*dt;Object.assign(e,point(e.d));if(e.d>=total){this.enemies.splice(this.enemies.indexOf(e),1);this.lives-=e.kind==='boss'?4:1;this.combo=0;this.onEvent('leak')}}
if(this.lives<=0){this.lives=0;this.ended=true;this.onEvent('lose');return}if(!this.queue.length&&!this.enemies.length){this.active=false;this.gold+=50+this.wave*10;if(this.wave===10){this.ended=true;this.won=true;this.score+=this.lives*200;this.onEvent('win')}else this.onEvent('waveEnd')}}}
root.Kitchen={Game,TYPES,EVOLVE,PATH,SLOTS,WAVES,point,total};if(typeof module!=='undefined')module.exports=root.Kitchen;
})(typeof window!=='undefined'?window:globalThis);
