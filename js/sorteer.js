// Slepen om te verplaatsen, alleen aan de greep (≡): de rest van de rij reageert niet op slepen,
// zodat scrollen door de lijst nooit per ongeluk iets verschuift.
export function maakSorteerbaar(lijst, opVerplaatst) {
  let stilTot = 0;  // de tik die op het loslaten volgt, telt niet als aanraken van de rij
  lijst.addEventListener("click", e => { if (Date.now() < stilTot) { e.stopPropagation(); e.preventDefault(); } }, true);
  lijst.addEventListener("pointerdown", e => {
    const greep = e.target.closest(".greep");
    if (!greep || !lijst.contains(greep)) return;
    const rij = greep.closest(".rij");
    e.preventDefault();
    const van = [...lijst.children].indexOf(rij);
    const vak = rij.getBoundingClientRect();
    const startY = e.clientY;
    let laatsteY = e.clientY;

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
      const voor = [...lijst.children].find(x => x !== rij && x !== plek && y < x.getBoundingClientRect().top + x.offsetHeight / 2);
      if (voor) lijst.insertBefore(plek, voor); else lijst.appendChild(plek);
    }
    // bij de boven- of onderrand scrolt de lijst vanzelf mee
    const scroller = setInterval(() => {
      const r = lijst.getBoundingClientRect();
      const stap = laatsteY < r.top + 60 ? -14 : laatsteY > r.bottom - 60 ? 14 : 0;
      if (stap) { lijst.scrollTop += stap; plaats(laatsteY); }
    }, 30);
    const beweeg = ev => { laatsteY = ev.clientY; plaats(ev.clientY); };
    const los = () => {
      clearInterval(scroller);
      greep.removeEventListener("pointermove", beweeg);
      greep.removeEventListener("pointerup", los);
      greep.removeEventListener("pointercancel", los);
      const naar = [...lijst.children].filter(x => x !== rij).indexOf(plek);
      plek.replaceWith(rij);
      rij.classList.remove("sleept");
      rij.removeAttribute("style");
      stilTot = Date.now() + 400;
      if (naar !== van) opVerplaatst(van, naar);
    };
    greep.addEventListener("pointermove", beweeg);
    greep.addEventListener("pointerup", los);
    greep.addEventListener("pointercancel", los);
  });
}
