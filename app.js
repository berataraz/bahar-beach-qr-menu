const AUTH_HINT_KEY = "bahar-beach-auth-email";
const MENU_ROW_ID = "primary";

let state = null;
let currentLanguage = "tr";
let activeCategoryId = "";
let saveInFlight = null;
let startupError = "";
let hasUnsavedChanges = false;

const supabaseConfig = window.SUPABASE_CONFIG || {};
const seedMenuData = window.SEED_MENU_DATA || null;
const hasSupabaseConfig = Boolean(
  window.supabase &&
    supabaseConfig.url &&
    supabaseConfig.anonKey &&
    !supabaseConfig.url.includes("YOUR_SUPABASE_URL") &&
    !supabaseConfig.anonKey.includes("YOUR_SUPABASE_ANON_KEY")
);

let supabaseClient = null;
if (hasSupabaseConfig) {
  try {
    supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
  } catch (error) {
    startupError = error?.message || "Supabase client could not be created.";
  }
}

const heroTagline = document.getElementById("hero-tagline");
const heroTitle = document.querySelector(".hero h1");
const heroNote = document.getElementById("hero-note");
const menuHeading = document.getElementById("menu-heading");
const menuSubheading = document.getElementById("menu-subheading");
const menuSlogan = document.getElementById("menu-slogan");
const categoryTabs = document.getElementById("category-tabs");
const menuContent = document.getElementById("menu-content");
const adminPanel = document.getElementById("admin-panel");
const loginModal = document.getElementById("login-modal");
const loginError = document.getElementById("login-error");
const saveStatus = document.getElementById("save-status");
const saveMenuButton = document.getElementById("save-menu");
const categorySelect = document.getElementById("category-select");
const categoryEditor = document.getElementById("category-editor");
const venuePhoneInput = document.getElementById("venue-phone");
const venueNoteInput = document.getElementById("venue-note");
const groupTemplate = document.getElementById("group-editor-template");
const itemTemplate = document.getElementById("item-editor-template");
const loginEmailInput = document.getElementById("admin-username");
const loginPasswordInput = document.getElementById("admin-password");

document.getElementById("lang-tr").addEventListener("click", () => switchLanguage("tr"));
document.getElementById("lang-en").addEventListener("click", () => switchLanguage("en"));
document.getElementById("scroll-menu").addEventListener("click", () => {
  document.getElementById("menu-area").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("open-login").addEventListener("click", handleAdminEntryClick);
document.getElementById("close-login").addEventListener("click", closeLoginModal);
document.getElementById("submit-login").addEventListener("click", submitLogin);
document.getElementById("close-admin").addEventListener("click", closeAdminPanel);
document.getElementById("add-category").addEventListener("click", addCategory);
document.getElementById("remove-category").addEventListener("click", removeCategory);
document.getElementById("save-menu").addEventListener("click", saveMenuManually);
document.getElementById("reset-data").addEventListener("click", resetData);

categorySelect.addEventListener("change", (event) => {
  activeCategoryId = event.target.value;
  renderMenu();
  renderAdminEditor();
});

venuePhoneInput.addEventListener("input", (event) => {
  state.venue.phone = event.target.value;
  persistAndRender(false);
});

venueNoteInput.addEventListener("input", (event) => {
  state.venue.note[currentLanguage] = event.target.value;
  persistAndRender(false);
});

init();

async function init() {
  syncStaticTexts();

  if (!supabaseClient) {
    state = getSeedData();
    activeCategoryId = state?.categories?.[0]?.id ?? "";
    renderAll();
    setSaveStatus(
      currentLanguage === "tr"
        ? startupError || "Supabase yapılandırması eksik. `supabase-config.js` dosyasını doldurun."
        : startupError || "Supabase config is missing. Fill in `supabase-config.js`.",
      "error"
    );
    return;
  }

  const rememberedEmail = safeStorageGet(AUTH_HINT_KEY);
  if (rememberedEmail) loginEmailInput.value = rememberedEmail;

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      closeAdminPanel();
    }
  });

  menuContent.innerHTML = `<div class="empty-state">${currentLanguage === "tr" ? "Menü yükleniyor..." : "Loading menu..."}</div>`;
  setSaveStatus(
    currentLanguage === "tr" ? "Supabase verileri yükleniyor..." : "Loading data from Supabase...",
    "saving"
  );

  try {
    state = await fetchMenu();
    activeCategoryId = state.categories[0]?.id ?? "";
    renderAll();

    const session = await getSession();
    setSaveStatus(
      session
        ? currentLanguage === "tr"
          ? "Supabase bağlantısı hazır. Yönetim oturumu açık."
          : "Supabase connection ready. Admin session is active."
        : currentLanguage === "tr"
          ? "Menü Supabase üzerinden yüklendi."
          : "Menu loaded from Supabase.",
      "success"
    );
    hasUnsavedChanges = false;
    updateSaveButtonState();
  } catch (error) {
    menuContent.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    setSaveStatus(error.message, "error");
  }
}

