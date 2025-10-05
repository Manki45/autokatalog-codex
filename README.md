# Online-Autokatalog

Ein Community-getriebener Fahrzeugkatalog mit modernem Vanilla-Frontend. Besucher können Fahrzeuge filtern, vergleichen und im Detail betrachten, während die Community neue Fahrzeuge zur Prüfung einreichen kann.

## So funktioniert die Website

- **Startseite**: Einstieg mit Kategorien, Highlights aus der Community und einem Komplettüberblick über alle Fahrzeuge.
- **Filtern & Suchen**: Marke, Karosserieform, Baujahre sowie eine freie Suche helfen dabei, den passenden Wagen zu finden.
- **Vergleich**: Fahrzeuge lassen sich vormerken und anschließend nebeneinander vergleichen.
- **Bild-Overlay**: Detailansichten unterstützen Vollbild, Navigation per Tastatur und Touch.
- **Einreichungen**: Das Formular unter `Fahrzeug einreichen` ermöglicht der Community, neue Fahrzeuge samt Bildern vorzuschlagen.
- **Administration**: Unter `Admin Login` verwalten autorisierte Nutzer Fahrzeuge, Kategorien und Freigaben. Login-Daten werden individuell vergeben und nicht öffentlich dokumentiert.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Der Entwicklungsserver läuft anschließend standardmäßig unter <http://localhost:3000>.

## Projektstruktur

```
public/       # Frontend (HTML, CSS, JS, Assets)
data/         # JSON-Datenbanken für Fahrzeuge & Stammdaten
utils/        # Hilfsfunktionen (Validierung, File-Locking)
server.js     # Express-Server mit REST-API
```

## Skripte

| Befehl        | Beschreibung                         |
|---------------|--------------------------------------|
| `npm run dev` | Startet den Entwicklungsserver (nodemon)
| `npm start`   | Startet den Server im Produktivmodus |

## Hinweise

- Produktionszugänge sollten individuell erzeugt und sicher verwahrt werden.
- Für Deployments empfiehlt sich ein sicheres `SESSION_SECRET` sowie Backups der JSON-Daten.
