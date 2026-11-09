// Local playback only: no account key or upload is needed.
const bgm=new Audio();bgm.loop=true;bgm.preload='none';bgm.volume=.4;
let tracks=[],musicMode='off',activeTrack='',playIntent=false,musicRequest=0;
window.audioMuted=true;
try{tracks=JSON.parse(localStorage.getItem('kk-tracks')||'[]').filter(t=>t&&['vocal','instrumental'].includes(t.kind)&&/^https:\/\//.test(t.url));}catch{}
function saveTracks(){try{localStorage.setItem('kk-tracks',JSON.stringify(tracks.filter(t=>!t.local)))}catch{toast('บันทึกลิงก์ไม่ได้ แต่ยังเล่นได้ในครั้งนี้')}}
function musicStatus(s){$('musicStatus').textContent=s}
function trackOptions(){const list=tracks.filter(t=>t.kind===musicMode);$('trackSelect').replaceChildren();for(const t of list){let o=document.createElement('option');o.value=t.id;o.textContent=t.name;$('trackSelect').append(o)}if(!list.some(t=>t.id===activeTrack))activeTrack=list[0]?.id||'';$('trackSelect').value=activeTrack;$('trackSelect').disabled=!list.length;$('musicPlay').disabled=!list.length||musicMode==='off';$('removeTrack').disabled=!activeTrack;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('chosen',b.dataset.mode===musicMode));}
async function playTrack(){const request=++musicRequest;bgm.pause();const t=tracks.find(t=>t.id===activeTrack);if(musicMode==='off'||!t){playIntent=false;musicStatus(musicMode==='off'?'ปิดเพลงและเอฟเฟกต์ทั้งหมด':'ยังไม่มีเพลงประเภทนี้ กด “เพิ่มเพลง” ด้านล่าง');return}if(bgm.getAttribute('src')!==t.url){bgm.src=t.url;bgm.load()}playIntent=true;musicStatus('กำลังเปิด '+t.name);try{await bgm.play();if(request!==musicRequest)return;musicStatus('กำลังเล่น: '+t.name)}catch(e){if(request!==musicRequest)return;playIntent=false;musicStatus(e.name==='NotAllowedError'?'แตะ “เล่น / พักเพลง” เพื่อเริ่มเสียง':'เปิดเพลงไม่ได้ ตรวจลิงก์ สิทธิ์เข้าถึง และชนิดไฟล์เสียง')}}
function setMode(mode){musicMode=mode;window.audioMuted=mode==='off';if(mode==='off'){sound=false;$('sfx').checked=false}trackOptions();playTrack()}
$('sound').onclick=()=>{$('musicDialog').showModal();trackOptions()};
$('crewOpen').onclick=()=>$('crewDialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('closeDetail').onclick=()=>{selectedTower=null;update(true)};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('trackSelect').onchange=()=>{activeTrack=$('trackSelect').value;playTrack()};
$('musicPlay').onclick=()=>{if(!bgm.paused){playIntent=false;++musicRequest;bgm.pause();musicStatus('พักเพลงแล้ว')}else playTrack()};
$('volume').oninput=()=>{bgm.volume=Number($('volume').value)};
$('sfx').onchange=()=>{sound=$('sfx').checked;if(sound){window.audioMuted=false;if(musicMode==='off'){musicMode='instrumental';trackOptions();musicStatus('เปิดเอฟเฟกต์เกม · เลือกเพลงเพื่อเปิดเพลงประกอบ')}beep()}};
$('addTrack').onsubmit=e=>{e.preventDefault();let url;try{url=new URL($('trackUrl').value);if(url.protocol!=='https:')throw Error()}catch{musicStatus('กรุณาใส่ลิงก์ HTTPS ของไฟล์เสียงโดยตรง');return}const t={id:crypto.randomUUID(),name:$('trackName').value.trim()||'เพลงใหม่',kind:$('trackKind').value,url:url.href};tracks.push(t);saveTracks();activeTrack=t.id;setMode(t.kind);$('trackUrl').value='';$('trackName').value=''};
$('trackFile').onchange=()=>{let first;for(const f of $('trackFile').files){const t={id:crypto.randomUUID(),name:f.name,kind:$('trackKind').value,url:URL.createObjectURL(f),local:true};tracks.push(t);first??=t}if(first){activeTrack=first.id;setMode(first.kind)}$('trackFile').value=''};
$('removeTrack').onclick=()=>{const t=tracks.find(t=>t.id===activeTrack);bgm.pause();if(t?.local)URL.revokeObjectURL(t.url);tracks=tracks.filter(t=>t.id!==activeTrack);activeTrack='';saveTracks();trackOptions();playTrack()};
bgm.addEventListener('error',()=>{playIntent=false;musicStatus('โหลดเพลงไม่ได้ ตรวจว่าลิงก์เปิดฟังได้และยังไม่หมดอายุ')});
document.addEventListener('visibilitychange',()=>{if(document.hidden){bgm.pause()}else if(playIntent&&musicMode!=='off')bgm.play().catch(()=>musicStatus('แตะเล่นเพลงเพื่อฟังต่อ'))});
async function fullScreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();try{await screen.orientation.lock('landscape')}catch{}}catch{toast('เบราว์เซอร์นี้ไม่รองรับเต็มจอ กรุณาถือเครื่องแนวนอน')}}
$('fullscreen').onclick=()=>{if(document.fullscreenElement){document.exitFullscreen().catch(()=>{});return}fullScreen()};$('rotateFull').onclick=fullScreen;
function orientationLayout(){document.body.classList.toggle('portrait',matchMedia('(orientation: portrait)').matches)}orientationLayout();window.addEventListener('resize',orientationLayout);
// Optional shared playlist bundled with the deployment. Only public HTTPS audio URLs.
fetch('music.json').then(r=>r.ok?r.json():[]).then(list=>{for(const t of list){if(t&&['vocal','instrumental'].includes(t.kind)&&typeof t.url==='string'&&t.url.startsWith('https://')&&!tracks.some(x=>x.url===t.url))tracks.push({id:crypto.randomUUID(),name:String(t.name||'เพลงครัว'),kind:t.kind,url:t.url})}trackOptions()}).catch(()=>{});
