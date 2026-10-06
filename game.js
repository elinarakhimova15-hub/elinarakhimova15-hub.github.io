(() => {
  "use strict";

  const levels = window.POWERS_LEVELS;
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const byId = (id) => document.getElementById(id);
  const ui = {
    startScreen: byId("startScreen"), startButton: byId("startButton"),
    topicProgress: byId("topicProgress"), levelPicker: byId("levelPicker"),
    heroName: byId("heroName"), levelText: byId("levelText"),
    progressText: byId("progressText"), livesText: byId("livesText"),
    missionText: byId("missionText"), gateProgress: byId("gateProgress"),
    teacherNote: byId("teacherNote"), actionPrompt: byId("actionPrompt"),
    toast: byId("toast"), soundButton: byId("soundButton"),
    restartButton: byId("restartButton"), mobileSolve: byId("mobileSolve"),
    heroChoices: [...document.querySelectorAll(".hero-choice")],
    challengeDialog: byId("challengeDialog"), challengeForm: byId("challengeForm"),
    challengeNumber: byId("challengeNumber"), challengeTitle: byId("challengeTitle"),
    challengeQuestion: byId("challengeQuestion"), challengeIcon: byId("challengeIcon"),
    choiceGrid: byId("choiceGrid"), answerFeedback: byId("answerFeedback"),
    hintButton: byId("hintButton"), hintBox: byId("hintBox"),
    resultDialog: byId("resultDialog"), resultKicker: byId("resultKicker"),
    resultTitle: byId("resultTitle"), resultMessage: byId("resultMessage"),
    resultTasks: byId("resultTasks"), resultLives: byId("resultLives"),
    nextLevelButton: byId("nextLevelButton"), chooseLevelButton: byId("chooseLevelButton"),
    failDialog: byId("failDialog"), tryAgainButton: byId("tryAgainButton")
  };

  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;
  const FLOOR_Y = 545;
  const STORAGE_KEY = "math-temple-powers-progress-v1";
  const keys = Object.create(null);
  const colors = {
    fire: "#ff8154", fireDark: "#b94225", water: "#54d7ff", waterDark: "#187ca8",
    spark: "#c891ff", sparkDark: "#6f43aa", leaf: "#65e69d", leafDark: "#27875a",
    hazard: "#ffe05a", gold: "#ffd66b", stone: "#29345f", stoneTop: "#465586", good: "#5fe1a5"
  };
  const heroes = {
    fire: { name: "Огонёк", color: colors.fire, dark: colors.fireDark, tone: 350 },
    water: { name: "Капелька", color: colors.water, dark: colors.waterDark, tone: 470 },
    spark: { name: "Искорка", color: colors.spark, dark: colors.sparkDark, tone: 560 },
    leaf: { name: "Листик", color: colors.leaf, dark: colors.leafDark, tone: 420 }
  };

  let audioContext = null;
  let soundOn = true;
  let running = false;
  let paused = true;
  let selectedHero = "fire";
  let currentLevelIndex = 0;
  let challenges = [];
  let lives = 3;
  let cameraX = 0;
  let currentChallenge = null;
  let toastTimer = null;
  let lastTime = 0;
  let lastDeath = null;
  let worldWidth = 2360;
  let platforms = [];
  let hazards = [];
  let portal = { x: 2250, y: 477, occupied: false };
  let completedLevels = new Set();

  function makePlayer(type, x = 105) {
    return {
      type, x, y: FLOOR_Y - 44, w: 30, h: 44, vx: 0, vy: 0,
      onGround: false, checkpointX: x, atGoal: false, invulnerableUntil: 0, step: 0
    };
  }
  let player = makePlayer(selectedHero);

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Array.isArray(saved.completed)) {
        completedLevels = new Set(saved.completed.filter((item) => Number.isInteger(item) && item >= 0 && item < levels.length));
      }
      if (heroes[saved.hero]) selectedHero = saved.hero;
    } catch (_) {
      completedLevels = new Set();
    }
    const firstIncomplete = levels.findIndex((_, index) => !completedLevels.has(index));
    currentLevelIndex = firstIncomplete < 0 ? levels.length - 1 : firstIncomplete;
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: [...completedLevels], hero: selectedHero }));
    } catch (_) {}
  }

  function buildLevel(index) {
    const level = levels[index];
    const gateStart = 620;
    const spacing = 470;
    challenges = level.tasks.map((task, taskIndex) => ({
      ...task, title: level.title, icon: level.icon, solved: false,
      gateX: gateStart + taskIndex * spacing,
      consoleX: gateStart - 115 + taskIndex * spacing
    }));
    const lastGate = challenges[challenges.length - 1].gateX;
    worldWidth = lastGate + 470;
    portal = { x: lastGate + 305, y: 477, occupied: false };
    platforms = [{ x: 0, y: FLOOR_Y, w: worldWidth, h: 75 }];
    hazards = challenges.map((challenge, indexInLevel) => ({
      x: challenge.gateX - 300, y: 530, w: indexInLevel % 2 ? 78 : 68, h: 18
    }));
    hazards.push({ x: portal.x - 135, y: 530, w: 54, h: 18 });
    player = makePlayer(selectedHero);
    lives = 3;
    cameraX = 0;
    currentChallenge = null;
    lastDeath = null;
    renderGateProgress();
    updateHud();
  }

  function levelIsLocked(index) {
    return index > 0 && !completedLevels.has(index - 1);
  }

  function renderLevelPicker() {
    ui.levelPicker.replaceChildren();
    levels.forEach((level, index) => {
      const locked = levelIsLocked(index);
      const completed = completedLevels.has(index);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level-choice";
      button.classList.toggle("selected", index === currentLevelIndex);
      button.classList.toggle("completed", completed);
      button.disabled = locked;
      button.setAttribute("aria-pressed", String(index === currentLevelIndex));
      button.innerHTML = `<strong>${locked ? "🔒" : `Уровень ${index + 1}`}</strong><span>${level.title}</span>${completed ? "<small>✓ пройден</small>" : ""}`;
      button.addEventListener("click", () => {
        currentLevelIndex = index;
        buildLevel(index);
        renderLevelPicker();
        updateStartButton();
        beep(480 + index * 35, .07, "triangle", .018);
      });
      ui.levelPicker.append(button);
    });
    const done = completedLevels.size;
    ui.topicProgress.textContent = done === levels.length
      ? "Тема пройдена! Можно повторить любой из 6 уровней."
      : `Пройдено уровней: ${done} из ${levels.length}. Всего в теме 24 задания.`;
  }

  function updateStartButton() {
    ui.startButton.textContent = `${completedLevels.has(currentLevelIndex) ? "Повторить" : "Начать"} уровень ${currentLevelIndex + 1}`;
  }

  function renderGateProgress() {
    ui.gateProgress.replaceChildren();
    challenges.forEach((challenge, index) => {
      if (index) {
        const line = document.createElement("span");
        line.className = "gate-line";
        ui.gateProgress.append(line);
      }
      const step = document.createElement("span");
      step.className = "gate-step";
      step.textContent = String(index + 1);
      step.classList.toggle("done", challenge.solved);
      ui.gateProgress.append(step);
    });
  }

  function resetGame({ start = true } = {}) {
    buildLevel(currentLevelIndex);
    running = start;
    paused = !start;
    if (ui.resultDialog.open) ui.resultDialog.close();
    if (ui.failDialog.open) ui.failDialog.close();
    if (ui.challengeDialog.open) ui.challengeDialog.close();
    ui.startScreen.hidden = start;
    showToast(start ? "Найди первый светящийся пульт" : "");
    if (start) {
      canvas.focus();
      lastTime = performance.now();
    }
  }

  function goToLevelMap() {
    running = false;
    paused = true;
    if (ui.resultDialog.open) ui.resultDialog.close();
    if (ui.failDialog.open) ui.failDialog.close();
    buildLevel(currentLevelIndex);
    renderLevelPicker();
    updateStartButton();
    ui.startScreen.hidden = false;
  }

  function plural(number, one, few, many) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function updateHud() {
    const hero = heroes[player.type];
    const level = levels[currentLevelIndex];
    const solved = challenges.filter((challenge) => challenge.solved).length;
    ui.heroName.innerHTML = `<span class="hero-dot ${player.type}" style="color:${hero.color};background:currentColor"></span> ${hero.name}`;
    ui.levelText.textContent = `${currentLevelIndex + 1} / ${levels.length}`;
    ui.progressText.textContent = `${solved} / ${challenges.length}`;
    ui.livesText.textContent = Array.from({ length: 3 }, (_, index) => index < lives ? "♥" : "♡").join(" ");
    ui.livesText.setAttribute("aria-label", `${lives} ${plural(lives, "жизнь", "жизни", "жизней")}`);
    ui.missionText.innerHTML = `<strong>Уровень ${currentLevelIndex + 1}:</strong> ${level.title}`;
    ui.teacherNote.innerHTML = `<strong>Навык уровня:</strong> ${level.skill}`;
    document.querySelectorAll(".gate-step").forEach((step, index) => step.classList.toggle("done", challenges[index]?.solved));
  }

  function showToast(message, danger = false) {
    clearTimeout(toastTimer);
    if (!message) { ui.toast.hidden = true; return; }
    ui.toast.textContent = message;
    ui.toast.classList.toggle("danger", danger);
    ui.toast.hidden = false;
    toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 2600);
  }

  function beep(frequency, duration = .12, type = "sine", gain = .04) {
    if (!soundOn) return;
    try {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(gain, audioContext.currentTime);
      volume.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(volume).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_) { soundOn = false; }
  }

  function nearestChallenge() {
    return challenges.findIndex((challenge) => !challenge.solved
      && Math.abs((player.x + player.w / 2) - challenge.consoleX) < 78
      && Math.abs(player.y - (FLOOR_Y - player.h)) < 100);
  }

  function openChallenge(index = nearestChallenge()) {
    if (index < 0 || !running || paused) return false;
    const challenge = challenges[index];
    currentChallenge = index;
    paused = true;
    ui.challengeNumber.textContent = `Задание ${index + 1} из ${challenges.length}`;
    ui.challengeTitle.textContent = challenge.title;
    ui.challengeQuestion.innerHTML = challenge.question;
    ui.challengeIcon.textContent = challenge.icon;
    ui.answerFeedback.textContent = "";
    ui.answerFeedback.className = "feedback";
    ui.hintBox.innerHTML = challenge.hint;
    ui.hintBox.hidden = true;
    ui.hintButton.textContent = "Показать подсказку";
    ui.choiceGrid.replaceChildren();
    challenge.choices.forEach((choice, choiceIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.innerHTML = choice;
      button.addEventListener("click", () => submitChoice(choiceIndex, button));
      ui.choiceGrid.append(button);
    });
    if (!ui.challengeDialog.open) ui.challengeDialog.showModal();
    requestAnimationFrame(() => ui.choiceGrid.querySelector("button")?.focus());
    return true;
  }

  function submitChoice(choiceIndex, clickedButton = null) {
    if (currentChallenge === null) return { correct: false, reason: "Нет открытого задания" };
    const challenge = challenges[currentChallenge];
    if (choiceIndex !== challenge.correct) {
      clickedButton?.classList.add("wrong");
      ui.answerFeedback.textContent = "Пока не сходится. Проверь решение или открой подсказку.";
      ui.answerFeedback.className = "feedback bad";
      beep(150, .17, "sawtooth", .025);
      return { correct: false, challenge: currentChallenge + 1 };
    }
    challenge.solved = true;
    [...ui.choiceGrid.children].forEach((button, index) => {
      button.disabled = true;
      button.classList.toggle("correct", index === challenge.correct);
    });
    ui.answerFeedback.innerHTML = `Верно! ${challenge.solution}`;
    ui.answerFeedback.className = "feedback good";
    updateHud();
    beep(660, .12, "sine", .04);
    setTimeout(() => beep(880, .16, "sine", .035), 90);
    const solvedIndex = currentChallenge;
    currentChallenge = null;
    setTimeout(() => {
      if (ui.challengeDialog.open) ui.challengeDialog.close();
      paused = false;
      canvas.focus();
      showToast(`Задание ${solvedIndex + 1} решено — дверь открыта!`);
    }, 1650);
    return { correct: true, challenge: solvedIndex + 1 };
  }

  function normalizeText(value) {
    return String(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function submitTextAnswer(value) {
    if (currentChallenge === null) return { correct: false, reason: "Нет открытого задания" };
    const challenge = challenges[currentChallenge];
    const index = challenge.choices.findIndex((choice) => normalizeText(choice) === normalizeText(value));
    return submitChoice(index);
  }

  function loseLife(activePlayer, message) {
    if (activePlayer.atGoal || performance.now() < activePlayer.invulnerableUntil) return;
    activePlayer.invulnerableUntil = performance.now() + 900;
    lastDeath = { type: activePlayer.type, x: Math.round(activePlayer.x), y: Math.round(activePlayer.y), message };
    lives -= 1;
    updateHud();
    beep(110, .23, "square", .025);
    if (lives <= 0) {
      running = false;
      paused = true;
      setTimeout(() => { if (!ui.failDialog.open) ui.failDialog.showModal(); }, 200);
      return;
    }
    activePlayer.x = activePlayer.checkpointX;
    activePlayer.y = FLOOR_Y - activePlayer.h;
    activePlayer.vx = 0;
    activePlayer.vy = 0;
    showToast(message, true);
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function updatePlayer(activePlayer, dt) {
    if (activePlayer.atGoal) return;
    const speed = 250;
    const jump = 600;
    const left = keys.ArrowLeft || keys.KeyA || keys.touchLeft;
    const right = keys.ArrowRight || keys.KeyD || keys.touchRight;
    activePlayer.vx = left === right ? activePlayer.vx * .76 : (left ? -speed : speed);
    if ((keys.ArrowUp || keys.KeyW || keys.Space || keys.touchJump) && activePlayer.onGround && !keys.jumpLock) {
      activePlayer.vy = -jump;
      activePlayer.onGround = false;
      keys.jumpLock = true;
      beep(heroes[activePlayer.type].tone, .08, "triangle", .018);
    }
    activePlayer.vy += 1400 * dt;
    activePlayer.vx = Math.max(-speed, Math.min(speed, activePlayer.vx));
    const oldX = activePlayer.x;
    const oldY = activePlayer.y;
    activePlayer.x += activePlayer.vx * dt;
    activePlayer.x = Math.max(4, Math.min(worldWidth - activePlayer.w - 4, activePlayer.x));
    for (const challenge of challenges) {
      if (!challenge.solved && overlaps(activePlayer, { x: challenge.gateX, y: 190, w: 35, h: FLOOR_Y - 190 })) {
        activePlayer.x = oldX;
        activePlayer.vx = 0;
      }
    }
    activePlayer.y += activePlayer.vy * dt;
    activePlayer.onGround = false;
    for (const platform of platforms) {
      if (!overlaps(activePlayer, platform)) continue;
      if (oldY + activePlayer.h <= platform.y + 8 && activePlayer.vy >= 0) {
        activePlayer.y = platform.y - activePlayer.h;
        activePlayer.vy = 0;
        activePlayer.onGround = true;
      } else if (oldY >= platform.y + platform.h - 5 && activePlayer.vy < 0) {
        activePlayer.y = platform.y + platform.h;
        activePlayer.vy = 0;
      } else if (oldX + activePlayer.w <= platform.x + 5) {
        activePlayer.x = platform.x - activePlayer.w;
        activePlayer.vx = 0;
      } else if (oldX >= platform.x + platform.w - 5) {
        activePlayer.x = platform.x + platform.w;
        activePlayer.vx = 0;
      }
    }
    if (activePlayer.y > VIEW_H + 100) loseLife(activePlayer, "Осторожно, здесь обрыв!");
    hazards.forEach((hazard) => { if (overlaps(activePlayer, hazard)) loseLife(activePlayer, "Перепрыгни энергетическую ловушку!"); });
    challenges.forEach((challenge) => {
      if (challenge.solved && activePlayer.x > challenge.gateX + 55) activePlayer.checkpointX = Math.max(activePlayer.checkpointX, challenge.gateX + 70);
    });
    if (overlaps(activePlayer, { x: portal.x - 7, y: portal.y - 8, w: 50, h: 76 })
      && challenges.every((challenge) => challenge.solved)) {
      activePlayer.atGoal = true;
      portal.occupied = true;
      activePlayer.vx = 0;
      activePlayer.vy = 0;
      activePlayer.x = portal.x + 4;
      activePlayer.y = FLOOR_Y - activePlayer.h;
      beep(heroes[activePlayer.type].tone + 370, .2, "sine", .04);
      finishLevel();
    }
    if (Math.abs(activePlayer.vx) > 20 && activePlayer.onGround) activePlayer.step += dt * 9;
  }

  function finishLevel() {
    running = false;
    paused = true;
    completedLevels.add(currentLevelIndex);
    saveProgress();
    const allDone = completedLevels.size === levels.length;
    ui.resultLives.textContent = String(lives);
    ui.resultTasks.textContent = `${challenges.length} / ${challenges.length}`;
    ui.resultKicker.textContent = allDone ? "Тема пройдена" : `Уровень ${currentLevelIndex + 1} пройден`;
    ui.resultTitle.textContent = allDone ? "Ты отлично справился!" : "Отличная работа!";
    ui.resultMessage.textContent = allDone
      ? "Все задания темы «Степени» решены. Ты прошёл все 6 уровней!"
      : `Ты решил все задания уровня «${levels[currentLevelIndex].title}». Открыт следующий уровень.`;
    ui.nextLevelButton.hidden = currentLevelIndex >= levels.length - 1;
    ui.missionText.innerHTML = "<strong>Готово:</strong> портал найден!";
    setTimeout(() => { if (!ui.resultDialog.open) ui.resultDialog.showModal(); }, 350);
  }

  function update(dt) {
    if (!running || paused) return;
    updatePlayer(player, dt);
    const targetCamera = Math.max(0, Math.min(worldWidth - VIEW_W, player.x - VIEW_W * .42));
    cameraX += (targetCamera - cameraX) * Math.min(1, dt * 5);
    const near = nearestChallenge();
    ui.actionPrompt.hidden = near < 0;
    ui.mobileSolve.disabled = near < 0;
  }

  function roundedRect(x, y, w, h, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    gradient.addColorStop(0, "#0b1331");
    gradient.addColorStop(1, "#101b3a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-(cameraX * .12) % 160, 0);
    for (let x = -160; x < VIEW_W + 320; x += 160) {
      ctx.fillStyle = "rgba(86,104,165,.09)";
      ctx.fillRect(x + 25, 86, 110, 390);
      ctx.fillStyle = "rgba(7,12,33,.4)";
      ctx.fillRect(x + 44, 118, 72, 252);
      ctx.beginPath();
      ctx.moveTo(x + 44, 118);
      ctx.quadraticCurveTo(x + 80, 62, x + 116, 118);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, 0);
    ctx.strokeStyle = "rgba(255,214,107,.18)";
    ctx.lineWidth = 2;
    for (let x = 90; x < worldWidth; x += 230) {
      ctx.beginPath();
      ctx.moveTo(x, 140); ctx.lineTo(x + 16, 124); ctx.lineTo(x + 32, 140); ctx.lineTo(x + 16, 156); ctx.closePath(); ctx.stroke();
    }
    platforms.forEach((platform) => {
      ctx.fillStyle = colors.stone;
      roundedRect(platform.x, platform.y, platform.w, platform.h + 8, 7);
      ctx.fill();
      ctx.fillStyle = colors.stoneTop;
      ctx.fillRect(platform.x + 4, platform.y, platform.w - 8, 5);
    });
    hazards.forEach((hazard) => {
      ctx.fillStyle = colors.hazard;
      ctx.shadowColor = colors.hazard;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(hazard.x, hazard.y + hazard.h);
      for (let x = 0; x <= hazard.w; x += 12) ctx.lineTo(hazard.x + x, hazard.y + 5 + Math.sin(performance.now() / 230 + x / 13) * 5);
      ctx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    challenges.forEach(drawChallenge);
    drawPortal();
    drawPlayer(player);
    ctx.restore();
  }

  function drawChallenge(challenge, index) {
    const pulse = .65 + Math.sin(performance.now() / 430 + index) * .2;
    ctx.save();
    ctx.translate(challenge.consoleX, 0);
    ctx.fillStyle = "#202a50";
    roundedRect(-20, 486, 52, 59, 8);
    ctx.fill();
    ctx.fillStyle = challenge.solved ? colors.good : colors.gold;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12 * pulse;
    ctx.beginPath();
    ctx.arc(6, 500, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#081127";
    ctx.font = "800 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(challenge.solved ? "✓" : String(index + 1), 6, 504);
    ctx.restore();
    ctx.save();
    ctx.translate(challenge.gateX, challenge.solved ? -262 : 0);
    ctx.fillStyle = challenge.solved ? "rgba(95,225,165,.38)" : "#3b4774";
    ctx.fillRect(0, 190, 35, 355);
    ctx.fillStyle = challenge.solved ? colors.good : colors.gold;
    ctx.fillRect(5, 190, 3, 355);
    ctx.fillRect(27, 190, 3, 355);
    ctx.beginPath();
    ctx.arc(17.5, 224, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPortal() {
    const color = heroes[player.type].color;
    const pulse = 1 + Math.sin(performance.now() / 270) * .08;
    ctx.save();
    ctx.translate(portal.x + 18, portal.y + 34);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.shadowColor = color;
    ctx.shadowBlur = portal.occupied ? 28 : 17;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = .22;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(activePlayer) {
    const hero = heroes[activePlayer.type];
    const color = hero.color;
    const x = activePlayer.x;
    const y = activePlayer.y + (activePlayer.onGround ? Math.abs(Math.sin(activePlayer.step)) * 2 : 0);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = hero.dark;
    roundedRect(x + 2, y + 9, activePlayer.w - 4, activePlayer.h - 9, 10);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + 15, y + 13, 13, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x + 11, y + 11, 3.2, 0, Math.PI * 2); ctx.arc(x + 20, y + 11, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#11162d";
    ctx.beginPath(); ctx.arc(x + 12, y + 11.5, 1.45, 0, Math.PI * 2); ctx.arc(x + 21, y + 11.5, 1.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    if (activePlayer.type === "fire") {
      ctx.moveTo(x + 8, y + 4); ctx.lineTo(x + 15, y - 9); ctx.lineTo(x + 18, y + 5); ctx.lineTo(x + 25, y - 5); ctx.lineTo(x + 24, y + 8);
    } else if (activePlayer.type === "water") {
      ctx.moveTo(x + 7, y + 5); ctx.quadraticCurveTo(x + 15, y - 12, x + 24, y + 5);
    } else if (activePlayer.type === "spark") {
      ctx.moveTo(x + 15, y - 10); ctx.lineTo(x + 19, y + 1); ctx.lineTo(x + 29, y + 4); ctx.lineTo(x + 20, y + 8); ctx.lineTo(x + 15, y + 18); ctx.lineTo(x + 11, y + 8); ctx.lineTo(x + 1, y + 4); ctx.lineTo(x + 11, y + 1);
    } else {
      ctx.moveTo(x + 5, y + 7); ctx.quadraticCurveTo(x + 13, y - 10, x + 27, y - 5); ctx.quadraticCurveTo(x + 26, y + 8, x + 11, y + 12);
    }
    ctx.fill();
    if (!activePlayer.atGoal) {
      ctx.fillStyle = colors.gold;
      ctx.beginPath(); ctx.moveTo(x + 10, y - 18); ctx.lineTo(x + 20, y - 18); ctx.lineTo(x + 15, y - 11); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawWorld();
    if (running && challenges.every((challenge) => challenge.solved)) {
      ctx.fillStyle = "rgba(9,13,32,.76)";
      roundedRect(390, 18, 320, 42, 12);
      ctx.fill();
      ctx.fillStyle = "#eef2ff";
      ctx.font = "700 15px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Все двери открыты — найди портал!", 550, 44);
    }
  }

  function loop(time) {
    const dt = Math.min(.032, (time - lastTime) / 1000 || 0);
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function handleKeyDown(event) {
    const gameKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyW", "KeyE"];
    if (gameKeys.includes(event.code)) event.preventDefault();
    keys[event.code] = true;
    if (event.code === "KeyE" && !event.repeat) openChallenge();
  }
  function handleKeyUp(event) {
    keys[event.code] = false;
    if (["ArrowUp", "KeyW", "Space"].includes(event.code)) keys.jumpLock = false;
  }
  window.addEventListener("keydown", handleKeyDown, { passive: false });
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", () => {
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    keys.jumpLock = false;
  });

  ui.startButton.addEventListener("click", () => resetGame({ start: true }));
  ui.restartButton.addEventListener("click", () => resetGame({ start: true }));
  ui.mobileSolve.addEventListener("click", () => openChallenge());
  ui.tryAgainButton.addEventListener("click", () => resetGame({ start: true }));
  ui.chooseLevelButton.addEventListener("click", goToLevelMap);
  ui.nextLevelButton.addEventListener("click", () => {
    if (currentLevelIndex < levels.length - 1) currentLevelIndex += 1;
    resetGame({ start: true });
  });

  ui.heroChoices.forEach((choice) => {
    choice.addEventListener("click", () => {
      selectedHero = choice.dataset.hero;
      player = makePlayer(selectedHero);
      ui.heroChoices.forEach((item) => {
        const selected = item === choice;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      saveProgress();
      updateHud();
      beep(heroes[selectedHero].tone, .08, "triangle", .02);
    });
  });

  ui.soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    ui.soundButton.setAttribute("aria-pressed", String(soundOn));
    ui.soundButton.setAttribute("aria-label", soundOn ? "Выключить звук" : "Включить звук");
    ui.soundButton.textContent = soundOn ? "♪" : "×";
    if (soundOn) beep(520, .08, "sine", .025);
  });

  ui.challengeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.submitter?.value === "cancel") {
      ui.challengeDialog.close();
      currentChallenge = null;
      paused = false;
      canvas.focus();
    }
  });
  ui.challengeDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    ui.challengeDialog.close();
    currentChallenge = null;
    paused = false;
    canvas.focus();
  });
  ui.hintButton.addEventListener("click", () => {
    ui.hintBox.hidden = !ui.hintBox.hidden;
    ui.hintButton.textContent = ui.hintBox.hidden ? "Показать подсказку" : "Скрыть подсказку";
  });

  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    const key = control === "left" ? "touchLeft" : control === "right" ? "touchRight" : "touchJump";
    const press = (event) => { event.preventDefault(); keys[key] = true; button.classList.add("pressed"); };
    const release = (event) => { event.preventDefault(); keys[key] = false; if (key === "touchJump") keys.jumpLock = false; button.classList.remove("pressed"); };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  function registerWebMcp() {
    const modelContext = document.modelContext;
    if (!modelContext?.registerTool) return;
    const register = (tool) => {
      try { void Promise.resolve(modelContext.registerTool(tool)).catch(() => {}); } catch (_) {}
    };
    register({
      name: "get_game_status",
      title: "Узнать состояние игры",
      description: "Показывает тему, уровень, героя, жизни и решённые задания.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({
        topic: "Степени", level: currentLevelIndex + 1,
        levelTitle: levels[currentLevelIndex].title,
        completedLevels: [...completedLevels].map((index) => index + 1),
        activeHeroName: heroes[player.type].name, lives,
        solvedChallenges: challenges.map((challenge) => challenge.solved),
        nearbyChallenge: nearestChallenge() + 1 || null,
        finished: player.atGoal, lastDeath
      })
    });
    register({
      name: "submit_math_answer",
      title: "Ответить на математическую задачу",
      description: "Проверяет текст выбранного варианта ответа в текущем уровне.",
      inputSchema: {
        type: "object",
        properties: {
          challenge: { type: "integer", minimum: 1, maximum: 6 },
          answer: { type: "string", minLength: 1 }
        },
        required: ["challenge", "answer"], additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !Number.isInteger(input.challenge) || typeof input.answer !== "string") throw new Error("Нужны номер задания и ответ.");
        const index = input.challenge - 1;
        if (!challenges[index]) throw new Error("В текущем уровне нет задания с таким номером.");
        if (challenges[index].solved) return { correct: true, alreadySolved: true, challenge: input.challenge };
        if (index > 0 && !challenges[index - 1].solved) throw new Error("Сначала пройдите предыдущее задание.");
        openChallenge(index);
        return submitTextAnswer(input.answer);
      }
    });
  }

  loadProgress();
  buildLevel(currentLevelIndex);
  renderLevelPicker();
  updateStartButton();
  ui.heroChoices.forEach((choice) => {
    const selected = choice.dataset.hero === selectedHero;
    choice.classList.toggle("selected", selected);
    choice.setAttribute("aria-pressed", String(selected));
  });
  updateHud();
  draw();
  registerWebMcp();
  requestAnimationFrame(loop);
})();
