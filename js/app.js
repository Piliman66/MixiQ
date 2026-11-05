import {ingelogd, login, uitloggen, verwerkTerugkeer, maakApi, alsNummer, SpotifyFout, log, logboek} from "./spotify.js?v=9";
import {SpotifySpeler, DemoSpeler} from "./speler.js?v=9";
import {maakSorteerbaar} from "./sorteer.js?v=9";

const $ = id => document.getElementById(id);
const PARAM = new URLSearchParams(location.search);
const DEMO = PARAM.has("demo");
const CLIENT_ID = (window.MIXIQ || {}).spotifyClientId || "";
const OPSLAG = DEMO ? "mixiq.demo" : "mixiq.staat";
const EINDE_MARGE = 800;      // reserve: zoveel ms voor het einde start MixiQ het volgende nummer zelf
const KLAARZET_MARGE = 15000; // zoveel ms voor het einde zet MixiQ het volgende nummer klaar in de wachtrij van Spotify

// de wachtrij is van MixiQ zelf; 'nu' is het nummer dat MixiQ het laatst heeft gestart
const staat = {wachtrij: [], nu: null, bevestig: true};
let gekozen = null;      // de aangeraakte rij (alleen markeren, nooit afspelen)
let speler, bron;

function bewaar() {
  try { localStorage.setItem(OPSLAG, JSON.stringify(staat)); } catch (e) {}
}
function laad() {
  try { Object.assign(staat, JSON.parse(localStorage.getItem(OPSLAG)) || {}); } catch (e) {}
}

// ---------- kleine hulpjes ----------

function el(tag, klasse, tekst) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (tekst != null) e.textContent = tekst;
  return e;
}
function knop(klasse, tekst, titel, actie) {
  const b = el("button", "rij-knop " + klasse, tekst);
  b.type = "button";
  if (titel) { b.title = titel; b.setAttribute("aria-label", titel); }
  b.addEventListener("click", e => { e.stopPropagation(); actie(); });
  return b;
}
function hoes(url) {
  const i = el("img", "hoes");
  i.alt = "";
  if (url) i.src = url;
  return i;
}
const tijd = ms => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
function totaal(ms) {
  const m = Math.round(ms / 60000);
  return m >= 60 ? Math.floor(m / 60) + " u " + (m % 60) + " min" : m + " min";
}
const sleutel = () => Math.random().toString(36).slice(2, 10);

let meldTimer;
function melding(tekst, duur = 2600) {
  const m = $("melding");
  m.textContent = tekst;
  m.hidden = false;
  clearTimeout(meldTimer);
  meldTimer = setTimeout(() => { m.hidden = true; }, duur);
}

function vraag({titel, tekst, ja, nietMeer = false}) {
  const d = $("dlg_vraag");
  $("vraag_titel").textContent = titel;
  $("vraag_tekst").textContent = tekst;
  $("vraag_ja").textContent = ja;
  $("vraag_vink").hidden = !nietMeer;
  $("vraag_niet_meer").checked = false;
  return new Promise(klaar => {
    const sluit = antwoord => { d.close(); $("vraag_ja").onclick = $("vraag_nee").onclick = null; klaar({ja: antwoord, nietMeer: $("vraag_niet_meer").checked}); };
    $("vraag_ja").onclick = () => sluit(true);
    $("vraag_nee").onclick = () => sluit(false);
    d.showModal();
  });
}

function foutMelding(e) {
  if (e instanceof SpotifyFout && (e.reden === "NO_ACTIVE_DEVICE" || e.status === 404)) {
    melding("Geen Spotify-apparaat actief. Open Spotify op je iPad of speaker en kies het bij Apparaat.");
    kiesApparaat();
  } else if (e instanceof SpotifyFout && e.reden === "PREMIUM_REQUIRED") {
    melding("Voor afspelen is Spotify Premium nodig.");
  } else {
    melding(e.message || "Er ging iets mis.");
  }
}

// ---------- afspelen ----------

let stand = null, standTijd = 0, bezig = false, vorigeRest = Infinity, gestartOp = 0;
let klaargezet = null, vorigeStand = "";  // het nummer dat bij Spotify klaarstaat; Spotify gaat er aan het einde zelf naartoe