function renderAll() {
  syncStaticTexts();
  syncVenueInputs();
  renderMenu();
  renderAdminEditor();
  updateSaveButtonState();
}

function syncStaticTexts() {
  const copy = currentLanguage === "tr"
    ? {
        slogan: "Good Food, Good Drinks, Good Moments",
        heading: "Menü",
        subheading: "Kategoriye dokunarak ürünleri inceleyebilirsiniz.",
        tagline: "Food & Drinks",
        title: "Bahar Beach Food & Drinks",
        adminBarNote: "Menü yönetimi için yetkili girişi",
        loginEyebrow: "Yetkili Girişi",
        loginTitle: "Yönetim Paneli",
        openLogin: "Panele Giriş",
        scroll: "Menüyü Gör",
        panelEyebrow: "Düzenleme",
        panelTitle: "Menü Yönetimi",
        emailLabel: "E-posta",
      }
    : {
        slogan: "Good Food, Good Drinks, Good Moments",
        heading: "Menu",
        subheading: "Tap a category to explore the menu.",
        tagline: "Food & Drinks",
        title: "Bahar Beach Food & Drinks",
        adminBarNote: "Authorized sign-in for menu management",
        loginEyebrow: "Authorized Access",
        loginTitle: "Admin Panel",
        openLogin: "Panel Login",
        scroll: "View Menu",
        panelEyebrow: "Editing",
        panelTitle: "Menu Management",
        emailLabel: "Email",
      };

  heroTagline.textContent = copy.tagline;
  heroTitle.textContent = copy.title;
  menuSlogan.textContent = copy.slogan;
  menuHeading.textContent = copy.heading;
  menuSubheading.textContent = copy.subheading;
  document.getElementById("admin-bar-note").textContent = copy.adminBarNote;
  document.getElementById("login-eyebrow").textContent = copy.loginEyebrow;
  document.getElementById("login-title").textContent = copy.loginTitle;
  document.getElementById("open-login").textContent = copy.openLogin;
  document.getElementById("scroll-menu").textContent = copy.scroll;
  document.getElementById("panel-eyebrow").textContent = copy.panelEyebrow;
  document.getElementById("panel-title").textContent = copy.panelTitle;
  document.querySelector('label[for="admin-username"]').textContent = copy.emailLabel;
  document.documentElement.lang = currentLanguage;
  document.getElementById("lang-tr").classList.toggle("is-active", currentLanguage === "tr");
  document.getElementById("lang-en").classList.toggle("is-active", currentLanguage === "en");
}

