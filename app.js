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

function initScheduleEditor() {
  const storageKey = "tripShioriSchedule";
  const tabsEl = document.getElementById("scheduleTabs");
  const listEl = document.getElementById("scheduleItems");
  const addButton = document.getElementById("addScheduleItemButton");
  const viewTabsEl = document.getElementById("scheduleViewTabs");
  const viewListEl = document.getElementById("scheduleViewItems");

  if (!tabsEl || !listEl || !addButton || !viewTabsEl || !viewListEl) return;

  const days = [
    { id: "2026-09-21", label: "9/21", detail: "Day 1" },
    { id: "2026-09-22", label: "9/22", detail: "Day 2" },
    { id: "2026-09-23", label: "9/23", detail: "Day 3" },
  ];
  const defaults = {
    activeDay: days[0].id,
    items: [
      {
        id: "schedule-ikoaka",
        day: "2026-09-21",
        time: "05:40",
        title: "市岡元町を出る",
        memo: "弁天町駅まで徒歩10分。朝早いので、荷物と天気を見つつちょい余裕を持つ。",
        mapUrl: "",
        isTimeUnset: false,
      },
      {
        id: "schedule-bentencho",
        day: "2026-09-21",
        time: "05:50",
        title: "弁天町駅",
        memo: "弁天町から関空まで、1人片道1,180円で見ています。",
        mapUrl: "",
        isTimeUnset: false,
      },
      {
        id: "schedule-kix-station",
        day: "2026-09-21",
        time: "07:00",
        title: "関西空港駅",
        memo: "エアロプラザ1階から、第2ターミナル行きの無料連絡バスへ。",
        mapUrl: "",
        isTimeUnset: false,
      },
      {
        id: "schedule-kix-t2",
        day: "2026-09-21",
        time: "07:15",
        title: "関空第2ターミナル",
        memo: "Peachのチェックイン、手荷物、保安検査へ。混むかもなので、ここは早めに動く。",
        mapUrl: "",
        isTimeUnset: false,
      },
      {
        id: "schedule-mm193",
        day: "2026-09-21",
        time: "08:30",
        title: "MM193 出発",
        memo: "関西空港から鹿児島空港へ。09:45到着予定。",
        mapUrl: "",
        isTimeUnset: false,
      },
      {
        id: "schedule-mm198",
        day: "2026-09-23",
        time: "16:30",
        title: "MM198 復路出発",
        memo: "鹿児島空港から関西空港へ。17:50到着予定。",
        mapUrl: "",
        isTimeUnset: false,
      },
    ],
  };

  let state = loadState();

  function makeId() {
    return `schedule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeState(value = {}) {
    const validDayIds = new Set(days.map((day) => day.id));
    const items = Array.isArray(value.items) ? value.items : defaults.items;
    return {
      activeDay: validDayIds.has(value.activeDay) ? value.activeDay : days[0].id,
      items: items.map((item) => ({
        id: item.id || makeId(),
        day: validDayIds.has(item.day) ? item.day : days[0].id,
        time: String(item.time || "").slice(0, 5),
        title: String(item.title || "").slice(0, 40),
        memo: String(item.memo || "").slice(0, 120),
        mapUrl: String(item.mapUrl || "").slice(0, 300),
        isTimeUnset: Boolean(item.isTimeUnset),
      })),
    };
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(storageKey) || "{}"));
    } catch {
      return normalizeState(defaults);
    }
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    groupSync.scheduleSave();
  }

  function sortedItems() {
    return state.items
      .filter((item) => item.day === state.activeDay)
      .sort((a, b) => {
        if (a.isTimeUnset !== b.isTimeUnset) return a.isTimeUnset ? 1 : -1;
        return (a.time || "99:99").localeCompare(b.time || "99:99");
      });
  }

  function persistAndRender() {
    save();
    render();
  }

  function renderTabs(targetEl) {
    targetEl.innerHTML = "";
    days.forEach((day) => {
      const count = state.items.filter((item) => item.day === day.id).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `schedule-tab${state.activeDay === day.id ? " is-active" : ""}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", state.activeDay === day.id ? "true" : "false");
      button.innerHTML = `
        <strong>${escapeHtml(day.label)}</strong>
        <span>${escapeHtml(day.detail)} / ${count}件</span>
      `;
      button.addEventListener("click", () => {
        state.activeDay = day.id;
        persistAndRender();
      });
      targetEl.appendChild(button);
    });
  }

  function renderViewItems() {
    viewListEl.innerHTML = "";
    const items = sortedItems();

    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "schedule-empty";
      empty.innerHTML = `
        <time>未定</time>
        <div>
          <h3>まだ予定はありません</h3>
          <p>予定設定ページから、行きたい場所や移動メモを入れられます。</p>
        </div>
      `;
      viewListEl.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("li");
      row.className = "schedule-view-item";
      row.innerHTML = `
        <time>${item.isTimeUnset ? "未定" : escapeHtml(item.time || "未定")}</time>
        <div>
          <h3>${escapeHtml(item.title || "予定")}</h3>
          <p>${escapeHtml(item.memo || "メモはまだありません。")}</p>
          ${item.mapUrl ? `<a class="mini-button schedule-map-link" href="${escapeHtml(item.mapUrl)}" target="_blank" rel="noreferrer">地図で見る</a>` : ""}
        </div>
      `;
      viewListEl.appendChild(row);
    });
  }

  function renderItems() {
    listEl.innerHTML = "";
    const items = sortedItems();

    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "schedule-empty";
      empty.innerHTML = `
        <time>未定</time>
        <div>
          <h3>まだ予定はありません</h3>
          <p>「予定を追加」から、行きたい場所や移動メモを入れられます。</p>
        </div>
      `;
      listEl.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const index = state.items.findIndex((candidate) => candidate.id === item.id);
      const row = document.createElement("li");
      row.className = "schedule-item";
      row.innerHTML = `
        <time>${item.isTimeUnset ? "未定" : escapeHtml(item.time || "未定")}</time>
        <div class="schedule-item-card">
          <div class="schedule-item-grid">
            <label class="field-chip">
              <span>日付</span>
              <select class="schedule-day" aria-label="予定の日付">
                ${days.map((day) => `<option value="${day.id}" ${day.id === item.day ? "selected" : ""}>${day.label}</option>`).join("")}
              </select>
            </label>
            <label class="field-chip">
              <span>時刻</span>
              <input class="schedule-time" type="time" value="${escapeHtml(item.time)}" aria-label="予定の時刻" ${item.isTimeUnset ? "disabled" : ""}>
            </label>
            <label class="schedule-unset-field">
              <input class="schedule-unset" type="checkbox" ${item.isTimeUnset ? "checked" : ""}>
              <span>時間未定</span>
            </label>
            <label class="field-chip schedule-title-field">
              <span>内容</span>
              <input class="schedule-title" type="text" value="${escapeHtml(item.title)}" placeholder="例: ランチ" aria-label="予定の内容">
            </label>
            <label class="field-chip schedule-memo-field">
              <span>メモ</span>
              <input class="schedule-memo" type="text" value="${escapeHtml(item.memo)}" placeholder="例: 集合場所、予約名、注意点" aria-label="予定のメモ">
            </label>
            <label class="field-chip schedule-map-field">
              <span>地図URL</span>
              <input class="schedule-map" type="url" value="${escapeHtml(item.mapUrl)}" placeholder="Google Maps URL" aria-label="予定の地図URL">
            </label>
          </div>
          <div class="schedule-row-actions">
            ${item.mapUrl ? `<a class="mini-button schedule-map-link" href="${escapeHtml(item.mapUrl)}" target="_blank" rel="noreferrer">地図</a>` : ""}
            <button class="delete-button" type="button">削除</button>
          </div>
        </div>
      `;

      row.querySelector(".schedule-day").addEventListener("change", (event) => {
        state.items[index].day = event.target.value;
        state.activeDay = event.target.value;
        persistAndRender();
      });
      row.querySelector(".schedule-time").addEventListener("input", (event) => {
        state.items[index].time = event.target.value;
        persistAndRender();
      });
      row.querySelector(".schedule-unset").addEventListener("change", (event) => {
        state.items[index].isTimeUnset = event.target.checked;
        persistAndRender();
      });
      row.querySelector(".schedule-title").addEventListener("input", (event) => {
        state.items[index].title = event.target.value;
        save();
      });
      row.querySelector(".schedule-memo").addEventListener("input", (event) => {
        state.items[index].memo = event.target.value;
        save();
      });
      row.querySelector(".schedule-map").addEventListener("input", (event) => {
        state.items[index].mapUrl = event.target.value;
        save();
      });
      row.querySelector(".delete-button").addEventListener("click", () => {
        state.items.splice(index, 1);
        persistAndRender();
      });

      listEl.appendChild(row);
    });
  }

  function render() {
    renderTabs(tabsEl);
    renderTabs(viewTabsEl);
    renderViewItems();
    renderItems();
  }

  function setState(nextState) {
    state = normalizeState(nextState);
    save();
    render();
  }

  addButton.addEventListener("click", () => {
    state.items.push({
      id: makeId(),
      day: state.activeDay,
      time: "",
      title: "",
      memo: "",
      mapUrl: "",
      isTimeUnset: true,
    });
    persistAndRender();
  });

  groupSync.register("schedule", {
    get: () => state,
    set: setState,
  });
  render();
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

