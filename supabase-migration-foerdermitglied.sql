-- Migration: Fördermitgliedschaft + Parkausweis system
-- Run in Supabase SQL Editor

-- ── 1. Config table (single row) ──────────────────────────────
-- Note: the annual fee for Fördermitgliedschaft is NOT stored here.
-- It lives in public/data/beitraege.csv (abteilung='foerdermitglied'),
-- consistent with how every other membership fee in this project is managed.
CREATE TABLE IF NOT EXISTS foerdermitglied_config (
  id            TEXT PRIMARY KEY DEFAULT 'config',
  max_plaetze   INTEGER NOT NULL DEFAULT 15,
  gueltig_jahr  INTEGER NOT NULL DEFAULT 2026
);
INSERT INTO foerdermitglied_config (id, max_plaetze, gueltig_jahr)
VALUES ('config', 15, 2026)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE foerdermitglied_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config oeffentlich lesbar" ON foerdermitglied_config FOR SELECT TO anon USING (true);
CREATE POLICY "Admins lesen Config" ON foerdermitglied_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins aendern Config" ON foerdermitglied_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT ON public.foerdermitglied_config TO anon;
GRANT SELECT, UPDATE ON public.foerdermitglied_config TO authenticated;
GRANT SELECT, UPDATE ON public.foerdermitglied_config TO service_role;

-- ── 2. Main Fördermitglieder table ────────────────────────────
CREATE TABLE IF NOT EXISTS foerdermitglieder (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  antrag_id       TEXT NOT NULL UNIQUE,
  permit_code     TEXT UNIQUE,
  eingegangen_am  TIMESTAMPTZ DEFAULT now(),
  anrede          TEXT,
  vorname         TEXT NOT NULL,
  nachname        TEXT NOT NULL,
  strasse         TEXT,
  plz             TEXT,
  ort             TEXT,
  telefon         TEXT,
  email           TEXT NOT NULL,
  kennzeichen     TEXT NOT NULL,
  fahrzeug_marke  TEXT,
  fahrzeug_modell TEXT,
  fahrzeug_farbe  TEXT,
  kontoinhaber    TEXT,
  iban            TEXT,
  betrag_jaehrlich NUMERIC,
  status          TEXT NOT NULL DEFAULT 'beantragt', -- beantragt | genehmigt | warteliste | abgelehnt | beendet
  parkplatz_nummer INTEGER,
  gueltig_von     DATE,
  gueltig_bis     DATE,
  genehmigt_von   TEXT,
  genehmigt_am    TIMESTAMPTZ,
  abgelehnt_grund TEXT,
  beendet_am      TIMESTAMPTZ,
  warteliste_benachrichtigt_am TIMESTAMPTZ,
  satzung_anerkannt BOOLEAN DEFAULT false
);

ALTER TABLE foerdermitglieder ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Foerderantrag einreichen" ON foerdermitglieder FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins lesen Foerdermitglieder" ON foerdermitglieder FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins aendern Foerdermitglieder" ON foerdermitglieder FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins loeschen Foerdermitglieder" ON foerdermitglieder FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT ON public.foerdermitglieder TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foerdermitglieder TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foerdermitglieder TO service_role;

CREATE INDEX foerder_status_idx ON foerdermitglieder (status);
CREATE INDEX foerder_permit_idx ON foerdermitglieder (permit_code);

-- ── 3. Temporary parking permits (donor rewards) ──────────────
CREATE TABLE IF NOT EXISTS temp_parkausweise (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  permit_code  TEXT UNIQUE NOT NULL,
  erstellt_am  TIMESTAMPTZ DEFAULT now(),
  erstellt_von TEXT,
  name         TEXT NOT NULL,
  adresse      TEXT,
  kennzeichen  TEXT NOT NULL,
  grund        TEXT,
  gueltig_von  DATE NOT NULL,
  gueltig_bis  DATE NOT NULL
);

ALTER TABLE temp_parkausweise ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins verwalten temp Parkausweise" ON temp_parkausweise FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.temp_parkausweise TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.temp_parkausweise TO service_role;

CREATE INDEX temp_permit_idx ON temp_parkausweise (permit_code);

-- ── 4. Invoice/permit counters (reuses existing invoice_counter table) ─
INSERT INTO invoice_counter (id, year, counter) VALUES ('foerdermitglied_2026', 2026, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_counter (id, year, counter) VALUES ('temp_parkausweis_2026', 2026, 0) ON CONFLICT (id) DO NOTHING;

-- ── 5. Public availability RPC (no personal data exposed) ─────
CREATE OR REPLACE FUNCTION get_foerdermitglied_verfuegbarkeit()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max INTEGER;
  v_belegt INTEGER;
  v_warteliste INTEGER;
BEGIN
  SELECT max_plaetze INTO v_max FROM foerdermitglied_config WHERE id = 'config';
  SELECT count(*) INTO v_belegt FROM foerdermitglieder WHERE status = 'genehmigt' AND gueltig_bis >= CURRENT_DATE;
  SELECT count(*) INTO v_warteliste FROM foerdermitglieder WHERE status = 'warteliste';
  RETURN json_build_object('max', v_max, 'belegt', v_belegt, 'frei', GREATEST(v_max - v_belegt, 0), 'warteliste', v_warteliste);
END;
$$;
GRANT EXECUTE ON FUNCTION get_foerdermitglied_verfuegbarkeit TO anon;
GRANT EXECUTE ON FUNCTION get_foerdermitglied_verfuegbarkeit TO authenticated;

-- ── 6. Add 'foerdermitglieder' to admin role tags (optional helper) ───
-- To grant an existing admin access to the Förder-portal, add 'foerdermitglieder'
-- to their abteilungen array, e.g.:
-- UPDATE admin_roles SET abteilungen = array_append(abteilungen, 'foerdermitglieder') WHERE email = 'christian@example.com';
-- Admins with 'all' already have full access automatically.

-- If you already ran an earlier version of this migration with a
-- jahresbeitrag column, drop it now that the fee lives in beitraege.csv:
-- ALTER TABLE foerdermitglied_config DROP COLUMN IF EXISTS jahresbeitrag;

-- ── Done ────────────────────────────────────────────────────────
-- Verify: SELECT * FROM foerdermitglied_config; SELECT get_foerdermitglied_verfuegbarkeit();
