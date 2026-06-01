const STORE = {
  users: "travel-commerce-users-v1",
  tours: "travel-commerce-tours-v1",
  orders: "travel-commerce-orders-v1",
  reviews: "travel-commerce-reviews-v1",
  notifications: "travel-commerce-notifications-v1",
  pushSubscriptions: "travel-commerce-push-subscriptions-v1",
  pushPromptDismissed: "travel-commerce-push-dismissed-v1",
  read: "travel-commerce-read-v1",
  session: "travel-commerce-session-v1",
};

const OWNER_ACCOUNT = { id: "u-owner", name: "最高權限管理員", username: "arashiyun6866", password: "y12345678", role: "admin" };

// Demo VAPID public key. In production this comes from the backend and pairs
// with the private VAPID key used by web-push on the server.
const DEMO_VAPID_PUBLIC_KEY = "BEl6jNqXgkqv2fP9U_KQ8P_c9Gw6r4v2GzvKh3yM5LqJm-Push-Demo-Key-Replace-In-Prod";

const roles = {
  customer: "顧客會員",
  admin: "最高管理員",
  editor: "一般員工",
};

const permissions = {
  customer: { checkout: true, review: true },
  admin: { manageTours: true, deleteTours: true, manageUsers: true, reports: true, marketing: true, orders: true },
  editor: { manageTours: true, deleteTours: false, manageUsers: false, reports: false, marketing: false, orders: false },
};

const options = {
  themes: ["國內旅遊", "國外旅遊", "大陸港澳", "特色主題"],
  regions: ["日本", "韓國", "歐洲", "台灣本島", "離島", "港澳"],
  durations: ["1-3天", "4-7天", "8天以上"],
};

const labels = { themes: "旅遊主題", regions: "旅遊地區", durations: "行程天數" };

const seed = {
  users: [
    { id: "u-admin", name: "平台管理員", username: "admin", password: "admin", role: "admin" },
    { id: "u-editor", name: "行程編輯", username: "editor", password: "editor123", role: "editor" },
    { id: "u-customer", name: "王小旅", username: "customer", password: "customer123", role: "customer" },
  ],
  tours: [
    {
      id: "t-japan",
      title: "日本關西京都大阪賞櫻五日",
      imageUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
      price: 39900,
      capacity: 24,
      remaining: 16,
      departureDates: ["2026-06-12", "2026-07-08"],
      badges: ["最夯", "精選"],
      themes: ["國外旅遊", "特色主題"],
      regions: ["日本"],
      duration: "4-7天",
      summary: "古都散策、環球影城、溫泉飯店與季節料理一次收藏。",
    },
    {
      id: "t-korea",
      title: "韓國首爾美食購物四日",
      imageUrl: "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1200&q=80",
      price: 26800,
      capacity: 30,
      remaining: 22,
      departureDates: ["2026-06-05", "2026-07-21"],
      badges: ["熱賣"],
      themes: ["國外旅遊"],
      regions: ["韓國"],
      duration: "4-7天",
      summary: "明洞、弘大、景福宮與在地餐桌，適合第一次首爾旅行。",
    },
    {
      id: "t-europe",
      title: "義大利經典藝術漫遊十日",
      imageUrl: "https://images.unsplash.com/photo-1529154036614-a60975f5c760?auto=format&fit=crop&w=1200&q=80",
      price: 119900,
      capacity: 18,
      remaining: 9,
      departureDates: ["2026-09-10", "2026-10-15"],
      badges: ["精選"],
      themes: ["國外旅遊", "特色主題"],
      regions: ["歐洲"],
      duration: "8天以上",
      summary: "羅馬、佛羅倫斯、威尼斯，以美術館與城市散步串起十日旅程。",
    },
    {
      id: "t-penghu",
      title: "澎湖花火節跳島三日",
      imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      price: 12800,
      capacity: 28,
      remaining: 11,
      departureDates: ["2026-06-14", "2026-07-12"],
      badges: ["國旅推薦"],
      themes: ["國內旅遊", "特色主題"],
      regions: ["離島"],
      duration: "1-3天",
      summary: "白沙海岸、跳島巡航與花火節觀賞席，夏季限定。",
    },
  ],
  orders: [
    { id: "o-paid", userId: "u-customer", tourId: "t-japan", travelerName: "王小旅", people: 2, amount: 79800, status: "completed", paidAt: "2026-05-01", createdAt: "2026-04-20" },
    { id: "o-unpaid", userId: "u-customer", tourId: "t-korea", travelerName: "王小旅", people: 1, amount: 26800, status: "unpaid", paidAt: "", createdAt: "2026-05-19" },
  ],
  reviews: [
    { id: "r-1", userId: "u-customer", tourId: "t-japan", reviewerName: "王小旅", rating: 5, comment: "飯店和導遊都很細心，京都自由時間安排得剛好。", createdAt: "2026-05-10" },
  ],
  notifications: [
    { id: "n-1", title: "早鳥優惠開跑", body: "日本關西賞櫻團第二人折 2,000 元。", tourId: "t-japan", createdAt: "2026-05-18" },
  ],
};

let state = {
  users: load("users", seed.users),
  tours: load("tours", seed.tours),
  orders: load("orders", seed.orders),
  reviews: load("reviews", seed.reviews),
  notifications: load("notifications", seed.notifications),
  pushSubscriptions: load("pushSubscriptions", []),
  read: load("read", []),
  user: null,
  serviceWorkerRegistration: null,
  filters: { themes: new Set(), regions: new Set(), durations: new Set(), q: "" },
};
function ensureSystemUser(account) {
  const existing = state.users.find((user) => user.username === account.username || user.id === account.id);
  if (existing) {
    Object.assign(existing, account);
    return;
  }
  state.users.unshift({ ...account });
}

