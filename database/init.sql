-- ==============================================================================
-- Progetto: Armâia dei Nodi - Speleoteca Diffusa Macro-Regionale
-- DBMS: PostgreSQL + PostGIS (SRID 4326 - WGS 84)
-- ==============================================================================

-- Abilitazione estensioni: geospaziale, crittografica e trigrammi per ricerca testuale
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Tabella Utenti/Custodi
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(128) UNIQUE NOT NULL,
    user_location GEOGRAPHY(Point, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_location_geog ON users USING GIST (user_location);
CREATE INDEX IF NOT EXISTS idx_users_location_geom ON users USING GIST ((user_location::geometry));

-- Indici Funzionali GiST per Geometria Perturbata / Offuscamento Deterministico (Privacy-Preserving)
CREATE INDEX IF NOT EXISTS idx_users_perturbed_location_geog ON users USING GIST (
    (
        ST_SetSRID(
            ST_MakePoint(
                ST_X(user_location::geometry) + ((('x' || substr(md5(user_id::text || 'armaia_salt_lng'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0),
                ST_Y(user_location::geometry) + ((('x' || substr(md5(user_id::text || 'armaia_salt_lat'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0)
            ),
            4326
        )::geography
    )
);

CREATE INDEX IF NOT EXISTS idx_users_perturbed_location_geom ON users USING GIST (
    ST_SetSRID(
        ST_MakePoint(
            ST_X(user_location::geometry) + ((('x' || substr(md5(user_id::text || 'armaia_salt_lng'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0),
            ST_Y(user_location::geometry) + ((('x' || substr(md5(user_id::text || 'armaia_salt_lat'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0)
        ),
        4326
    )
);

-- Tabella Catalogo Libri
CREATE TABLE IF NOT EXISTS books (
    book_id SERIAL PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    isbn VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(150) NOT NULL,
    publication_year INTEGER CHECK (publication_year > 1400 AND publication_year <= 2100),
    category VARCHAR(100) NOT NULL,
    cover_thumb VARCHAR(255),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'requested', 'loaned')),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Indice Full-Text GIN per ricerca lessicale (dizionario 'simple' per letteratura grigia e codici tecnici)
CREATE INDEX IF NOT EXISTS idx_books_fulltext ON books USING GIN (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(author, '') || ' ' || coalesce(category, '') || ' ' || coalesce(isbn, ''))
);

-- Indici Trigram GIN per accelerazione del pattern matching relazionale (ILIKE / sottostringhe)
CREATE INDEX IF NOT EXISTS idx_books_search_trgm ON books USING GIN (
    (coalesce(title, '') || ' ' || coalesce(author, '') || ' ' || coalesce(category, '') || ' ' || coalesce(isbn, '')) gin_trgm_ops
);
CREATE INDEX IF NOT EXISTS idx_books_title_trgm ON books USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_books_owner ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_deleted_at ON books(deleted_at);

-- Tabella Registro Prestiti
CREATE TABLE IF NOT EXISTS loans (
    loan_id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books(book_id) ON DELETE RESTRICT,
    borrower_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    request_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    loan_status VARCHAR(20) DEFAULT 'pending' CHECK (loan_status IN ('pending', 'active', 'completed', 'rejected'))
);

-- Indice Univoco Parziale: impedisce a livello DBMS che un libro abbia più di una richiesta 'pending' o 'active'
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_or_pending_loan 
ON loans (book_id) 
WHERE loan_status IN ('pending', 'active');

-- Indice Univoco Parziale: impedisce richieste duplicate pendenti per lo stesso utente sullo stesso volume
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_pending_loan 
ON loans (book_id, borrower_id) 
WHERE loan_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_loans_book_id ON loans(book_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);

-- Trigger di Integrità Referenziale a Livello DBMS: impedisce l'auto-prestito (borrower == owner)
CREATE OR REPLACE FUNCTION check_loan_not_self()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id FROM books WHERE book_id = NEW.book_id;
    IF v_owner_id IS NOT NULL AND v_owner_id = NEW.borrower_id THEN
        RAISE EXCEPTION 'Auto-prestito non consentito: il custode proprietario non puo richiedere in prestito il proprio volume'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_loan_not_self ON loans;
CREATE TRIGGER trg_check_loan_not_self
BEFORE INSERT ON loans
FOR EACH ROW
EXECUTE FUNCTION check_loan_not_self();

-- Dati Seed Dimostrativi (Macroregione Ligure-Piemontese-Toscana)
INSERT INTO users (username, email, user_location) VALUES
('speleo_ge', 'ge@speleo.it', ST_SetSRID(ST_MakePoint(8.9463, 44.4056), 4326)),
('carsico_cn', 'cn@speleo.it', ST_SetSRID(ST_MakePoint(7.5500, 44.3833), 4326)),
('apuane_lu', 'lu@speleo.it', ST_SetSRID(ST_MakePoint(10.5000, 44.0167), 4326))
ON CONFLICT (username) DO NOTHING;

-- Dati Seed Volumi Dimostrativi
INSERT INTO books (owner_id, isbn, title, author, publication_year, category, cover_thumb, status) VALUES
((SELECT user_id FROM users WHERE username = 'speleo_ge'),
 '9788879821490', 'Manuale di speleologia', 'Club Alpino Italiano', 2005,
 'Manuali Tecnici', 'speleologia.webp', 'available'),

((SELECT user_id FROM users WHERE username = 'speleo_ge'),
 '9788898144055', 'Fisica del clima sotterraneo', 'Giovanni Badino', 2010,
 'Meteorologia Ipogea', 'clima.webp', 'available'),

((SELECT user_id FROM users WHERE username = 'carsico_cn'),
 '9788837911022', 'La fenice delle grotte', 'Andrea Gobetti', 1999,
 'Narrativa e Storia', 'fenice.webp', 'available'),

((SELECT user_id FROM users WHERE username = 'carsico_cn'),
 '9788867009410', 'Aquanaut', 'Rick Stanton', 2021,
 'Biografie e Soccorso', 'aqua.webp', 'available'),

((SELECT user_id FROM users WHERE username = 'apuane_lu'),
 '9788879820500', 'Monte Corchia', 'SSI', 2003,
 'Monografie d''Abisso', 'corchia.webp', 'available')
ON CONFLICT DO NOTHING;
