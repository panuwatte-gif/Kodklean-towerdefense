// ===== ตั้งค่าคลังเพลง (แก้ที่ไฟล์นี้ไฟล์เดียว) =====
// คลังเพลงนี้ใช้ร่วมกับเกมงู (Kodklean-snake): เพิ่ม/ลบ/ย้ายเพลงที่เกมไหน อีกเกมก็เปลี่ยนตาม
// publishableKey เป็นกุญแจสาธารณะ ใส่ในหน้าเว็บได้ตามปกติ
// ห้ามใส่ service role key / secret key ใด ๆ ในไฟล์นี้เด็ดขาด
window.MUSIC_CONFIG = Object.freeze({
  supabaseUrl: 'https://qxhvmrxbrrweundfspzp.supabase.co',
  publishableKey: 'sb_publishable_Lwu-iFC-U7VWXkEyEO9Azg_4SJmm_J1',
  bucket: 'music',          // ที่เก็บไฟล์เพลงใน Supabase Storage
  folder: 'tracks',         // โฟลเดอร์ย่อยใน bucket
  idPrefix: 'mt_td_',       // รหัสเพลงที่อัปโหลดจากเกมนี้
  maxFileMB: 50,
  timeoutMs: 15000,
  // หมวดเพลง: mode = ชื่อที่เกมใช้, playlistId = เพลย์ลิสต์ในคลัง (ชุดเดียวกับเกมงู)
  categories: Object.freeze([
    Object.freeze({ mode: 'vocal', playlistId: 'pl_merge_vocal', label: 'มีเสียงร้อง', musicType: 'vocal' }),
    Object.freeze({ mode: 'instrumental', playlistId: 'pl_merge_inst', label: 'บรรเลง', musicType: 'instrumental' })
  ])
});
