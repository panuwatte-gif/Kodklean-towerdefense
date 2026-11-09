// ===== คลังเพลงกลาง (Supabase) : อ่าน / เพิ่ม / ลบ / เปลี่ยนชื่อ / ย้ายหมวด =====
// ไฟล์นี้คุยกับคลังเพลงอย่างเดียว ไม่ยุ่งกับหน้าจอ (หน้าจออยู่ใน music.js)
(function () {
  'use strict';
  const C = window.MUSIC_CONFIG;
  const enc = encodeURIComponent;
  const SAFE_PATH = /^[A-Za-z0-9._/-]+$/;
  const EXT_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', flac: 'audio/flac' };
  const TYPE_EXT = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/flac': 'flac', 'audio/x-flac': 'flac' };

  function category(mode) {
    const c = C.categories.find(c => c.mode === mode);
    if (!c) throw new Error('ไม่รู้จักหมวดเพลงนี้');
    return c;
  }

  function friendly(status, data) {
    const detail = data && (data.message || data.error || data.msg) || '';
    if (status === 401 || status === 403) return 'คลังเพลงไม่อนุญาตให้แก้ไขตอนนี้';
    if (status === 413 || /too large|exceeded/i.test(detail)) return 'ไฟล์ใหญ่เกินที่คลังเพลงรับได้';
    if (status === 409 || /exists|duplicate/i.test(detail)) return 'มีเพลงนี้อยู่ในคลังแล้ว';
    return 'คลังเพลงตอบกลับผิดพลาด (รหัส ' + status + ')';
  }

  async function request(path, opt = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opt.timeout || C.timeoutMs);
    let r;
    try {
      r = await fetch(C.supabaseUrl + path, {
        method: opt.method || 'GET',
        headers: Object.assign({ apikey: C.publishableKey }, opt.headers),
        body: opt.body,
        signal: ctrl.signal,
        cache: 'no-store'
      });
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'คลังเพลงตอบช้าเกินไป ลองใหม่อีกครั้ง' : 'เชื่อมต่อคลังเพลงไม่ได้ ตรวจอินเทอร์เน็ต');
    } finally {
      clearTimeout(timer);
    }
    const text = await r.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!r.ok) throw new Error(friendly(r.status, data));
    return data;
  }

  const rest = (query, opt) => request('/rest/v1/' + query, opt);
  const send = (method, body, prefer) => ({ method, headers: { 'Content-Type': 'application/json', Prefer: prefer || 'return=representation' }, body: JSON.stringify(body) });
  const publicUrl = path => C.supabaseUrl + '/storage/v1/object/public/' + C.bucket + '/' + path;
  const safePath = p => typeof p === 'string' && SAFE_PATH.test(p) && !p.startsWith('/') && !p.includes('..');

  function newId() {
    const raw = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return C.idPrefix + raw.replace(/[^A-Za-z0-9]/g, '');
  }

  // ---------- อ่านคลัง ----------
  async function load() {
    const [maps, rows] = await Promise.all([
      rest('kk_music_playlist_track?select=playlist_id,track_id,sort_order&order=sort_order,id'),
      rest('music_tracks?select=id,title,artist,url,storage_path,duration_seconds&active=eq.true&order=created_at')
    ]);
    const tracks = (Array.isArray(rows) ? rows : [])
      .filter(t => t && typeof t.id === 'string' && typeof t.url === 'string' && t.url.startsWith('https://') && !/(?:\/sfx\/|\/sfx_)/i.test(t.url))
      .map(t => ({ id: t.id, title: String(t.title || 'ไม่มีชื่อ'), artist: String(t.artist || ''), url: t.url, storagePath: t.storage_path || null, duration: t.duration_seconds || null }));
    const byId = new Map(tracks.map(t => [t.id, t]));
    const lists = {};
    for (const c of C.categories) lists[c.mode] = [];
    const mapped = new Set();
    for (const m of (Array.isArray(maps) ? maps : [])) {
      if (!m) continue;
      mapped.add(m.track_id);
      const c = C.categories.find(c => c.playlistId === m.playlist_id);
      const t = byId.get(m.track_id);
      if (c && t && !lists[c.mode].includes(t)) lists[c.mode].push(t);
    }
    // เพลงที่อยู่ในคลังแต่ยังไม่อยู่ในเพลย์ลิสต์ไหนเลย
    const unassigned = tracks.filter(t => !mapped.has(t.id));
    return { lists, unassigned };
  }

  async function nextSort(playlistId) {
    const r = await rest('kk_music_playlist_track?select=sort_order&playlist_id=eq.' + enc(playlistId) + '&order=sort_order.desc&limit=1');
    return ((r && r[0] && r[0].sort_order) ?? -1) + 1;
  }

  // ---------- เพิ่มเพลง ----------
  function fileKind(file) {
    const ext = (file.name.includes('.') ? file.name.split('.').pop() : '').toLowerCase();
    const type = (file.type && file.type.startsWith('audio/')) ? file.type : EXT_TYPES[ext];
    if (!type) return null;
    return { type, ext: EXT_TYPES[ext] ? ext : (TYPE_EXT[type] || 'audio') };
  }

  // ลองเปิดไฟล์ในเบราว์เซอร์ก่อนอัปโหลด: ถ้าเล่นไม่ได้ ไม่ต้องอัปให้เปลืองที่
  function probe(file) {
    return new Promise((resolve, reject) => {
      const a = new Audio();
      const url = URL.createObjectURL(file);
      let done = false;
      const finish = (ok, value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        a.removeAttribute('src');
        try { a.load(); } catch {}
        URL.revokeObjectURL(url);
        ok ? resolve(value) : reject(new Error('ไฟล์ “' + file.name + '” เปิดในเบราว์เซอร์ไม่ได้ ลองแปลงเป็น MP3 ก่อน'));
      };
      const timer = setTimeout(() => finish(false), 20000);
      a.preload = 'metadata';
      a.onloadedmetadata = () => finish(true, isFinite(a.duration) ? Math.round(a.duration) : null);
      a.onerror = () => finish(false);
      a.src = url;
    });
  }

  function putObject(path, file, type, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', C.supabaseUrl + '/storage/v1/object/' + C.bucket + '/' + path);
      x.setRequestHeader('apikey', C.publishableKey);
      x.setRequestHeader('Content-Type', type);
      x.setRequestHeader('x-upsert', 'false');
      x.timeout = 10 * 60 * 1000;
      if (onProgress) x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = () => {
        if (x.status >= 200 && x.status < 300) return resolve();
        let data = null;
        try { data = JSON.parse(x.responseText); } catch {}
        reject(new Error(friendly(Number(data && data.statusCode) || x.status, data)));
      };
      x.onerror = () => reject(new Error('อัปโหลดไม่สำเร็จ ตรวจอินเทอร์เน็ต'));
      x.ontimeout = () => reject(new Error('อัปโหลดนานเกินไป ลองไฟล์ที่เล็กลง'));
      x.send(file);
    });
  }

  async function removeObject(path) {
    if (!safePath(path)) return;
    await request('/storage/v1/object/' + C.bucket + '/' + path, { method: 'DELETE' });
  }

  function checkFile(file) {
    if (!file || !file.size) throw new Error('ไฟล์ว่างเปล่า');
    if (file.size > C.maxFileMB * 1024 * 1024) throw new Error('ไฟล์ “' + file.name + '” ใหญ่เกิน ' + C.maxFileMB + ' MB');
    const kind = fileKind(file);
    if (!kind) throw new Error('ไฟล์ “' + file.name + '” ไม่ใช่ไฟล์เพลง');
    return kind;
  }

  async function addTrack(file, opts) {
    const cat = category(opts.mode);
    const kind = checkFile(file);
    const title = String(opts.title || '').trim().slice(0, 120) || file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'เพลงใหม่';
    const duration = await probe(file);
    const id = newId();
    const path = C.folder + '/' + id + '.' + kind.ext;
    await putObject(path, file, kind.type, opts.onProgress);
    let rowSaved = false;
    try {
      const rows = await rest('music_tracks', send('POST', { id, title, artist: '', url: publicUrl(path), storage_path: path, duration_seconds: duration, active: true, music_type: cat.musicType }));
      if (!Array.isArray(rows) || !rows.length) throw new Error('บันทึกข้อมูลเพลงไม่สำเร็จ');
      rowSaved = true;
      await rest('kk_music_playlist_track', send('POST', { playlist_id: cat.playlistId, track_id: id, sort_order: await nextSort(cat.playlistId) }, 'return=minimal'));
      return id;
    } catch (e) {
      // ย้อนกลับ ไม่ให้เหลือขยะครึ่ง ๆ กลาง ๆ ในคลัง
      if (rowSaved) await rest('music_tracks?id=eq.' + enc(id), { method: 'DELETE' }).catch(() => {});
      await removeObject(path).catch(() => {});
      throw e;
    }
  }

  // ---------- ลบเพลง ----------
  async function deleteTrack(id) {
    const rows = await rest('music_tracks?select=id,url,storage_path&id=eq.' + enc(id) + '&limit=1');
    const t = rows && rows[0];
    if (!t) return; // ถูกลบไปแล้ว
    const maps = await rest('kk_music_playlist_track?select=playlist_id,track_id,sort_order&track_id=eq.' + enc(id)) || [];
    await rest('kk_music_playlist_track?track_id=eq.' + enc(id), { method: 'DELETE' });
    try {
      const gone = await rest('music_tracks?id=eq.' + enc(id), { method: 'DELETE', headers: { Prefer: 'return=representation' } });
      if (!Array.isArray(gone) || !gone.length) throw new Error('ลบเพลงไม่สำเร็จ');
    } catch (e) {
      if (maps.length) await rest('kk_music_playlist_track', send('POST', maps, 'return=minimal')).catch(() => {});
      throw e;
    }
    // ลบไฟล์จริงเฉพาะเมื่อเป็นไฟล์ในคลังนี้ และไม่มีเพลงอื่นใช้ไฟล์เดียวกัน
    if (safePath(t.storage_path) && t.url === publicUrl(t.storage_path)) {
      const others = await rest('music_tracks?select=id&storage_path=eq.' + enc(t.storage_path) + '&limit=1').catch(() => [{}]);
      if (Array.isArray(others) && !others.length) await removeObject(t.storage_path).catch(() => {});
    }
  }

  // ---------- เปลี่ยนชื่อ ----------
  async function renameTrack(id, title) {
    const clean = String(title || '').trim().slice(0, 120);
    if (!clean) throw new Error('ชื่อเพลงว่างไม่ได้');
    const rows = await rest('music_tracks?id=eq.' + enc(id), send('PATCH', { title: clean }));
    if (!Array.isArray(rows) || !rows.length) throw new Error('ไม่พบเพลงนี้ในคลังแล้ว');
  }

  // ---------- ย้ายหมวด / จัดหมวดให้เพลงที่ยังไม่มีหมวด ----------
  async function moveTrack(id, mode) {
    const cat = category(mode);
    const ours = new Set(C.categories.map(c => c.playlistId));
    const maps = await rest('kk_music_playlist_track?select=id,playlist_id&track_id=eq.' + enc(id)) || [];
    if (!maps.some(m => m.playlist_id === cat.playlistId)) {
      await rest('kk_music_playlist_track', send('POST', { playlist_id: cat.playlistId, track_id: id, sort_order: await nextSort(cat.playlistId) }, 'return=minimal'));
    }
    for (const m of maps) {
      if (m.playlist_id !== cat.playlistId && ours.has(m.playlist_id)) await rest('kk_music_playlist_track?id=eq.' + enc(m.id), { method: 'DELETE' });
    }
    await rest('music_tracks?id=eq.' + enc(id), send('PATCH', { music_type: cat.musicType }, 'return=minimal')).catch(() => {});
  }

  window.MusicLibrary = Object.freeze({ load, addTrack, deleteTrack, renameTrack, moveTrack, category, checkFile });
})();
