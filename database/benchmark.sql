-- ==============================================================================
-- Progetto: Armâia dei Nodi - Speleoteca Diffusa Macro-Regionale
-- Script: Benchmark delle Prestazioni degli Indici Spaziali (GiST) e Lessicali (GIN)
-- Obiettivo: Validazione empirica della complessità temporale O(log N) vs O(N)
-- ==============================================================================

-- ==============================================================================
-- FASE 1: GENERAZIONE DATASET SINTETICO SCALARE (100.000 utenti)
-- ==============================================================================
\echo '>>> 1. Inserimento di 100.000 utenti fittizi nella macroregione Ligure-Piemontese-Toscana...'

INSERT INTO users (username, email, user_location)
SELECT 
    'user_bench_' || i,
    'bench_' || i || '@test.local',
    ST_SetSRID(ST_MakePoint(
        8.0 + (random() * 2.5),   -- Longitudine casuale: 8.0 - 10.5
        43.5 + (random() * 1.5)   -- Latitudine casuale: 43.5 - 45.0
    ), 4326)
FROM generate_series(1, 100000) AS i;

-- Aggiornamento statistiche interne del DBMS per il Query Planner
\echo '>>> Aggiornamento statistiche (ANALYZE users)...'
ANALYZE users;

-- ==============================================================================
-- FASE 2: TEST RICERCA RADIALE GEODETICA (ST_DWithin su Geometria Perturbata)
-- ==============================================================================
\echo ''
\echo '===================================================================='
\echo 'TEST 1A: ST_DWithin CON INDICE GiST FUNZIONALE (idx_users_perturbed_location_geog)'
\echo '===================================================================='

