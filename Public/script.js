// Zyvra client
document.addEventListener("DOMContentLoaded", () => {
  // highlight: brand clickable already <a href="/">...</a> in HTML
  console.log("Zyvra client ready");
  boot();
});

async function boot() {
  wireNavFilters();
  await Promise.all([loadNews(), loadTicker()]);
}

// ---- Nav filters
function wireNavFilters() {
  document.querySelectorAll('nav a[data-cat]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = a.getAttribute('data-cat');
      loadNews(cat);
    });
  });
}

// ---- Load news
async function loadNews(category = 'latest') {
  const grid = document.getElementById('newsGrid');
  grid.innerHTML = '<p style="color:#8aa">Loading…</p>';
  try {
    const url = category && category !== 'latest' ? `/api/news?category=${encodeURIComponent(category)}` : '/api/news';
    const r = await fetch(url);
    const js = await r.json();
    const items = Array.isArray(js.items) ? js.items : [];
    if (!items.length) {
      grid.innerHTML = '<p style="color:#8aa;text-align:center">No articles yet.</p>';
      return;
    }
    grid.innerHTML = items.map(cardHTML).join('');
  } catch (e) {
    grid.innerHTML = '<p style="color:#f88">Failed to load news.</p>';
  }
}
function cardHTML(a) {
  const href = a.id ? `/a/${encodeURIComponent(a.id)}` : (a.url || '#');
  const img = a.imageUrl ? `<img src="${esc(a.imageUrl)}" alt="News">` : '';
  const desc = esc(a.description || '');
  const title = esc(a.title || '');
  return `
  <div class="news-card glow-card">
    ${img}
    <h3><a href="${href}" style="color:#00ffff;text-decoration:none">${title}</a></h3>
    <p>${desc}</p>
  </div>`;
}
function esc(s){ return String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// ---- Ticker
async function loadTicker(){
  try{
    const r = await fetch('/api/ticker');
    const t = await r.json();
    const bar = document.getElementById('ticker');
    const link = document.getElementById('tickerLink');
    if (t && t.active && t.text){
      link.textContent = t.text;
      link.href = t.url || '/';
      bar.style.display = 'block';
      // simple marquee effect
      bar.style.position = 'relative';
      link.style.position = 'relative';
      let x = bar.clientWidth;
      const step = () => {
        x -= 1;
        link.style.left = x + 'px';
        if (x < -link.clientWidth) x = bar.clientWidth;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else {
      bar.style.display = 'none';
    }
  }catch(e){ /* ignore */ }
}
