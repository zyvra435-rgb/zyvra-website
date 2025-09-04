(function(){
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const $ = sel => document.querySelector(sel);

  if (!id) {
    $('#title').textContent = 'Article not found';
    $('#content').textContent = 'Missing id in URL.';
    return;
  }

  fetch(`/api/news/${encodeURIComponent(id)}`)
    .then(r => r.json())
    .then(({item}) => {
      if (!item) throw new Error('Not found');

      $('#title').textContent = item.title || 'Untitled';
      const when = item.publishedAt ? new Date(item.publishedAt).toLocaleString() : '';
      $('#meta').textContent = `${item.source || 'Zyvra'} · ${when}`;

      if (item.imageUrl) {
        const hero = $('#hero');
        hero.src = item.imageUrl;
        hero.style.display = '';
      }

      // Content: treat as plain text, convert newlines to line breaks
      const content = (item.content || '').trim();
      if (content) {
        $('#content').innerHTML = escapeHtml(content).replace(/\n/g,'<br>');
      } else {
        $('#content').innerHTML = '<em>No content provided.</em>';
      }

      // If external URL also given, show optional link
      if (item.url) {
        $('#ext').innerHTML = `<a href="${item.url}" target="_blank" class="neon-btn" style="text-decoration:none">Original source</a>`;
      }
    })
    .catch(() => {
      $('#title').textContent = 'Article not found';
      $('#content').textContent = 'This article may have been removed.';
    });

  function escapeHtml(s='') {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
})();
