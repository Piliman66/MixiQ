// De weergave "Set": bovenaan de avond als tijdlijn (elk blok zo breed als het nummer lang is), daaronder groot
// wat er speelt, links de afspeellijst om uit te kiezen en rechts de rij die komt. Logica zit in app.js;
// het Automix-menu en de bibliotheek komen uit automix.js. Aanraken van een rij speelt nooit iets af.

const $ = id => document.getElementById(id);
// "1 minuut", "34 minuten", "1 uur en 5 minuten"
function duurTekst(ms) {
  const m = Math.max(1, Math.round(ms / 60000)), u = Math.floor(m / 60), r = m % 60;
  const min = r === 1 ? "1 minuut" : r + " minuten";
  return u ? (u === 1 ? "1 uur" : u + " uur") + (r ? " en " + min : "") : min;
}
const klok = t => new Date(t).toLocaleTimeString("nl-NL", {hour: "2-digit", minute: "2-digit"});

export function maakSetWeergave(ctx) {
  const {staat, el, knop, tijd, totaal, zetHoes, acties, automix} = ctx;
  let gekozen = null;
  let zoekResultaat = null;  // zoeken vervangt de lijst links tot het zoekveld leeg is

  // ---------- de set als tijdlijn ----------

  function toonSet(positie, rest, duur) {
    const strook = $("st_set");
    const gespeeld = (staat.gespeeld || []).slice(-2);
    const nu = ctx.stand()?.nummer || staat.nu;
    const komt = staat.wachtrij.slice(0, 4);
    const blokken = [
      ...gespeeld.map(n => ({n, soort: "was"})),
      ...(nu ? [{n: nu, soort: "nu"}] : []),
      ...komt.map((n, i) => ({n, soort: i === 0 ? "komt eerst" : "komt"})),
    ];
    if (!blokken.length) { strook.replaceChildren(el("div", "st-set-leeg", "Hier komt je avond te staan zodra er iets speelt.")); $("st_setinfo_l").textContent = ""; $("st_setinfo_r").textContent = ""; return; }
    // alleen opnieuw opbouwen als de nummers veranderen; anders alleen de voortgang bijwerken
    const sleutel = blokken.map(b => b.soort + b.n.uri).join("|");
    if (strook.dataset.sleutel !== sleutel) {
      strook.dataset.sleutel = sleutel;
      strook.replaceChildren(...blokken.map(({n, soort}) => {
        const b = el("div", "st-blok " + soort);
        b.style.flex = String(Math.max(60000, n.duur || 180000));
        b.append(el("span", "st-bt", n.naam), el("small", "", n.artiest));
        if (soort === "nu") {  // het gele deel met dezelfde tekst in donker erover: zo blijft hij overal leesbaar
          const gedaan = el("div", "st-gedaan"), binnen = el("div", "st-binnen");
          binnen.append(el("span", "st-bt", n.naam), el("small", "", n.artiest));
          gedaan.append(binnen);
          b.append(gedaan);
        }
        return b;
      }), el("div", "st-mixzone"), el("div", "st-kop"));
    }
    const nuBlok = strook.querySelector(".st-blok.nu");
    if (nuBlok && duur) {
      const deel = Math.min(1, positie / duur);
      nuBlok.querySelector(".st-gedaan").style.width = (100 * deel) + "%";
      nuBlok.querySelector(".st-binnen").style.width = nuBlok.clientWidth + "px";
      const s = strook.getBoundingClientRect(), r = nuBlok.getBoundingClientRect();
      strook.querySelector(".st-kop").style.left = (r.left - s.left + r.width * deel) + "px";
      strook.querySelector(".st-kop").hidden = false;
      const mix = strook.querySelector(".st-mixzone");
      mix.hidden = !staat.wachtrij.length;
      mix.style.left = (r.right - s.left - 20) + "px";
    } else {
      strook.querySelector(".st-kop").hidden = true;
      strook.querySelector(".st-mixzone").hidden = true;
    }
    $("st_setinfo_l").textContent = staat.setBegin
      ? `Begonnen om ${klok(staat.setBegin)}, ${duurTekst(Date.now() - staat.setBegin)} gedraaid` : "";
    const nog = (duur ? rest : 0) + staat.wachtrij.reduce((t, n) => t + (n.duur || 0), 0);
    $("st_setinfo_r").textContent = nog ? `De rij is klaar rond ${klok(Date.now() + nog)}` : "";
  }

  // ---------- nu ----------

  function toonNu(stand, speler) {
    const n = stand?.nummer || staat.nu;
    $("st_titel").textContent = n ? n.naam : "Er speelt nog niets";
    $("st_artiest").textContent = n ? n.artiest : "Kies links een nummer en zet het in de rij";
    zetHoes($("st_hoes"), n ? (n.hoesGroot || n.hoes) : "");
    $("st_pauze").textContent = stand?.speelt ? "❚❚" : "▶";
    $("st_apparaat").textContent = "Geluid via " + (stand?.apparaat?.naam || speler?.naam || "…");
    const a = staat.automix;
    $("st_automix").replaceChildren(el("i", a.aan && a.lijst ? "aan" : ""),
      document.createTextNode(a.aan && a.lijst ? `Automix speelt ${a.lijst.naam} verder` : "Automix staat uit"));
    if (!stand?.duur) { $("st_rest").textContent = ""; toonSet(0, 0, 0); }
  }

  function tik(positie, rest, duur) {
    $("st_rest").textContent = duur ? "-" + tijd(rest) : "";
    toonSet(positie, rest, duur);
  }

  // ---------- rechts: de rij die komt ----------

  function toonWachtrij() {
    const ul = $("st_hierna");
    ul.replaceChildren(...staat.wachtrij.map((n, i) => {
      const li = el("li", "rij st-r" + (i === 0 ? " eerste" : "") + (gekozen === n.sleutel ? " gekozen" : ""));
      const tekst = el("div", "st-tekst");
      const t = el("div", "st-t", n.naam);
      if (n.auto) t.append(el("span", "st-bij", "uit " + (staat.automix.lijst?.naam || "de lijst")));
      tekst.append(t, el("div", "st-a", n.artiest));
      const knoppen = el("span", "st-knoppen");
      if (i > 0) knoppen.append(knop("st-k geel", "↱ Volgende", "Als volgende afspelen: direct na het huidige nummer", () => acties.naarVoren(i)));
      knoppen.append(knop("st-k", "▶", "Nu afspelen", () => acties.speelNu(i)), knop("st-k", "×", "Uit de rij halen", () => acties.verwijder(i)));
      const greep = el("span", "greep st-greep", "≡");
      greep.title = "Slepen om te verplaatsen";
      li.append(el("span", "st-n", String(i + 1)), tekst, el("span", "st-d", tijd(n.duur)), knoppen, greep);
      li.addEventListener("click", () => { gekozen = gekozen === n.sleutel ? null : n.sleutel; toonWachtrij(); });
      return li;
    }));
    if (!staat.wachtrij.length) ul.append(el("li", "st-leeg", "De rij is leeg. Zet rechts een nummer erin met ↱ Volgende of +."));
    const ms = staat.wachtrij.reduce((t, n) => t + (n.duur || 0), 0);
    $("st_hierna_info").textContent = staat.wachtrij.length
      ? `${staat.wachtrij.length} ${staat.wachtrij.length === 1 ? "nummer" : "nummers"}, ${duurTekst(ms)}` : "";
    toonBron();
  }

  // ---------- links: de lijst om uit te kiezen ----------

  function toonBron() {
    const a = staat.automix;
    $("st_lijstnaam").textContent = zoekResultaat ? "Zoeken" : (a.lijst ? a.lijst.naam : "Kies een afspeellijst");
    const lijst = zoekResultaat || ctx.automixNummers();
    const ul = $("st_bron");
    if (!zoekResultaat && !a.lijst) { ul.replaceChildren(el("li", "st-leeg", "Tik hierboven op de naam om een afspeellijst te kiezen.")); return; }
    if (!lijst.length) { ul.replaceChildren(el("li", "st-leeg", ctx.automixLaadt() ? "Nummers laden…" : ctx.automixFout?.() || "Geen nummers gevonden.")); return; }
    const volgende = zoekResultaat ? -1 : ctx.automixVolgendeIndex();
    ul.replaceChildren(...lijst.map((n, i) => {
      const li = el("li", "rij st-b" + (gekozen === "bron:" + n.uri + i ? " gekozen" : "") + (i === volgende && a.aan ? " volgt" : ""));
      const tekst = el("div", "st-tekst");
      tekst.append(el("div", "st-t", n.naam), el("div", "st-a", n.artiest));
      const knoppen = el("span", "st-knoppen");
      knoppen.append(knop("st-k geel", "↱ Volgende", "Als volgende afspelen: direct na het huidige nummer", () => acties.toevoegen(n, true)),
                     knop("st-k", "+", "Achteraan in de rij", () => acties.toevoegen(n)));
      li.append(tekst, el("span", "st-d", tijd(n.duur)), knoppen);
      li.addEventListener("click", () => { gekozen = gekozen === "bron:" + n.uri + i ? null : "bron:" + n.uri + i; toonBron(); });
      return li;
    }));
  }

  let zoekKlok;
  function zoek() {
    clearTimeout(zoekKlok);
    const q = $("st_zoek").value.trim();
    if (!q) { zoekResultaat = null; toonBron(); return; }
    zoekKlok = setTimeout(async () => {
      try { zoekResultaat = await acties.zoek(q); } catch (e) { zoekResultaat = []; ctx.melding(e.message); }
      toonBron();
    }, 350);
  }

  function koppel() {
    $("st_pauze").addEventListener("click", acties.speelPauze);
    $("st_mix").addEventListener("click", acties.mixNu);
    $("st_apparaat").addEventListener("click", acties.kiesApparaat);
    $("st_menu").addEventListener("click", acties.openMenu);
    $("st_automix").addEventListener("click", () => automix().openAutomixMenu());
    $("st_lijstkies").addEventListener("click", () => { $("st_zoek").value = ""; zoekResultaat = null; automix().openBibliotheek("kies"); });
    $("st_zoek").addEventListener("input", zoek);
    ctx.maakSorteerbaar($("st_hierna"), acties.verplaats);
    window.addEventListener("resize", () => { $("st_set").dataset.sleutel = ""; });
  }

  koppel();
  return {toonNu, tik, toonWachtrij, toonBron};
}
