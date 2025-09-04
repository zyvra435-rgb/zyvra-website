// Open-Meteo free APIs: https://geocoding-api.open-meteo.com/, https://api.open-meteo.com/
document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu reuse
  const menuBtn = document.getElementById('menuBtn');
  const mainNav = document.getElementById('mainNav');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mainNav.addEventListener('click', (e)=>{
      const a = e.target.closest('a'); if(!a) return;
      document.body.classList.remove('nav-open');
      menuBtn.setAttribute('aria-expanded','false');
    });
  }

  // Simple auth nav visibility
  checkAuth();
  async function checkAuth(){
    const loginEl  = document.getElementById('navLogin');
    const signupEl = document.getElementById('navSignup');
    const adminEl  = document.getElementById('navAdmin');
    const logoutLi = document.getElementById('navLogout');
    const logoutLink = document.getElementById('logoutLink');
    try{
      const r = await fetch('/api/auth/me');
      if(r.ok){
        const j = await r.json();
        loginEl&&(loginEl.style.display='none');
        signupEl&&(signupEl.style.display='none');
        logoutLi&&(logoutLi.style.display='');
        adminEl&&(adminEl.style.display=(j.user?.role==='admin')?'':'none');
      }else{
        loginEl&&(loginEl.style.display='');
        signupEl&&(signupEl.style.display='');
        logoutLi&&(logoutLi.style.display='none');
        adminEl&&(adminEl.style.display='none');
      }
    }catch{
      logoutLi&&(logoutLi.style.display='none');
      adminEl&&(adminEl.style.display='none');
    }
    if(logoutLink){
      logoutLink.onclick = async(e)=>{ e.preventDefault(); try{await fetch('/api/auth/logout',{method:'POST'})}catch{} location.reload(); };
    }
  }

  // Elements
  const input = document.getElementById('wxInput');
  const btn   = document.getElementById('wxBtn');
  const clr   = document.getElementById('wxClear');
  const list  = document.getElementById('wxResults');
  const curEl = document.getElementById('wxCurrent');
  const dailyEl = document.getElementById('wxDaily');

  let debounce;
  function show(msg){ list.innerHTML = `<p class="wx-note">${msg}</p>`; }
  function esc(s=''){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // Geocoding search
  async function searchPlaces(q){
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('geo_failed');
    return r.json();
  }

  // Forecast fetch
  async function getForecast(lat, lon){
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
      hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability',
      daily: 'temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,precipitation_probability_max,sunrise,sunset',
      timezone: 'auto'
    });
    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('wx_failed');
    return r.json();
  }

  // UI handlers
  async function runSearch(){
    const q = input.value.trim();
    if(!q){ list.innerHTML=''; return; }
    show('Searching…');
    try{
      const j = await searchPlaces(q);
      const results = Array.isArray(j?.results) ? j.results : [];
      if(!results.length){ show('No places found'); return; }
      list.innerHTML = results.map(rowHTML).join('');
      // attach click
      [...list.querySelectorAll('.wx-item')].forEach(a=>{
        a.addEventListener('click', async (e)=>{
          e.preventDefault();
          const { lat, lon, name } = a.dataset;
          await loadWeather(parseFloat(lat), parseFloat(lon), name);
          window.scrollTo({ top: curEl.offsetTop - 60, behavior:'smooth' });
        });
      });
    }catch{
      show('Search failed');
    }
  }

  function rowHTML(p){
    const admin = p.admin1 ? `, ${p.admin1}` : '';
    const name = `${p.name}${admin}, ${p.country}`;
    return `<a href="#" class="wx-item">
      <div class="wx-title">${esc(name)}</div>
      <div class="wx-sub">${esc(p.latitude.toFixed(3))}, ${esc(p.longitude.toFixed(3))} · Elev ${esc(p.elevation)}m</div>
      <span class="wx-go">View</span>
    </a>
    <span style="display:none"
      data-name="${esc(name)}"
      data-lat="${esc(p.latitude)}"
      data-lon="${esc(p.longitude)}"></span>`.replace('<a','<a data-name="'+esc(name)+'" data-lat="'+p.latitude+'" data-lon="'+p.longitude+'"');
  }

  function wmo(code){
    const c = Number(code);
    if(c===0) return 'Clear sky';
    if([1,2,3].includes(c)) return 'Cloudy';
    if([45,48].includes(c)) return 'Fog';
    if([51,53,55].includes(c)) return 'Drizzle';
    if([61,63,65,80,81,82].includes(c)) return 'Rain';
    if([66,67].includes(c)) return 'Freezing rain';
    if([71,73,75,85,86,77].includes(c)) return 'Snow';
    if(c===95) return 'Thunderstorm';
    if([96,99].includes(c)) return 'Thunderstorm + hail';
    return '—';
  }
  function degToDir(d){
    const dir = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dir[Math.round(((d%360)+360)%360 / 22.5) % 16];
  }

  async function loadWeather(lat, lon, placeName=''){
    curEl.style.display='block';
    curEl.innerHTML = `<p class="wx-note">Loading weather…</p>`;
    dailyEl.innerHTML = '';
    try{
      const j = await getForecast(lat, lon);
      // Current
      const c = j.current || {};
      const tz = j.timezone || 'local';
      const nowStr = new Date(j.current?.time || Date.now()).toLocaleString();

      curEl.innerHTML = `
        <div class="wx-current-head">
          <div>
            <h2>${esc(placeName || `${lat.toFixed(2)}, ${lon.toFixed(2)}`)}</h2>
            <div class="muted">${esc(tz)} · Updated ${esc(nowStr)}</div>
          </div>
          <div class="wx-current-temp">${Math.round(c.temperature_2m)}°C</div>
        </div>
        <div class="wx-current-grid">
          <div class="wx-box"><div class="wx-k">Condition</div><div class="wx-v">${esc(wmo(c.weather_code))}</div></div>
          <div class="wx-box"><div class="wx-k">Feels</div><div class="wx-v">${Math.round(c.apparent_temperature)}°C</div></div>
          <div class="wx-box"><div class="wx-k">Humidity</div><div class="wx-v">${c.relative_humidity_2m}%</div></div>
          <div class="wx-box"><div class="wx-k">Wind</div><div class="wx-v">${Math.round(c.wind_speed_10m)} km/h ${degToDir(c.wind_direction_10m||0)}</div></div>
          <div class="wx-box"><div class="wx-k">Precip</div><div class="wx-v">${c.precipitation ?? 0} mm</div></div>
          <div class="wx-box"><div class="wx-k">Day/Night</div><div class="wx-v">${c.is_day ? 'Day' : 'Night'}</div></div>
        </div>
      `;

      // Daily
      const d = j.daily || {};
      const n = Math.min(d.time?.length || 0, 7);
      if(n){
        const cards = [];
        for(let i=0;i<n;i++){
          const t = new Date(d.time[i]);
          const day = t.toLocaleDateString(undefined,{ weekday:'short' });
          const max = Math.round(d.temperature_2m_max[i]);
          const min = Math.round(d.temperature_2m_min[i]);
          const pr  = d.precipitation_probability_max?.[i] ?? 0;
          const uv  = d.uv_index_max?.[i] ?? 0;
          const rise= d.sunrise?.[i] ? new Date(d.sunrise[i]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
          const set = d.sunset?.[i]  ? new Date(d.sunset[i]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})  : '';
          cards.push(`
            <div class="wx-day glass">
              <div class="wx-day-top">
                <div class="wx-day-name">${esc(day)}</div>
                <div class="wx-day-temp"><strong>${max}°</strong> / ${min}°</div>
              </div>
              <div class="wx-day-row"><span>Rain chance</span><span>${pr}%</span></div>
              <div class="wx-day-row"><span>UV max</span><span>${uv}</span></div>
              <div class="wx-day-row"><span>Sunrise</span><span>${rise}</span></div>
              <div class="wx-day-row"><span>Sunset</span><span>${set}</span></div>
            </div>
          `);
        }
        dailyEl.innerHTML = cards.join('');
      } else {
        dailyEl.innerHTML = '';
      }
    }catch{
      curEl.innerHTML = `<p class="wx-note err">Failed to load weather</p>`;
      dailyEl.innerHTML = '';
    }
  }

  // Events
  if(input){
    input.addEventListener('input', ()=>{
      clr.style.display = input.value.trim() ? '' : 'none';
      if(debounce) clearTimeout(debounce);
      debounce = setTimeout(runSearch, 300);
    });
    input.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); runSearch(); }});
  }
  btn && (btn.onclick = runSearch);
  clr && (clr.onclick = ()=>{ input.value=''; clr.style.display='none'; list.innerHTML=''; input.focus(); });

  // Prefill by IP-less geolocation? Keep manual for now.
});