function renderMenu() {
  if (!state?.categories?.length) {
    categoryTabs.innerHTML = "";
    menuContent.innerHTML = `<div class="empty-state">${currentLanguage === "tr" ? "Menü boş." : "Menu is empty."}</div>`;
    return;
  }

  if (!state.categories.some((category) => category.id === activeCategoryId)) {
    activeCategoryId = state.categories[0].id;
  }

  categoryTabs.innerHTML = "";
  state.categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = `category-tab ${category.id === activeCategoryId ? "is-active" : ""}`;
    button.type = "button";
    button.textContent = textFor(category.title);
    button.addEventListener("click", () => {
      activeCategoryId = category.id;
      renderMenu();
      renderAdminEditor();
    });
    categoryTabs.appendChild(button);
  });

  const activeCategory = getActiveCategory();
  const groupsMarkup = activeCategory.groups
    .map((group) => {
      const itemsMarkup = group.items
        .map((item) => {
          const hasImage = Boolean(item.image);
          return `
            <article class="menu-item ${hasImage ? "" : "menu-item--no-image"}">
              ${hasImage ? `<img class="menu-item__image" src="${item.image}" alt="${escapeHtml(textFor(item.name))}" />` : ""}
              <div>
                <div class="menu-item__topline">
                  <h3 class="menu-item__name">${escapeHtml(textFor(item.name))}</h3>
                  <span class="menu-item__price">${escapeHtml(item.price || "")}</span>
                </div>
                <p class="menu-item__description">${escapeHtml(textFor(item.description))}</p>
                ${item.badge ? `<span class="menu-item__badge">${escapeHtml(item.badge)}</span>` : ""}
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <article class="group-card">
          <div class="group-card__header">
            <div>
              <p class="section-heading__eyebrow">${escapeHtml(textFor(activeCategory.title))}</p>
              <h3 class="group-card__title">${escapeHtml(textFor(group.title))}</h3>
            </div>
            <span class="category-meta">${group.items.length} ${currentLanguage === "tr" ? "ürün" : "items"}</span>
          </div>
          <div class="items-grid">
            ${itemsMarkup || `<div class="empty-state">${currentLanguage === "tr" ? "Bu grupta henüz ürün yok." : "No items in this group."}</div>`}
          </div>
        </article>
      `;
    })
    .join("");

  menuContent.innerHTML = `
    <section class="category-section">
      <article class="category-card">
        <div class="category-card__header">
          <div>
            <p class="section-heading__eyebrow">${currentLanguage === "tr" ? "Kategori" : "Category"}</p>
            <h2 class="category-card__title">${escapeHtml(textFor(activeCategory.title))}</h2>
            <p class="category-card__description">${escapeHtml(textFor(activeCategory.description))}</p>
          </div>
          <span class="category-meta">${countItems(activeCategory)} ${currentLanguage === "tr" ? "ürün" : "items"}</span>
        </div>
        <div class="category-groups">${groupsMarkup}</div>
      </article>
      <div class="footer-note">${escapeHtml(textFor(state.venue.note))} ${escapeHtml(state.venue.phone)}</div>
    </section>
  `;
}

function renderAdminEditor() {
  if (!state) return;

  categorySelect.innerHTML = "";
  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.title.tr} / ${category.title.en}`;
    if (category.id === activeCategoryId) option.selected = true;
    categorySelect.appendChild(option);
  });

  const activeCategory = getActiveCategory();
  if (!activeCategory) {
    categoryEditor.innerHTML = "";
    return;
  }

  categoryEditor.innerHTML = "";
  const metaCard = document.createElement("article");
  metaCard.className = "editor-card";
  metaCard.innerHTML = `
    <label class="label">Kategori Başlığı TR</label>
    <input class="input category-title-tr" type="text" value="${escapeAttribute(activeCategory.title.tr)}" />
    <label class="label">Category Title EN</label>
    <input class="input category-title-en" type="text" value="${escapeAttribute(activeCategory.title.en)}" />
    <label class="label">Kategori Açıklaması TR</label>
    <textarea class="textarea category-description-tr" rows="3">${escapeHtml(activeCategory.description.tr)}</textarea>
    <label class="label">Category Description EN</label>
    <textarea class="textarea category-description-en" rows="3">${escapeHtml(activeCategory.description.en)}</textarea>
    <div class="admin-panel__actions" style="margin-top: 14px;">
      <button class="button button--soft add-group" type="button">Grup Ekle</button>
    </div>
  `;

  metaCard.querySelector(".category-title-tr").addEventListener("input", (event) => {
    activeCategory.title.tr = event.target.value;
    renderMenu();
    refreshCategorySelectOptions();
    scheduleSave();
  });
  metaCard.querySelector(".category-title-en").addEventListener("input", (event) => {
    activeCategory.title.en = event.target.value;
    refreshCategorySelectOptions();
    scheduleSave();
  });
  metaCard.querySelector(".category-description-tr").addEventListener("input", (event) => {
    activeCategory.description.tr = event.target.value;
    renderMenu();
    scheduleSave();
  });
  metaCard.querySelector(".category-description-en").addEventListener("input", (event) => {
    activeCategory.description.en = event.target.value;
    if (currentLanguage === "en") renderMenu();
    scheduleSave();
  });
  metaCard.querySelector(".add-group").addEventListener("click", () => {
    activeCategory.groups.push(createGroup({ tr: "Yeni Grup", en: "New Group" }, []));
    persistAndRender();
  });

  categoryEditor.appendChild(metaCard);

  activeCategory.groups.forEach((group, groupIndex) => {
    const groupNode = groupTemplate.content.firstElementChild.cloneNode(true);
    groupNode.querySelector(".editor-card__title").textContent = `${groupIndex + 1}. ${group.title.tr} / ${group.title.en}`;
    groupNode.querySelector(".group-title-tr").value = group.title.tr;
    groupNode.querySelector(".group-title-en").value = group.title.en;

    groupNode.querySelector(".group-title-tr").addEventListener("input", (event) => {
      group.title.tr = event.target.value;
      groupNode.querySelector(".editor-card__title").textContent = `${groupIndex + 1}. ${group.title.tr} / ${group.title.en}`;
      renderMenu();
      scheduleSave();
    });
    groupNode.querySelector(".group-title-en").addEventListener("input", (event) => {
      group.title.en = event.target.value;
      groupNode.querySelector(".editor-card__title").textContent = `${groupIndex + 1}. ${group.title.tr} / ${group.title.en}`;
      if (currentLanguage === "en") renderMenu();
      scheduleSave();
    });
    groupNode.querySelector(".remove-group").addEventListener("click", () => {
      activeCategory.groups.splice(groupIndex, 1);
      persistAndRender();
    });
    groupNode.querySelector(".add-item").addEventListener("click", () => {
      group.items.push(item("Yeni Ürün", "New Item", "", ""));
      persistAndRender();
    });

    const groupItems = groupNode.querySelector(".group-items");
    group.items.forEach((menuItem, itemIndex) => {
      const itemNode = itemTemplate.content.firstElementChild.cloneNode(true);
      itemNode.querySelector(".editor-card__title").textContent = `${itemIndex + 1}. ${menuItem.name.tr} / ${menuItem.name.en}`;
      itemNode.querySelector(".item-name-tr").value = menuItem.name.tr;
      itemNode.querySelector(".item-name-en").value = menuItem.name.en;
      itemNode.querySelector(".item-description-tr").value = menuItem.description.tr;
      itemNode.querySelector(".item-description-en").value = menuItem.description.en;
      itemNode.querySelector(".item-price").value = menuItem.price;
      itemNode.querySelector(".item-badge").value = menuItem.badge;
      itemNode.querySelector(".item-image").value = menuItem.image;

      itemNode.querySelector(".item-name-tr").addEventListener("input", (event) => {
        menuItem.name.tr = event.target.value;
        itemNode.querySelector(".editor-card__title").textContent = `${itemIndex + 1}. ${menuItem.name.tr} / ${menuItem.name.en}`;
        renderMenu();
        scheduleSave();
      });
      itemNode.querySelector(".item-name-en").addEventListener("input", (event) => {
        menuItem.name.en = event.target.value;
        itemNode.querySelector(".editor-card__title").textContent = `${itemIndex + 1}. ${menuItem.name.tr} / ${menuItem.name.en}`;
        if (currentLanguage === "en") renderMenu();
        scheduleSave();
      });
      itemNode.querySelector(".item-description-tr").addEventListener("input", (event) => {
        menuItem.description.tr = event.target.value;
        renderMenu();
        scheduleSave();
      });
      itemNode.querySelector(".item-description-en").addEventListener("input", (event) => {
        menuItem.description.en = event.target.value;
        if (currentLanguage === "en") renderMenu();
        scheduleSave();
      });
      itemNode.querySelector(".item-price").addEventListener("input", (event) => {
        menuItem.price = event.target.value;
        renderMenu();
        scheduleSave();
      });
      itemNode.querySelector(".item-badge").addEventListener("input", (event) => {
        menuItem.badge = event.target.value;
        renderMenu();
        scheduleSave();
      });
      itemNode.querySelector(".item-image").addEventListener("input", (event) => {
        menuItem.image = event.target.value;
        renderMenu();
        scheduleSave();
      });
      itemNode.querySelector(".item-file").addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        menuItem.image = await fileToDataUrl(file);
        persistAndRender();
      });
      itemNode.querySelector(".remove-item").addEventListener("click", () => {
        group.items.splice(itemIndex, 1);
        persistAndRender();
      });

      groupItems.appendChild(itemNode);
    });

    categoryEditor.appendChild(groupNode);
  });
}

function syncVenueInputs() {
  if (!state) return;
  heroNote.textContent = `${textFor(state.venue.note)} ${state.venue.phone}`;
  venuePhoneInput.value = state.venue.phone;
  venueNoteInput.value = textFor(state.venue.note);
}

function switchLanguage(language) {
  currentLanguage = language;
  syncStaticTexts();
  syncVenueInputs();
  if (state) renderMenu();
}

function openLoginModal() {
  loginError.hidden = true;
  loginModal.classList.remove("overlay--hidden");
}

function closeLoginModal() {
  loginModal.classList.add("overlay--hidden");
}

async function submitLogin() {
  if (!supabaseClient) return;

  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    safeStorageSet(AUTH_HINT_KEY, email);
    closeLoginModal();
    openAdminPanel();
    setSaveStatus(
      currentLanguage === "tr" ? "Supabase yönetici oturumu açıldı." : "Supabase admin session started.",
      "success"
    );
  } catch (error) {
    loginError.textContent = currentLanguage === "tr"
      ? "E-posta veya parola hatalı."
      : "Incorrect email or password.";
    loginError.hidden = false;
  }
}

async function openAdminPanel() {
  try {
    const session = await getSession();
    if (!session) {
      openLoginModal();
      return;
    }
    renderAdminEditor();
    adminPanel.classList.remove("admin-panel--hidden");
  } catch (error) {
    openLoginModal();
    setSaveStatus(
      currentLanguage === "tr"
        ? "Oturum kontrolünde sorun oluştu, lütfen tekrar giriş yapın."
        : "Session check failed, please sign in again.",
      "error"
    );
  }
}

async function handleAdminEntryClick() {
  openLoginModal();
  try {
    const session = await getSession();
    if (!session) {
      return;
    }
    closeLoginModal();
    renderAdminEditor();
    adminPanel.classList.remove("admin-panel--hidden");
  } catch (_error) {
    loginError.textContent = currentLanguage === "tr"
      ? "Giriş ekranı açıldı. Oturum kontrolü yapılamadıysa tekrar giriş yapabilirsiniz."
      : "Login opened. If session check failed, you can sign in again.";
    loginError.hidden = false;
  }
}

function closeAdminPanel() {
  adminPanel.classList.add("admin-panel--hidden");
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_error) {
    return;
  }
}

window.addEventListener("error", (event) => {
  const message = event?.error?.message || event?.message || "Bilinmeyen JavaScript hatası.";
  setSaveStatus(
    currentLanguage === "tr"
      ? `Arayüz hatası: ${message}`
      : `Interface error: ${message}`,
    "error"
  );
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason?.message || String(event?.reason || "Unknown promise error.");
  setSaveStatus(
    currentLanguage === "tr"
      ? `Arka plan hatası: ${reason}`
      : `Background error: ${reason}`,
    "error"
  );
});

function addCategory() {
  const trTitle = window.prompt("Kategori adı (TR):");
  if (!trTitle) return;
  const enTitle = window.prompt("Category title (EN):") || trTitle;
  const id = slugify(`${trTitle}-${enTitle}`);
  state.categories.push(
    createCategory(
      id,
      { tr: trTitle, en: enTitle },
      { tr: "Kategori açıklaması", en: "Category description" },
      [createGroup({ tr: "Yeni Grup", en: "New Group" }, [])]
    )
  );
  activeCategoryId = id;
  persistAndRender();
}

function removeCategory() {
  if (!activeCategoryId) return;
  const category = getActiveCategory();
  if (!window.confirm(`${category.title.tr} / ${category.title.en} silinsin mi?`)) return;
  state.categories = state.categories.filter((entry) => entry.id !== activeCategoryId);
  activeCategoryId = state.categories[0]?.id ?? "";
  persistAndRender();
}

async function resetData() {
  try {
    const seed = getSeedData();
    state = seed;
    activeCategoryId = state.categories[0]?.id ?? "";
    renderAll();
    hasUnsavedChanges = true;
    updateSaveButtonState();
    setSaveStatus(
      currentLanguage === "tr"
        ? "Varsayılan menü yüklendi. Kaydet'e basarak Supabase'e yazın."
        : "Default menu loaded. Press Save to write it to Supabase.",
      "saving"
    );
  } catch (error) {
    setSaveStatus(error.message, "error");
  }
}

function persistAndRender(syncAdmin = true) {
  hasUnsavedChanges = true;
  syncVenueInputs();
  renderMenu();
  if (syncAdmin) renderAdminEditor();
  updateSaveButtonState();
  setSaveStatus(
    currentLanguage === "tr"
      ? "Kaydedilmemiş değişiklikler var."
      : "You have unsaved changes.",
    "saving"
  );
}

function refreshCategorySelectOptions() {
  [...categorySelect.options].forEach((option) => {
    const category = state.categories.find((entry) => entry.id === option.value);
    if (!category) return;
    option.textContent = `${category.title.tr} / ${category.title.en}`;
  });
}

async function saveMenuNow() {
  if (!supabaseClient || !state) return;
  if (saveInFlight) await saveInFlight;

  saveInFlight = supabaseClient
    .from("menu_content")
    .upsert(
      {
        id: MENU_ROW_ID,
        data: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("data")
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      state = data.data;
      hasUnsavedChanges = false;
      updateSaveButtonState();
      setSaveStatus(
        currentLanguage === "tr" ? "Değişiklikler Supabase'e kaydedildi." : "Changes saved to Supabase.",
        "success"
      );
    })
    .catch((error) => {
      setSaveStatus(error.message, "error");
      updateSaveButtonState();
      throw error;
    })
    .finally(() => {
      saveInFlight = null;
    });

  return saveInFlight;
}

async function saveMenuManually() {
  const session = await getSession();
  if (!session) {
    setSaveStatus(
      currentLanguage === "tr" ? "Kaydetmek için yönetici girişi gerekli." : "Admin login required to save.",
      "error"
    );
    openLoginModal();
    return;
  }

  if (!hasUnsavedChanges) {
    setSaveStatus(
      currentLanguage === "tr" ? "Kaydedilecek yeni değişiklik yok." : "There are no new changes to save.",
      "success"
    );
    updateSaveButtonState();
    return;
  }

  setSaveStatus(
    currentLanguage === "tr" ? "Değişiklikler Supabase'e kaydediliyor..." : "Saving changes to Supabase...",
    "saving"
  );
  updateSaveButtonState(true);

  try {
    await saveMenuNow();
  } finally {
    updateSaveButtonState();
  }
}

async function fetchMenu() {
  if (!supabaseClient) {
    if (seedMenuData) return seedMenuData;
    throw new Error("Supabase client not configured.");
  }

  const { data, error } = await supabaseClient
    .from("menu_content")
    .select("data")
    .eq("id", MENU_ROW_ID)
    .single();

  if (error || !data?.data) {
    const seed = getSeedData();
    setSaveStatus(
      currentLanguage === "tr"
        ? "Supabase verisi bulunamadı. Geçici olarak seed veri gösteriliyor."
        : "Supabase row not found. Showing seed data temporarily.",
      "error"
    );
    return seed;
  }

  validateData(data.data);
  return data.data;
}

function getSeedData() {
  if (!seedMenuData) {
    throw new Error(
      currentLanguage === "tr"
        ? "Ne Supabase verisi ne de seed veri okunabildi."
        : "Neither Supabase data nor seed data could be loaded."
    );
  }
  validateData(seedMenuData);
  return JSON.parse(JSON.stringify(seedMenuData));
}

async function getSession() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) return null;
  return data.session;
}

function getActiveCategory() {
  return state.categories.find((category) => category.id === activeCategoryId);
}

function textFor(value) {
  if (typeof value === "string") return value;
  return value?.[currentLanguage] ?? value?.tr ?? "";
}

function countItems(category) {
  return category.groups.reduce((total, group) => total + group.items.length, 0);
}

function createCategory(id, title, description, groups) {
  return { id, title, description, groups };
}

function createGroup(title, items, priceHint = "") {
  return { title, items, priceHint };
}

function item(trName, enName, trDescription, enDescription, price = "", badge = "", image = "") {
  return {
    name: { tr: trName, en: enName },
    description: { tr: trDescription, en: enDescription },
    price,
    badge,
    image,
  };
}

function setSaveStatus(message, tone = "") {
  saveStatus.textContent = message;
  saveStatus.classList.remove("is-saving", "is-success", "is-error");
  if (tone === "saving") saveStatus.classList.add("is-saving");
  if (tone === "success") saveStatus.classList.add("is-success");
  if (tone === "error") saveStatus.classList.add("is-error");
}

function updateSaveButtonState(forceBusy = false) {
  const busy = forceBusy || Boolean(saveInFlight);
  saveMenuButton.disabled = busy;
  if (busy) {
    saveMenuButton.textContent = currentLanguage === "tr" ? "Kaydediliyor..." : "Saving...";
    return;
  }
  saveMenuButton.textContent = hasUnsavedChanges
    ? currentLanguage === "tr" ? "Kaydet" : "Save"
    : currentLanguage === "tr" ? "Kaydedildi" : "Saved";
}

function validateData(data) {
  if (!data || typeof data !== "object") throw new Error("Veri formatı geçersiz.");
  if (!Array.isArray(data.categories)) throw new Error("Kategori listesi eksik.");
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
