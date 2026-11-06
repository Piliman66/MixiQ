// MixiQ zelf als Spotify-apparaat in de browser (Web Playback SDK), zodat op de Mac de Spotify-app niet nodig is.
// Spotify ondersteunt dit niet op iPhone en iPad; daar blijft de Spotify-app het apparaat.

export function kanBrowserSpeler() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return !ios && !!window.MediaKeys;
}

// laadt de speler van Spotify; opKlaar(apparaatId, speler) zodra hij in de apparatenlijst staat
export function startBrowserSpeler(geefSleutel, {opKlaar, opFout}) {
  window.onSpotifyWebPlaybackSDKReady = () => {
    const speler = new window.Spotify.Player({
      name: "MixiQ in deze browser",
      getOAuthToken: klaar => geefSleutel().then(klaar, e => opFout(e.message)),
      volume: 0.9,
    });
    speler.addListener("ready", ({device_id}) => opKlaar(device_id, speler));
    speler.addListener("not_ready", () => opFout("De browserspeler is even weg; hij komt vanzelf terug."));
    for (const soort of ["initialization_error", "authentication_error", "account_error", "playback_error"]) {
      speler.addListener(soort, ({message}) => opFout(message));
    }
    speler.connect();
    // browsers spelen pas geluid af na een klik of tik: bij de eerste klik de speler activeren
    document.addEventListener("click", () => speler.activateElement?.(), {once: true, capture: true});
  };
  const s = document.createElement("script");
  s.src = "https://sdk.scdn.co/spotify-player.js";
  s.onerror = () => opFout("De speler van Spotify kon niet worden geladen.");
  document.head.append(s);
}