EXPLAIN (ANALYZE, BUFFERS) 
WITH perturbed_nodes AS (
    SELECT 
        u.user_id,
        u.username,
        ST_SetSRID(
            ST_MakePoint(
                ST_X(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lng'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0),
                ST_Y(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lat'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0)
            ),
            4326
        )::geography AS perturbed_geog
    FROM users u
)
SELECT user_id, username
FROM perturbed_nodes pn
WHERE ST_DWithin(
    pn.perturbed_geog,
    ST_SetSRID(ST_MakePoint(8.93, 44.41), 4326)::geography,
    15000
);

\echo ''
\echo '===================================================================='
\echo 'TEST 1B: ST_DWithin CON SCANSIONE SEQUENZIALE FORZATA (Seq Scan)'
\echo '===================================================================='

SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS) 
WITH perturbed_nodes AS (
    SELECT 
        u.user_id,
        u.username,
        ST_SetSRID(
            ST_MakePoint(
                ST_X(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lng'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0),
                ST_Y(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lat'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0)
            ),
            4326
        )::geography AS perturbed_geog
    FROM users u
)
SELECT user_id, username
FROM perturbed_nodes pn
WHERE ST_DWithin(
    pn.perturbed_geog,
    ST_SetSRID(ST_MakePoint(8.93, 44.41), 4326)::geography,
    15000
);

RESET enable_indexscan;
RESET enable_bitmapscan;

-- ==============================================================================
-- FASE 3: TEST RICERCA VIEWPORT BOUNDING BOX (Operatore && su Geometria Perturbata Geodetica)
-- ==============================================================================
\echo ''
\echo '===================================================================='
\echo 'TEST 2A: BBOX OVERLAP CON INDICE GiST GEODETICO (idx_users_perturbed_location_geog)'
\echo '===================================================================='

EXPLAIN (ANALYZE, BUFFERS)
WITH perturbed_nodes AS (
    SELECT 
        u.user_id,
        u.username,
        ST_SetSRID(
            ST_MakePoint(
                ST_X(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lng'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0),
                ST_Y(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lat'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0)
            ),
            4326
        )::geography AS perturbed_geog
    FROM users u
)
SELECT user_id, username
FROM perturbed_nodes pn
WHERE pn.perturbed_geog && ST_MakeEnvelope(8.85, 44.38, 9.05, 44.48, 4326)::geography;

\echo ''
\echo '===================================================================='
\echo 'TEST 2B: BBOX OVERLAP CON SCANSIONE SEQUENZIALE FORZATA (Seq Scan)'
\echo '===================================================================='

SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
WITH perturbed_nodes AS (
    SELECT 
        u.user_id,
        u.username,
        ST_SetSRID(
            ST_MakePoint(
                ST_X(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lng'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0),
                ST_Y(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lat'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0)
            ),
            4326
        )::geography AS perturbed_geog
    FROM users u
)
SELECT user_id, username
FROM perturbed_nodes pn
WHERE pn.perturbed_geog && ST_MakeEnvelope(8.85, 44.38, 9.05, 44.48, 4326)::geography;

RESET enable_indexscan;
RESET enable_bitmapscan;

-- ==============================================================================
-- FASE 4: TEST RICERCA IBRIDA LESSICALE (GIN simple + ts_rank + CASE)
-- ==============================================================================
\echo ''
\echo '>>> 2. Inserimento di 50.000 libri sintetici specialistici...'

INSERT INTO books (owner_id, isbn, title, author, publication_year, category, status)
SELECT 
    (SELECT user_id FROM users WHERE username = 'speleo_ge'),
    '978-BENCH-' || i,
    CASE (i % 8)
        WHEN 0 THEN 'Manuale di speleologia carsica volume ' || i
        WHEN 1 THEN 'Fisica e meteorologia ipogea tomo ' || i
        WHEN 2 THEN 'Trattato di idrologia sotterranea ' || i
        WHEN 3 THEN 'Geologia delle formazioni calcaree ' || i
        WHEN 4 THEN 'Speleogenesi e cavità naturali ' || i
        WHEN 5 THEN 'Quaderni di biospeleologia alpina ' || i
        WHEN 6 THEN 'Topografia e rilievo 3D in grotta ' || i
        ELSE 'Speleosubacquea e soccorso in sifone ' || i
    END,
    CASE (i % 4)
        WHEN 0 THEN 'Giovanni Badino'
        WHEN 1 THEN 'Club Alpino Italiano'
        WHEN 2 THEN 'Federazione Speleologica'
        ELSE 'Rick Stanton'
    END,
    1980 + (i % 40),
    'Manuali Tecnici',
    'available'
FROM generate_series(1, 50000) AS i;

\echo '>>> Aggiornamento statistiche (ANALYZE books)...'
ANALYZE books;

\echo ''
\echo '===================================================================='
\echo 'TEST 3A: RICERCA IBRIDA CON INDICE GIN ATTIVO (idx_books_fulltext)'
\echo '===================================================================='

EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    b.book_id, b.isbn, b.title, b.author, b.publication_year, b.category, b.status, b.cover_thumb, u.username AS owner
FROM books b
JOIN users u ON b.owner_id = u.user_id
WHERE b.deleted_at IS NULL
  AND (
      to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.author, '') || ' ' || coalesce(b.category, '') || ' ' || coalesce(b.isbn, ''))
          @@ to_tsquery('simple', 'idrologia:*')
  )
ORDER BY 
    CASE 
        WHEN lower(b.title) = lower('idrologia') THEN 1
        WHEN lower(b.title) LIKE lower('idrologia') || '%' THEN 2
        WHEN lower(b.author) LIKE lower('idrologia') || '%' THEN 3
        ELSE 4
    END ASC,
    ts_rank(
        to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.author, '') || ' ' || coalesce(b.category, '') || ' ' || coalesce(b.isbn, '')),
        to_tsquery('simple', 'idrologia:*')
    ) DESC,
    b.title ASC
LIMIT 50;

\echo ''
\echo '===================================================================='
\echo 'TEST 3B: RICERCA IBRIDA CON SCANSIONE SEQUENZIALE FORZATA (Seq Scan)'
\echo '===================================================================='

SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    b.book_id, b.isbn, b.title, b.author, b.publication_year, b.category, b.status, b.cover_thumb, u.username AS owner
FROM books b
JOIN users u ON b.owner_id = u.user_id
WHERE b.deleted_at IS NULL
  AND (
      to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.author, '') || ' ' || coalesce(b.category, '') || ' ' || coalesce(b.isbn, ''))
          @@ to_tsquery('simple', 'idrologia:*')
  )
ORDER BY 
    CASE 
        WHEN lower(b.title) = lower('idrologia') THEN 1
        WHEN lower(b.title) LIKE lower('idrologia') || '%' THEN 2
        WHEN lower(b.author) LIKE lower('idrologia') || '%' THEN 3
        ELSE 4
    END ASC,
    ts_rank(
        to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.author, '') || ' ' || coalesce(b.category, '') || ' ' || coalesce(b.isbn, '')),
        to_tsquery('simple', 'idrologia:*')
    ) DESC,
    b.title ASC
LIMIT 50;

RESET enable_indexscan;
RESET enable_bitmapscan;

-- ==============================================================================
-- FASE 5: BONIFICA INTEGRALE DEI DATI SINTETICI DI TEST
-- ==============================================================================
\echo ''
\echo '>>> Pulizia dei dati di benchmark (DELETE books & users)...'
DELETE FROM books WHERE isbn LIKE '978-BENCH-%';
DELETE FROM users WHERE username LIKE 'user_bench_%';

\echo '>>> Ricalcolo statistiche finali...'
ANALYZE books;
ANALYZE users;

\echo '>>> Benchmark completato con successo!'