ensureSystemUser({ id: "u-admin", name: "平台管理員", username: "admin", password: "admin", role: "admin" });
ensureSystemUser(OWNER_ACCOUNT);
ensureSystemUser({ id: "u-editor", name: "行程編輯", username: "editor", password: "editor123", role: "editor" });
ensureSystemUser({ id: "u-customer", name: "王小旅", username: "customer", password: "customer123", role: "customer" });
save("users");
state.user = state.users.find((u) => u.id === sessionStorage.getItem(STORE.session)) || null;
syncMemberNotificationConsents();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const views = {
  home: $("#home-view"),
  services: $("#services-view"),
  fleet: $("#fleet-view"),
  itineraries: $("#itineraries-view"),
  contact: $("#contact-view"),
  tour: $("#tour-view"),
  checkout: $("#checkout-view"),
  login: $("#login-view"),
  member: $("#member-view"),
  admin: $("#admin-view"),
  preview: $("#preview-view"),
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(STORE[key]);
    return raw ? JSON.parse(raw) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function save(key) {
  localStorage.setItem(STORE[key], JSON.stringify(state[key]));
}

function ensureMemberNotificationConsent(user) {
  if (!user || user.role !== "customer") return;
  const exists = state.pushSubscriptions.some((subscription) => subscription.ownerId === user.id);
  if (exists) return;
  state.pushSubscriptions.unshift({
    id: `member-consent-${user.id}`,
    ownerId: user.id,
    ownerName: user.name,
    role: user.role,
    endpoint: `member-consent://${user.id}`,
    subscription: { memberMarketingConsent: true, systemNotification: false },
    createdAt: today(),
  });
  save("pushSubscriptions");
}

function syncMemberNotificationConsents() {
  state.users.filter((user) => user.role === "customer").forEach(ensureMemberNotificationConsent);
}

function base64UrlToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function money(value) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentPerm() {
  return state.user ? permissions[state.user.role] : {};
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function setSession(user) {
  state.user = user;
  ensureMemberNotificationConsent(user);
  if (user) sessionStorage.setItem(STORE.session, user.id);
  else sessionStorage.removeItem(STORE.session);
  renderShell();
  maybeShowPushPrompt();
}

function parseRoute() {
  const raw = location.hash || "#home";
  const [name, id] = raw.slice(1).split(":");
  return { name: name || "home", id };
}

function go(route) {
  if ((location.hash || "#home") === route) {
    renderRoute();
    return;
  }
  location.hash = route;
}

function renderShell() {
  $("#auth-chip").textContent = state.user ? state.user.name : "訪客";
  $("#auth-action").textContent = state.user ? "登出" : "登入";
  renderNotificationDot();
  $$("[data-route]").forEach((button) => button.classList.toggle("active", button.dataset.route === `#${parseRoute().name}`));
  maybeShowPushPrompt();
}

function guard(route) {
  if (["checkout", "member"].includes(route.name) && !state.user) return "login";
  if (route.name === "member" && state.user?.role !== "customer") return "home";
  if (route.name === "admin" && !["admin", "editor"].includes(state.user?.role)) return "login";
  return route.name;
}

function renderRoute() {
  const route = parseRoute();
  const allowed = guard(route);
  if (allowed !== route.name) {
    go(`#${allowed}`);
    return;
  }
  Object.values(views).forEach((view) => view.classList.remove("active"));
  views[allowed]?.classList.add("active");
  renderShell();
  if (allowed === "itineraries") renderHome();
  if (allowed === "services") renderServices();
  if (allowed === "fleet") renderFleet();
  if (allowed === "contact") renderContact();
  if (allowed === "tour") renderTourDetail(route.id);
  if (allowed === "checkout") renderCheckout(route.id);
  if (allowed === "member") renderMember();
  if (allowed === "admin") renderAdmin();
  if (allowed === "preview") renderPreview();
}

function checkbox(group, value, checked) {
  const label = el("label", "tag-checkbox");
  const input = el("input");
  input.type = "checkbox";
  input.value = value;
  input.checked = checked;
  input.addEventListener("change", () => {
    input.checked ? state.filters[group].add(value) : state.filters[group].delete(value);
    renderHome();
  });
  label.append(input, el("span", "", value));
  return label;
}

function renderFilters() {
  const box = $("#filter-groups");
  box.replaceChildren();
  Object.entries(options).forEach(([group, values]) => {
    const wrap = el("section", "filter-group");
    wrap.appendChild(el("div", "filter-group-title", labels[group]));
    const list = el("div", "tag-list");
    values.forEach((value) => list.appendChild(checkbox(group, value, state.filters[group].has(value))));
    wrap.appendChild(list);
    box.appendChild(wrap);
  });
}

function averageRating(tourId) {
  const reviews = state.reviews.filter((review) => review.tourId === tourId);
  if (!reviews.length) return "尚無評價";
  const avg = reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length;
  return `${avg.toFixed(1)}★`;
}

function filteredTours() {
  const query = state.filters.q.trim().toLowerCase();
  return state.tours.filter((tour) => {
    const textMatch = !query || [tour.title, tour.summary, ...tour.regions, ...tour.themes].join(" ").toLowerCase().includes(query);
    const groupMatch = [
      ["themes", tour.themes],
      ["regions", tour.regions],
      ["durations", [tour.duration]],
    ].every(([group, values]) => state.filters[group].size === 0 || values.some((value) => state.filters[group].has(value)));
    return textMatch && groupMatch;
  });
}

function tourCard(tour) {
  const card = el("article", "tour-card");
  const imgWrap = el("div", "tour-image");
  const img = el("img");
  img.src = safeUrl(tour.imageUrl) || seed.tours[0].imageUrl;
  img.alt = tour.title;
  img.loading = "lazy";
  const badges = el("div", "badge-row");
  tour.badges.forEach((badge) => badges.appendChild(el("span", "badge", badge)));
  imgWrap.append(img, badges);
  const body = el("div", "tour-content");
  body.append(
    el("h3", "tour-title", tour.title),
    el("div", "tour-meta", `${tour.duration} / ${tour.regions.join("、")} / ${averageRating(tour.id)}`),
    el("p", "muted", tour.summary),
  );
  const footer = el("div", "card-footer");
  footer.append(el("div", "price", money(tour.price)));
  const stock = el("div", "stock", `剩餘 ${tour.remaining} 席`);
  const detail = el("button", "detail-button", "查看 / 預訂");
  detail.type = "button";
  detail.addEventListener("click", () => go(`#tour:${tour.id}`));
  footer.append(stock, detail);
  body.appendChild(footer);
  card.append(imgWrap, body);
  return card;
}

function renderHome() {
  renderFilters();
  const tours = filteredTours();
  $("#result-count").textContent = `共 ${tours.length} 筆符合行程`;
  $("#tour-grid").replaceChildren(...tours.map(tourCard));
  $("#empty-state").classList.toggle("hidden", tours.length > 0);
}

function renderServices() {
  const page = el("div", "admin-stack");
  const heading = el("section", "card");
  heading.append(el("p", "eyebrow", "SERVICES"), el("h2", "", "服務"), el("p", "muted", "包車旅遊、機場接送、企業接待與客製化行程安排。"));
  const grid = el("div", "info-grid");
  [
    ["台灣包車旅遊", "專業司機與彈性路線，適合家庭、朋友與小團體。"],
    ["企業接待", "會議、考察、貴賓接送與多點移動安排。"],
    ["機場接送", "桃園、松山、高雄等機場接送與大型行李協調。"],
    ["客製行程", "依照人數、預算、天數安排專屬旅遊方案。"],
  ].forEach(([title, text]) => {
    const card = el("article", "card info-card");
    card.append(el("h3", "", title), el("p", "muted", text));
    grid.appendChild(card);
  });
  page.append(heading, grid);
  views.services.replaceChildren(page);
}

function renderFleet() {
  const page = el("div", "admin-stack");
  const heading = el("section", "card");
  heading.append(el("p", "eyebrow", "FLEET"), el("h2", "", "車型"), el("p", "muted", "依人數與行李量安排大型遊覽車、中巴、商務車。"));
  const grid = el("div", "info-grid");
  [
    ["大型遊覽車", "適合大型團體、公司旅遊、進香與長途行程。"],
    ["中巴", "適合 15-25 人團體，機動性高。"],
    ["商務車", "適合小團、貴賓接待與機場接送。"],
  ].forEach(([title, text]) => {
    const card = el("article", "card info-card");
    card.append(el("h3", "", title), el("p", "muted", text));
    grid.appendChild(card);
  });
  page.append(heading, grid);
  views.fleet.replaceChildren(page);
}

function renderContact() {
  const page = el("div", "detail-layout");
  const main = el("section", "card");
  main.append(
    el("p", "eyebrow", "CONTACT"),
    el("h2", "", "聯絡與會員服務"),
    el("p", "muted", "可透過會員註冊/登入進行行程詢價、訂單查詢與新品通知接收。"),
  );
  const actions = el("div", "action-row");
  [
    ["登入/註冊", () => go("#login"), "primary-button"],
    ["會員中心", () => go("#member"), "secondary-button"],
    ["管理後台", () => go("#admin"), "secondary-button"],
  ].forEach(([text, handler, className]) => {
    const button = el("button", className, text);
    button.type = "button";
    button.addEventListener("click", handler);
    actions.appendChild(button);
  });
  main.appendChild(actions);

  const side = el("aside", "card");
  side.append(
    el("h3", "", "雲驛旅行社有限公司"),
    el("p", "muted", "品保會員-甲種旅行社 / 註冊編號 882200"),
    el("p", "", "電話：02-2685-1666"),
    el("p", "", "Email：yunyi6866@gmail.com"),
    el("p", "", "地址：新北市板橋區大觀路三段160巷20號6樓"),
    el("p", "", "傳真：02-2685-1528"),
    el("p", "", "聯絡人：蔡宛融"),
    el("p", "muted", "統一編號：60675708 / 品保協會會員編號：北2760"),
    el("p", "muted", "履約保證保險：旺旺友聯產物 15,000,000"),
  );
  const fb = el("a", "secondary-button link-button", "Facebook");
  fb.href = "https://www.facebook.com/share/g/1NPbXN8THD/";
  fb.target = "_blank";
  fb.rel = "noreferrer";
  side.appendChild(fb);
  page.append(main, side);
  views.contact.replaceChildren(page);
}

function renderTourDetail(id) {
  const tour = state.tours.find((item) => item.id === id);
  if (!tour) {
    views.tour.replaceChildren(el("div", "empty-state", "找不到此行程"));
    return;
  }
  const reviews = state.reviews.filter((review) => review.tourId === id);
  const page = el("div", "detail-layout");
  const main = el("section", "card");
  const img = el("img", "hero-photo");
  img.src = tour.imageUrl;
  img.alt = tour.title;
  main.append(img, el("p", "eyebrow", tour.regions.join("、")), el("h2", "", tour.title), el("p", "muted", tour.summary));
  main.append(el("div", "tour-meta", `${tour.duration} / ${tour.themes.join("、")} / 出發 ${tour.departureDates.join("、")}`));
  main.append(el("h3", "", `平均星等 ${averageRating(tour.id)}`));
  const list = el("div", "review-list");
  if (!reviews.length) list.appendChild(el("div", "empty-state", "目前尚無評論"));
  reviews.forEach((review) => {
    const item = el("div", "review-item");
    item.append(el("strong", "", `${review.rating}★ ${review.reviewerName}`), el("p", "muted", review.comment), el("small", "", review.createdAt));
    list.appendChild(item);
  });
  main.appendChild(list);

  const side = el("aside", "card");
  side.append(el("p", "eyebrow", "Checkout"), el("h3", "", "立即預訂"), el("div", "price", money(tour.price)), el("p", "stock", `剩餘名額 ${tour.remaining} / ${tour.capacity}`));
  const actionRow = el("div", "action-row");
  const memberButton = el("button", "secondary-button", state.user?.role === "customer" ? "會員中心" : "會員登入/註冊");
  memberButton.type = "button";
  memberButton.addEventListener("click", () => {
    if (state.user?.role === "customer") go("#member");
    else go("#login");
  });
  const button = el("button", "primary-button", "立即預訂");
  button.disabled = tour.remaining <= 0;
  button.addEventListener("click", () => state.user ? go(`#checkout:${tour.id}`) : go("#login"));
  actionRow.append(memberButton, button);
  side.appendChild(actionRow);
  page.append(main, side);
  views.tour.replaceChildren(page);
}

function createBusSeats() {
  const seats = [];
  for (let row = 1; row <= 10; row += 1) {
    seats.push({ id: "L" + row + "W", row, label: "左 " + row + " 窗", gridColumn: 1 });
    seats.push({ id: "L" + row + "A", row, label: "左 " + row + " 走道", gridColumn: 2 });
    if (row >= 2) {
      seats.push({ id: "R" + row + "A", row, label: "右 " + row + " 走道", gridColumn: 4 });
      seats.push({ id: "R" + row + "W", row, label: "右 " + row + " 窗", gridColumn: 5 });
    }
  }
  ["A", "B", "C", "D", "E"].forEach((position, index) => {
    seats.push({ id: "B11" + position, row: 11, label: "第 11 排 " + position, gridColumn: index + 1 });
  });
  return seats;
}

function occupiedSeats(tourId) {
  return new Set(
    state.orders
      .filter((order) => order.tourId === tourId && ["paid", "completed"].includes(order.status))
      .flatMap((order) => order.seatIds || []),
  );
}

function renderCheckout(id) {
  const tour = state.tours.find((item) => item.id === id);
  if (!tour) return views.checkout.replaceChildren(el("div", "empty-state", "找不到此行程"));

  const page = el("div", "checkout-layout checkout-with-seats");
  const form = el("form", "card");
  const selectedSeats = [];
  const seats = createBusSeats();
  const canBook = state.user?.role === "customer";

  form.append(
    el("p", "eyebrow", canBook ? "Payment Sandbox" : "Seat Preview"),
    el("h2", "", canBook ? "預訂與付款" : "座位表檢視"),
  );
  if (!canBook) {
    form.appendChild(el("p", "muted", "目前為後台檢視模式，可查看座位配置、已預訂狀態，也可點選座位預覽；不會建立訂單或扣除名額。"));
  }

  const travelerLabel = el("label", "", "旅客姓名");
  const travelerInput = el("input");
  travelerInput.name = "travelerName";
  travelerInput.value = state.user.name;
  travelerInput.required = true;
  travelerInput.maxLength = 40;
  travelerLabel.appendChild(travelerInput);

  const dateLabel = el("label", "", "出發日期");
  const dateSelect = el("select");
  dateSelect.name = "departureDate";
  (tour.departureDates || [today()]).forEach((date) => {
    const option = el("option", "", date);
    option.value = date;
    dateSelect.appendChild(option);
  });
  dateLabel.appendChild(dateSelect);

  const peopleLabel = el("label", "", "人數");
  const peopleInput = el("input");
  peopleInput.name = "people";
  peopleInput.type = "number";
  peopleInput.min = "1";
  peopleInput.max = String(Math.min(4, Math.max(1, tour.remaining)));
  peopleInput.value = "1";
  peopleInput.required = true;
  peopleLabel.appendChild(peopleInput);

  const cardLabel = el("label", "", "模擬信用卡");
  const cardInput = el("input");
  cardInput.name = "card";
  cardInput.inputMode = "numeric";
  cardInput.value = "4242 4242 4242 4242";
  cardInput.required = true;
  cardLabel.appendChild(cardInput);

  const msg = el("p", "form-message");
  const seatLayer = el("section", "seat-layer bus-seat-layer");
  const seatHeader = el("div", "seat-layer-header");
  const seatTitle = el("div");
  seatTitle.append(el("h3", "", "遊覽車座位表"), el("p", "muted", "43 人座，請點選淺藍色座位進行報名。"));
  const legend = el("div", "bus-seat-legend");
  [["可選", "available"], ["已選", "selected"], ["已預訂", "occupied"]].forEach(([text, cls]) => {
    legend.appendChild(el("span", "seat-state " + cls, text));
  });
  seatHeader.append(seatTitle, legend);

  const busFront = el("div", "bus-front", "車頭（司機座）");
  const busColumns = el("div", "bus-columns");
  ["左窗", "左走道", "走道", "右走道", "右窗"].forEach((text) => busColumns.appendChild(el("span", "", text)));
  const seatMap = el("div", "bus-seat-map");
  const selectedBox = el("div", "seat-selected-box");
  selectedBox.append(el("p", "", "已選座位"));
  const selectedText = el("strong", "", "尚未選擇");
  const selectedInput = el("input");
  selectedInput.type = "hidden";
  selectedInput.name = "selected_seats";
  selectedBox.append(selectedText, selectedInput);

  const bookedSeats = () => occupiedSeats(tour.id);
  const getSeatLabel = (seatId) => seats.find((seat) => seat.id === seatId)?.label || seatId;
  const updateSelectedSeats = () => {
    selectedText.textContent = selectedSeats.length ? selectedSeats.map(getSeatLabel).join("、") : "尚未選擇";
    selectedInput.value = JSON.stringify(selectedSeats);
  };
  const getSeatClass = (isBooked, isSelected) => {
    if (isBooked) return "seat-button occupied";
    if (isSelected) return "seat-button selected";
    return "seat-button available";
  };
  const toggleSeat = (seatId) => {
    const index = selectedSeats.indexOf(seatId);
    const maxSeats = Number(peopleInput.value || 1);
    if (index >= 0) selectedSeats.splice(index, 1);
    else if (selectedSeats.length >= maxSeats) msg.textContent = "最多只能選擇 " + maxSeats + " 個座位。";
    else selectedSeats.push(seatId);
    renderSeatMap();
    updateSelectedSeats();
  };
  const renderSeatMap = () => {
    const booked = bookedSeats();
    seatMap.replaceChildren();
    for (let row = 1; row <= 11; row += 1) {
      seats.filter((seat) => seat.row === row).forEach((seat) => {
        const button = el("button", getSeatClass(booked.has(seat.id), selectedSeats.includes(seat.id)), seat.label);
        button.type = "button";
        button.dataset.seat = seat.id;
        button.style.gridColumn = seat.gridColumn;
        button.disabled = booked.has(seat.id);
        if (!booked.has(seat.id)) button.addEventListener("click", () => toggleSeat(seat.id));
        seatMap.appendChild(button);
      });
      if (row <= 10) {
        const aisle = el("div", "bus-aisle");
        aisle.style.gridColumn = 3;
        seatMap.appendChild(aisle);
      }
      if (row === 1) {
        [4, 5].forEach((column) => {
          const frontSpace = el("div", "bus-front-space");
          frontSpace.style.gridColumn = column;
          seatMap.appendChild(frontSpace);
        });
      }
    }
  };

  peopleInput.addEventListener("input", () => {
    const maxSeats = Number(peopleInput.value || 1);
    selectedSeats.splice(maxSeats);
    renderSeatMap();
    updateSelectedSeats();
  });

  seatLayer.append(seatHeader, busFront, busColumns, seatMap, selectedBox);
  form.append(travelerLabel, dateLabel, peopleLabel, cardLabel, seatLayer);

  const pay = el("button", "primary-button", "模擬付款並完成訂位");
  pay.type = "submit";
  if (!canBook) {
    pay.textContent = "後台檢視模式，不建立訂單";
    pay.disabled = true;
  }
  form.append(pay, msg);
  renderSeatMap();
  updateSelectedSeats();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const people = Number(data.get("people"));
    if (people > tour.remaining) {
      msg.textContent = "剩餘名額不足。";
      return;
    }
    if (selectedSeats.length !== people) {
      msg.textContent = "請選擇 " + people + " 個座位後再付款。";
      return;
    }
    const latestOccupied = occupiedSeats(tour.id);
    if (selectedSeats.some((seat) => latestOccupied.has(seat))) {
      msg.textContent = "座位已被其他訂單占用，請重新選擇。";
      renderSeatMap();
      return;
    }
    const order = {
      id: "o-" + Date.now(),
      userId: state.user.id,
      tourId: tour.id,
      travelerName: String(data.get("travelerName")).trim(),
      people,
      seatIds: [...selectedSeats],
      departureDate: String(data.get("departureDate")),
      amount: tour.price * people,
      status: "paid",
      paidAt: today(),
      createdAt: today(),
    };
    state.orders.unshift(order);
    tour.remaining -= people;
    save("orders");
    save("tours");
    toast("付款成功，座位已完成保留。︀");
    go("#member");
  });

  const summary = el("aside", "card");
  summary.append(
    el("h3", "", tour.title),
    el("p", "muted", tour.summary),
    el("div", "price", money(tour.price)),
    el("p", "stock", "剩餘 " + tour.remaining + " 席"),
    el("p", "muted", canBook ? "付款成功後，座位會寫入訂單並同步扣除剩餘名額。" : "可由此確認座位系統與已預訂座位；會員身分才可完成付款訂位。"),
  );
  page.append(form, summary);
  views.checkout.replaceChildren(page);
}

