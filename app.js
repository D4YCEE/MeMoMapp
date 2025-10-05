// MeMoMapp v12 — black brand pill, stable menu, legend, top-right locate, zoom top-left
const map = L.map('map', { zoomControl: false, worldCopyJump: false }).setView([20,0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { noWrap:true, maxZoom:18, attribution:'© OpenStreetMap' }).addTo(map);
map.setMaxBounds([[ -85, -180 ], [ 85, 180 ]]); map.options.maxBoundsViscosity = 1.0; map.setMinZoom(2);
L.control.zoom({ position: 'topleft' }).addTo(map);

const $ = (s)=>document.querySelector(s);

// refs
const addBtn=$('#addBtn'); const modal=$('#modal'); const closeModal=$('#closeModal'); const saveBtn=$('#saveMemory'); const useGPSBtn=$('#useGPS');
const memType=$('#memType'); const photoField=$('#photoField'); const galleryField=$('#galleryField'); const photoInput=$('#photoInput'); const galleryInput=$('#galleryInput');
const emojiInput=$('#emojiInput'); const textInput=$('#textInput'); const tagsInput=$('#tagsInput'); const latInput=$('#latInput'); const lngInput=$('#lngInput');
const labelSelect=$('#labelSelect'); const labelColorInput=$('#labelColor');

const panel=$('#memoryPanel'); const closePanel=$('#closePanel'); const panelGallery=$('#panelGallery'); const panelQuote=$('#panelQuote'); const panelLocation=$('#panelLocation'); const panelTags=$('#panelTags');
const editBtn=$('#editBtn'); const deleteBtn=$('#deleteBtn'); const shareBtn=$('#shareBtn');

const menuBtn=$('#menuBtn'); const menu=$('#menuPanel'); const exportBtn=$('#exportBtn'); const importBtn=$('#importBtn'); const importFile=$('#importFile'); const posterBtn=$('#posterBtn');
const tabLogBtn=$('#tabLog'); const tabLabelsBtn=$('#tabLabels'); const tabPanelLog=$('#tabPanelLog'); const tabPanelLabels=$('#tabPanelLabels'); const logListMenu=$('#logListMenu'); const logSearch=$('#logSearch');

const locateBtn = $('#locateBtn');

let memories = loadMemories();
let markers = [];
let selectedId = null;
let lastFilterTag = null;
let LABELS = loadLabels(); if (!LABELS['default']) LABELS['default']={color:'#1e90ff',visible:true}; saveLabels();

menuBtn.addEventListener('click', ()=>{
  const hidden = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !hidden);
  menu.setAttribute('aria-hidden', hidden ? 'false' : 'true');
  if (!hidden){ showTab('log'); }
});

// Modal
addBtn.addEventListener('click', ()=> openModal());
closeModal.addEventListener('click', ()=> closeModalAndReset());

memType.addEventListener('change', ()=>{
  const t = memType.value;
  photoField.classList.toggle('hidden', t !== 'photo');
  galleryField.classList.toggle('hidden', t !== 'gallery');
});

useGPSBtn.addEventListener('click', ()=>{
  if (!navigator.geolocation) { alert('Geolocation nicht verfügbar'); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    latInput.value = pos.coords.latitude.toFixed(6);
    lngInput.value = pos.coords.longitude.toFixed(6);
    map.setView([pos.coords.latitude, pos.coords.longitude], 13);
  }, err=> alert('GPS-Fehler: '+err.message));
});

// Map interactions
map.on('click', e=>{ latInput.value = e.latlng.lat.toFixed(6); lngInput.value = e.latlng.lng.toFixed(6); });
let pressTimer=null;
function startPress(e){
  const point = e.containerPoint || (e.touches && map.mouseEventToContainerPoint(e.touches[0]));
  if (!point) return;
  const latlng = map.containerPointToLatLng(point);
  clearTimeout(pressTimer);
  pressTimer = setTimeout(()=>{ latInput.value=latlng.lat.toFixed(6); lngInput.value=latlng.lng.toFixed(6); openModal(); addRipple(latlng); }, 550);
}
function cancelPress(){ clearTimeout(pressTimer); pressTimer=null; }
map.on('mousedown', startPress); map.on('mouseup', cancelPress); map.on('mouseout', cancelPress);
map.on('touchstart', startPress); map.on('touchend', cancelPress); map.on('touchmove', cancelPress);
map.on('dblclick', e=>{ latInput.value=e.latlng.lat.toFixed(6); lngInput.value=e.latlng.lng.toFixed(6); addRipple(e.latlng); openModal(); });

