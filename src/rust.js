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