function renderMember() {
  const userOrders = state.orders.filter((order) => order.userId === state.user.id);
  const page = el("div", "member-grid");
  const orders = el("section", "card");
  orders.append(el("p", "eyebrow", "Member"), el("h2", "", "我的訂單"));
  const list = el("div", "order-list");
  userOrders.forEach((order) => {
    const tour = state.tours.find((item) => item.id === order.tourId);
    const item = el("div", "order-item");
    item.append(el("strong", "", tour?.title || "已下架行程"), el("p", "muted", `${order.people} 人 / ${money(order.amount)} / ${statusText(order.status)}`));
    if (order.seatIds?.length) {
      item.appendChild(el("p", "seat-selected", `出發 ${order.departureDate || "未指定"} / 座位 ${order.seatIds.join("、")}`));
    }
    if (order.status === "completed" && !state.reviews.some((review) => review.userId === state.user.id && review.tourId === order.tourId)) {
      const reviewForm = el("form", "");
      reviewForm.innerHTML = `
        <label>星等 <select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>
        <label>心得 <textarea name="comment" placeholder="分享你的旅行心得" required></textarea></label>
      `;
      const submit = el("button", "secondary-button", "送出評價");
      reviewForm.appendChild(submit);
      reviewForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(reviewForm);
        state.reviews.unshift({ id: `r-${Date.now()}`, userId: state.user.id, tourId: order.tourId, reviewerName: state.user.name, rating: Number(data.get("rating")), comment: String(data.get("comment")).trim(), createdAt: today() });
        save("reviews");
        toast("評價已送出。");
        renderMember();
      });
      item.appendChild(reviewForm);
    }
    list.appendChild(item);
  });
  if (!userOrders.length) list.appendChild(el("div", "empty-state", "尚無訂單"));
  orders.appendChild(list);

  const notices = el("aside", "card");
  notices.append(el("p", "eyebrow", "Notifications"), el("h3", "", "我的通知"));
  const nlist = el("div", "notification-list");
  state.notifications.forEach((notice) => nlist.appendChild(notificationItem(notice)));
  notices.appendChild(nlist);
  page.append(orders, notices);
  views.member.replaceChildren(page);
}

