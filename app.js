const STORAGE_KEY = "mochiPortfolioDataV1";

let appData = loadData();
let activeProjectFilter = "All";
let activeMapFilter = "All";
let activeSkillIndex = 0;
let lastFocusedElement = null;

const projectGrid = document.getElementById("project-grid");
const mapGrid = document.getElementById("map-grid");
const projectFilters = document.getElementById("project-filters");
const mapFilters = document.getElementById("map-filters");
const skillList = document.getElementById("skill-list");
const skillDetail = document.getElementById("skill-detail");
const modal = document.getElementById("detail-modal");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");
const toast = document.getElementById("toast");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultData() {
  return {
    profile: clone(profile),
    projects: clone(projects),
    maps: clone(maps),
    skills: clone(skills)
  };
}

function loadData() {
  const defaults = defaultData();
  if (ENABLE_LOCAL_ADMIN) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return mergeData(defaults, JSON.parse(stored));
    } catch (error) {
      console.warn("Could not load portfolio data from localStorage.", error);
    }
  }
  return defaults;
}

function mergeData(base, custom) {
  return {
    profile: { ...base.profile, ...(custom.profile || {}) },
    projects: Array.isArray(custom.projects) ? custom.projects : clone(base.projects),
    maps: Array.isArray(custom.maps) ? custom.maps : clone(base.maps),
    skills: Array.isArray(custom.skills) ? custom.skills : clone(base.skills)
  };
}

function saveData() {
  if (!ENABLE_LOCAL_ADMIN) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(url) {
  const clean = String(url || "#").trim();
  if (!clean) return "#";
  if (clean === "#") return "#";
  if (/^(https?:|mailto:|tel:|discord:)/i.test(clean)) return clean;
  return "#";
}

function listFromValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function linksFromValue(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split("\n")
    .map(line => {
      const parts = line.split("|");
      return { label: (parts[0] || "Link").trim(), url: (parts[1] || "#").trim() };
    })
    .filter(link => link.label);
}

function linksToText(links) {
  return (links || []).map(link => `${link.label || "Link"} | ${link.url || "#"}`).join("\n");
}

function renderAll() {
  renderProfile();
  renderFilters();
  renderProjects();
  renderMaps();
  renderSkills();
  renderAdminEditors();
}

function renderProfile() {
  document.getElementById("hero-status").textContent = appData.profile.status;
  document.getElementById("hero-copy").textContent = appData.profile.heroCopy;
  document.getElementById("current-focus").textContent = appData.profile.currentFocus;
  document.getElementById("about-title").textContent = appData.profile.aboutTitle;
  document.getElementById("about-text").textContent = appData.profile.aboutText;
  const contactIntro = document.getElementById("contact-intro");
  if (contactIntro) contactIntro.textContent = appData.profile.contactIntro;
  document.getElementById("stat-projects").textContent = appData.projects.length;
  document.getElementById("stat-maps").textContent = appData.maps.length;
  document.getElementById("stat-skills").textContent = appData.skills.length;

  const contactLinks = document.getElementById("contact-links");
  if (contactLinks) {
    contactLinks.innerHTML = "";
    appData.profile.contactLinks.forEach(link => {
      const item = document.createElement("a");
      const href = safeUrl(link.href);
      item.className = "contact-link";
      item.href = href;
      item.target = href.startsWith("http") ? "_blank" : "";
      item.rel = "noreferrer";
      item.innerHTML = `<strong>${escapeHtml(link.label)}</strong><span>${escapeHtml(link.value)}</span>`;
      contactLinks.appendChild(item);
    });
  }
}

function getCategories(items, key) {
  return ["All", ...Array.from(new Set(items.map(item => item[key]).filter(Boolean)))];
}

function renderFilters() {
  renderFilterButtons(projectFilters, getCategories(appData.projects, "category"), activeProjectFilter, value => {
    activeProjectFilter = value;
    renderProjects();
  });

  renderFilterButtons(mapFilters, getCategories(appData.maps, "category"), activeMapFilter, value => {
    activeMapFilter = value;
    renderMaps();
  });
}

function renderFilterButtons(container, values, active, onSelect) {
  container.innerHTML = "";
  values.forEach(value => {
    const button = document.createElement("button");
    button.className = "filter-btn" + (value === active ? " active" : "");
    button.type = "button";
    button.textContent = value;
    button.setAttribute("aria-pressed", value === active ? "true" : "false");
    button.addEventListener("click", () => onSelect(value));
    container.appendChild(button);
  });
}

function createPreview(item) {
  const preview = document.createElement("div");
  preview.className = "preview";
  if (item.previewGradient) preview.style.background = item.previewGradient;

  if (item.previewImage) {
    const img = document.createElement("img");
    img.src = item.previewImage;
    img.alt = `${item.title} preview`;
    img.loading = "lazy";
    preview.appendChild(img);
  }

  return preview;
}

function renderProjects() {
  projectGrid.innerHTML = "";
  const filtered = activeProjectFilter === "All"
    ? appData.projects
    : appData.projects.filter(project => project.category === activeProjectFilter);

  filtered.forEach(project => {
    const card = document.createElement("article");
    card.className = "card clickable";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open details for ${project.title}`);
    card.appendChild(createPreview(project));
    card.insertAdjacentHTML("beforeend", `
      <div class="card-body">
        <div class="meta"><span>${escapeHtml(project.category)}</span><span>${escapeHtml(project.monthYear)}</span></div>
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.shortDescription)}</p>
        <div class="tags">${(project.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      </div>
    `);
    card.addEventListener("click", () => openProjectModal(project));
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProjectModal(project);
      }
    });
    projectGrid.appendChild(card);
  });
}

function renderMaps() {
  mapGrid.innerHTML = "";
  const filtered = activeMapFilter === "All"
    ? appData.maps
    : appData.maps.filter(map => map.category === activeMapFilter);

  filtered.forEach(map => {
    const card = document.createElement("article");
    card.className = "card clickable";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open details for ${map.title}`);
    card.appendChild(createPreview(map));
    card.insertAdjacentHTML("beforeend", `
      <div class="card-body">
        <div class="meta"><span>${escapeHtml(map.game)}</span><span>${escapeHtml(map.monthYear)}</span></div>
        <h3>${escapeHtml(map.title)}</h3>
        <p>${escapeHtml(map.shortDescription)}</p>
        <div class="tags">
          <span class="tag">${escapeHtml(map.status)}</span>
          ${(map.features || []).slice(0, 3).map(feature => `<span class="tag">${escapeHtml(feature)}</span>`).join("")}
        </div>
      </div>
    `);
    card.addEventListener("click", () => openMapModal(map));
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMapModal(map);
      }
    });
    mapGrid.appendChild(card);
  });
}

