import {alsNummer} from "./spotify.js";

// De speler: Mixonset houdt zelf de wachtrij bij en zegt tegen Spotify welk nummer er nu moet spelen.
// De wachtrij van Spotify zelf gebruiken we niet: die kun je via de API niet herschikken.

export class SpotifySpeler {
  constructor(api) { this.api = api; this.apparaat = null; }

  async apparaten() {
    const d = await this.api("/me/player/devices");
    return (d?.devices || []).map(a => ({id: a.id, naam: a.name, soort: a.type, actief: a.is_active}));
  }

  async kiesApparaat(id) {
    this.apparaat = id;
    await this.api("/me/player", {methode: "PUT", body: {device_ids: [id], play: false}});
  }

  async speel(nummer) {
    const waar = this.apparaat ? "?device_id=" + encodeURIComponent(this.apparaat) : "";
    await this.api("/me/player/play" + waar, {methode: "PUT", body: {uris: [nummer.uri]}});
  }

  async pauze() { await this.api("/me/player/pause", {methode: "PUT"}); }
  async hervat() { await this.api("/me/player/play", {methode: "PUT"}); }

  // wat er nu speelt: {speelt, positie, duur, uri, apparaat} of null als er niets actief is
  async stand() {
    const d = await this.api("/me/player");
    if (!d) return null;
    if (d.device?.id) this.apparaat = d.device.id;
    return {speelt: d.is_playing, positie: d.progress_ms || 0, duur: d.item?.duration_ms || 0, uri: d.item?.uri || null,
            nummer: alsNummer(d.item), apparaat: d.device ? {id: d.device.id, naam: d.device.name} : null};
  }
}

// voorbeeld zonder Spotify (?demo): de tijd loopt in de browser, er klinkt niets
export class DemoSpeler {
  constructor() { this.nu = null; this.start = 0; this.gepauzeerd = 0; this.speelt = false; this.apparaat = "demo"; }
  async apparaten() { return [{id: "demo", naam: "iPad (voorbeeld)", soort: "Tablet", actief: true}, {id: "speaker", naam: "Speaker woonkamer", soort: "Speaker", actief: false}]; }
  async kiesApparaat(id) { this.apparaat = id; }
  async speel(nummer) { this.nu = nummer; this.start = Date.now(); this.speelt = true; }
  async pauze() { if (this.speelt) { this.gepauzeerd = Date.now() - this.start; this.speelt = false; } }
  async hervat() { if (this.nu && !this.speelt) { this.start = Date.now() - this.gepauzeerd; this.speelt = true; } }
  async stand() {
    if (!this.nu) return null;
    const positie = this.speelt ? Date.now() - this.start : this.gepauzeerd;
    return {speelt: this.speelt, positie: Math.min(positie, this.nu.duur), duur: this.nu.duur, uri: this.nu.uri, nummer: this.nu,
            apparaat: {id: this.apparaat, naam: this.apparaat === "demo" ? "iPad (voorbeeld)" : "Speaker woonkamer"}};
  }
}