async function start(nummer) {
  bezig = true;
  try {
    await speler.speel(nummer, {overslaan: klaargezet && klaargezet !== nummer ? 1 : 0});
    gestartOp = Date.now();
    klaargezet = null;
    staat.nu = nummer;
    stand = {speelt: true, positie: 0, duur: nummer.duur, uri: nummer.uri, nummer, apparaat: stand?.apparaat};
    standTijd = Date.now();
    vorigeRest = Infinity;
    bewaar();
    toonWachtrij();
    toonNu();
  } catch (e) {
    foutMelding(e);
    throw e;
  } finally {
    bezig = false;
  }
}

// Spotify heeft het klaargezette nummer opgepakt: dat is nu het huidige nummer
function klaargezetSpeelt() {
  const n = klaargezet;
  klaargezet = null;
  staat.nu = n;
  const i = staat.wachtrij.findIndex(x => x.sleutel === n.sleutel);
  if (i >= 0) staat.wachtrij.splice(i, 1);
  vorigeRest = Infinity;
  bewaar();
  toonWachtrij();
}

async function zetKlaar() {
  klaargezet = staat.wachtrij[0];
  log("klaarzetten: " + klaargezet.naam);
  try { await speler.klaarzetten(klaargezet); }
  catch (e) { klaargezet = null; }  // lukt het niet, dan start MixiQ het nummer aan het einde zelf
}

async function volgendNummer() {
  log("volgend nummer" + (klaargezet ? " (klaargezet)" : ""));
  if (!staat.wachtrij.length) { melding("De wachtrij is leeg."); return; }
  if (klaargezet) {  // staat al klaar bij Spotify: doorschuiven, anders speelt hij later nog een keer
    bezig = true;
    try {
      await speler.volgende();
      gestartOp = Date.now();
      const n = klaargezet;
      klaargezetSpeelt();
      stand = {speelt: true, positie: 0, duur: n.duur, uri: n.uri, nummer: n, apparaat: stand?.apparaat};
      standTijd = Date.now();
      toonNu();
    } catch (e) { foutMelding(e); }
    finally { bezig = false; }
    return;
  }
  const volgende = staat.wachtrij[0];
  try {
    await start(volgende);
    staat.wachtrij.shift();
    bewaar();
    toonWachtrij();
  } catch (e) { /* melding is al getoond; het nummer blijft in de wachtrij */ }
}

async function speelNu(index) {
  const n = staat.wachtrij[index];
  if (staat.bevestig && stand?.speelt) {
    const a = await vraag({titel: "Nu afspelen?", tekst: `${n.naam} start meteen; ${staat.nu ? staat.nu.naam : "het huidige nummer"} stopt.`,
                           ja: "Speel nu", nietMeer: true});
    if (!a.ja) return;
    if (a.nietMeer) { staat.bevestig = false; bewaar(); }
  }
  try {
    await start(n);
    staat.wachtrij.splice(staat.wachtrij.indexOf(n), 1);
    bewaar();
    toonWachtrij();
  } catch (e) {}
}

// Spotify vragen wat er speelt; aan het eind van een nummer start het volgende uit de wachtrij
async function peil() {
  if (bezig || Date.now() - gestartOp < 4000) return;  // net gestart: Spotify meldt soms nog even het vorige nummer
  try {
    const nieuw = await speler.stand();
    const kort = nieuw ? `${nieuw.speelt ? "speelt" : "stil"} ${nieuw.nummer?.naam || "?"} op ${nieuw.apparaat?.naam || "?"}` : "niets actief";
    if (kort !== vorigeStand) { log("Spotify: " + kort); vorigeStand = kort; }
    // net een nummer gestart, maar het apparaat speelt het niet: Spotify zegt "goed", het apparaat slaapt
    if (gestartOp && Date.now() - gestartOp < 12000 && staat.nu && !(nieuw?.speelt && nieuw.uri === staat.nu.uri)) {
      gestartOp = 0;
      log("apparaat speelt het nummer niet");
      melding(`${nieuw?.apparaat?.naam || "Het apparaat"} reageert niet. Open daar de Spotify-app, speel één nummer af en druk hier opnieuw op Volgende nummer.`, 9000);
      staat.wachtrij.unshift({...staat.nu, sleutel: sleutel()});  // het nummer terug bovenaan de wachtrij
      staat.nu = null;
      bewaar();
      toonWachtrij();
    }
    stand = nieuw;
    standTijd = Date.now();
    if (klaargezet && nieuw?.uri === klaargezet.uri) { log("Spotify pakt het klaargezette nummer"); klaargezetSpeelt(); }
    const nieuwNummer = nieuw?.nummer && nieuw.uri !== staat.nu?.uri;
    if (staat.nu && staat.wachtrij.length
        && ((nieuwNummer && nieuw.positie < 8000)                       // Spotify begint uit zichzelf aan een ander nummer (volgende uit de lijst of autoplay)
            || (vorigeRest < 3000 && (!nieuw || (!nieuw.speelt && nieuw.positie < 1500))))) {  // of stopt na het einde
      await volgendNummer();
    } else if (nieuwNummer) {
      log("volgen: " + nieuw.nummer.naam);
      // er speelt al een tijdje iets dat niet via MixiQ is gestart (▶ of de Spotify-app): dat volgen we,
      // zodat aan het einde daarvan toch het volgende nummer uit de wachtrij komt
      staat.nu = nieuw.nummer;
      vorigeRest = Infinity;
      bewaar();
    }
  } catch (e) { /* even geen verbinding: de volgende keer opnieuw */ }
  toonNu();
}

