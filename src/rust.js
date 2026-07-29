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
