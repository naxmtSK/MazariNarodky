(() => {
  "use strict";

  // =====================================================================
  //  Stav hry + uloženie postupu
  // =====================================================================

  const WORDS = { 1: "FINANČNÁ", 2: "CESTA" };

  // ktorá hra dáva ktoré písmená (indexy v slove kapitoly)
  const GAMES = {
    trezor:   { chapter: 1, letters: [0, 1, 2] },    // F I N
    graf:     { chapter: 1, letters: [3, 4, 5] },    // A N Č
    mince:    { chapter: 1, letters: [6, 7] },       // N Á
    bludisko: { chapter: 2, letters: [0, 1, 2] },    // C E S
    pexeso:   { chapter: 2, letters: [3, 4] }        // T A
  };

  const SAVE_KEY = "martin-escape-v2";

  let state = load() || {
    solved: {},          // { trezor: true, ... }
    gate1: false,
    gate2: false
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); }
    catch { return null; }
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
  }

  function currentChapter() { return state.gate1 ? 2 : 1; }

  function chapterLetters(ch) {
    // vráti pole [ { char, earned } ] pre slovo kapitoly
    const word = WORDS[ch];
    const earned = new Array(word.length).fill(false);
    Object.entries(GAMES).forEach(([id, g]) => {
      if (g.chapter === ch && state.solved[id]) {
        g.letters.forEach((i) => { earned[i] = true; });
      }
    });
    return word.split("").map((char, i) => ({ char, earned: earned[i] }));
  }

  function chapterComplete(ch) {
    return chapterLetters(ch).every((l) => l.earned);
  }

  // =====================================================================
  //  Zvuky (Web Audio – žiadne súbory)
  // =====================================================================

  let audioCtx = null;

  function ctx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  function tone(freq, dur = 0.18, type = "triangle", vol = 0.22, when = 0) {
    const c = ctx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = c.currentTime + when;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const sfx = {
    tap:  () => tone(660, 0.08, "sine", 0.15),
    good: () => { tone(523, 0.14); tone(784, 0.18, "triangle", 0.22, 0.1); },
    bad:  () => tone(160, 0.25, "sawtooth", 0.12),
    coin: () => { tone(988, 0.07, "square", 0.08); tone(1319, 0.12, "square", 0.08, 0.06); },
    win:  () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, "triangle", 0.22, i * 0.13)),
    fanfare: () => [392, 523, 659, 784, 659, 784, 1047, 1319]
      .forEach((f, i) => tone(f, 0.32, "triangle", 0.22, i * 0.16))
  };

  // =====================================================================
  //  Navigácia medzi obrazovkami
  // =====================================================================

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  function show(id) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  $("#btn-start").addEventListener("click", () => {
    sfx.tap();
    show("#screen-map");
    renderMap();
  });

  $$("[data-close]").forEach((b) =>
    b.addEventListener("click", () => {
      stopMince();
      show("#screen-map");
      renderMap();
    })
  );

  $("#btn-reset").addEventListener("click", () => {
    if (confirm("Naozaj začať celú hru odznova?")) {
      state = { solved: {}, gate1: false, gate2: false };
      save();
      renderMap();
    }
  });

  $("#btn-replay").addEventListener("click", () => {
    state = { solved: {}, gate1: false, gate2: false };
    save();
    stopConfetti();
    show("#screen-intro");
  });

  // =====================================================================
  //  Mapa
  // =====================================================================

  function renderMap() {
    const ch = currentChapter();
    $("#chapter-label").textContent =
      ch === 1 ? "1. brána – poskladaj prvé heslo" : "2. brána – poskladaj druhé heslo";

    const slotsEl = $("#map-slots");
    slotsEl.innerHTML = "";
    chapterLetters(ch).forEach((l) => {
      const d = document.createElement("div");
      d.className = "slot" + (l.earned ? " filled" : "");
      d.textContent = l.earned ? l.char : "";
      slotsEl.appendChild(d);
    });

    Object.entries(GAMES).forEach(([id, g]) => {
      const el = $("#st-" + id);
      el.classList.toggle("done", !!state.solved[id]);
      el.classList.toggle("locked", g.chapter === 2 && !state.gate1);
    });

    const g1 = $("#st-gate1");
    g1.classList.toggle("done", state.gate1);
    g1.classList.toggle("locked", !chapterComplete(1) && !state.gate1);
    g1.textContent = state.gate1 ? "🔓" : "🔒";

    const g2 = $("#st-gate2");
    g2.classList.toggle("locked", !state.gate1 || !chapterComplete(2));
  }

  Object.keys(GAMES).forEach((id) => {
    $("#st-" + id).addEventListener("click", () => {
      const g = GAMES[id];
      if (g.chapter === 2 && !state.gate1) { sfx.bad(); return; }
      if (state.solved[id]) { sfx.tap(); return; }
      sfx.tap();
      openGame(id);
    });
  });

  $("#st-gate1").addEventListener("click", () => {
    if (state.gate1 || !chapterComplete(1)) { sfx.bad(); return; }
    sfx.tap();
    openGate(1);
  });

  $("#st-gate2").addEventListener("click", () => {
    if (!state.gate1 || !chapterComplete(2)) { sfx.bad(); return; }
    sfx.tap();
    openGate(2);
  });

  // =====================================================================
  //  Výhra v mini hre
  // =====================================================================

  let pendingWin = null;

  function gameWon(id) {
    state.solved[id] = true;
    save();
    sfx.win();

    const g = GAMES[id];
    const word = WORDS[g.chapter];
    const lettersEl = $("#win-letters");
    lettersEl.innerHTML = "";
    g.letters.forEach((i) => {
      const d = document.createElement("div");
      d.className = "win-letter";
      d.textContent = word[i];
      lettersEl.appendChild(d);
    });
    pendingWin = id;
    $("#win-overlay").classList.add("active");
  }

  $("#btn-win-ok").addEventListener("click", () => {
    $("#win-overlay").classList.remove("active");
    pendingWin = null;
    show("#screen-map");
    renderMap();
  });

  function openGame(id) {
    if (id === "trezor") startTrezor();
    else if (id === "graf") startGraf();
    else if (id === "mince") openMince();
    else if (id === "bludisko") startBludisko();
    else if (id === "pexeso") startPexeso();
    show("#screen-" + id);
  }

  // =====================================================================
  //  MINI HRA 1: Trezor (Simon)
  // =====================================================================

  const PAD_FREQ = [392, 494, 587, 330];
  const TREZOR_ROUNDS = 3;
  let tzSeq = [], tzInput = [], tzRound = 0, tzBusy = false;

  function startTrezor() {
    tzSeq = [];
    tzRound = 0;
    nextTrezorRound();
  }

  function nextTrezorRound() {
    tzRound += 1;
    tzInput = [];
    tzSeq.push(Math.floor(Math.random() * 4));
    // v 1. kole sú 2 svetlá, potom +1
    if (tzRound === 1) tzSeq.push(Math.floor(Math.random() * 4));
    $("#trezor-status").textContent = `Kolo ${tzRound} / ${TREZOR_ROUNDS}`;
    $("#trezor-hint").textContent = "Sleduj svetlá…";
    playTrezorSeq();
  }

  function playTrezorSeq() {
    tzBusy = true;
    tzSeq.forEach((p, i) => {
      setTimeout(() => flashPad(p), 600 + i * 650);
    });
    setTimeout(() => {
      tzBusy = false;
      $("#trezor-hint").textContent = "Teraz ty – zopakuj poradie!";
    }, 600 + tzSeq.length * 650);
  }

  function flashPad(p) {
    const el = $(`.pad[data-pad="${p}"]`);
    el.classList.add("lit");
    tone(PAD_FREQ[p], 0.4, "triangle", 0.25);
    setTimeout(() => el.classList.remove("lit"), 420);
  }

  $$(".pad").forEach((el) =>
    el.addEventListener("click", () => {
      if (tzBusy || state.solved.trezor) return;
      const p = Number(el.dataset.pad);
      flashPad(p);
      tzInput.push(p);
      const i = tzInput.length - 1;
      if (tzSeq[i] !== p) {
        sfx.bad();
        $("#trezor-hint").textContent = "Ups, zle! Sleduj znova…";
        tzInput = [];
        setTimeout(playTrezorSeq, 900);
        return;
      }
      if (tzInput.length === tzSeq.length) {
        if (tzRound >= TREZOR_ROUNDS) {
          $$(".pad").forEach((x) => x.classList.add("good"));
          setTimeout(() => gameWon("trezor"), 500);
        } else {
          sfx.good();
          setTimeout(nextTrezorRound, 800);
        }
      }
    })
  );

  // =====================================================================
  //  MINI HRA 2: Graf (vymieňacie puzzle 3×2)
  // =====================================================================

  // lomená čiara rastu cez plochu 300×160 (3 stĺpce × 2 riadky po 100×80)
  const GRAF_PATH = "M 8 150 L 55 120 L 100 128 L 150 80 L 200 95 L 250 40 L 292 12";
  let grafOrder = [], grafSel = -1;

  function grafTileSvg(pos) {
    const col = pos % 3, row = Math.floor(pos / 3);
    return `<svg viewBox="${col * 100} ${row * 80} 100 80" preserveAspectRatio="none">
      <rect x="${col * 100}" y="${row * 80}" width="100" height="80" fill="#fdf9ec"/>
      <g stroke="#d9cba4" stroke-width="1">
        ${[20, 40, 60].map((y) => `<line x1="0" y1="${y}" x2="300" y2="${y}"/>`).join("")}
        ${[50, 100, 150, 200, 250].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="160"/>`).join("")}
      </g>
      <path d="${GRAF_PATH}" fill="none" stroke="#b8860b" stroke-width="7"
            stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${GRAF_PATH}" fill="none" stroke="#f0b429" stroke-width="4"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function startGraf() {
    grafOrder = [0, 1, 2, 3, 4, 5];
    do {
      for (let i = grafOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [grafOrder[i], grafOrder[j]] = [grafOrder[j], grafOrder[i]];
      }
    } while (grafOrder.every((v, i) => v === i));
    grafSel = -1;
    renderGraf();
  }

  function renderGraf() {
    const grid = $("#graf-grid");
    grid.innerHTML = "";
    grafOrder.forEach((piece, slot) => {
      const b = document.createElement("button");
      b.className = "graf-tile" + (slot === grafSel ? " sel" : "") + (piece === slot ? " ok" : "");
      b.innerHTML = grafTileSvg(piece);
      b.addEventListener("click", () => {
        if (state.solved.graf) return;
        sfx.tap();
        if (grafSel === -1) {
          grafSel = slot;
        } else if (grafSel === slot) {
          grafSel = -1;
        } else {
          [grafOrder[grafSel], grafOrder[slot]] = [grafOrder[slot], grafOrder[grafSel]];
          grafSel = -1;
          if (grafOrder.every((v, i) => v === i)) {
            renderGraf();
            setTimeout(() => gameWon("graf"), 450);
            return;
          }
        }
        renderGraf();
      });
      grid.appendChild(b);
    });
  }

  // =====================================================================
  //  MINI HRA 3: Mince (chytanie)
  // =====================================================================

  const MINCE_GOAL = 12, MINCE_TIME = 30;
  let mnScore = 0, mnTime = 0, mnTimer = null, mnSpawner = null, mnActive = false;

  function openMince() {
    stopMince();
    mnScore = 0;
    mnTime = MINCE_TIME;
    updateMinceHud();
    $("#mince-area").innerHTML = "";
    $("#mince-start").classList.remove("hidden");
  }

  $("#btn-mince-go").addEventListener("click", () => {
    sfx.tap();
    $("#mince-start").classList.add("hidden");
    mnActive = true;
    mnTimer = setInterval(() => {
      mnTime -= 1;
      updateMinceHud();
      if (mnTime <= 0) {
        stopMince();
        sfx.bad();
        openMince(); // reset a ponúkni Štart znova
      }
    }, 1000);
    mnSpawner = setInterval(spawnFalling, 650);
  });

  function updateMinceHud() {
    $("#mince-score").textContent = `🪙 ${mnScore} / ${MINCE_GOAL}`;
    $("#mince-time").textContent = `⏱ ${mnTime}`;
  }

  function spawnFalling() {
    if (!mnActive) return;
    const area = $("#mince-area");
    const isCoin = Math.random() < 0.68;
    const b = document.createElement("button");
    b.className = "falling";
    b.textContent = isCoin ? "🪙" : "🧾";
    b.style.left = 8 + Math.random() * 84 + "%";
    const dur = 3200 + Math.random() * 1300;
    b.style.transitionDuration = dur + "ms";
    b.addEventListener("click", () => {
      if (b.classList.contains("caught")) return;
      b.classList.add("caught");
      if (isCoin) {
        sfx.coin();
        mnScore += 1;
        updateMinceHud();
        if (mnScore >= MINCE_GOAL) {
          stopMince();
          setTimeout(() => gameWon("mince"), 350);
        }
      } else {
        sfx.bad();
        mnScore = Math.max(0, mnScore - 1);
        updateMinceHud();
      }
      setTimeout(() => b.remove(), 320);
    });
    area.appendChild(b);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => { b.style.top = "108%"; })
    );
    setTimeout(() => b.remove(), dur + 400);
  }

  function stopMince() {
    mnActive = false;
    clearInterval(mnTimer);
    clearInterval(mnSpawner);
    mnTimer = mnSpawner = null;
  }

  // =====================================================================
  //  MINI HRA 4: Bludisko (krokové, swipe alebo šípky)
  // =====================================================================

  const MAZE = [
    "XXXGXXX",
    "X...X.X",
    "X.X...X",
    "X.XXX.X",
    "X...X.X",
    "XXX...X",
    "X...X.X",
    "X.X...X",
    "XXXSXXX"
  ].map((r) => r.split(""));

  let ballR = 0, ballC = 0;

  function startBludisko() {
    MAZE.forEach((row, r) => row.forEach((cell, c) => {
      if (cell === "S") { ballR = r; ballC = c; }
    }));
    renderMaze();
  }

  function renderMaze() {
    const m = $("#maze");
    m.innerHTML = "";
    MAZE.forEach((row, r) => row.forEach((cell, c) => {
      const d = document.createElement("div");
      d.className = "mz " + (cell === "X" ? "wall" : cell === "G" ? "goal" : "floor");
      if (cell === "G") d.textContent = "🏠";
      if (r === ballR && c === ballC) {
        d.innerHTML = '<span class="ball">🪙</span>';
      }
      m.appendChild(d);
    }));
  }

  function moveBall(dr, dc) {
    if (state.solved.bludisko) return;
    const nr = ballR + dr, nc = ballC + dc;
    if (nr < 0 || nr >= MAZE.length || nc < 0 || nc >= MAZE[0].length) return;
    const cell = MAZE[nr][nc];
    if (cell === "X") { tone(200, 0.08, "sine", 0.08); return; }
    ballR = nr;
    ballC = nc;
    sfx.tap();
    renderMaze();
    if (cell === "G") setTimeout(() => gameWon("bludisko"), 350);
  }

  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  $$(".dpad-btn").forEach((b) =>
    b.addEventListener("click", () => moveBall(...DIRS[b.dataset.dir]))
  );

  let swipeX = 0, swipeY = 0;
  const bludiskoScreen = $("#screen-bludisko");
  bludiskoScreen.addEventListener("touchstart", (e) => {
    swipeX = e.touches[0].clientX;
    swipeY = e.touches[0].clientY;
  }, { passive: true });
  bludiskoScreen.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - swipeX;
    const dy = e.changedTouches[0].clientY - swipeY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) moveBall(0, dx > 0 ? 1 : -1);
    else moveBall(dy > 0 ? 1 : -1, 0);
  }, { passive: true });

  // =====================================================================
  //  MINI HRA 5: Pexeso
  // =====================================================================

  const PEX_EMOJI = ["🧭", "✈️", "🗺️", "🏠", "🪙", "🎁"];
  let pexOpen = [], pexLock = false, pexMatched = 0;

  function startPexeso() {
    const deck = [...PEX_EMOJI, ...PEX_EMOJI];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    pexOpen = [];
    pexLock = false;
    pexMatched = 0;
    const grid = $("#pexeso-grid");
    grid.innerHTML = "";
    deck.forEach((em) => {
      const b = document.createElement("button");
      b.className = "pex-card";
      b.textContent = em;
      b.addEventListener("click", () => {
        if (pexLock || b.classList.contains("open") || b.classList.contains("matched")) return;
        sfx.tap();
        b.classList.add("open");
        pexOpen.push(b);
        if (pexOpen.length === 2) {
          pexLock = true;
          const [a, c] = pexOpen;
          if (a.textContent === c.textContent) {
            setTimeout(() => {
              a.classList.replace("open", "matched");
              c.classList.replace("open", "matched");
              sfx.good();
              pexOpen = [];
              pexLock = false;
              pexMatched += 1;
              if (pexMatched === PEX_EMOJI.length) {
                setTimeout(() => gameWon("pexeso"), 450);
              }
            }, 420);
          } else {
            setTimeout(() => {
              a.classList.remove("open");
              c.classList.remove("open");
              pexOpen = [];
              pexLock = false;
            }, 750);
          }
        }
      });
      grid.appendChild(b);
    });
  }

  // =====================================================================
  //  Brány
  // =====================================================================

  let gateNo = 1, gateFilled = 0;

  function openGate(no) {
    gateNo = no;
    gateFilled = 0;
    const word = WORDS[no];
    $("#gate-title").textContent = no === 1 ? "Prvá brána" : "Druhá brána";
    $("#gate-hint").textContent = "Ťukaj na mince v správnom poradí a poskladaj heslo.";

    const slots = $("#gate-slots");
    slots.innerHTML = "";
    word.split("").forEach(() => {
      const d = document.createElement("div");
      d.className = "gate-slot";
      slots.appendChild(d);
    });

    const chipsEl = $("#gate-chips");
    chipsEl.innerHTML = "";
    const chars = word.split("");
    const shuffled = chars
      .map((ch, i) => ({ ch, i }))
      .sort(() => Math.random() - 0.5);
    shuffled.forEach(({ ch }) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = ch;
      b.addEventListener("click", () => {
        if (b.classList.contains("used")) return;
        const want = word[gateFilled];
        if (ch === want) {
          sfx.coin();
          b.classList.add("used");
          const slot = $("#gate-slots").children[gateFilled];
          slot.textContent = ch;
          slot.classList.add("filled");
          gateFilled += 1;
          if (gateFilled === word.length) {
            setTimeout(() => gateSolved(no), 500);
          }
        } else {
          sfx.bad();
          b.classList.add("shake");
          setTimeout(() => b.classList.remove("shake"), 380);
        }
      });
      chipsEl.appendChild(b);
    });

    show("#screen-gate");
  }

  function gateSolved(no) {
    if (no === 1) {
      state.gate1 = true;
      save();
      sfx.win();
      $("#gate-hint").textContent = "Brána sa otvára…";
      setTimeout(() => { show("#screen-map"); renderMap(); }, 1100);
    } else {
      state.gate2 = true;
      save();
      setTimeout(() => {
        show("#screen-final");
        sfx.fanfare();
        startConfetti();
      }, 700);
    }
  }

  // =====================================================================
  //  Konfety
  // =====================================================================

  let confettiRun = false;

  function startConfetti() {
    const canvas = $("#confetti");
    const c = canvas.getContext("2d");
    let w, h;
    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#d4af37", "#f0d788", "#fdf6e3", "#7ed491", "#e8a2c0"];
    const parts = Array.from({ length: 130 }, () => ({
      x: Math.random() * 400,
      y: -20 - Math.random() * 500,
      s: 4 + Math.random() * 6,
      vy: 1.4 + Math.random() * 2.6,
      vx: (Math.random() - 0.5) * 1.6,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 9,
      col: colors[Math.floor(Math.random() * colors.length)]
    }));

    confettiRun = true;
    (function frame() {
      if (!confettiRun) return;
      c.clearRect(0, 0, w, h);
      parts.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vr;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        if (p.x < -20) p.x = w + 10;
        if (p.x > w + 20) p.x = -10;
        c.save();
        c.translate((p.x / 400) * w, p.y);
        c.rotate((p.rot * Math.PI) / 180);
        c.fillStyle = p.col;
        c.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
        c.restore();
      });
      requestAnimationFrame(frame);
    })();
  }

  function stopConfetti() { confettiRun = false; }

  // =====================================================================
  //  Obnovenie rozohranej hry
  // =====================================================================

  if (state.gate2) {
    show("#screen-final");
    startConfetti();
  } else if (Object.keys(state.solved).length > 0 || state.gate1) {
    show("#screen-map");
    renderMap();
  }
})();
