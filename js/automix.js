// De weergave "Automix": één groot scherm met boven wat er speelt, daaronder wat hierna komt en de afspeellijst
// waar Automix mee verder gaat als de wachtrij leeg is. Alle logica (afspelen, wachtrij, Spotify) zit in app.js;
// deze module tekent alleen en geeft knoppen door. Aanraken van een rij speelt nooit iets af.

const $ = id => document.getElementById(id);

export function maakAutomixWeergave(ctx) {
  const {staat, el, knop, tijd, totaal, zetHoes, acties} = ctx;
  let gekozen = null;          // aangeraakte rij: alleen markeren
  let bibModus = "nummers";    // "nummers": bladeren en toevoegen; "kies": de Automix-lijst kiezen
  let bibToevoegen = "achteraan";
  let bibNummers = [];

  // ---------- tekenen ----------

  function toonNu(stand, speler) {
    const n = stand?.nummer || staat.nu;
    $("am_titel").textContent = n ? n.naam : "Niets";
    $("am_artiest").textContent = n ? n.artiest : "Kies een afspeellijst en druk op ▶";
    zetHoes($("am_hoes"), n ? (n.hoesGroot || n.hoes) : "");
    $("am_pauze_ico").innerHTML = stand?.speelt
      ? '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>'
      : '<path d="M8 5l11 7-11 7z" fill="currentColor"/>';
    $("am_pauze").classList.toggle("speelt", !!stand?.speelt);
    $("am_apparaat_naam").textContent = stand?.apparaat?.naam || speler?.naam || "Kies apparaat";
    toonAutomixKnop();
    if (!stand?.duur) tik(0, 0, 0);
  }

  let sleepDeel = null;  // tijdens het slepen in de tijdbalk: toon die plek in plaats van de echte stand

  function tik(positie, rest, duur) {
    if (sleepDeel != null && duur) { positie = sleepDeel * duur; rest = duur - positie; }
    const deel = duur ? positie / duur : 0;
    $("am_ring").style.strokeDashoffset = String(1 - Math.min(1, Math.max(0, deel)));  // pathLength 1: 0 = vol
    $("am_gedaan").style.width = (100 * deel) + "%";
    $("am_kop").style.left = `calc(${100 * deel}% - 1px)`;
    // het blauwe stuk: waar de automatische mix begint
    const mixDeel = duur ? Math.min(1, (Math.max(staat.eindeMix, staat.mixduur) * 1000) / duur) : 0;
    $("am_mix").style.width = (100 * mixDeel) + "%";
    $("am_mix").hidden = !staat.automix.aan || !duur;
    $("am_rest").textContent = duur ? "-" + tijd(rest) : "";
    $("am_tijd").textContent = duur ? tijd(positie) : "";
    $("am_mixinfo").textContent = duur && staat.automix.aan ? `mixen vanaf -${tijd(Math.max(staat.eindeMix, staat.mixduur) * 1000)}` : "";
  }

  function rijHierna(n, i) {
    const li = el("li", "rij am-rij" + (gekozen === n.sleutel ? " gekozen" : ""));
    li.dataset.i = i;
    const titel = el("span", "am-t", n.naam);
    if (n.auto) titel.prepend(el("span", "am-label", "uit lijst"));
    li.append(ctx.hoes(n.hoes), titel, el("span", "am-a", n.artiest), el("span", "am-d", tijd(n.duur)));
    const greep = el("span", "greep am-greep", "≡");
    greep.title = "Slepen om te verplaatsen";
    li.append(greep);
    li.addEventListener("click", () => kies(n.sleutel, li, [
      ["speel", "Nu afspelen (met overgang)", () => acties.speelNu(i)],
      ["boven", "Bovenaan zetten: als eerste in Up Next", () => acties.naarVoren(i), i === 0],
      ["weg", "Uit de wachtrij halen", () => acties.verwijder(i)],
    ]));
    return li;
  }

  // ---------- aangeraakte rij: oranje rand en erboven een balkje met knoppen (zoals in djay) ----------

  const ICONEN = {
    speel: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
    boven: '<path d="M4 6h10M4 12h10M4 18h16M18 13V4m0 0l-3.5 3.5M18 4l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    volgende: '<path d="M4 6h10M4 12h10M4 18h16M18 13V4m0 0l-3.5 3.5M18 4l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    weg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 12h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    vanaf: '<path d="M5 12h11m0 0l-4-4m4 4l-4 4M20 5v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  let pop = null, popRij = null;

  function sluitPop() {
    pop?.remove(); pop = null;
    popRij?.classList.remove("gekozen"); popRij = null;
    gekozen = null;
  }

  function kies(sleutel, li, knoppen) {
    const zelfde = gekozen === sleutel;
    sluitPop();
    if (zelfde) return;  // nog een keer aanraken: weer dicht
    gekozen = sleutel; popRij = li; li.classList.add("gekozen");
    pop = el("div", "am-pop");
    for (const [ico, titel, actie, weg] of knoppen) {
      if (weg) continue;  // bv. "bovenaan zetten" bij het nummer dat al bovenaan staat: dan niet tonen
      const b = el("button", "am-pop-k");
      b.type = "button"; b.title = titel; b.setAttribute("aria-label", titel);
      b.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${ICONEN[ico]}</svg>`;
      b.addEventListener("click", e => { e.stopPropagation(); sluitPop(); actie(); });
      pop.append(b);
    }
    document.body.append(pop);
    // boven de rij, in het midden; past het daar niet (bovenaan de lijst), dan eronder
    const r = li.getBoundingClientRect(), p = pop.getBoundingClientRect();
    const boven = r.top - p.height - 10 > li.closest(".am-onder").getBoundingClientRect().top;
    pop.classList.toggle("onder", !boven);
    pop.style.left = Math.max(8, r.left + r.width / 2 - p.width / 2) + "px";
    pop.style.top = (boven ? r.top - p.height - 10 : r.bottom + 10) + "px";
  }

  // ---------- een seconde ingedrukt houden: infovenster met het nummer (zoals in djay) ----------

  const ICO = {
    hart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor"/>',
    hartLeeg: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="2"/>',
    rij: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    lijst: '<path d="M4 6h10M4 11h10M4 16h6M17 13v8M13 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  };
  let info = null;
  function sluitInfo() { info?.remove(); info = null; }

  async function openInfo(n, li, bron, i) {
    sluitPop(); sluitInfo();
    info = el("div", "am-nrinfo");
    const kop = el("div", "am-nrinfo-kop");
    const h = ctx.hoes(n.hoesGroot || n.hoes); h.classList.add("am-nrinfo-hoes");
    const tk = el("div", "am-nrinfo-tekst");
    tk.append(el("div", "am-nrinfo-titel", n.naam), el("div", "am-nrinfo-artiest", n.artiest));
    kop.append(h, tk);
    const gegevens = el("div", "am-nrinfo-gegevens");
    for (const [k, w] of [["Album", n.album || "—"], ["Tijd", tijd(n.duur)], ["Uit", bron === "wachtrij" ? "Up Next (wachtrij)" : (staat.automix.lijst?.naam || "Afspeellijst")]]) {
      const r = el("div", "am-nrinfo-r"); r.append(el("span", "", k), el("span", "", w)); gegevens.append(r);
    }
    const menu = el("div", "am-nrinfo-menu");
    const item = (ico, tekst, actie) => {
      const b = el("button", "am-nrinfo-item"); b.type = "button";
      b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${ICO[ico]}</svg>`;
      b.append(el("span", "", tekst));
      b.addEventListener("click", e => { e.stopPropagation(); actie(b); });
      menu.append(b); return b;
    };
    const hart = item("hartLeeg", "Opslaan in Spotify", async b => {
      const aan = !b.classList.contains("aan");
      try { await acties.zetOpgeslagen(n.uri, aan); zetHart(aan); ctx.melding(aan ? "Opgeslagen in je Spotify-bibliotheek" : "Uit je Spotify-bibliotheek gehaald"); }
      catch (e) { ctx.melding(e.message); }
    });
    const zetHart = aan => {
      hart.classList.toggle("aan", aan);
      hart.querySelector("svg").innerHTML = ICO[aan ? "hart" : "hartLeeg"];
      hart.querySelector("span").textContent = aan ? "Opgeslagen in Spotify" : "Opslaan in Spotify";
    };
    acties.opgeslagen(n.uri).then(zetHart).catch(() => {});
    item("rij", "Achteraan in de wachtrij", () => { sluitInfo(); acties.toevoegen(n); });
    item("lijst", "Toevoegen aan afspeellijst…", () => toonLijstKeuze(n));
    const speel = el("button", "am-nrinfo-speel", "Nu spelen"); speel.type = "button";
    speel.addEventListener("click", () => { sluitInfo(); if (bron === "wachtrij") acties.speelNu(i); else acties.speelNuUitLijst(n); });
    info.append(kop, gegevens, menu, speel);
    document.body.append(info);
    plaatsInfo(li);
  }

  // eigen venster: je eigen afspeellijsten onder elkaar, bovenaan een + voor een nieuwe lijst
  async function toonLijstKeuze(n) {
    const anker = info.getBoundingClientRect();
    sluitInfo();
    info = el("div", "am-nrinfo am-lijstkeuze");
    const kop = el("div", "am-lk-kop");
    const plus = el("button", "am-lk-plus", "+"); plus.type = "button"; plus.title = "Nieuwe afspeellijst"; plus.setAttribute("aria-label", "Nieuwe afspeellijst");
    kop.append(plus, el("span", "am-lk-titel", "Toevoegen aan afspeellijst"));
    const ul = el("div", "am-lk-lijst");
    ul.append(el("div", "am-nrinfo-leeg", "Afspeellijsten laden…"));
    info.append(kop, ul);
    document.body.append(info);
    info.style.left = anker.left + "px"; info.style.top = anker.top + "px";

    const toevoegen = async l => {
      try { await acties.lijstToevoegen(l.id, n.uri); sluitInfo(); ctx.melding(`${n.naam} toegevoegd aan ${l.naam}`); }
      catch (x) { ctx.melding(x.message); }
    };
    plus.addEventListener("click", e => { e.stopPropagation(); nieuweLijstVenster(toevoegen); });
    try {
      const eigen = (await acties.lijsten()).filter(l => l.eigen !== false && !l.id.startsWith("__"));
      const ICOON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 6h10M4 11h10M4 16h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17 5v10.5a2.5 2.5 0 1 1-2-2.45V5h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      ul.replaceChildren(...eigen.map(l => {
        const b = el("button", "am-lk-item"); b.type = "button";
        const ico = el("span", "am-lk-ico"); ico.innerHTML = ICOON;
        b.append(ico, el("span", "am-lk-naam", l.naam));
        b.addEventListener("click", e => { e.stopPropagation(); toevoegen(l); });
        return b;
      }));
      if (!eigen.length) ul.replaceChildren(el("div", "am-nrinfo-leeg", "Nog geen eigen afspeellijsten. Maak er een met +."));
    } catch (e) { ul.replaceChildren(el("div", "am-nrinfo-leeg", e.message)); }
    // binnen het scherm houden
    const p = info.getBoundingClientRect();
    if (p.bottom > window.innerHeight - 8) info.style.top = Math.max(8, window.innerHeight - p.height - 8) + "px";
  }

  // venster in het midden: naam voor de nieuwe afspeellijst, Annuleren en Toevoegen (pas te kiezen met een naam)
  function nieuweLijstVenster(daarna) {
    const d = el("dialog", "am-nieuwlijst");
    const f = el("form"); f.method = "dialog";
    const veld = el("input"); veld.placeholder = "Naam van de afspeellijst"; veld.maxLength = 100; veld.autocomplete = "off";
    const knoppen = el("div", "am-nl-knoppen");
    const annuleer = el("button", "am-nl-k", "Annuleren"); annuleer.type = "button";
    const voeg = el("button", "am-nl-k toevoegen", "Toevoegen"); voeg.type = "submit"; voeg.disabled = true;
    knoppen.append(annuleer, voeg);
    f.append(el("h3", "", "Nieuwe afspeellijst"), el("p", "", "Geef de nieuwe afspeellijst een naam. Hij komt als privélijst in je Spotify."), veld, knoppen);
    d.append(f);
    document.body.append(d);
    const weg = () => { d.close(); d.remove(); };
    veld.addEventListener("input", () => { voeg.disabled = !veld.value.trim(); });
    annuleer.addEventListener("click", weg);
    d.addEventListener("cancel", e => { e.preventDefault(); weg(); });
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const naam = veld.value.trim();
      if (!naam) return;
      voeg.disabled = true;
      try { const l = await acties.nieuweLijst(naam); weg(); await daarna(l); }
      catch (x) { ctx.melding(x.message); voeg.disabled = false; }
    });
    d.showModal();
    veld.focus();
  }

  // boven de rij als het past, anders eronder; altijd binnen het scherm
  function plaatsInfo(li) {
    const r = li.getBoundingClientRect(), p = info.getBoundingClientRect();
    const boven = r.top - p.height - 12 > 8;
    info.classList.toggle("onder", !boven);
    info.style.left = Math.min(window.innerWidth - p.width - 8, Math.max(8, r.left + r.width / 2 - p.width / 2)) + "px";
    info.style.top = Math.max(8, Math.min(window.innerHeight - p.height - 8, boven ? r.top - p.height - 12 : r.bottom + 12)) + "px";
  }

  // lang indrukken (ongeveer een seconde) op een rij; niet op de greep, niet als je gaat scrollen
  function langIndrukken(ul, bron) {
    let klok = null, start = null, open = false;
    ul.addEventListener("pointerdown", e => {
      const li = e.target.closest(".am-rij");
      if (!li || e.target.closest(".greep")) return;
      start = [e.clientX, e.clientY]; open = false;
      klok = setTimeout(() => {
        const i = +li.dataset.i;
        const n = bron === "wachtrij" ? staat.wachtrij[i] : ctx.automixNummers()[i];
        if (n) { open = true; openInfo(n, li, bron, i); }
      }, 700);
    });
    const stop = () => { clearTimeout(klok); klok = null; };
    ul.addEventListener("pointermove", e => { if (klok && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 10) stop(); });
    ul.addEventListener("pointerup", stop);
    ul.addEventListener("pointercancel", stop);
    ul.addEventListener("contextmenu", e => { if (e.target.closest(".am-rij")) e.preventDefault(); });
    // de tik die op het loslaten volgt, opent niet ook nog het balkje
    ul.addEventListener("click", e => { if (open) { e.stopPropagation(); e.preventDefault(); open = false; } }, true);
  }

  function toonWachtrij() {
    // rechtsboven: het volgende nummer uit de wachtrij
    const volgt = staat.wachtrij[0];
    $("am_volgt_titel").textContent = volgt ? volgt.naam : "Nog niets";
    $("am_volgt_artiest").textContent = volgt ? volgt.artiest : (staat.automix.aan && staat.automix.lijst ? "Automix kiest uit " + staat.automix.lijst.naam : "Zet een nummer in de wachtrij");
    zetHoes($("am_volgt_hoes"), volgt ? volgt.hoes : "");
    $("am_volgt_duur").textContent = volgt?.duur ? tijd(volgt.duur) : "";
    const ul = $("am_hierna");
    if (popRij && ul.contains(popRij)) sluitPop();
    ul.replaceChildren(...staat.wachtrij.map(rijHierna));
    if (!staat.wachtrij.length) {
      ul.append(el("li", "am-leeg", staat.automix.aan && staat.automix.lijst
        ? "Automix pakt zo het volgende nummer uit de lijst hieronder."
        : "Nog niets. Tik op + of kies hieronder een nummer met ↱ Volgende."));
    }
    $("am_hierna_info").textContent = staat.wachtrij.length
      ? `${staat.wachtrij.length} · ${totaal(staat.wachtrij.reduce((s, n) => s + (n.duur || 0), 0))}` : "";
    toonBron();
  }

  function toonBron() {
    const lijst = ctx.automixNummers();
    const a = staat.automix;
    $("am_bron_naam").textContent = a.lijst ? a.lijst.naam : "Geen afspeellijst";
    $("am_shuffle").classList.toggle("aan", !!a.shuffle);
    $("am_herhaal").classList.toggle("aan", !!a.herhaal);
    const ul = $("am_bronlijst");
    if (!a.lijst) { ul.replaceChildren(el("li", "am-leeg", "Kies onderaan een afspeellijst waar Automix mee verder gaat.")); return; }
    if (!lijst.length) { ul.replaceChildren(el("li", "am-leeg", ctx.automixLaadt() ? "Nummers laden…" : "Deze lijst heeft geen nummers.")); return; }
    const volgende = ctx.automixVolgendeIndex();
    if (popRij && ul.contains(popRij)) sluitPop();
    ul.replaceChildren(...lijst.map((n, i) => {
      const li = el("li", "rij am-rij" + (gekozen === "bron:" + i ? " gekozen" : "")
        + (!a.shuffle && i < a.pos ? " gespeeld" : "") + (i === volgende ? " volgt" : ""));
      li.dataset.i = i;
      const greep = el("span", "greep am-greep", "≡");
      greep.title = "Slepen: omhoog of omlaag in de Automix-rij, of naar boven op Up Next";
      li.append(ctx.hoes(n.hoes), el("span", "am-t", n.naam), el("span", "am-a", n.artiest), el("span", "am-d", tijd(n.duur)), greep);
      li.addEventListener("click", () => kies("bron:" + i, li, [
        ["speel", "Nu afspelen (met overgang)", () => acties.speelNuUitLijst(n)],
        ["volgende", "Bovenaan zetten: als eerste in Up Next", () => acties.toevoegen(n, true)],
        ["weg", "Uit de Automix-rij halen (de Spotify-lijst blijft zoals hij is)", () => acties.automixVerwijder(i)],
      ]));
      return li;
    }));
  }

  function toonAutomixKnop() {
    $("am_automix").classList.toggle("uit", !staat.automix.aan);
    $("am_automix_tekst").textContent = staat.automix.aan ? "AUTOMIX" : "AUTOMIX UIT";
  }

  // ---------- het Automix-menu ----------

  function openAutomixMenu() {
    $("am_m_klassiek").hidden = staat.weergave === "klassiek";
    $("am_m_set").hidden = staat.weergave === "set";
    $("am_m_automixw").hidden = staat.weergave === "automix";
    $("am_m_aan").textContent = staat.automix.aan ? "Stop Automix" : "Start Automix";
    $("am_m_aan").classList.toggle("uit", !staat.automix.aan);
    $("am_m_duur").value = String(staat.mixduur);
    $("am_m_einde").value = String(staat.eindeMix);
    $("am_m_lijst").textContent = staat.automix.lijst ? staat.automix.lijst.naam : "kiezen…";
    $("am_m_shuffle").checked = !!staat.automix.shuffle;
    $("am_m_herhaal").checked = !!staat.automix.herhaal;
    $("dlg_am_automix").showModal();
  }

  // ---------- de bibliotheek (venster) ----------

  // ---------- venster Nummers kiezen (zoals Select Songs in djay) ----------

  let bibTab = "lijsten", bibTerug = null;  // bibTerug: wat ‹ terug doet
  let keuze = [];  // aangevinkte nummers (in de volgorde van aantikken); Klaar zet ze in Up Next

  const isGekozen = n => keuze.some(x => x.uri === n.uri);
  function toonKlaar() {
    $("am_bib_klaar").hidden = !keuze.length;
    $("am_bib_klaar_ruimte").hidden = !!keuze.length;
    $("am_bib_klaar").textContent = `Klaar (${keuze.length})`;
  }
  function zetPlus(knop, aan) {
    knop.classList.toggle("aan", aan);
    knop.textContent = aan ? "✓" : "+";
    knop.title = aan ? "Niet meer kiezen" : "Kiezen voor Up Next";
  }

  async function openBibliotheek(modus, toevoegen = "achteraan", metZoeken = false) {
    bibModus = modus; bibToevoegen = toevoegen;
    $("am_bib_titel").textContent = modus === "kies" ? "Kies afspeellijst" : "Nummers kiezen";
    $("dlg_am_bib").classList.toggle("kiezen", modus !== "kies");
    $("am_bib_tabs").hidden = modus === "kies";
    $("am_bib_zoek").value = "";
    $("am_bib_zoekbalk").hidden = !metZoeken;
    keuze = [];
    toonKlaar();
    $("dlg_am_bib").showModal();
    if (metZoeken) $("am_bib_zoek").focus();
    await kiesTab(modus === "kies" ? "lijsten" : bibTab);
  }

  async function kiesTab(tab) {
    bibTab = tab;
    $("am_bib_tabs").querySelectorAll("button").forEach(b => b.classList.toggle("actief", b.dataset.tab === tab));
    if (tab === "historie") toonHistorie();
    else if (tab === "opgeslagen") toonBibNummers({id: "__opgeslagen", naam: "Opgeslagen"}, null, null);
    else await toonBibLijsten();
  }

  function zetBalk(titel, terug, vernieuw = false) {
    $("am_bib_sub").textContent = titel;
    bibTerug = terug;
    $("am_bib_terug").hidden = !terug;
    $("am_bib_terug_ruimte").hidden = !!terug;
    $("am_bib_vernieuw").hidden = !vernieuw;
  }

  // Alles selecteren: de hele lijst aanvinken; staat alles al aan, dan alles uit
  function toonAlles(lijst) {
    $("am_bib_alles").hidden = bibModus === "kies" || !lijst.length;
    $("am_bib_alles_knop").textContent = `Alles selecteren (${lijst.length})`;
    $("am_bib_alles_knop").onclick = () => {
      const alles = lijst.every(isGekozen);
      if (alles) keuze = keuze.filter(x => !lijst.some(n => n.uri === x.uri));
      else lijst.forEach(n => { if (!isGekozen(n)) keuze.push(n); });
      $("am_bib_lijst").querySelectorAll(".am-kr-plus").forEach(b => zetPlus(b, !alles));
      toonKlaar();
    };
  }

  async function toonBibLijsten(vernieuw = false) {
    zetBalk("Afspeellijsten", null, true);
    toonAlles([]);
    const ul = $("am_bib_lijst");
    ul.replaceChildren(el("li", "am-leeg", "Afspeellijsten laden…"));
    try {
      const lijsten = await acties.lijsten(vernieuw);
      ul.replaceChildren(...lijsten.map(l => {
        const li = el("li", "am-pl" + (l.eigen === false ? " niet-eigen" : "") + (staat.automix.lijst?.id === l.id ? " gekozen-lijst" : ""));
        const h = ctx.hoes(l.hoes); h.classList.add("am-pl-hoes");
        li.append(h, el("span", "am-pl-naam", l.naam), el("span", "am-pl-pijl", bibModus === "kies" ? (staat.automix.lijst?.id === l.id ? "✓" : "") : "›"));
        li.addEventListener("click", () => {
          if (bibModus === "kies") { acties.kiesAutomixLijst(l); $("dlg_am_bib").close(); }
          else toonBibNummers(l, null, () => toonBibLijsten());
        });
        return li;
      }));
    } catch (e) { ul.replaceChildren(el("li", "am-leeg", e.message)); }
  }

  // een nummer in het venster: groot hoesje, titel vet met de artiest eronder, rechts de duur en een oranje +
  function kiesRij(n, {speelt = false, gespeeld = false} = {}) {
    const li = el("li", "am-kr" + (speelt ? " speelt" : "") + (gespeeld ? " gespeeld" : ""));
    const h = ctx.hoes(n.hoesGroot || n.hoes); h.classList.add("am-kr-hoes");
    const tekst = el("div", "am-kr-tekst");
    const t = el("div", "am-kr-titel", n.naam);
    if (speelt) t.prepend(el("span", "am-kr-luid", "🔊 "));
    tekst.append(t, el("div", "am-kr-artiest", n.artiest));
    const plus = el("button", "am-kr-plus", "+"); plus.type = "button"; plus.setAttribute("aria-label", "Kiezen voor Up Next");
    zetPlus(plus, isGekozen(n));
    plus.addEventListener("click", e => {
      e.stopPropagation();
      if (isGekozen(n)) keuze = keuze.filter(x => x.uri !== n.uri); else keuze.push(n);
      zetPlus(plus, isGekozen(n));
      toonKlaar();
    });
    li.append(h, tekst, el("span", "am-kr-duur", tijd(n.duur)), plus);
    return li;
  }

  async function toonBibNummers(l, nummers, terug) {
    zetBalk(l ? l.naam : "Zoeken", terug);
    const ul = $("am_bib_lijst");
    ul.replaceChildren(el("li", "am-leeg", "Nummers laden…"));
    toonAlles([]);
    try {
      bibNummers = nummers || await acties.nummers(l.id);
      const nu = acties.nuUri();
      ul.replaceChildren(...bibNummers.map(n => kiesRij(n, {speelt: n.uri === nu})));
      if (!bibNummers.length) ul.append(el("li", "am-leeg", "Geen nummers gevonden."));
      toonAlles(bibNummers);
    } catch (e) { ul.replaceChildren(el("li", "am-leeg", e.message)); }
  }

  // History: wat er gedraaid is, het nieuwste bovenaan; wat nu speelt in oranje met een luidsprekertje
  function toonHistorie() {
    zetBalk("History", null);
    const lijst = acties.historie(), nu = acties.nuUri();
    const ul = $("am_bib_lijst");
    ul.replaceChildren(...lijst.map((n, i) => kiesRij(n, {speelt: i === 0 && n.uri === nu, gespeeld: true})));
    if (!lijst.length) ul.append(el("li", "am-leeg", "Nog niets gedraaid. Wat er speelt, komt hier vanzelf te staan."));
    toonAlles(lijst);
  }

  let zoekKlok;
  function zoekInBib() {
    clearTimeout(zoekKlok);
    const q = $("am_bib_zoek").value.trim();
    if (!q) { kiesTab(bibTab); return; }
    zoekKlok = setTimeout(async () => {
      try { toonBibNummers(null, await acties.zoek(q), () => { $("am_bib_zoek").value = ""; kiesTab(bibTab); }); } catch (e) { $("am_bib_lijst").replaceChildren(el("li", "am-leeg", e.message)); }
    }, 350);
  }

  // ---------- knoppen ----------

  // de tijdbalk: klikken of slepen springt naar dat punt in het nummer
  function maakBalkBedienbaar() {
    const balk = $("am_balk");
    const deelBij = x => { const r = balk.querySelector(".am-spoor").getBoundingClientRect(); return Math.min(1, Math.max(0, (x - r.left) / r.width)); };
    balk.addEventListener("pointerdown", e => {
      const duur = ctx.stand()?.duur;
      if (!duur) return;
      e.preventDefault();
      balk.setPointerCapture(e.pointerId);
      sleepDeel = deelBij(e.clientX);
      tik(0, 0, duur);
      const beweeg = ev => { sleepDeel = deelBij(ev.clientX); tik(0, 0, duur); };
      const los = ev => {
        balk.removeEventListener("pointermove", beweeg);
        balk.removeEventListener("pointerup", los);
        balk.removeEventListener("pointercancel", los);
        const deel = ev.type === "pointercancel" ? null : deelBij(ev.clientX);
        sleepDeel = null;
        if (deel != null) acties.zoekTijd(deel * duur);
      };
      balk.addEventListener("pointermove", beweeg);
      balk.addEventListener("pointerup", los);
      balk.addEventListener("pointercancel", los);
    });
  }

  function koppel() {
    maakBalkBedienbaar();
    // het balkje sluit bij scrollen, ergens anders tikken of Escape
    $("scherm_automix").querySelector(".am-onder").addEventListener("scroll", sluitPop);
    document.addEventListener("click", e => { if (pop && !pop.contains(e.target) && !popRij?.contains(e.target)) sluitPop(); }, true);
    document.addEventListener("pointerdown", e => { if (info && !info.contains(e.target) && !e.target.closest(".am-nieuwlijst")) sluitInfo(); }, true);
    document.addEventListener("keydown", e => { if (e.key === "Escape") { sluitPop(); sluitInfo(); } });
    $("scherm_automix").querySelector(".am-onder").addEventListener("scroll", sluitInfo);
    langIndrukken($("am_hierna"), "wachtrij");
    langIndrukken($("am_bronlijst"), "lijst");
    $("am_pauze").addEventListener("click", acties.speelPauze);
    $("am_volgende").addEventListener("click", acties.mixNu);
    $("am_lijsten").addEventListener("click", () => openBibliotheek("nummers"));
    $("am_kies").addEventListener("click", () => openBibliotheek("kies"));
    $("am_bron").addEventListener("click", () => openBibliotheek("kies"));
    $("am_apparaat").addEventListener("click", acties.kiesApparaat);
    $("am_automix").addEventListener("click", openAutomixMenu);
    $("am_shuffle").addEventListener("click", () => acties.automixInstelling({shuffle: !staat.automix.shuffle}));
    $("am_herhaal").addEventListener("click", () => acties.automixInstelling({herhaal: !staat.automix.herhaal}));
    // + bij Up Next: meteen het venster om nummers te kiezen (afspeellijsten en zoeken in heel Spotify)
    $("am_plus").addEventListener("click", () => openBibliotheek("nummers", "achteraan"));  // zoeken via het vergrootglas, zoals in djay
    $("am_plus_volgende").addEventListener("click", () => { $("dlg_am_plus").close(); openBibliotheek("nummers", "hierna"); });
    $("am_plus_laatste").addEventListener("click", () => { $("dlg_am_plus").close(); openBibliotheek("nummers", "achteraan"); });
    // het Automix-menu
    $("am_m_aan").addEventListener("click", () => { acties.automixInstelling({aan: !staat.automix.aan}); $("dlg_am_automix").close(); });
    $("am_m_duur").addEventListener("change", e => acties.zetInstelling("mixduur", +e.target.value));
    $("am_m_einde").addEventListener("change", e => acties.zetInstelling("eindeMix", +e.target.value));
    $("am_m_lijstknop").addEventListener("click", () => { $("dlg_am_automix").close(); openBibliotheek("kies"); });
    $("am_m_shuffle").addEventListener("change", e => acties.automixInstelling({shuffle: e.target.checked}));
    $("am_m_herhaal").addEventListener("change", e => acties.automixInstelling({herhaal: e.target.checked}));
    $("am_m_klassiek").addEventListener("click", () => { $("dlg_am_automix").close(); acties.zetWeergave("klassiek"); });
    $("am_m_set").addEventListener("click", () => { $("dlg_am_automix").close(); acties.zetWeergave("set"); });
    $("am_m_automixw").addEventListener("click", () => { $("dlg_am_automix").close(); acties.zetWeergave("automix"); });
    // de bibliotheek
    $("am_bib_terug").addEventListener("click", () => bibTerug?.());
    $("am_bib_klaar").addEventListener("click", () => {
      if (keuze.length) acties.allesToevoegen(keuze);
      keuze = [];
      $("dlg_am_bib").close();
    });
    $("am_bib_zoekknop").addEventListener("click", () => { $("am_bib_zoekbalk").hidden = !$("am_bib_zoekbalk").hidden; if (!$("am_bib_zoekbalk").hidden) $("am_bib_zoek").focus(); });
    $("am_bib_tabs").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { $("am_bib_zoek").value = ""; kiesTab(b.dataset.tab); }));
    $("am_bib_zoek").addEventListener("input", zoekInBib);
    $("am_bib_vernieuw").addEventListener("click", () => toonBibLijsten(true));
    // klikken naast een venster sluit het
    for (const id of ["dlg_am_automix", "dlg_am_plus", "dlg_am_bib"]) {
      $(id).addEventListener("click", e => { if (e.target === $(id)) $(id).close(); });
    }
    ctx.maakSorteerbaar($("am_hierna"), acties.verplaats);
    // de Automix-rij: binnen de rij verschuiven, of naar boven slepen op Hierna (dan op die plek in de wachtrij)
    ctx.maakSorteerbaar($("am_bronlijst"), acties.automixVerplaats,
                        {doel: $("am_hierna"), opNaarDoel: (van, naar) => acties.automixNaarWachtrij(van, naar)});
    $("am_logo").addEventListener("click", acties.openMenu);
  }

  koppel();
  return {toonNu, tik, toonWachtrij, toonBron, openAutomixMenu, openBibliotheek};
}
