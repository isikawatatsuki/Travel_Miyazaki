const trip = {
  departure: new Date("2026-09-21T05:40:00+09:00"),
  defaults: {
    dateLabel: "2026.09.21 - 09.23",
    routeLabel: "大阪から都城へ",
    heroRouteLabel: "Osaka to Miyakonojo",
    outboundLabel: "MM193 08:30 関西発",
    returnLabel: "MM198 16:30 鹿児島発",
    hotelName: "都城グリーンホテル",
    hotelAddress: "宮崎県都城市栄町27-2-1",
    departureSummaryLabel: "出発地を出る時間",
    departureTime: "05:40",
    arrivalSummaryLabel: "到着しておきたい時間",
    arrivalTargetTime: "07:15",
    mapOrigin: "鹿児島空港",
    mapDestination: "都城グリーンホテル",
    mapNote: "鹿児島空港についたら都城方面へ移動。",
  },
  points: {
    airport: {
      name: "鹿児島空港",
      lat: 31.8034,
      lng: 130.7195,
      note: "MM193 09:45に到着予定",
    },
    hotel: {
      name: "都城グリーンホテル",
      lat: 31.7368,
      lng: 131.0739,
      note: "宮崎県都城市栄町27-2-1",
    },
  },
  costs: {
    flight: 36200,
    access: 2360,
    hotelLow: 6500,
    hotelBreakfast: 9100,
  },
  checklist: [
    "交通手段の予約",
    "宿の予約",
    "身分証",
    "スマホ",
    "充電器",
    "モバイルバッテリー",
    "着替え",
    "洗面用品",
    "常備薬",
    "雨具",
    "現金・交通系IC",
    "お土産メモ",
  ],
  notes: [
    "出発時間と集合場所は前日までに決めておく。",
    "交通機関のチェックイン時間、乗り場、荷物ルールを確認しておく。",
    "宿は料金、禁煙・喫煙、チェックイン時間、キャンセル条件だけ最後に見ておく。",
    "到着後の移動手段と、迷った時の待ち合わせ場所を決めておく。",
    "充電、天気、現金・交通系ICは出発前に軽く確認する。",
  ],
};

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function formatYen(value) {
  return yen.format(value).replace("￥", "") + "円";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const groupSync = {
  storageKey: "tripShioriGroup",
  legacyStorageKey: "miyakonojoTripGroup",
  groupsKey: "tripShioriGroups",
  legacyGroupsKey: "miyakonojoTripGroups",
  controllers: {},
  active: null,
  savedGroups: [],
  saveTimer: null,
  isApplying: false,
  statusEl: null,
  nameEl: null,
  codeEl: null,
  listEl: null,
  formPanel: null,
  toggleButton: null,

  initElements() {
    this.statusEl = document.getElementById("groupStatus");
    this.nameEl = document.getElementById("groupName");
    this.codeEl = document.getElementById("joinCodeValue");
    this.listEl = document.getElementById("groupList");
    this.formPanel = document.getElementById("groupFormPanel");
    this.toggleButton = document.getElementById("toggleGroupFormButton");
    this.savedGroups = this.loadSavedGroups();
    this.active = this.loadActiveGroup();
    if (this.active) this.rememberGroup(this.active, false);
    this.setFormVisible(!this.active);
    this.render();
  },

  register(name, controller) {
    this.controllers[name] = controller;
  },

  loadActiveGroup() {
    try {
      const saved = localStorage.getItem(this.storageKey) || localStorage.getItem(this.legacyStorageKey);
      return this.normalizeGroup(JSON.parse(saved || "null"));
    } catch {
      return null;
    }
  },

  loadSavedGroups() {
    try {
      const saved = localStorage.getItem(this.groupsKey) || localStorage.getItem(this.legacyGroupsKey);
      return JSON.parse(saved || "[]").map((group) => this.normalizeGroup(group)).filter(Boolean);
    } catch {
      return [];
    }
  },

  normalizeGroup(group) {
    if (!group?.id || !group?.editToken) return null;
    return {
      id: group.id,
      name: group.name || "旅グループ",
      joinCode: group.joinCode || "",
      editToken: group.editToken,
      state: group.state || {},
    };
  },

  persistSavedGroups() {
    localStorage.setItem(this.groupsKey, JSON.stringify(this.savedGroups));
  },

  rememberGroup(group, shouldRender = true) {
    const normalized = this.normalizeGroup(group);
    if (!normalized) return;
    this.savedGroups = [
      normalized,
      ...this.savedGroups.filter((saved) => saved.id !== normalized.id),
    ];
    this.persistSavedGroups();
    if (shouldRender) this.render();
  },

  saveActiveGroup(value) {
    this.active = this.normalizeGroup(value);
    if (this.active) {
      localStorage.setItem(this.storageKey, JSON.stringify(this.active));
      this.rememberGroup(this.active, false);
    } else {
      localStorage.removeItem(this.storageKey);
    }
    this.render();
  },

  render(message) {
    if (!this.nameEl || !this.codeEl || !this.statusEl) return;
    this.nameEl.textContent = this.active?.name || "未参加";
    this.codeEl.textContent = this.active?.joinCode || "------";
    this.statusEl.textContent =
      message || (this.active ? "この端末はグループ共有に接続しています。" : "グループ未参加です。作成または参加すると同期できます。");
    this.renderGroupList();
    this.updateToggleLabel();
  },

  renderGroupList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = "";

    if (!this.savedGroups.length) {
      const empty = document.createElement("p");
      empty.className = "empty-group";
      empty.textContent = "まだ参加中のグループはありません。";
      this.listEl.appendChild(empty);
      return;
    }

    this.savedGroups.forEach((group) => {
      const button = document.createElement("button");
      button.className = `group-list-item${this.active?.id === group.id ? " is-active" : ""}`;
      button.type = "button";
      button.innerHTML = `
        <span>${escapeHtml(group.name)}</span>
        <small>${escapeHtml(group.joinCode || "------")}</small>
      `;
      button.addEventListener("click", () => {
        if (this.active?.id === group.id) {
          this.render("このグループを表示中です。");
          return;
        }
        this.selectSavedGroup(group.id);
      });
      this.listEl.appendChild(button);
    });
  },

  setFormVisible(visible) {
    if (!this.formPanel) return;
    this.formPanel.hidden = !visible;
    this.updateToggleLabel();
  },

  updateToggleLabel() {
    if (!this.toggleButton || !this.formPanel) return;
    this.toggleButton.textContent = this.formPanel.hidden ? "グループ作成・参加を表示" : "グループ作成・参加を閉じる";
  },

  toggleForm() {
    this.setFormVisible(this.formPanel?.hidden);
  },

  collectState() {
    return Object.fromEntries(
      Object.entries(this.controllers).map(([name, controller]) => [name, controller.get()]),
    );
  },

  applyState(state) {
    this.isApplying = true;
    Object.entries(this.controllers).forEach(([name, controller]) => {
      if (state?.[name]) controller.set(state[name]);
    });
    this.isApplying = false;
  },

  scheduleSave() {
    if (!this.active || this.isApplying) return;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveRemote(), 650);
  },

  async request(path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        headers: {
          "content-type": "application/json",
          ...(options.headers || {}),
        },
        ...options,
      });
    } catch {
      throw new Error("グループ共有に接続できませんでした。");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "グループ共有に接続できませんでした。");
    }
    return data;
  },

  async create(name) {
    const data = await this.request("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name, state: this.collectState() }),
    });
    this.saveActiveGroup(data.group);
    this.setFormVisible(false);
    this.render("グループを作成しました。参加コードを相手に共有してください。");
  },

  async join(joinCode) {
    const data = await this.request("/api/groups/join", {
      method: "POST",
      body: JSON.stringify({ joinCode }),
    });
    this.saveActiveGroup(data.group);
    this.setFormVisible(false);
    this.applyState(data.group.state);
    this.render("グループに参加しました。共有データを読み込みました。");
  },

  async selectSavedGroup(groupId) {
    const group = this.savedGroups.find((saved) => saved.id === groupId);
    if (!group) return;
    this.saveActiveGroup(group);
    this.render("グループを切り替え中...");
    await this.refresh();
  },

  async refresh() {
    if (!this.active) {
      this.render("先にグループを作るか、参加コードで参加してください。");
      return;
    }
    const data = await this.request(`/api/groups/${this.active.id}?token=${encodeURIComponent(this.active.editToken)}`);
    this.saveActiveGroup(data.group);
    this.applyState(data.group.state);
    this.render("最新の共有データを読み込みました。");
  },

  async saveRemote() {
    if (!this.active) return;
    try {
      await this.request(`/api/groups/${this.active.id}`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${this.active.editToken}`,
        },
        body: JSON.stringify({ state: this.collectState() }),
      });
      this.render("変更をグループに保存しました。");
    } catch (error) {
      this.render(error.message);
    }
  },
};

const tripSettingsStorageKey = "tripShioriSettings";

function normalizeTripSettings(value = {}) {
  return { ...trip.defaults, ...value };
}

function getTripSettings() {
  try {
    return normalizeTripSettings(JSON.parse(localStorage.getItem(tripSettingsStorageKey) || "{}"));
  } catch {
    return normalizeTripSettings();
  }
}

function saveTripSettings(settings) {
  localStorage.setItem(tripSettingsStorageKey, JSON.stringify(normalizeTripSettings(settings)));
}

function buildMapEmbedUrl(origin, destination) {
  const params = new URLSearchParams({
    saddr: origin,
    daddr: destination,
    hl: "ja",
    z: "10",
    output: "embed",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

function buildGoogleMapsUrl(origin, destination) {
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function renderTripSettings(settings = getTripSettings()) {
  const next = normalizeTripSettings(settings);
  const heroEyebrow = `${next.dateLabel} / ${next.heroRouteLabel || next.routeLabel}`;
  const heroLead = `${next.dateLabel} / ${next.routeLabel}`;
  const mapLead = `${next.mapOrigin}から${next.mapDestination}までの位置感を、Google Mapsで確認。`;
  const outboundTimelineTitle = `${next.outboundLabel} 出発`;
  const outboundTimelineBody = `${next.mapOrigin}から${next.mapDestination}方面へ移動。`;
  const returnTimelineTitle = `${next.returnLabel} 復路`;
  const returnTimelineBody = `${next.mapDestination}方面から帰りの移動へ。`;

  document.querySelectorAll('[data-trip-text="heroEyebrow"]').forEach((el) => {
    el.textContent = heroEyebrow;
  });
  document.querySelectorAll('[data-trip-text="heroLead"]').forEach((el) => {
    el.textContent = heroLead;
  });
  document.querySelectorAll('[data-trip-text="mapLead"]').forEach((el) => {
    el.textContent = mapLead;
  });
  document.querySelectorAll('[data-trip-text="outboundTimelineTitle"]').forEach((el) => {
    el.textContent = outboundTimelineTitle;
  });
  document.querySelectorAll('[data-trip-text="outboundTimelineBody"]').forEach((el) => {
    el.textContent = outboundTimelineBody;
  });
  document.querySelectorAll('[data-trip-text="returnTimelineTitle"]').forEach((el) => {
    el.textContent = returnTimelineTitle;
  });
  document.querySelectorAll('[data-trip-text="returnTimelineBody"]').forEach((el) => {
    el.textContent = returnTimelineBody;
  });

  [
    "outboundLabel",
    "returnLabel",
    "hotelName",
    "hotelAddress",
    "departureSummaryLabel",
    "departureTime",
    "arrivalSummaryLabel",
    "arrivalTargetTime",
    "mapNote",
  ].forEach((key) => {
    document.querySelectorAll(`[data-trip-text="${key}"]`).forEach((el) => {
      el.textContent = next[key];
    });
  });

  const mapFrame = document.getElementById("mapFrame");
  if (mapFrame) {
    mapFrame.src = buildMapEmbedUrl(next.mapOrigin, next.mapDestination);
    mapFrame.title = `${next.mapOrigin}から${next.mapDestination}までのGoogle Maps`;
  }

  const googleMapsLink = document.getElementById("googleMapsLink");
  if (googleMapsLink) {
    googleMapsLink.href = buildGoogleMapsUrl(next.mapOrigin, next.mapDestination);
  }

  const groupNameInput = document.getElementById("groupNameInput");
  if (groupNameInput && ["旅行グループ", trip.defaults.routeLabel].includes(groupNameInput.value)) {
    groupNameInput.value = next.routeLabel || "旅行グループ";
  }
}

function initTripSettings() {
  const openButton = document.getElementById("openTripSettingsButton");
  const closeButton = document.getElementById("closeTripSettingsButton");
  const drawer = document.getElementById("tripSettingsDrawer");
  const overlay = document.getElementById("tripSettingsOverlay");
  const fields = {
    dateLabel: document.getElementById("settingDateLabel"),
    routeLabel: document.getElementById("settingRouteLabel"),
    outboundLabel: document.getElementById("settingOutboundLabel"),
    returnLabel: document.getElementById("settingReturnLabel"),
    hotelName: document.getElementById("settingHotelName"),
    hotelAddress: document.getElementById("settingHotelAddress"),
    departureTime: document.getElementById("settingDepartureTime"),
    arrivalTargetTime: document.getElementById("settingArrivalTargetTime"),
    mapOrigin: document.getElementById("settingMapOrigin"),
    mapDestination: document.getElementById("settingMapDestination"),
  };
  const saveButton = document.getElementById("saveTripSettingsButton");
  const resetButton = document.getElementById("resetTripSettingsButton");
  let lastFocusedElement = null;

  function openDrawer() {
    lastFocusedElement = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      drawer.classList.add("is-visible");
      drawer.setAttribute("aria-hidden", "false");
      openButton.setAttribute("aria-expanded", "true");
      document.body.classList.add("settings-open");
      closeButton.focus();
    });
  }

  function closeDrawer() {
    overlay.classList.remove("is-visible");
    drawer.classList.remove("is-visible");
    drawer.setAttribute("aria-hidden", "true");
    openButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("settings-open");
    window.setTimeout(() => {
      overlay.hidden = true;
    }, 220);
    if (lastFocusedElement?.focus) lastFocusedElement.focus();
  }

  function fillInputs(settings) {
    Object.entries(fields).forEach(([key, input]) => {
      if (input) input.value = settings[key] || "";
    });
  }

  function collectInputs() {
    const current = getTripSettings();
    Object.entries(fields).forEach(([key, input]) => {
      if (input) current[key] = input.value.trim() || trip.defaults[key] || "";
    });
    current.heroRouteLabel = current.routeLabel;
    current.departureSummaryLabel = "出発地を出る時間";
    current.arrivalSummaryLabel = "到着しておきたい時間";
    current.mapNote = `${current.mapOrigin}についたら${current.mapDestination}方面へ移動。`;
    return normalizeTripSettings(current);
  }

  let state = getTripSettings();
  fillInputs(state);
  renderTripSettings(state);

  openButton.addEventListener("click", openDrawer);
  closeButton.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("is-visible")) {
      closeDrawer();
    }
  });

  saveButton.addEventListener("click", () => {
    state = collectInputs();
    saveTripSettings(state);
    renderTripSettings(state);
    groupSync.scheduleSave();
  });

  resetButton.addEventListener("click", () => {
    state = normalizeTripSettings();
    saveTripSettings(state);
    fillInputs(state);
    renderTripSettings(state);
    groupSync.scheduleSave();
  });

  groupSync.register("tripSettings", {
    get: () => state,
    set: (nextState) => {
      state = normalizeTripSettings(nextState);
      saveTripSettings(state);
      fillInputs(state);
      renderTripSettings(state);
    },
  });
}

function initCountdown() {
  const el = document.getElementById("daysUntil");
  const now = new Date();
  const diff = trip.departure.getTime() - now.getTime();

  if (diff <= 0) {
    el.textContent = "旅行当日";
    return;
  }

  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  el.textContent = `あと${days}日`;
}

function initMap() {
  const { hotel } = trip.points;
  const status = document.getElementById("locationStatus");
  const locateButton = document.getElementById("locateButton");

  locateButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      status.textContent = "このブラウザでは現在地が使えなさそうです。";
      return;
    }

    status.textContent = "今いる場所を確認中...";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const settings = getTripSettings();
        if (settings.mapDestination !== trip.defaults.mapDestination) {
          status.textContent = "現在地を確認しました。目的地までの詳しい経路はGoogle Mapsで見てください。";
          return;
        }
        const distance = haversine(latitude, longitude, hotel.lat, hotel.lng);
        status.textContent = `現在地を確認しました。ホテルまでは直線で約${distance.toFixed(1)}kmです。`;
      },
      () => {
        status.textContent = "現在地の許可が出ていないみたいです。必要な時にもう一度押してみてください。";
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

function initGroupControls() {
  const createButton = document.getElementById("createGroupButton");
  const joinButton = document.getElementById("joinGroupButton");
  const refreshButton = document.getElementById("refreshGroupButton");
  const copyButton = document.getElementById("copyJoinCodeButton");
  const toggleButton = document.getElementById("toggleGroupFormButton");
  const nameInput = document.getElementById("groupNameInput");
  const joinCodeInput = document.getElementById("joinCodeInput");

  groupSync.initElements();

  toggleButton.addEventListener("click", () => {
    groupSync.toggleForm();
  });

  createButton.addEventListener("click", async () => {
    groupSync.render("グループを作成中...");
    try {
      await groupSync.create(nameInput.value.trim() || getTripSettings().routeLabel || "旅行グループ");
    } catch (error) {
      groupSync.render(error.message);
    }
  });

  joinButton.addEventListener("click", async () => {
    groupSync.render("グループに参加中...");
    try {
      await groupSync.join(joinCodeInput.value);
    } catch (error) {
      groupSync.render(error.message);
    }
  });

  refreshButton.addEventListener("click", async () => {
    groupSync.render("共有データを読み込み中...");
    try {
      await groupSync.refresh();
    } catch (error) {
      groupSync.render(error.message);
    }
  });

  copyButton.addEventListener("click", async () => {
    if (!groupSync.active?.joinCode) {
      groupSync.render("まだ参加コードがありません。");
      return;
    }

    try {
      await navigator.clipboard.writeText(groupSync.active.joinCode);
      groupSync.render("参加コードをコピーしました。");
    } catch {
      groupSync.render(`参加コードは ${groupSync.active.joinCode} です。`);
    }
  });

  if (groupSync.active) {
    groupSync.refresh().catch((error) => groupSync.render(error.message));
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function initCostCalculator() {
  const storageKey = "tripShioriAdjust";
  const legacyStorageKey = "miyakonojoTripAdjust";
  const breakfast = document.getElementById("breakfastToggle");
  const hotelNoBreakfastInput = document.getElementById("hotelNoBreakfastCost");
  const hotelBreakfastInput = document.getElementById("hotelBreakfastCostInput");
  const hotelCost = document.getElementById("hotelCost");
  const souvenirCost = document.getElementById("souvenirCost");
  const totalCost = document.getElementById("totalCost");
  const tripNoteTotalCost = document.getElementById("tripNoteTotalCost");
  const customCostRows = document.getElementById("customCostRows");
  const customCostList = document.getElementById("customCostList");
  const addCustomCostButton = document.getElementById("addCustomCostButton");
  const souvenirList = document.getElementById("souvenirList");
  const addSouvenirButton = document.getElementById("addSouvenirButton");

  const defaults = {
    breakfast: false,
    hotelNoBreakfast: trip.costs.hotelLow,
    hotelBreakfast: trip.costs.hotelBreakfast,
    customItems: [],
    souvenirs: [],
  };

  let state = loadAdjustState();

  function loadAdjustState() {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || "{}";
      return normalizeState({ ...defaults, ...JSON.parse(saved) });
    } catch {
      return { ...defaults };
    }
  }

  function normalizeState(value) {
    const next = { ...defaults, ...value };
    next.customItems = Array.isArray(next.customItems) ? next.customItems : [];
    next.souvenirs = Array.isArray(next.souvenirs) ? next.souvenirs : [];

    if (numberValue(next.extra) > 0 && !next.customItems.some((item) => item.id === "legacy-extra")) {
      next.customItems.push({ id: "legacy-extra", name: "その他", amount: numberValue(next.extra) });
    }

    delete next.extra;
    return next;
  }

  function numberValue(value) {
    return Math.max(0, Number(value || 0));
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    groupSync.scheduleSave();
  }

  function makeId() {
    return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function renderCustomItems() {
    customCostList.innerHTML = "";

    if (!state.customItems.length) {
      const empty = document.createElement("p");
      empty.className = "empty-souvenir";
      empty.textContent = "まだ追加項目はありません。";
      customCostList.appendChild(empty);
      renderCustomCostRows();
      return;
    }

    state.customItems.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "custom-cost-row";
      row.innerHTML = `
        <label class="field-chip custom-cost-name-field">
          <span>項目名</span>
          <input class="custom-cost-name" type="text" value="${escapeHtml(item.name)}" aria-label="追加項目の項目名" placeholder="例: バス代">
        </label>
        <label class="field-chip custom-cost-amount-field">
          <span>金額</span>
          <input class="custom-cost-amount" type="number" inputmode="numeric" min="0" step="100" value="${item.amount}" aria-label="追加項目の金額">
        </label>
        <button class="delete-button" type="button" aria-label="追加項目を削除">削除</button>
      `;

      row.querySelector(".custom-cost-name").addEventListener("input", (event) => {
        state.customItems[index].name = event.target.value;
        save();
        renderCustomCostRows();
        update();
      });
      row.querySelector(".custom-cost-amount").addEventListener("input", (event) => {
        state.customItems[index].amount = numberValue(event.target.value);
        save();
        renderCustomCostRows();
        update();
      });
      row.querySelector(".delete-button").addEventListener("click", () => {
        state.customItems.splice(index, 1);
        persistAndUpdate(true);
      });

      customCostList.appendChild(row);
    });

    renderCustomCostRows();
  }

  function renderCustomCostRows() {
    customCostRows.innerHTML = "";

    state.customItems.forEach((item) => {
      const tableRow = document.createElement("div");
      tableRow.setAttribute("role", "row");
      tableRow.className = "custom-cost-table-row";
      tableRow.innerHTML = `
        <span role="cell">${escapeHtml(item.name || "追加項目")}</span>
        <strong role="cell">${formatYen(numberValue(item.amount))}</strong>
      `;
      customCostRows.appendChild(tableRow);
    });
  }

  function renderSouvenirs() {
    souvenirList.innerHTML = "";

    if (!state.souvenirs.length) {
      const empty = document.createElement("p");
      empty.className = "empty-souvenir";
      empty.textContent = "まだお土産はありません。";
      souvenirList.appendChild(empty);
      return;
    }

    state.souvenirs.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "souvenir-row";
      row.innerHTML = `
        <input class="souvenir-name" type="text" value="${escapeHtml(item.name)}" aria-label="お土産名">
        <input class="souvenir-qty" type="number" inputmode="numeric" min="0" step="1" value="${item.qty}" aria-label="個数">
        <input class="souvenir-price" type="number" inputmode="numeric" min="0" step="100" value="${item.price}" aria-label="単価">
        <button class="icon-button" type="button" aria-label="お土産を削除">×</button>
      `;

      row.querySelector(".souvenir-name").addEventListener("input", (event) => {
        state.souvenirs[index].name = event.target.value;
        persistAndUpdate();
      });
      row.querySelector(".souvenir-qty").addEventListener("input", (event) => {
        state.souvenirs[index].qty = numberValue(event.target.value);
        persistAndUpdate();
      });
      row.querySelector(".souvenir-price").addEventListener("input", (event) => {
        state.souvenirs[index].price = numberValue(event.target.value);
        persistAndUpdate();
      });
      row.querySelector(".icon-button").addEventListener("click", () => {
        state.souvenirs.splice(index, 1);
        persistAndUpdate(true);
      });

      souvenirList.appendChild(row);
    });
  }

  function update() {
    const hotel = state.breakfast ? state.hotelBreakfast : state.hotelNoBreakfast;
    const souvenirTotal = state.souvenirs.reduce(
      (sum, item) => sum + numberValue(item.qty) * numberValue(item.price),
      0,
    );
    const customTotal = state.customItems.reduce((sum, item) => sum + numberValue(item.amount), 0);
    const total = trip.costs.flight + trip.costs.access + hotel + souvenirTotal + customTotal;

    hotelCost.textContent = formatYen(hotel);
    souvenirCost.textContent = formatYen(souvenirTotal);
    totalCost.textContent = formatYen(total);
    tripNoteTotalCost.textContent = formatYen(total);
  }

  function persistAndUpdate(rerender = false) {
    save();
    if (rerender) {
      renderCustomItems();
      renderSouvenirs();
    }
    update();
  }

  function applyStateToInputs() {
    breakfast.checked = state.breakfast;
    hotelNoBreakfastInput.value = state.hotelNoBreakfast;
    hotelBreakfastInput.value = state.hotelBreakfast;
    renderCustomItems();
    renderSouvenirs();
    update();
  }

  function setState(nextState) {
    state = normalizeState({ ...defaults, ...nextState });
    save();
    applyStateToInputs();
  }

  breakfast.addEventListener("change", () => {
    state.breakfast = breakfast.checked;
    persistAndUpdate();
  });
  hotelNoBreakfastInput.addEventListener("input", () => {
    state.hotelNoBreakfast = numberValue(hotelNoBreakfastInput.value);
    persistAndUpdate();
  });
  hotelBreakfastInput.addEventListener("input", () => {
    state.hotelBreakfast = numberValue(hotelBreakfastInput.value);
    persistAndUpdate();
  });
  addCustomCostButton.addEventListener("click", () => {
    state.customItems.push({ id: makeId(), name: "", amount: 0 });
    persistAndUpdate(true);
  });
  addSouvenirButton.addEventListener("click", () => {
    state.souvenirs.push({ name: "", qty: 1, price: 0 });
    persistAndUpdate(true);
  });

  groupSync.register("adjust", {
    get: () => state,
    set: setState,
  });
  applyStateToInputs();
}

function initChecklist() {
  const storageKey = "tripShioriChecklist";
  const legacyStorageKey = "miyakonojoTripChecklist";
  const container = document.getElementById("checklistItems");
  const input = document.getElementById("newChecklistItem");
  const addButton = document.getElementById("addChecklistItemButton");

  let state = loadChecklistState();

  function defaultState() {
    return {
      items: trip.checklist.map((label) => ({
        id: `default-${label}`,
        label,
        checked: false,
        removable: true,
      })),
    };
  }

  function loadChecklistState() {
    const legacy = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || "null");
    if (legacy && !Array.isArray(legacy.items)) {
      const migrated = defaultState();
      migrated.items.forEach((item) => {
        item.checked = Boolean(legacy[item.label]);
      });
      localStorage.setItem(storageKey, JSON.stringify(migrated));
      return migrated;
    }

    return normalizeChecklistState(legacy || defaultState());
  }

  function normalizeChecklistState(value) {
    const next = value && Array.isArray(value.items) ? value : defaultState();
    next.items = next.items
      .filter((item) => item && String(item.label || "").trim())
      .map((item, index) => ({
        id: item.id || `item-${index}`,
        label: String(item.label).trim(),
        checked: Boolean(item.checked),
        removable: true,
      }));
    return next;
  }

  function makeId() {
    return `check-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    groupSync.scheduleSave();
  }

  function render() {
    container.innerHTML = "";

    state.items.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "check-item";
      row.innerHTML = `
        <label class="check-label">
          <input type="checkbox" ${entry.checked ? "checked" : ""}>
          <span>${escapeHtml(entry.label)}</span>
        </label>
        <button class="delete-button check-delete" type="button" aria-label="${escapeHtml(entry.label)}を削除">削除</button>
      `;

      row.querySelector("input").addEventListener("change", (event) => {
        entry.checked = event.target.checked;
        save();
        row.classList.toggle("is-checked", entry.checked);
      });
      row.querySelector(".check-delete").addEventListener("click", () => {
        state.items = state.items.filter((item) => item.id !== entry.id);
        save();
        render();
      });
      row.classList.toggle("is-checked", entry.checked);
      container.appendChild(row);
    });
  }

  function addItem() {
    const label = input.value.trim();
    if (!label) return;

    state.items.push({
      id: makeId(),
      label,
      checked: false,
      removable: true,
    });
    input.value = "";
    save();
    render();
  }

  addButton.addEventListener("click", addItem);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addItem();
  });

  groupSync.register("checklist", {
    get: () => state,
    set: (nextState) => {
      state = normalizeChecklistState(nextState);
      save();
      render();
    },
  });
  render();
}