function tik() {
  if (stand && stand.duur) {
    const positie = Math.min(stand.duur, stand.speelt ? stand.positie + (Date.now() - standTijd) : stand.positie);
    const rest = stand.duur - positie;
    const vanOns = staat.nu && stand.uri === staat.nu.uri;
    if (stand.speelt && vanOns && !bezig && staat.wachtrij.length) {
      if (rest < KLAARZET_MARGE && !klaargezet) zetKlaar();
      else if (rest < EINDE_MARGE && !klaargezet) volgendNummer();
    }
    if (vanOns) vorigeRest = rest;
    $("nu_balk").style.width = (100 * positie / stand.duur) + "%";
    $("nu_tijd").textContent = tijd(positie);
    $("nu_duur").textContent = "-" + tijd(rest);
  }
}

function toonNu() {
  const n = stand?.nummer || staat.nu;
  $("nu_titel").textContent = n ? n.naam : "Niets";
  $("nu_artiest").textContent = n ? n.artiest : "Zet nummers in de wachtrij en druk op Volgende nummer";
  const h = n ? (n.hoesGroot || n.hoes) : "";
  if (h) $("nu_hoes").src = h; else $("nu_hoes").removeAttribute("src");
  $("knop_pauze").textContent = stand?.speelt ? "❚❚" : "▶";
  $("knop_apparaat").textContent = stand?.apparaat?.naam || "Apparaat";
  if (!stand?.duur) { $("nu_balk").style.width = "0"; $("nu_tijd").textContent = "0:00"; $("nu_duur").textContent = "0:00"; }
}

// ---------- wachtrij ----------

function toevoegen(n, hierna = false) {
  const kopie = {...n, sleutel: sleutel()};
  if (hierna) staat.wachtrij.unshift(kopie); else staat.wachtrij.push(kopie);
  bewaar();
  toonWachtrij();
  melding((hierna ? "Hierna: " : "In de wachtrij: ") + n.naam);
}

function toonWachtrij() {
  const ul = $("wachtrij_lijst");
  ul.replaceChildren();
  staat.wachtrij.forEach((n, i) => {
    const li = el("li", "rij" + (i === 0 ? " hierna" : "") + (gekozen === n.sleutel ? " gekozen" : ""));
    const greep = el("span", "greep", "≡");
    greep.title = "Slepen om te verplaatsen";
    const tekst = el("div", "tekst");
    if (i === 0) tekst.append(el("div", "label-hierna", "Hierna"));
    tekst.append(el("div", "titel", n.naam), el("div", "sub", n.artiest));
    li.append(greep, hoes(n.hoes), tekst, el("span", "duur", tijd(n.duur)));
    if (i > 0) li.append(knop("hierna-knop", "Hierna", "Direct na het huidige nummer zetten", () => {
      staat.wachtrij.unshift(...staat.wachtrij.splice(i, 1));
      bewaar(); toonWachtrij();
    }));
    li.append(knop("speel", "▶ Speel nu", "Nu afspelen", () => speelNu(i)),
              knop("weg", "×", "Uit de wachtrij halen", () => { staat.wachtrij.splice(i, 1); bewaar(); toonWachtrij(); }));
    // aanraken markeert de rij alleen; afspelen gaat uitsluitend met Speel nu
    li.addEventListener("click", () => { gekozen = gekozen === n.sleutel ? null : n.sleutel; toonWachtrij(); });
    ul.append(li);
  });
  $("wachtrij_leeg").hidden = staat.wachtrij.length > 0;
  $("wachtrij_info").textContent = staat.wachtrij.length
    ? `${staat.wachtrij.length} nummer${staat.wachtrij.length === 1 ? "" : "s"} · ${totaal(staat.wachtrij.reduce((s, n) => s + (n.duur || 0), 0))}` : "";
}

