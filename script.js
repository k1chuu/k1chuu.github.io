(async () => {
  const app = document.getElementById('app');
  const navLinks = document.querySelectorAll('.nav-link');
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.querySelector('.site-nav');
  const footerAuthor = document.getElementById('footer-author');
  const yearSpan = document.getElementById('year');

  let config = {};
  let postsData = [];          // all posts (sorted newest first)
  let activeTag = null;

  const converter = new showdown.Converter({ metadata: true, tables: true });

  // ---------- Initialisation ----------
  try {
    const res = await fetch('/config.json');   // absolute
    if (!res.ok) throw new Error('config.json not found');
    config = await res.json();
    postsData = config.posts || [];
    postsData.sort((a, b) => new Date(b.date) - new Date(a.date));
    applyConfigSettings();

    // If we arrived from a 404 redirect, restore the original path
    const redirectPath = sessionStorage.getItem('redirect');
    if (redirectPath) {
      sessionStorage.removeItem('redirect');
      history.replaceState(null, '', redirectPath);
    }

    // Handle the current URL
    handleRoute(window.location.pathname);

    // Listen for browser back/forward
    window.addEventListener('popstate', () => handleRoute(window.location.pathname));
  } catch (err) {
    app.innerHTML = `<div class="error">Failed to load site. ${err.message}</div>`;
    return;
  }

  navToggle.addEventListener('click', () => siteNav.classList.toggle('open'));

  // ---------- Navigate with pushState (clean URLs) ----------
  function navigateTo(url) {
    history.pushState(null, '', url);
    handleRoute(new URL(url, window.location.origin).pathname);
  }

  // ---------- Determine which page to render ----------
  function handleRoute(path) {
    updateActiveNav(path);
    if (siteNav.classList.contains('open')) siteNav.classList.remove('open');

    if (path.startsWith('/post/')) {
      const slug = path.replace('/post/', '');
      renderSinglePost(slug);
    } else if (path === '/blog') {
      const params = new URLSearchParams(window.location.search);
      activeTag = params.get('tag') || null;
      renderBlogPage();
    } else if (path === '/about') {
      renderAboutPage();
    } else {
      renderHomePage();   // everything else goes home
    }
  }

  // ---------- Site config (title, footer, accent) ----------
  function applyConfigSettings() {
    document.title = config.blogTitle;
    footerAuthor.textContent = config.authorName;
    yearSpan.textContent = new Date().getFullYear();
    if (config.accentColor) {
      document.documentElement.style.setProperty('--accent', config.accentColor);
    }
  }

  function updateActiveNav(currentPath) {
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === currentPath || (currentPath === '/' && href === '/'));
    });
  }

  // ---------- Home page (5 recent logs) ----------
  function renderHomePage() {
    const recentPosts = postsData.slice(0, 5);
    if (!recentPosts.length) {
      app.innerHTML = '<div class="empty-message">No logs yet. The streets are quiet.</div>';
      return;
    }
    const postsHTML = recentPosts.map(post => renderPostCard(post)).join('');
    app.innerHTML = `
      <h2 style="font-family:var(--font-heading); font-weight:400; margin-bottom:2rem;">Recent Log Files</h2>
      <div class="post-list">${postsHTML}</div>
      <a href="/blog" class="back-button view-all-link" style="margin-top:1.5rem;">View All Log Files →</a>
    `;
    attachPostCardListeners();
    attachNavigateListeners('.view-all-link');
  }

  // ---------- Blog page (all logs + search + filter) ----------
  function renderBlogPage() {
    const allTags = [...new Set(postsData.flatMap(p => p.tags))];
    const filterBarHTML = `
      <div class="filter-bar">
        <input type="search" id="post-search" class="search-bar" placeholder="Search log files..." value="">
        <div class="tag-filters">
          ${allTags.map(tag => `<button class="tag-btn" data-tag="${tag}">${tag}</button>`).join('')}
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

    const applyFiltersAndRender = () => {
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
      attachPostCardListeners();
    };

    searchInput.addEventListener('input', applyFiltersAndRender);

    tagButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        activeTag = (activeTag === tag) ? null : tag;
        const url = activeTag ? `/blog?tag=${encodeURIComponent(activeTag)}` : '/blog';
        history.replaceState(null, '', url);
        document.querySelectorAll('.tag-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.tag === activeTag)
        );
        applyFiltersAndRender();
      });
    });

    applyFiltersAndRender();
  }

  // ---------- Single post page ----------
  async function renderSinglePost(slug) {
    const postMeta = postsData.find(p => p.slug === slug);
    if (!postMeta) {
      app.innerHTML = '<div class="error">Post not found.</div>';
      return;
    }
    app.innerHTML = '<div class="loading">Loading log file…</div>';
    try {
      const mdRes = await fetch(`/posts/${slug}.md`);
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
          <a href="/blog" class="back-button">← Back to Logs</a>
        </article>
      `;
      attachNavigateListeners('.back-button');
    } catch (err) {
      app.innerHTML = `<div class="error">Could not load post. ${err.message}</div>`;
    }
  }

  // ---------- About page ----------
  async function renderAboutPage() {
    app.innerHTML = '<div class="loading">Loading dossier…</div>';
    try {
      const res = await fetch('/posts/about.md');
      if (!res.ok) throw new Error('about.md not found');
      const mdText = await res.text();
      const htmlContent = converter.makeHtml(mdText);
      app.innerHTML = `
        <div class="about-section">
          <div class="post-content">${htmlContent}</div>
          <a href="/" class="back-button">← Back to Home</a>
        </div>
      `;
      attachNavigateListeners('.back-button');
    } catch (err) {
      app.innerHTML = `<div class="error">Could not load About page. ${err.message}</div>`;
    }
  }

  // ---------- Post card HTML ----------
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

  // ---------- Click handlers for cards and tags ----------
  function attachPostCardListeners() {
    document.querySelectorAll('.post-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('card-tag')) return;
        const slug = card.dataset.slug;
        navigateTo(`/post/${slug}`);
      });
    });

    document.querySelectorAll('.card-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        const tagText = tag.dataset.tag;
        navigateTo(`/blog?tag=${encodeURIComponent(tagText)}`);
      });
    });
  }

  function attachNavigateListeners(selector) {
    document.querySelectorAll(selector).forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/')) {
          e.preventDefault();
          navigateTo(href);
        }
      });
    });
  }

  // ---------- Header navigation ----------
  document.querySelector('.site-logo').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('/');
  });

  document.querySelectorAll('.site-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      navigateTo(href);
    });
  });

  // ---------- Close mobile nav on outside click ----------
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.site-nav') && !e.target.closest('.nav-toggle') && siteNav.classList.contains('open')) {
      siteNav.classList.remove('open');
    }
  });
})();
