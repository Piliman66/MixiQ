// SoundCloud zonder account of sleutel: via de afspeelknop die SoundCloud voor websites aanbiedt (Widget API).
// Je plakt de link van een nummer; MixiQ speelt het af in een onzichtbare SoundCloud-speler en regelt
// afspelen, pauze, doorspoelen en volume. Nummers die alleen voor Go+ zijn, laat SoundCloud hier mogelijk kort horen.

const WIDGET_API = "https://w.soundcloud.com/player/api.js";
let apiKlaar = null;

function laadApi() {
  apiKlaar = apiKlaar || new Promise((ok, fout) => {
    const s = document.createElement("script");
    s.src = WIDGET_API;
    s.onload = () => ok();
    s.onerror = () => fout(new Error("De speler van SoundCloud kon niet worden geladen."));
    document.head.append(s);
  });
  return apiKlaar;
}

export function isSoundCloudLink(tekst) {
  return /^https?:\/\/(www\.|m\.|on\.)?soundcloud\.com\/\S+/i.test(tekst.trim());
}

function maakFrame(url) {
  const f = document.createElement("iframe");
  f.allow = "autoplay";
  f.title = "SoundCloud";
  f.className = "sc-frame";
  f.src = "https://w.soundcloud.com/player/?visual=false&show_artwork=false&url=" + encodeURIComponent(url);
  document.body.append(f);
  return f;
}

// SoundCloud-geluid heeft een ander soort gegevens dan Spotify; hier het MixiQ-nummer ervan maken
function alsNummer(geluid, link) {
  const hoes = (geluid.artwork_url || geluid.user?.avatar_url || "").replace("-large", "-t300x300");
  return {
    uri: "soundcloud:" + (geluid.permalink_url || link), naam: geluid.title || "SoundCloud-nummer",
    artiest: geluid.user?.username || "", album: "SoundCloud", duur: geluid.duration || geluid.full_duration || 0,
    hoes: hoes.replace("-t300x300", "-large"), hoesGroot: hoes, bron: "soundcloud", link: geluid.permalink_url || link,
    // alleen voor Go+: via de speler voor websites geeft SoundCloud dan een fragment van 30 seconden
    fragment: geluid.policy === "SNIP" || !!(geluid.full_duration && geluid.duration && geluid.duration < geluid.full_duration - 2000),
  };
}

// de nummers achter een geplakte link ophalen (één nummer, of alle nummers van een afspeellijst) met een tijdelijke speler
// een korte link (on.soundcloud.com/…, uit de app via Delen) kent de speler niet; SoundCloud's oEmbed zet hem om
async function volledigeLink(link) {
  try {
    const r = await fetch("https://soundcloud.com/oembed?format=json&url=" + encodeURIComponent(link));
    if (!r.ok) return link;
    const src = ((await r.json()).html || "").match(/src="([^"]+)"/)?.[1];
    return (src && new URL(src.replace(/&amp;/g, "&")).searchParams.get("url")) || link;
  } catch (e) { return link; }
}

export async function scNummers(link) {
  await laadApi();
  const frame = maakFrame(await volledigeLink(link.trim()));
  try {
    const w = window.SC.Widget(frame);
    await new Promise((ok, fout) => {
      const klok = setTimeout(() => fout(new Error("SoundCloud reageert niet op deze link.")), 12000);
      w.bind(window.SC.Widget.Events.ERROR, () => { clearTimeout(klok); fout(new Error("SoundCloud kent deze link niet, of hij is privé.")); });
      w.bind(window.SC.Widget.Events.READY, () => { clearTimeout(klok); ok(); });
    });
    // bij een grote lijst laadt SoundCloud de gegevens in delen: even wachten tot alle titels er zijn
    let geluiden = [];
    for (let poging = 0; poging < 6; poging++) {
      geluiden = await new Promise(ok => w.getSounds(ok)) || [];
      if (geluiden.length && geluiden.every(g => g.title)) break;
      await new Promise(ok => setTimeout(ok, 1500));
    }
    const nummers = geluiden.filter(g => g.title && g.permalink_url).map(g => alsNummer(g, g.permalink_url));
    if (!nummers.length) throw new Error("Geen nummers gevonden achter deze link. Kopieer de link van een nummer of afspeellijst (Delen › Link kopiëren).");
    return nummers;
  } finally { frame.remove(); }
}

// de vaste SoundCloud-speler van MixiQ
export class ScSpeler {
  constructor() { this.w = null; this.nu = null; this.speelt = false; this.positie = 0; this.duur = 0; this.vol = 1; this.klaar = false; }

  async zorg(url) {
    await laadApi();
    if (this.w) return;
    const frame = maakFrame(url);
    this.w = window.SC.Widget(frame);
    const E = window.SC.Widget.Events;
    this.w.bind(E.PLAY, () => { this.speelt = true; });
    this.w.bind(E.PAUSE, () => { this.speelt = false; });
    this.w.bind(E.FINISH, () => { this.speelt = false; this.positie = this.duur; });
    this.w.bind(E.PLAY_PROGRESS, e => { this.positie = e.currentPosition; });
    await new Promise(ok => this.w.bind(E.READY, ok));
  }

  async speel(nummer) {
    const eerste = !this.w;
    await this.zorg(nummer.link);
    this.nu = nummer; this.positie = 0; this.duur = nummer.duur;
    if (!eerste) {
      await new Promise(ok => this.w.load(nummer.link, {auto_play: true, visual: false, show_artwork: false, callback: ok}));
    }
    this.w.setVolume(Math.round(this.vol * 100));
    this.w.play();
    this.w.getDuration(d => { if (d) this.duur = d; });
  }
  async pauze() { this.w?.pause(); this.speelt = false; }
  async hervat() { this.w?.play(); }
  async zoek(ms) { this.w?.seekTo(ms); this.positie = ms; }
  async volume() { return this.vol; }
  async zetVolume(f) { this.vol = f; this.w?.setVolume(Math.round(f * 100)); }
  stand() {
    if (!this.nu) return null;
    return {speelt: this.speelt, positie: this.positie, duur: this.duur || this.nu.duur, uri: this.nu.uri, nummer: this.nu,
            apparaat: {id: "soundcloud", naam: "SoundCloud in MixiQ"}};
  }
}