// ---------- bronnen: afspeellijsten en zoeken ----------

let bronNummers = [];

function nummerRij(n) {
  const li = el("li", "rij" + (gekozen === "bron:" + n.uri ? " gekozen" : ""));
  const tekst = el("div", "tekst");
  tekst.append(el("div", "titel", n.naam), el("div", "sub", n.artiest));
  li.append(hoes(n.hoes), tekst, el("span", "duur", tijd(n.duur)),
            knop("hierna-knop", "Hierna", "Direct na het huidige nummer zetten", () => toevoegen(n, true)),
            knop("", "+", "Achteraan in de wachtrij", () => toevoegen(n)));
  li.addEventListener("click", () => {
    gekozen = gekozen === "bron:" + n.uri ? null : "bron:" + n.uri;
    $("bron_lijst").querySelectorAll(".gekozen").forEach(x => x.classList.remove("gekozen"));
    if (gekozen) li.classList.add("gekozen");
  });
  return li;
}

function toonNummers(lijst) {
  bronNummers = lijst;
  $("bron_lijst").replaceChildren(...lijst.map(nummerRij));
  if (!lijst.length) $("bron_lijst").append(el("li", "leeg", "Geen nummers gevonden."));
}

async function toonLijsten() {
  $("bron_kop").hidden = true;
  const ul = $("bron_lijst");
  ul.replaceChildren(el("li", "leeg", "Afspeellijsten laden…"));
  try {
    const lijsten = await bron.lijsten();
    ul.replaceChildren(...lijsten.map(l => {
      const li = el("li", "rij lijst-rij");
      const tekst = el("div", "tekst");
      const sub = [l.aantal != null ? l.aantal + " nummers" : "", l.eigen === false ? "van een ander: Spotify geeft de nummers niet" : ""].filter(Boolean).join(" · ");
      tekst.append(el("div", "titel", l.naam), el("div", "sub", sub));
      if (l.eigen === false) li.classList.add("niet-eigen");
      li.append(hoes(l.hoes), tekst, el("span", "pijl", "›"));
      li.addEventListener("click", () => openLijst(l));  // een lijst openen speelt niets af
      return li;
    }));
  } catch (e) { ul.replaceChildren(el("li", "leeg", e.message)); }
}

async function openLijst(l) {
  $("bron_kop").hidden = false;
  $("bron_naam").textContent = l.naam;
  $("bron_lijst").replaceChildren(el("li", "leeg", "Nummers laden…"));
  try { toonNummers(await bron.nummers(l.id)); } catch (e) { $("bron_lijst").replaceChildren(el("li", "leeg", e.message)); }
}

let zoekTimer;
function zoek() {
  clearTimeout(zoekTimer);
  const q = $("zoek_veld").value.trim();
  if (!q) { $("bron_lijst").replaceChildren(); return; }
  zoekTimer = setTimeout(async () => {
    try { toonNummers(await bron.zoek(q)); } catch (e) { $("bron_lijst").replaceChildren(el("li", "leeg", e.message)); }
  }, 350);
}

