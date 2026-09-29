(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const ui = {
    startScreen: document.getElementById("startScreen"),
    startButton: document.getElementById("startButton"),
    heroName: document.getElementById("heroName"),
    progressText: document.getElementById("progressText"),
    livesText: document.getElementById("livesText"),
    missionText: document.getElementById("missionText"),
    actionPrompt: document.getElementById("actionPrompt"),
    toast: document.getElementById("toast"),
    soundButton: document.getElementById("soundButton"),
    restartButton: document.getElementById("restartButton"),
    mobileSolve: document.getElementById("mobileSolve"),
    heroChoices: [...document.querySelectorAll(".hero-choice")],
    challengeDialog: document.getElementById("challengeDialog"),
    challengeForm: document.getElementById("challengeForm"),
    challengeNumber: document.getElementById("challengeNumber"),
    challengeTitle: document.getElementById("challengeTitle"),
    challengeQuestion: document.getElementById("challengeQuestion"),
    challengeIcon: document.getElementById("challengeIcon"),
    answerInput: document.getElementById("answerInput"),
    answerFeedback: document.getElementById("answerFeedback"),
    hintButton: document.getElementById("hintButton"),
    hintBox: document.getElementById("hintBox"),
    resultDialog: document.getElementById("resultDialog"),
    resultLives: document.getElementById("resultLives"),
    playAgainButton: document.getElementById("playAgainButton"),
    failDialog: document.getElementById("failDialog"),
    tryAgainButton: document.getElementById("tryAgainButton")
  };

  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;
  const WORLD_W = 2360;
  const FLOOR_Y = 545;
  const keys = Object.create(null);
  let audioContext = null;
  let soundOn = true;
  let running = false;
  let paused = true;
  let selectedHero = "fire";
  let lives = 3;
  let cameraX = 0;
  let currentChallenge = null;
  let toastTimer = null;
  let lastTime = 0;
  let lastDeath = null;

  const colors = {
    fire: "#ff8154",
    fireDark: "#b94225",
    water: "#54d7ff",
    waterDark: "#187ca8",
    spark: "#c891ff",
    sparkDark: "#6f43aa",
    leaf: "#65e69d",
    leafDark: "#27875a",
    gold: "#ffd66b",
    stone: "#29345f",
    stoneTop: "#465586",
    good: "#5fe1a5"
  };

  const heroProfiles = {
    fire: { name: "Огонёк", color: colors.fire, dark: colors.fireDark, tone: 350 },
    water: { name: "Капелька", color: colors.water, dark: colors.waterDark, tone: 470 },
    spark: { name: "Искорка", color: colors.spark, dark: colors.sparkDark, tone: 560 },
    leaf: { name: "Листик", color: colors.leaf, dark: colors.leafDark, tone: 420 }
  };

  const challenges = [
    {
      title: "Зал порядка",
      question: "Вычисли: (84 − 36) ÷ 6",
      answers: ["8"],
      hint: "Сначала выполни действие в скобках: 84 − 36. Затем раздели результат на 6.",
      icon: "⌁",
      solved: false,
      gateX: 665,
      consoleX: 545
    },
    {
      title: "Галерея дробей",
      question: "Сложи дроби: 3/4 + 1/8",
      answers: ["7/8", "0.875", "0,875"],
      hint: "Приведи дроби к знаменателю 8: 3/4 = 6/8. Теперь сложи числители.",
      icon: "⅞",
      solved: false,
      gateX: 1295,
      consoleX: 1175
    },
    {
      title: "Башня процентов",
      question: "В сундуке 200 кристаллов. 15% засветились. Сколько это кристаллов?",
      answers: ["30", "30 кристаллов"],
      hint: "Найди 10% от 200, затем 5% и сложи полученные числа.",
      icon: "%",
      solved: false,
      gateX: 1880,
      consoleX: 1760
    }
  ];

  const platforms = [
    { x: 0, y: FLOOR_Y, w: 2360, h: 75 },
    { x: 245, y: 445, w: 170, h: 22 },
    { x: 760, y: 440, w: 210, h: 22 },
    { x: 990, y: 360, w: 135, h: 22 },
    { x: 1390, y: 445, w: 170, h: 22 },
    { x: 1590, y: 370, w: 150, h: 22 },
    { x: 1990, y: 430, w: 250, h: 22 }
  ];

  const hazards = [
    { x: 425, y: 530, w: 90, h: 18, type: "water" },
    { x: 785, y: 530, w: 105, h: 18, type: "fire" },
    { x: 1045, y: 530, w: 92, h: 18, type: "water" },
    { x: 1485, y: 530, w: 110, h: 18, type: "fire" },
    { x: 2040, y: 530, w: 88, h: 18, type: "water" }
  ];

  const portal = { x: 2250, y: 477, occupied: false };

  function makePlayer(type, x) {
    return {
      type,
      x,
      y: FLOOR_Y - 44,
      w: 30,
      h: 44,
      vx: 0,
      vy: 0,
      onGround: false,
      checkpointX: x,
      atGoal: false,
      invulnerableUntil: 0,
      step: 0
    };
  }

  let player = makePlayer(selectedHero, 105);

  function resetGame({ start = true } = {}) {
    challenges.forEach((challenge) => { challenge.solved = false; });
    portal.occupied = false;
    player = makePlayer(selectedHero, 105);
    lives = 3;
    cameraX = 0;
    currentChallenge = null;
    lastDeath = null;
    running = start;
    paused = !start;
    ui.resultDialog.close?.();
    ui.failDialog.close?.();
    if (ui.challengeDialog.open) ui.challengeDialog.close();
    ui.startScreen.hidden = start;
    updateHud();
    showToast(start ? "Найди первый светящийся пульт" : "", false);
    if (start) {
      canvas.focus();
      lastTime = performance.now();
    }
  }

  function updateHud() {
    const hero = heroProfiles[player.type];
    ui.heroName.innerHTML = `<span class="hero-dot ${player.type}" style="color:${hero.color};background:currentColor"></span> ${hero.name}`;
    const solved = challenges.filter((challenge) => challenge.solved).length;
    ui.progressText.textContent = `${solved} / 3`;
    ui.livesText.textContent = Array.from({ length: 3 }, (_, index) => index < lives ? "♥" : "♡").join(" ");
    ui.livesText.setAttribute("aria-label", `${lives} ${plural(lives, "жизнь", "жизни", "жизней")}`);
    document.querySelectorAll(".gate-step").forEach((step, index) => step.classList.toggle("done", challenges[index].solved));
  }

  function plural(number, one, few, many) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function showToast(message, danger = false) {
    clearTimeout(toastTimer);
    if (!message) {
      ui.toast.hidden = true;
      return;
    }
    ui.toast.textContent = message;
    ui.toast.classList.toggle("danger", danger);
    ui.toast.hidden = false;
    toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 2600);
  }

  function beep(frequency, duration = 0.12, type = "sine", gain = 0.04) {
    if (!soundOn) return;
    try {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(gain, audioContext.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(volume).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_) {
      soundOn = false;
    }
  }

  function nearestChallenge() {
    return challenges.findIndex((challenge) => !challenge.solved && Math.abs((player.x + player.w / 2) - challenge.consoleX) < 76 && Math.abs(player.y - (FLOOR_Y - player.h)) < 100);
  }

  function openChallenge(index = nearestChallenge()) {
    if (index < 0 || !running || paused) return false;
    const challenge = challenges[index];
    currentChallenge = index;
    paused = true;
    ui.challengeNumber.textContent = `Испытание ${index + 1} из 3`;
    ui.challengeTitle.textContent = challenge.title;
    ui.challengeQuestion.textContent = challenge.question;
    ui.challengeIcon.textContent = challenge.icon;
    ui.answerInput.value = "";
    ui.answerInput.removeAttribute("aria-invalid");
    ui.answerFeedback.textContent = "";
    ui.answerFeedback.className = "feedback";
    ui.hintBox.textContent = challenge.hint;
    ui.hintBox.hidden = true;
    ui.hintButton.textContent = "Показать подсказку";
    if (!ui.challengeDialog.open) ui.challengeDialog.showModal();
    requestAnimationFrame(() => ui.answerInput.focus());
    return true;
  }

  function normalizeAnswer(value) {
    return String(value).trim().toLowerCase().replace(/\s+/g, " ").replace(/÷/g, "/");
  }

  function submitAnswer(value) {
    if (currentChallenge === null) return { correct: false, reason: "Нет открытого испытания" };
    const challenge = challenges[currentChallenge];
    const answer = normalizeAnswer(value);
    if (!answer) {
      ui.answerFeedback.textContent = "Сначала введи ответ.";
      ui.answerFeedback.className = "feedback bad";
      ui.answerInput.setAttribute("aria-invalid", "true");
      return { correct: false, reason: "Пустой ответ" };
    }
    const correct = challenge.answers.some((accepted) => normalizeAnswer(accepted) === answer);
    if (!correct) {
      ui.answerFeedback.textContent = "Пока не сходится. Проверь вычисления или возьми подсказку.";
      ui.answerFeedback.className = "feedback bad";
      ui.answerInput.setAttribute("aria-invalid", "true");
      beep(150, .17, "sawtooth", .025);
      return { correct: false, challenge: currentChallenge + 1 };
    }

    challenge.solved = true;
    ui.answerInput.removeAttribute("aria-invalid");
    ui.answerFeedback.textContent = "Верно! Древняя дверь открывается.";
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
      showToast(`Испытание ${solvedIndex + 1} пройдено — путь открыт!`);
    }, 720);
    return { correct: true, challenge: solvedIndex + 1, solved: challenges.filter((item) => item.solved).length };
  }

  function loseLife(player, message) {
    if (player.atGoal) return;
    if (performance.now() < player.invulnerableUntil) return;
    player.invulnerableUntil = performance.now() + 900;
    lastDeath = { type: player.type, x: Math.round(player.x), y: Math.round(player.y), message };
    lives -= 1;
    updateHud();
    beep(110, .23, "square", .025);
    if (lives <= 0) {
      running = false;
      paused = true;
      setTimeout(() => { if (!ui.failDialog.open) ui.failDialog.showModal(); }, 200);
      return;
    }
    player.x = player.checkpointX;
    player.y = FLOOR_Y - player.h;
    player.vx = 0;
    player.vy = 0;
    showToast(message, true);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function updatePlayer(player, dt) {
    if (player.atGoal) return;
    const speed = 250;
    const jump = 560;
    const left = keys.ArrowLeft || keys.KeyA || keys.touchLeft;
    const right = keys.ArrowRight || keys.KeyD || keys.touchRight;
    player.vx = left === right ? player.vx * .76 : (left ? -speed : speed);
    if ((keys.ArrowUp || keys.KeyW || keys.Space || keys.touchJump) && player.onGround && !keys.jumpLock) {
      player.vy = -jump;
      player.onGround = false;
      keys.jumpLock = true;
      beep(heroProfiles[player.type].tone, .08, "triangle", .018);
    }

    player.vy += 1400 * dt;
    player.vx = Math.max(-speed, Math.min(speed, player.vx));
    const oldX = player.x;
    const oldY = player.y;
    player.x += player.vx * dt;
    player.x = Math.max(4, Math.min(WORLD_W - player.w - 4, player.x));

    for (const challenge of challenges) {
      if (challenge.solved) continue;
      const door = { x: challenge.gateX, y: 190, w: 35, h: FLOOR_Y - 190 };
      if (rectsOverlap(player, door)) {
        player.x = oldX;
        player.vx = 0;
      }
    }

    player.y += player.vy * dt;
    player.onGround = false;
    for (const platform of platforms) {
      if (!rectsOverlap(player, platform)) continue;
      if (oldY + player.h <= platform.y + 8 && player.vy >= 0) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if (oldY >= platform.y + platform.h - 5 && player.vy < 0) {
        player.y = platform.y + platform.h;
        player.vy = 0;
      } else if (oldX + player.w <= platform.x + 5) {
        player.x = platform.x - player.w;
        player.vx = 0;
      } else if (oldX >= platform.x + platform.w - 5) {
        player.x = platform.x + platform.w;
        player.vx = 0;
      }
    }

    if (player.y > VIEW_H + 100) loseLife(player, "Осторожно, здесь обрыв!");

    for (const hazard of hazards) {
      if (!rectsOverlap(player, hazard)) continue;
      loseLife(player, "Осторожно, энергетическая ловушка! Перепрыгни её.");
    }

    challenges.forEach((challenge) => {
      if (challenge.solved && player.x > challenge.gateX + 55) {
        player.checkpointX = Math.max(player.checkpointX, challenge.gateX + 70);
      }
    });

    const portalRect = { x: portal.x - 7, y: portal.y - 8, w: 50, h: 76 };
    if (rectsOverlap(player, portalRect) && challenges.every((challenge) => challenge.solved)) {
      player.atGoal = true;
      portal.occupied = true;
      player.vx = 0;
      player.vy = 0;
      player.x = portal.x + 4;
      player.y = FLOOR_Y - player.h;
      beep(heroProfiles[player.type].tone + 370, .2, "sine", .04);
      finishLevel();
    }

    if (Math.abs(player.vx) > 20 && player.onGround) player.step += dt * 9;
  }

  function finishLevel() {
    running = false;
    paused = true;
    ui.resultLives.textContent = String(lives);
    ui.missionText.innerHTML = "<strong>Готово:</strong> портал найден!";
    setTimeout(() => { if (!ui.resultDialog.open) ui.resultDialog.showModal(); }, 350);
  }

  function update(dt) {
    if (!running || paused) return;
    updatePlayer(player, dt);
    const targetCamera = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x - VIEW_W * .42));
    cameraX += (targetCamera - cameraX) * Math.min(1, dt * 5);
    const near = nearestChallenge();
    ui.actionPrompt.hidden = near < 0;
    ui.mobileSolve.disabled = near < 0;
  }

  function drawRoundedRect(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
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
      ctx.fillStyle = "rgba(86, 104, 165, .09)";
      ctx.fillRect(x + 25, 86, 110, 390);
      ctx.fillStyle = "rgba(7, 12, 33, .4)";
      ctx.fillRect(x + 44, 118, 72, 252);
      ctx.beginPath();
      ctx.moveTo(x + 44, 118);
      ctx.quadraticCurveTo(x + 80, 62, x + 116, 118);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-cameraX * .28, 0);
    for (let i = 0; i < 17; i += 1) {
      const x = 70 + i * 155;
      const y = 80 + (i % 4) * 70;
      ctx.fillStyle = i % 2 ? "rgba(84, 215, 255, .12)" : "rgba(255, 129, 84, .1)";
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, 0);

    ctx.strokeStyle = "rgba(255, 214, 107, .18)";
    ctx.lineWidth = 2;
    for (let x = 90; x < WORLD_W; x += 230) {
      ctx.beginPath();
      ctx.moveTo(x, 140);
      ctx.lineTo(x + 16, 124);
      ctx.lineTo(x + 32, 140);
      ctx.lineTo(x + 16, 156);
      ctx.closePath();
      ctx.stroke();
    }

    platforms.forEach((platform) => {
      ctx.fillStyle = colors.stone;
      drawRoundedRect(platform.x, platform.y, platform.w, platform.h + 8, 7);
      ctx.fill();
      ctx.fillStyle = colors.stoneTop;
      ctx.fillRect(platform.x + 4, platform.y, platform.w - 8, 5);
      ctx.strokeStyle = "rgba(9, 13, 32, .48)";
      ctx.lineWidth = 2;
      for (let x = platform.x + 28; x < platform.x + platform.w; x += 58) {
        ctx.beginPath();
        ctx.moveTo(x, platform.y + 7);
        ctx.lineTo(x - 11, platform.y + 22);
        ctx.stroke();
      }
    });

    hazards.forEach((hazard) => {
      const color = hazard.type === "fire" ? colors.fire : colors.water;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(hazard.x, hazard.y + hazard.h);
      for (let x = 0; x <= hazard.w; x += 12) {
        ctx.lineTo(hazard.x + x, hazard.y + 5 + Math.sin((performance.now() / 230) + x / 13) * 5);
      }
      ctx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    challenges.forEach((challenge, index) => drawChallenge(challenge, index));
    drawPortal(portal);
    drawPlayer(player);
    ctx.restore();
  }

  function drawChallenge(challenge, index) {
    const pulse = .65 + Math.sin(performance.now() / 430 + index) * .2;
    ctx.save();
    ctx.translate(challenge.consoleX, 0);
    ctx.fillStyle = "#202a50";
    drawRoundedRect(-20, 486, 52, 59, 8);
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

    const lift = challenge.solved ? 262 : 0;
    ctx.save();
    ctx.translate(challenge.gateX, -lift);
    ctx.fillStyle = challenge.solved ? "rgba(95, 225, 165, .38)" : "#3b4774";
    ctx.fillRect(0, 190, 35, 355);
    ctx.fillStyle = challenge.solved ? colors.good : colors.gold;
    ctx.fillRect(5, 190, 3, 355);
    ctx.fillRect(27, 190, 3, 355);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = challenge.solved ? 16 : 7;
    ctx.beginPath();
    ctx.arc(17.5, 224, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPortal(portal) {
    const color = heroProfiles[player.type].color;
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

  function drawPlayer(player) {
    const hero = heroProfiles[player.type];
    const color = hero.color;
    const dark = hero.dark;
    const bounce = player.onGround ? Math.abs(Math.sin(player.step)) * 2 : 0;
    const x = player.x;
    const y = player.y + bounce;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = dark;
    drawRoundedRect(x + 2, y + 9, player.w - 4, player.h - 9, 10);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + player.w / 2, y + 13, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + 11, y + 11, 3.2, 0, Math.PI * 2);
    ctx.arc(x + 20, y + 11, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#11162d";
    ctx.beginPath();
    ctx.arc(x + 12, y + 11.5, 1.45, 0, Math.PI * 2);
    ctx.arc(x + 21, y + 11.5, 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    if (player.type === "fire") {
      ctx.moveTo(x + 8, y + 4);
      ctx.lineTo(x + 15, y - 9);
      ctx.lineTo(x + 18, y + 5);
      ctx.lineTo(x + 25, y - 5);
      ctx.lineTo(x + 24, y + 8);
    } else if (player.type === "water") {
      ctx.moveTo(x + 7, y + 5);
      ctx.quadraticCurveTo(x + 15, y - 12, x + 24, y + 5);
    } else if (player.type === "spark") {
      ctx.moveTo(x + 15, y - 10);
      ctx.lineTo(x + 19, y + 1);
      ctx.lineTo(x + 29, y + 4);
      ctx.lineTo(x + 20, y + 8);
      ctx.lineTo(x + 15, y + 18);
      ctx.lineTo(x + 11, y + 8);
      ctx.lineTo(x + 1, y + 4);
      ctx.lineTo(x + 11, y + 1);
    } else {
      ctx.moveTo(x + 5, y + 7);
      ctx.quadraticCurveTo(x + 13, y - 10, x + 27, y - 5);
      ctx.quadraticCurveTo(x + 26, y + 8, x + 11, y + 12);
    }
    ctx.fill();
    if (!player.atGoal) {
      ctx.fillStyle = colors.gold;
      ctx.beginPath();
      ctx.moveTo(x + 10, y - 18);
      ctx.lineTo(x + 20, y - 18);
      ctx.lineTo(x + 15, y - 11);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawWorld();
    if (running && challenges.every((challenge) => challenge.solved)) {
      ctx.fillStyle = "rgba(9, 13, 32, .76)";
      drawRoundedRect(390, 18, 320, 42, 12);
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
  ui.playAgainButton.addEventListener("click", () => resetGame({ start: true }));
  ui.tryAgainButton.addEventListener("click", () => resetGame({ start: true }));

  ui.heroChoices.forEach((choice) => {
    choice.addEventListener("click", () => {
      selectedHero = choice.dataset.hero;
      player = makePlayer(selectedHero, 105);
      ui.heroChoices.forEach((item) => {
        const selected = item === choice;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      ui.startButton.textContent = `Играть за ${heroProfiles[selectedHero].name === "Капелька" || heroProfiles[selectedHero].name === "Искорка" ? heroProfiles[selectedHero].name.slice(0, -1) + "у" : heroProfiles[selectedHero].name + "а"}`;
      updateHud();
      beep(heroProfiles[selectedHero].tone, .08, "triangle", .02);
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
    const submitter = event.submitter;
    if (submitter?.value === "cancel") {
      ui.challengeDialog.close();
      currentChallenge = null;
      paused = false;
      canvas.focus();
      return;
    }
    submitAnswer(ui.answerInput.value);
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
    const press = (event) => {
      event.preventDefault();
      keys[key] = true;
      button.classList.add("pressed");
    };
    const release = (event) => {
      event.preventDefault();
      keys[key] = false;
      if (key === "touchJump") keys.jumpLock = false;
      button.classList.remove("pressed");
    };
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
      description: "Показывает активного героя, число жизней, решённые испытания и ближайшую доступную задачу.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        return {
          activeHero: player.type,
          activeHeroName: heroProfiles[player.type].name,
          lives,
          solvedChallenges: challenges.map((challenge) => challenge.solved),
          nearbyChallenge: nearestChallenge() + 1 || null,
          finished: player.atGoal,
          player: {
            type: player.type,
            x: Math.round(player.x),
            y: Math.round(player.y),
            checkpointX: player.checkpointX
          },
          lastDeath
        };
      }
    });
    register({
      name: "submit_math_answer",
      title: "Ответить на математическую задачу",
      description: "Открывает указанное доступное испытание и проверяет ответ так же, как форма в игре.",
      inputSchema: {
        type: "object",
        properties: {
          challenge: { type: "integer", minimum: 1, maximum: 3 },
          answer: { type: "string", minLength: 1 }
        },
        required: ["challenge", "answer"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !Number.isInteger(input.challenge) || typeof input.answer !== "string") throw new Error("Нужны номер испытания и ответ.");
        const index = input.challenge - 1;
        if (challenges[index].solved) return { correct: true, alreadySolved: true, challenge: input.challenge };
        if (index > 0 && !challenges[index - 1].solved) throw new Error("Сначала пройдите предыдущее испытание.");
        openChallenge(index);
        return submitAnswer(input.answer);
      }
    });
  }

  updateHud();
  draw();
  registerWebMcp();
  requestAnimationFrame(loop);
})();
