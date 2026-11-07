// Slepen om te verplaatsen, alleen aan de greep (≡): de rest van de rij reageert niet op slepen,
// zodat scrollen door de lijst nooit per ongeluk iets verschuift.
// Met extra.doel (een andere lijst) kan een rij ook naar die lijst gesleept worden: dan opNaarDoel(van, plek in doel).
export function maakSorteerbaar(lijst, opVerplaatst, extra = {}) {
  let stilTot = 0;  // de tik die op het loslaten volgt, telt niet als aanraken van de rij
  lijst.addEventListener("click", e => { if (Date.now() < stilTot) { e.stopPropagation(); e.preventDefault(); } }, true);
  // wat er scrolt: de lijst zelf, of (in Automix) het vak eromheen
  const scrollVak = () => {
    for (let x = lijst; x; x = x.parentElement) if (x.scrollHeight > x.clientHeight + 2 && getComputedStyle(x).overflowY !== "visible") return x;
    return lijst;
  };
  lijst.addEventListener("pointerdown", e => {
    const greep = e.target.closest(".greep");
    if (!greep || !lijst.contains(greep)) return;
    const rij = greep.closest(".rij");
    e.preventDefault();
    const van = [...lijst.children].indexOf(rij);
    const vak = rij.getBoundingClientRect();
    const startY = e.clientY;
    let laatsteY = e.clientY;
    const scroller = scrollVak();

    // een lege plek houdt de ruimte vast; de rij zelf zweeft onder je vinger
    const plek = document.createElement("li");
    plek.className = "plek";
    plek.style.height = vak.height + "px";
    lijst.insertBefore(plek, rij.nextSibling);
    Object.assign(rij.style, {position: "fixed", left: vak.left + "px", top: vak.top + "px", width: vak.width + "px"});
    rij.classList.add("sleept");
    greep.setPointerCapture(e.pointerId);

    function plaats(y) {
      rij.style.top = (vak.top + y - startY) + "px";
      // boven de eigen lijst (op de doellijst): daar een plek maken
      const doel = extra.doel;
      const inDoel = !!doel && y < lijst.getBoundingClientRect().top - 4;
      const ul = inDoel ? doel : lijst;
      doel?.classList.toggle("doel-actief", inDoel);
      const voor = [...ul.children].find(x => x !== rij && x !== plek && !x.classList.contains("am-leeg")
                                          && y < x.getBoundingClientRect().top + x.offsetHeight / 2);
      if (voor) ul.insertBefore(plek, voor); else ul.appendChild(plek);
    }
    // bij de boven- of onderrand scrolt de lijst vanzelf mee
    const scrolTimer = setInterval(() => {
      const r = scroller.getBoundingClientRect();
      const stap = laatsteY < r.top + 60 ? -14 : laatsteY > r.bottom - 60 ? 14 : 0;
      if (stap) { scroller.scrollTop += stap; plaats(laatsteY); }
    }, 30);
    const beweeg = ev => { laatsteY = ev.clientY; plaats(ev.clientY); };
    const los = () => {
      clearInterval(scrolTimer);
      greep.removeEventListener("pointermove", beweeg);
      greep.removeEventListener("pointerup", los);
      greep.removeEventListener("pointercancel", los);
      extra.doel?.classList.remove("doel-actief");
      stilTot = Date.now() + 400;
      if (extra.doel && plek.parentElement === extra.doel) {
        const naar = [...extra.doel.children].filter(x => !x.classList.contains("am-leeg")).indexOf(plek);
        plek.remove();
        lijst.insertBefore(rij, lijst.children[van] || null);
        rij.classList.remove("sleept");
        rij.removeAttribute("style");
        extra.opNaarDoel(van, naar);
        return;
      }
      const naar = [...lijst.children].filter(x => x !== rij).indexOf(plek);
      plek.replaceWith(rij);
      rij.classList.remove("sleept");
      rij.removeAttribute("style");
      if (naar !== van) opVerplaatst(van, naar);
    };
    greep.addEventListener("pointermove", beweeg);
    greep.addEventListener("pointerup", los);
    greep.addEventListener("pointercancel", los);
  });
}
