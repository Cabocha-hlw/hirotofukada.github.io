// ── i18n ──────────────────────────────────────────────────────
const UI = {
  en: {
    nav: {
      about: "About",
      work: "Work",
      experience: "Experience",
      education: "Education",
      contact: "Contact",
    },
    eyebrow: {
      about: "About",
      portfolio: "Portfolio",
      career: "Career",
      academic: "Academic",
      contact: "Get in Touch",
    },
    section: {
      about: "Overview",
      work: "Selected Work",
      experience: "Experience",
      education: "Education",
      contact: "Contact",
    },
    workCategory: {
      research: "Research Outputs",
      upcoming: "Upcoming Presentations",
      professional: "Professional Works",
    },
    highlights: "Selected Highlights",
  },
  ja: {
    nav: {
      about: "プロフィール",
      work: "実績",
      experience: "経歴",
      education: "学歴",
      contact: "連絡先",
    },
    eyebrow: {
      about: "プロフィール",
      portfolio: "ポートフォリオ",
      career: "キャリア",
      academic: "学歴",
      contact: "お問い合わせ",
    },
    section: {
      about: "概要",
      work: "主な実績",
      experience: "職歴",
      education: "学歴",
      contact: "連絡先",
    },
    workCategory: {
      research: "研究成果",
      upcoming: "今後の発表",
      professional: "職務実績",
    },
    highlights: "主な実績",
  },
};

let currentLang = localStorage.getItem("lang") || "en";

/** Get the localized value of a field, falling back to the base key. */
function t(obj, key) {
  if (currentLang === "ja" && obj[`${key}_ja`] !== undefined) {
    return obj[`${key}_ja`];
  }
  return obj[key] ?? "";
}

/** Resolve a dot-path like "nav.about" against UI[currentLang]. */
function ui(path) {
  return path.split(".").reduce((o, k) => o?.[k], UI[currentLang]) ?? path;
}

// ── Utilities ──────────────────────────────────────────────────
async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAuthors(authors, selfAuthors = []) {
  return authors
    .map((author) =>
      selfAuthors.includes(author)
        ? `<strong>${escapeHTML(author)}</strong>`
        : escapeHTML(author)
    )
    .join(", ");
}

function getSortValue(item) {
  return (item.year ?? 0) * 100 + (item.month ?? 0);
}

function sortWorksByDateDesc(items) {
  return [...items].sort((a, b) => getSortValue(b) - getSortValue(a));
}

function renderLinks(links = []) {
  const valid = links.filter((l) => l.url && l.url.trim() !== "");
  if (valid.length === 0) return "";
  return `
    <p class="work-links">
      ${valid
        .map(
          (l) =>
            `<a href="${escapeHTML(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(l.label)}</a>`
        )
        .join("")}
    </p>
  `;
}

// ── Render functions ──────────────────────────────────────────
function renderResearchItem(item) {
  return `
    <li class="work-item">
      <p class="work-citation">
        ${formatAuthors(item.authors, item.selfAuthors)}. (${escapeHTML(String(item.year))}).
        "${escapeHTML(item.title)}."
        <em>${escapeHTML(item.venue)}</em>. ${escapeHTML(t(item, "status"))}.
      </p>
      ${renderLinks(item.links)}
    </li>
  `;
}

function renderProfessionalItem(item) {
  return `
    <li class="work-item">
      <p class="work-title">${escapeHTML(t(item, "title"))}</p>
      <p class="work-meta">${escapeHTML(t(item, "meta"))}</p>
      <p class="work-description">${escapeHTML(t(item, "description"))}</p>
      ${renderLinks(item.links)}
    </li>
  `;
}

function renderExperienceItem(group) {
  const rolesHTML = group.roles
    .map(
      (role) => `
        <div class="role-item">
          <h4>${escapeHTML(t(role, "title"))}</h4>
          ${role.period ? `<p class="role-period">${escapeHTML(role.period)}</p>` : ""}
          <p>${escapeHTML(t(role, "description"))}</p>
        </div>
      `
    )
    .join("");

  const highlights = t(group, "highlights") || [];
  const highlightsHTML =
    highlights.length > 0
      ? `
        <div class="experience-highlights">
          <h4>${escapeHTML(ui("highlights"))}</h4>
          <ul>
            ${highlights.map((h) => `<li>${escapeHTML(h)}</li>`).join("")}
          </ul>
        </div>
      `
      : "";

  return `
    <article class="experience-group">
      <h3>${escapeHTML(t(group, "organization"))}</h3>
      <p class="experience-meta">${escapeHTML(group.period)}</p>
      ${rolesHTML}
      ${highlightsHTML}
    </article>
  `;
}

function renderEducationItem(item) {
  return `
    <article class="education-item">
      <h3>${escapeHTML(t(item, "institution"))}</h3>
      <p class="education-meta">${escapeHTML(t(item, "program"))} / ${escapeHTML(item.period)}</p>
      <p>${escapeHTML(t(item, "description"))}</p>
    </article>
  `;
}

function renderContacts(contacts) {
  return contacts
    .map(
      (c) => `
        <li>
          <a href="${escapeHTML(c.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHTML(c.label)}
          </a>
        </li>
      `
    )
    .join("");
}

// ── i18n DOM update ───────────────────────────────────────────
function applyUIStrings() {
  document.getElementById("html-root").lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = ui(el.dataset.i18n);
  });
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === currentLang);
  });
}

// ── Data cache & re-render ─────────────────────────────────────
let _cache = null;

function renderAll(data) {
  const { profile, works, experience, education } = data;

  document.getElementById("profile-name").textContent = profile.name;
  document.getElementById("profile-tagline").textContent = t(profile, "tagline");
  document.getElementById("profile-about").textContent = t(profile, "about");
  document.getElementById("contact-list").innerHTML = renderContacts(profile.contacts);

  document.getElementById("research-outputs").innerHTML = sortWorksByDateDesc(
    works.filter((item) => item.type === "research")
  )
    .map(renderResearchItem)
    .join("");

  document.getElementById("upcoming-presentations").innerHTML = sortWorksByDateDesc(
    works.filter((item) => item.type === "upcoming")
  )
    .map(renderResearchItem)
    .join("");

  document.getElementById("professional-works").innerHTML = sortWorksByDateDesc(
    works.filter((item) => item.type === "professional")
  )
    .map(renderProfessionalItem)
    .join("");

  document.getElementById("experience-list").innerHTML = sortWorksByDateDesc(experience)
    .map(renderExperienceItem)
    .join("");

  document.getElementById("education-list").innerHTML = sortWorksByDateDesc(education)
    .map(renderEducationItem)
    .join("");
}

// ── Language switch ────────────────────────────────────────────
function setLang(lang) {
  currentLang = lang;
  localStorage.setItem("lang", lang);
  applyUIStrings();
  if (_cache) renderAll(_cache);
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  try {
    const [profile, works, experience, education] = await Promise.all([
      loadJSON("data/profile.json"),
      loadJSON("data/works.json"),
      loadJSON("data/experience.json"),
      loadJSON("data/education.json"),
    ]);

    _cache = { profile, works, experience, education };

    applyUIStrings();
    renderAll(_cache);
  } catch (error) {
    console.error(error);
  }
}

// ── Event listeners ────────────────────────────────────────────
document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => setLang(btn.dataset.lang));
});

init();
