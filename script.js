(() => {
  "use strict";

  // ---------- Data ----------

  const CLUE_TEXTS = {
    coins: "Zbieraš ma po jednej, no spolu tvorím poklad. Bez teba by som ostali len kovom.",
    chart: "Čím vyššie stúpam, tým viac sa tešíš. Klesnem len vtedy, keď to nesleduješ.",
    calculator: "Bez teba by som nevedela, koľko ti mám povedať. Stláčaš ma vždy, keď rátaš budúcnosť.",
    house: "Kúpil si ma na dlhé roky dopredu. Každý mesiac ti pripomínam, že sa oplatilo počkať.",
    shield: "Chránim ťa, keď príde niečo neplánované. Dúfaš, že ma nikdy nebudeš potrebovať.",
    map: "Ukazujem, kade ísť, no rozhodnutie je vždy na tebe.",
    compass: "Vždy ukážem smer, aj keď na chvíľu zablúdiš.",
    arrows: "Naznačujem, kam ďalej — nikdy nie odkiaľ.",
    milestone: "Značím, že si prešiel kus cesty. Zastav sa a obzri sa späť.",
    signpost: "Ukazujem viacero možností, ale správna je vždy len jedna."
  };

  const ANSWERS = {
    financial: ["financie", "financna", "peniaze", "finance", "financny"],
    cesta: ["cesta", "trasa", "smer", "draha"]
  };

  const FINAL_ANSWERS = ["financna cesta", "financnacesta"];

  const HINTS = {
    financial: "Nápoveda: mince, graf, kalkulačka, dom aj poistka majú spoločné jedno — všetky sa točia okolo peňazí.",
    cesta: "Nápoveda: mapa, kompas, šípky, míľnik aj smerovník ťa vedú niekam — všetky patria k jednej ceste."
  };

  // ---------- Helpers ----------

  function normalize(str) {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function show(el) {
    el.classList.add("active");
  }

  function hide(el) {
    el.classList.remove("active");
  }

  // ---------- State ----------

  const state = {
    solved: { financial: false, cesta: false },
    attempts: { financial: 0, cesta: 0 }
  };

  // ---------- Elements ----------

  const introScreen = document.getElementById("intro-screen");
  const gameScreen = document.getElementById("game-screen");
  const celebrationScreen = document.getElementById("celebration-screen");
  const startBtn = document.getElementById("start-btn");
  const replayBtn = document.getElementById("replay-btn");

  const clueModal = document.getElementById("clue-modal");
  const clueModalIcon = document.getElementById("clue-modal-icon");
  const clueModalText = document.getElementById("clue-modal-text");
  const closeModalBtn = document.getElementById("close-modal");

  const finalInput = document.getElementById("final-answer");
  const finalSubmit = document.getElementById("final-submit");
  const finalForm = document.getElementById("final-form");
  const finalFeedback = document.getElementById("final-feedback");

  const stepEls = {
    financial: document.getElementById("step-1"),
    cesta: document.getElementById("step-2"),
    door: document.getElementById("step-3")
  };

  // ---------- Intro ----------

  startBtn.addEventListener("click", () => {
    hide(introScreen);
    show(gameScreen);
  });

  replayBtn.addEventListener("click", () => {
    window.location.reload();
  });

  // ---------- Clue cards ----------

  document.querySelectorAll(".clue-card").forEach((card) => {
    card.addEventListener("click", () => {
      const key = card.dataset.clue;
      card.classList.add("viewed");
      clueModalIcon.textContent = card.querySelector(".clue-emoji").textContent;
      clueModalText.textContent = CLUE_TEXTS[key] || "";
      show(clueModal);
    });
  });

  closeModalBtn.addEventListener("click", () => hide(clueModal));
  clueModal.addEventListener("click", (e) => {
    if (e.target === clueModal) hide(clueModal);
  });

  // ---------- Stage forms ----------

  document.querySelectorAll(".answer-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const stage = form.dataset.stage;
      if (state.solved[stage]) return;

      const input = form.querySelector("input");
      const feedback = document.getElementById(`feedback-${stage}`);
      const hintEl = document.getElementById(`hint-${stage}`);
      const value = normalize(input.value);

      if (ANSWERS[stage].includes(value) && value !== "") {
        state.solved[stage] = true;
        form.classList.add("solved");
        feedback.textContent = "Správne! Táto hádanka je vyriešená.";
        feedback.className = "feedback success";
        hintEl.textContent = "";
        stepEls[stage].classList.remove("active");
        stepEls[stage].classList.add("done");
        checkUnlockFinal();
      } else {
        state.attempts[stage] += 1;
        feedback.textContent = "To nie je ono, skús to znova.";
        feedback.className = "feedback error";
        if (state.attempts[stage] >= 3) {
          hintEl.textContent = HINTS[stage];
        }
      }
    });
  });

  function checkUnlockFinal() {
    if (state.solved.financial && state.solved.cesta) {
      finalInput.disabled = false;
      finalSubmit.disabled = false;
      stepEls.door.classList.add("active");
      finalInput.focus();
    }
  }

  // ---------- Final door ----------

  finalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (finalInput.disabled) return;

    const value = normalize(finalInput.value);
    if (FINAL_ANSWERS.includes(value)) {
      finalFeedback.textContent = "Dvere sa otvárajú…";
      finalFeedback.className = "feedback success";
      stepEls.door.classList.remove("active");
      stepEls.door.classList.add("done");
      setTimeout(openCelebration, 500);
    } else {
      finalFeedback.textContent = "Zámka sa nepohla. Skús to znova.";
      finalFeedback.className = "feedback error";
      finalInput.classList.add("shake");
      setTimeout(() => finalInput.classList.remove("shake"), 400);
    }
  });

  // ---------- Celebration ----------

  function openCelebration() {
    hide(gameScreen);
    show(celebrationScreen);
    startConfetti();
    playFanfare();
  }

  // ---------- Confetti ----------

  function startConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    const ctx = canvas.getContext("2d");
    let width, height;

    function resize() {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#d4af37", "#e8cd7a", "#f3ecd9", "#6fbf82", "#8892e0"];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * width,
      y: Math.random() * -height,
      size: 4 + Math.random() * 6,
      speedY: 1.5 + Math.random() * 3,
      speedX: (Math.random() - 0.5) * 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));

    let running = true;

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
      pieces.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;
        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      requestAnimationFrame(frame);
    }
    frame();
  }

  // ---------- Fanfare (Web Audio, no external files) ----------

  function playFanfare() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      const now = ctx.currentTime;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const start = now + i * 0.15;
        const end = start + 0.35;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.linearRampToValueAtTime(0, end);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(end);
      });
    } catch (err) {
      // Web Audio unavailable — celebration still works visually.
    }
  }
})();
