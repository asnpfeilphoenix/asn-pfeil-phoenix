# ASN Pfeil Phönix — Website

Moderne Vereinswebsite für den ASN Pfeil Phönix e.V. Nürnberg.  
Gebaut mit [Astro](https://astro.build), gehostet auf [Vercel](https://vercel.com), Inhalte über [Decap CMS](https://decapcms.org).

**Kosten: €0/Monat** — GitHub kostenlos · Vercel Hobby kostenlos · Decap CMS Open Source.

---

## Schnellstart (Entwicklung)

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Entwicklungsserver starten (http://localhost:4321)
npm run dev

# 3. Produktions-Build erstellen
npm run build

# 4. Build lokal vorschauen
npm run preview
```

---

## Deployment: GitHub + Vercel (einmalige Einrichtung)

### Schritt 1 — GitHub Repository anlegen

1. Gehe zu [github.com](https://github.com) und erstelle ein neues Repository namens `asn-pfeil-phoenix`
2. Setze es auf **Public** (für Vercel Hobby notwendig) oder Private (Vercel Pro)
3. Führe lokal aus:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/DEIN_USERNAME/asn-pfeil-phoenix.git
git push -u origin main
```

### Schritt 2 — Vercel verbinden

1. Gehe zu [vercel.com](https://vercel.com) → "Add New Project"
2. Verbinde dein GitHub-Konto und wähle das Repository `asn-pfeil-phoenix`
3. Framework wird automatisch als **Astro** erkannt
4. Klicke **Deploy** — fertig!

Ab jetzt: Jeder `git push` löst einen automatischen Neubau aus (ca. 45–60 Sekunden).

### Schritt 3 — Eigene Domain verbinden (optional)

1. In Vercel → Projekt → Settings → Domains
2. Domain eingeben und DNS-Einträge beim Registrar anpassen (Vercel zeigt die genauen Werte)

---

## CMS einrichten (Decap CMS + GitHub OAuth)

Das CMS läuft unter `/admin`. Redakteure können dort Beiträge erstellen, ohne Git oder Code zu kennen.

### Schritt 1 — CMS-Konfiguration anpassen

Öffne `public/admin/config.yml` und ersetze:
```yaml
backend:
  repo: DEIN_USERNAME/asn-pfeil-phoenix  # ← hier deinen GitHub-Usernamen eintragen
```

### Schritt 2 — GitHub OAuth App erstellen

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
2. Felder ausfüllen:
   - **Application name**: ASN Pfeil Phönix CMS
   - **Homepage URL**: `https://deine-domain.de`
   - **Authorization callback URL**: `https://api.netlify.com/auth/done`
3. **Client ID** und **Client Secret** notieren

### Schritt 3 — Netlify als OAuth-Proxy (kostenlos, kein Hosting nötig)

Decap CMS benötigt einen OAuth-Server. Netlify stellt diesen kostenlos bereit:

1. Kostenloses Konto auf [netlify.com](https://netlify.com) erstellen
2. Netlify → Site settings → Access control → OAuth → **Install provider**: GitHub
3. Client ID und Secret aus Schritt 2 eintragen

### Schritt 4 — Redakteure hinzufügen

Redakteure müssen als **Collaborator** zum GitHub-Repository eingeladen werden:  
GitHub → Repository → Settings → Collaborators → "Add people"

Danach können sie sich unter `https://deine-domain.de/admin` mit GitHub einloggen.

---

## Inhalte bearbeiten (für Redakteure ohne Technik-Kenntnisse)

1. Browser öffnen → `https://deine-domain.de/admin`
2. Mit GitHub einloggen
3. **"News & Berichte"** → **"Neu"** klicken
4. Felder ausfüllen: Titel, Kurzbeschreibung, Datum, Sportart, Bild, Text
5. **"Veröffentlichen"** klicken
6. Die Website aktualisiert sich automatisch innerhalb von ~60 Sekunden

---

## Projektstruktur

```
asn-pfeil-phoenix/
├── src/
│   ├── content/
│   │   ├── config.ts          ← Content-Schema-Definition
│   │   └── news/              ← Markdown-Beiträge (*.md)
│   ├── layouts/
│   │   └── BaseLayout.astro   ← Header, Footer, HTML-Gerüst
│   ├── pages/
│   │   ├── index.astro        ← Startseite
│   │   ├── news/
│   │   │   ├── index.astro    ← News-Übersicht
│   │   │   └── [slug].astro   ← Einzelner Beitrag
│   │   ├── fussball/index.astro
│   │   ├── tennis/index.astro
│   │   ├── kegeln/index.astro
│   │   ├── verein/index.astro
│   │   ├── admin/index.astro  ← CMS-Admin-Panel
│   │   ├── impressum.astro
│   │   ├── datenschutz.astro
│   │   └── 404.astro
│   └── styles/
│       └── global.css
├── public/
│   ├── admin/
│   │   └── config.yml         ← Decap CMS Konfiguration
│   ├── images/
│   │   └── uploads/           ← Hochgeladene Bilder (via CMS)
│   └── favicon.svg
├── astro.config.mjs
├── vercel.json
└── package.json
```

---

## Einen neuen Beitrag manuell anlegen (für Entwickler)

Neue Datei in `src/content/news/` anlegen, z.B. `mein-beitrag.md`:

```markdown
---
title: "Spielbericht: 2:0-Heimsieg"
excerpt: "Die 1. Mannschaft gewinnt souverän mit 2:0."
date: 2026-04-01
sport: fussball
author: "Trainer"
image: "/images/uploads/spiel-foto.jpg"
featured: false
draft: false
---

Hier kommt der Beitragstext in Markdown...
```

---

## BFV-Widget anpassen

Die BFV-Widgets zeigen Live-Daten (Tabelle, Spielplan) direkt vom Bayerischen Fußball-Verband.  
Widget-URLs für andere Mannschaften generieren unter: **bfv.de → Mannschaft → "BFV-Widget generieren"**

Widgets sind eingebettet in:
- `src/pages/index.astro` (Startseite)  
- `src/pages/fussball/index.astro` (Fußball-Seite)

---

## Technologie-Stack

| Was | Womit | Warum |
|-----|-------|-------|
| Framework | Astro 4 | Statisch, blitzschnell, kein JS-Overhead |
| Inhalte | Markdown + Astro Content Collections | Strukturiert, typsicher |
| CMS | Decap CMS | Keine Datenbank, läuft im Browser, Open Source |
| Hosting | Vercel | Kostenlos, Auto-Deploy bei git push |
| Versionskontrolle | GitHub | Kostenlos, Backup, Zusammenarbeit |
| Fixtures | BFV-Widget | Live-Daten ohne eigene API |
| Karten | OpenStreetMap | Kein API-Key, datenschutzfreundlich |
