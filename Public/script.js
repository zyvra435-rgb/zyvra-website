document.addEventListener("DOMContentLoaded", () => {
  setupMenu();
  wireNavFilters();
  Promise.all([loadNews(), loadTicker()]);
});

// ----- Hamburger toggle
function setupMenu(){
  const btn = document.querySelector('.menu-toggle');
  const nav = document.getElementById('siteNav');
  if(!btn || !nav) return;
  btn.addEventListener('click', ()=>{
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // close on link click (mobile)
  nav.querySelectorAll('a').forEach(a=>{
    a.addEventListener('click', ()=> nav.classList.remove('open'));
  });
}

// ----- Category filter
function wireNavFilters(){
  document.querySelectorAll('nav a[data-cat]').forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const cat = a.getAttribute('data-cat');
      loadNews(cat);
    });
  });
}

// ----- News loader
async function loadNews(category='latest'){
  const grid = document.getElementById('newsGrid');
  grid.innerHTML = '<p style="color:#8aa">Loading…</p>';
  const url = category && category!=='latest' ? `/api/news?category=${encodeURIComponent(category)}` : '/api/news';
  try{
    const r = await fetch(url, { headers:{ 'cache-control':'no-cache' }});
    if(!r.ok){
      console.error('NEWS API error', r.status, await r.text());
      grid.innerHTML = '<p style="color:#f88;text-align:center">Failed to load news.</p>';
      return;
    }
    const js = await r.json();
    const items = Array.isArray(js.items) ? js.items : [];
    if(!items.length){
      grid.innerHTML = '<p style="color:#8aa;text-align:center">No articles yet.</p>';
      return;
    }
    grid.innerHTML = items.map(cardHTML).join('');
  }catch(err){
    console.error('NEWS fetch failed', err);
    grid.innerHTML = '<p style="color:#f88;text-align:center">Failed to load news.</p>';
  }
}

function cardHTML(a){
  const href = a.id ? `/a/${encodeURIComponent(a.id)}` : (a.url || '#');
  const img = a.imageUrl ? `<img src="${esc(a.imageUrl)}" alt="News">` : '';
  const desc = esc(a.description || '');
  const title = esc(a.title || '');
  return `<div class="news-card glow-card">
    ${img}
    <h3><a href="${href}" style="color:#00ffff;text-decoration:none">${title}</a></h3>
    <p>${desc}</p>
  </div>`;
}
function esc(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// ----- Ticker
async function loadTicker(){
  try{
    const r = await fetch('/api/ticker', { headers:{ 'cache-control':'no-cache' }});
    if(!r.ok) return;
    const t = await r.json();
    const bar = document.getElementById('ticker');
    const link = document.getElementById('tickerLink');
    if(t && t.active && t.text){
      bar.style.display = 'block';
      link.textContent = t.text;
      link.href = t.url || '/';
      // simple marquee
      let x = bar.clientWidth;
      const step = ()=>{
        x -= 1;
        link.style.left = x + 'px';
        if(x < -link.clientWidth) x = bar.clientWidth;
        requestAnimationFrame(step);
      };
      link.style.position='relative';
      requestAnimationFrame(step);
    } else {
      bar.style.display = 'none';
    }
  }catch(e){ /* ignore */ }
}
