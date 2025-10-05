# Online-Autokatalog

Ein voll funktionsfähiger Fahrzeugkatalog mit Express-Backend, JSON-Datenhaltung und modernem Vanilla-Frontend. Community-Einreichungen landen in einer Review-Queue, das Admin-Interface verwaltet Fahrzeuge, Benutzer, Marken und Kategorien.

## Schnellstart

```bash
npm install
npm run dev
```

* Entwicklungsserver: <http://localhost:3000>
* Standard-Logins: Die sind veraltet ihr opfer
  * `admin` / `admin123` (Rolle: admin)
  * `editor` / `editor123` (Rolle: editor)
  * `demo` / `demo123` (Rolle: editor)

## Projektstruktur

```
public/       # Frontend (HTML, CSS, JS, Assets)
data/         # JSON-Datenbanken
utils/        # Hilfsfunktionen (Validierung, File-Locking)
server.js     # Express-Server mit REST-API
```

## Skripte

| Befehl        | Beschreibung                         |
|---------------|--------------------------------------|
| `npm run dev` | Startet den Entwicklungsserver (nodemon)
| `npm start`   | Startet den Server im Produktivmodus |

## API-Überblick

Alle Endpunkte liefern JSON und erwarten Session-Cookies für geschützte Bereiche.

### Authentifizierung
- `POST /api/auth/login` – Session aufbauen
- `POST /api/auth/logout`
- `GET /api/auth/me` – aktuelle Session prüfen

### Fahrzeuge (`editor`+)
- `GET /api/cars` – Filter über Query (`brand`, `bodyType`, `yearFrom`, `yearTo`, `q`)
- `GET /api/cars/:id`
- `POST /api/cars` – Multipart, Felder + `images[]`
- `PUT /api/cars/:id` – Multipart, mit `keepImages` (JSON-Array)
- `DELETE /api/cars/:id`

### Pending (Einreichungen, `editor`+)
- `POST /api/pending` – Öffentlich, Multipart (Community-Formular)
- `GET /api/pending`
- `GET /api/pending/:id`
- `POST /api/pending/:id/approve`
- `POST /api/pending/:id/reject`

### Benutzer (`admin`)
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Stammdaten (`editor`+)
- `GET /api/brands`, `POST /api/brands`, `DELETE /api/brands/:name`
- `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:name`, `DELETE /api/categories/:name`

## Validierung & Uploads

* Pflichtfelder: `brand`, `model`, `year`
* Jahr: 1886 – aktuelles Jahr + 1
* Uploads: JPEG/PNG, 12 Dateien à max. 8 MB, Ablage unter `public/uploads/<carId>/`
* Externe Bild-Links (http/https) können zusätzlich gepflegt werden; sie bleiben beim Bearbeiten erhalten.
* JSON-Schreibzugriffe laufen über ein Mutex, um Race-Conditions zu verhindern.

## Frontend-Highlights

* Apple-inspiriertes Layout, sanfte Animationen, Grid mit 1–3 Spalten
* Filterleiste, Kategorien mit Icons (grau, falls leer)
* Bild-Overlay mit Tastatur- und Touch-Steuerung
* Vergleichsleiste (sticky) + dynamische Vergleichstabelle
* Admin-UI mit Dialogen für Fahrzeug-, Pending-, Benutzer- und Stammdatenverwaltung
* Community-Formular inklusive Vorschau für Uploads und dynamischen Kategorien

## Hinweise

* Daten liegen ausschließlich in `data/*.json` – für persistente Speicherung ggf. Backups einplanen.
* Session-Timeout nach 10 Minuten Inaktivität (rolling).
* Für Produktivbetrieb sollte `SESSION_SECRET` gesetzt werden.