function initSettlement() {
  const storageKey = "tripShioriSettlement";
  const personList = document.getElementById("personList");
  const paymentList = document.getElementById("paymentList");
  const addPersonButton = document.getElementById("addPersonButton");
  const addPaymentButton = document.getElementById("addPaymentButton");
  const paymentTotal = document.getElementById("paymentTotal");
  const paymentPerPerson = document.getElementById("paymentPerPerson");
  const settlementResult = document.getElementById("settlementResult");

  if (!personList || !paymentList) return;

  const defaults = {
    people: [
      { id: "person-1", name: "自分" },
      { id: "person-2", name: "相手" },
    ],
    payments: [],
  };

  let state = loadState();

  function numberValue(value) {
    return Math.max(0, Math.round(Number(value || 0)));
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeState(value = {}) {
    const people = Array.isArray(value.people) && value.people.length
      ? value.people
      : defaults.people;
    const normalizedPeople = people
      .map((person, index) => ({
        id: person.id || makeId("person"),
        name: String(person.name || `参加者${index + 1}`).slice(0, 24),
      }))
      .filter((person) => person.name.trim());
    const safePeople = normalizedPeople.length ? normalizedPeople : [...defaults.people];
    const safeIds = new Set(safePeople.map((person) => person.id));
    const payments = Array.isArray(value.payments) ? value.payments : [];

    return {
      people: safePeople,
      payments: payments.map((payment) => ({
        id: payment.id || makeId("payment"),
        title: String(payment.title || "").slice(0, 32),
        payerId: safeIds.has(payment.payerId) ? payment.payerId : safePeople[0].id,
        amount: numberValue(payment.amount),
      })),
    };
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(storageKey) || "{}"));
    } catch {
      return normalizeState(defaults);
    }
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    groupSync.scheduleSave();
  }

  function persistAndRender() {
    save();
    render();
  }

  function renderPeople() {
    personList.innerHTML = "";

    state.people.forEach((person, index) => {
      const row = document.createElement("div");
      row.className = "person-row";
      row.innerHTML = `
        <label class="field-chip">
          <span>参加者</span>
          <input class="person-name" type="text" value="${escapeHtml(person.name)}" aria-label="参加者名">
        </label>
        <button class="delete-button" type="button" ${state.people.length <= 1 ? "disabled" : ""}>削除</button>
      `;

      row.querySelector(".person-name").addEventListener("input", (event) => {
        state.people[index].name = event.target.value;
        save();
        renderPayments();
        renderResult();
      });
      row.querySelector(".delete-button").addEventListener("click", () => {
        const removed = state.people[index];
        state.people.splice(index, 1);
        state.payments.forEach((payment) => {
          if (payment.payerId === removed.id) payment.payerId = state.people[0].id;
        });
        persistAndRender();
      });

      personList.appendChild(row);
    });
  }

  function payerOptions(selectedId) {
    return state.people
      .map((person) => `
        <option value="${escapeHtml(person.id)}" ${person.id === selectedId ? "selected" : ""}>
          ${escapeHtml(person.name || "参加者")}
        </option>
      `)
      .join("");
  }

  function renderPayments() {
    paymentList.innerHTML = "";

    if (!state.payments.length) {
      const empty = document.createElement("p");
      empty.className = "empty-souvenir";
      empty.textContent = "まだ支払いメモはありません。";
      paymentList.appendChild(empty);
      return;
    }

    state.payments.forEach((payment, index) => {
      const row = document.createElement("div");
      row.className = "payment-row";
      row.innerHTML = `
        <label class="field-chip payment-title-field">
          <span>内容</span>
          <input class="payment-title" type="text" value="${escapeHtml(payment.title)}" placeholder="例: タクシー代" aria-label="支払い内容">
        </label>
        <label class="field-chip">
          <span>払った人</span>
          <select class="payment-payer" aria-label="払った人">${payerOptions(payment.payerId)}</select>
        </label>
        <label class="field-chip">
          <span>金額</span>
          <input class="payment-amount" type="number" inputmode="numeric" min="0" step="100" value="${payment.amount}" aria-label="支払い金額">
        </label>
        <button class="delete-button" type="button" aria-label="支払いメモを削除">削除</button>
      `;

      row.querySelector(".payment-title").addEventListener("input", (event) => {
        state.payments[index].title = event.target.value;
        save();
      });
      row.querySelector(".payment-payer").addEventListener("change", (event) => {
        state.payments[index].payerId = event.target.value;
        persistAndRender();
      });
      row.querySelector(".payment-amount").addEventListener("input", (event) => {
        state.payments[index].amount = numberValue(event.target.value);
        save();
        renderResult();
      });
      row.querySelector(".delete-button").addEventListener("click", () => {
        state.payments.splice(index, 1);
        persistAndRender();
      });

      paymentList.appendChild(row);
    });
  }

  function renderResult() {
    const peopleCount = Math.max(1, state.people.length);
    const total = state.payments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);
    const baseShare = Math.floor(total / peopleCount);
    const remainder = total % peopleCount;
    const balances = state.people.map((person, index) => {
      const paid = state.payments
        .filter((payment) => payment.payerId === person.id)
        .reduce((sum, payment) => sum + numberValue(payment.amount), 0);
      const share = baseShare + (index < remainder ? 1 : 0);
      return {
        ...person,
        paid,
        share,
        balance: paid - share,
      };
    });
    const debtors = balances
      .filter((person) => person.balance < 0)
      .map((person) => ({ ...person, amount: Math.abs(person.balance) }));
    const creditors = balances
      .filter((person) => person.balance > 0)
      .map((person) => ({ ...person, amount: person.balance }));
    const transfers = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtors[debtorIndex] && creditors[creditorIndex]) {
      const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
      if (amount > 0) {
        transfers.push({
          from: debtors[debtorIndex].name,
          to: creditors[creditorIndex].name,
          amount,
        });
      }
      debtors[debtorIndex].amount -= amount;
      creditors[creditorIndex].amount -= amount;
      if (debtors[debtorIndex].amount <= 0) debtorIndex += 1;
      if (creditors[creditorIndex].amount <= 0) creditorIndex += 1;
    }

    paymentTotal.textContent = formatYen(total);
    paymentPerPerson.textContent = remainder ? `${formatYen(baseShare)}〜${formatYen(baseShare + 1)}` : formatYen(baseShare);

    if (!total) {
      settlementResult.innerHTML = '<p class="empty-souvenir">支払いを追加すると精算案が出ます。</p>';
      return;
    }

    const balanceRows = balances.map((person) => `
        <div class="settlement-balance-row">
          <span>${escapeHtml(person.name)}</span>
          <small>支払い ${formatYen(person.paid)} / 負担 ${formatYen(person.share)}</small>
        </div>
    `).join("");
    const transferRows = transfers.length
      ? transfers.map((transfer) => `
        <div class="settlement-transfer-row">
          <strong>${escapeHtml(transfer.from)}</strong>
          <span>→</span>
          <strong>${escapeHtml(transfer.to)}</strong>
          <em>${formatYen(transfer.amount)}</em>
        </div>
      `).join("")
      : '<p class="empty-souvenir">今のところ精算は不要です。</p>';

    settlementResult.innerHTML = `
      <div class="settlement-balance-list">${balanceRows}</div>
      <div class="settlement-transfer-list">${transferRows}</div>
    `;
  }

  function render() {
    renderPeople();
    renderPayments();
    renderResult();
  }

  function setState(nextState) {
    state = normalizeState(nextState);
    save();
    render();
  }

  addPersonButton.addEventListener("click", () => {
    state.people.push({ id: makeId("person"), name: `参加者${state.people.length + 1}` });
    persistAndRender();
  });

  addPaymentButton.addEventListener("click", () => {
    state.payments.push({
      id: makeId("payment"),
      title: "",
      payerId: state.people[0].id,
      amount: 0,
    });
    persistAndRender();
  });

  groupSync.register("settlement", {
    get: () => state,
    set: setState,
  });
  render();
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

function initPageRouting() {
  const homePage = document.getElementById("main");
  const scheduleSettingsPage = document.getElementById("scheduleSettingsPage");
  if (!homePage || !scheduleSettingsPage) return;

  function route() {
    const isScheduleSettings = window.location.hash === "#schedule-settings";
    homePage.hidden = isScheduleSettings;
    scheduleSettingsPage.hidden = !isScheduleSettings;
    document.body.classList.toggle("schedule-settings-mode", isScheduleSettings);

    if (isScheduleSettings) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) {
        window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    }
  }

  window.addEventListener("hashchange", route);
  route();
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
  initScheduleEditor();
  initCostCalculator();
  initSettlement();
  initChecklist();
  initSharedNotes();
  initGroupControls();
  initPageRouting();
  initRevealAnimations();
  initPrint();
  initPwa();
});
