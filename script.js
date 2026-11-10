const API = "https://jsonplaceholder.typicode.com";
const PAGE_SIZE = 9;
const DEBOUNCE_DELAY = 300;

const state = {
  posts: [],
  users: [],
  visibleCount: PAGE_SIZE,
  searchTerm: "",
  writerId: "all",
  sortBy: "newest",
  searchTimer: null,
  activePostId: null,
  commentsRequest: null
};

const elements = {
  grid: document.getElementById("articlesGrid"),
  search: document.getElementById("searchInput"),
  writer: document.getElementById("writerFilter"),
  sort: document.getElementById("sortSelect"),
  resultCount: document.getElementById("resultCount"),
  clear: document.getElementById("clearFilters"),
  loadMore: document.getElementById("loadMoreButton"),
  empty: document.getElementById("emptyState"),
  error: document.getElementById("errorState"),
  retry: document.getElementById("retryButton"),
  articleStat: document.getElementById("articleStat"),
  writerStat: document.getElementById("writerStat"),
  modal: document.getElementById("articleModal"),
  modalPanel: document.getElementById("modalPanel"),
  modalContent: document.getElementById("modalContent"),
  closeModal: document.getElementById("closeModal"),
  themeToggle: document.getElementById("themeToggle"),
  menuToggle: document.getElementById("menuToggle"),
  mobileMenu: document.getElementById("mobileMenu"),
  newsletterForm: document.getElementById("newsletterForm"),
  email: document.getElementById("emailInput"),
  newsletterMessage: document.getElementById("newsletterMessage"),
  backToTop: document.getElementById("backToTop")
};

const coverGradients = [
  "from-[#E4572E] to-[#F2A65A]",
  "from-[#2E86AB] to-[#7FC8F8]",
  "from-[#3D9970] to-[#9BE7C4]",
  "from-[#6C4AB6] to-[#B9A6F2]",
  "from-[#D1495B] to-[#F6A6B2]"
];

async function getJSON(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function showSkeletons() {
  elements.grid.innerHTML = Array.from({ length: 6 }, () => `
    <div class="overflow-hidden rounded-card border border-line bg-card dark:border-night-line dark:bg-night-card">
      <div class="h-36 animate-pulse bg-line dark:bg-night-line"></div>
      <div class="space-y-4 p-5">
        <div class="h-3 w-1/3 animate-pulse rounded bg-line dark:bg-night-line"></div>
        <div class="h-5 w-5/6 animate-pulse rounded bg-line dark:bg-night-line"></div>
        <div class="h-3 w-full animate-pulse rounded bg-line dark:bg-night-line"></div>
        <div class="h-3 w-4/5 animate-pulse rounded bg-line dark:bg-night-line"></div>
      </div>
    </div>
  `).join("");
  elements.grid.setAttribute("aria-busy", "true");
}

async function loadInitialData() {
  setMainState("loading");
  showSkeletons();

  try {
    const [posts, users] = await Promise.all([
      getJSON(`${API}/posts`),
      getJSON(`${API}/users`)
    ]);

    state.posts = posts;
    state.users = users;

    elements.articleStat.textContent = posts.length;
    elements.writerStat.textContent = users.length;
    populateWriterFilter();
    elements.error.classList.add("hidden");
    renderArticles();
  } catch (error) {
    console.error("Could not load Inkwell data:", error);
    elements.grid.innerHTML = "";
    elements.grid.setAttribute("aria-busy", "false");
    elements.resultCount.textContent = "Articles could not be loaded.";
    elements.empty.classList.add("hidden");
    elements.loadMore.classList.add("hidden");
    elements.error.classList.remove("hidden");
  }
}

function setMainState(status) {
  elements.error.classList.toggle("hidden", status !== "error");
  if (status === "loading") {
    elements.empty.classList.add("hidden");
    elements.loadMore.classList.add("hidden");
  }
}

function populateWriterFilter() {
  const options = state.users
    .map(user => `<option value="${user.id}">${escapeHTML(user.name)}</option>`)
    .join("");

  elements.writer.innerHTML = `<option value="all">All writers</option>${options}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getWriter(post) {
  return state.users.find(user => user.id === post.userId);
}

function getFilteredAndSortedPosts() {
  const term = state.searchTerm.trim().toLowerCase();

  // filter() keeps the original state.posts array unchanged.
  const filtered = state.posts.filter(post => {
    const matchesSearch = !term ||
      post.title.toLowerCase().includes(term) ||
      post.body.toLowerCase().includes(term);

    const matchesWriter = state.writerId === "all" ||
      post.userId === Number(state.writerId);

    return matchesSearch && matchesWriter;
  });

  // Sort a copy so the original API array keeps its original order.
  const sorted = [...filtered];

  switch (state.sortBy) {
    case "oldest":
      sorted.sort((a, b) => a.id - b.id);
      break;
    case "az":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "za":
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case "newest":
    default:
      sorted.sort((a, b) => b.id - a.id);
  }

  return sorted;
}

function highlightSearch(text, term) {
  const safeText = escapeHTML(text);
  if (!term) return safeText;

  // Escape regex metacharacters supplied by the user.
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedTerm})`, "ig");
  return safeText.replace(regex, '<mark class="rounded bg-brand-soft px-0.5 text-ink dark:bg-brand-deep dark:text-night-ink">$1</mark>');
}

