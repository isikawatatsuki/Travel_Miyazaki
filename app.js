const trip = {
  departure: new Date("2026-09-21T05:40:00+09:00"),
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
    "Peachの予約",
    "ホテルの予約",
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
    "Peachは関西空港第2ターミナル。関西空港駅から連絡バスに乗る時間も見ておく。",
    "チェックインは出発30分前まで、保安検査は25分前まで、搭乗口は20分前までが目安。",
    "ミニマム運賃だと、預け荷物や座席指定は追加料金になることがあります。",
    "鹿児島空港に着いた後の移動と、待ち合わせ場所は事前に決めておくと楽。",
    "ホテルは料金、禁煙・喫煙、チェックイン時間、キャンセル条件だけ最後に見ておく。",
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

const shareRegistry = {};

function encodeShareState(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

async function buildCombinedShareLink(output, status) {
  const url = new URL(window.location.href);

  if (shareRegistry.adjust) {
    url.searchParams.set("adjust", encodeShareState(shareRegistry.adjust()));
  }

  if (shareRegistry.checklist) {
    url.searchParams.set("checklist", encodeShareState(shareRegistry.checklist()));
  }

  if (shareRegistry.notes) {
    url.searchParams.set("notes", encodeShareState(shareRegistry.notes()));
  }

  output.value = url.toString();

  try {
    await navigator.clipboard.writeText(output.value);
    status.textContent = "ADJUST・持ち物・共有メモのリンクをコピーしました。";
  } catch {
    status.textContent = "共有リンクを作りました。コピーして送ってください。";
    output.focus();
    output.select();
  }
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
  const storageKey = "miyakonojoTripAdjust";
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
  const shareAdjustButton = document.getElementById("shareAdjustButton");
  const shareUrl = document.getElementById("shareUrl");
  const shareStatus = document.getElementById("shareStatus");

  const defaults = {
    breakfast: false,
    hotelNoBreakfast: trip.costs.hotelLow,
    hotelBreakfast: trip.costs.hotelBreakfast,
    customItems: [],
    souvenirs: [],
  };

  let state = loadAdjustState();

  function loadAdjustState() {
    const shared = readSharedAdjustState();
    if (shared) {
      localStorage.setItem(storageKey, JSON.stringify(shared));
      return shared;
    }

    try {
      return normalizeState({ ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || "{}") });
    } catch {
      return { ...defaults };
    }
  }

  function readSharedAdjustState() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("adjust");
    if (!encoded) return null;

    try {
      return normalizeState({ ...defaults, ...JSON.parse(decodeURIComponent(escape(atob(encoded)))) });
    } catch {
      return null;
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
  shareAdjustButton.addEventListener("click", async () => {
    await buildCombinedShareLink(shareUrl, shareStatus);
  });

  shareRegistry.adjust = () => state;
  applyStateToInputs();
}

function initChecklist() {
  const storageKey = "miyakonojoTripChecklist";
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
    const shared = readSharedChecklistState();
    if (shared) {
      localStorage.setItem(storageKey, JSON.stringify(shared));
      return shared;
    }

    const legacy = JSON.parse(localStorage.getItem(storageKey) || "null");
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

  function readSharedChecklistState() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("checklist");
    if (!encoded) return null;

    try {
      return normalizeChecklistState(JSON.parse(decodeURIComponent(escape(atob(encoded)))));
    } catch {
      return null;
    }
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

  shareRegistry.checklist = () => state;
  render();
}

function initSharedNotes() {
  const storageKey = "miyakonojoTripSharedNotes";
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
    const shared = readSharedNotesState();
    if (shared) {
      localStorage.setItem(storageKey, JSON.stringify(shared));
      return shared;
    }

    try {
      return normalizeNotesState(JSON.parse(localStorage.getItem(storageKey) || "null") || defaultState());
    } catch {
      return defaultState();
    }
  }

  function readSharedNotesState() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("notes");
    if (!encoded) return null;

    try {
      return normalizeNotesState(JSON.parse(decodeURIComponent(escape(atob(encoded)))));
    } catch {
      return null;
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
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

  shareRegistry.notes = () => state;
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

document.addEventListener("DOMContentLoaded", () => {
  initCountdown();
  initMap();
  initCostCalculator();
  initChecklist();
  initSharedNotes();
  initRevealAnimations();
  initPrint();
});
