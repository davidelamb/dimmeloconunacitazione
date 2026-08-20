const TOPICS = [
  ['casuale','Casuale'],['amore','Amore'],['vita','Vita'],['motivazione','Motivazione'],['disciplina','Disciplina'],
  ['coraggio','Coraggio'],['successo','Successo'],['fallimento','Fallimento'],['resilienza','Resilienza'],
  ['cambiamento','Cambiamento'],['crescita personale','Crescita personale'],['autostima','Autostima'],
  ['felicità','Felicità'],['gratitudine','Gratitudine'],['amicizia','Amicizia'],['famiglia','Famiglia'],
  ['solitudine','Solitudine'],['tempo','Tempo'],['pazienza','Pazienza'],['sogni','Sogni'],['ambizione','Ambizione'],
  ['lavoro','Lavoro'],['leadership','Leadership'],['libertà','Libertà'],['viaggio','Viaggio'],['nostalgia','Nostalgia'],
  ['speranza','Speranza'],['delusione','Delusione'],['ironia','Ironia'],['filosofia','Filosofia'],['minimalismo','Minimalismo'],
  ['pace','Pace'],['forza','Forza'],['sport','Sport'],['giovinezza','Giovinezza'],['maturità','Maturità'],
  ['scelte','Scelte'],['destino','Destino'],['consapevolezza','Consapevolezza'],['perdono','Perdono'],['relazioni','Relazioni']
];

const FALLBACK = [
  {quote:'La vita è ciò che accade mentre sei impegnato a fare altri progetti.',author:'John Lennon',category:'vita',caption:'A volte la vita arriva prima dei nostri programmi. 🌿',hashtags:['#vita','#citazioni','#aforismi','#pensieri','#ispirazione']},
  {quote:'Non è la specie più forte che sopravvive, né la più intelligente, ma quella più capace di reagire ai cambiamenti.',author:'Charles Darwin',category:'cambiamento',caption:'Cambiare non significa perdere se stessi. A volte significa ritrovarsi.',hashtags:['#cambiamento','#resilienza','#citazioni','#aforismi','#crescita']}
];

const STORAGE_KEY = 'dimmeloconunacitazione_history_v2';
const POOL_URL = 'data/pool.json';
const LATEST_URL = 'data/latest.json';
let pool = [];
let currentPost = null;

function getHistory(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveHistory(items){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); renderHistory(); updateAvailability(); }
function usedQuotes(){ return new Set(getHistory().map(x => (x.quote || '').trim())); }
function normalize(value){ return String(value || '').trim().toLowerCase(); }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[c])); }

function populateTopics(){
  const select = document.querySelector('#topic');
  select.innerHTML = TOPICS.map(([value,label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
  select.value = 'casuale';
}

async function loadPool(){
  try {
    const r = await fetch(`${POOL_URL}?v=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error('pool unavailable');
    const data = await r.json();
    pool = Array.isArray(data) ? data : [];
  } catch {
    pool = [];
  }
  await loadLatestFallback();
  updateAvailability();
}

async function loadLatestFallback(){
  if(pool.length) return;
  try {
    const r = await fetch(`${LATEST_URL}?v=${Date.now()}`, {cache:'no-store'});
    if(r.ok){ const post = await r.json(); if(post?.quote) pool = [post]; }
  } catch {}
}

function availableFor(topic){
  const used = usedQuotes();
  let list = pool.filter(p => p?.quote && !used.has(String(p.quote).trim()));
  if(topic && topic !== 'casuale'){
    const exact = list.filter(p => normalize(p.category) === normalize(topic));
    if(exact.length) list = exact;
    else {
      const related = list.filter(p => normalize(p.category).includes(normalize(topic)) || normalize(topic).includes(normalize(p.category)));
      if(related.length) list = related;
    }
  }
  return list;
}

function updateAvailability(){
  const topic = document.querySelector('#topic')?.value || 'casuale';
  const count = availableFor(topic).length;
  document.querySelector('#availableCount').textContent = `${count} disponibili`;
}

function renderPost(post, source='pool'){
  currentPost = post;
  document.querySelector('#quoteText').textContent = post.quote || '';
  document.querySelector('#author').textContent = `— ${post.author || 'Anonimo'}`;
  document.querySelector('#caption').value = post.caption || '';
  document.querySelector('#hashtags').value = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : String(post.hashtags || '');
  document.querySelector('#status').textContent = source === 'pool' ? `✓ Nuova proposta AI · ${post.category || 'varie'}` : '✓ Proposta di riserva caricata.';
}

function generateAnother(){
  let topic = document.querySelector('#topic').value || 'casuale';
  let candidates = availableFor(topic);
  if(!candidates.length && topic !== 'casuale') candidates = availableFor('casuale');
  if(!candidates.length) candidates = FALLBACK.filter(p => !usedQuotes().has(p.quote));
  if(!candidates.length){
    document.querySelector('#status').textContent = 'Hai esaurito le citazioni disponibili. Sto aspettando che la riserva AI venga ricaricata.';
    return;
  }
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  renderPost(chosen, 'pool');
  updateAvailability();
}

function renderHistory(){
  const h = getHistory();
  document.querySelector('#count').textContent = `${h.length} salvate`;
  const box = document.querySelector('#historyList');
  if(!h.length){ box.innerHTML = '<p class="empty">Le citazioni approvate appariranno qui.</p>'; return; }
  box.innerHTML = h.slice().reverse().map(x => `<div class="history-item"><div>${escapeHtml(x.quote)}<br><small>— ${escapeHtml(x.author)}</small></div><small>${escapeHtml(x.date)}</small></div>`).join('');
}

document.querySelector('#generate').onclick = generateAnother;
document.querySelector('#regenerate').onclick = generateAnother;
document.querySelector('#topic').onchange = updateAvailability;
document.querySelectorAll('.chip').forEach(btn => btn.onclick = () => {
  document.querySelector('#topic').value = btn.dataset.topic || 'casuale';
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  generateAnother();
});

document.querySelector('#approve').onclick = () => {
  if(!currentPost?.quote){ document.querySelector('#status').textContent = 'Prima genera una citazione.'; return; }
  const h = getHistory();
  if(h.some(x => x.quote === currentPost.quote)){
    document.querySelector('#status').textContent = 'Questa citazione è già stata approvata.';
    return;
  }
  h.push({
    quote: currentPost.quote,
    author: currentPost.author || 'Anonimo',
    category: currentPost.category || '',
    caption: currentPost.caption || '',
    hashtags: Array.isArray(currentPost.hashtags) ? currentPost.hashtags : String(currentPost.hashtags || ''),
    date: new Date().toLocaleString('it-IT')
  });
  saveHistory(h);
  document.querySelector('#status').textContent = '✓ Approvato e messo nell’archivio. Non verrà riproposto su questo dispositivo.';
};

populateTopics();
renderHistory();
loadPool().then(() => generateAnother());