function createArticleCard(post) {
  const writer = getWriter(post);
  const writerName = writer ? writer.name : "Unknown writer";
  const initials = writerName.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase();
  const gradient = coverGradients[post.id % coverGradients.length];
  const readTime = Math.max(1, Math.ceil(post.body.split(/\s+/).length / 200));
  const title = post.title.charAt(0).toUpperCase() + post.title.slice(1);
  const preview = post.body.length > 112 ? `${post.body.slice(0, 112)}…` : post.body;

  return `
    <article class="article-card group flex cursor-pointer flex-col overflow-hidden rounded-card border border-line bg-card transition duration-200 hover:-translate-y-1 hover:shadow-card dark:border-night-line dark:bg-night-card"
      data-post-id="${post.id}" tabindex="0" role="button" aria-label="Read article: ${escapeHTML(title)}">
      <div class="relative flex h-36 items-end justify-between overflow-hidden bg-gradient-to-br ${gradient} p-5 text-white">
        <span class="font-mono text-xs tracking-widest opacity-90">INKWELL / ${String(post.id).padStart(3, "0")}</span>
        <span class="rounded-full border border-white/40 bg-black/10 px-2.5 py-1 font-mono text-[10px]">${readTime} MIN READ</span>
        <span class="pointer-events-none absolute -right-5 -top-12 h-36 w-36 rounded-full border border-white/20"></span>
        <span class="pointer-events-none absolute -right-1 -top-4 h-24 w-24 rounded-full border border-white/20"></span>
      </div>
      <div class="flex flex-1 flex-col p-5">
        <div class="mb-4 flex items-center gap-2">
          <span class="grid h-6 w-6 place-items-center rounded-full bg-brand-soft font-mono text-[9px] font-medium text-brand dark:bg-brand-deep dark:text-brand-light">${escapeHTML(initials)}</span>
          <span class="text-xs font-medium text-muted dark:text-night-muted">${escapeHTML(writerName)}</span>
        </div>
        <h3 class="mb-2 font-display text-xl font-semibold leading-snug group-hover:text-brand">${highlightSearch(title, state.searchTerm)}</h3>
        <p class="line-clamp-2 text-sm leading-relaxed text-muted dark:text-night-muted">${escapeHTML(preview)}</p>
        <div class="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs text-muted dark:border-night-line dark:text-night-muted">
          <span>Article ${post.id}</span>
          <span class="font-semibold text-brand">Read story ↗</span>
        </div>
      </div>
    </article>
  `;
}

function renderArticles() {
  const allMatches = getFilteredAndSortedPosts();
  const visiblePosts = allMatches.slice(0, state.visibleCount);
  const hasFilters = Boolean(state.searchTerm.trim()) || state.writerId !== "all";

  elements.grid.innerHTML = visiblePosts.map(createArticleCard).join("");
  elements.grid.setAttribute("aria-busy", "false");

  elements.resultCount.textContent = `Showing ${visiblePosts.length} of ${allMatches.length} articles`;
  elements.clear.classList.toggle("hidden", !hasFilters);
  elements.empty.classList.toggle("hidden", allMatches.length !== 0);
  elements.loadMore.classList.toggle("hidden", visiblePosts.length >= allMatches.length || allMatches.length === 0);
  elements.error.classList.add("hidden");
}

function resetAndRender() {
  state.visibleCount = PAGE_SIZE;
  renderArticles();
}

function clearFilters() {
  state.searchTerm = "";
  state.writerId = "all";
  state.sortBy = "newest";
  state.visibleCount = PAGE_SIZE;

  elements.search.value = "";
  elements.writer.value = "all";
  elements.sort.value = "newest";
  renderArticles();
}

function openArticle(postId) {
  const post = state.posts.find(item => item.id === Number(postId));
  if (!post) return;

  state.activePostId = post.id;
  const writer = getWriter(post);
  const writerName = writer ? writer.name : "Unknown writer";

  elements.modalContent.innerHTML = `
    <p class="mb-3 font-mono text-[10px] uppercase tracking-widest text-brand">Article ${post.id} · By ${escapeHTML(writerName)}</p>
    <h2 id="modalTitle" class="mb-5 font-display text-3xl font-bold leading-tight md:text-4xl">${escapeHTML(post.title.charAt(0).toUpperCase() + post.title.slice(1))}</h2>
    <p class="whitespace-pre-line text-base leading-relaxed text-muted dark:text-night-muted">${escapeHTML(post.body)}</p>
    <div class="mt-8 border-t border-line pt-6 dark:border-night-line">
      <h3 class="font-display text-2xl font-bold">The conversation</h3>
      <div id="commentsContainer" class="mt-4 space-y-4">
        <p class="text-sm text-muted dark:text-night-muted">Loading comments…</p>
      </div>
    </div>
  `;

  elements.modal.classList.remove("hidden");
  elements.modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
  elements.closeModal.focus();

  loadComments(post.id);
}

