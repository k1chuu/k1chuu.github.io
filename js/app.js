/**
 * k1chuu Blog - Unified Controller (Dynamic Config Loading)
 * This script runs on Home (index.html) and Archive (blog.html) pages.
 */

let BLOG_CONFIG = { site: {}, posts: [], author: { name: "k1chuu", bio: "" } };

// Determine root path based on app.js location
const APP_JS_PATH = document.querySelector('script[src*="js/app.js"]')?.getAttribute('src') || 'js/app.js';
const ROOT_PATH = APP_JS_PATH.replace('js/app.js', '');

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const escapeHtml = (str) => {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, m => map[m]);
};

/**
 * Standard Post Card HTML
 */
function renderPostCard(post) {
  // Use directory-based links
  const postUrl = `${ROOT_PATH}posts/${post.id}/`;
  return `
    <article class="post-card" data-post-id="${post.id}">
      <div class="post-meta">
        <span>${formatDate(post.date)}</span>
        <span>${post.readTime}</span>
      </div>
      <h2 class="post-title">
        <a href="${postUrl}">${escapeHtml(post.title)}</a>
      </h2>
      <p class="post-excerpt">${escapeHtml(post.excerpt)}</p>
      <div class="post-tags">
        ${post.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <a href="${postUrl}" class="read-more">Read Post →</a>
    </article>
  `;
}

/**
 * Automatic Tag Filter Generation
 */
function renderTagFilters() {
  const container = document.getElementById('tag-filters');
  if (!container) return;

  const tags = new Set();
  BLOG_CONFIG.posts.forEach(post => {
    if (post.tags) post.tags.forEach(tag => tags.add(tag));
  });

  const sortedTags = Array.from(tags).sort();
  
  container.innerHTML = `
    <button class="tag-filter-btn active" data-tag="all">All</button>
    ${sortedTags.map(tag => `
      <button class="tag-filter-btn" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
    `).join('')}
  `;
}

/**
 * Render Post Lists (Home/Archive)
 */
function renderPosts(filter = '', tag = 'all') {
  const container = document.getElementById('posts-container');
  if (!container) return;

  const isHomePage = container.getAttribute('data-view') === 'home';
  let posts = BLOG_CONFIG.posts.slice(); // Copy

  // Sorting: Newest first
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Tag Filtering
  if (tag && tag !== 'all') {
    posts = posts.filter(p => p.tags && p.tags.includes(tag));
  }

  // Search Filtering
  if (filter) {
    const lowerFilter = filter.toLowerCase();
    posts = posts.filter(p => 
      p.title.toLowerCase().includes(lowerFilter) || 
      p.excerpt.toLowerCase().includes(lowerFilter) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(lowerFilter)))
    );
  }

  // Slice for Home Page (limit 3)
  if (isHomePage) {
    posts = posts.slice(0, 3);
  }

  if (posts.length === 0) {
    container.innerHTML = `<p style="padding: 4rem; text-align: center; color: var(--text-dim); border: 1px dashed var(--border-subtle); border-radius: 12px;">No blog posts match your query or have been uploaded yet.</p>`;
    return;
  }

  container.innerHTML = posts.map(renderPostCard).join('');
}

/**
 * Inject Site Metadata
 */
function injectMetaData() {
  const logo = document.getElementById('site-logo');
  const tagline = document.getElementById('site-tagline');
  
  if (BLOG_CONFIG.site.logo && logo) {
    logo.textContent = BLOG_CONFIG.site.logo;
  }
  if (BLOG_CONFIG.site.tagline && tagline) {
    tagline.textContent = BLOG_CONFIG.site.tagline;
  }
  if (BLOG_CONFIG.site.title) {
    document.title = BLOG_CONFIG.site.title;
  }
}

/**
 * Setup Event Listeners (Search/Filters)
 * Now using Event Delegation for Tag Filters
 */
function setupEvents() {
  const sInput = document.getElementById('post-search');
  const tagContainer = document.getElementById('tag-filters');

  // Search input event
  sInput?.addEventListener('input', (e) => {
    const activeTag = document.querySelector('.tag-filter-btn.active')?.getAttribute('data-tag') || 'all';
    renderPosts(e.target.value, activeTag);
  });

  // Tag filter logic (using event delegation)
  tagContainer?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-filter-btn');
    if (!btn) return;

    // Toggle active class
    const allBtns = tagContainer.querySelectorAll('.tag-filter-btn');
    allBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tag = btn.getAttribute('data-tag');
    const searchVal = document.getElementById('post-search')?.value || '';
    renderPosts(searchVal, tag);
  });
}

/**
 * Initialization
 */
async function init() {
  try {
    const configPath = `${ROOT_PATH}config.json`;
    const response = await fetch(configPath);
    if (!response.ok) throw new Error('config load failed');
    BLOG_CONFIG = await response.json();
    
    // Inject metadata (Logo, Tagline, Title)
    injectMetaData();

    // Check which page we are on and render appropriately
    renderTagFilters();
    renderPosts();
    setupEvents();
    
    // Add active class to nav link based on current path
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav a').forEach(link => {
      const href = link.getAttribute('href');
      // Simple check: if href is current directory or part of path
      if (currentPath.endsWith(href) || (href !== './' && href !== '../' && currentPath.includes(href))) {
        // Clear all then set active
        // But we already have active handled in some HTML, let's unify it
        // actually let's leave HTML handling for now to avoid complexity unless 404s
      }
    });

  } catch (err) {
    console.error(err);
    const container = document.getElementById('posts-container');
    if (container) {
      container.innerHTML = `<p style="text-align:center; padding: 4rem; color: #ff5555;">⚠️ Configuration Error: Check the browser console or protocol (avoid file://).</p>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
