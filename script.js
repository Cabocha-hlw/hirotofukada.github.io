async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
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
  const year = item.year ?? 0;
  const month = item.month ?? 0;
  return year * 100 + month;
}

function sortWorksByDateDesc(items) {
  return [...items].sort((a, b) => getSortValue(b) - getSortValue(a));
}

function renderLinks(links = []) {
  const validLinks = links.filter((link) => link.url && link.url.trim() !== "");
  if (validLinks.length === 0) return "";

  return `
    <p class="work-links">
      ${validLinks
        .map(
          (link) =>
            `<a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)}</a>`
        )
        .join("")}
    </p>
  `;
}

function renderResearchItem(item) {
  return `
    <li class="work-item">
      <p class="work-citation">
        ${formatAuthors(item.authors, item.selfAuthors)}. (${escapeHTML(item.year)}).
        “${escapeHTML(item.title)}.”
        <em>${escapeHTML(item.venue)}</em>. ${escapeHTML(item.status)}.
      </p>
      ${renderLinks(item.links)}
    </li>
  `;
}

function renderProfessionalItem(item) {
  return `
    <li class="work-item">
      <p class="work-title">${escapeHTML(item.title)}</p>
      <p class="work-meta">${escapeHTML(item.meta)}</p>
      <p class="work-description">${escapeHTML(item.description)}</p>
      ${renderLinks(item.links)}
    </li>
  `;
}

function renderExperienceItem(group) {
  const rolesHTML = group.roles
    .map(
      (role) => `
        <div class="role-item">
          <h4>${escapeHTML(role.title)}</h4>
          ${role.period ? `<p class="role-period">${escapeHTML(role.period)}</p>` : ""}
          <p>${escapeHTML(role.description)}</p>
        </div>
      `
    )
    .join("");

  const highlightsHTML =
    group.highlights && group.highlights.length > 0
      ? `
        <div class="experience-highlights">
          <h4>Selected Highlights</h4>
          <ul>
            ${group.highlights.map((h) => `<li>${escapeHTML(h)}</li>`).join("")}
          </ul>
        </div>
      `
      : "";

  return `
    <article class="experience-group">
      <h3>${escapeHTML(group.organization)}</h3>
      <p class="experience-meta">${escapeHTML(group.period)}</p>
      ${rolesHTML}
      ${highlightsHTML}
    </article>
  `;
}

function renderEducationItem(item) {
  return `
    <article class="education-item">
      <h3>${escapeHTML(item.institution)}</h3>
      <p class="education-meta">${escapeHTML(item.program)} / ${escapeHTML(item.period)}</p>
      <p>${escapeHTML(item.description)}</p>
    </article>
  `;
}

function renderContacts(contacts) {
  return contacts
    .map(
      (contact) => `
        <li>
          <a href="${escapeHTML(contact.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHTML(contact.label)}
          </a>
        </li>
      `
    )
    .join("");
}

async function init() {
  try {
    const [profile, works, experience, education] = await Promise.all([
      loadJSON("data/profile.json"),
      loadJSON("data/works.json"),
      loadJSON("data/experience.json"),
      loadJSON("data/education.json")
    ]);

    document.getElementById("profile-name").textContent = profile.name;
    document.getElementById("profile-tagline").textContent = profile.tagline;
    document.getElementById("profile-about").textContent = profile.about;
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
  } catch (error) {
    console.error(error);
  }
}

init();