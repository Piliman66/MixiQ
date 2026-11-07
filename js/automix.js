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
    $("am_pauze").textContent = stand?.speelt ? "❚❚" : "▶";
    $("am_apparaat_naam").textContent = stand?.apparaat?.naam || speler?.naam || "Kies apparaat";
    toonAutomixKnop();
    if (!stand?.duur) tik(0, 0, 0);
  }

  function tik(positie, rest, duur) {
    const deel = duur ? positie / duur : 0;
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
    const titel = el("span", "am-t", n.naam);
    if (n.auto) titel.prepend(el("span", "am-label", "uit lijst"));
    li.append(ctx.hoes(n.hoes), titel, el("span", "am-a", n.artiest), el("span", "am-d", tijd(n.duur)));
    const greep = el("span", "greep am-greep", "≡");
    greep.title = "Slepen om te verplaatsen";
    li.append(greep);
    li.addEventListener("click", () => kies(n.sleutel, li, [
      ["speel", "Nu afspelen (met overgang)", () => acties.speelNu(i)],
      ["boven", "Bovenaan zetten: als eerste in Hierna", () => acties.naarVoren(i), i === 0],
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
      const greep = el("span", "greep am-greep", "≡");
      greep.title = "Slepen: omhoog of omlaag in de Automix-rij, of naar boven op Hierna";
      li.append(ctx.hoes(n.hoes), el("span", "am-t", n.naam), el("span", "am-a", n.artiest), el("span", "am-d", tijd(n.duur)), greep);
      li.addEventListener("click", () => kies("bron:" + i, li, [
        ["speel", "Nu afspelen (met overgang)", () => acties.speelNuUitLijst(n)],
        ["volgende", "Bovenaan zetten: als eerste in Hierna", () => acties.toevoegen(n, true)],
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

  async function openBibliotheek(modus, toevoegen = "achteraan") {
    bibModus = modus; bibToevoegen = toevoegen;
    $("am_bib_titel").textContent = modus === "kies" ? "Kies afspeellijst" : toevoegen === "hierna" ? "Als volgende toevoegen" : "Nummers toevoegen";
    $("am_bib_zoek").value = "";
    $("am_bib_zoekbalk").hidden = true;
    $("dlg_am_bib").showModal();
    await toonBibLijsten();
  }

  async function toonBibLijsten(vernieuw = false) {
    $("am_bib_terug").hidden = true;
    $("am_bib_vernieuw").hidden = false;
    $("am_bib_sub").textContent = "Afspeellijsten";
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
          else toonBibNummers(l);
        });
        return li;
      }));
    } catch (e) { ul.replaceChildren(el("li", "am-leeg", e.message)); }
  }

  async function toonBibNummers(l, nummers) {
    $("am_bib_terug").hidden = false;
    $("am_bib_vernieuw").hidden = true;
    $("am_bib_sub").textContent = l ? l.naam : "Zoeken";
    const ul = $("am_bib_lijst");
    ul.replaceChildren(el("li", "am-leeg", "Nummers laden…"));
    try {
      bibNummers = nummers || await acties.nummers(l.id);
      ul.replaceChildren(...bibNummers.map(n => {
        const li = el("li", "rij am-rij");
        li.append(ctx.hoes(n.hoes), el("span", "am-t", n.naam), el("span", "am-a", n.artiest), el("span", "am-d", tijd(n.duur)));
        const knoppen = el("span", "am-knoppen");
        knoppen.append(knop("am-k hierna", "↱ Volgende", "Als volgende afspelen: direct na het huidige nummer", () => acties.toevoegen(n, true)),
                       knop("am-k", "+", "Achteraan in de wachtrij", () => acties.toevoegen(n)));
        li.append(knoppen);
        return li;
      }));
      if (!bibNummers.length) ul.append(el("li", "am-leeg", "Geen nummers gevonden."));
    } catch (e) { ul.replaceChildren(el("li", "am-leeg", e.message)); }
  }

  let zoekKlok;
  function zoekInBib() {
    clearTimeout(zoekKlok);
    const q = $("am_bib_zoek").value.trim();
    if (!q) { toonBibLijsten(); return; }
    zoekKlok = setTimeout(async () => {
      try { toonBibNummers(null, await acties.zoek(q)); } catch (e) { $("am_bib_lijst").replaceChildren(el("li", "am-leeg", e.message)); }
    }, 350);
  }

  // ---------- knoppen ----------

  function koppel() {
    // het balkje sluit bij scrollen, ergens anders tikken of Escape
    $("scherm_automix").querySelector(".am-onder").addEventListener("scroll", sluitPop);
    document.addEventListener("click", e => { if (pop && !pop.contains(e.target) && !popRij?.contains(e.target)) sluitPop(); }, true);
    document.addEventListener("keydown", e => { if (e.key === "Escape") sluitPop(); });
    $("am_pauze").addEventListener("click", acties.speelPauze);
    $("am_volgende").addEventListener("click", acties.mixNu);
    $("am_lijsten").addEventListener("click", () => openBibliotheek("nummers"));
    $("am_kies").addEventListener("click", () => openBibliotheek("kies"));
    $("am_bron").addEventListener("click", () => openBibliotheek("kies"));
    $("am_apparaat").addEventListener("click", acties.kiesApparaat);
    $("am_automix").addEventListener("click", openAutomixMenu);
    $("am_shuffle").addEventListener("click", () => acties.automixInstelling({shuffle: !staat.automix.shuffle}));
    $("am_herhaal").addEventListener("click", () => acties.automixInstelling({herhaal: !staat.automix.herhaal}));
    $("am_plus").addEventListener("click", () => $("dlg_am_plus").showModal());
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
    $("am_bib_terug").addEventListener("click", () => { $("am_bib_zoek").value = ""; toonBibLijsten(); });
    $("am_bib_zoekknop").addEventListener("click", () => { $("am_bib_zoekbalk").hidden = false; $("am_bib_zoek").focus(); });
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