function statusText(status) {
  return { unpaid: "未付款", paid: "已付款", completed: "已完成" }[status] || status;
}

function renderAdmin() {
  const perm = currentPerm();
  const revenue = state.orders.filter((o) => ["paid", "completed"].includes(o.status)).reduce((sum, order) => sum + order.amount, 0);
  const memberCount = state.users.filter((u) => u.role === "customer").length;
  const subscriberCount = state.pushSubscriptions.length;
  const page = el("div", "admin-stack");
  const metrics = el("section", "metric-grid");
  [
    ["總營收", perm.reports ? money(revenue) : "無權限"],
    ["訂單數", perm.orders ? String(state.orders.length) : "無權限"],
    ["會員人數", perm.manageUsers ? String(memberCount) : "無權限"],
    ["會員通知對象", perm.marketing ? String(subscriberCount) : "無權限"],
  ].forEach(([label, value]) => {
    const box = el("div", "metric");
    box.append(el("span", "stat-sub", label), el("strong", "", value));
    metrics.appendChild(box);
  });
  page.appendChild(metrics);

  const grid = el("div", "admin-grid");
  grid.append(renderTourAdmin(), renderOrderAdmin());
  page.appendChild(grid);
  if (perm.manageUsers || perm.marketing) {
    const lower = el("div", "admin-grid");
    if (perm.manageUsers) lower.appendChild(renderUserAdmin());
    if (perm.marketing) lower.appendChild(renderMarketingAdmin());
    page.appendChild(lower);
  }
  views.admin.replaceChildren(page);
}

