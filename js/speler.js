import {alsNummer} from "./spotify.js?v=11";

// De speler: MixiQ houdt zelf de wachtrij bij en zegt tegen Spotify welk nummer er nu moet spelen.
// De wachtrij van Spotify zelf gebruiken we niet: die kun je via de API niet herschikken.

export class SpotifySpeler {
  constructor(api) { this.api = api; this.apparaat = null; this.soort = ""; }

  // de Spotify-app op een telefoon of tablet stopt bij een afspeelopdracht met een nummer erin (Spotify zegt wel "goed");
  // via de wachtrij van Spotify en "volgende" lukt het daar wel
  mobiel() { return /smartphone|tablet/i.test(this.soort); }

  async apparaten() {
    const d = await this.api("/me/player/devices");
    return (d?.devices || []).map(a => ({id: a.id, naam: a.name, soort: a.type, actief: a.is_active}));
  }

  async kiesApparaat(id, soort = "") {
    this.apparaat = id;
    this.soort = soort;
    await this.api("/me/player", {methode: "PUT", body: {device_ids: [id], play: false}});
  }

  async speel(nummer, {overslaan = 0} = {}) {
    if (this.mobiel()) {
      await this.klaarzetten(nummer);
      await new Promise(ok => setTimeout(ok, 300));
      for (let i = 0; i <= overslaan; i++) await this.volgende();  // overslaan: een eerder klaargezet nummer staat er nog voor
      return;
    }
    const waar = this.apparaat ? "?device_id=" + encodeURIComponent(this.apparaat) : "";
    await this.api("/me/player/play" + waar, {methode: "PUT", body: {uris: [nummer.uri]}});
  }

  // zet één nummer in de wachtrij van Spotify, zodat Spotify er aan het einde zelf (zonder gat) naartoe gaat
  async klaarzetten(nummer) {
    const waar = this.apparaat ? "&device_id=" + encodeURIComponent(this.apparaat) : "";
    await this.api("/me/player/queue?uri=" + encodeURIComponent(nummer.uri) + waar, {methode: "POST"});
  }
  async volgende() {
    const waar = this.apparaat ? "?device_id=" + encodeURIComponent(this.apparaat) : "";
    await this.api("/me/player/next" + waar, {methode: "POST"});
  }

  async pauze() { await this.api("/me/player/pause", {methode: "PUT"}); }
  async hervat() { await this.api("/me/player/play", {methode: "PUT"}); }

  // wat er nu speelt: {speelt, positie, duur, uri, apparaat} of null als er niets actief is
  async stand() {
    const d = await this.api("/me/player");
    if (!d) return null;
    if (d.device?.id) { this.apparaat = d.device.id; this.soort = d.device.type || ""; }
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
  async klaarzetten(nummer) { this.klaar = nummer; }
  async volgende() { if (this.klaar) { await this.speel(this.klaar); this.klaar = null; } }
  async pauze() { if (this.speelt) { this.gepauzeerd = Date.now() - this.start; this.speelt = false; } }
  async hervat() { if (this.nu && !this.speelt) { this.start = Date.now() - this.gepauzeerd; this.speelt = true; } }
  async stand() {
    if (!this.nu) return null;
    if (this.speelt && this.klaar && Date.now() - this.start >= this.nu.duur) {  // zoals Spotify: door naar het klaargezette nummer
      this.start += this.nu.duur; this.nu = this.klaar; this.klaar = null;
    }
    const positie = this.speelt ? Date.now() - this.start : this.gepauzeerd;
    return {speelt: this.speelt, positie: Math.min(positie, this.nu.duur), duur: this.nu.duur, uri: this.nu.uri, nummer: this.nu,
            apparaat: {id: this.apparaat, naam: this.apparaat === "demo" ? "iPad (voorbeeld)" : "Speaker woonkamer"}};
  }
}