async function loadComments(postId) {
  if (state.commentsRequest) state.commentsRequest.abort();
  state.commentsRequest = new AbortController();

  const commentsContainer = document.getElementById("commentsContainer");
  if (!commentsContainer) return;

  try {
    const comments = await getJSON(`${API}/comments?postId=${postId}`, {
      signal: state.commentsRequest.signal
    });

    if (state.activePostId !== postId) return;

    commentsContainer.innerHTML = comments.length
      ? comments.map(comment => `
          <article class="rounded-lg bg-paper p-4 dark:bg-night">
            <p class="mb-1 text-sm font-semibold">${escapeHTML(comment.name)}</p>
            <p class="mb-2 text-xs text-brand">${escapeHTML(comment.email)}</p>
            <p class="text-sm leading-relaxed text-muted dark:text-night-muted">${escapeHTML(comment.body)}</p>
          </article>
        `).join("")
      : `<p class="text-sm text-muted dark:text-night-muted">No comments yet.</p>`;
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("Could not load comments:", error);
    if (commentsContainer.isConnected) {
      commentsContainer.innerHTML = `<p class="text-sm text-red-600">Comments couldn't be loaded. Please close and reopen the article to try again.</p>`;
    }
  }
}

function closeArticle() {
  if (state.commentsRequest) {
    state.commentsRequest.abort();
    state.commentsRequest = null;
  }
  state.activePostId = null;
  elements.modal.classList.add("hidden");
  elements.modal.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("inkwell-theme", theme);
  } catch (error) {
    console.warn("Theme preference could not be saved.", error);
  }
}

function toggleTheme() {
  const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(nextTheme);
}

function handleNewsletterSubmit(event) {
  event.preventDefault();
  const email = elements.email.value.trim();

  if (!email) {
    elements.newsletterMessage.textContent = "Please enter your email address.";
    elements.newsletterMessage.className = "basis-full text-sm font-medium text-red-700 sm:absolute sm:mt-14";
    elements.email.focus();
    return;
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!validEmail) {
    elements.newsletterMessage.textContent = "Please enter a valid email address.";
    elements.newsletterMessage.className = "basis-full text-sm font-medium text-red-700 sm:absolute sm:mt-14";
    elements.email.focus();
    return;
  }

  elements.newsletterMessage.textContent = "Thanks for subscribing! (Demo only — no email was sent.)";
  elements.newsletterMessage.className = "basis-full text-sm font-medium text-green-700 dark:text-green-400 sm:absolute sm:mt-14";
  elements.newsletterForm.reset();
}

function setupEventListeners() {
  elements.search.addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.searchTerm = elements.search.value.trim();
      resetAndRender();
    }, DEBOUNCE_DELAY);
  });

  elements.writer.addEventListener("change", () => {
    state.writerId = elements.writer.value;
    resetAndRender();
  });

  elements.sort.addEventListener("change", () => {
    state.sortBy = elements.sort.value;
    renderArticles();
  });

  elements.clear.addEventListener("click", clearFilters);

  elements.loadMore.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    renderArticles();
  });

  elements.retry.addEventListener("click", loadInitialData);
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.closeModal.addEventListener("click", closeArticle);

  // Event delegation: one listener handles all current and future article cards.
  elements.grid.addEventListener("click", event => {
    const card = event.target.closest("[data-post-id]");
    if (card) openArticle(card.dataset.postId);
  });

  elements.grid.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-post-id]");
    if (card) {
      event.preventDefault();
      openArticle(card.dataset.postId);
    }
  });

  elements.modal.addEventListener("click", event => {
    if (event.target === elements.modal) closeArticle();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !elements.modal.classList.contains("hidden")) {
      closeArticle();
    }
  });

  elements.menuToggle.addEventListener("click", () => {
    const isExpanded = elements.menuToggle.getAttribute("aria-expanded") === "true";
    elements.menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    elements.menuToggle.setAttribute("aria-label", isExpanded ? "Open navigation menu" : "Close navigation menu");
    elements.mobileMenu.classList.toggle("hidden", isExpanded);
    elements.menuToggle.textContent = isExpanded ? "☰" : "×";
  });

  document.querySelectorAll(".mobile-link").forEach(link => {
    link.addEventListener("click", () => {
      elements.mobileMenu.classList.add("hidden");
      elements.menuToggle.setAttribute("aria-expanded", "false");
      elements.menuToggle.setAttribute("aria-label", "Open navigation menu");
      elements.menuToggle.textContent = "☰";
    });
  });

  elements.newsletterForm.addEventListener("submit", handleNewsletterSubmit);

  window.addEventListener("scroll", () => {
    elements.backToTop.classList.toggle("hidden", window.scrollY < 500);
  });

  elements.backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

setupEventListeners();
loadInitialData();
