const metricLibrary = {
  play: [
    ["fun", "好不好玩", "会不会一路都有劲儿，不是只靠开头新鲜，后面就开始放空。", true],
    ["together", "两个人能不能一起玩", "是不是能一起参与、一起笑、一起吐槽，而不是一个人在玩另一个人在等。", true],
    ["comfort", "待着舒不舒服", "人挤不挤、吵不吵、脏不脏、有没有让人想快点逃走的地方。", true],
    ["energy", "累不累人", "走路、排队、站着、爬上爬下会不会把约会变成体能考试。", true],
    ["memory", "值不值得记住", "结束后会不会觉得这趟有点特别，以后提起来还能笑一下。", true],
    ["photo", "拍照好不好看", "不用疯狂找角度，也能留下几张看着心情不错的照片。"],
    ["fresh", "新不新鲜", "是不是和平时吃饭逛街不太一样，有一点“这次来对了”的小惊喜。"],
    ["pace", "时间卡不卡", "时长是不是刚好，不赶、不拖，也不会把后面的安排挤爆。"]
  ],
  food: [
    ["taste", "好不好吃", "味道是不是合胃口，吃第一口不会皱眉，吃到后面也不腻。", true],
    ["value", "花得值不值", "价格、分量和味道放在一起想，会不会觉得这钱花得舒服。", true],
    ["chat", "适不适合聊天", "座位、噪音、灯光和氛围能不能让两个人慢慢吃、好好说话。", true],
    ["choice", "选择够不够", "菜单是不是能照顾两个人的口味，不会有人只能将就。", true],
    ["after", "吃完满不满足", "吃完是刚刚好的幸福感，不是没吃饱，也不是撑到想沉默。", true],
    ["fresh", "食材新不新鲜", "入口有没有明显的新鲜感，不会有奇怪异味或敷衍口感。"],
    ["service", "服务顺不顺", "点单、上菜、加水、处理需求是不是自然顺手，不用反复找人。"],
    ["nearby", "吃完还能不能逛", "周边有没有适合散步、买饮料、顺路消食的小地方。"]
  ]
};

const coefficientLibrary = [
  ["travel", "路上折腾", "看真实往返时间和换乘麻烦程度。路很顺可以加分，太绕就扣一点。"],
  ["queue", "排队预约", "看预约难度、现场等待和是否容易扑空。"],
  ["budget", "预算压力", "看人均花费和当天预算是否匹配。"],
  ["weather", "天气影响", "看雨、高温、大风、寒冷等天气会不会明显影响体验。"],
  ["time", "时间窗口", "看营业时间、项目耗时和当天空闲时间是否刚好对上。"],
  ["body", "体力门槛", "看实际步行、站立、爬坡或运动量会不会超出当天状态。"],
  ["couple", "双人友好度", "看商家或项目是否天然适合两个人一起体验。"],
  ["parking", "停车/到达", "开车时看停车难度；不开车时也可用来表示到门口最后一段是否麻烦。"]
];

const storageKey = "dating-event-book-v3";
const roleKey = "dating-event-book-role";
const maxMetrics = 5;
const $ = (id) => document.getElementById(id);

const cloudConfig = {
  url: window.DATE_BOOK_SUPABASE_URL || "",
  key: window.DATE_BOOK_SUPABASE_ANON_KEY || ""
};
const cloudEnabled = Boolean(cloudConfig.url && cloudConfig.key && window.supabase);
const supabaseClient = cloudEnabled ? window.supabase.createClient(cloudConfig.url, cloudConfig.key) : null;

let roomId = getRoomId();
let currentRole = localStorage.getItem(roleKey) || "me";
let state = loadState();
let activeId = state.items[0]?.id ?? null;
let applyingRemote = false;
let saveTimer = null;

const categoryName = (category) => category === "play" ? "玩乐" : "美食";
const metricById = (category, id) => metricLibrary[category].find((metric) => metric[0] === id);

function getRoomId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("room");
  if (fromUrl) return fromUrl;
  const generated = crypto.randomUUID().slice(0, 8);
  params.set("room", generated);
  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, "", nextUrl);
  return generated;
}

function defaultCore(category) {
  return metricLibrary[category].filter((metric) => metric[3]).map((metric) => metric[0]);
}

function defaultScores(metricIds) {
  return Object.fromEntries(metricIds.map((id) => [id, 5]));
}

function defaultCoefficients() {
  return Object.fromEntries(coefficientLibrary.map(([id]) => [id, { enabled: false, value: 1 }]));
}

function createItem(name, category) {
  const metrics = defaultCore(category);
  return {
    id: crypto.randomUUID(),
    name,
    category,
    metrics,
    scores: { me: defaultScores(metrics), you: defaultScores(metrics) },
    coefficients: defaultCoefficients()
  };
}

function createDefaultState() {
  return {
    items: [
      createItem("周末密室", "play"),
      createItem("甜品探店", "food")
    ]
  };
}