function spotifyBron(api) {
  // Spotify (sinds februari 2026, development mode): de nummers van een lijst komen van /playlists/{id}/items en alleen
  // voor lijsten die je zelf hebt gemaakt of waar je aan meewerkt; zoeken geeft hooguit 10 per keer
  async function alles(pad, pak) {
    const uit = [];
    for (let url = pad; url; ) {
      const d = await api(url.replace("https://api.spotify.com/v1", ""));
      uit.push(...(d.items || []).map(pak).filter(Boolean));
      url = d.next;
    }
    return uit;
  }
  let ik = null;
  return {
    async lijsten() {
      ik = ik || (await api("/me")).id;
      const lijsten = await alles("/me/playlists?limit=50", p => p && {
        id: p.id, naam: p.name, aantal: (p.items || p.tracks)?.total, hoes: (p.images || []).slice(-1)[0]?.url,
        eigen: p.owner?.id === ik || p.collaborative,
      });
      return [{id: "__opgeslagen", naam: "Opgeslagen nummers", aantal: null, hoes: "", eigen: true}, ...lijsten];
    },
    async nummers(id) {
      if (id === "__opgeslagen") return alles("/me/tracks?limit=50", x => alsNummer(x.track));
      try {
        return await alles(`/playlists/${encodeURIComponent(id)}/items?limit=50`, x => alsNummer(x.item || x.track));
      } catch (e) {
        if (e.status === 403) throw new Error("Spotify geeft de nummers van deze lijst niet: dat kan alleen bij een lijst die je zelf hebt gemaakt of waar je aan meewerkt. Tip: maak in Spotify een eigen kopie van de lijst.");
        throw e;
      }
    },
    async zoek(q) {
      const pagina = offset => api(`/search?type=track&limit=10&offset=${offset}&q=` + encodeURIComponent(q));
      const delen = await Promise.all([0, 10, 20].map(pagina));
      return delen.flatMap(d => (d.tracks?.items || []).map(alsNummer).filter(Boolean));
    },
  };
}

// voorbeeldgegevens: verzonnen nummers, zodat de opzet zonder Spotify te bekijken is
function demoBron() {
  const kort = PARAM.has("kort");  // ?demo&kort: nummers van 20 seconden, om het doorschuiven te zien
  const kleuren = ["#e4572e", "#29335c", "#f3a712", "#669bbc", "#a8c686", "#8e44ad", "#16a085", "#c0392b"];
  const plaatje = (k, t) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${k}"/><text x="32" y="40" font-size="22" text-anchor="middle" fill="#fff" font-family="sans-serif">${t}</text></svg>`);
  const namen = [
    ["Warm Up", ["Morning Drive", "Low Tide", "Velvet Room", "Slow Burn", "First Light", "Open Road"]],
    ["Peak Time", ["Hands Up", "Bassline Fever", "Strobe", "Midnight Run", "Rise Again", "Overdrive", "Afterglow"]],
    ["Classics", ["Golden Days", "Old Skool", "Remember When", "Back To 95", "Disco Heart"]],
    ["Afsluiters", ["Last Call", "Sunrise", "Home Time", "Goodnight"]],
  ];
  const artiesten = ["DJ Noord", "Mila V", "The Basement", "Kaya", "Rotterdam Soundsystem", "Lune"];
  let k = 0;
  const lijsten = namen.map(([naam, titels], li) => ({
    id: "demo" + li, naam, aantal: titels.length, hoes: plaatje(kleuren[li], naam[0]),
    nummers: titels.map((t, ti) => {
      const kleur = kleuren[(k++) % kleuren.length];
      return {uri: `demo:${li}:${ti}`, naam: t, artiest: artiesten[(li + ti) % artiesten.length],
              duur: kort ? 20000 : (180 + ((li * 7 + ti * 13) % 140)) * 1000, hoes: plaatje(kleur, t[0]), bron: "demo"};
    }),
  }));
  return {
    async lijsten() { return lijsten; },
    async nummers(id) { return lijsten.find(l => l.id === id).nummers; },
    async zoek(q) { q = q.toLowerCase(); return lijsten.flatMap(l => l.nummers).filter(n => (n.naam + " " + n.artiest).toLowerCase().includes(q)); },
  };
}

// ---------- apparaat en instellingen ----------

async function kiesApparaat() {
  const ul = $("apparaat_lijst");
  ul.replaceChildren(el("li", "klein", "Apparaten zoeken…"));
  $("dlg_apparaat").showModal();
  try {
    const lijst = await speler.apparaten();
    ul.replaceChildren(...lijst.map(a => {
      const li = el("li");
      const b = el("button", a.actief ? "actief" : "", a.naam + " · " + a.soort);
      b.addEventListener("click", async () => {
        try { await speler.kiesApparaat(a.id, a.soort); $("dlg_apparaat").close(); melding("Geluid via " + a.naam); peil(); } catch (e) { foutMelding(e); }
      });
      li.append(b);
      return li;
    }));
    if (!lijst.length) ul.replaceChildren(el("li", "klein", "Geen apparaten gevonden."));
  } catch (e) { ul.replaceChildren(el("li", "klein", e.message)); }
}

