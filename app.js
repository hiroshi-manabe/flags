const STORAGE_KEYS = {
  settings: "flagBuddy.settings.v1",
  progress: "flagBuddy.progress.v1",
};

const TIMER_OPTIONS = [3000, 10000, 0];
const QUESTION_DIRECTIONS = ["name-to-flag", "flag-to-name"];
const DEFAULT_SETTINGS = { timerMs: 3000, questionDirection: "name-to-flag" };
const FEEDBACK_MS = 850;
const MIN_CORRECT_GAP = 5;
const SEED_CODES = ["jp", "us", "gb", "fr", "de", "it", "ca", "br", "cn", "kr", "au", "in", "es", "mx", "ch", "se"];
const BLOCKED_PAIRS = [
  ["id", "mc"],
  ["td", "ro"],
];

const dom = {
  loadingScreen: document.querySelector('[data-screen="loading"]'),
  modeScreen: document.querySelector('[data-screen="mode"]'),
  playScreen: document.querySelector('[data-screen="play"]'),
  settingsPanel: document.querySelector("[data-settings]"),
  modeTitle: document.querySelector("#play-title"),
  accuracy: document.querySelector('[data-hud="accuracy"]'),
  runProgress: document.querySelector('[data-hud="run-progress"]'),
  hudProgress: document.querySelector("[data-hud-progress]"),
  runBar: document.querySelector("[data-run-bar]"),
  timer: document.querySelector("[data-timer]"),
  timerBar: document.querySelector("[data-timer-bar]"),
  flag: document.querySelector("[data-flag]"),
  prompt: document.querySelector("[data-prompt]"),
  feedback: document.querySelector("[data-feedback]"),
  choices: [...document.querySelectorAll("[data-choice]")],
  timerOptions: [...document.querySelectorAll("[data-timer-value]")],
  questionOptions: [...document.querySelectorAll("[data-question-value]")],
  eraseMessage: document.querySelector("[data-erase-message]"),
  loadBar: document.querySelector("[data-load-bar]"),
  loadCount: document.querySelector("[data-load-count]"),
};

const state = {
  countries: [],
  byCode: new Map(),
  settings: loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  progress: loadJSON(STORAGE_KEYS.progress, null),
  mode: null,
  session: null,
  current: null,
  locked: false,
  timerId: null,
  timerFrame: null,
  feedbackId: null,
  imageCache: new Map(),
};

init();

async function init() {
  state.countries = await fetch("data/countries.json").then((response) => response.json());
  state.byCode = new Map(state.countries.map((country) => [country.code, country]));
  state.progress = normalizeProgress(state.progress);
  bindEvents();
  updateSettingsUI();
  await preloadRuntimeFlags();
  showModeScreen();
}

function bindEvents() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => startMode(button.dataset.mode));
  });

  document.querySelector('[data-action="back"]').addEventListener("click", showModeScreen);
  document.querySelector('[data-action="open-settings"]').addEventListener("click", openSettings);
  document.querySelector('[data-action="close-settings"]').addEventListener("click", closeSettings);
  document.querySelector('[data-action="erase-data"]').addEventListener("click", eraseData);

  dom.settingsPanel.addEventListener("click", (event) => {
    if (event.target === dom.settingsPanel) closeSettings();
  });

  dom.timerOptions.forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.timerMs = Number(button.dataset.timerValue);
      saveJSON(STORAGE_KEYS.settings, state.settings);
      updateSettingsUI();
    });
  });

  dom.questionOptions.forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.questionDirection = button.dataset.questionValue;
      saveJSON(STORAGE_KEYS.settings, state.settings);
      updateSettingsUI();
    });
  });

  dom.choices.forEach((button, index) => {
    button.addEventListener("click", () => submitAnswer(index));
  });

  window.addEventListener("keydown", (event) => {
    if (state.mode === null || state.locked) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      submitAnswer(0);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      submitAnswer(1);
    }
  });
}

function startMode(mode) {
  stopTimer();
  state.mode = mode;
  state.locked = false;
  state.session = {
    shown: 0,
    correct: 0,
    allOrder: mode === "all" ? shuffle(state.countries.map((country) => country.code)) : [],
    allIndex: 0,
    questionNumber: state.progress.questionNumber || 0,
  };
  dom.modeTitle.textContent = mode === "all" ? "全国旗モード" : "無限モード";
  dom.hudProgress.classList.toggle("is-hidden", mode !== "all");
  dom.modeScreen.classList.add("is-hidden");
  dom.playScreen.classList.remove("is-hidden");
  nextQuestion();
}

function showModeScreen() {
  stopTimer();
  clearFeedbackDelay();
  state.mode = null;
  state.current = null;
  state.locked = false;
  dom.playScreen.classList.add("is-hidden");
  dom.loadingScreen.classList.add("is-hidden");
  dom.modeScreen.classList.remove("is-hidden");
}

