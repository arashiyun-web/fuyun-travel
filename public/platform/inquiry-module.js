(function () {
  const API_URL = "/api/inquiry";
  const STATUSES = ["New", "Quoted", "Confirmed", "Cancelled"];
  const VEHICLES = ["43-seat Big Bus", "20-seat Medium Bus", "9-seat Luxury Van"];
  const TRIP_TYPES = ["Single-day Tour", "Multi-day Tour", "Point-to-Point Transfer"];

  let inquiryCache = [];
  let auditCache = [];
  let loadingInquiries = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function sanitize(value) {
    return String(value || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
  }

  function apiHeaders() {
    const session = sessionStorage.getItem("travel-commerce-session-v1") || "platform-user";
    return {
      "Content-Type": "application/json",
      "x-fuyun-user": session,
    };
  }

  async function apiRequest(options = {}) {
    const response = await fetch(API_URL, {
      cache: "no-store",
      ...options,
      headers: {
        ...apiHeaders(),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.message || "API request failed");
    }
    return data;
  }

  async function loadInquiries() {
    if (loadingInquiries) return;
    loadingInquiries = true;
    try {
      const data = await apiRequest({ method: "GET" });
      inquiryCache = data.inquiries || [];
      auditCache = data.audit || [];
    } finally {
      loadingInquiries = false;
    }
  }

  function createField(labelText, input) {
    const label = document.createElement("label");
    label.className = "ft-field";
    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(span, input);
    return label;
  }

  function input(name, type = "text", required = false) {
    const node = document.createElement("input");
    node.name = name;
    node.type = type;
    node.required = required;
    return node;
  }

  function select(name, values, required = false) {
    const node = document.createElement("select");
    node.name = name;
    node.required = required;
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      node.appendChild(option);
    });
    return node;
  }

  function textarea(name) {
    const node = document.createElement("textarea");
    node.name = name;
    return node;
  }

  function vehicleCheckboxes(selected = []) {
    const wrap = document.createElement("div");
    wrap.className = "ft-checkbox-grid";
    VEHICLES.forEach((vehicle) => {
      const label = document.createElement("label");
      label.className = "ft-check";
      const box = input("preferred_vehicle", "checkbox");
      box.value = vehicle;
      box.checked = selected.includes(vehicle);
      label.append(box, document.createTextNode(vehicle));
      wrap.appendChild(label);
    });
    return wrap;
  }

  function ensureInquiryModal() {
    if ($("#fuyun-inquiry-modal")) return;

    const modal = document.createElement("section");
    modal.id = "fuyun-inquiry-modal";
    modal.className = "ft-modal hidden";
    modal.innerHTML = `
      <div class="ft-modal-backdrop" data-inquiry-close></div>
      <form class="ft-modal-card" id="fuyun-inquiry-form" novalidate>
        <div class="ft-modal-head">
          <div>
            <p class="eyebrow">Custom Tour & Bus Rental</p>
            <h2>客製旅遊與包車詢價</h2>
            <p class="muted">資料會送入正式後台詢價 API，管理者可在後台查看與編輯。</p>
          </div>
          <button class="ghost-button" type="button" data-inquiry-close>關閉</button>
        </div>
        <div class="ft-form-grid" id="fuyun-inquiry-fields"></div>
        <p class="ft-security-note">正式流程已走 /api/inquiry；後續接上 MongoDB、Turnstile/reCAPTCHA 與 2FA 後，不需更換前台表單。</p>
        <p class="form-message" id="fuyun-inquiry-message"></p>
        <button class="primary-button full" type="submit">送出詢價</button>
      </form>
    `;
    document.body.appendChild(modal);

    const fields = $("#fuyun-inquiry-fields", modal);
    fields.append(
      createField("姓名", input("name", "text", true)),
      createField("電話", input("phone", "tel", true)),
      createField("LINE ID（選填）", input("line_id")),
      createField("旅遊類型", select("trip_type", TRIP_TYPES, true)),
      createField("出發日期與時間", input("start_date", "datetime-local", true)),
      createField("乘客人數", input("passenger_count", "number", true)),
      createField("上車地點", input("pickup_location", "text", true)),
      createField("目的地 / 想走路線", input("destination", "text", true)),
    );

    const vehicleField = document.createElement("div");
    vehicleField.className = "ft-field full";
    vehicleField.innerHTML = "<span>偏好車型</span>";
    vehicleField.appendChild(vehicleCheckboxes());
    fields.appendChild(vehicleField);
    fields.appendChild(createField("特殊需求", textarea("special_requests")));

    $$("[data-inquiry-close]", modal).forEach((node) => node.addEventListener("click", closeInquiryModal));
    $("#fuyun-inquiry-form", modal).addEventListener("submit", submitInquiry);
  }

  function openInquiryModal() {
    ensureInquiryModal();
    $("#fuyun-inquiry-message").textContent = "";
    $("#fuyun-inquiry-modal").classList.remove("hidden");
  }

  function closeInquiryModal() {
    $("#fuyun-inquiry-modal")?.classList.add("hidden");
  }

  function formPayload(form) {
    const data = new FormData(form);
    return {
      id: "iq-" + Date.now(),
      name: sanitize(data.get("name")),
      phone: sanitize(data.get("phone")),
      line_id: sanitize(data.get("line_id")),
      trip_type: sanitize(data.get("trip_type")),
      start_date: sanitize(data.get("start_date")),
      pickup_location: sanitize(data.get("pickup_location")),
      destination: sanitize(data.get("destination")),
      passenger_count: Number(data.get("passenger_count")),
      preferred_vehicle: data.getAll("preferred_vehicle").map(sanitize),
      special_requests: sanitize(data.get("special_requests")),
    };
  }

  function validateInquiry(payload) {
    if (!payload.name || !payload.phone || !payload.start_date) return "請填寫姓名、電話與出發日期。";
    if (!payload.pickup_location || !payload.destination) return "請填寫上車地點與目的地。";
    if (!Number.isInteger(payload.passenger_count) || payload.passenger_count < 1) return "乘客人數必須大於 0。";
    if (!payload.preferred_vehicle.length) return "請至少選擇一種偏好車型。";
    return "";
  }

  async function submitInquiry(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("#fuyun-inquiry-message");
    const payload = formPayload(form);
    const error = validateInquiry(payload);

    if (error) {
      message.textContent = error;
      return;
    }

    message.textContent = "送出中...";

    try {
      const data = await apiRequest({
        method: "POST",
        body: JSON.stringify(payload),
      });
      inquiryCache.unshift(data.inquiry);
      message.textContent = "詢價已送出，我們會盡快聯繫。";
      form.reset();
      setTimeout(closeInquiryModal, 700);
      refreshAdminPanel();
    } catch (error) {
      message.textContent = error.message || "送出失敗，請稍後再試。";
    }
  }

  function inquiryRows(inquiries) {
    if (!inquiries.length) {
      return `<tr><td colspan="6" class="muted">目前尚無詢價資料。</td></tr>`;
    }

    return inquiries
      .map(
        (item) => `
          <tr>
            <td class="table-title">${sanitize(item.name)}</td>
            <td>${sanitize(item.phone_masked || item.phone)}</td>
            <td>${sanitize(item.start_date || "").replace("T", " ")}</td>
            <td>${sanitize(item.pickup_location)} → ${sanitize(item.destination)}</td>
            <td>${sanitize(item.status)}</td>
            <td><button class="small-button" type="button" data-inquiry-id="${item.id}">查看 / 編輯</button></td>
          </tr>
        `,
      )
      .join("");
  }

  function auditItems(audit) {
    if (!audit.length) return "<p class='muted'>目前沒有操作紀錄。</p>";
    return audit
      .slice(0, 8)
      .map(
        (log) =>
          `<div class="notification-item"><strong>${sanitize(log.action)}</strong><p class="muted">${sanitize(log.created_at)} / ${sanitize(log.user_id)} / ${sanitize(log.ip)}</p></div>`,
      )
      .join("");
  }

  function renderInquiryAdminPanel() {
    const panel = document.createElement("section");
    panel.className = "admin-panel ft-inquiry-admin";
    panel.id = "ft-inquiry-admin";
    panel.innerHTML = `
      <p class="eyebrow">Inquiry CRM</p>
      <h2>客製旅遊與包車詢價管理</h2>
      <p class="muted">正式版已引用 /api/inquiry。列表電話採 PII 遮罩；點「查看 / 編輯」可查看完整資料並更新狀態。</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>姓名</th><th>電話</th><th>日期</th><th>路線</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody id="ft-inquiry-rows"><tr><td colspan="6" class="muted">載入中...</td></tr></tbody>
        </table>
      </div>
      <details class="ft-audit">
        <summary id="ft-audit-title">Audit Trail</summary>
        <div class="notification-list" id="ft-audit-list"></div>
      </details>
    `;
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-inquiry-id]");
      if (button) openInquiryEditor(button.dataset.inquiryId);
    });
    return panel;
  }

  async function refreshAdminPanel() {
    const rows = $("#ft-inquiry-rows");
    const auditTitle = $("#ft-audit-title");
    const auditList = $("#ft-audit-list");

    if (!rows) return;
    rows.innerHTML = `<tr><td colspan="6" class="muted">載入中...</td></tr>`;

    try {
      await loadInquiries();
      rows.innerHTML = inquiryRows(inquiryCache);
      if (auditTitle) auditTitle.textContent = `Audit Trail（${auditCache.length}）`;
      if (auditList) auditList.innerHTML = auditItems(auditCache);
    } catch (error) {
      rows.innerHTML = `<tr><td colspan="6" class="muted">${sanitize(error.message || "資料載入失敗。")}</td></tr>`;
    }
  }

  function enhanceAdmin() {
    const adminView = $("#admin-view.active");
    if (!adminView) return;

    if (!$("#ft-inquiry-admin", adminView)) {
      adminView.appendChild(renderInquiryAdminPanel());
    }

    refreshAdminPanel();
  }

  function openInquiryEditor(id) {
    const item = inquiryCache.find((record) => record.id === id);
    if (!item) return;

    let modal = $("#ft-inquiry-editor");
    if (!modal) {
      modal = document.createElement("section");
      modal.id = "ft-inquiry-editor";
      modal.className = "ft-modal";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="ft-modal-backdrop" data-editor-close></div>
      <form class="ft-modal-card" id="ft-inquiry-edit-form">
        <div class="ft-modal-head">
          <div>
            <p class="eyebrow">Edit Inquiry</p>
            <h2>詢價明細編輯</h2>
            <p class="muted">管理者可修改每個欄位，送出後會同步更新正式 API 資料。</p>
          </div>
          <button class="ghost-button" type="button" data-editor-close>關閉</button>
        </div>
        <input type="hidden" name="id" value="${sanitize(item.id)}">
        <div class="ft-form-grid">
          <label class="ft-field"><span>姓名</span><input name="name" required value="${sanitize(item.name)}"></label>
          <label class="ft-field"><span>電話</span><input name="phone" required value="${sanitize(item.phone)}"></label>
          <label class="ft-field"><span>LINE ID</span><input name="line_id" value="${sanitize(item.line_id)}"></label>
          <label class="ft-field"><span>狀態</span><select name="status">${STATUSES.map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
          <label class="ft-field"><span>旅遊類型</span><select name="trip_type">${TRIP_TYPES.map((type) => `<option ${type === item.trip_type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
          <label class="ft-field"><span>出發日期與時間</span><input name="start_date" type="datetime-local" required value="${sanitize(item.start_date)}"></label>
          <label class="ft-field"><span>乘客人數</span><input name="passenger_count" type="number" min="1" required value="${Number(item.passenger_count) || 1}"></label>
          <label class="ft-field"><span>上車地點</span><input name="pickup_location" required value="${sanitize(item.pickup_location)}"></label>
          <label class="ft-field full"><span>目的地 / 想走路線</span><input name="destination" required value="${sanitize(item.destination)}"></label>
          <div class="ft-field full" id="ft-edit-vehicles"><span>偏好車型</span></div>
          <label class="ft-field full"><span>特殊需求</span><textarea name="special_requests">${sanitize(item.special_requests)}</textarea></label>
        </div>
        <p class="form-message" id="ft-inquiry-edit-message"></p>
        <button class="primary-button full" type="submit">儲存變更</button>
      </form>
    `;

    $("#ft-edit-vehicles", modal).appendChild(vehicleCheckboxes(item.preferred_vehicle || []));
    modal.classList.remove("hidden");
    $$("[data-editor-close]", modal).forEach((node) => node.addEventListener("click", () => modal.classList.add("hidden")));
    $("#ft-inquiry-edit-form", modal).addEventListener("submit", saveInquiryEdit);
  }

  async function saveInquiryEdit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("#ft-inquiry-edit-message");
    const data = new FormData(form);
    const payload = {
      id: sanitize(data.get("id")),
      name: sanitize(data.get("name")),
      phone: sanitize(data.get("phone")),
      line_id: sanitize(data.get("line_id")),
      status: sanitize(data.get("status")),
      trip_type: sanitize(data.get("trip_type")),
      start_date: sanitize(data.get("start_date")),
      passenger_count: Number(data.get("passenger_count")),
      pickup_location: sanitize(data.get("pickup_location")),
      destination: sanitize(data.get("destination")),
      preferred_vehicle: data.getAll("preferred_vehicle").map(sanitize),
      special_requests: sanitize(data.get("special_requests")),
    };

    message.textContent = "儲存中...";

    try {
      await apiRequest({
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      $("#ft-inquiry-editor").classList.add("hidden");
      await refreshAdminPanel();
    } catch (error) {
      message.textContent = error.message || "更新失敗，請稍後再試。";
    }
  }

  function hookInquiryButtons() {
    const candidates = [".top-inquiry", ".entry-actions .primary-button", "#contact-view .primary-button"];
    candidates.forEach((selector) => {
      $$(selector).forEach((button) => {
        if (button.dataset.inquiryHooked === "1") return;
        button.dataset.inquiryHooked = "1";
        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            openInquiryModal();
          },
          true,
        );
      });
    });
  }

  function boot() {
    ensureInquiryModal();
    hookInquiryButtons();
    enhanceAdmin();
    window.addEventListener("hashchange", () => setTimeout(enhanceAdmin, 120));
    const observer = new MutationObserver(() => {
      hookInquiryButtons();
      enhanceAdmin();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.FuyunInquiryOfficial = { refreshAdminPanel, openInquiryModal };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