function renderSkills() {
  skillList.innerHTML = "";
  if (!appData.skills.length) {
    skillDetail.innerHTML = "<h3>No skills yet</h3><p>Add skill data in data.js.</p>";
    return;
  }

  activeSkillIndex = Math.min(activeSkillIndex, appData.skills.length - 1);

  appData.skills.forEach((skill, index) => {
    const button = document.createElement("button");
    button.className = "skill-choice" + (index === activeSkillIndex ? " active" : "");
    button.type = "button";
    button.innerHTML = `<span>${escapeHtml(skill.name)}</span><span>${escapeHtml(skill.level)}%</span>`;
    button.addEventListener("click", () => {
      activeSkillIndex = index;
      renderSkills();
    });
    skillList.appendChild(button);
  });

  const skill = appData.skills[activeSkillIndex];
  skillDetail.style.setProperty("--level", `${Number(skill.level) || 0}%`);
  skillDetail.innerHTML = `
    <h3>${escapeHtml(skill.name)}</h3>
    <p>${escapeHtml(skill.description)}</p>
    <div class="tags">${(skill.tools || []).map(tool => `<span class="tag">${escapeHtml(tool)}</span>`).join("")}</div>
    <div class="skill-meter">
      <label>Comfort level</label>
      <div class="meter"><span></span></div>
    </div>
  `;
}

function openProjectModal(project) {
  openModal(`
    ${previewHtml(project)}
    <div class="meta"><span>${escapeHtml(project.category)}</span><span>${escapeHtml(project.monthYear)}</span></div>
    <h2 id="modal-title">${escapeHtml(project.title)}</h2>
    <p>${escapeHtml(project.longDescription || project.shortDescription)}</p>
    <div class="tags">${(project.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    ${linksHtml(project.links)}
  `);
}