function openSettings() {
  dom.settingsPanel.classList.remove("is-hidden");
}

function closeSettings() {
  dom.settingsPanel.classList.add("is-hidden");
  dom.eraseMessage.textContent = "";
}

function eraseData() {
  localStorage.removeItem(STORAGE_KEYS.progress);
  state.progress = normalizeProgress(null);
  if (state.mode === "infinite") {
    state.session.questionNumber = state.progress.questionNumber;
  }
  dom.eraseMessage.textContent = "学習データを消去しました";
}

function nextQuestion() {
  if (state.mode === null) return;
  clearFeedbackDelay();
  stopTimer();
  clearChoiceStyles();
  state.locked = false;
  dom.feedback.textContent = "";

  if (state.mode === "all" && state.session.allIndex >= state.session.allOrder.length) {
    finishAllFlagsMode();
    return;
  }

  const target = state.mode === "all" ? nextAllFlagsTarget() : nextInfiniteTarget();
  const distractor = state.mode === "all" ? randomDistractor(target) : infiniteDistractor(target);
  const ordered = Math.random() < 0.5 ? [target, distractor] : [distractor, target];

  state.current = {
    target,
    choices: ordered,
    correctIndex: ordered.findIndex((country) => country.code === target.code),
    distractor,
  };

  renderQuestion();
  startTimer();
}

function renderQuestion() {
  const { target, choices } = state.current;
  const nameToFlag = state.settings.questionDirection === "name-to-flag";
  dom.flag.parentElement.classList.toggle("compact", nameToFlag);
  dom.flag.classList.toggle("is-hidden", nameToFlag);
  dom.prompt.classList.toggle("country-prompt", nameToFlag);

  if (nameToFlag) {
    dom.flag.removeAttribute("src");
    dom.flag.alt = "";
    dom.prompt.textContent = target.nameJa;
    renderFlagChoices(choices);
  } else {
    dom.flag.src = flagSource(target);
    dom.flag.alt = `${target.nameJa}の国旗`;
    dom.prompt.textContent = "どっちの国旗？";
    renderNameChoices(choices);
  }
  updateHUD();
}

function renderNameChoices(choices) {
  dom.choices.forEach((button, index) => {
    const country = choices[index];
    button.classList.remove("flag-choice");
    button.textContent = country.nameJa;
    button.disabled = false;
    button.setAttribute("aria-label", `${index === 0 ? "左" : "右"}: ${country.nameJa}`);
  });
}

function renderFlagChoices(choices) {
  dom.choices.forEach((button, index) => {
    const country = choices[index];
    button.classList.add("flag-choice");
    button.textContent = "";
    const image = document.createElement("img");
    image.src = flagSource(country);
    image.alt = `${country.nameJa}の国旗`;
    button.append(image);
    button.disabled = false;
    button.setAttribute("aria-label", `${index === 0 ? "左" : "右"}: ${country.nameJa}の国旗`);
  });
}

async function preloadRuntimeFlags() {
  let loaded = 0;
  updateLoadProgress(loaded);
  await Promise.all(
    state.countries.map(async (country) => {
      country.runtimeFlag = flagSource(country);
      try {
        await preloadImage(country.runtimeFlag);
      } catch {
        country.runtimeFlag = country.flagSvg || country.flag;
        await preloadImage(country.runtimeFlag);
      } finally {
        loaded += 1;
        updateLoadProgress(loaded);
      }
    }),
  );
}

function preloadImage(src) {
  if (!src) return Promise.reject(new Error("Missing image source"));
  if (state.imageCache.has(src)) return state.imageCache.get(src);

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error(`Failed to preload ${src}`));
    image.src = src;
  });
  state.imageCache.set(src, promise);
  return promise;
}

function updateLoadProgress(loaded) {
  const total = state.countries.length || 200;
  dom.loadCount.textContent = String(loaded);
  dom.loadBar.style.width = `${(loaded / total) * 100}%`;
}

function flagSource(country) {
  return country.runtimeFlag || country.flagPng || country.flagSvg || country.flag;
}

function submitAnswer(choiceIndex) {
  if (state.locked || !state.current) return;
  stopTimer();
  state.locked = true;
  dom.choices.forEach((button) => {
    button.disabled = true;
  });

  const timedOut = choiceIndex === null;
  const correct = !timedOut && choiceIndex === state.current.correctIndex;
  state.session.shown += 1;
  if (correct) state.session.correct += 1;

  if (state.mode === "infinite") {
    updateMastery(correct, timedOut);
  }

  renderFeedback(choiceIndex, correct, timedOut);
  updateHUD();
  state.feedbackId = window.setTimeout(nextQuestion, FEEDBACK_MS);
}

