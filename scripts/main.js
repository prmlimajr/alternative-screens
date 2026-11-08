/**
 * Alternative Screens
 * - Tela de loading personalizada no carregamento do mundo e na troca de cenas.
 * - Tela de pausa personalizada (substitui o indicador padrão do Foundry).
 */
const MODULE_ID = "alternative-screens";

const cfg = (chave) => game.settings.get(MODULE_ID, chave);

/** Textos usados antes das traduções carregarem (hook i18nInit). */
const PADRAO = {
  "Status.Inicializando": "Inicializando...",
  "Status.Traducoes": "Carregando traduções...",
  "Status.Mundo": "Preparando o mundo...",
  "Status.Encerrando": "Encerrando a cena anterior...",
  "Status.Cena": "Carregando {cena}...",
  "Status.CenaSemNome": "Carregando a cena...",
  "Status.Recursos": "Carregando recursos ({feitos}/{total})...",
  "Status.Interface": "Montando a interface...",
  "Status.Pronto": "Pronto!"
};

function loc(chave, dados = {}) {
  const key = `ALTS.${chave}`;
  let s = game.i18n?.has?.(key) ? game.i18n.localize(key) : PADRAO[chave] ?? key;
  for (const [k, v] of Object.entries(dados)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

/* -------------------------------------------- */
/*  Utilidades de DOM                           */
/* -------------------------------------------- */

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto) e.textContent = texto;
  return e;
}

function midia(src, classe) {
  const video = /\.(webm|mp4|m4v|ogv)$/i.test(String(src).split("?")[0]);
  const m = el(video ? "video" : "img", classe);
  m.src = src;
  if (video) Object.assign(m, { muted: true, autoplay: true, loop: true, playsInline: true });
  return m;
}

function frases(chave) {
  return String(cfg(chave) ?? "")
    .split("|")
    .map((f) => f.trim())
    .filter(Boolean);
}

const sortear = (lista, evitar) => {
  const opcoes = lista.length > 1 ? lista.filter((f) => f !== evitar) : lista;
  return opcoes[Math.floor(Math.random() * opcoes.length)] ?? "";
};