function openMapModal(map) {
  openModal(`
    ${previewHtml(map)}
    <div class="meta"><span>${escapeHtml(map.game)} / ${escapeHtml(map.category)}</span><span>${escapeHtml(map.monthYear)}</span></div>
    <h2 id="modal-title">${escapeHtml(map.title)}</h2>
    <p>${escapeHtml(map.shortDescription)}</p>
    <p><strong>Status:</strong> ${escapeHtml(map.status)}</p>
    <h3>Features</h3>
    <ul>${(map.features || []).map(feature => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
    ${linksHtml(map.links)}
  `);
}

function previewHtml(item) {
  if (item.previewImage) {
    return `<div class="preview"><img src="${escapeHtml(item.previewImage)}" alt="${escapeHtml(item.title)} preview"></div>`;
  }
  return `<div class="preview" style="background:${escapeHtml(item.previewGradient || "linear-gradient(135deg, #1fb85f, #f7d84a)")};"></div>`;
}

function linksHtml(links) {
  const safeLinks = (links || []).filter(link => link.label);
  if (!safeLinks.length) return "";
  return `<div class="modal-links">${safeLinks.map(link => {
    const href = safeUrl(link.url);
    return `<a class="btn" href="${escapeHtml(href)}" target="${href.startsWith("http") ? "_blank" : ""}" rel="noreferrer">${escapeHtml(link.label)}</a>`;
  }).join("")}</div>`;
}

function openModal(html) {
  lastFocusedElement = document.activeElement;
  modalContent.innerHTML = html;
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  modalClose.focus();
}

function closeModal() {
  modal.classList.remove("open");
  document.body.style.overflow = "";
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && modal.classList.contains("open")) closeModal();
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function setupAdmin() {
  if (!ENABLE_LOCAL_ADMIN) return;

  if (window.location.hash === "#admin") {
    document.body.classList.add("admin-enabled");
  }

  window.addEventListener("hashchange", () => {
    document.body.classList.toggle("admin-enabled", window.location.hash === "#admin");
  });

  document.getElementById("add-project").addEventListener("click", () => {
    appData.projects.push({
      title: "New Project",
      monthYear: "Jun 2026",
      category: "Websites",
      shortDescription: "Short project description.",
      longDescription: "Long project description.",
      tags: ["HTML"],
      previewImage: "",
      previewGradient: "linear-gradient(135deg, #1fb85f, #f7d84a)",
      links: [{ label: "Link", url: "#" }]
    });
    renderAdminEditors();
  });

  document.getElementById("add-map").addEventListener("click", () => {
    appData.maps.push({
      title: "New Map",
      monthYear: "Jun 2026",
      game: "Unturned",
      category: "Unturned",
      status: "In progress",
      shortDescription: "Short map description.",
      features: ["Feature"],
      previewImage: "",
      previewGradient: "linear-gradient(135deg, #28e070, #f7d84a)",
      links: [{ label: "Link", url: "#" }]
    });
    renderAdminEditors();
  });

  document.getElementById("save-admin").addEventListener("click", () => {
    collectAdminData();
    saveData();
    renderAll();
    showToast("Changes saved locally.");
  });

  document.getElementById("export-json").addEventListener("click", () => {
    collectAdminData();
    const json = JSON.stringify(appData, null, 2);
    document.getElementById("json-box").value = json;

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mochi-portfolio-data.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("JSON exported.");
  });

  document.getElementById("import-json").addEventListener("click", () => {
    try {
      const parsed = JSON.parse(document.getElementById("json-box").value);
      appData = mergeData(defaultData(), parsed);
      saveData();
      renderAll();
      showToast("JSON imported.");
    } catch (error) {
      showToast("Import failed. Check the JSON format.");
    }
  });

  document.getElementById("copy-json").addEventListener("click", async () => {
    collectAdminData();
    const json = JSON.stringify(appData, null, 2);
    document.getElementById("json-box").value = json;
    try {
      await navigator.clipboard.writeText(json);
      showToast("JSON copied.");
    } catch (error) {
      document.getElementById("json-box").select();
      showToast("Select and copy the JSON.");
    }
  });

  document.getElementById("reset-demo").addEventListener("click", () => {
    appData = defaultData();
    saveData();
    renderAll();
    showToast("Demo data reset.");
  });
}

function renderAdminEditors() {
  if (!ENABLE_LOCAL_ADMIN) return;
  renderProjectEditor();
  renderMapEditor();
}