function addRipple(latlng){
  const mapEl = document.getElementById('map');
  const r = document.createElement('span');
  r.className='ripple';
  const p = map.latLngToContainerPoint(latlng);
  r.style.left = p.x+'px'; r.style.top = p.y+'px';
  mapEl.appendChild(r);
  setTimeout(()=>r.remove(),600);
}

// Locate top-right
locateBtn && locateBtn.addEventListener('click', ()=>{
  if (!navigator.geolocation){ alert('Geolocation nicht verfügbar'); return; }
  locateBtn.classList.add('pulsing');
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude, lng=pos.coords.longitude;
    map.setView([lat,lng], Math.max(map.getZoom(),14));
    addRipple({lat,lng});
    locateBtn.classList.remove('pulsing');
  }, err=>{ locateBtn.classList.remove('pulsing'); alert('GPS-Fehler: '+err.message); });
});

// Save memory
saveBtn.addEventListener('click', async ()=>{
  const id = crypto.randomUUID();
  const sel = labelSelect ? labelSelect.value : null;
  let label = (sel && sel!=='__new__') ? sel : 'default';
  if (sel==='__new__'){ const n = prompt('Neuer Labelname (z.B. Konzerte):'); if (!n || !n.trim()) return; if (LABELS[n]){ alert('Label existiert bereits'); return; } label = n.trim(); }
  const labelColor = (document.getElementById('labelColor')?.value) || '#1e90ff';
  if (!LABELS[label]) LABELS[label]={color:labelColor,visible:true}; else LABELS[label].color=labelColor;
  saveLabels(); renderLabelsUI(); refreshLabelSelect(label);

  const type = memType.value;
  const text = textInput.value.trim();
  const emoji = emojiInput.value.trim();
  const tags = parseTags(tagsInput.value);
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);
  if (Number.isNaN(lat) || Number.isNaN(lng)) { alert('Bitte Position setzen (Doppelklick auf Karte oder GPS).'); return; }
  let photos=[];
  if (type==='photo' && photoInput.files[0]){ photos=[await fileToDataURL(photoInput.files[0])]; }
  else if (type==='gallery' && galleryInput.files.length){ for (const f of galleryInput.files) photos.push(await fileToDataURL(f)); }
  const mem = { id, type, label, labelColor, text, emoji, tags, lat, lng, photos, createdAt: new Date().toISOString() };
  memories.push(mem); saveMemories(); renderMarkers(lastFilterTag); renderLegend(); closeModalAndReset();
  map.setView([lat,lng], Math.max(map.getZoom(),11));
});

function openModal(){ modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); refreshLabelSelect(); }
function closeModalAndReset(){
  modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
  memType.value='photo'; photoField.classList.remove('hidden'); galleryField.classList.add('hidden');
  photoInput.value=''; galleryInput.value=''; emojiInput.value=''; textInput.value=''; tagsInput.value=''; latInput.value=''; lngInput.value='';
}