function renderPreview() {
  const page = el("div", "admin-stack");
  const heading = el("section", "card");
  heading.append(
    el("p", "eyebrow", "Preview Mode"),
    el("h2", "", "功能預覽入口"),
    el("p", "muted", "這裡是本地試用版的快速入口。你可以直接切換角色與流程，不會影響正式版。"),
  );
  page.appendChild(heading);

  const grid = el("div", "preview-grid");
  const previewItems = [
    ["前台商城", "查看行程列表、搜尋與多條件即時篩選。", "打開前台", () => go("#home")],
    [
      "會員購買流程",
      "使用測試帳號進入會員中心，可下單、付款、查看訂單。",
      "會員預覽",
      () => {
        const user = state.users.find((item) => item.role === "customer");
        login(user.username, user.password);
      },
    ],
    [
      "後台管理",
      "查看營收、訂單、會員管理、行程管理與推播控制台。",
      "管理預覽",
      () => {
        const user = state.users.find((item) => item.username === "admin");
        login(user.username, user.password);
      },
    ],
    [
      "內容管理",
      "驗證內容維護人員只能新增與編輯行程，不能看金流與推播。",
      "內容預覽",
      () => {
        const user = state.users.find((item) => item.role === "editor");
        login(user.username, user.password);
      },
    ],
    [
      "Web Push 推播",
      "會員預設接收新品通知；可額外開啟手機/瀏覽器系統通知。",
      "查看通知中心",
      () => {
        go("#home");
        setTimeout(renderNotificationPanel, 150);
      },
    ],
  ];

  previewItems.forEach(([title, text, action, handler]) => {
    const card = el("article", "card preview-card");
    card.append(el("h3", "", title), el("p", "muted", text));
    const button = el("button", title === "後台管理" ? "primary-button" : "secondary-button", action);
    button.type = "button";
    button.addEventListener("click", handler);
    card.appendChild(button);
    grid.appendChild(card);
  });

  page.appendChild(grid);
  views.preview.replaceChildren(page);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // The service worker owns background notification click behavior and is the
    // object that would receive Push API events from Google FCM / browser push services.
    state.serviceWorkerRegistration = await navigator.serviceWorker.register("./service-worker.js");
    return state.serviceWorkerRegistration;
  } catch (error) {
    console.warn("Service Worker registration failed", error);
    return null;
  }
}

