(function () {
  const STORE_INQUIRIES = "fuyun-secure-inquiries-v1";
  const STORE_AUDIT = "fuyun-secure-audit-v1";
  const STATUSES = ["New", "Quoted", "Confirmed", "Cancelled"];
  const VEHICLES = ["43-seat Big Bus", "20-seat Medium Bus", "9-seat Luxury Van"];
  const TRIP_TYPES = ["Single-day Tour", "Multi-day Tour", "Point-to-Point Transfer"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function sanitize(value) {
    return String(value || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
  }

  function maskPhone(phone) {
    const clean = sanitize(phone);
    if (clean.length <= 4) return "****";
    return clean.slice(0, 3) + "****" + clean.slice(-3);
  }

  function currentUserLabel() {
    const sessionId = sessionStorage.getItem("travel-commerce-session-v1") || "guest";
    return sessionId;
  }

  function addAudit(action, inquiryId) {
    const logs = readStore(STORE_AUDIT, []);
    logs.unshift({
      id: "a-" + Date.now(),
      user_id: currentUserLabel(),
      action,
      inquiry_id: inquiryId || "",
      ip: "browser-preview",
      created_at: new Date().toISOString(),
    });
    writeStore(STORE_AUDIT, logs.slice(0, 250));
  }

  function seedInquiries() {
    const existing = readStore(STORE_INQUIRIES, null);
    if (existing) return;
    writeStore(STORE_INQUIRIES, [
      {
        id: "iq-seed-1",
        name: "王小旅",
        phone: "0912345678",
        line_id: "fuyun-test",
        trip_type: "Multi-day Tour",
        start_date: "2026-06-12T09:00",
        pickup_location: "台北車站",
        destination: "宜蘭太平山二日遊",
        passenger_count: 38,
        preferred_vehicle: ["43-seat Big Bus"],
        special_requests: "需要協助安排午餐與住宿，車上希望有麥克風。",
        status: "New",
        created_at: "2026-05-25T10:00:00.000Z",
      },
    ]);
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
            <p class="muted">資料送出後將進入後台詢價管理；正式版會經由 /api/inquiry 寫入資料庫。</p>
          </div>
          <button class="ghost-button" type="button" data-inquiry-close>關閉</button>
        </div>
        <div class="ft-form-grid" id="fuyun-inquiry-fields"></div>
        <p class="ft-security-note">安全預覽：前端驗證、欄位清理、Turnstile/reCAPTCHA token 預留、後台 PII 遮罩與操作紀錄。</p>
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
      status: "New",
      recaptcha_token: "preview-token",
      created_at: new Date().toISOString(),
    };
  }

  function validateInquiry(payload) {
    if (!payload.name || !payload.phone || !payload.start_date) return "請填寫姓名、電話、出發日期。";
    if (!payload.pickup_location || !payload.destination) return "請填寫上車地點與目的地。";
    if (!Number.isInteger(payload.passenger_count) || payload.passenger_count < 1) return "乘客人數需大於 0。";
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

    try {
      await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Preview fallback: static platform keeps the record in localStorage.
    }

    const inquiries = readStore(STORE_INQUIRIES, []);
    inquiries.unshift(payload);
    writeStore(STORE_INQUIRIES, inquiries);
    addAudit("CREATE_INQUIRY", payload.id);
    message.textContent = "詢價已送出，我們會盡快聯繫。";
    form.reset();
    setTimeout(closeInquiryModal, 700);
    enhanceAdmin();
  }

  function inquiryRows(inquiries) {
    return inquiries
      .map(
        (item) => `
          <tr>
            <td class="table-title">${sanitize(item.name)}</td>
            <td>${maskPhone(item.phone)}</td>
            <td>${sanitize(item.start_date || "").replace("T", " ")}</td>
            <td>${sanitize(item.pickup_location)} → ${sanitize(item.destination)}</td>
            <td>${sanitize(item.status)}</td>
            <td><button class="small-button" type="button" data-inquiry-id="${item.id}">查看 / 編輯</button></td>
          </tr>
        `,
      )
      .join("");
  }

  function renderInquiryAdminPanel() {
    const inquiries = readStore(STORE_INQUIRIES, []);
    const audit = readStore(STORE_AUDIT, []);
    const panel = document.createElement("section");
    panel.className = "admin-panel ft-inquiry-admin";
    panel.id = "ft-inquiry-admin";
    panel.innerHTML = `
      <p class="eyebrow">Inquiry CRM</p>
      <h2>客製旅遊與包車詢價管理</h2>
      <p class="muted">後台預覽已套用 PII 遮罩；點「查看 / 編輯」可編輯所有詢價欄位與狀態。</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>姓名</th><th>電話</th><th>日期</th><th>路線</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>${inquiryRows(inquiries)}</tbody>
        </table>
      </div>
      <details class="ft-audit">
        <summary>Audit Trail（${audit.length}）</summary>
        <div class="notification-list">
          ${audit.slice(0, 8).map((log) => `<div class="notification-item"><strong>${log.action}</strong><p class="muted">${log.created_at} / ${log.user_id} / ${log.ip}</p></div>`).join("") || "<p class='muted'>尚無紀錄</p>"}
        </div>
      </details>
    `;
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-inquiry-id]");
      if (button) openInquiryEditor(button.dataset.inquiryId);
    });
    return panel;
  }

  function enhanceAdmin() {
    const adminView = $("#admin-view.active");
    if (!adminView || $("#ft-inquiry-admin", adminView)) return;
    adminView.appendChild(renderInquiryAdminPanel());
  }

  function openInquiryEditor(id) {
    const inquiries = readStore(STORE_INQUIRIES, []);
    const item = inquiries.find((record) => record.id === id);
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
            <h2>詢價內容編輯</h2>
            <p class="muted">管理者可編輯所有對話框欄位；列表預設遮罩，詳情才顯示完整資料。</p>
          </div>
          <button class="ghost-button" type="button" data-editor-close>關閉</button>
        </div>
        <input type="hidden" name="id" value="${item.id}">
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
        <button class="primary-button full" type="submit">儲存修改</button>
      </form>
    `;
    const vehicleHolder = $("#ft-edit-vehicles", modal);
    vehicleHolder.appendChild(vehicleCheckboxes(item.preferred_vehicle || []));
    modal.classList.remove("hidden");
    $$("[data-editor-close]", modal).forEach((node) => node.addEventListener("click", () => modal.classList.add("hidden")));
    $("#ft-inquiry-edit-form", modal).addEventListener("submit", saveInquiryEdit);
    addAudit("READ_INQUIRY", id);
  }

  function saveInquiryEdit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = data.get("id");
    const inquiries = readStore(STORE_INQUIRIES, []);
    const next = inquiries.map((item) =>
      item.id === id
        ? {
            ...item,
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
            updated_at: new Date().toISOString(),
          }
        : item,
    );
    writeStore(STORE_INQUIRIES, next);
    addAudit("UPDATE_INQUIRY", id);
    $("#ft-inquiry-editor").classList.add("hidden");
    $("#ft-inquiry-admin")?.remove();
    enhanceAdmin();
  }

  function hookInquiryButtons() {
    const candidates = [
      ".top-inquiry",
      ".entry-actions .primary-button",
      "#contact-view .primary-button",
    ];
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
    seedInquiries();
    ensureInquiryModal();
    hookInquiryButtons();
    enhanceAdmin();
    window.addEventListener("hashchange", () => setTimeout(enhanceAdmin, 80));
    const observer = new MutationObserver(() => {
      hookInquiryButtons();
      enhanceAdmin();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
