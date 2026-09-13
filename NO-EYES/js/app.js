/* NO EYES — funcionamento do site (mesmo comportamento original) */
(function () {
  "use strict";

  var ENIGMAS = window.NOEYES_ENIGMAS;
  var TOTAL = window.NOEYES_TOTAL;
  var ARCHIVE_URL = window.NOEYES_ARCHIVE;
  var STORAGE_KEY = "no-eyes-barrier";

  var LETTER = [
    "O que estou fazendo pode ser uma grande tolice. Roubei todos os arquivos do caso Hartmann e tentei reuni-los em um único lugar. Não sei por quanto tempo este site vai ficar de pé, e não sei quanto tempo tenho até descobrirem. Porém, algo tinha que ser feito.",
    "Eles são uns putos covardes. Esses arquivos estavam sendo escondidos de todos dentro da organização. Esse é o caso mais complexo que já apareceu na nossa mesa, e ninguém decide fazer nada a respeito.",
    "Por isso, decidi criar esta organização, com o intuito de investigar tudo aquilo que as pessoas têm medo de se aproximar.",
    "Somos poucos, mas estamos à procura de mais pessoas capazes de nos ajudar.",
    "SOMOS NO EYES",
    "Todas as informações que consegui reunir estão em um site codificado.",
    "Apenas por critérios de segurança, fiz uma barreira de 16 enigmas até as informações.",
    "Caso consiga chegar ao final dos enigmas, poderá ler todos os documentos.",
  ];

  var BOOT_LINES = [
    "> terminal 04 · setor B",
    "> sessão instável",
    "> carregando vazamento local…",
    "> protocolos: 16",
    "> ok",
  ];

  var state = {
    view: "boot",
    index: 0,
    answers: [],
    bootCount: 1,
    skipIntro: false,
    introDone: false,
    introChars: 0,
    input: "",
    error: "",
    ok: false,
    shake: 0,
  };

  var timers = [];
  var app = document.getElementById("app");

  function clearTimers() {
    timers.forEach(function (id) {
      window.clearTimeout(id);
    });
    timers = [];
  }

  function later(fn, ms) {
    var id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function normalizeKey(value) {
    return String(value)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function matchesAnswer(input, answers) {
    var got = normalizeKey(input);
    if (!got) return false;
    return answers.some(function (a) {
      return normalizeKey(a) === got;
    });
  }

  function readSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.answers) || typeof parsed.index !== "number") return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeSaved(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function persist() {
    writeSaved({
      index: state.index,
      answers: state.answers,
      started: state.view === "enigma" || state.view === "unlock",
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&" + "amp;")
      .replace(/</g, "&" + "lt;")
      .replace(/>/g, "&" + "gt;")
      .replace(/"/g, "&" + "quot;");
  }

  function headerHtml(banner, bannerOk) {
    banner = banner || "acesso não autorizado será registrado";
    return (
      '<header class="header">' +
      '<div class="header-inner">' +
      '<a class="brand" href="#topo">' +
      '<img class="flicker" src="assets/logo-mark.png" alt="NO EYES">' +
      "<div><small>organização</small><h1>NO EYES</h1>" +
      '<span class="phosphor">divisão de arquivo interno</span></div></a>' +
      '<div class="meta">sistema legado · 2009<br>sessão: VISITANTE<br>terminal 04 · setor B</div>' +
      "</div>" +
      '<div class="' +
      (bannerOk ? "banner ok" : "banner") +
      '">' +
      escapeHtml(banner) +
      "</div></header>"
    );
  }

  function progressHtml(solved, current) {
    var ticks = "";
    for (var i = 0; i < TOTAL; i++) {
      var on = i < solved;
      var now = current !== undefined && i === current && !on;
      ticks +=
        '<span class="' +
        (now ? "tick now" : on ? "tick on" : "tick") +
        '"></span>';
    }
    return (
      '<div class="ticks" role="img" aria-label="' +
      solved +
      " de " +
      TOTAL +
      ' enigmas liberados">' +
      ticks +
      "</div>"
    );
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function enigmaBody(enigma) {
    var kind = enigma.kind;
    var lines = enigma.lines;

    if (kind === "doors") {
      return (
        '<div class="body"><p>' +
        escapeHtml(lines[0]) +
        '</p><div class="door-grid">' +
        '<div class="door">porta 1<strong>Eu sou a mentira</strong></div>' +
        '<div class="door">porta 2<strong>Eu sou a verdade</strong></div>' +
        '<div class="door">porta 3<strong>Eu sou a mentira</strong></div>' +
        "</div><p>" +
        escapeHtml(lines[1]) +
        "</p></div>"
      );
    }

    if (kind === "cipher") {
      return (
        '<div class="body"><p>' +
        escapeHtml(lines[0]) +
        '</p><p class="cipher">' +
        escapeHtml(lines[1]) +
        "</p><p>" +
        escapeHtml(lines[2]) +
        "</p></div>"
      );
    }

    if (kind === "morse") {
      return (
        '<div class="body"><p>Sinal interceptado em pulsos. Decodifique.</p>' +
        '<p class="cipher" style="font-size:14px;letter-spacing:0.08em">' +
        escapeHtml(lines[0]) +
        "</p></div>"
      );
    }

    if (kind === "binary") {
      return (
        '<div class="body"><p class="cipher" style="font-size:13px;letter-spacing:0.1em">' +
        escapeHtml(lines[0]) +
        "</p><p>" +
        escapeHtml(lines[1]) +
        "</p></div>"
      );
    }

    if (kind === "signals") {
      var extra = lines
        .slice(2)
        .map(function (l) {
          return "<p>" + escapeHtml(l) + "</p>";
        })
        .join("");
      return (
        '<div class="body"><p>' +
        escapeHtml(lines[0]) +
        '</p><div class="signal-row" aria-hidden="true">' +
        '<span class="signal red"></span><span class="signal amber"></span><span class="signal red"></span>' +
        "</div><p>VERMELHO — AMARELO — VERMELHO</p>" +
        extra +
        "</div>"
      );
    }

    if (kind === "observe") {
      var rest = lines
        .slice(5)
        .map(function (l) {
          return "<p>" + escapeHtml(l) + "</p>";
        })
        .join("");
      return (
        '<div class="body"><p>' +
        escapeHtml(lines[0]) +
        '</p><div class="observe">' +
        "<span>A vê B</span><span>B não vê C</span><span>C vê A</span>" +
        "</div>" +
        rest +
        "</div>"
      );
    }

    if (kind === "keys") {
      var items = state.answers
        .map(function (value, i) {
          return (
            "<li><span class=\"n\">" +
            pad2(i + 1) +
            "</span><span>" +
            escapeHtml(value) +
            "</span></li>"
          );
        })
        .join("");
      var paras = lines
        .map(function (l) {
          return "<p>" + escapeHtml(l) + "</p>";
        })
        .join("");
      return '<div class="body">' + paras + '<ul class="keys">' + items + "</ul></div>";
    }

    return (
      '<div class="body">' +
      lines
        .map(function (l) {
          return "<p>" + escapeHtml(l) + "</p>";
        })
        .join("") +
      "</div>"
    );
  }

  function renderBoot() {
    var shown = BOOT_LINES.slice(0, state.bootCount)
      .map(function (line) {
        return "<div>" + escapeHtml(line) + "</div>";
      })
      .join("");
    var caret = state.bootCount < BOOT_LINES.length ? '<span class="caret"></span>' : "";
    app.innerHTML =
      '<main class="gate" id="boot-gate" tabindex="0" role="button">' +
      '<img class="flicker" src="assets/logo-mark.png" alt="NO EYES">' +
      '<small style="letter-spacing:0.5em;color:var(--color-faded);text-transform:uppercase">arquivo legado</small>' +
      "<h1>NO EYES</h1>" +
      '<p class="phosphor">portal de agentes · desativado 11.2009</p>' +
      '<div class="boot-log" style="margin-top:28px;text-align:left">' +
      shown +
      caret +
      "</div>" +
      '<p style="margin-top:32px;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--color-faded)">clique para continuar</p>' +
      "</main>";

    var gate = document.getElementById("boot-gate");
    gate.addEventListener("click", finishBoot);
    gate.addEventListener("keydown", function (e) {
      if (e.key === "Enter") finishBoot();
    });
    gate.focus();

    if (state.bootCount < BOOT_LINES.length) {
      later(function () {
        state.bootCount += 1;
        render();
      }, 280);
    } else {
      later(finishBoot, 700);
    }
  }

  function typewriterHtml() {
    var full = LETTER.join("\n\n");
    var visible = state.skipIntro ? full.length : state.introChars;
    var shown = full.slice(0, visible);
    var parts = shown.split("\n\n");
    return parts
      .map(function (p, i) {
        var slogan = p === "SOMOS NO EYES";
        var caret =
          i === parts.length - 1 && visible < full.length ? '<span class="caret"></span>' : "";
        return (
          '<p class="' +
          (slogan ? "slogan" : "") +
          '">' +
          escapeHtml(p).replace(/\n/g, "<br>") +
          caret +
          "</p>"
        );
      })
      .join("");
  }

  function tickTypewriter() {
    var full = LETTER.join("\n\n");
    if (state.skipIntro || state.introChars >= full.length) {
      if (!state.introDone) {
        state.introDone = true;
        var toolbar = document.getElementById("intro-toolbar");
        if (toolbar) {
          toolbar.innerHTML =
            '<button class="ghost" type="button" id="btn-enter">iniciar barreira de 16 enigmas</button>';
          document.getElementById("btn-enter").addEventListener("click", enterBarrier);
        }
      }
      return;
    }
    var ch = full[state.introChars] || "";
    var delay = ch === "\n" ? 140 : ch === "." || ch === "?" ? 55 : 14;
    later(function () {
      state.introChars += 1;
      var body = document.getElementById("typewriter-body");
      if (body) body.innerHTML = typewriterHtml();
      tickTypewriter();
    }, delay);
  }

  function renderIntro() {
    var done = state.introDone || state.skipIntro;
    app.innerHTML =
      headerHtml("vazamento · cópia não oficial") +
      '<main class="wrap wrap-sm">' +
      '<p class="phosphor" style="margin-bottom:16px">transmissão interceptada · agente não identificado</p>' +
      '<article class="paper rise">' +
      '<div class="paper-head"><div>' +
      '<small style="letter-spacing:0.3em;color:var(--color-stamp)">CLASSIFICADO · HRT-LEAK</small>' +
      '<h2 style="font-family:var(--font-type);font-weight:400;margin:6px 0;font-size:22px">Antes dos enigmas</h2>' +
      '<p style="margin:0;font-size:13px">data ilegível · 2009</p>' +
      '</div><span class="stamp">cópia</span></div>' +
      '<div class="body" id="typewriter-body" aria-live="polite">' +
      typewriterHtml() +
      "</div>" +
      '<div class="toolbar" id="intro-toolbar">' +
      (done
        ? '<button class="ghost" type="button" id="btn-enter">iniciar barreira de 16 enigmas</button>'
        : '<button class="ghost" type="button" id="btn-skip">pular transmissão</button>') +
      "</div></article></main>";

    var skip = document.getElementById("btn-skip");
    if (skip) {
      skip.addEventListener("click", function () {
        state.skipIntro = true;
        state.introDone = true;
        state.introChars = LETTER.join("\n\n").length;
        clearTimers();
        render();
      });
    }
    var enter = document.getElementById("btn-enter");
    if (enter) enter.addEventListener("click", enterBarrier);
    if (!done) tickTypewriter();
  }

  function renderEnigma() {
    var enigma = ENIGMAS[state.index];
    if (!enigma) return;
    var articleClass = state.ok ? "paper rise flash-ok" : "paper rise";
    var formClass = state.shake ? "toolbar shake" : "toolbar";
    app.innerHTML =
      headerHtml(
        state.ok ? "chave aceita · avançando" : "barreira de 16 enigmas",
        state.ok
      ) +
      '<main class="wrap wrap-sm">' +
      '<button class="back" type="button" id="btn-back" style="margin-bottom:16px">← manifesto</button>' +
      '<section class="panel" style="margin-bottom:20px">' +
      '<small class="phosphor">dossiê ativo · caso hartmann</small>' +
      '<p style="margin:8px 0 12px;color:var(--color-faded);font-size:12px">ficha ' +
      pad2(enigma.id) +
      " / " +
      pad2(TOTAL) +
      "</p>" +
      progressHtml(state.index, state.index) +
      "</section>" +
      '<article class="' +
      articleClass +
      '">' +
      '<div class="paper-head"><div>' +
      '<small style="letter-spacing:0.3em;color:var(--color-stamp)">' +
      escapeHtml(enigma.classification) +
      " · " +
      escapeHtml(enigma.code) +
      "</small>" +
      '<h2 style="font-family:var(--font-type);font-weight:400;margin:6px 0;font-size:22px">' +
      escapeHtml(enigma.title) +
      "</h2>" +
      '<p style="margin:0;font-size:13px">enigma ' +
      enigma.id +
      " de " +
      TOTAL +
      "</p></div>" +
      '<span class="' +
      (state.ok ? "stamp ok" : "stamp") +
      '">' +
      (state.ok ? "liberado" : "selado") +
      "</span></div>" +
      enigmaBody(enigma) +
      '<form class="' +
      formClass +
      '" id="chave-form">' +
      '<label for="chave" style="display:block;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:var(--color-ink);opacity:0.7;margin-bottom:4px">chave parcial</label>' +
      '<input id="chave" class="field paper-field" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="digite a resposta"' +
      (state.ok ? " disabled" : "") +
      ' value="' +
      escapeHtml(state.input) +
      '">' +
      (state.error
        ? '<p class="error" style="margin-top:12px;margin-bottom:0" role="alert">' +
          escapeHtml(state.error) +
          "</p>"
        : "") +
      '<div style="margin-top:14px">' +
      '<button class="ghost" type="submit" id="btn-confirm"' +
      (state.ok || !state.input.trim() ? " disabled" : "") +
      ">" +
      (state.ok ? "aceito" : "confirmar") +
      "</button></div></form></article></main>";

    document.getElementById("btn-back").addEventListener("click", function () {
      state.view = "intro";
      state.skipIntro = true;
      state.introDone = true;
      state.introChars = LETTER.join("\n\n").length;
      render();
    });

    var input = document.getElementById("chave");
    var confirm = document.getElementById("btn-confirm");
    input.addEventListener("input", function () {
      state.input = input.value;
      if (state.error) {
        state.error = "";
        var err = document.querySelector(".error");
        if (err) err.remove();
      }
      confirm.disabled = state.ok || !input.value.trim();
    });
    document.getElementById("chave-form").addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.ok || !enigma) return;
      if (matchesAnswer(input.value, enigma.answers)) {
        state.error = "";
        state.ok = true;
        state.input = input.value;
        render();
        later(solve, 650);
        return;
      }
      state.error = "acesso negado";
      state.shake += 1;
      state.input = input.value;
      render();
    });
    if (!state.ok) input.focus();
  }

  function renderUnlock() {
    app.innerHTML =
      headerHtml("acesso autorizado · arquivo liberado", true) +
      '<main class="wrap wrap-sm">' +
      '<section class="panel" style="margin-bottom:20px">' +
      '<small class="phosphor">barreira rompida · 16/16</small>' +
      '<p style="font-family:var(--font-type);font-size:22px;margin:8px 0 14px">Caso da família Hartmann</p>' +
      progressHtml(16) +
      "</section>" +
      '<article class="paper rise">' +
      '<div class="paper-head"><div>' +
      '<small style="letter-spacing:0.3em;color:var(--color-stamp)">NÍVEL ZERO · HRT-091009</small>' +
      '<h2 style="font-family:var(--font-type);font-weight:400;margin:6px 0;font-size:22px">Os documentos</h2>' +
      '<p style="margin:0;font-size:13px">aberto 10.09.2009 · status: inconclusivo</p>' +
      '</div><span class="stamp ok">liberado</span></div>' +
      '<div class="body"><p>Você passou da barreira. O que vem agora não deveria estar numa tela. Foram copiados por um agente antes do selo. A hierarquia nega o porão. O resto está nas fichas.</p>' +
      "<p>O arquivo interno original continua no endereço abaixo. Abra com cuidado. Eles ainda procuram quem vazou isto.</p></div>" +
      '<div class="toolbar">' +
      '<a class="unlock-link" href="' +
      escapeHtml(ARCHIVE_URL) +
      '" target="_blank" rel="noreferrer">abrir arquivo interno</a>' +
      '<p style="margin:14px 0 0;font-size:11px;letter-spacing:0.08em;color:rgb(26 23 18 / 0.55);word-break:break-all">' +
      escapeHtml(ARCHIVE_URL) +
      "</p></div></article>" +
      '<p style="text-align:center;margin-top:28px">' +
      '<button class="linkish" type="button" id="btn-reset">reiniciar barreira</button></p></main>';

    document.getElementById("btn-reset").addEventListener("click", resetBarrier);
  }

  function render() {
    clearTimers();
    if (state.view === "boot") renderBoot();
    else if (state.view === "unlock") renderUnlock();
    else if (state.view === "enigma") renderEnigma();
    else renderIntro();
    var brand = app.querySelector(".brand");
    if (brand) {
      brand.addEventListener("click", function (e) {
        e.preventDefault();
      });
    }
  }

  function finishBoot() {
    if (state.view !== "boot") return;
    state.view = "intro";
    render();
  }

  function enterBarrier() {
    state.view = state.index >= TOTAL ? "unlock" : "enigma";
    state.input = "";
    state.error = "";
    state.ok = false;
    persist();
    render();
  }

  function solve() {
    if (state.index >= TOTAL) {
      state.view = "unlock";
      render();
      return;
    }
    var canonical = normalizeKey((ENIGMAS[state.index] && ENIGMAS[state.index].answers[0]) || "");
    state.answers = state.answers.concat([canonical]);
    state.index += 1;
    state.input = "";
    state.error = "";
    state.ok = false;
    state.view = state.index >= TOTAL ? "unlock" : "enigma";
    persist();
    render();
  }

  function resetBarrier() {
    state.index = 0;
    state.answers = [];
    state.view = "intro";
    state.skipIntro = true;
    state.introDone = true;
    state.introChars = LETTER.join("\n\n").length;
    writeSaved({ index: 0, answers: [], started: false });
    render();
  }

  function hydrate() {
    var saved = readSaved() || { index: 0, answers: [], started: false };
    var index = Math.min(Math.max(saved.index, 0), TOTAL);
    var answers = saved.answers.slice(0, index).map(function (a, i) {
      var canonical = ENIGMAS[i] && ENIGMAS[i].answers[0];
      return canonical ? normalizeKey(canonical) : normalizeKey(a);
    });
    state.index = index;
    state.answers = answers;
    if (index >= TOTAL) {
      state.view = "unlock";
    } else if (saved.started) {
      state.view = "enigma";
    } else {
      state.view = "boot";
    }
    render();
  }

  hydrate();
})();
