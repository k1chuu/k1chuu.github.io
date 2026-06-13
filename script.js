(async () => {
  'use strict';

  // ─── DOM References ───────────────────────────────────────
  const app = document.getElementById('app');
  const footerAuthor = document.getElementById('footer-author');
  const yearSpan = document.getElementById('year');
  const scrollTopBtn = document.getElementById('scroll-top');
  const readingProgress = document.getElementById('reading-progress');

  // ─── State ────────────────────────────────────────────────
  let config = {};
  let postsData = [];
  let activeTag = null;
  let currentRoute = null;
  let isTransitioning = false;

  const converter = new showdown.Converter({
    metadata: true,
    tables: true,
    simplifiedAutoLink: true,
    strikethrough: true,
    tasklists: true,
    openLinksInNewWindow: false
  });

  // ─── Utilities ────────────────────────────────────────────

  /**
   * Debounce helper — delays function execution until pause in calls.
   * @param {Function} fn
   * @param {number} delay - milliseconds
   * @returns {Function}
   */
  function debounce(fn, delay = 200) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Sanitize text for safe innerHTML insertion.
   * Prevents basic XSS by escaping HTML entities.
   * @param {string} str
   * @returns {string}
   */
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Scroll to top of page smoothly.
   */
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /**
   * Update reading progress bar based on scroll position.
   */
  function updateReadingProgress() {
    if (!readingProgress) return;
    const article = document.querySelector('.single-post');
    if (!article) {
      readingProgress.classList.remove('visible');
      readingProgress.style.width = '0%';
      return;
    }
    const rect = article.getBoundingClientRect();
    const articleTop = rect.top + window.scrollY;
    const articleHeight = rect.height;
    const scrolled = window.scrollY - articleTop;
    const progress = Math.min(Math.max((scrolled / (articleHeight - window.innerHeight)) * 100, 0), 100);

    if (scrolled > 0) {
      readingProgress.classList.add('visible');
      readingProgress.style.width = `${progress}%`;
    } else {
      readingProgress.classList.remove('visible');
      readingProgress.style.width = '0%';
    }
  }

  /**
   * Show/hide scroll-to-top button based on scroll position.
   */
  function updateScrollTopButton() {
    if (!scrollTopBtn) return;
    if (window.scrollY > 400) {
      scrollTopBtn.classList.add('visible');
      scrollTopBtn.hidden = false;
    } else {
      scrollTopBtn.classList.remove('visible');
      scrollTopBtn.hidden = true;
    }
  }

  /**
   * Add copy buttons to all code blocks in post content.
   */
  function addCodeCopyButtons() {
    const codeBlocks = document.querySelectorAll('.post-content pre');
    codeBlocks.forEach(pre => {
      // Avoid double-wrapping
      if (pre.parentElement.classList.contains('code-block-wrapper')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = 'copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.addEventListener('click', async () => {
        try {
          const code = pre.querySelector('code') ? pre.querySelector('code').textContent : pre.textContent;
          await navigator.clipboard.writeText(code);
          btn.textContent = 'copied';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'copy';
            btn.classList.remove('copied');
          }, 2000);
        } catch {
          btn.textContent = 'failed';
          setTimeout(() => { btn.textContent = 'copy'; }, 2000);
        }
      });
      wrapper.appendChild(btn);
    });
  }

  /**
   * Update active navigation link based on current route.
   */
  function updateActiveNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
      const nav = link.dataset.nav;
      if (currentRoute === 'blog' && nav === 'blog') {
        link.classList.add('active');
      } else if (currentRoute === 'about' && nav === 'about') {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /**
   * Update document title based on route.
   */
  function updateTitle(title) {
    if (title) {
      document.title = `${title} — ${config.blogTitle || 'k1chuu'}`;
    } else {
      document.title = config.blogTitle || 'k1chuu';
    }
  }

  // ─── Initialisation ──────────────────────────────────────
  try {
    const res = await fetch('/config.json');
    if (!res.ok) throw new Error('config.json not found');
    config = await res.json();
    postsData = config.posts || [];
    postsData.sort((a, b) => new Date(b.date) - new Date(a.date));
    applyConfigSettings();

    // Handle GitHub Pages 404 redirect
    const redirectPath = sessionStorage.getItem('redirect');
    if (redirectPath) {
      sessionStorage.removeItem('redirect');
      history.replaceState(null, '', redirectPath);
    }

    handleRoute(window.location.pathname);
    window.addEventListener('popstate', () => handleRoute(window.location.pathname));
  } catch (err) {
    app.innerHTML = `<div class="error">Failed to load site.<br><small>${escapeHTML(err.message)}</small></div>`;
    return;
  }

  // ─── Global Event Listeners ──────────────────────────────

  // Scroll listeners
  window.addEventListener('scroll', () => {
    updateScrollTopButton();
    updateReadingProgress();
  }, { passive: true });

  // Scroll-to-top button
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Header logo click
  document.querySelector('.site-logo').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('/');
  });

  // Navigation link clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.getAttribute('href'));
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // `/` to focus search (when on blog page)
    if (e.key === '/' && !isInputFocused()) {
      e.preventDefault();
      const searchInput = document.getElementById('post-search');
      if (searchInput) searchInput.focus();
    }
    // Escape to blur search
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('post-search');
      if (searchInput && document.activeElement === searchInput) {
        searchInput.blur();
      }
    }
  });

  function isInputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  // ─── Routing ─────────────────────────────────────────────

  function navigateTo(url) {
    if (isTransitioning) return;
    history.pushState(null, '', url);
    handleRoute(new URL(url, window.location.origin).pathname);
  }

  async function handleRoute(path) {
    if (isTransitioning) return;
    isTransitioning = true;

    // Page transition animation
    app.classList.add('transitioning');
    await new Promise(resolve => setTimeout(resolve, 150));

    if (path.startsWith('/post/')) {
      const slug = path.replace('/post/', '');
      currentRoute = 'post';
      await renderSinglePost(slug);
    } else if (path === '/blog') {
      const params = new URLSearchParams(window.location.search);
      activeTag = params.get('tag') || null;
      currentRoute = 'blog';
      renderBlogPage();
    } else if (path === '/about') {
      currentRoute = 'about';
      await renderAboutPage();
    } else {
      // Default route: about page
      currentRoute = 'about';
      await renderAboutPage();
    }

    scrollToTop();
    updateActiveNav();
    updateReadingProgress();

    // Remove transition class and re-add animation
    app.classList.remove('transitioning');
    app.style.animation = 'none';
    // Force reflow
    void app.offsetHeight;
    app.style.animation = '';

    isTransitioning = false;
  }

  function applyConfigSettings() {
    document.title = config.blogTitle;
    footerAuthor.textContent = config.authorName;
    yearSpan.textContent = new Date().getFullYear();
    if (config.accentColor) {
      document.documentElement.style.setProperty('--accent', config.accentColor);
    }
  }

  // ─── Blog Page ───────────────────────────────────────────

  function renderBlogPage() {
    updateTitle('Blog');
    const allTags = [...new Set(postsData.flatMap(p => p.tags))].sort();
    const filterBarHTML = `
      <div class="filter-bar">
        <input type="search" id="post-search" class="search-bar" placeholder="Search posts... (/)" value="" autocomplete="off">
        <div class="tag-filters">
          ${allTags.map(tag => `<button class="tag-btn${activeTag === tag ? ' active' : ''}" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`).join('')}
        </div>
      </div>
    `;

    app.innerHTML = `
      <h2 class="blog-page-title">k1chuu's Blog</h2>
      ${filterBarHTML}
      <div id="post-list-container"></div>
    `;

    const searchInput = document.getElementById('post-search');
    const tagButtons = document.querySelectorAll('.tag-btn');
    const postListContainer = document.getElementById('post-list-container');

    const applyFiltersAndRender = () => {
      const searchTerm = searchInput.value.toLowerCase().trim();
      const filtered = postsData.filter(post => {
        if (activeTag && !post.tags.includes(activeTag)) return false;
        if (searchTerm) {
          const inTitle = post.title.toLowerCase().includes(searchTerm);
          const inExcerpt = post.excerpt ? post.excerpt.toLowerCase().includes(searchTerm) : false;
          const inTags = post.tags.some(t => t.toLowerCase().includes(searchTerm));
          if (!inTitle && !inExcerpt && !inTags) return false;
        }
        return true;
      });

      postListContainer.innerHTML = filtered.length === 0
        ? '<div class="empty-message">No logs match your search.</div>'
        : `<div class="post-list">${filtered.map(renderPostCard).join('')}</div>`;

      attachPostCardListeners();
    };

    // Debounced search for better performance
    const debouncedFilter = debounce(applyFiltersAndRender, 200);
    searchInput.addEventListener('input', debouncedFilter);

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

  // ─── Single Post ─────────────────────────────────────────

  async function renderSinglePost(slug) {
    const postMeta = postsData.find(p => p.slug === slug);
    if (!postMeta) {
      app.innerHTML = '<div class="error">Post not found.</div>';
      updateTitle('Not Found');
      return;
    }

    updateTitle(postMeta.title);
    app.innerHTML = '<div class="loading">Loading log file</div>';

    try {
      const mdRes = await fetch(`/posts/${slug}.md`);
      if (!mdRes.ok) throw new Error('Failed to load post content');
      const mdText = await mdRes.text();
      const htmlContent = converter.makeHtml(mdText);
      const dateFormatted = new Date(postMeta.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      const tagsHTML = (postMeta.tags || []).map(tag =>
        `<span class="post-tag">${escapeHTML(tag)}</span>`
      ).join('');

      app.innerHTML = `
        <article class="single-post">
          <header class="post-header">
            <h1 class="post-title">${escapeHTML(postMeta.title)}</h1>
            <div class="post-meta">
              <span>${dateFormatted}</span>
              <span>&middot; ${postMeta.readTime || ''}</span>
            </div>
            <div class="post-tags">${tagsHTML}</div>
          </header>
          <div class="post-content">${htmlContent}</div>
          <a href="/blog" class="back-button">&larr; Back to blog</a>
        </article>
      `;

      // Add copy buttons to code blocks
      addCodeCopyButtons();

      // Attach back button listener
      attachNavigateListeners('.back-button');
    } catch (err) {
      app.innerHTML = `<div class="error">Could not load post.<br><small>${escapeHTML(err.message)}</small></div>`;
    }
  }

  // ─── About Page ──────────────────────────────────────────

  async function renderAboutPage() {
    updateTitle(null);
    app.innerHTML = '<div class="loading">Loading dossier</div>';

    try {
      const res = await fetch('/about.md');
      if (!res.ok) throw new Error('about.md not found');
      const mdText = await res.text();
      const htmlContent = converter.makeHtml(mdText);

      // Remove first <h1> if it is exactly "# whoami"
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      const firstH1 = tempDiv.querySelector('h1');
      if (firstH1 && firstH1.textContent.trim().toLowerCase() === 'whoami') {
        firstH1.remove();
      }
      const aboutContentCleaned = tempDiv.innerHTML;

      // SVG logo (same as favicon)
      const svgLogo = `<svg class="about-logo-svg" viewBox="0 0 42.4 36" width="120" height="102" fill="currentColor" style="display:block; margin:0 auto 1.5rem;">
  <path d="M25.8,13.8h2.8v5.5h-2.8v-5.5ZM13.8,16.6v2.8h2.8v-5.5h-2.8v2.8ZM32.2,0v2.8h-2.8V0h2.8ZM26.7,5.5h2.8v-2.8h-2.8v2.8ZM21.2,5.5h-5.5v2.8h11.1v-2.8h-5.5ZM12.8,2.8v2.8h2.8v-2.8h-2.8ZM10.1,0v2.8h2.8V0h-2.8ZM7.3,5.5v5.5h2.8V2.8h-2.8v2.8ZM4.5,13.8v2.8H0v2.8h2.8v2.8H0v2.8h2.8v11.1h2.8v-8.3h5.5v-2.8h-5.5v-8.3h1.9v-5.5h-2.9v2.8ZM35,5.5v-2.8h-2.8v8.3h2.8v-5.5ZM42.4,19.4v-2.8h-4.7v-5.5h-2.8v5.5h1.9v8.3h-5.5v2.8h5.5v8.3h2.8v-11.1h2.8v-2.8h-2.8v-2.8h2.8Z"/>
</svg>`;

      const aboutHeaderHTML = `
        <div class="about-header">
          <h1 class="whoami-heading"># whoami</h1>
          ${svgLogo}
          <p class="threat-slayer">k1chuu</p>
          <div class="about-contact-links">
            <a href="https://twitter.com/k1chuu" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="Twitter">
              <svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://github.com/k1chuu" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="GitHub">
              <svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
            <a href="mailto:pingkishore@proton.me" class="social-icon" aria-label="Email">
              <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            </a>
          </div>
        </div>
        <div class="about-content">${aboutContentCleaned}</div>
      `;

      app.innerHTML = aboutHeaderHTML;
      attachNavigateListeners('.about-content a');
    } catch (err) {
      app.innerHTML = `<div class="error">Could not load About page.<br><small>${escapeHTML(err.message)}</small></div>`;
    }
  }

  // ─── Render Helpers ──────────────────────────────────────

  function renderPostCard(post) {
    const dateFormatted = new Date(post.date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const tagsHTML = (post.tags || []).map(tag => {
      return `<span class="card-tag" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</span>`;
    }).join('');
    return `
      <article class="post-card" data-slug="${escapeHTML(post.slug)}" role="link" tabindex="0" aria-label="Read: ${escapeHTML(post.title)}">
        <h2 class="card-title">${escapeHTML(post.title)}</h2>
        <div class="card-meta">
          <span class="card-date">${dateFormatted}</span>
          <span class="card-read-time">&middot; ${post.readTime || ''}</span>
        </div>
        <div class="card-tags">${tagsHTML}</div>
      </article>
    `;
  }

  function attachPostCardListeners() {
    document.querySelectorAll('.post-card').forEach(card => {
      // Click handler
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('card-tag')) return;
        const slug = card.dataset.slug;
        navigateTo(`/post/${slug}`);
      });

      // Keyboard handler (Enter/Space to navigate)
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (e.target.classList.contains('card-tag')) return;
          const slug = card.dataset.slug;
          navigateTo(`/post/${slug}`);
        }
      });
    });

    document.querySelectorAll('.card-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        const tagText = tag.dataset.tag;
        navigateTo(`/blog?tag=${encodeURIComponent(tagText)}`);
      });

      tag.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          e.preventDefault();
          const tagText = tag.dataset.tag;
          navigateTo(`/blog?tag=${encodeURIComponent(tagText)}`);
        }
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
})();