function canUseSystemNotifications() {
  return "Notification" in window && "serviceWorker" in navigator;
}

function currentSubscriberKey() {
  return state.user ? state.user.id : "guest-browser";
}

function maybeShowPushPrompt() {
  const prompt = $("#push-consent");
  if (!prompt || !canUseSystemNotifications()) return;
  if (!state.user || state.user.role !== "customer") {
    prompt.classList.add("hidden");
    return;
  }
  const dismissed = localStorage.getItem(STORE.pushPromptDismissed) === "1";
  const systemEnabled = state.pushSubscriptions.some((sub) => sub.ownerId === currentSubscriberKey() && sub.subscription?.systemNotification);
  prompt.classList.toggle("hidden", dismissed || systemEnabled || Notification.permission === "denied");
}

async function subscribeWebPush() {
  if (!state.user || state.user.role !== "customer") {
    toast("請先登入或註冊會員，會員會自動接收新品通知。");
    go("#login");
    return;
  }

  if (!canUseSystemNotifications()) {
    toast("此瀏覽器不支援系統通知。");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    localStorage.setItem(STORE.pushPromptDismissed, "1");
    maybeShowPushPrompt();
    toast("尚未允許通知，之後仍可從瀏覽器設定開啟。");
    return;
  }

  const registration = state.serviceWorkerRegistration || (await registerServiceWorker());
  if (!registration) {
    toast("Service Worker 尚未啟用，無法訂閱推播。");
    return;
  }

  let subscription = null;
  if ("PushManager" in window) {
    try {
      // Real Web Push subscription. This object is what a backend stores and
      // later passes to web-push.sendNotification(subscription, payload).
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(DEMO_VAPID_PUBLIC_KEY),
      });
    } catch (error) {
      // The demo VAPID key is intentionally non-production. If subscription is
      // rejected, we still store a mock endpoint so the UI flow remains testable.
      console.warn("PushManager subscription mocked for demo", error);
    }
  }

  const record = {
    id: `system-sub-${Date.now()}`,
    ownerId: currentSubscriberKey(),
    ownerName: state.user?.name || "訪客瀏覽器",
    role: state.user?.role || "guest",
    endpoint: subscription?.endpoint || `mock://local-browser/${Date.now()}`,
    subscription: subscription ? { ...subscription.toJSON(), systemNotification: true } : { mock: true, systemNotification: true },
    createdAt: today(),
  };

  state.pushSubscriptions = state.pushSubscriptions.filter((sub) => sub.ownerId !== record.ownerId);
  state.pushSubscriptions.unshift(record);
  save("pushSubscriptions");
  $("#push-consent").classList.add("hidden");
  toast("已開啟手機/瀏覽器系統通知。");
  showSystemNotification({
    title: "通知訂閱成功",
    body: "你將收到最新行程與優惠提醒。",
    url: "#home",
    icon: "./icon.svg",
  });
}

async function showSystemNotification(payload) {
  if (!canUseSystemNotifications() || Notification.permission !== "granted") {
    toast(payload.title);
    return;
  }
  const registration = state.serviceWorkerRegistration || (await registerServiceWorker());
  if (!registration) return;
  await registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon || "./icon.svg",
    image: payload.image || payload.icon || undefined,
    badge: "./icon.svg",
    data: { url: payload.url || "#home" },
  });
}

