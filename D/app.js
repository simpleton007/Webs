(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore
      }
    },
  };

  // ---------- Routing ----------
  const pages = Array.from(document.querySelectorAll("[data-page]"));
  const navLinks = Array.from(document.querySelectorAll("[data-nav]"));

  function setActivePage(name) {
    pages.forEach((p) => p.classList.toggle("active", p.dataset.page === name));
    navLinks.forEach((a) => {
      const active = a.dataset.nav === name;
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    // Keep focus predictable on navigation
    const h = $(`#page-${name} h1, #page-${name} h2`);
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function getRoute() {
    const hash = (location.hash || "#/home").trim();
    const m = hash.match(/^#\/(home|study|nero)\b/);
    return (m && m[1]) || "home";
  }

  function onRoute() {
    setActivePage(getRoute());
  }

  window.addEventListener("hashchange", onRoute);

  // ---------- Focus mode ----------
  const focusToggle = $("#focusToggle");
  const focusKey = "swn.focus";
  function applyFocusMode(on) {
    document.body.classList.toggle("focus", on);
    focusToggle.checked = on;
    storage.set(focusKey, on);
  }
  focusToggle.addEventListener("change", () => applyFocusMode(focusToggle.checked));
  applyFocusMode(!!storage.get(focusKey, true));

  // ---------- Pomodoro ----------
  const defaults = { focusMin: 25, breakMin: 5 };
  const timerKey = "swn.timerState";

  const timeDisplay = $("#timeDisplay");
  const timerHint = $("#timerHint");
  const startPauseBtn = $("#startPauseBtn");
  const resetBtn = $("#resetBtn");
  const skipBtn = $("#skipBtn");
  const modeFocusBtn = $("#modeFocus");
  const modeBreakBtn = $("#modeBreak");

  let tick = null;
  let state = storage.get(timerKey, {
    mode: "focus", // focus | break
    running: false,
    remainingSec: defaults.focusMin * 60,
    lastTickMs: null,
  });

  function modeSeconds(mode) {
    return (mode === "break" ? defaults.breakMin : defaults.focusMin) * 60;
  }

  function formatMMSS(sec) {
    const s = Math.max(0, Math.floor(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function setMode(mode) {
    state.mode = mode;
    state.running = false;
    state.remainingSec = modeSeconds(mode);
    state.lastTickMs = null;
    persistTimer();
    renderTimer();
    stopTicker();
  }

  function persistTimer() {
    storage.set(timerKey, state);
  }

  function renderTimer() {
    timeDisplay.textContent = formatMMSS(state.remainingSec);
    const isFocus = state.mode === "focus";
    modeFocusBtn.setAttribute("aria-pressed", String(isFocus));
    modeBreakBtn.setAttribute("aria-pressed", String(!isFocus));
    timerHint.textContent = isFocus
      ? `Focus for ${defaults.focusMin} minutes.`
      : `Break for ${defaults.breakMin} minutes.`;
    startPauseBtn.textContent = state.running ? "Pause" : "Start";
  }

  function stopTicker() {
    if (tick) {
      clearInterval(tick);
      tick = null;
    }
  }

  function startTicker() {
    if (tick) return;
    tick = setInterval(() => {
      if (!state.running) return;
      const now = Date.now();
      if (state.lastTickMs == null) state.lastTickMs = now;
      const elapsed = Math.max(0, Math.floor((now - state.lastTickMs) / 1000));
      if (elapsed <= 0) return;
      state.lastTickMs = now;
      state.remainingSec -= elapsed;
      if (state.remainingSec <= 0) {
        state.remainingSec = 0;
        state.running = false;
        stopTicker();
        renderTimer();
        persistTimer();
        onTimerDone();
        return;
      }
      renderTimer();
      persistTimer();
    }, 300);
  }

  function beep() {
    // Lightweight beep using WebAudio, no external assets.
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 740;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      const t = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.stop(t + 0.25);
      o.onended = () => ctx.close().catch(() => {});
    } catch {
      // ignore
    }
  }

  function onTimerDone() {
    beep();
    const next = state.mode === "focus" ? "break" : "focus";
    // Auto-switch to next session (not auto-start).
    state.mode = next;
    state.remainingSec = modeSeconds(next);
    state.running = false;
    state.lastTickMs = null;
    persistTimer();
    renderTimer();
  }

  function toggleRunning() {
    state.running = !state.running;
    state.lastTickMs = Date.now();
    persistTimer();
    renderTimer();
    if (state.running) startTicker();
  }

  function resetTimer() {
    state.running = false;
    state.remainingSec = modeSeconds(state.mode);
    state.lastTickMs = null;
    persistTimer();
    renderTimer();
    stopTicker();
  }

  function skipTimer() {
    state.running = false;
    onTimerDone();
  }

  modeFocusBtn.addEventListener("click", () => setMode("focus"));
  modeBreakBtn.addEventListener("click", () => setMode("break"));
  startPauseBtn.addEventListener("click", toggleRunning);
  resetBtn.addEventListener("click", resetTimer);
  skipBtn.addEventListener("click", skipTimer);

  // Resume ticker if it was running (best effort).
  if (state.running) startTicker();
  renderTimer();

  // ---------- Ambient ----------
  const ambientToggle = $("#ambientToggle");
  const ambientHint = $("#ambientHint");
  const ambientStatus = $("#ambientStatus");
  const ambientKey = "swn.ambientOn";

  let ambientNode = null;

  function ambientOn() {
    // Tiny procedural "wind" using filtered noise (no downloads). Still lightweight.
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 520;
      filter.Q.value = 0.6;

      const gain = ctx.createGain();
      gain.gain.value = 0.06;

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      whiteNoise.start(0);
      ambientNode = { ctx, whiteNoise };
      ambientHint.textContent = "On (soft noise)";
      ambientStatus.textContent = "Ambient sound on.";
    } catch {
      ambientNode = { ctx: null, whiteNoise: null };
      ambientHint.textContent = "On (placeholder)";
      ambientStatus.textContent = "Ambient sound on.";
    }
  }

  function ambientOff() {
    try {
      if (ambientNode?.whiteNoise) ambientNode.whiteNoise.stop();
      if (ambientNode?.ctx) ambientNode.ctx.close().catch(() => {});
    } catch {
      // ignore
    }
    ambientNode = null;
    ambientHint.textContent = "Off";
    ambientStatus.textContent = "Ambient sound off.";
  }

  function setAmbient(on) {
    ambientToggle.checked = on;
    storage.set(ambientKey, on);
    if (on) ambientOn();
    else ambientOff();
  }

  ambientToggle.addEventListener("change", () => setAmbient(ambientToggle.checked));
  setAmbient(!!storage.get(ambientKey, false));

  // ---------- Todos ----------
  const todosKey = "swn.todos";
  const todoForm = $("#todoForm");
  const todoInput = $("#todoInput");
  const todoList = $("#todoList");
  const todoFooterHint = $("#todoFooterHint");
  const clearDoneBtn = $("#clearDoneBtn");

  /** @type {{id:string, text:string, done:boolean, createdAt:number}[]} */
  let todos = storage.get(todosKey, []);

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function persistTodos() {
    storage.set(todosKey, todos);
  }

  function renderTodos() {
    todoList.innerHTML = "";
    const remaining = todos.filter((t) => !t.done).length;
    if (todos.length === 0) {
      todoFooterHint.textContent = "No tasks yet. Add one small thing to start.";
    } else {
      todoFooterHint.textContent = remaining === 0 ? "All done. Keep the momentum." : `${remaining} remaining.`;
    }

    todos.forEach((t) => {
      const li = document.createElement("li");
      li.className = "todo" + (t.done ? " done" : "");
      li.dataset.id = t.id;

      const left = document.createElement("div");
      left.className = "todo-left";

      const label = document.createElement("label");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!t.done;
      cb.addEventListener("change", () => {
        t.done = cb.checked;
        persistTodos();
        renderTodos();
      });

      const text = document.createElement("span");
      text.className = "todo-text";
      text.textContent = t.text;

      label.appendChild(cb);
      label.appendChild(text);
      left.appendChild(label);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "icon-btn";
      del.textContent = "Remove";
      del.addEventListener("click", () => {
        todos = todos.filter((x) => x.id !== t.id);
        persistTodos();
        renderTodos();
      });

      li.appendChild(left);
      li.appendChild(del);
      todoList.appendChild(li);
    });
  }

  todoForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = (todoInput.value || "").trim();
    if (!text) return;
    todos.unshift({ id: uid(), text, done: false, createdAt: Date.now() });
    todoInput.value = "";
    persistTodos();
    renderTodos();
  });

  clearDoneBtn.addEventListener("click", () => {
    const before = todos.length;
    todos = todos.filter((t) => !t.done);
    if (todos.length !== before) {
      persistTodos();
      renderTodos();
    }
  });

  renderTodos();

  // ---------- Nero chat (local logic) ----------
  const chatKey = "swn.chat";
  const messagesEl = $("#messages");
  const chatForm = $("#chatForm");
  const chatInput = $("#chatInput");
  const clearChatBtn = $("#clearChatBtn");

  /** @type {{role:"user"|"nero", text:string, ts:number}[]} */
  let chat = storage.get(chatKey, []);

  function persistChat() {
    storage.set(chatKey, chat);
  }

  function addMessage(role, text) {
    chat.push({ role, text, ts: Date.now() });
    persistChat();
    renderChat(true);
  }

  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function renderChat(scrollToBottom) {
    messagesEl.innerHTML = "";
    if (chat.length === 0) {
      const welcome =
        "I’m Nero. Tell me what you’re studying, and I’ll help you stay on track: a quick plan, a concept explanation, or a short pep talk.";
      chat = [{ role: "nero", text: welcome, ts: Date.now() }];
      persistChat();
    }
    chat.forEach((m) => {
      const div = document.createElement("div");
      div.className = `bubble ${m.role}`;
      div.textContent = m.text;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `${m.role === "user" ? "You" : "Nero"} • ${fmtTime(m.ts)}`;
      div.appendChild(meta);
      messagesEl.appendChild(div);
    });
    if (scrollToBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  const blocked = [
    "twitter",
    "tiktok",
    "instagram",
    "reddit",
    "netflix",
    "youtube",
    "discord",
    "game",
    "games",
    "meme",
    "memes",
    "drama",
    "celebrity",
  ];

  function neroReply(userText) {
    const t = userText.toLowerCase();

    if (blocked.some((w) => t.includes(w))) {
      return "Let’s keep this a focus space. Tell me what topic you’re studying and what you need next (plan, explanation, practice, or motivation).";
    }

    if (t.includes("plan") || t.includes("schedule") || t.includes("today")) {
      return "Quick plan: 1) Choose one objective. 2) Do a 25‑minute focus session. 3) Write a 2‑line summary. 4) Do 5 minutes of review. What subject + objective are you aiming for?";
    }

    if (t.includes("motivat") || t.includes("tired") || t.includes("procrast")) {
      return "You don’t need to feel ready — you just need to start. Pick the smallest next action (one problem, one paragraph, one flashcard set). Want a 25‑minute focus sprint right now?";
    }

    if (t.includes("explain") || t.includes("help") || t.includes("understand") || t.includes("how")) {
      return "Tell me the exact concept and where you got stuck. I’ll explain it simply, then we’ll do 2 quick checks to make sure it clicked.";
    }

    if (t.includes("pomodoro") || t.includes("timer")) {
      return "Pomodoro works best when the task is clear. Before you start, write: “In this 25 minutes, I will ___.” What will you do in the next session?";
    }

    if (t.includes("task") || t.includes("todo") || t.includes("to-do")) {
      return "Make tasks tiny and concrete. Example: “Read pages 12–15 and write 3 bullet notes.” What’s one task you can add right now?";
    }

    return "What are you studying right now, and what would make this next 25 minutes a win?";
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = (chatInput.value || "").trim();
    if (!text) return;
    chatInput.value = "";
    addMessage("user", text);
    // Slight delay to feel responsive but not animated-heavy.
    setTimeout(() => addMessage("nero", neroReply(text)), 220);
  });

  // Enter to send, Shift+Enter newline.
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  clearChatBtn.addEventListener("click", () => {
    chat = [];
    persistChat();
    renderChat(true);
  });

  renderChat(true);

  // ---------- Init ----------
  if (!location.hash) location.hash = "#/home";
  onRoute();
})();

