document.addEventListener('DOMContentLoaded', () => {
  // mobile menu
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

  // auth nav
  (async function checkAuth(){
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
    }catch{}
    if(logoutLink){
      logoutLink.onclick = async(e)=>{ e.preventDefault(); try{await fetch('/api/auth/logout',{method:'POST'})}catch{} location.reload(); };
    }
  })();

  const liveGrid = document.getElementById('liveGrid');
  const resGrid  = document.getElementById('resGrid');
  const upGrid   = document.getElementById('upGrid');
  const refreshBtn = document.getElementById('refreshBtn');

  const esc = s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtInnings = arr => (!Array.isArray(arr)||!arr.length) ? '—' : arr.map(x=>`${esc(x.inning)}: ${x.r}/${x.w} (${x.o})`).join(' · ');
  const whenLocal = iso => iso ? new Date(iso+'Z').toLocaleString() : '';

  function card(m, kind){
    const title = m.name || `${(m.teams||[]).join(' vs ')}`;
    const teams = (m.teams||[]).join(' vs ');
    const when  = whenLocal(m.dateTimeGMT);
    const status = String(m.status||'');
    const resultLine = (kind==='result' && (m.winner || m.tie || m.draw || m.noResult))
      ? `<div class="score-res">
          ${m.winner ? `<strong>Winner:</strong> ${esc(m.winner)}${m.margin?` <span class="muted">(${esc(m.margin)})</span>`:''}`:''}
          ${m.tie ? `<span class="muted">Match tied</span>`:''}
          ${m.draw ? `<span class="muted">Draw</span>`:''}
          ${m.noResult ? `<span class="muted">No result</span>`:''}
        </div>` : '';

    return `<article class="score-card glass">
      <div class="score-top">
        <div class="score-title">${esc(title || teams)}</div>
        <div class="score-status${kind==='result' ? ' res' : ''}">${esc(status)}</div>
      </div>
      <div class="score-sub muted">${esc(teams)} · ${esc(m.venue||'')}</div>
      <div class="score-line">${fmtInnings(m.score)}</div>
      ${resultLine}
      <div class="score-time muted">${esc(when)}</div>
    </article>`;
  }

  function renderSection(el, items, emptyText){
    if(!items || !items.length){ el.innerHTML = `<p class="wx-note">${emptyText}</p>`; return; }
    el.innerHTML = items.map(it => {
      const kind = el===resGrid ? 'result' : (el===liveGrid ? 'live' : 'up');
      return card(it, kind);
    }).join('');
  }

  async function load(force=false){
    liveGrid.innerHTML = `<p class="wx-note">Loading…</p>`;
    resGrid.innerHTML  = `<p class="wx-note">Loading…</p>`;
    upGrid.innerHTML   = `<p class="wx-note">Loading…</p>`;
    try{
      const r = await fetch(`/api/cricket/feed${force ? '?refresh=1':''}`);
      let j; try { j = await r.json(); } catch { throw new Error('bad_json'); }
      if(!r.ok) throw new Error(j?.error || 'server_error');

      renderSection(liveGrid, j.live, 'No live match right now');
      renderSection(resGrid,  j.results, 'No finished match today/yesterday');
      renderSection(upGrid,   j.upcoming, 'No upcoming match today/tomorrow');
    }catch(e){
      const msg = String(e?.message || 'failed');
      liveGrid.innerHTML = resGrid.innerHTML = upGrid.innerHTML =
        `<p class="wx-note err">Failed to load (${esc(msg)})</p>`;
    }
  }

  refreshBtn.addEventListener('click', ()=> load(true));
  load(false);
});