function sendPushToAll(payload) {
  // Demo send: persist an in-app notification and trigger a system notification
  // on the current browser if it is subscribed. Production equivalent:
  // await webpush.sendNotification(subscription, JSON.stringify(payload))
  const notice = {
    id: `n-${Date.now()}`,
    title: payload.title,
    body: payload.body,
    tourId: payload.tourId || "",
    url: payload.url || "#home",
    icon: payload.icon || "./icon.svg",
    image: payload.image || "",
    createdAt: today(),
  };
  state.notifications.unshift(notice);
  save("notifications");
  renderNotificationDot();
  const subscribedHere = state.pushSubscriptions.some((sub) => sub.ownerId === currentSubscriberKey());
  if (subscribedHere) showSystemNotification(notice);
  toast(`已發送給 ${state.pushSubscriptions.length} 位會員通知對象。`);
}

function renderTourAdmin() {
  const panel = el("section", "admin-panel");
  panel.append(el("p", "eyebrow", "Tours"), el("h2", "", "行程管理"));
  const form = el("form", "");
  form.className = "form-grid";
  form.innerHTML = `
    <input name="id" type="hidden">
    <label>名稱 <input name="title" required></label>
    <label>圖片網址 <input name="imageUrl" type="url" required></label>
    <label>價格 <input name="price" type="number" min="0" required></label>
    <label>名額 <input name="remaining" type="number" min="0" required></label>
    <label>天數 <select name="duration">${options.durations.map((d) => `<option>${d}</option>`).join("")}</select></label>
    <label>地區 <select name="region">${options.regions.map((r) => `<option>${r}</option>`).join("")}</select></label>
    <label class="full">摘要 <textarea name="summary" required></textarea></label>
    <button class="primary-button full">儲存行程</button>
  `;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = {
      id: data.get("id") || `t-${Date.now()}`,
      title: String(data.get("title")).trim(),
      imageUrl: safeUrl(String(data.get("imageUrl")).trim()) || seed.tours[0].imageUrl,
      price: Number(data.get("price")),
      capacity: Number(data.get("remaining")),
      remaining: Number(data.get("remaining")),
      departureDates: [today()],
      badges: ["新上架"],
      themes: ["特色主題"],
      regions: [data.get("region")],
      duration: data.get("duration"),
      summary: String(data.get("summary")).trim(),
    };
    state.tours = data.get("id") ? state.tours.map((t) => (t.id === payload.id ? { ...t, ...payload } : t)) : [payload, ...state.tours];
    save("tours");
    toast("行程已同步更新到前台。");
    renderAdmin();
    renderHome();
  });
  panel.appendChild(form);
  const table = tableWrap(["行程", "價格", "名額", "操作"]);
  state.tours.forEach((tour) => {
    const tr = el("tr");
    tr.append(el("td", "table-title", tour.title), el("td", "", money(tour.price)), el("td", "", `${tour.remaining}/${tour.capacity}`));
    const action = el("td");
    const edit = el("button", "small-button", "編輯");
    edit.addEventListener("click", () => {
      form.elements.id.value = tour.id;
      form.elements.title.value = tour.title;
      form.elements.imageUrl.value = tour.imageUrl;
      form.elements.price.value = tour.price;
      form.elements.remaining.value = tour.remaining;
      form.elements.duration.value = tour.duration;
      form.elements.region.value = tour.regions[0];
      form.elements.summary.value = tour.summary;
    });
    action.appendChild(edit);
    if (currentPerm().deleteTours) {
      const del = el("button", "danger-button", "刪除");
      del.addEventListener("click", () => {
        state.tours = state.tours.filter((item) => item.id !== tour.id);
        save("tours");
        renderAdmin();
        renderHome();
      });
      action.appendChild(del);
    }
    tr.appendChild(action);
    table.tbody.appendChild(tr);
  });
  panel.appendChild(table.wrap);
  return panel;
}

function renderOrderAdmin() {
  const panel = el("section", "admin-panel");
  panel.append(el("p", "eyebrow", "Orders"), el("h2", "", currentPerm().orders ? "即時訂單與金流" : "訂單與金流"));
  if (!currentPerm().orders) {
    panel.appendChild(el("div", "empty-state", "此帳號無法查看金流報表與所有訂單"));
    return panel;
  }
  const table = tableWrap(["訂單", "會員", "狀態", "座位", "金額"]);
  state.orders.forEach((order) => {
    const tour = state.tours.find((item) => item.id === order.tourId);
    const user = state.users.find((item) => item.id === order.userId);
    const tr = el("tr");
    tr.append(
      el("td", "table-title", tour?.title || "已下架"),
      el("td", "", user?.name || "未知"),
      el("td", "", statusText(order.status)),
      el("td", "", order.seatIds?.length ? order.seatIds.join("、") : "未選位"),
      el("td", "", money(order.amount)),
    );
    table.tbody.appendChild(tr);
  });
  panel.appendChild(table.wrap);
  return panel;
}

function renderUserAdmin() {
  const panel = el("section", "admin-panel");
  panel.append(
    el("p", "eyebrow", "Member Database"),
    el("h2", "", "會員明細資料庫"),
    el("p", "muted", `會員人數 ${state.users.filter((user) => user.role === "customer").length} 人，會員通知對象 ${state.pushSubscriptions.length} 人。會員預設同意接收新品與優惠通知。`),
  );
  const table = tableWrap(["姓名", "帳號", "角色", "通知狀態", "訂單數", "消費總額", "操作"]);
  state.users.forEach((user) => {
    const tr = el("tr");
    const userOrders = state.orders.filter((order) => order.userId === user.id);
    const spent = userOrders.filter((order) => ["paid", "completed"].includes(order.status)).reduce((sum, order) => sum + order.amount, 0);
    const subscribed = user.role === "customer" || state.pushSubscriptions.some((subscription) => subscription.ownerId === user.id);
    tr.append(
      el("td", "", user.name),
      el("td", "", user.username),
      el("td", "", roles[user.role]),
      el("td", "", subscribed ? "會員預設同意" : "不適用"),
      el("td", "", String(userOrders.length)),
      el("td", "", money(spent)),
    );
    const action = el("td");
    if (user.id !== state.user.id) {
      const del = el("button", "danger-button", "刪除");
      del.addEventListener("click", () => {
        state.users = state.users.filter((item) => item.id !== user.id);
        save("users");
        renderAdmin();
      });
      action.appendChild(del);
    }
    tr.appendChild(action);
    table.tbody.appendChild(tr);
  });
  panel.appendChild(table.wrap);
  return panel;
}