function renderFeedback(choiceIndex, correct, timedOut) {
  const correctButton = dom.choices[state.current.correctIndex];
  const nameToFlag = state.settings.questionDirection === "name-to-flag";
  const correctSide = state.current.correctIndex === 0 ? "左" : "右";
  correctButton.classList.add("correct");

  if (timedOut) {
    dom.feedback.textContent = nameToFlag ? `時間切れ。正解は${correctSide}` : `時間切れ。正解は${state.current.target.nameJa}`;
    return;
  }

  if (correct) {
    dom.feedback.textContent = "正解！";
    return;
  }

  dom.choices[choiceIndex].classList.add("incorrect");
  dom.feedback.textContent = nameToFlag ? `正解は${correctSide}` : `正解は${state.current.target.nameJa}`;
}

function finishAllFlagsMode() {
  state.locked = true;
  dom.flag.removeAttribute("src");
  dom.flag.classList.add("is-hidden");
  dom.flag.parentElement.classList.add("compact");
  dom.prompt.classList.remove("country-prompt");
  dom.flag.alt = "";
  dom.prompt.textContent = "全国旗モード終了";
  dom.feedback.textContent = "戻るボタンでモード選択に戻れます";
  dom.choices.forEach((button) => {
    button.classList.remove("flag-choice");
    button.textContent = "終了";
    button.disabled = true;
  });
  updateHUD();
}

function nextAllFlagsTarget() {
  const code = state.session.allOrder[state.session.allIndex];
  state.session.allIndex += 1;
  return state.byCode.get(code);
}

function nextInfiniteTarget() {
  ensureActivePool();
  const now = state.session.questionNumber;
  let due = dueLearningItems(now);
  if (due.length === 0) {
    introduceNextNew(now);
    due = dueLearningItems(now);
  }

  const item = due[0] || fallbackLearningItem(now) || sample(Object.values(state.progress.items));
  state.session.questionNumber += 1;
  state.progress.questionNumber = state.session.questionNumber;
  saveProgress();
  return state.byCode.get(item.code);
}

function ensureActivePool() {
  const activeItems = Object.values(state.progress.items).filter((item) => item.status !== "new" && item.status !== "mastered");
  const weakItems = activeItems.filter((item) => item.mastery < 55 || item.dueAt <= state.session.questionNumber);

  if (activeItems.length >= 10 && weakItems.length >= 3) return;
  introduceNextNew(state.session.questionNumber);
}

function introduceNextNew(dueAt) {
  const nextNew = state.countries
    .map((country) => state.progress.items[country.code])
    .find((item) => item.status === "new");

  if (!nextNew) return null;
  nextNew.status = "learning";
  nextNew.mastery = 0;
  nextNew.dueAt = dueAt;
  saveProgress();
  return nextNew;
}

function dueLearningItems(now) {
  return state.countries
    .map((country) => state.progress.items[country.code])
    .filter((item) => item.status !== "new" && item.status !== "mastered" && item.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || a.mastery - b.mastery);
}

function fallbackLearningItem(now) {
  const learningItems = Object.values(state.progress.items).filter((item) => item.status !== "new" && item.status !== "mastered");
  const cooledItems = learningItems.filter((item) => item.lastSeenAt === null || now - item.lastSeenAt >= MIN_CORRECT_GAP);
  return (cooledItems.length ? cooledItems : learningItems).sort((a, b) => a.dueAt - b.dueAt || a.mastery - b.mastery)[0];
}

function infiniteDistractor(target) {
  const targetItem = state.progress.items[target.code];
  let pool;

  if (targetItem.status === "learning" && targetItem.seen < 2) {
    pool = SEED_CODES.map((code) => state.byCode.get(code)).filter(Boolean);
  } else {
    pool = state.countries.filter((country) => {
      const item = state.progress.items[country.code];
      return item.status !== "new" && item.code !== target.code;
    });
  }

  return randomDistractor(target, pool);
}

function randomDistractor(target, pool = state.countries) {
  const candidates = pool.filter((country) => country.code !== target.code && !isBlockedPair(target.code, country.code));
  return sample(candidates.length ? candidates : state.countries.filter((country) => country.code !== target.code));
}

function updateMastery(correct, timedOut) {
  const target = state.current.target;
  const item = state.progress.items[target.code];
  const weight = distractorWeight(item);

  item.seen += 1;
  item.lastSeenAt = state.session.questionNumber;
  item.lastDistractors = [state.current.distractor.code, ...item.lastDistractors.filter((code) => code !== state.current.distractor.code)].slice(0, 4);

  if (correct) {
    item.correct += 1;
    item.streak += 1;
    item.mastery = clamp(item.mastery + 8 * weight, 0, 100);
    item.dueAt = state.session.questionNumber + nextSpacing(item);
  } else {
    item.wrong += timedOut ? 0 : 1;
    item.timeouts += timedOut ? 1 : 0;
    item.streak = 0;
    item.mastery = clamp(item.mastery - 10, 0, 100);
    item.dueAt = state.session.questionNumber + 2 + Math.floor(Math.random() * 3);
  }

  if (item.mastery >= 80 && item.streak >= 4) item.status = "mastered";
  else if (item.mastery >= 50) item.status = "review";
  else if (item.status !== "seed-known") item.status = "learning";

  saveProgress();
}