function initSharedNotes() {
  const storageKey = "tripShioriSharedNotes";
  const legacyStorageKey = "miyakonojoTripSharedNotes";
  const container = document.getElementById("sharedNotes");
  const input = document.getElementById("newSharedNote");
  const addButton = document.getElementById("addSharedNoteButton");

  let state = loadNotesState();

  function defaultState() {
    return {
      items: trip.notes.map((text) => ({
        id: `default-${text}`,
        text,
      })),
    };
  }

  function loadNotesState() {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
      return normalizeNotesState(JSON.parse(saved || "null") || defaultState());
    } catch {
      return defaultState();
    }
  }

  function normalizeNotesState(value) {
    const next = value && Array.isArray(value.items) ? value : defaultState();
    next.items = next.items
      .filter((item) => item && String(item.text || "").trim())
      .map((item, index) => ({
        id: item.id || `note-${index}`,
        text: String(item.text).trim(),
      }));
    return next;
  }

  function makeId() {
    return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    groupSync.scheduleSave();
  }

  function render() {
    container.innerHTML = "";

    if (!state.items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-souvenir";
      empty.textContent = "まだ共有メモはありません。";
      container.appendChild(empty);
      return;
    }

    state.items.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "shared-note-item";
      row.innerHTML = `
        <p>${escapeHtml(entry.text)}</p>
        <button class="delete-button" type="button" aria-label="共有メモを削除">削除</button>
      `;

      row.querySelector(".delete-button").addEventListener("click", () => {
        state.items = state.items.filter((item) => item.id !== entry.id);
        save();
        render();
      });
      container.appendChild(row);
    });
  }

  function addNote() {
    const text = input.value.trim();
    if (!text) return;

    state.items.push({ id: makeId(), text });
    input.value = "";
    save();
    render();
  }

  addButton.addEventListener("click", addNote);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addNote();
  });

  groupSync.register("notes", {
    get: () => state,
    set: (nextState) => {
      state = normalizeNotesState(nextState);
      save();
      render();
    },
  });
  render();
}

