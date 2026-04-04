# Mitgliedsantrag + Verwaltungsportal — ASN Pfeil Phönix

DSGVO-konformes digitales Antragsystem:
- Sensible Daten (IBAN, persönliche Daten) werden **nie per E-Mail verschickt**
- Alle Daten landen in **Supabase** (verschlüsselt at rest, EU-Server wählbar)
- Verein erhält nur eine **Benachrichtigungs-E-Mail** ohne persönliche Daten
- Admins rufen Daten über ein **passwortgeschütztes Portal** ab
- **Hard-Delete** nach Bearbeitung (DSGVO-konform)

---

## Neue/geänderte Dateien

```
src/pages/mitglied/antrag.astro           ← Mitgliedsantrag-Formular
src/pages/api/submit-antrag.ts            ← API: speichert in Supabase
src/pages/verwaltung/antraege-2025.astro  ← Admin-Portal (Login + Verwaltung)
supabase-setup.sql                        ← Datenbankstruktur (einmalig ausführen)
public/data/beitraege.csv                 ← Beitragsstruktur (flexibel)
```

---

## Einrichtung (einmalig)

### Schritt 1 — Supabase-Konto erstellen

1. [supabase.com](https://supabase.com) → **Start for free**
2. Neues Projekt: Name `asn-pfeil-phoenix`, Region **Frankfurt (eu-central-1)**
3. Warten bis bereit (~2 Minuten)

### Schritt 2 — Datenbanktabelle erstellen

1. Supabase Dashboard → **SQL Editor** → **New Query**
2. Inhalt von `supabase-setup.sql` einfügen und auf **Run** klicken

### Schritt 3 — Admin-Konten anlegen

1. Supabase → **Authentication** → **Users** → **Invite user**
2. Zwei Konten einladen:
   - `fam.foertsch@yahoo.de` (Christian Förtsch)
   - `david@elsweiler.co.uk` (David Elsweiler)
3. Beide erhalten eine E-Mail und können ihr Passwort setzen

### Schritt 4 — API-Keys aus Supabase holen

Supabase → **Settings** → **API**:

| Variable | Wo |
|----------|----|
| `SUPABASE_URL` | "Project URL" |
| `SUPABASE_SERVICE_KEY` | "service_role" secret key |
| `SUPABASE_ANON_KEY` | "anon public" key |

### Schritt 5 — Umgebungsvariablen in Vercel setzen

| Variable | Wert |
|----------|------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role key |
| `SUPABASE_ANON_KEY` | anon key |
| `RESEND_API_KEY` | von resend.com |
| `VEREIN_EMAIL` | `vorstand@asn-pfeil-phoenix.de` |
| `FROM_EMAIL` | `antrag@asn-pfeil-phoenix.de` |
| `ADMIN_URL` | `https://asn-pfeil-phoenix.vercel.app/verwaltung/antraege-2025` |

**Lokal** (`.env`):
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
RESEND_API_KEY=re_...
VEREIN_EMAIL=vorstand@asn-pfeil-phoenix.de
FROM_EMAIL=antrag@asn-pfeil-phoenix.de
ADMIN_URL=http://localhost:4321/verwaltung/antraege-2025
```

### Schritt 6 — Deployen

```bash
git add .
git commit -m "feat: Supabase-Integration + Admin-Portal"
git push
```

---

## Admin-Portal

URL: `https://deine-domain.de/verwaltung/antraege-2025`

- Nicht öffentlich verlinkt — URL muss bekannt sein
- Login mit E-Mail + Passwort (Supabase Auth)
- Liste aller offenen Anträge
- Detailansicht mit allen Feldern inkl. IBAN
- JSON-Download pro Antrag
- Hard-Delete mit Bestätigungsdialog

---

## DSGVO-Hinweise

- ✅ Keine sensiblen Daten per E-Mail
- ✅ Daten at-rest verschlüsselt (Supabase Standard)
- ✅ EU-Server Frankfurt wählbar
- ✅ Hard-Delete auf Knopfdruck
- ✅ Zugriff nur für authentifizierte Admins (Row Level Security)
- ⚠️ Datenschutzerklärung sollte Supabase als Auftragsverarbeiter nennen
- ⚠️ AVV mit Supabase abschließen (kostenlos unter supabase.com/legal)