function distractorWeight(item) {
  if (item.status === "learning" && item.seen < 2) return 0.5;
  if (state.progress.items[state.current.distractor.code]?.status === "mastered") return 1;
  return 0.8;
}

function nextSpacing(item) {
  if (item.streak <= 1) return MIN_CORRECT_GAP + Math.floor(Math.random() * 2);
  if (item.streak === 2) return 10 + Math.floor(Math.random() * 6);
  if (item.streak === 3) return 24;
  return 50;
}

function startTimer() {
  const duration = state.settings.timerMs;
  dom.timer.classList.toggle("is-hidden", duration === 0);
  dom.timerBar.style.width = "100%";
  if (duration === 0) return;

  const start = performance.now();
  state.timerId = window.setTimeout(() => submitAnswer(null), duration);

  const tick = (now) => {
    const ratio = clamp(1 - (now - start) / duration, 0, 1);
    dom.timerBar.style.width = `${ratio * 100}%`;
    if (ratio > 0 && !state.locked) {
      state.timerFrame = window.requestAnimationFrame(tick);
    }
  };
  state.timerFrame = window.requestAnimationFrame(tick);
}

function stopTimer() {
  if (state.timerId) window.clearTimeout(state.timerId);
  if (state.timerFrame) window.cancelAnimationFrame(state.timerFrame);
  state.timerId = null;
  state.timerFrame = null;
}

function clearFeedbackDelay() {
  if (state.feedbackId) window.clearTimeout(state.feedbackId);
  state.feedbackId = null;
}

function updateHUD() {
  const shown = state.session?.shown || 0;
  const correct = state.session?.correct || 0;
  const percent = shown === 0 ? 0 : Math.round((correct / shown) * 100);
  dom.accuracy.textContent = `${correct}/${shown} ${percent}%`;

  if (state.mode === "all") {
    const seen = state.session.allIndex;
    dom.runProgress.textContent = `${seen}/200`;
    dom.runBar.style.width = `${(seen / state.countries.length) * 100}%`;
  }
}

function updateSettingsUI() {
  if (!TIMER_OPTIONS.includes(state.settings.timerMs)) state.settings.timerMs = DEFAULT_SETTINGS.timerMs;
  if (!QUESTION_DIRECTIONS.includes(state.settings.questionDirection)) {
    state.settings.questionDirection = DEFAULT_SETTINGS.questionDirection;
  }
  dom.timerOptions.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.timerValue) === state.settings.timerMs);
  });
  dom.questionOptions.forEach((button) => {
    button.classList.toggle("active", button.dataset.questionValue === state.settings.questionDirection);
  });
}

function normalizeProgress(progress) {
  const items = {};
  const existing = progress?.items || {};
  for (const country of state.countries) {
    const old = existing[country.code] || {};
    const seedKnown = SEED_CODES.includes(country.code);
    const status = seedKnown ? "mastered" : old.status || "new";
    items[country.code] = {
      code: country.code,
      status,
      seen: old.seen || 0,
      correct: old.correct || 0,
      wrong: old.wrong || 0,
      timeouts: old.timeouts || 0,
      streak: old.streak || 0,
      mastery: seedKnown ? 100 : old.mastery ?? 0,
      dueAt: seedKnown ? Number.MAX_SAFE_INTEGER : old.dueAt || 0,
      lastSeenAt: old.lastSeenAt || null,
      lastDistractors: old.lastDistractors || [],
    };
  }
  return {
    questionNumber: progress?.questionNumber || 0,
    items,
  };
}

function saveProgress() {
  saveJSON(STORAGE_KEYS.progress, state.progress);
}

function clearChoiceStyles() {
  dom.choices.forEach((button) => {
    button.classList.remove("correct", "incorrect");
  });
}

function isBlockedPair(a, b) {
  return BLOCKED_PAIRS.some(([left, right]) => (a === left && b === right) || (a === right && b === left));
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return cloneFallback(fallback);
    const parsed = JSON.parse(raw);
    return fallback && typeof fallback === "object" && !Array.isArray(fallback) ? { ...fallback, ...parsed } : parsed;
  } catch {
    return cloneFallback(fallback);
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cloneFallback(fallback) {
  return fallback && typeof fallback === "object" && !Array.isArray(fallback) ? { ...fallback } : fallback;
}