function initPrint() {
  document.getElementById("printButton").addEventListener("click", () => {
    window.print();
  });
}

function initRevealAnimations() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tripNote = document.querySelector(".hero-card");
  const targets = [
    ...document.querySelectorAll(".hero-illustration, .hero-card, .summary-strip > div, .section-heading"),
    ...document.querySelectorAll(".cost-table, .calculator, .notes-section"),
    ...document.querySelectorAll(".timeline li, .check-item, .shared-note-item"),
  ];

  targets.forEach((el, index) => {
    if (el.matches(".hero-card")) {
      el.classList.add("trip-note-slide");
      el.style.setProperty("--reveal-delay", "140ms");
    } else {
      el.classList.add("reveal");
      el.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
    }

    if (el.matches(".summary-strip > div, .cost-table, .calculator, .notes-section")) {
      el.classList.add("memo-pop");
    }

    if (el.matches(".hero-illustration")) {
      el.classList.add("illustration-reveal");
    }

    if (el.matches(".section-heading, .timeline li")) {
      el.classList.add("note-left");
    }

    if (el.matches(".map-shell, .info-panel, .check-item, .shared-note-item")) {
      el.classList.add("bookmark-slide");
    }
  });

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12,
    },
  );

  targets.forEach((el) => observer.observe(el));

  if (tripNote && window.scrollY < 24) {
    observer.unobserve(tripNote);
    tripNote.classList.remove("is-visible");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(() => {
          tripNote.classList.add("is-visible");
        }, 80);
      });
    });
  }
}

function initPwa() {
  const installButton = document.getElementById("installPwaButton");
  const installStatus = document.getElementById("installPwaStatus");
  let deferredPrompt = null;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  function showStatus(message) {
    if (installStatus) installStatus.textContent = message;
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        showStatus("オフライン準備に失敗しました。通信が安定している時にもう一度開いてください。");
      });
    });
  }

  if (!installButton) return;

  if (isStandalone) {
    installButton.hidden = true;
    showStatus("");
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
    showStatus("この端末にアプリとして追加できます。");
  });

  installButton.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      showStatus("追加できたら、ホーム画面から開けます。");
      return;
    }

    if (isIos) {
      showStatus("iPhoneはSafariの共有ボタンから「ホーム画面に追加」を選んでください。");
      return;
    }

    showStatus("ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initCountdown();
  initTripSettings();
  initMap();
  initCostCalculator();
  initChecklist();
  initSharedNotes();
  initGroupControls();
  initRevealAnimations();
  initPrint();
  initPwa();
});
