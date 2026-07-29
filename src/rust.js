document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-api-form]");
  if (!form) return;
  event.preventDefault();

  const message = form.querySelector(".form-message");
  const button = form.querySelector("button[type=submit]");
  const payload = Object.fromEntries(new FormData(form));
  for (const [key, value] of Object.entries(payload)) {
    if (value === "") payload[key] = null;
  }

  button.disabled = true;
  message.textContent = "保存しています…";
  try {
    const response = await fetch(form.dataset.apiForm, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await response.text() || "保存に失敗しました");
    window.location.assign(form.dataset.redirect);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
});

const ticketDialog = document.querySelector("[data-ticket-dialog]");
const openTicketDialog = () => {
  if (!ticketDialog) return;
  ticketDialog.hidden = false;
  ticketDialog.querySelector("input[name=name]")?.focus();
};
const closeTicketDialog = () => {
  if (ticketDialog) ticketDialog.hidden = true;
};

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-ticket-dialog]")) openTicketDialog();
  if (event.target.closest("[data-close-ticket-dialog]")) closeTicketDialog();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeTicketDialog();
});

const planPage = document.querySelector("[data-plan-page]");
if (planPage) {
  const viewer = planPage.querySelector("[data-plan-viewer]");
  const editor = planPage.querySelector("[data-plan-editor]");
  const description = planPage.querySelector("[data-plan-description]");
  const primaryToggle = planPage.querySelector(".plan-edit-toggle");
  const tripId = window.location.pathname.split("/")[2];
  let editing = false;

  const setEditing = (next) => {
    editing = next;
    viewer.hidden = editing;
    editor.hidden = !editing;
    primaryToggle.setAttribute("aria-pressed", String(editing));
    primaryToggle.classList.toggle("button-primary", editing);
    primaryToggle.classList.toggle("button-secondary", !editing);
    primaryToggle.querySelector("span").textContent = editing ? "編集を完了" : "予定を設定";
    description.textContent = editing
      ? "変更した内容は、この端末に自動で保存されます。"
      : "日ごとの流れを、時間順にさくっと確認できます。";
  };

  planPage.addEventListener("click", async (event) => {
    const dayButton = event.target.closest("[data-plan-day]");
    if (dayButton) {
      const day = dayButton.dataset.planDay;
      planPage.querySelectorAll("[data-plan-day]").forEach((button) => {
        const active = button === dayButton;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
      planPage.querySelectorAll("[data-plan-day-content]").forEach((content) => {
        content.hidden = content.dataset.planDayContent !== day;
      });
      return;
    }
    if (event.target.closest("[data-plan-edit-toggle]")) {
      setEditing(!editing);
      return;
    }
    const add = event.target.closest("[data-add-schedule]");
    if (add) {
      add.disabled = true;
      const response = await fetch(`/api/trips/${tripId}/schedule`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ day: add.dataset.day, starts_at: null, title: "", memo: "", location_name: "" }),
      });
      if (response.ok) window.location.reload(); else add.disabled = false;
      return;
    }
    const remove = event.target.closest("[data-delete-schedule]");
    if (remove) {
      const card = remove.closest("[data-schedule-item]");
      remove.disabled = true;
      const response = await fetch(`/api/trips/${tripId}/schedule/${card.dataset.scheduleItem}/delete`, { method: "POST" });
      if (response.ok) window.location.reload(); else remove.disabled = false;
    }
  });

  const saveCard = async (card) => {
    const unset = card.querySelector("[data-time-unset]").checked;
    const value = (name) => card.querySelector(`[name=${name}]`)?.value || "";
    const message = card.querySelector(".form-message");
    message.textContent = "保存しています…";
    const response = await fetch(`/api/trips/${tripId}/schedule/${card.dataset.scheduleItem}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        starts_at: unset ? null : value("starts_at") || null,
        title: value("title"), memo: value("memo"), location_name: value("location_name"),
        map_url: value("map_url"), latitude: null, longitude: null,
        include_in_route: card.querySelector("[name=include_in_route]").checked,
      }),
    });
    message.textContent = response.ok ? "保存しました" : "保存に失敗しました";
  };

  planPage.addEventListener("change", (event) => {
    const card = event.target.closest("[data-schedule-item]");
    if (!card) return;
    if (event.target.matches("[data-time-unset]")) {
      card.querySelector("[name=starts_at]").disabled = event.target.checked;
    }
    void saveCard(card);
  });
  planPage.querySelectorAll("[data-time-unset]").forEach((checkbox) => {
    checkbox.closest("[data-schedule-item]").querySelector("[name=starts_at]").disabled = checkbox.checked;
  });
}

document.addEventListener("change", async (event) => {
  const toggle = event.target.closest("[data-check-toggle]");
  if (!toggle) return;
  toggle.disabled = true;
  const response = await fetch(toggle.dataset.checkToggle, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ checked: toggle.checked }),
  });
  if (response.ok) window.location.reload();
  else toggle.disabled = false;
});

document.addEventListener("click", async (event) => {
  const remove = event.target.closest("[data-delete-url]");
  if (!remove) return;
  remove.disabled = true;
  const response = await fetch(remove.dataset.deleteUrl, { method: "POST" });
  if (response.ok) window.location.reload();
  else remove.disabled = false;
});

// 行を1つ足すだけのボタン。本文は無いので、サーバー側が既定値を決める。
document.addEventListener("click", async (event) => {
  const add = event.target.closest("[data-post-url]");
  if (!add) return;
  add.disabled = true;
  const response = await fetch(add.dataset.postUrl, { method: "POST" });
  if (response.ok) window.location.reload();
  else add.disabled = false;
});

const moneyAmount = (value) => Math.max(0, Number(value || 0));

// 割り勘対象は「チェックした順」で持つ。端数の1円は先頭から配られるので、
// 画面の並び順に詰め直すと誰が1円多く払うかが変わってしまう。
const participantOrder = new WeakMap();
const readParticipants = (row) => {
  if (!participantOrder.has(row)) {
    const stored = (row.dataset.participants || "").split(",").filter(Boolean);
    const everyone = [...row.querySelectorAll("[name=participant_ids]")].map((box) => box.value);
    participantOrder.set(row, stored.length ? stored : everyone);
  }
  return participantOrder.get(row);
};

const postMoney = async (url, body, message) => {
  if (message) message.textContent = "保存しています…";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error();
    if (message) message.textContent = "保存しました";
    return true;
  } catch {
    if (message) message.textContent = "保存に失敗しました";
    return false;
  }
};

// 合計はサーバーが計算するので、保存できたら読み直す。ただし文字入力の change は
// 次の欄へ移った時点で飛ぶため、そのまま再読み込みすると入力中の欄が消える。
// 金額欄から完全に離れるまで待ってから読み直す。
const MONEY_ROW = "[data-budget-form],[data-budget-item],[data-payment-row]";
let moneyStale = false;

const refreshMoney = () => {
  if (!moneyStale) return;
  if (document.activeElement?.closest(MONEY_ROW)) return;
  window.location.reload();
};

const reloadAfterSave = (saved, source) => {
  if (!saved) return;
  moneyStale = true;
  // チェックやプルダウンは入力途中が無いので、その場で反映する。
  if (source.type === "checkbox" || source.tagName === "SELECT") window.location.reload();
  else refreshMoney();
};

document.addEventListener("focusout", () => setTimeout(refreshMoney, 0));

document.addEventListener("change", async (event) => {
  const source = event.target;
  const budget = source.closest("[data-budget-form]");
  if (budget && source.matches("[data-budget-field]")) {
    const value = (name) => budget.querySelector(`[name=${name}]`);
    reloadAfterSave(await postMoney(budget.dataset.budgetForm, {
      transport_cost: moneyAmount(value("transport_cost").value),
      access_cost: moneyAmount(value("access_cost").value),
      breakfast: value("breakfast").checked,
      hotel_without_breakfast: moneyAmount(value("hotel_without_breakfast").value),
      hotel_with_breakfast: moneyAmount(value("hotel_with_breakfast").value),
    }, budget.querySelector(".form-message")), source);
    return;
  }

  const item = source.closest("[data-budget-item]");
  if (item && source.matches("[data-budget-item-field]")) {
    const value = (name) => item.querySelector(`[name=${name}]`)?.value ?? "";
    reloadAfterSave(await postMoney(item.dataset.budgetItem, {
      name: value("name"),
      quantity: moneyAmount(value("quantity")),
      unit_amount: moneyAmount(value("unit_amount")),
    }, item.querySelector(".form-message")), source);
    return;
  }

  const payment = source.closest("[data-payment-row]");
  if (payment && source.matches("[data-payment-field]")) {
    let participants = readParticipants(payment);
    if (source.matches("[name=participant_ids]")) {
      const next = source.checked
        ? [...participants, source.value]
        : participants.filter((id) => id !== source.value);
      // TS版は全員外すのを許さず、最後に触れた1人だけを残す。
      participants = next.length ? next : [source.value];
      if (!next.length) source.checked = true;
      participantOrder.set(payment, participants);
    }
    reloadAfterSave(await postMoney(payment.dataset.paymentRow, {
      title: payment.querySelector("[name=title]").value,
      payer_id: payment.querySelector("[name=payer_id]")?.value || null,
      amount: moneyAmount(payment.querySelector("[name=amount]").value),
      participant_ids: participants,
    }, payment.querySelector(".form-message")), source);
  }
});
