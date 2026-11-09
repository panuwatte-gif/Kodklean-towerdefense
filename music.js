// ===== เครื่องเล่นเพลง + หน้าจัดการเพลง =====
// ข้อมูลเพลงมาจาก MusicLibrary (คลังกลางร่วมกับเกมงู) ส่วนการตั้งค่าส่วนตัว (หมวด, ระดับเสียง, สุ่ม) จำไว้ในเครื่อง
(function () {
  'use strict';
  const C = window.MUSIC_CONFIG;
  const Lib = window.MusicLibrary;
  const el = id => document.getElementById(id);
  const SETTINGS_KEY = 'kk-music-settings';
  const MODES = C.categories.map(c => c.mode);

  const bgm = new Audio();
  bgm.preload = 'none';

  // ---------- สถานะทั้งหมดอยู่ที่นี่ที่เดียว ----------
  const S = {
    lib: { lists: Object.fromEntries(MODES.map(m => [m, []])), unassigned: [] },
    loaded: false,
    loading: false,
    loadError: '',
    mode: 'off',            // vocal | instrumental | off
    view: MODES[0],         // หมวดที่แสดงในรายการ
    volume: 0.4,
    sfx: true,
    shuffle: false,
    paused: false,          // ผู้ใช้กดพักเอง
    lastTrack: {},
    current: null,
    wantPlay: false,
    editing: false,
    busy: false,
    errors: 0,
    request: 0,
    failedReq: 0,
    message: '',            // สถานะเครื่องเล่น
    notice: ''              // ผลการเพิ่ม/ลบ/แก้ไขเพลง (แยกจากสถานะเครื่องเล่น จะได้ไม่ถูกทับ)
  };

  // ---------- จำค่าตั้งในเครื่อง ----------
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (MODES.includes(s.mode) || s.mode === 'off') S.mode = s.mode;
      if (MODES.includes(s.view)) S.view = s.view;
      if (typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1) S.volume = s.volume;
      if (typeof s.sfx === 'boolean') S.sfx = s.sfx;
      S.shuffle = s.shuffle === true;
      S.paused = s.paused === true;
      if (s.lastTrack && typeof s.lastTrack === 'object') S.lastTrack = s.lastTrack;
    } catch {}
    if (S.mode !== 'off') S.view = S.mode;
  }
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ mode: S.mode, view: S.view, volume: S.volume, sfx: S.sfx, shuffle: S.shuffle, paused: S.paused, lastTrack: S.lastTrack }));
    } catch {}
  }

  // เชื่อมกับเสียงเอฟเฟกต์ของเกม (ตัวแปร sound / audioMuted อยู่ใน app.js)
  function applySfx() {
    window.audioMuted = S.mode === 'off';
    try { sound = S.mode !== 'off' && S.sfx; } catch {}
  }

  const list = mode => S.lib.lists[mode] || [];
  const allTracks = () => MODES.flatMap(m => list(m)).concat(S.lib.unassigned);
  const label = mode => (C.categories.find(c => c.mode === mode) || {}).label || mode;
  function setMessage(text) { S.message = text; render(); }
  function setNotice(text) { S.notice = text; render(); }

  // ---------- เล่นเพลง ----------
  async function play(track) {
    const req = ++S.request;
    bgm.pause();
    if (!track || S.mode === 'off') { S.wantPlay = false; render(); return; }
    S.current = track;
    S.failedReq = 0;
    if (list(S.view).includes(track)) { S.lastTrack[S.view] = track.id; saveSettings(); }
    if (bgm.getAttribute('src') !== track.url) { bgm.src = track.url; bgm.load(); }
    bgm.volume = S.volume;
    S.wantPlay = true;
    setMessage('กำลังเปิด “' + track.title + '”');
    try {
      await bgm.play();
      if (req !== S.request) return;
      S.paused = false;
      saveSettings();
      setMessage('');
    } catch (e) {
      if (req !== S.request || (e && e.name === 'AbortError')) return;
      if (e && e.name === 'NotAllowedError') { S.wantPlay = false; setMessage('แตะปุ่ม ▶ เพื่อเริ่มเพลง'); return; }
      fail(req);
    }
  }

  // เพลงเปิดไม่ได้: ข้ามไปเพลงถัดไป แต่ถ้าพังติดกันหลายเพลงให้หยุด ไม่วนไม่รู้จบ
  function fail(req) {
    if (req !== S.request || S.failedReq === req || !S.wantPlay) return;
    S.failedReq = req;
    S.errors++;
    const n = list(S.view).length;
    if (S.errors >= Math.min(3, Math.max(1, n))) { pause(false); setMessage('เปิดเพลงไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่'); return; }
    setMessage('ข้ามเพลงที่เปิดไม่ได้…');
    setTimeout(() => { if (req === S.request && S.wantPlay) play(step(false)); }, 800);
  }

  function pickStart() {
    const items = list(S.view);
    if (!items.length) return null;
    if (S.shuffle) return items[Math.floor(Math.random() * items.length)];
    return items.find(t => t.id === S.lastTrack[S.view]) || items[0];
  }

  function step(back) {
    const items = list(S.view);
    if (!items.length) return null;
    const i = items.findIndex(t => S.current && t.id === S.current.id);
    if (S.shuffle && !back && items.length > 1) {
      let j;
      do { j = Math.floor(Math.random() * items.length); } while (j === i);
      return items[j];
    }
    if (i < 0) return items[0];
    return items[(i + (back ? -1 : 1) + items.length) % items.length];
  }

  function resume() {
    if (S.mode === 'off') return;
    if (!S.loaded) { S.wantPlay = true; render(); return; }
    const inView = S.current && list(S.view).some(t => t.id === S.current.id);
    play(inView ? S.current : pickStart());
  }

  function pause(byUser) {
    ++S.request;
    bgm.pause();
    S.wantPlay = false;
    if (byUser) { S.paused = true; saveSettings(); }
    render();
  }

  function setMode(mode) {
    S.mode = mode;
    if (mode !== 'off') S.view = mode;
    applySfx();
    saveSettings();
    if (mode === 'off') { pause(false); setMessage('ปิดเพลงและเอฟเฟกต์ทั้งหมด'); return; }
    S.message = '';
    play(pickStart());
  }

  bgm.addEventListener('ended', () => { S.errors = 0; play(step(false) || S.current); });
  bgm.addEventListener('playing', () => { S.errors = 0; render(); });
  bgm.addEventListener('pause', render);
  bgm.addEventListener('error', () => { if (bgm.getAttribute('src')) fail(S.request); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) bgm.pause();
    else if (S.wantPlay && S.mode !== 'off') bgm.play().catch(() => setMessage('แตะปุ่ม ▶ เพื่อฟังต่อ'));
  });

  // ---------- โหลดคลังเพลง ----------
  async function reload() {
    if (S.loading) return;
    S.loading = true; S.loadError = ''; render();
    try {
      S.lib = await Lib.load();
      S.loaded = true;
      // อัปเดตเพลงที่กำลังเล่นให้เป็นข้อมูลล่าสุด (เช่น ชื่อใหม่)
      if (S.current) S.current = allTracks().find(t => t.id === S.current.id) || S.current;
    } catch (e) {
      S.loadError = e.message;
    } finally {
      S.loading = false;
      render();
    }
    if (S.loaded && S.wantPlay && bgm.paused && S.mode !== 'off') resume();
  }

  // ---------- งานแก้ไขคลัง (ทีละงาน กันกดซ้ำ) ----------
  async function task(work, doneText) {
    if (S.busy) return;
    S.busy = true; S.notice = ''; render();
    try {
      await work();
      S.notice = doneText || '';
    } catch (e) {
      S.notice = '⚠ ' + (e.message || 'ทำรายการไม่สำเร็จ');
    } finally {
      S.busy = false;
    }
    await reload();
  }

  function removeTrack(t) {
    if (!confirm('ลบ “' + t.title + '” ออกจากคลังเพลง?\n\nเพลงจะหายจากเกมนี้และเกมงูด้วย และกู้คืนไม่ได้')) return;
    const playing = S.current && S.current.id === t.id;
    const wasPlaying = playing && S.wantPlay;
    const nextTrack = playing ? step(false) : null;
    if (playing) { pause(false); S.current = null; bgm.removeAttribute('src'); bgm.load(); }
    task(() => Lib.deleteTrack(t.id), '✓ ' + 'ลบ “' + t.title + '” แล้ว').then(() => {
      const fresh = nextTrack && nextTrack.id !== t.id && allTracks().find(x => x.id === nextTrack.id);
      if (wasPlaying && fresh) play(fresh);
    });
  }

  function renameTrack(t) {
    const name = prompt('ชื่อเพลงใหม่', t.title);
    if (name === null || !name.trim() || name.trim() === t.title) return;
    task(() => Lib.renameTrack(t.id, name), '✓ ' + 'เปลี่ยนชื่อแล้ว');
  }

  function moveTrack(t, mode) {
    task(() => Lib.moveTrack(t.id, mode), '✓ ' + 'ย้าย “' + t.title + '” ไปหมวด' + label(mode) + 'แล้ว');
  }

  async function upload(files, mode, title) {
    if (!files.length) { setNotice('⚠ เลือกไฟล์เพลงก่อน'); return; }
    try { files.forEach(f => Lib.checkFile(f)); } catch (e) { setNotice('⚠ ' + e.message); return; }
    const bar = el('uploadProgress');
    let ok = 0;
    const errors = [];
    await task(async () => {
      bar.hidden = false;
      for (let i = 0; i < files.length; i++) {
        const prefix = files.length > 1 ? 'ไฟล์ ' + (i + 1) + '/' + files.length + ' · ' : '';
        S.notice = prefix + 'กำลังตรวจไฟล์…'; render();
        bar.value = 0;
        try {
          await Lib.addTrack(files[i], {
            mode,
            title: files.length === 1 ? title : '',
            onProgress: p => { bar.value = p; el('musicNotice').textContent = prefix + 'กำลังอัปโหลด ' + Math.round(p * 100) + '%'; }
          });
          ok++;
        } catch (e) {
          errors.push(e.message);
        }
      }
      bar.hidden = true;
      if (!ok) throw new Error(errors[0] || 'อัปโหลดไม่สำเร็จ');
    }, '');
    if (ok) {
      S.notice = errors.length ? '⚠ เพิ่มสำเร็จ ' + ok + ' เพลง · ไม่สำเร็จ ' + errors.length + ': ' + errors[0] : '✓ เพิ่ม ' + ok + ' เพลงเข้าหมวด' + label(mode) + 'แล้ว';
      S.view = mode;
      if (S.mode !== 'off') S.mode = mode;
      saveSettings();
    }
    render();
  }

  // ---------- วาดหน้าจอจากสถานะ ----------
  function button(text, onClick, opts = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    if (opts.title) { b.title = opts.title; b.setAttribute('aria-label', opts.title); }
    if (opts.className) b.className = opts.className;
    b.disabled = !!opts.disabled;
    b.onclick = onClick;
    return b;
  }

  function trackRow(t, mode) {
    const li = document.createElement('li');
    const isCurrent = S.current && S.current.id === t.id;
    li.className = 'track-row' + (isCurrent ? ' current' : '');
    const name = button((isCurrent && S.wantPlay ? '♪ ' : '') + t.title, () => {
      if (S.mode === 'off') { S.mode = S.view; applySfx(); saveSettings(); }
      play(t);
    }, { className: 'track-title', disabled: S.busy });
    li.append(name);
    if (S.editing) {
      const tools = document.createElement('span');
      tools.className = 'track-tools';
      tools.append(button('✎', () => renameTrack(t), { title: 'เปลี่ยนชื่อ', disabled: S.busy }));
      for (const m of MODES) if (m !== mode) tools.append(button('→ ' + label(m), () => moveTrack(t, m), { title: 'ย้ายไปหมวด' + label(m), disabled: S.busy }));
      tools.append(button('ลบ', () => removeTrack(t), { title: 'ลบเพลง', className: 'danger', disabled: S.busy }));
      li.append(tools);
    }
    return li;
  }

  function render() {
    const status = el('musicStatus');
    if (!status) return;
    applySfx();
    document.querySelectorAll('#musicDialog [data-mode]').forEach(b => {
      b.classList.toggle('chosen', b.dataset.mode === S.mode);
      b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode));
    });
    document.querySelectorAll('#musicDialog [data-view]').forEach(b => {
      b.classList.toggle('chosen', b.dataset.view === S.view);
      b.textContent = label(b.dataset.view) + ' (' + list(b.dataset.view).length + ')';
    });

    const items = list(S.view);
    const playing = S.wantPlay && !bgm.paused;
    let text = S.message;
    if (!text) {
      if (S.loading && !S.loaded) text = 'กำลังโหลดคลังเพลง…';
      else if (S.loadError) text = S.loadError;
      else if (S.mode === 'off') text = 'ปิดเพลงและเอฟเฟกต์อยู่ · เลือกหมวดด้านบนเพื่อเปิด';
      else if (playing && S.current) text = 'กำลังเล่น: ' + S.current.title;
      else if (S.wantPlay) text = 'กำลังเปิดเพลง…';
      else if (!items.length) text = 'หมวดนี้ยังไม่มีเพลง · กด “แก้ไขรายการ” เพื่อเพิ่ม';
      else text = 'พักเพลงอยู่ · กด ▶ เพื่อฟัง';
    }
    status.textContent = text;
    el('musicRetry').hidden = !S.loadError;
    el('musicNotice').textContent = S.notice;
    el('musicNotice').hidden = !S.notice;

    const canPlay = S.mode !== 'off' && items.length > 0;
    el('musicPlay').textContent = playing ? '⏸ พัก' : '▶ เล่น';
    el('musicPlay').disabled = !canPlay && !playing;
    el('musicPrev').disabled = !canPlay;
    el('musicNext').disabled = !canPlay;
    el('musicShuffle').textContent = 'สุ่ม: ' + (S.shuffle ? 'เปิด' : 'ปิด');
    el('musicShuffle').setAttribute('aria-pressed', String(S.shuffle));
    el('volume').value = String(S.volume);
    el('sfx').checked = S.mode !== 'off' && S.sfx;

    el('musicEdit').textContent = S.editing ? 'เสร็จสิ้น' : 'แก้ไขรายการ';
    el('musicEdit').setAttribute('aria-pressed', String(S.editing));
    el('musicReload').disabled = S.loading || S.busy;
    el('musicManage').hidden = !S.editing;
    el('musicDialog').classList.toggle('busy', S.busy);

    const ol = el('trackList');
    ol.replaceChildren(...items.map(t => trackRow(t, S.view)));
    el('trackEmpty').hidden = items.length > 0 || !S.loaded;

    const orphans = S.lib.unassigned;
    el('orphanBlock').hidden = !orphans.length;
    el('orphanList').replaceChildren(...orphans.map(t => trackRow(t, null)));

    el('uploadBtn').disabled = S.busy;
    el('trackFile').disabled = S.busy;
    if (!el('trackKind').dataset.touched) el('trackKind').value = S.view;
  }

  // ---------- ผูกปุ่ม ----------
  function bind() {
    el('sound').onclick = () => { el('musicDialog').showModal(); render(); if (!S.loaded && !S.loading) reload(); };
    document.querySelectorAll('#musicDialog [data-mode]').forEach(b => { b.onclick = () => setMode(b.dataset.mode); });
    document.querySelectorAll('#musicDialog [data-view]').forEach(b => {
      b.onclick = () => {
        if (S.view === b.dataset.view) return;
        S.view = b.dataset.view;
        S.message = '';
        if (S.mode !== 'off') { S.mode = S.view; saveSettings(); play(pickStart()); }
        else { saveSettings(); render(); }
      };
    });
    el('musicPlay').onclick = () => {
      if (S.wantPlay && !bgm.paused) { pause(true); return; }
      S.message = '';
      resume();
    };
    el('musicNext').onclick = () => { S.message = ''; play(step(false)); };
    el('musicPrev').onclick = () => { S.message = ''; play(step(true)); };
    el('musicShuffle').onclick = () => { S.shuffle = !S.shuffle; saveSettings(); render(); };
    el('volume').oninput = () => { S.volume = Number(el('volume').value); bgm.volume = S.volume; saveSettings(); };
    el('sfx').onchange = () => {
      S.sfx = el('sfx').checked;
      if (S.sfx && S.mode === 'off') { S.mode = S.view; S.message = 'เปิดเอฟเฟกต์แล้ว · กด ▶ เพื่อเปิดเพลง'; }
      applySfx();
      saveSettings();
      render();
      if (S.sfx && typeof beep === 'function') beep();
    };
    el('musicEdit').onclick = () => { S.editing = !S.editing; S.notice = ''; render(); };
    el('musicReload').onclick = () => { S.message = ''; reload(); };
    el('musicRetry').onclick = () => { S.message = ''; reload(); };
    el('trackKind').onchange = () => { el('trackKind').dataset.touched = '1'; };
    el('addTrack').onsubmit = async e => {
      e.preventDefault();
      const files = Array.from(el('trackFile').files || []);
      await upload(files, el('trackKind').value, el('trackName').value);
      el('trackFile').value = '';
      el('trackName').value = '';
      delete el('trackKind').dataset.touched;
      render();
    };
    // เบราว์เซอร์ไม่ให้เปิดเสียงเองจนกว่าจะแตะจอครั้งแรก: แตะครั้งแรกแล้วเพลงต่อจากที่ตั้งไว้
    const firstTouch = e => {
      document.removeEventListener('pointerdown', firstTouch, true);
      if (e.target.closest && e.target.closest('#musicDialog')) return;
      if (S.mode !== 'off' && !S.paused && !S.wantPlay) resume();
    };
    document.addEventListener('pointerdown', firstTouch, true);
  }

  loadSettings();
  bgm.volume = S.volume;
  applySfx();
  bind();
  render();
  reload();
  window.KKMusic = Object.freeze({ state: S, reload });
})();