function loadState() {
  const saved = localStorage.getItem(`${storageKey}:${roomId}`);
  if (saved) return JSON.parse(saved);
  return createDefaultState();
}

function persistLocal() {
  localStorage.setItem(`${storageKey}:${roomId}`, JSON.stringify(state));
}

function saveState() {
  persistLocal();
  if (!cloudEnabled || applyingRemote) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(syncStateToCloud, 250);
}

async function syncStateToCloud() {
  const { error } = await supabaseClient
    .from("date_rooms")
    .upsert({ id: roomId, data: state, updated_at: new Date().toISOString() });
  if (error) setSyncStatus("云端保存失败，请检查 Supabase 配置。");
  else setSyncStatus("已同步，双方刷新或打分都会看到。");
}

async function initCloud() {
  if (!cloudEnabled) {
    setSyncStatus("本地模式：填好 config.js 后可同步。");
    return;
  }
  setSyncStatus("正在连接共享房间...");
  const { data, error } = await supabaseClient
    .from("date_rooms")
    .select("data")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    setSyncStatus("云端连接失败，请检查数据库表和权限。");
    return;
  }

  if (data?.data) {
    state = data.data;
    activeId = state.items[0]?.id ?? null;
    persistLocal();
    render();
  } else {
    await syncStateToCloud();
  }

  supabaseClient
    .channel(`date-room-${roomId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "date_rooms",
      filter: `id=eq.${roomId}`
    }, (payload) => {
      if (!payload.new?.data) return;
      applyingRemote = true;
      state = payload.new.data;
      activeId = state.items.find((item) => item.id === activeId)?.id ?? state.items[0]?.id ?? null;
      persistLocal();
      render();
      applyingRemote = false;
      setSyncStatus("刚刚收到对方的更新。");
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setSyncStatus("共享房间已连接。");
    });
}

function setSyncStatus(text) {
  const node = $("syncStatus");
  if (node) node.textContent = text;
}

function itemScore(item) {
  const me = item.metrics.reduce((sum, id) => sum + Number(item.scores.me[id] ?? 0), 0);
  const you = item.metrics.reduce((sum, id) => sum + Number(item.scores.you[id] ?? 0), 0);
  const base = me + you;
  const weight = coefficientLibrary.reduce((product, [id]) => {
    const coefficient = item.coefficients[id] ?? { enabled: false, value: 1 };
    return product * (coefficient.enabled ? Number(coefficient.value) : 1);
  }, 1);
  return { me, you, base, weight, final: base * weight };
}

function render() {
  const activeItem = state.items.find((item) => item.id === activeId) ?? state.items[0];
  activeId = activeItem?.id ?? null;
  $("totalItems").textContent = `${state.items.length} 个`;
  $("bestScore").textContent = Math.max(0, ...state.items.map((item) => itemScore(item).final)).toFixed(1);
  renderRoles();
  renderItemGroups();
  renderRanking();
  $("emptyState").classList.toggle("hidden", Boolean(activeItem));
  $("editor").classList.toggle("hidden", !activeItem);
  if (activeItem) renderEditor(activeItem);
}

function renderRoles() {
  document.querySelectorAll("[data-role]").forEach((button) => {
    button.classList.toggle("active", button.dataset.role === currentRole);
  });
}

function renderItemGroups() {
  for (const category of ["play", "food"]) {
    const root = $(`${category}Items`);
    const items = state.items.filter((item) => item.category === category);
    root.innerHTML = items.length ? items.map((item) => `
      <button class="item-card ${item.id === activeId ? "active" : ""}" data-item-id="${item.id}">
        <span>${item.name}</span>
        <strong>${itemScore(item).final.toFixed(1)}</strong>
      </button>
    `).join("") : `<p class="empty-mini">还没放东西</p>`;
  }
}

function renderEditor(item) {
  $("activeCategory").textContent = categoryName(item.category);
  $("activeName").textContent = item.name;
  $("metricCounter").textContent = `${item.metrics.length}/${maxMetrics}`;
  renderMetricPicker(item);
  renderScores(item, "me", $("scoresA"));
  renderScores(item, "you", $("scoresB"));
  renderCoefficients(item);
  const score = itemScore(item);
  $("baseScore").textContent = score.base;
  $("allWeight").textContent = score.weight.toFixed(3);
  $("finalScore").textContent = score.final.toFixed(1);
}

function renderMetricPicker(item) {
  $("metricPicker").innerHTML = metricLibrary[item.category].map(([id, name, desc]) => {
    const checked = item.metrics.includes(id);
    const full = item.metrics.length >= maxMetrics;
    return `
      <button class="choice-card ${checked ? "selected" : ""} ${!checked && full ? "muted-choice" : ""}" data-metric-id="${id}" aria-pressed="${checked}" ${!checked && full ? "disabled" : ""}>
        <i>${checked ? "已选" : "可选"}</i>
        <span><strong>${name}</strong><small>${desc}</small></span>
      </button>
    `;
  }).join("");
}

function renderScores(item, user, root) {
  const locked = currentRole !== user;
  root.innerHTML = item.metrics.map((id) => {
    const [, name, desc] = metricById(item.category, id);
    const value = item.scores[user][id] ?? 0;
    return `
      <article class="score-row ${locked ? "locked-score" : ""}">
        <header><strong>${name}</strong><output>${value}</output></header>
        <p>${desc}</p>
        <div class="slider-line">
          <input type="range" min="0" max="10" step="1" value="${value}" data-score-user="${user}" data-score-id="${id}" ${locked ? "disabled" : ""}>
          <span>${value}/10</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderCoefficients(item) {
  $("coefficients").innerHTML = coefficientLibrary.map(([id, name, desc]) => {
    const coefficient = item.coefficients[id] ?? { enabled: false, value: 1 };
    return `
      <article class="coefficient-row ${coefficient.enabled ? "selected" : ""}">
        <button class="switch-line" data-coefficient-toggle="${id}" aria-pressed="${coefficient.enabled}">
          <i>${coefficient.enabled ? "已打卡" : "打卡"}</i>
          <span><strong>${name}</strong><small>${desc}</small></span>
          <b>${coefficient.enabled ? Number(coefficient.value).toFixed(1) : "不算"}</b>
        </button>
        <div class="coefficient-tools">
          <input type="range" min="0.7" max="1.3" step="0.1" value="${coefficient.value}" data-coefficient-id="${id}" ${coefficient.enabled ? "" : "disabled"}>
        </div>
      </article>
    `;
  }).join("");
}

function renderRanking() {
  const rows = [...state.items].sort((a, b) => itemScore(b).final - itemScore(a).final);
  $("rankingList").innerHTML = rows.length ? rows.map((item, index) => {
    const score = itemScore(item);
    return `
      <article class="rank-row">
        <div>
          <strong>${index + 1}. ${item.name}</strong>
          <p>${categoryName(item.category)} · 原始 ${score.base} · 现实 ${score.weight.toFixed(3)}</p>
        </div>
        <div class="rank-score">${score.final.toFixed(1)}</div>
      </article>
    `;
  }).join("") : `<p class="hint">还没有项目，先放一个进来。</p>`;
}

function updateMetric(item, metricId, checked) {
  if (checked && item.metrics.length < maxMetrics) {
    item.metrics.push(metricId);
    item.scores.me[metricId] ??= 5;
    item.scores.you[metricId] ??= 5;
  }
  if (!checked) item.metrics = item.metrics.filter((id) => id !== metricId);
}

document.addEventListener("input", (event) => {
  const item = state.items.find((entry) => entry.id === activeId);
  if (!item) return;
  if (event.target.matches("[data-score-id]")) {
    if (event.target.dataset.scoreUser !== currentRole) return;
    item.scores[event.target.dataset.scoreUser][event.target.dataset.scoreId] = Number(event.target.value);
  }
  if (event.target.matches("[data-coefficient-id]")) {
    item.coefficients[event.target.dataset.coefficientId].value = Number(event.target.value);
  }
  saveState();
  render();
});

document.addEventListener("click", (event) => {
  const roleButton = event.target.closest("[data-role]");
  if (roleButton) {
    currentRole = roleButton.dataset.role;
    localStorage.setItem(roleKey, currentRole);
    render();
    return;
  }

  const metricButton = event.target.closest("[data-metric-id]");
  if (metricButton) {
    const item = state.items.find((entry) => entry.id === activeId);
    if (!item) return;
    updateMetric(item, metricButton.dataset.metricId, !item.metrics.includes(metricButton.dataset.metricId));
    saveState();
    render();
    return;
  }

  const coefficientButton = event.target.closest("[data-coefficient-toggle]");
  if (coefficientButton) {
    const item = state.items.find((entry) => entry.id === activeId);
    if (!item) return;
    const id = coefficientButton.dataset.coefficientToggle;
    item.coefficients[id].enabled = !item.coefficients[id].enabled;
    saveState();
    render();
    return;
  }

  const itemButton = event.target.closest("[data-item-id]");
  if (itemButton) {
    activeId = itemButton.dataset.itemId;
    render();
  }
});

$("addItem").addEventListener("click", () => {
  const name = $("itemName").value.trim();
  if (!name) {
    $("itemName").focus();
    return;
  }
  const item = createItem(name, $("itemCategory").value);
  state.items.push(item);
  activeId = item.id;
  $("itemName").value = "";
  saveState();
  render();
});

$("deleteItem").addEventListener("click", () => {
  state.items = state.items.filter((item) => item.id !== activeId);
  activeId = state.items[0]?.id ?? null;
  saveState();
  render();
});

$("copyShareLink").addEventListener("click", async () => {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  await navigator.clipboard.writeText(url.toString());
  setSyncStatus(cloudEnabled ? "共享链接已复制，发给对方就行。" : "链接已复制；填好云端配置后即可异地同步。");
});

render();
initCloud();
