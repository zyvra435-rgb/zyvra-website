// Mobile menu (reuse)
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector('.menu-toggle');
  const nav = document.getElementById('siteNav');
  if (btn && nav) {
    btn.addEventListener('click', ()=>{
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> nav.classList.remove('open')));
  }

  // Weather search
  const q = document.getElementById('q');
  const btnSearch = document.getElementById('btnSearch');
  const results = document.getElementById('results');
  const out = document.getElementById('weatherOut');

  const onSearch = async () => {
    const term = (q.value||'').trim();
    if(!term){ q.focus(); return; }
    results.style.display='block';
    results.innerHTML = `<div style="padding:10px">Searching…</div>`;
    try{
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=10&language=en&format=json`);
      const gj = await geo.json();
      const list = Array.isArray(gj.results)? gj.results: [];
      if(!list.length){
        results.innerHTML = `<div style="padding:10px;color:#8aa">No cities found.</div>`;
        return;
      }
      results.innerHTML = list.map(ci => rowHTML(ci)).join('');
      results.querySelectorAll('button[data-lat]').forEach(b=>{
        b.addEventListener('click', ()=> loadForecast({
          name: b.getAttribute('data-name'),
          country: b.getAttribute('data-country'),
          lat: parseFloat(b.getAttribute('data-lat')),
          lon: parseFloat(b.getAttribute('data-lon'))
        }));
      });
    }catch(e){
      results.innerHTML = `<div style="padding:10px;color:#f88">Search failed.</div>`;
    }
  };
  btnSearch.addEventListener('click', onSearch);
  q.addEventListener('keydown', e=> { if(e.key==='Enter') onSearch(); });

  function rowHTML(ci){
    const name = esc(ci.name);
    const sub = [ci.admin1, ci.country].filter(Boolean).join(', ');
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08)">
      <div>
        <div style="font-weight:700">${name}</div>
        <div style="font-size:.9rem;color:#8aa">${esc(sub)}</div>
      </div>
      <button class="neon-btn" data-name="${escAttr(ci.name)}" data-country="${escAttr(ci.country||'')}" data-lat="${ci.latitude}" data-lon="${ci.longitude}">Select</button>
    </div>`;
  }

  async function loadForecast(city){
    results.style.display='none';
    out.innerHTML = `<p style="color:#8aa">Loading forecast…</p>`;
    try{
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
      const r = await fetch(url);
      const wx = await r.json();
      out.innerHTML = renderForecast(city, wx);
    }catch(e){
      out.innerHTML = `<p style="color:#f88">Failed to load forecast.</p>`;
    }
  }

  function renderForecast(city, wx){
    const cur = wx.current || {};
    const daily = (wx.daily && wx.daily.time) ? wx.daily.time.map((t,i)=>({
      date: t,
      code: wx.daily.weather_code[i],
      tmax: wx.daily.temperature_2m_max[i],
      tmin: wx.daily.temperature_2m_min[i],
      p: wx.daily.precipitation_probability_max[i]
    })) : [];

    const header = `
      <div class="glass" style="padding:14px;border-radius:12px;margin-top:8px">
        <div style="font-size:1.1rem;font-weight:700;color:#0ff">${esc(city.name)}, ${esc(city.country||'')}</div>
        <div style="margin-top:6px;display:flex;gap:16px;flex-wrap:wrap;color:#ddd">
          <div>Now: <b>${n(cur.temperature_2m)}°C</b> (Feels ${n(cur.apparent_temperature)}°C)</div>
          <div>Humidity: <b>${n(cur.relative_humidity_2m)}%</b></div>
          <div>Wind: <b>${n(cur.wind_speed_10m)} km/h</b></div>
          <div>${codeText(cur.weather_code)}</div>
        </div>
      </div>`;

    const days = daily.map(d => `
      <div class="news-card" style="text-align:left">
        <div style="color:#8aa;font-size:.9rem">${fmtDate(d.date)}</div>
        <div style="margin:6px 0;font-weight:700;color:#0ff">${codeText(d.code)}</div>
        <div>Max: ${n(d.tmax)}°C &nbsp; Min: ${n(d.tmin)}°C</div>
        <div>Rain chance: ${n(d.p)}%</div>
      </div>
    `).join('');

    return `
      ${header}
      <div class="news-grid" style="margin-top:12px">${days || `<p style="color:#8aa">No daily data.</p>`}</div>
    `;
  }

  function codeText(c){
    const m = {
      0:'Clear', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
      45:'Fog', 48:'Rime fog',
      51:'Drizzle', 53:'Drizzle', 55:'Drizzle',
      61:'Rain', 63:'Rain', 65:'Heavy rain',
      66:'Freezing rain', 67:'Freezing rain',
      71:'Snow', 73:'Snow', 75:'Heavy snow',
      80:'Rain showers', 81:'Rain showers', 82:'Heavy rain showers',
      95:'Thunderstorm', 96:'Thunderstorm hail', 99:'Thunderstorm hail'
    };
    return m[c] || '—';
  }
  function esc(s){ return String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function escAttr(s){ return String(s||'').replace(/"/g,'&quot;'); }
  function n(v){ return (v==null||isNaN(v)) ? '—' : Math.round(v); }
  function fmtDate(s){
    const d = new Date(s+'T00:00:00'); // safe
    return d.toLocaleDateString(undefined,{ weekday:'short', month:'short', day:'numeric' });
  }
});
