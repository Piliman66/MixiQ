// Eén wachtrij voor alle apparaten: MixiQ bewaart hem in een privé-afspeellijst "MixiQ wachtrij" in je eigen
// Spotify-account. Elk apparaat schrijft zijn wijzigingen weg en kijkt om de paar seconden of er iets veranderd is.
// In de beschrijving van de lijst staat welk apparaat de regie heeft: alleen dat apparaat schuift zelf door
// aan het einde van een nummer, anders zouden Mac en iPad allebei het volgende nummer starten.

export const DEEL_NAAM = "MixiQ wachtrij";
const REGIE = /MixiQ-regie:(\w+)/;

function apparaatId() {
  try {
    let id = localStorage.getItem("mixiq.apparaat");
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem("mixiq.apparaat", id); }
    return id;
  } catch (e) { return "onbekend"; }
}

export class GedeeldeWachtrij {
  constructor(api, alsNummer, {opWijziging, log}) {
    this.api = api; this.alsNummer = alsNummer; this.opWijziging = opWijziging; this.log = log;
    this.id = null; this.snapshot = null; this.regie = null; this.mijnId = apparaatId();
    this.geschreven = null;   // de lijst uri's die wij het laatst hebben weggeschreven
    this.schrijfTimer = null; this.bezig = false;
  }

  // de lijst zoeken of maken; geeft de nummers die er nu in staan
  async begin() {
    const ik = (await this.api("/me")).id;
    for (let url = "/me/playlists?limit=50"; url && !this.id; ) {
      const d = await this.api(url.replace("https://api.spotify.com/v1", ""));
      const l = (d.items || []).find(p => p?.name === DEEL_NAAM && p.owner?.id === ik);
      if (l) this.id = l.id;
      url = d.next;
    }
    if (!this.id) {
      const l = await this.api("/me/playlists", {methode: "POST",
        body: {name: DEEL_NAAM, public: false, description: "Wachtrij van MixiQ, gedeeld tussen je apparaten. Niet zelf aanpassen."}});
      this.id = l.id;
      this.log("gedeelde wachtrij aangemaakt");
      return [];
    }
    return this.lees();
  }

  async lees() {
    const kop = await this.api(`/playlists/${this.id}?fields=snapshot_id,description`);
    this.snapshot = kop.snapshot_id;
    this.regie = (kop.description || "").match(REGIE)?.[1] || null;
    const uit = [];
    for (let url = `/playlists/${this.id}/items?limit=50`; url; ) {
      const d = await this.api(url.replace("https://api.spotify.com/v1", ""));
      uit.push(...(d.items || []).map(x => this.alsNummer(x.item || x.track)).filter(Boolean));
      url = d.next;
    }
    this.geschreven = JSON.stringify(uit.map(n => n.uri));
    return uit;
  }

  // na een wijziging hier: even wachten (slepen geeft veel wijzigingen achter elkaar) en dan de hele lijst vervangen
  schrijf(wachtrij) {
    if (!this.id) return;
    const uris = wachtrij.map(n => n.uri).filter(u => u && u.startsWith("spotify:")).slice(0, 100);
    if (JSON.stringify(uris) === this.geschreven) return;
    clearTimeout(this.schrijfTimer);
    this.schrijfTimer = setTimeout(async () => {
      this.schrijfTimer = null;
      this.bezig = true;
      try {
        const d = await this.api(`/playlists/${this.id}/items`, {methode: "PUT", body: {uris}});
        this.geschreven = JSON.stringify(uris);
        if (d?.snapshot_id) this.snapshot = d.snapshot_id;
      } catch (e) { this.log("gedeelde wachtrij opslaan lukt niet: " + e.message); }
      finally { this.bezig = false; }
    }, 600);
  }

  // kijken of een ander apparaat iets veranderde
  async peil() {
    if (!this.id || this.bezig || this.schrijfTimer) return;
    try {
      const kop = await this.api(`/playlists/${this.id}?fields=snapshot_id,description`);
      this.regie = (kop.description || "").match(REGIE)?.[1] || null;
      if (kop.snapshot_id === this.snapshot) return;
      const nummers = await this.lees();
      if (!this.schrijfTimer) this.opWijziging(nummers);  // intussen zelf iets veranderd: dan wint de eigen wijziging
    } catch (e) { /* even geen verbinding: de volgende keer opnieuw */ }
  }

  ikHebRegie() { return !this.id || !this.regie || this.regie === this.mijnId; }

  async neemRegie() {
    if (!this.id || this.regie === this.mijnId) return;
    this.regie = this.mijnId;
    try {
      await this.api(`/playlists/${this.id}`, {methode: "PUT",
        body: {description: `Wachtrij van MixiQ, gedeeld tussen je apparaten. Niet zelf aanpassen. MixiQ-regie:${this.mijnId}`}});
    } catch (e) { this.log("regie doorgeven lukt niet: " + e.message); }
  }
}