function renderMarketingAdmin() {
  const panel = el("section", "admin-panel");
  panel.append(el("p", "eyebrow", "Web Push"), el("h2", "", "系統級推播控制台"));
  panel.appendChild(el("p", "muted", `目前會員通知對象 ${state.pushSubscriptions.length} 筆。會員預設同意接收新品通知；若會員另外開啟系統通知，正式後端會使用 web-push + VAPID 派送到裝置。`));
  const form = el("form", "form-grid");
  form.innerHTML = `
    <label>通知標題 <input name="title" required></label>
    <label>點擊跳轉 URL <input name="url" value="#home" required></label>
    <label>通知圖示 URL <input name="icon" value="./icon.svg"></label>
    <label>關聯行程 <select name="tourId">${state.tours.map((t) => `<option value="${t.id}">${t.title}</option>`).join("")}</select></label>
    <label class="full">內容 <textarea name="body" required></textarea></label>
    <button class="primary-button full">發送給所有會員</button>
  `;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    sendPushToAll({
      title: String(data.get("title")).trim(),
      body: String(data.get("body")).trim(),
      url: String(data.get("url")).trim(),
      icon: String(data.get("icon")).trim(),
      tourId: data.get("tourId"),
    });
    form.reset();
  });
  panel.appendChild(form);
  return panel;
}

function tableWrap(headers) {
  const wrap = el("div", "table-wrap");
  const table = el("table");
  const thead = el("thead");
  const headRow = el("tr");
  headers.forEach((header) => headRow.appendChild(el("th", "", header)));
  thead.appendChild(headRow);
  const tbody = el("tbody");
  table.append(thead, tbody);
  wrap.appendChild(table);
  return { wrap, tbody };
}

function notificationItem(notice) {
  const item = el("button", "notification-item");
  item.type = "button";
  item.append(el("strong", "", notice.title), el("p", "muted", notice.body), el("small", "", notice.createdAt));
  item.addEventListener("click", () => {
    if (state.user && !state.read.includes(notice.id)) {
      state.read.push(notice.id);
      save("read");
    }
    $("#notification-panel").classList.add("hidden");
    if (notice.url) go(notice.url.startsWith("#") ? notice.url : `#${notice.url}`);
    else go(`#tour:${notice.tourId}`);
  });
  return item;
}

function renderNotificationPanel() {
  const panel = $("#notification-panel");
  panel.replaceChildren(el("h3", "", "通知中心"));
  const subscribeButton = el("button", "primary-button", "開啟手機/瀏覽器系統通知");
  subscribeButton.type = "button";
  subscribeButton.addEventListener("click", subscribeWebPush);
  panel.appendChild(subscribeButton);
  panel.appendChild(el("p", "muted", "會員已預設接收新品與優惠通知；此按鈕只是額外開啟手機/瀏覽器系統通知。"));
  const list = el("div", "notification-list");
  state.notifications.forEach((notice) => list.appendChild(notificationItem(notice)));
  panel.appendChild(list);
  panel.classList.toggle("hidden");
  if (state.user) {
    state.read = Array.from(new Set([...state.read, ...state.notifications.map((n) => n.id)]));
    save("read");
    renderNotificationDot();
  }
}

function renderNotificationDot() {
  const unread = state.user && state.notifications.some((notice) => !state.read.includes(notice.id));
  $("#notification-dot").classList.toggle("hidden", !unread);
}

function toast(text) {
  const node = el("div", "toast", text);
  $("#toast-root").appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function login(username, password) {
  if (username === OWNER_ACCOUNT.username && password === OWNER_ACCOUNT.password) {
    ensureSystemUser(OWNER_ACCOUNT);
    save("users");
    const owner = state.users.find((item) => item.username === OWNER_ACCOUNT.username) || OWNER_ACCOUNT;
    setSession(owner);
    go("#admin");
    return true;
  }
  const user = state.users.find((item) => item.username === username && item.password === password);
  if (!user) return false;
  setSession(user);
  if (user.role === "customer") go("#member");
  else go("#admin");
  return true;
}

function bind() {
  window.addEventListener("hashchange", renderRoute);
  $$("[data-route]").forEach((button) => button.addEventListener("click", () => go(button.dataset.route)));
  $("#auth-action").addEventListener("click", () => state.user ? (setSession(null), go("#home")) : go("#login"));
  $("#bell-button").addEventListener("click", renderNotificationPanel);
  $("#home-notification-entry")?.addEventListener("click", renderNotificationPanel);
  $("#push-enable").addEventListener("click", subscribeWebPush);
  $("#push-dismiss").addEventListener("click", () => {
    localStorage.setItem(STORE.pushPromptDismissed, "1");
    maybeShowPushPrompt();
  });
  $("#search-input").addEventListener("input", (event) => {
    state.filters.q = event.target.value;
    renderHome();
  });
  $("#clear-filters").addEventListener("click", () => {
    state.filters = { themes: new Set(), regions: new Set(), durations: new Set(), q: "" };
    $("#search-input").value = "";
    renderHome();
  });
  $("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!login(String(data.get("username")).trim(), data.get("password"))) $("#login-message").textContent = "登入失敗，請確認帳號資訊。";
  });
  $$("[data-demo-login]").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.demoLogin;
      const user = state.users.find((item) => item.role === role);
      login(user.username, user.password);
    });
  });
  $("#register-button")?.addEventListener("click", () => {
    const name = $("#register-name").value.trim();
    const username = $("#register-username").value.trim();
    const password = $("#register-password").value;
    if (!name || !username || password.length < 6) return ($("#login-message").textContent = "請輸入姓名、帳號與至少 6 碼密碼。");
    if (state.users.some((u) => u.username === username)) return ($("#login-message").textContent = "帳號已存在。");
    const user = { id: `u-${Date.now()}`, name, username, password, role: "customer" };
    state.users.push(user);
    save("users");
    setSession(user);
    go("#member");
  });
}

function init() {
  registerServiceWorker();
  renderShell();
  bind();
  renderRoute();
}

init();