function parseTags(str){ return str.split(/[,#]/).map(s=>s.trim()).filter(Boolean); }
function fileToDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
function saveMemories(){ localStorage.setItem('memomapp:data', JSON.stringify(memories)); }
function loadMemories(){ try{ return JSON.parse(localStorage.getItem('memomapp:data')||'[]'); } catch{ return []; } }

function loadLabels(){ try{ return JSON.parse(localStorage.getItem('memomapp:labels')||'{}'); } catch { return {}; } }
function saveLabels(){ localStorage.setItem('memomapp:labels', JSON.stringify(LABELS)); }
function getLabelColor(name){ return (LABELS[name] && LABELS[name].color) || null; }
function isLabelVisible(name){ return (LABELS[name] ? LABELS[name].visible !== false : true); }

function computeMarkerSize(){
  const bounds = map.getBounds();
  const countInView = memories.filter(m => bounds.contains([m.lat, m.lng]) && (!lastFilterTag || m.tags.map(t=>t.toLowerCase()).includes(lastFilterTag.toLowerCase())) && isLabelVisible(m.label||'default')).length;
  const z = map.getZoom();
  let base = (z >= 13) ? 40 : (z >= 8 ? 32 : (z >= 5 ? 28 : 24));
  if (countInView > 120) base -= 12; else if (countInView > 80) base -= 9; else if (countInView > 50) base -= 6; else if (countInView > 25) base -= 3;
  return Math.max(16, base);
}

function buildDivIcon(mem, size){
  const div = document.createElement('div'); div.className='marker-pin pulse'; div.style.width=size+'px'; div.style.height=size+'px';
  const borderColor = mem.labelColor || getLabelColor(mem.label); if (borderColor){ div.style.borderColor = borderColor; div.style.boxShadow = `0 0 0 6px ${hexToRGBA(borderColor,0.22)}`; }
  if (mem.photos && mem.photos.length){ const img=new Image(); img.src=mem.photos[0]; img.className='marker-thumb'; div.appendChild(img); }
  else if (mem.emoji){ const span=document.createElement('span'); span.textContent=mem.emoji; span.className='marker-emoji'; div.appendChild(span); }
  else { const span=document.createElement('span'); span.textContent=(mem.label||'•').slice(0,1).toUpperCase(); span.className='marker-emoji'; div.appendChild(span); }
  return L.divIcon({ html: div.outerHTML, className:'', iconSize:[size,size], iconAnchor:[size/2,size] });
}
function hexToRGBA(hex,a){ if(!hex) return 'rgba(0,0,0,0.15)'; const c=hex.replace('#',''); const r=parseInt(c.substr(0,2),16), g=parseInt(c.substr(2,2),16), b=parseInt(c.substr(4,2),16); return `rgba(${r},${g},${b},${a})`; }

function renderMarkers(filterTag=null){
  lastFilterTag = filterTag;
  markers.forEach(o=> map.removeLayer(o.marker)); markers=[];
  const size = computeMarkerSize();
  memories.forEach(mem=>{
    if (!isLabelVisible(mem.label||'default')) return;
    if (filterTag && !mem.tags.map(t=>t.toLowerCase()).includes(filterTag.toLowerCase())) return;
    const icon = buildDivIcon(mem, size);
    const marker = L.marker([mem.lat, mem.lng], { icon }).addTo(map);
    marker.on('click', ()=> openPanel(mem.id));
    markers.push({marker, mem});
  });
  fitToPins();
}
function updateMarkerSizes(){ const size = computeMarkerSize(); markers.forEach(obj=> obj.marker.setIcon(buildDivIcon(obj.mem, size))); }
map.on('moveend zoomend', updateMarkerSizes);

// Panel
function openPanel(id){
  selectedId = id;
  const mem = memories.find(m=>m.id===id); if (!mem) return;
  panel.classList.remove('hidden');
  panelGallery.innerHTML='';
  if (mem.photos && mem.photos.length){ mem.photos.forEach(src=>{ const img=new Image(); img.src=src; panelGallery.appendChild(img); }); }
  else if (mem.emoji){ const span=document.createElement('span'); span.textContent=mem.emoji; span.style.fontSize='48px'; panelGallery.appendChild(span); }
  panelQuote.textContent = mem.text || '';
  panelLocation.textContent = `📍 ${formatLatLng(mem.lat, mem.lng)}`;
  panelTags.innerHTML='';
  if (mem.label){ const chip=document.createElement('span'); chip.className='tag'; chip.textContent='@'+mem.label; panelTags.appendChild(chip); }
  (mem.tags||[]).forEach(t=>{ const chip=document.createElement('span'); chip.className='tag'; chip.textContent = t.startsWith('#')?t:'#'+t; panelTags.appendChild(chip); });
  editBtn.onclick = ()=> editMemory(mem.id);
  deleteBtn.onclick = ()=> deleteMemory(mem.id);
}
closePanel.addEventListener('click', ()=> panel.classList.add('hidden'));

function editMemory(id){
  const mem = memories.find(m=>m.id===id); if (!mem) return;
  openModal();
  memType.value = mem.type || 'photo'; photoField.classList.toggle('hidden', memType.value!=='photo'); galleryField.classList.toggle('hidden', memType.value!=='gallery');
  emojiInput.value = mem.emoji || ''; textInput.value = mem.text || ''; tagsInput.value = (mem.tags||[]).join(', '); latInput.value = mem.lat; lngInput.value = mem.lng;
  if (labelColorInput) labelColorInput.value = mem.labelColor || getLabelColor(mem.label) || '#1e90ff';
  refreshLabelSelect(mem.label);
  saveBtn.onclick = async ()=>{
    const type = memType.value; const text=textInput.value.trim(); const emoji=emojiInput.value.trim(); const tags=parseTags(tagsInput.value);
    const lat=parseFloat(latInput.value); const lng=parseFloat(lngInput.value); if (Number.isNaN(lat) || Number.isNaN(lng)) { alert('Bitte Position setzen'); return; }
    let photos = mem.photos || [];
    if (type==='photo' && photoInput.files[0]){ photos=[await fileToDataURL(photoInput.files[0])]; }
    else if (type==='gallery' && galleryInput.files.length){ photos=[]; for (const f of galleryInput.files) photos.push(await fileToDataURL(f)); }
    const sel = labelSelect ? labelSelect.value : null;
    let newLabel = (sel && sel!=='__new__') ? sel : (mem.label || 'default');
    if (sel==='__new__'){ const n = prompt('Neuer Labelname:'); if (!n || !n.trim()) return; if (LABELS[n]){ alert('Label existiert'); return; } newLabel = n.trim(); }
    const newColor = (labelColorInput?.value) || mem.labelColor || '#1e90ff';
    LABELS[newLabel] = LABELS[newLabel] || {color:newColor, visible:true}; LABELS[newLabel].color = newColor; saveLabels(); renderLabelsUI(); refreshLabelSelect(newLabel);

    Object.assign(mem, {type, label:newLabel, labelColor:newColor, text, emoji, tags, lat, lng, photos});
    saveMemories(); renderMarkers(lastFilterTag); renderLegend(); closeModalAndReset(); openPanel(id);
  };
}

function deleteMemory(id){
  if (!confirm('Diese Erinnerung löschen?')) return;
  memories = memories.filter(m=>m.id!==id); saveMemories(); renderMarkers(lastFilterTag); renderLegend(); panel.classList.add('hidden');
}

function formatLatLng(lat,lng){ const latDir=lat>=0?'N':'S', lngDir=lng>=0?'E':'W'; return `${Math.abs(lat).toFixed(3)}°${latDir}, ${Math.abs(lng).toFixed(3)}°${lngDir}`; }

// Tabs
function showTab(which){
  tabLogBtn.classList.toggle('active', which==='log');
  tabLabelsBtn.classList.toggle('active', which==='labels');
  tabPanelLog.style.display = (which==='log') ? 'block' : 'none';
  tabPanelLabels.style.display = (which==='labels') ? 'block' : 'none';
  if (which==='log') buildLogMenu(logSearch?.value.trim()||''); else renderLabelsUI();
}
tabLogBtn.addEventListener('click', ()=> showTab('log'));
tabLabelsBtn.addEventListener('click', ()=> showTab('labels'));

// Log
function matchesQuery(m,q){ if(!q) return true; const s=q.toLowerCase(); return (m.text||'').toLowerCase().includes(s) || (m.tags||[]).join(' ').toLowerCase().includes(s.replace('#','')) || (m.label||'').toLowerCase().includes(s); }
function highlight(text,q){ if(!q) return text; try{ const re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'); return (text||'').replace(re,'<mark>$1</mark>'); }catch{return text;} }
logSearch.addEventListener('input', ()=> buildLogMenu(logSearch.value.trim()));

function buildLogMenu(query=''){
  const list = logListMenu; list.innerHTML='';
  const sorted=[...memories].sort((a,b)=> new Date(b.createdAt||0)-new Date(a.createdAt||0));
  let lastMonth=null;
  for (const m of sorted){
    if (!matchesQuery(m, query)) continue;
    const dt=new Date(m.createdAt||Date.now()); const mk=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
    if (mk!==lastMonth){ const sep=document.createElement('div'); sep.className='date-sep'; sep.textContent=dt.toLocaleString(undefined,{month:'long',year:'numeric'}); list.appendChild(sep); lastMonth=mk; }
    const row=document.createElement('div'); row.className='log-item';
    if (m.photos && m.photos.length){ const img=new Image(); img.src=m.photos[0]; img.className='log-thumb'; row.appendChild(img); }
    else { const th=document.createElement('div'); th.className='log-thumb'; th.textContent=m.emoji || (m.label||'•').slice(0,1).toUpperCase(); row.appendChild(th); }
    const main=document.createElement('div'); main.className='log-main';
    const title=document.createElement('div'); title.className='log-title'; title.innerHTML=highlight(m.text||'(kein Text)', query);
    const meta=document.createElement('div'); meta.className='log-meta'; meta.innerHTML = `${dt.toLocaleDateString()} • 📍 ${formatLatLng(m.lat,m.lng)} ${m.label? ' • @'+m.label:''}`;
    main.appendChild(title); main.appendChild(meta);
    const actions=document.createElement('div'); actions.className='log-actions';
    const openBtn=document.createElement('button'); openBtn.className='btn tiny'; openBtn.textContent='Öffnen';
    const showBtn=document.createElement('button'); showBtn.className='btn tiny'; showBtn.textContent='Auf Karte';
    openBtn.onclick=()=>{ openPanel(m.id); menu.classList.add('hidden'); }; showBtn.onclick=()=>{ map.setView([m.lat,m.lng], Math.max(map.getZoom(),11)); menu.classList.add('hidden'); };
    row.appendChild(main); actions.appendChild(openBtn); actions.appendChild(showBtn); row.appendChild(actions); list.appendChild(row);
  }
}

// Labels UI
const labelsList = document.querySelector('#labelsList'); const newLabelBtn = document.querySelector('#newLabelBtn');
function renderLabelsUI(){
  const container = labelsList; if(!container) return; container.innerHTML='';
  Object.keys(LABELS).sort().forEach(name=>{
    const row=document.createElement('div'); row.className='label-row';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=isLabelVisible(name);
    cb.onchange=()=>{ LABELS[name].visible=cb.checked; saveLabels(); renderMarkers(lastFilterTag); renderLegend(); };
    const dot=document.createElement('span'); dot.className='color-dot'; dot.style.background=LABELS[name].color||'#ddd';
    const span=document.createElement('span'); span.textContent=name; span.style.flex='1';
    const actions=document.createElement('div'); actions.className='label-actions';
    const edit=document.createElement('button'); edit.className='mini'; edit.textContent='Edit';
    const del=document.createElement('button'); del.className='mini'; del.textContent='Delete';
    edit.onclick=()=> editLabelRow(name, row);
    del.onclick=()=>{ if(!confirm('Label löschen? Pins werden auf "default" gesetzt.')) return;
      const def='#1e90ff'; memories.forEach(m=>{ if((m.label||'default')===name){ m.label='default'; m.labelColor = LABELS['default']?.color || def; }});
      saveMemories(); delete LABELS[name]; if(!LABELS['default']) LABELS['default']={color:def,visible:true}; saveLabels(); renderLabelsUI(); renderMarkers(lastFilterTag); renderLegend();
    };
    row.appendChild(cb); row.appendChild(dot); row.appendChild(span); row.appendChild(actions); actions.appendChild(edit); actions.appendChild(del);
    container.appendChild(row);
  });
}
newLabelBtn && newLabelBtn.addEventListener('click', ()=>{
  const name = prompt('Neues Label:'); if(!name || !name.trim()) return; const n=name.trim(); if (LABELS[n]) return alert('Label existiert');
  const color = '#1e90ff'; LABELS[n]={color,visible:true}; saveLabels(); renderLabelsUI(); refreshLabelSelect(n); renderMarkers(); renderLegend();
});

function editLabelRow(name, row){
  row.innerHTML='';
  const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=isLabelVisible(name);
  cb.onchange=()=>{ LABELS[name].visible=cb.checked; saveLabels(); renderMarkers(lastFilterTag); renderLegend(); };
  const dot=document.createElement('span'); dot.className='color-dot'; dot.style.background=LABELS[name].color||'#ddd';
  const nameInput=document.createElement('input'); nameInput.type='text'; nameInput.value=name; nameInput.style.flex='1';
  const color=document.createElement('input'); color.type='color'; color.value=LABELS[name].color||'#1e90ff'; color.oninput=()=> dot.style.background=color.value;
  const actions=document.createElement('div'); actions.className='label-actions';
  const save=document.createElement('button'); save.className='mini'; save.textContent='Save';
  const cancel=document.createElement('button'); cancel.className='mini'; cancel.textContent='Cancel';
  save.onclick=()=>{
    const newName=(nameInput.value||'').trim()||name; const newColor=color.value;
    if (newName!==name){ if (LABELS[newName]) return alert('Label existiert bereits');
      LABELS[newName]={...LABELS[name]}; delete LABELS[name]; memories.forEach(m=>{ if((m.label||'default')===name){ m.label=newName; }});
    }
    LABELS[newName].color=newColor; memories.forEach(m=>{ if((m.label||'default')===newName){ m.labelColor=newColor; }});
    saveLabels(); saveMemories(); renderLabelsUI(); refreshLabelSelect(newName); renderMarkers(lastFilterTag); renderLegend();
  };
  cancel.onclick=()=> renderLabelsUI();
  row.appendChild(cb); row.appendChild(dot); row.appendChild(nameInput); row.appendChild(color); actions.appendChild(save); actions.appendChild(cancel); row.appendChild(actions);
}

// Label selector in modal
function refreshLabelSelect(selected=null){
  const sel=labelSelect; if(!sel) return;
  const names=Object.keys(LABELS).sort(); sel.innerHTML='';
  names.forEach(n=>{ const opt=document.createElement('option'); opt.value=n; opt.textContent=n; if(selected===n) opt.selected=true; sel.appendChild(opt); });
  const addOpt=document.createElement('option'); addOpt.value='__new__'; addOpt.textContent='＋ Neues Label…'; sel.appendChild(addOpt);
  const lc=document.getElementById('labelColor'); const cur=sel.value || names[0] || 'default';
  if (lc) lc.value=(LABELS[cur]&&LABELS[cur].color)||'#1e90ff';
}
labelSelect && labelSelect.addEventListener('change', ()=>{
  const val=labelSelect.value; const lc=document.getElementById('labelColor');
  if (val==='__new__'){ if (lc) lc.value='#1e90ff'; } else { if (lc) lc.value=(LABELS[val]&&LABELS[val].color)||'#1e90ff'; }
});

// Legend
function renderLegend(){
  const box=document.getElementById('labelLegend'); if(!box) return;
  const names=Object.keys(LABELS).filter(n=> isLabelVisible(n));
  if (!names.length){ box.innerHTML=''; box.style.display='none'; return; }
  box.style.display='block';
  const rows = names.sort().map(n=>{
    const col=(LABELS[n]&&LABELS[n].color)||'#ddd';
    return `<div class="row"><span class="dot" style="background:${col}"></span><span class="name">${n}</span></div>`;
  }).join('');
  box.innerHTML = `<div class="title">Labels</div>${rows}`;
}

// Export/Import/Poster
exportBtn.addEventListener('click', ()=>{
  const blob=new Blob([JSON.stringify(memories,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='memomapp-backup.json'; a.click();
});
importBtn.addEventListener('click', ()=> importFile.click());
importFile.addEventListener('change', async (e)=>{
  const f=e.target.files[0]; if(!f) return; const text=await f.text();
  try{ const data=JSON.parse(text); if(Array.isArray(data)){ memories=data; saveMemories(); renderMarkers(lastFilterTag); renderLegend(); alert('Importiert: '+memories.length); fitToPins(); } else alert('Ungültige Datei'); }
  catch(err){ alert('Import-Fehler: '+err.message); }
});

shareBtn.addEventListener('click', ()=>{
  if (!selectedId){ alert('Öffne zuerst eine Erinnerung.'); return; }
  const mem = memories.find(m=>m.id===selectedId);
  createMemoryImage(mem).then(blob=>{
    const file = new File([blob], 'memory.png', {type:'image/png'});
    if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      navigator.share({ files:[file], title:'MeMoMapp', text: mem.text||'' }).catch(()=>{});
    } else { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='memory.png'; a.click(); }
  });
});

async function createMemoryImage(mem){
  const W=1080,H=1350; const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H; const ctx=canvas.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#f7fbff'); g.addColorStop(1,'#e8f3ff'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  let y=60;
  if (mem.photos && mem.photos.length){ const img=await loadImage(mem.photos[0]); const r=img.width/img.height; const PW=W-160, PH=600; let iw=PW, ih=PW/r; if (ih>PH){ ih=PH; iw=ih*r; } const x=(W-iw)/2; ctx.fillStyle='#ffffffdd'; roundRect(ctx,x-10,y-10,iw+20,ih+20,24,true,false); ctx.drawImage(img,x,y,iw,ih); y+=ih+40; }
  else if (mem.emoji){ ctx.font='120px serif'; ctx.textAlign='center'; ctx.fillText(mem.emoji, W/2, y+120); y+=160; }
  ctx.fillStyle='#0b1220'; ctx.font='700 44px Inter, Roboto, system-ui'; wrapText(ctx, mem.text||'', 80, y, W-160, 54); y+=220;
  ctx.fillStyle='#5a6a7a'; ctx.font='28px Inter, system-ui'; ctx.textAlign='left'; ctx.fillText(`📍 ${formatLatLng(mem.lat, mem.lng)}`, 80, y);
  return await new Promise(res=>canvas.toBlob(res,'image/png'));
}
function wrapText(ctx,text,x,y,maxWidth,lineHeight){ const words=text.split(/\s+/); let line=''; for (let n=0;n<words.length;n++){ const test=line+words[n]+' '; if (ctx.measureText(test).width>maxWidth && n>0){ ctx.fillText(line,x,y); line=words[n]+' '; y+=lineHeight; } else { line=test; } } ctx.fillText(line,x,y); }
function roundRect(ctx,x,y,w,h,r,fill,stroke){ if(typeof r==='number') r={tl:r,tr:r,br:r,bl:r}; ctx.beginPath(); ctx.moveTo(x+r.tl,y); ctx.lineTo(x+w-r.tr,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r.tr); ctx.lineTo(x+w,y+h-r.br); ctx.quadraticCurveTo(x+w,y+h,x+w-r.br,y+h); ctx.lineTo(x+r.bl,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r.bl); ctx.lineTo(x,y+r.tl); ctx.quadraticCurveTo(x,y,x+r.tl,y); ctx.closePath(); if(fill) ctx.fill(); if(stroke) ctx.stroke(); }
function loadImage(src){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=src; }); }

// Fit to pins
function fitToPins(){
  const pts=markers.map(m=>m.marker.getLatLng());
  if (!pts.length){ map.setView([20,0], 2); return; }
  const bounds=L.latLngBounds(pts);
  map.fitBounds(bounds.pad(0.2), { animate:true });
}

// Init
document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(()=>{ renderMarkers(); renderLegend(); }, 50); });
refreshLabelSelect();
