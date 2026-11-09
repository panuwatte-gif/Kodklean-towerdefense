// หน้าต่างหัวหน้ากะ ปุ่มปิดหน้าต่าง และโหมดเต็มจอ (ระบบเพลงย้ายไปอยู่ใน music.js)
$('crewOpen').onclick=()=>$('crewDialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('closeDetail').onclick=()=>{selectedTower=null;update(true)};
async function fullScreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();try{await screen.orientation.lock('landscape')}catch{}}catch{toast('เบราว์เซอร์นี้ไม่รองรับเต็มจอ กรุณาถือเครื่องแนวนอน')}}
$('fullscreen').onclick=()=>{if(document.fullscreenElement){document.exitFullscreen().catch(()=>{});return}fullScreen()};$('rotateFull').onclick=fullScreen;
function orientationLayout(){document.body.classList.toggle('portrait',matchMedia('(orientation: portrait)').matches)}orientationLayout();window.addEventListener('resize',orientationLayout);
