(async () => {
  // --- DOM References ---
  const app = document.getElementById('app');
  const navLinks = document.querySelectorAll('.nav-link');
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.querySelector('.site-nav');
  const footerAuthor = document.getElementById('footer-author');
  const yearSpan = document.getElementById('year');

  // --- Global State ---
  let config = {};
  let postsData = [];          // all posts (sorted newest first)
  let activeTag = null;        // currently active tag (string) or null

  const converter = new showdown.Converter({ metadata: true, tables: true });

  // --- Initialization ---
  try {
    const res = await fetch('./config.json');
    if (!res.ok) throw new Error('config.json not found');
    config = await res.json();
    postsData = config.posts || [];
    // Sort newest first
    postsData.sort((a, b) => new Date(b.date) - new Date(a.date));
    applyConfigSettings();
    handleRouteChange();       // initial render
  } catch (err) {
    app.innerHTML = `<div class="error">Failed to load site. ${err.message}</div>`;
    return;
  }

  window.addEventListener('hashchange', handleRouteChange);
  navToggle.addEventListener('click', () => siteNav.classList.toggle('open'));

  // --- Apply site config ---
  function applyConfigSettings() {
    document.title = config.blogTitle;
    footerAuthor.textContent = config.authorName;
    yearSpan.textContent = new Date().getFullYear();
    if (config.accentColor) {
      document.documentElement.style.setProperty('--accent', config.accentColor);
    }
  }

  function updateActiveNav() {
    const currentHash = window.location.hash || '#home';
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href').startsWith(currentHash.split('?')[0]));
    });
  }

  // --- Hash parameter parser ---
  function getHashParams(hash) {
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return {};
    const queryString = hash.substring(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    return Object.fromEntries(params.entries());
  }

  // --- Router ---
  function handleRouteChange() {
    const hash = window.location.hash || '#home';
    updateActiveNav();
    if (siteNav.classList.contains('open')) siteNav.classList.remove('open');

    if (hash === '#home' || hash === '') {
      renderHomePage();
    } else if (hash.startsWith('#blog')) {
      // Extract tag from ?tag=... if present
      const params = getHashParams(hash);
      activeTag = params.tag || null;
      renderBlogPage();
    } else if (hash === '#about') {
      renderAboutPage();
    } else if (hash.startsWith('#post/')) {
      const slug = hash.replace('#post/', '');
      renderSinglePost(slug);
    } else {
      renderHomePage();        // fallback
    }
  }

  // --- HOME PAGE: Recent 5 posts ---
  function renderHomePage() {
    const recentPosts = postsData.slice(0, 5);

    if (!recentPosts.length) {
      app.innerHTML = '<div class="empty-message">No cases yet. The streets are quiet.</div>';
      return;
    }

    const postsHTML = recentPosts.map(post => renderPostCard(post)).join('');

    app.innerHTML = `
      <h2 style="font-family:var(--font-heading); font-weight:400; margin-bottom:2rem;">Recent Logs</h2>
      <div class="post-list">${postsHTML}</div>
      <a href="#blog" class="back-button view-all-link" style="margin-top:1.5rem;">View All Log Files →</a>
    `;

    attachPostCardListeners();
  }

  // --- BLOG PAGE: All posts + filter bar ---
  function renderBlogPage() {
    const allTags = [...new Set(postsData.flatMap(p => p.tags))]; // unique tags

    const filterBarHTML = `
      <div class="filter-bar">
        <input type="search" id="post-search" class="search-bar" placeholder="Search Log Files..." value="">
        <div class="tag-filters">
          ${allTags.map(tag => `
            <button class="tag-btn" data-tag="${tag}">${tag}</button>
          `).join('')}
        </div>
      </div>
      <div id="results-info" class="results-info"></div>
    `;

    app.innerHTML = `
      <h2 style="font-family:var(--font-heading); font-weight:400; margin-bottom:1rem;">All Log Files</h2>
      ${filterBarHTML}
      <div id="post-list-container"></div>
    `;

    const searchInput = document.getElementById('post-search');
    const tagButtons = document.querySelectorAll('.tag-btn');
    const postListContainer = document.getElementById('post-list-container');
    const resultsInfo = document.getElementById('results-info');

    function applyFiltersAndRender() {
      const searchTerm = searchInput.value.toLowerCase().trim();
      const filtered = postsData.filter(post => {
        if (activeTag && !post.tags.includes(activeTag)) return false;
        if (searchTerm) {
          const inTitle = post.title.toLowerCase().includes(searchTerm);
          const inExcerpt = post.excerpt ? post.excerpt.toLowerCase().includes(searchTerm) : false;
          if (!inTitle && !inExcerpt) return false;
        }
        return true;
      });

      resultsInfo.textContent = filtered.length === 0
        ? 'No logs match your search.'
        : `Found ${filtered.length} log${filtered.length !== 1 ? 's' : ''}.`;

      postListContainer.innerHTML = filtered.length === 0
        ? ''
        : `<div class="post-list">${filtered.map(post => renderPostCard(post)).join('')}</div>`;

      // Highlight the active tag button
      document.querySelectorAll('.tag-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tag === activeTag);
      });

      attachPostCardListeners();
    }

    searchInput.addEventListener('input', applyFiltersAndRender);

    tagButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        activeTag = (activeTag === tag) ? null : tag;
        // Optionally update the hash without reload
        const newHash = activeTag ? `#blog?tag=${encodeURIComponent(activeTag)}` : '#blog';
        history.replaceState(null, '', newHash);
        applyFiltersAndRender();
      });
    });

    // Initial render (activeTag already set from hash)
    applyFiltersAndRender();
  }

  // --- Post card HTML generator ---
  function renderPostCard(post) {
    const dateFormatted = new Date(post.date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const tagsHTML = (post.tags || []).map(tag => `<span class="card-tag" data-tag="${tag}">${tag}</span>`).join('');
    return `
      <article class="post-card" data-slug="${post.slug}">
        <h2 class="card-title">${post.title}</h2>
        <div class="card-meta">
          <span class="card-date">${dateFormatted}</span>
          <span class="card-read-time">· ${post.readTime || ''}</span>
        </div>
        <div class="card-tags">${tagsHTML}</div>
        <p class="card-excerpt">${post.excerpt || ''}</p>
      </article>
    `;
  }

  // --- Attach listeners to cards and tags ---
  function attachPostCardListeners() {
    // Post card click navigates to the single post
    document.querySelectorAll('.post-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // If the click was on a tag, don't navigate
        if (e.target.classList.contains('card-tag')) return;
        window.location.hash = `#post/${card.dataset.slug}`;
      });
    });

    // Tag click navigates to blog with that tag filter
    document.querySelectorAll('.card-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();         // important: don't trigger card click
        const tagText = tag.dataset.tag;
        window.location.hash = `#blog?tag=${encodeURIComponent(tagText)}`;
      });
    });
  }

  // --- Single Post ---
  async function renderSinglePost(slug) {
    const postMeta = postsData.find(p => p.slug === slug);
    if (!postMeta) {
      app.innerHTML = '<div class="error">Post not found.</div>';
      return;
    }

    app.innerHTML = '<div class="loading">Loading case file…</div>';

    try {
      const mdRes = await fetch(`./posts/${slug}.md`);
      if (!mdRes.ok) throw new Error('Failed to load post content');
      const mdText = await mdRes.text();
      const htmlContent = converter.makeHtml(mdText);
      const dateFormatted = new Date(postMeta.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      app.innerHTML = `
        <article class="single-post">
          <header class="post-header">
            <h1 class="post-title">${postMeta.title}</h1>
            <div class="post-meta">
              <span>${dateFormatted}</span>
              <span>· ${postMeta.readTime || ''}</span>
            </div>
          </header>
          <div class="post-content">${htmlContent}</div>
          <a href="#blog" class="back-button">← Back to Logs</a>
        </article>
      `;
    } catch (err) {
      app.innerHTML = `<div class="error">Could not load post. ${err.message}</div>`;
    }
  }

  // --- About Page ---
  async function renderAboutPage() {
    app.innerHTML = '<div class="loading">Loading dossier…</div>';
    try {
      const res = await fetch('./posts/about.md');
      if (!res.ok) throw new Error('about.md not found');
      const mdText = await res.text();
      const htmlContent = converter.makeHtml(mdText);
      app.innerHTML = `
        <div class="about-section">
          <div class="post-content">${htmlContent}</div>
          <a href="#home" class="back-button">← Back to Home</a>
        </div>
      `;
    } catch (err) {
      app.innerHTML = `<div class="error">Could not load About page. ${err.message}</div>`;
    }
  }

  // Close mobile nav when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.site-nav') && !e.target.closest('.nav-toggle') && siteNav.classList.contains('open')) {
      siteNav.classList.remove('open');
    }
  });
})();