function renderProjectEditor() {
  const container = document.getElementById("project-editor");
  container.innerHTML = "";
  appData.projects.forEach((project, index) => {
    const item = document.createElement("div");
    item.className = "editor-item";
    item.dataset.index = index;
    item.innerHTML = `
      <div class="editor-item-head">
        <strong>${escapeHtml(project.title || "Untitled Project")}</strong>
        <button class="btn small danger" data-delete-project="${index}">Delete</button>
      </div>
      <div class="form-grid">
        ${field("Title", "title", project.title)}
        ${field("Month Year", "monthYear", project.monthYear)}
        ${field("Category", "category", project.category)}
        ${field("Preview Image", "previewImage", project.previewImage)}
        ${field("Preview Gradient", "previewGradient", project.previewGradient, true)}
        ${field("Short Description", "shortDescription", project.shortDescription, true)}
        ${field("Long Description", "longDescription", project.longDescription, true)}
        ${field("Tags comma-separated", "tags", (project.tags || []).join(", "), true)}
        ${field("Links, one per line: Label | URL", "links", linksToText(project.links), true)}
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll("[data-delete-project]").forEach(button => {
    button.addEventListener("click", () => {
      appData.projects.splice(Number(button.dataset.deleteProject), 1);
      renderAdminEditors();
    });
  });
}

function renderMapEditor() {
  const container = document.getElementById("map-editor");
  container.innerHTML = "";
  appData.maps.forEach((map, index) => {
    const item = document.createElement("div");
    item.className = "editor-item";
    item.dataset.index = index;
    item.innerHTML = `
      <div class="editor-item-head">
        <strong>${escapeHtml(map.title || "Untitled Map")}</strong>
        <button class="btn small danger" data-delete-map="${index}">Delete</button>
      </div>
      <div class="form-grid">
        ${field("Title", "title", map.title)}
        ${field("Month Year", "monthYear", map.monthYear)}
        ${field("Game", "game", map.game)}
        ${field("Category", "category", map.category)}
        ${field("Status", "status", map.status)}
        ${field("Preview Image", "previewImage", map.previewImage)}
        ${field("Preview Gradient", "previewGradient", map.previewGradient, true)}
        ${field("Short Description", "shortDescription", map.shortDescription, true)}
        ${field("Features comma-separated", "features", (map.features || []).join(", "), true)}
        ${field("Links, one per line: Label | URL", "links", linksToText(map.links), true)}
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll("[data-delete-map]").forEach(button => {
    button.addEventListener("click", () => {
      appData.maps.splice(Number(button.dataset.deleteMap), 1);
      renderAdminEditors();
    });
  });
}

function field(label, key, value, textarea = false) {
  const id = `${key}-${Math.random().toString(36).slice(2)}`;
  const control = textarea
    ? `<textarea id="${id}" data-field="${key}">${escapeHtml(value)}</textarea>`
    : `<input id="${id}" data-field="${key}" value="${escapeHtml(value)}">`;
  return `<div class="field ${textarea ? "full" : ""}"><label for="${id}">${escapeHtml(label)}</label>${control}</div>`;
}

function collectAdminData() {
  if (!ENABLE_LOCAL_ADMIN) return;

  appData.projects = Array.from(document.querySelectorAll("#project-editor .editor-item")).map(item => {
    const fields = readFields(item);
    return {
      title: fields.title,
      monthYear: fields.monthYear,
      category: fields.category,
      shortDescription: fields.shortDescription,
      longDescription: fields.longDescription,
      tags: listFromValue(fields.tags),
      previewImage: fields.previewImage,
      previewGradient: fields.previewGradient,
      links: linksFromValue(fields.links)
    };
  });

  appData.maps = Array.from(document.querySelectorAll("#map-editor .editor-item")).map(item => {
    const fields = readFields(item);
    return {
      title: fields.title,
      monthYear: fields.monthYear,
      game: fields.game,
      category: fields.category,
      status: fields.status,
      shortDescription: fields.shortDescription,
      features: listFromValue(fields.features),
      previewImage: fields.previewImage,
      previewGradient: fields.previewGradient,
      links: linksFromValue(fields.links)
    };
  });
}

function readFields(item) {
  const values = {};
  item.querySelectorAll("[data-field]").forEach(input => {
    values[input.dataset.field] = input.value.trim();
  });
  return values;
}

/*
  Future security upgrade notes:
  - Google Auth could be added before showing any editor controls.
  - A backend API could receive authenticated create/update/delete requests.
  - A database could save projects, maps, images, and account permissions.
  Static HTML cannot protect secrets, passwords, or admin access on a public website.
*/

setupAdmin();
renderAll();

