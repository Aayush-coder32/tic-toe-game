(() => {
  "use strict";

  const STORAGE_KEY = "neon-noughts-data-v1";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const refs = {
    html: document.documentElement,
    intro: $("#introScreen"),
    home: $("#homeScreen"),
    game: $("#gameScreen"),
    board: $("#board"),
    modalLayer: $("#modalLayer"),
    toast: $("#toast"),
    toastMessage: $("#toastMessage"),
    confetti: $("#confetti"),
    importInput: $("#importInput")
  };

  const freshData = () => ({
    scores: { X: 0, O: 0, draws: 0, computer: 0 },
    stats: { games: 0, wins: 0, losses: 0, draws: 0, currentStreak: 0, longestStreak: 0, bestScore: 0 },
    results: [],
    achievements: [],
    settings: { theme: "dark", sound: true, autoRestart: false, highContrast: false, difficulty: "hard" },
    profile: { name: "Alex", symbol: "X" },
    daily: { date: "", completed: false }
  });

  const loadData = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const base = freshData();
      if (!saved) return base;
      return {
        ...base,
        ...saved,
        scores: { ...base.scores, ...(saved.scores || {}) },
        stats: { ...base.stats, ...(saved.stats || {}) },
        settings: { ...base.settings, ...(saved.settings || {}) },
        profile: { ...base.profile, ...(saved.profile || {}) },
        daily: { ...base.daily, ...(saved.daily || {}) },
        results: Array.isArray(saved.results) ? saved.results : [],
        achievements: Array.isArray(saved.achievements) ? saved.achievements : []
      };
    } catch {
      return freshData();
    }
  };

  const data = loadData();
  let setupMode = "pvc";
  let lastFocusedElement = null;
  let toastTimer = null;
  let game = null;
  const introAudio = { started: false, nodes: [], stopTimer: null };

  function finishIntro() {
    if (!refs.intro || refs.intro.classList.contains("is-closing")) return;
    refs.intro.classList.add("is-closing");
    refs.intro.setAttribute("aria-hidden", "true");
    document.body.classList.remove("intro-playing");
    setTimeout(() => refs.intro.classList.add("is-hidden"), 850);
  }

  async function startIntroAudio() {
    if (!data.settings.sound || introAudio.started) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = playSound.context || (playSound.context = new AudioContext());
      if (context.state === "suspended") await context.resume();
      if (context.state === "suspended") return;
      introAudio.started = true;
      const now = context.currentTime;
      const master = context.createGain();
      master.gain.setValueAtTime(.0001, now);
      master.gain.exponentialRampToValueAtTime(.08, now + .12);
      master.gain.exponentialRampToValueAtTime(.0001, now + 3.35);
      master.connect(context.destination);
      introAudio.nodes.push(master);

      const pad = context.createOscillator();
      const padGain = context.createGain();
      pad.type = "sine";
      pad.frequency.setValueAtTime(130.81, now);
      padGain.gain.setValueAtTime(.0001, now);
      padGain.gain.exponentialRampToValueAtTime(.18, now + .45);
      padGain.gain.exponentialRampToValueAtTime(.0001, now + 3.2);
      pad.connect(padGain).connect(master);
      pad.start(now); pad.stop(now + 3.35);
      introAudio.nodes.push(pad);

      const notes = [[0, 261.63], [.2, 329.63], [.4, 392], [.68, 523.25], [1.05, 392], [1.3, 523.25], [1.75, 659.25]];
      notes.forEach(([offset, frequency], index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + offset;
        const end = start + (index === notes.length - 1 ? .72 : .3);
        oscillator.type = index % 2 ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.55, start + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        oscillator.connect(gain).connect(master);
        oscillator.start(start); oscillator.stop(end + .04);
        introAudio.nodes.push(oscillator);
      });
      introAudio.stopTimer = setTimeout(stopIntroAudio, 3700);
    } catch {
      // Browsers may block audio until a user gesture; the visual intro still runs.
    }
  }

  function stopIntroAudio() {
    clearTimeout(introAudio.stopTimer);
    introAudio.nodes.forEach((node) => { try { node.stop?.(); } catch {} try { node.disconnect?.(); } catch {} });
    introAudio.nodes = [];
  }

  const symbols = { X: "×", O: "○" };
  const positionNames = ["top left", "top center", "top right", "middle left", "center", "middle right", "bottom left", "bottom center", "bottom right"];
  const winLines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function syncDaily() {
    if (data.daily.date !== todayKey()) {
      data.daily = { date: todayKey(), completed: false };
      persist();
    }
  }

  function applyPreferences() {
    refs.html.dataset.theme = data.settings.theme;
    refs.html.dataset.contrast = data.settings.highContrast ? "high" : "normal";
    $("#themeSelect").value = data.settings.theme;
    $("#soundToggle").checked = data.settings.sound;
    $("#autoRestartToggle").checked = data.settings.autoRestart;
    $("#contrastToggle").checked = data.settings.highContrast;
    $("#defaultDifficulty").value = data.settings.difficulty;
    updateSoundIcon();
  }

  function updateSoundIcon() {
    const button = document.querySelector('[data-action="sound"]');
    const icon = button?.querySelector(".sound-icon");
    if (!icon) return;
    icon.textContent = data.settings.sound ? "◖" : "⊘";
    button.setAttribute("aria-label", data.settings.sound ? "Mute sound" : "Unmute sound");
  }

  function showToast(message, icon = "✦") {
    refs.toastMessage.textContent = message;
    refs.toast.querySelector(".toast-icon").textContent = icon;
    refs.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => refs.toast.classList.remove("show"), 2800);
  }

  function playSound(kind = "click") {
    if (!data.settings.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = playSound.context || (playSound.context = new AudioContext());
      if (context.state === "suspended") context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const tones = { click: [330, .035, "sine"], move: [520, .06, "sine"], win: [660, .15, "triangle"], draw: [220, .11, "sine"] };
      const [frequency, duration, type] = tones[kind] || tones.click;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      if (kind === "win") oscillator.frequency.exponentialRampToValueAtTime(990, context.currentTime + duration);
      gain.gain.setValueAtTime(.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(kind === "click" ? .045 : .075, context.currentTime + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration + .03);
    } catch {
      // Audio is an enhancement; the game remains fully usable without it.
    }
  }

  function openModal(id) {
    refs.modalLayer.hidden = false;
    $$(".modal").forEach((modal) => { modal.hidden = modal.id !== id; });
    lastFocusedElement = document.activeElement;
    const firstFocusable = $(`#${id} button, #${id} input, #${id} select`);
    setTimeout(() => firstFocusable?.focus(), 30);
  }

  function closeModal() {
    refs.modalLayer.hidden = true;
    $$(".modal").forEach((modal) => { modal.hidden = true; });
    if (game?.paused) {
      game.paused = false;
      renderGame();
    }
    lastFocusedElement?.focus?.();
  }

  function showScreen(screen) {
    const showHome = screen === "home";
    refs.home.hidden = !showHome;
    refs.game.hidden = showHome;
    if (showHome) {
      refs.home.classList.remove("active");
      void refs.home.offsetWidth;
      refs.home.classList.add("active");
      updateHomeStats();
    } else {
      refs.game.classList.remove("active");
      void refs.game.offsetWidth;
      refs.game.classList.add("active");
    }
  }

  function updateHomeStats() {
    $("#homeGames").textContent = data.stats.games;
  }

  function openSetup() {
    if (game?.paused) game.paused = false;
    closeModal();
    syncDaily();
    $("#playerName").value = data.profile.name;
    $("#symbolSelect").value = data.profile.symbol;
    $("#difficultySelect").value = data.settings.difficulty;
    $("#dailyToggle").checked = false;
    setupMode = "pvc";
    $$(".mode-option").forEach((option) => option.classList.toggle("selected", option.dataset.mode === setupMode));
    $("#difficultyField").hidden = false;
    openModal("setupModal");
  }

  function beginGame(options) {
    clearTimeout(game?.aiTimer);
    game = {
      board: Array(9).fill(""), current: "X", moves: [], redoMoves: [], winningLine: [],
      isOver: false, paused: false, pendingAI: false, elapsed: 0, timer: null, aiTimer: null,
      mode: options.mode, playerName: options.playerName, playerSymbol: options.playerSymbol,
      aiSymbol: options.playerSymbol === "X" ? "O" : "X", difficulty: options.difficulty,
      daily: Boolean(options.daily), hintIndex: null
    };
    data.profile.name = options.playerName;
    data.profile.symbol = options.playerSymbol;
    data.settings.difficulty = options.difficulty;
    persist();
    syncDaily();
    showScreen("game");
    closeModal();
    startTimer();
    renderGame();
    showToast(options.daily ? "Daily challenge loaded. Perfect play is online." : `${options.mode === "pvp" ? "Pass-and-play" : options.difficulty[0].toUpperCase() + options.difficulty.slice(1)} match ready.`, options.daily ? "✦" : "↗");
    if (game.mode === "pvc" && game.current === game.aiSymbol) scheduleAiMove();
  }

  function startFromSetup() {
    const daily = $("#dailyToggle").checked;
    const playerName = ($("#playerName").value.trim() || "Alex").slice(0, 18);
    const playerSymbol = $("#symbolSelect").value;
    const difficulty = daily ? "impossible" : $("#difficultySelect").value;
    beginGame({ mode: daily ? "pvc" : setupMode, playerName, playerSymbol, difficulty, daily });
    playSound("click");
  }

  function startDailyChallenge() {
    syncDaily();
    if (data.daily.completed) showToast("You've already completed today's challenge — go for a faster time.", "✦");
    beginGame({ mode: "pvc", playerName: data.profile.name || "Alex", playerSymbol: "X", difficulty: "impossible", daily: true });
  }

  function startTimer() {
    clearInterval(game.timer);
    game.timer = setInterval(() => {
      if (!game || game.isOver || game.paused) return;
      game.elapsed += 1;
      $("#gameTimer").textContent = formatTime(game.elapsed);
    }, 1000);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function getUserSymbol() {
    return game?.mode === "pvc" ? game.playerSymbol : "X";
  }

  function renderGame() {
    if (!game) return;
    const userSymbol = getUserSymbol();
    refs.board.innerHTML = game.board.map((cell, index) => {
      const filled = Boolean(cell);
      const winning = game.winningLine.includes(index);
      const hint = game.hintIndex === index;
      const disabled = filled || game.isOver || game.paused || game.pendingAI || (game.mode === "pvc" && game.current !== userSymbol);
      const mark = filled ? `<span class="mark">${symbols[cell]}</span>` : "";
      return `<button class="cell${filled ? ` filled ${cell.toLowerCase()}` : ""}${winning ? " winner" : ""}${hint ? " hint" : ""}" data-index="${index}" role="gridcell" aria-label="${filled ? `${cell} at ${positionNames[index]}` : `Empty cell at ${positionNames[index]}`}" ${disabled ? "disabled" : ""}>${mark}</button>`;
    }).join("");

    const currentIsUser = game.mode === "pvp" || game.current === userSymbol;
    const currentName = game.mode === "pvp" ? `Player ${game.current}` : (game.current === userSymbol ? game.playerName : "Computer");
    $("#gameModeEyebrow").textContent = game.daily ? "DAILY CHALLENGE" : game.mode === "pvp" ? "PLAYER VS PLAYER" : `PLAYER VS COMPUTER · ${game.difficulty.toUpperCase()}`;
    $("#gameTitle").textContent = game.isOver ? "Match complete." : currentIsUser ? `${game.playerName}, your move.` : "Computer is thinking…";
    $("#turnLabel").textContent = game.isOver ? "Final board" : `${currentName} · ${game.current}`;
    $("#turnToken").textContent = symbols[game.current];
    $("#turnToken").classList.toggle("o-turn", game.current === "O");
    $("#moveCount").textContent = `Move ${game.moves.length} / 9`;
    $("#gameTimer").textContent = formatTime(game.elapsed);
    $("#difficultyBadge").textContent = game.mode === "pvp" ? "PASS & PLAY" : game.difficulty.toUpperCase();
    $("#progressLabel").textContent = game.isOver ? "Complete" : currentIsUser ? "Your turn" : "AI turn";
    $("#focusProgress").style.width = `${Math.max(7, Math.min(100, (game.moves.length / 9) * 100))}%`;
    $("#focusCopy").textContent = focusMessage();
    updateScores();
    renderHistory();
    renderStats();
    renderBadges();
  }

  function focusMessage() {
    if (game.isOver) return "That board is locked in. Take the result, then decide whether to run it back.";
    if (game.moves.length === 0) return game.mode === "pvc" && game.difficulty === "impossible" ? "The machine is watching. Own the center or create a clever corner trap." : "The opening sets the rhythm. Center and corners create the most options.";
    if (game.moves.length < 3) return "Look for a fork: two possible winning lines your opponent cannot block at once.";
    if (game.moves.length < 6) return "Count the threats before you place. A defensive move can be the sharpest one.";
    return "Endgame focus: scan every line and close the path before it closes around you.";
  }

  function updateScores() {
    const xLabel = game.mode === "pvp" ? "Player X" : game.playerSymbol === "X" ? game.playerName : "Computer";
    const oLabel = game.mode === "pvp" ? "Player O" : game.playerSymbol === "O" ? game.playerName : "Computer";
    $("#xScoreLabel").textContent = xLabel;
    $("#oScoreLabel").textContent = oLabel;
    $("#xScore").textContent = data.scores.X;
    $("#oScore").textContent = data.scores.O;
    $("#drawScore").textContent = data.scores.draws;
  }

  function renderHistory() {
    const history = $("#moveHistory");
    if (!game.moves.length) {
      history.innerHTML = `<li class="empty-history">Your moves will appear here.</li>`;
      return;
    }
    history.innerHTML = game.moves.map((move, index) => `<li><strong>${move.symbolsLabel || move.symbol}</strong> · ${positionNames[move.index]} <span>${index + 1}</span></li>`).join("");
  }

  function renderStats() {
    const winRate = data.stats.games ? Math.round((data.stats.wins / data.stats.games) * 100) : 0;
    $("#statWinRate").textContent = `${winRate}%`;
    $("#statStreak").textContent = data.stats.currentStreak;
    $("#statBest").textContent = data.stats.bestScore;
    $("#fullGames").textContent = data.stats.games;
    $("#fullWins").textContent = data.stats.wins;
    $("#fullLosses").textContent = data.stats.losses;
    $("#fullDraws").textContent = data.stats.draws;
    $("#fullWinRate").textContent = `${winRate}%`;
    $("#fullLongest").textContent = data.stats.longestStreak;
    $("#fullCurrent").textContent = data.stats.currentStreak;
    $("#fullBest").textContent = data.stats.bestScore;
    const results = data.results.slice(-8);
    $("#barChart").innerHTML = (results.length ? results : ["empty"]).map((result) => {
      const type = typeof result === "string" ? "empty" : result.type;
      return `<span class="bar ${type}" style="height:${type === "empty" ? 3 : type === "win" ? 90 : type === "draw" ? 55 : 38}%" title="${type}"></span>`;
    }).join("");
  }

  const achievementDefinitions = [
    { id: "first-win", icon: "✦", label: "First win", unlocked: () => data.stats.wins >= 1 },
    { id: "streak", icon: "♨", label: "On fire", unlocked: () => data.stats.longestStreak >= 3 },
    { id: "daily", icon: "◈", label: "Daily", unlocked: () => data.achievements.includes("daily") },
    { id: "perfect", icon: "◇", label: "Perfect", unlocked: () => data.achievements.includes("perfect") }
  ];

  function renderBadges() {
    $("#badgesList").innerHTML = achievementDefinitions.slice(0, 3).map((badge) => `<span class="badge${badge.unlocked() ? "" : " locked"}" title="${badge.label}">${badge.icon}</span>`).join("") + `<span class="badge-more">+${Math.max(0, achievementDefinitions.length - 3)} to unlock</span>`;
  }

  function checkOutcome(board) {
    for (const line of winLines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line };
    }
    return board.every(Boolean) ? { winner: null, line: [] } : null;
  }

  function applyMove(index, symbol, isAI = false) {
    if (!game || game.isOver || game.paused || game.board[index] || (!isAI && game.pendingAI)) return false;
    game.hintIndex = null;
    game.board[index] = symbol;
    game.moves.push({ index, symbol });
    game.redoMoves = [];
    game.current = symbol === "X" ? "O" : "X";
    playSound("move");
    const outcome = checkOutcome(game.board);
    if (outcome) {
      finishGame(outcome);
      return true;
    }
    renderGame();
    if (game.mode === "pvc" && game.current === game.aiSymbol) scheduleAiMove();
    return true;
  }

  function scheduleAiMove() {
    if (!game || game.isOver || game.paused || game.current !== game.aiSymbol) return;
    clearTimeout(game.aiTimer);
    game.pendingAI = true;
    renderGame();
    game.aiTimer = setTimeout(() => {
      if (!game || game.isOver || game.paused) return;
      const move = getAiMove(game.board, game.aiSymbol, game.playerSymbol, game.difficulty);
      game.pendingAI = false;
      applyMove(move, game.aiSymbol, true);
    }, 420);
  }

  function getAiMove(board, ai, human, difficulty) {
    const open = board.map((value, index) => value ? null : index).filter((index) => index !== null);
    if (!open.length) return 0;
    if (difficulty === "easy") return open[Math.floor(Math.random() * open.length)];
    if (difficulty === "medium" && Math.random() < .5) return open[Math.floor(Math.random() * open.length)];
    return minimaxMove(board, ai, human);
  }

  function minimaxMove(board, ai, human) {
    const open = board.map((value, index) => value ? null : index).filter((index) => index !== null);
    let bestScore = -Infinity;
    let bestIndex = open[0];
    for (const index of open) {
      board[index] = ai;
      const score = minimax(board, false, ai, human, 0, -Infinity, Infinity);
      board[index] = "";
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    }
    return bestIndex;
  }

  function minimax(board, maximizing, ai, human, depth, alpha, beta) {
    const outcome = checkOutcome(board);
    if (outcome) {
      if (outcome.winner === ai) return 10 - depth;
      if (outcome.winner === human) return depth - 10;
      return 0;
    }
    const open = board.map((value, index) => value ? null : index).filter((index) => index !== null);
    if (maximizing) {
      let best = -Infinity;
      for (const index of open) {
        board[index] = ai;
        best = Math.max(best, minimax(board, false, ai, human, depth + 1, alpha, beta));
        board[index] = "";
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = Infinity;
    for (const index of open) {
      board[index] = human;
      best = Math.min(best, minimax(board, true, ai, human, depth + 1, alpha, beta));
      board[index] = "";
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  function finishGame(outcome) {
    clearTimeout(game.aiTimer);
    clearInterval(game.timer);
    game.pendingAI = false;
    game.isOver = true;
    game.winningLine = outcome.line;
    const isDraw = !outcome.winner;
    const userSymbol = getUserSymbol();
    const userWon = Boolean(outcome.winner && outcome.winner === userSymbol);
    data.stats.games += 1;
    let resultType = "draw";
    if (isDraw) {
      data.scores.draws += 1;
      data.stats.draws += 1;
      data.stats.currentStreak = 0;
      playSound("draw");
    } else {
      data.scores[outcome.winner] += 1;
      if (game.mode === "pvc" && outcome.winner === game.aiSymbol) data.scores.computer += 1;
      if (userWon) {
        resultType = "win";
        data.stats.wins += 1;
        data.stats.currentStreak += 1;
        data.stats.longestStreak = Math.max(data.stats.longestStreak, data.stats.currentStreak);
        playSound("win");
        burstConfetti();
      } else {
        resultType = "loss";
        data.stats.losses += 1;
        data.stats.currentStreak = 0;
        playSound("draw");
      }
    }
    data.stats.bestScore = Math.max(data.stats.bestScore, data.scores[userSymbol] || 0);
    data.results.push({ type: resultType, date: todayKey() });
    data.results = data.results.slice(-20);
    if (userWon && data.stats.wins === 1) unlockAchievement("first-win");
    if (data.stats.longestStreak >= 3) unlockAchievement("streak");
    if (game.daily) {
      data.daily = { date: todayKey(), completed: true };
      unlockAchievement("daily");
    }
    if (userWon && game.difficulty === "impossible") unlockAchievement("perfect");
    persist();
    renderGame();
    setTimeout(() => showResult(outcome), 500);
  }

  function unlockAchievement(id) {
    if (!data.achievements.includes(id)) {
      data.achievements.push(id);
      persist();
      setTimeout(() => showToast(`Achievement unlocked: ${id.replace("-", " ")}`, "◇"), 900);
    }
  }

  function showResult(outcome) {
    const userWon = outcome.winner === getUserSymbol();
    const draw = !outcome.winner;
    $("#resultIcon").textContent = draw ? "∼" : userWon ? "✦" : "⊘";
    $("#resultEyebrow").textContent = draw ? "A CLOSE MATCH" : userWon ? "MATCH WON" : "MATCH OVER";
    $("#resultTitle").textContent = draw ? "Draw game." : userWon ? `${game.playerName} wins!` : game.mode === "pvc" ? "Computer wins." : `Player ${outcome.winner} wins.`;
    $("#resultCopy").textContent = draw ? "No opening left. That was beautifully even." : userWon ? "A clean line. Beautifully played." : "The board got away this time. The rematch is yours.";
    $("#resultTime").textContent = formatTime(game.elapsed);
    $("#resultMoves").textContent = game.moves.length;
    $("#resultScore").textContent = draw ? "—" : userWon ? "+1" : "0";
    openModal("resultModal");
    if (data.settings.autoRestart) setTimeout(() => { if (!refs.modalLayer.hidden) { closeModal(); nextRound(); } }, 2800);
  }

  function nextRound() {
    if (!game) return openSetup();
    beginGame({ mode: game.mode, playerName: game.playerName, playerSymbol: game.playerSymbol, difficulty: game.difficulty, daily: false });
  }

  function restartRound() {
    if (!game) return;
    beginGame({ mode: game.mode, playerName: game.playerName, playerSymbol: game.playerSymbol, difficulty: game.difficulty, daily: game.daily });
    playSound("click");
  }

  function togglePause() {
    if (!game || game.isOver) return;
    game.paused = true;
    clearTimeout(game.aiTimer);
    game.pendingAI = false;
    renderGame();
    openModal("pauseModal");
  }

  function resumeGame() {
    if (!game) return;
    game.paused = false;
    closeModal();
    renderGame();
    if (game.mode === "pvc" && game.current === game.aiSymbol) scheduleAiMove();
    showToast("Back in the arena.", "↗");
  }

  function undoMove() {
    if (!game || game.isOver || !game.moves.length) return showToast("There is no move to undo yet.", "↶");
    clearTimeout(game.aiTimer);
    game.pendingAI = false;
    let count = 1;
    if (game.mode === "pvc" && game.moves.at(-1).symbol === game.playerSymbol && game.moves.length > 1) count = 1;
    if (game.mode === "pvc" && game.moves.at(-1).symbol === game.aiSymbol) count = Math.min(2, game.moves.length);
    const removed = [];
    for (let i = 0; i < count; i += 1) {
      const move = game.moves.pop();
      game.board[move.index] = "";
      removed.push(move);
    }
    game.redoMoves = removed.reverse().concat(game.redoMoves);
    game.current = game.moves.length % 2 === 0 ? "X" : "O";
    game.hintIndex = null;
    renderGame();
    if (game.mode === "pvc" && game.current === game.aiSymbol) scheduleAiMove();
    showToast(`${count === 2 ? "Your last exchange" : "Last move"} undone.`, "↶");
  }

  function redoMove() {
    if (!game || game.isOver || !game.redoMoves.length) return showToast("There is no move to redo.", "↷");
    const move = game.redoMoves.shift();
    game.board[move.index] = move.symbol;
    game.moves.push(move);
    game.current = move.symbol === "X" ? "O" : "X";
    renderGame();
    if (game.mode === "pvc" && game.current === game.aiSymbol) scheduleAiMove();
    showToast("Move restored.", "↷");
  }

  function showHint() {
    if (!game || game.isOver || game.paused || game.pendingAI) return;
    const current = game.current;
    if (game.mode === "pvc" && current !== game.playerSymbol) return showToast("Let the computer finish its thought first.", "⌁");
    const hint = minimaxMove([...game.board], current, current === "X" ? "O" : "X");
    game.hintIndex = hint;
    renderGame();
    showToast(`Try the ${positionNames[hint]} square.`, "✧");
    setTimeout(() => { if (game?.hintIndex === hint) { game.hintIndex = null; renderGame(); } }, 2300);
  }

  function burstConfetti() {
    const colors = ["#8d76ff", "#6fe5ef", "#f080be", "#62e3b2", "#ffbd78"];
    refs.confetti.innerHTML = Array.from({ length: 52 }, (_, index) => `<span class="confetto" style="left:${Math.random() * 100}%;background:${colors[index % colors.length]};animation-delay:${Math.random() * .35}s;--drift:${Math.random() * 160 - 80}px;transform:rotate(${Math.random() * 90}deg)"></span>`).join("");
    setTimeout(() => { refs.confetti.innerHTML = ""; }, 3300);
  }

  function saveBoardScreenshot() {
    if (!game) return;
    const canvas = document.createElement("canvas");
    canvas.width = 900; canvas.height = 900;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 900, 900);
    gradient.addColorStop(0, data.settings.theme === "light" ? "#f1f4ff" : "#0d1125");
    gradient.addColorStop(1, data.settings.theme === "light" ? "#dfe6ff" : "#161333");
    context.fillStyle = gradient; context.fillRect(0, 0, 900, 900);
    context.fillStyle = data.settings.theme === "light" ? "#19203d" : "#f5f6ff";
    context.font = "700 42px Space Grotesk, sans-serif"; context.fillText("NEON NOUGHTS", 60, 82);
    context.fillStyle = data.settings.theme === "light" ? "#59627f" : "#b8bbd2"; context.font = "500 20px DM Sans, sans-serif"; context.fillText(`${game.playerName} · ${game.mode === "pvp" ? "Pass & Play" : game.difficulty}`, 62, 118);
    const start = 105, size = 210, gap = 28;
    game.board.forEach((cell, index) => {
      const x = start + (index % 3) * (size + gap), y = 185 + Math.floor(index / 3) * (size + gap);
      context.fillStyle = data.settings.theme === "light" ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.055)"; context.strokeStyle = data.settings.theme === "light" ? "rgba(44,55,110,.15)" : "rgba(255,255,255,.13)"; context.lineWidth = 3; context.beginPath(); context.roundRect(x, y, size, size, 24); context.fill(); context.stroke();
      if (cell) { context.fillStyle = cell === "X" ? "#8d76ff" : "#6fe5ef"; context.font = "600 130px Space Grotesk, sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(symbols[cell], x + size / 2, y + size / 2 + 5); context.textAlign = "start"; context.textBaseline = "alphabetic"; }
    });
    context.fillStyle = data.settings.theme === "light" ? "#59627f" : "#b8bbd2"; context.font = "500 18px DM Sans, sans-serif"; context.fillText(`Score  ${data.scores.X} : ${data.scores.O}  ·  ${formatTime(game.elapsed)}`, 62, 855);
    canvas.toBlob((blob) => { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `neon-noughts-${todayKey()}.png`; link.click(); URL.revokeObjectURL(url); showToast("Board screenshot saved.", "▣"); }, "image/png");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `neon-noughts-data-${todayKey()}.json`; link.click(); URL.revokeObjectURL(url); showToast("Your game data was exported.", "↓");
  }

  function shareScore() {
    const shareText = `I've played ${data.stats.games} games in Neon Noughts with a ${data.stats.games ? Math.round((data.stats.wins / data.stats.games) * 100) : 0}% win rate. Can you beat my streak of ${data.stats.longestStreak}?`;
    if (navigator.share) navigator.share({ title: "Neon Noughts", text: shareText }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(shareText).then(() => showToast("Score copied to your clipboard.", "↗")).catch(() => showToast(shareText, "↗"));
    else showToast(shareText, "↗");
  }

  function updateSetting(target) {
    if (target.id === "themeSelect") data.settings.theme = target.value;
    if (target.id === "soundToggle") data.settings.sound = target.checked;
    if (target.id === "autoRestartToggle") data.settings.autoRestart = target.checked;
    if (target.id === "contrastToggle") data.settings.highContrast = target.checked;
    if (target.id === "defaultDifficulty") data.settings.difficulty = target.value;
    persist(); applyPreferences();
    if (game) renderGame();
  }

  function resetScores() {
    data.scores = { X: 0, O: 0, draws: 0, computer: 0 }; persist(); if (game) renderGame(); showToast("Scoreboard reset.", "↻");
  }

  function resetStats() {
    const keepSettings = data.settings;
    const keepProfile = data.profile;
    Object.assign(data, freshData(), { settings: keepSettings, profile: keepProfile });
    syncDaily(); persist(); applyPreferences(); if (game) renderGame(); updateHomeStats(); showToast("All statistics reset.", "↻");
  }

  function handleAction(action) {
    if (action !== "sound" && action !== "theme") playSound("click");
    switch (action) {
      case "skip-intro": startIntroAudio(); finishIntro(); break;
      case "enter-arena": startIntroAudio(); finishIntro(); break;
      case "home": closeModal(); showScreen("home"); break;
      case "open-setup": openSetup(); break;
      case "rules": openModal("rulesModal"); break;
      case "settings": closeModal(); openModal("settingsModal"); break;
      case "close-modal": closeModal(); break;
      case "sound": data.settings.sound = !data.settings.sound; if (!data.settings.sound) stopIntroAudio(); persist(); applyPreferences(); showToast(data.settings.sound ? "Sound on." : "Sound muted.", data.settings.sound ? "◖" : "⊘"); break;
      case "theme": data.settings.theme = data.settings.theme === "dark" ? "light" : "dark"; persist(); applyPreferences(); showToast(`${data.settings.theme === "dark" ? "Midnight" : "Daylight"} theme applied.`, "◐"); break;
      case "daily": startDailyChallenge(); break;
      case "start-game": startFromSetup(); break;
      case "pause": togglePause(); break;
      case "resume": resumeGame(); break;
      case "restart": restartRound(); break;
      case "new-game": openSetup(); break;
      case "next-round": closeModal(); nextRound(); break;
      case "undo": undoMove(); break;
      case "redo": redoMove(); break;
      case "hint": showHint(); break;
      case "clear-history": restartRound(); showToast("Round restarted. The scoreboard is safe.", "↻"); break;
      case "screenshot": saveBoardScreenshot(); break;
      case "fullscreen": document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); break;
      case "export": exportData(); break;
      case "import": refs.importInput.click(); showToast("Choose a Neon Noughts JSON backup to import.", "↑"); break;
      case "share": shareScore(); break;
      case "reset-scores": resetScores(); break;
      case "reset-stats": resetStats(); break;
      default: break;
    }
  }

  document.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-mode]");
    if (mode) {
      setupMode = mode.dataset.mode;
      $$(".mode-option").forEach((option) => option.classList.toggle("selected", option === mode));
      $("#difficultyField").hidden = setupMode === "pvp";
      playSound("click");
      return;
    }
    const cell = event.target.closest(".cell");
    if (cell) { applyMove(Number(cell.dataset.index), game.current); return; }
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) handleAction(actionTarget.dataset.action);
  });

  document.addEventListener("change", (event) => {
    if (["themeSelect", "soundToggle", "autoRestartToggle", "contrastToggle", "defaultDifficulty"].includes(event.target.id)) updateSetting(event.target);
    if (event.target.id === "importInput" && event.target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          const base = freshData();
          Object.assign(data, { ...base, ...imported, scores: { ...base.scores, ...(imported.scores || {}) }, stats: { ...base.stats, ...(imported.stats || {}) }, settings: { ...base.settings, ...(imported.settings || {}) }, profile: { ...base.profile, ...(imported.profile || {}) } });
          persist(); applyPreferences(); updateHomeStats(); if (game) renderGame(); showToast("Game data imported.", "↑");
        } catch { showToast("That file could not be imported.", "⊘"); }
      };
      reader.readAsText(event.target.files[0]);
      event.target.value = "";
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !refs.modalLayer.hidden) { closeModal(); return; }
    if (!game || refs.game.hidden || event.target.matches("input, select, textarea")) return;
    if (event.key.toLowerCase() === "p") togglePause();
    if (event.key.toLowerCase() === "h") showHint();
  });

  document.addEventListener("pointerdown", startIntroAudio, { once: true, passive: true });
  document.addEventListener("keydown", startIntroAudio, { once: true });

  document.querySelector('[data-action="export"]')?.addEventListener("contextmenu", (event) => { event.preventDefault(); refs.importInput.click(); showToast("Choose a Neon Noughts JSON file to import.", "↑"); });
  document.body.classList.add("intro-playing");
  startIntroAudio();
  const introDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 350 : 3200;
  setTimeout(finishIntro, introDelay);
  setTimeout(() => { if (refs.intro && !refs.intro.classList.contains("is-closing")) $("#introStatus").textContent = "Arena ready"; }, 2200);
  updateHomeStats(); syncDaily(); applyPreferences(); renderStats(); renderBadges();
})();