/** Aceita "Nome da Fonte" ou uma lista CSS completa. */
function familia(valor, reserva) {
  const v = String(valor ?? "").trim();
  if (!v) return reserva;
  return /[,"']/.test(v) ? v : `"${v}", ${reserva}`;
}

function aplicarVisual(raiz) {
  raiz.style.setProperty("--alts-cor1", cfg("corPrimaria") || "#e0452b");
  raiz.style.setProperty("--alts-cor2", cfg("corSecundaria") || "#5b7cff");
  raiz.style.setProperty("--alts-fonte-titulo", familia(cfg("fonteTitulo"), "serif"));
  raiz.style.setProperty("--alts-fonte-frase", familia(cfg("fonteFrase"), "monospace"));
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------- */
/*  Tela de loading                             */
/* -------------------------------------------- */

const L = {
  ui: null, // { raiz, barra, status, frase }
  alvo: 0,
  atual: 0,
  desde: 0,
  minimo: 0,
  geracao: 0,
  raf: null,
  timerFrase: null,
  timerMostrar: null,
  cenaAnterior: null
};

function construirLoading() {
  const raiz = el("div", "alts-tela alts-loading");
  raiz.id = "alts-loading";
  raiz.setAttribute("role", "status");
  aplicarVisual(raiz);

  const fundo = cfg("loadingFundo");
  if (fundo) raiz.append(midia(fundo, "alts-fundo"));
  raiz.append(el("div", "alts-veu"));

  const c = el("div", "alts-conteudo");
  const logo = cfg("loadingLogo");
  if (logo) c.append(midia(logo, "alts-logo"));
  const chamada = cfg("loadingChamada");
  if (chamada) c.append(el("p", "alts-chamada", chamada));
  c.append(el("h1", "alts-titulo", cfg("loadingTitulo") || game.world?.title || ""));

  const trilho = el("div", "alts-trilho");
  const barra = el("div", "alts-barra");
  trilho.append(barra);
  const status = el("p", "alts-status");
  const frase = el("p", "alts-frase");
  c.append(trilho, status, frase);
  raiz.append(c);

  document.body.append(raiz);
  return { raiz, barra, status, frase };
}

function trocarFrase() {
  if (!L.ui) return;
  const lista = frases("loadingFrases");
  const f = L.ui.frase;
  f.classList.add("alts-sumindo");
  setTimeout(() => {
    f.textContent = lista.length ? `"${sortear(lista, f.textContent.slice(1, -1))}"` : "";
    f.classList.remove("alts-sumindo");
  }, 300);
}

function animarBarra() {
  if (!L.ui) return;
  if (L.atual < L.alvo) L.atual += Math.max(0.15, (L.alvo - L.atual) * 0.1);
  else if (L.alvo < 90) L.alvo += 0.03; // avanço lento enquanto espera a próxima etapa
  L.atual = Math.min(L.atual, L.alvo, 100);
  L.ui.barra.style.width = `${L.atual}%`;
  L.raf = requestAnimationFrame(animarBarra);
}

function mostrarLoading() {
  if (!cfg("loadingAtivo")) return;
  clearTimeout(L.timerMostrar);
  L.timerMostrar = null;
  L.geracao++; // cancela um esconderLoading que esteja aguardando
  if (L.ui) return;

  L.ui = construirLoading();
  L.alvo = L.atual = 0;
  L.desde = performance.now();
  document.body.classList.add("alts-carregando");
  L.ui.frase.textContent = "";
  trocarFrase();
  L.timerFrase = setInterval(trocarFrase, 7000);
  requestAnimationFrame(() => L.ui?.raiz.classList.add("visivel"));
  animarBarra();
}

function progresso(pct, status) {
  if (!L.ui) return;
  L.alvo = Math.max(L.alvo, Math.min(pct, 100));
  if (status) L.ui.status.textContent = status;
}

async function esconderLoading() {
  clearTimeout(L.timerMostrar);
  L.timerMostrar = null;
  if (!L.ui) return;

  const geracao = ++L.geracao;
  progresso(100, loc("Status.Pronto"));
  await esperar(Math.max(400, L.minimo - (performance.now() - L.desde)));
  if (geracao !== L.geracao || !L.ui) return; // foi reaberta nesse meio-tempo

  const { raiz } = L.ui;
  L.ui = null;
  cancelAnimationFrame(L.raf);
  clearInterval(L.timerFrase);
  document.body.classList.remove("alts-carregando");
  raiz.classList.remove("visivel");
  setTimeout(() => raiz.remove(), 700);
}

/**
 * Mostra o progresso real das texturas da cena.
 * Envolve TextureLoader#load e conta cada loadTexture concluído. Se a API interna
 * mudar, a barra continua funcionando só com as etapas (hooks).
 */
function instalarProgressoTexturas() {
  const TL = foundry.canvas?.TextureLoader ?? globalThis.TextureLoader;
  const load = TL?.prototype?.load;
  if (typeof load !== "function") return;

  TL.prototype.load = async function (sources, options) {
    const lista = sources ? Array.from(sources) : [];
    if (!L.ui || !lista.length || this._altsContando || typeof this.loadTexture !== "function") {
      return load.call(this, sources, options);
    }
    const total = lista.length;
    let feitos = 0;
    const proprio = Object.hasOwn(this, "loadTexture");
    const anterior = this.loadTexture;
    this._altsContando = true;
    this.loadTexture = async (...args) => {
      try {
        return await anterior.apply(this, args);
      } finally {
        feitos++;
        progresso(30 + (60 * feitos) / total, loc("Status.Recursos", { feitos, total }));
      }
    };
    try {
      return await load.call(this, sources, options);
    } finally {
      if (proprio) this.loadTexture = anterior;
      else delete this.loadTexture;
      delete this._altsContando;
    }
  };
}

function nomeDaCena(cena) {
  if (!cena || !cfg("mostrarNomeCena")) return null;
  return cena.navName || cena.name || null;
}

export function previewLoading() {
  L.minimo = 0;
  mostrarLoading();
  if (!L.ui) return ui.notifications.warn(game.i18n.localize("ALTS.Avisos.LoadingDesativado"));
  L.ui.raiz.classList.add("alts-preview");
  L.ui.raiz.addEventListener("click", () => esconderLoading(), { once: true });
  const etapas = [
    [10, loc("Status.Encerrando")],
    [30, loc("Status.Cena", { cena: game.scenes?.viewed?.name ?? "..." })],
    [60, loc("Status.Recursos", { feitos: 12, total: 24 })],
    [90, loc("Status.Interface")]
  ];
  etapas.forEach(([pct, txt], i) => setTimeout(() => progresso(pct, txt), 800 * (i + 1)));
  setTimeout(() => L.ui?.raiz.classList.contains("alts-preview") && esconderLoading(), 6000);
}

/* -------------------------------------------- */
/*  Tela de pausa                               */
/* -------------------------------------------- */

const P = { raiz: null };

function construirPausa() {
  const raiz = el("div", "alts-tela alts-pausa");
  raiz.id = "alts-pausa";
  aplicarVisual(raiz);
  raiz.style.setProperty("--alts-desfoque", `${cfg("pausaDesfoque")}px`);

  const cartao = el("div", "alts-cartao");
  cartao.append(el("h1", "alts-titulo-pausa", cfg("pausaTitulo")));
  const sub = cfg("pausaSubtitulo");
  if (sub) cartao.append(el("p", "alts-subtitulo", sub));
  const img = cfg("pausaImagem");
  if (img) cartao.append(midia(img, `alts-icone alts-anim-${cfg("pausaAnimacao")}`));
  const lista = frases("pausaFrases");
  if (lista.length) cartao.append(el("div", "alts-divisor"), el("p", "alts-frase", `"${sortear(lista)}"`));
  raiz.append(cartao);

  document.body.append(raiz);
  requestAnimationFrame(() => raiz.classList.add("visivel"));
  return raiz;
}

function mostrarPausa() {
  if (P.raiz) return;
  P.raiz = construirPausa();
}

function esconderPausa() {
  const raiz = P.raiz;
  if (!raiz) return;
  P.raiz = null;
  raiz.classList.remove("visivel");
  setTimeout(() => raiz.remove(), 500);
}

function atualizarPausa(pausado = game.paused) {
  const ativa = cfg("pausaAtiva");
  document.body.classList.toggle("alts-pausa-custom", ativa);
  if (ativa && pausado) mostrarPausa();
  else esconderPausa();
}

/** Recria a tela de pausa (para refletir mudanças nas configurações). */
function recriarPausa() {
  if (P.raiz) {
    P.raiz.remove();
    P.raiz = null;
  }
  if (game.ready) atualizarPausa();
}

export function previewPausa() {
  if (P.raiz) return;
  mostrarPausa();
  P.raiz.classList.add("alts-preview");
  P.raiz.addEventListener("click", () => esconderPausa(), { once: true });
}

/* -------------------------------------------- */
/*  Configurações                               */
/* -------------------------------------------- */

function registrarConfiguracoes() {
  const reg = (chave, dados) =>
    game.settings.register(MODULE_ID, chave, {
      name: `ALTS.Config.${chave}.Nome`,
      hint: `ALTS.Config.${chave}.Dica`,
      scope: "world",
      config: true,
      ...dados
    });

  // Botões de pré-visualização no topo das configurações do módulo.
  const AppV2 = foundry.applications.api.ApplicationV2;
  class PreviaLoading extends AppV2 {
    render() {
      previewLoading();
      return this;
    }
  }
  class PreviaPausa extends AppV2 {
    render() {
      previewPausa();
      return this;
    }
  }
  game.settings.registerMenu(MODULE_ID, "previaLoading", {
    name: "ALTS.Menu.PreviaLoading.Nome",
    label: "ALTS.Menu.PreviaLoading.Rotulo",
    hint: "ALTS.Menu.PreviaLoading.Dica",
    icon: "fa-solid fa-hourglass-half",
    type: PreviaLoading,
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "previaPausa", {
    name: "ALTS.Menu.PreviaPausa.Nome",
    label: "ALTS.Menu.PreviaPausa.Rotulo",
    hint: "ALTS.Menu.PreviaPausa.Dica",
    icon: "fa-solid fa-pause",
    type: PreviaPausa,
    restricted: true
  });

  // Loading
  reg("loadingAtivo", { type: Boolean, default: true });
  reg("loadingFundo", { type: String, default: "", filePicker: "imagevideo" });
  reg("loadingLogo", { type: String, default: "", filePicker: "imagevideo" });
  reg("loadingChamada", { type: String, default: "A história continua..." });
  reg("loadingTitulo", { type: String, default: "" });
  reg("loadingFrases", {
    type: String,
    default:
      "A jornada continua em instantes. Verifique sua ficha antes que seja tarde.|" +
      "Volte logo. Os monstros estão ficando impacientes.|" +
      "O mestre está escondendo mais algumas armadilhas.|" +
      "Afiando espadas e recarregando bestas..."
  });
  reg("mostrarNomeCena", { type: Boolean, default: true });
  reg("duracaoMinima", { type: Number, default: 1500, range: { min: 0, max: 6000, step: 250 } });

  // Pausa
  reg("pausaAtiva", { type: Boolean, default: true, onChange: () => recriarPausa() });
  reg("pausaTitulo", { type: String, default: "Jogo pausado", onChange: recriarPausa });
  reg("pausaSubtitulo", { type: String, default: "Voltamos já...", onChange: recriarPausa });
  reg("pausaImagem", { type: String, default: "icons/svg/hourglass.svg", filePicker: "imagevideo", onChange: recriarPausa });
  reg("pausaAnimacao", {
    type: String,
    default: "pulsar",
    choices: {
      pulsar: "ALTS.Config.pausaAnimacao.Pulsar",
      girar: "ALTS.Config.pausaAnimacao.Girar",
      flutuar: "ALTS.Config.pausaAnimacao.Flutuar",
      nenhuma: "ALTS.Config.pausaAnimacao.Nenhuma"
    },
    onChange: recriarPausa
  });
  reg("pausaFrases", {
    type: String,
    default:
      "Em pausa: o universo está carregando novas tragédias épicas.|" +
      "Os dados estão descansando. Aproveite para pegar um café.|" +
      "Nem os deuses de Arton trabalham sem intervalo.",
    onChange: recriarPausa
  });
  reg("pausaDesfoque", { type: Number, default: 6, range: { min: 0, max: 20, step: 1 }, onChange: recriarPausa });

  // Visual compartilhado
  reg("corPrimaria", { type: String, default: "#e0452b", onChange: recriarPausa });
  reg("corSecundaria", { type: String, default: "#5b7cff", onChange: recriarPausa });
  reg("fonteTitulo", { type: String, default: "Modesto Condensed", onChange: recriarPausa });
  reg("fonteFrase", { type: String, default: "Courier New, monospace", onChange: recriarPausa });
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registrarConfiguracoes();
  instalarProgressoTexturas();
  game.modules.get(MODULE_ID).api = { previewLoading, previewPausa };

  // Carregamento inicial do mundo.
  L.minimo = cfg("duracaoMinima");
  mostrarLoading();
  progresso(5, loc("Status.Inicializando"));
});

Hooks.once("i18nInit", () => progresso(10, loc("Status.Traducoes")));
Hooks.once("setup", () => progresso(20, loc("Status.Mundo")));

Hooks.on("canvasTearDown", () => {
  if (!game.ready || L.ui) return;
  // Atraso curto: redesenhos rápidos da mesma cena não piscam a tela.
  clearTimeout(L.timerMostrar);
  L.timerMostrar = setTimeout(() => {
    L.minimo = 0;
    mostrarLoading();
    progresso(10, loc("Status.Encerrando"));
  }, 150);
});

Hooks.on("canvasInit", (canvas) => {
  const cena = canvas.scene;
  const nova = cena?.id !== L.cenaAnterior;
  L.cenaAnterior = cena?.id ?? null;

  if (game.ready && nova) {
    L.minimo = cfg("duracaoMinima");
    mostrarLoading();
  }
  const nome = nomeDaCena(cena);
  progresso(30, nome ? loc("Status.Cena", { cena: nome }) : loc("Status.CenaSemNome"));
});

Hooks.on("canvasReady", () => {
  if (game.ready) esconderLoading();
  else progresso(95, loc("Status.Interface")); // carregamento inicial: espera o "ready"
});

Hooks.once("ready", () => {
  esconderLoading();
  atualizarPausa();
});

Hooks.on("pauseGame", (pausado) => atualizarPausa(pausado));