function koppelKnoppen() {
  $("knop_pauze").addEventListener("click", async () => {
    try {
      if (stand?.speelt) await speler.pauze();
      else if (stand) await speler.hervat();
      else await volgendNummer();
    } catch (e) { foutMelding(e); }
    peil();
  });
  $("knop_volgende").addEventListener("click", volgendNummer);
  $("knop_apparaat").addEventListener("click", kiesApparaat);
  $("knop_menu").addEventListener("click", () => { $("inst_bevestig").checked = staat.bevestig; $("dlg_menu").showModal(); });
  $("inst_bevestig").addEventListener("change", e => { staat.bevestig = e.target.checked; bewaar(); });
  $("knop_uitloggen").addEventListener("click", () => {
    if (DEMO) { location.href = location.pathname; return; }
    uitloggen(); location.reload();
  });
  document.querySelectorAll(".venster .sluit").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
  $("knop_leeg").addEventListener("click", async () => {
    if (!staat.wachtrij.length) return;
    if ((await vraag({titel: "Wachtrij leegmaken?", tekst: `Alle ${staat.wachtrij.length} nummers gaan uit de wachtrij.`, ja: "Leegmaken"})).ja) {
      staat.wachtrij = []; bewaar(); toonWachtrij();
    }
  });
  $("knop_alles").addEventListener("click", () => {
    staat.wachtrij.push(...bronNummers.map(n => ({...n, sleutel: sleutel()})));
    bewaar(); toonWachtrij();
    melding(bronNummers.length + " nummers in de wachtrij gezet.");
  });
  $("knop_terug").addEventListener("click", toonLijsten);
  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("actief", x === b));
    const zoeken = b.dataset.tab === "zoeken";
    $("bron_zoek").hidden = !zoeken;
    if (zoeken) { $("bron_kop").hidden = true; $("bron_lijst").replaceChildren(); $("zoek_veld").focus(); zoek(); }
    else toonLijsten();
  }));
  $("zoek_veld").addEventListener("input", zoek);
  maakSorteerbaar($("wachtrij_lijst"), (van, naar) => {
    const [n] = staat.wachtrij.splice(van, 1);
    staat.wachtrij.splice(naar, 0, n);
    bewaar(); toonWachtrij();
  });
}

function toonLogboek() {
  let vak = $("logboek");
  if (!vak) {
    vak = el("pre", "logboek");
    vak.id = "logboek";
    vak.style.cssText = "position:fixed;left:8px;bottom:8px;width:min(520px,95vw);max-height:40vh;overflow:auto;margin:0;padding:8px;"
      + "background:#000c;color:#9f9;font:12px/1.4 ui-monospace,Menlo,monospace;border-radius:8px;z-index:50;white-space:pre-wrap";
    document.body.append(vak);
  }
  vak.textContent = logboek.join("\n");
}

function toonApp() {
  $("scherm_login").hidden = true;
  $("scherm_app").hidden = false;
  koppelKnoppen();
  if (PARAM.has("log")) { window.addEventListener("mixiq-log", toonLogboek); toonLogboek(); }
  toonWachtrij();
  toonNu();
  toonLijsten();
  peil();
  setInterval(peil, DEMO ? 1000 : 2000);
  setInterval(tik, 250);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) peil(); });
}

async function begin() {
  laad();
  if (DEMO) { speler = new DemoSpeler(); bron = demoBron(); toonApp(); return; }
  $("scherm_login").hidden = false;
  if (!CLIENT_ID) {
    $("knop_login").disabled = true;
    $("login_uitleg").textContent = "Vul eerst de Client ID van je Spotify-app in, in js/config.js.";
    return;
  }
  try { await verwerkTerugkeer(CLIENT_ID); } catch (e) { melding(e.message); }
  if (!ingelogd()) { $("knop_login").addEventListener("click", () => login(CLIENT_ID)); return; }
  const api = maakApi(CLIENT_ID);
  speler = new SpotifySpeler(api);
  bron = spotifyBron(api);
  toonApp();
}

begin();
