// Inloggen bij Spotify (Authorization Code met PKCE, zonder client secret) en de Web API.
const SCOPES = [
  "user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing",
  "playlist-read-private", "playlist-read-collaborative", "user-library-read",
  "streaming", "user-read-email", "user-read-private",  // afspelen in de browser (Web Playback SDK)
  "playlist-modify-private", "playlist-modify-public",  // de gedeelde wachtrij (lijst "MixiQ wachtrij")
].join(" ");
const OPSLAG = "mixiq.spotify";
const terugAdres = () => location.origin + location.pathname;

function willekeurig(lengte) {
  const tekens = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  return Array.from(crypto.getRandomValues(new Uint8Array(lengte)), b => tekens[b % tekens.length]).join("");
}

async function uitdaging(verifier) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bewaar(t) {
  try { localStorage.setItem(OPSLAG, JSON.stringify(t)); } catch (e) {}
}
function lees() {
  try { return JSON.parse(localStorage.getItem(OPSLAG)) || null; } catch (e) { return null; }
}

export function ingelogd() { return !!lees(); }
export function heeftToestemming(scope) { return (lees()?.scope || "").split(" ").includes(scope); }
export function uitloggen() { try { localStorage.removeItem(OPSLAG); } catch (e) {} }

export async function login(clientId) {
  const verifier = willekeurig(64), staat = willekeurig(16);
  sessionStorage.setItem("mixiq.verifier", verifier);
  sessionStorage.setItem("mixiq.staat", staat);
  const p = new URLSearchParams({
    response_type: "code", client_id: clientId, scope: SCOPES, redirect_uri: terugAdres(),
    code_challenge_method: "S256", code_challenge: await uitdaging(verifier), state: staat,
  });
  location.href = "https://accounts.spotify.com/authorize?" + p;
}

async function tokenAanvraag(clientId, velden) {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({client_id: clientId, ...velden}),
  });
  if (!r.ok) throw new Error("Inloggen bij Spotify lukt niet (" + r.status + ").");
  const d = await r.json();
  const oud = lees() || {};
  bewaar({toegang: d.access_token, vernieuw: d.refresh_token || oud.vernieuw, tot: Date.now() + (d.expires_in - 60) * 1000,
          scope: d.scope || oud.scope || ""});
}

// na het inloggen komt Spotify terug met ?code=...; die ruilen we in voor een toegangssleutel
export async function verwerkTerugkeer(clientId) {
  const p = new URLSearchParams(location.search);
  if (p.get("error")) { history.replaceState(null, "", terugAdres()); throw new Error("Inloggen afgebroken."); }
  if (!p.get("code")) return false;
  const verifier = sessionStorage.getItem("mixiq.verifier");
  const staat = sessionStorage.getItem("mixiq.staat");
  history.replaceState(null, "", terugAdres());
  if (!verifier || p.get("state") !== staat) throw new Error("Inloggen niet herkend; probeer het opnieuw.");
  await tokenAanvraag(clientId, {grant_type: "authorization_code", code: p.get("code"), redirect_uri: terugAdres(), code_verifier: verifier});
  sessionStorage.removeItem("mixiq.verifier");
  sessionStorage.removeItem("mixiq.staat");
  return true;
}

export async function toegang(clientId) {
  const t = lees();
  if (!t) throw new Error("Niet ingelogd.");
  if (Date.now() > t.tot) await tokenAanvraag(clientId, {grant_type: "refresh_token", refresh_token: t.vernieuw});
  return lees().toegang;
}

export class SpotifyFout extends Error {
  constructor(status, reden, bericht) { super(bericht); this.status = status; this.reden = reden; }
}

// logboek (?log): wat MixiQ aan Spotify vraagt en wat er terugkomt; alleen op het scherm, nergens heen gestuurd
export const logboek = [];
export function log(tekst) {
  const t = new Date().toLocaleTimeString("nl-NL");
  logboek.unshift(t + "  " + tekst);
  logboek.length = Math.min(logboek.length, 40);
  window.dispatchEvent(new Event("mixiq-log"));
}

// Spotify remt af bij te veel verzoeken (429, voor alle apparaten samen); tot dan slaan de vaste controles een beurt over
let rustTot = 0;
export const moetRusten = () => Date.now() < rustTot;

export function maakApi(clientId) {
  return async function api(pad, {methode = "GET", body} = {}, poging = 0) {
    if (moetRusten() && poging === 0) {
      throw new SpotifyFout(429, "TE_VEEL", `Spotify remt MixiQ nog even af. Probeer het over ${Math.ceil((rustTot - Date.now()) / 1000)} seconden opnieuw.`);
    }
    const r = await fetch("https://api.spotify.com/v1" + pad, {
      method: methode,
      headers: {Authorization: "Bearer " + await toegang(clientId), ...(body ? {"Content-Type": "application/json"} : {})},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401 && poging === 0) {  // sleutel verlopen: één keer vernieuwen
      const t = lees();
      if (t) { t.tot = 0; bewaar(t); }
      return api(pad, {methode, body}, 1);
    }
    if (r.status === 429) {  // te veel verzoeken: Spotify zegt hoe lang we moeten wachten
      // Retry-After komt in de browser meestal niet door; dan een minuut aanhouden
      const wacht = (+r.headers.get("Retry-After") || 60) * 1000;
      rustTot = Date.now() + wacht;
      log(`Spotify: te veel verzoeken, ${Math.round(wacht / 1000)} s rust`);
      if (poging < 2 && wacht <= 10000) {
        await new Promise(ok => setTimeout(ok, wacht));
        return api(pad, {methode, body}, poging + 1);
      }
      throw new SpotifyFout(429, "TE_VEEL", `Spotify vraagt MixiQ even rustig aan te doen (te veel verzoeken). Probeer het over ${wacht < 90000 ? Math.round(wacht / 1000) + " seconden" : Math.round(wacht / 60000) + " minuten"} opnieuw.`);
    }
    const kaal = pad.split("?")[0];
    if (!(methode === "GET" && kaal === "/me/player")) log(`${methode} ${kaal} → ${r.status}`);
    if (r.status === 204 || r.status === 202) return null;
    const tekst = await r.text();
    let d = null;  // sommige opdrachten (zoals afspelen) geven een kale code terug in plaats van JSON
    try { d = tekst ? JSON.parse(tekst) : null; } catch { d = null; }
    if (!r.ok) throw new SpotifyFout(r.status, d?.error?.reason, d?.error?.message || "Spotify gaf fout " + r.status);
    return d;
  };
}

// een Spotify-nummer in de vorm die MixiQ gebruikt
export function alsNummer(t) {
  if (!t || !t.uri || t.type !== "track") return null;
  return {
    uri: t.uri, naam: t.name, artiest: (t.artists || []).map(a => a.name).join(", "), album: t.album?.name || "", duur: t.duration_ms,
    hoes: (t.album?.images || []).slice(-1)[0]?.url || "", hoesGroot: (t.album?.images || [])[1]?.url || (t.album?.images || [])[0]?.url || "",
    bron: "spotify",
  };
}
