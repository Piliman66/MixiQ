# Mixonset

Een eigen wachtrij voor Spotify op de iPad. Nummers verschuif je met de greep (≡). **Hierna** zet een nummer direct na het huidige nummer. Aanraken speelt nooit iets af; alleen **Speel nu** doet dat, met een bevestiging die je kunt uitzetten.

Mixonset bewaart de wachtrij zelf en zegt tegen Spotify welk nummer er moet spelen. Aan het einde van een nummer start het volgende uit de wachtrij. Het geluid komt uit de Spotify-app of uit je speaker (Spotify Connect). Spotify Premium is nodig.

## Bekijken zonder Spotify

Open `index.html?demo` (of `?demo&kort` voor nummers van 20 seconden). Er klinkt dan niets, maar alles werkt.

## Spotify koppelen

1. Ga naar developer.spotify.com, open het Dashboard en kies **Create app**.
2. Vul in:
   - Naam: `Mixonset`
   - Redirect URI: het adres van de app, bijvoorbeeld `https://…/` (lokaal: `http://127.0.0.1:5173/`)
   - API: **Web API**
3. Zet de **Client ID** in `js/config.js`. Die is niet geheim: Mixonset logt in met PKCE, zonder client secret.
4. Zolang de app in development mode staat, kunnen alleen jij en de gebruikers die je bij **User Management** toevoegt (maximaal 25) inloggen.

## Lokaal draaien

```
python3 -m http.server 5173 --bind 127.0.0.1
```

Open daarna http://127.0.0.1:5173/. Spotify accepteert voor lokaal testen alleen `127.0.0.1`, geen `localhost`.

## Bestanden

| Bestand | Wat erin staat |
|---|---|
| `js/app.js` | Scherm, wachtrij en het doorschuiven naar het volgende nummer |
| `js/spotify.js` | Inloggen en de Web API |
| `js/speler.js` | Spotify afspelen, plus de voorbeeldspeler |
| `js/sorteer.js` | Slepen aan de greep |
