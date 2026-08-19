# Armâia dei Nodi: Ecosistema Geospaziale per la "Speleoteca Diffusa"

Prototipo software sviluppato per l'elaborato finale del Corso di Laurea in **Informatica per le Aziende Digitali (L-31)**. 
Il sistema consente la catalogazione, la geolocalizzazione e la condivisione peer-to-peer del patrimonio documentale specialistico e della letteratura grigia all'interno della macro-regione carsica ligure-piemontese-toscana.

## Architettura e Scelte Tecnologiche
L'applicazione adotta un'architettura Client-Server disaccoppiata basata sullo stack **PERN**:
- **Frontend:** Single Page Application reattiva sviluppata in **React 19** e **Vite 8**, accoppiata a **Leaflet.js** e OpenStreetMap per lo strato cartografico interattivo.
- **Backend:** Node.js (runtime v24 LTS) con framework **Express**, strutturato secondo un pattern architetturale modulare a strati (`backend/src/` con separazione netta tra `config/`, `controllers/`, `routes/` e `middleware/`).
- **Database:** **PostgreSQL 18** potenziato dal motore topologico **PostGIS 3.6** per la persistenza relazionale e l'elaborazione dei dati spaziali e geodetici su ellissoide WGS 84.
- **Image Processing & Privacy:** Pipeline in-memory basata su **Multer** (`memoryStorage()`) e **Sharp** per acquisire le copertine dei libri, ridimensionarle (200x300 px), rimuovere i metadati EXIF/GPS e convertirle in formato ultra-ottimizzato **WebP**.

> 💡 **Nota sull'Architettura di Backend:**
> Il backend è ingegnerizzato secondo principi di modularità e scalabilità: i controller incapsulano le logiche transazionali ACID e le query spaziali indicizzate, i router definiscono le interfacce RESTful contrattuali, mentre i middleware gestiscono la validazione dei payload in memoria e l'isolamento della sicurezza.

## Ottimizzazione Algoritmica, Indici e Privacy
- **Performance delle Query Spaziali `O(log N)`:** Per eliminare scansioni lineari `O(N)`, le coordinate geografiche sono indicizzate mediante alberi **GiST (Generalized Search Tree)** sia per le query radiali geodetiche (`ST_DWithin` su tipo `geography`) sia per le query su Bounding Box (operatore sferoidale nativo `&&` su `ST_MakeEnvelope(...)::geography`).
- **Ricerca Lessicale Ibrida (GIN + ILIKE):** Per supportare la letteratura grigia e i codici tecnici, il sistema combina indici invertiti **GIN** basati su dizionario non morfologico `simple` e trigrammi compositi (`idx_books_search_trgm`) con pattern matching relazionale `ILIKE` e ranking pesato (`ts_rank` e clausole `CASE`).
- **Transazionalità ACID e Pessimistic Locking:** La concorrenza sulle richieste di prestito è gestita mediante transazioni esplicite `BEGIN...COMMIT` e blocco pessimistico a livello di riga non bloccante (`SELECT ... FOR UPDATE OF b NOWAIT`), intercettando i codici errore Postgres `55P03` e `23505` con mapping su HTTP `409 Conflict`.
- **Integrità Storica e Soft Delete:** Adozione di vincoli `ON DELETE RESTRICT` combinati con il pattern di cancellazione logica (`deleted_at TIMESTAMP WITH TIME ZONE`), preservando le serie storiche dei prestiti anche a seguito della disattivazione di un'opera.
- **Privacy & Security by Design (GDPR):** In conformità agli Artt. 5 e 25 del GDPR, il backend applica un algoritmo di offuscamento deterministico (*jittering* spaziale bidimensionale $\pm 0.004^\circ$ basato su hash MD5 dell'ID custode e salt statico) direttamente in SQL prima di serializzare il payload JSON verso il client, prevenendo attacchi per media campionaria e mascherando l'ubicazione esatta dei custodi.
- **Accessibilità Universale (WCAG 2.1 AA / WAI-ARIA):** Interfaccia progettata con focus trapping deterministico nei componenti modali (`BookDetail`), listener da tastiera `Escape`, regioni vive differenziate (`Toast` con `aria-live`) e pulizia metodica della memoria heap (`URL.revokeObjectURL()`).

## Architettura di Deployment (Cloud-Ready & DMZ)
L'intera infrastruttura è containerizzata e orchestrata tramite **Docker** e **Docker Compose**, garantendo riproducibilità e isolamento:

- **Segregazione di Rete (DMZ Containerizzata):** L'infrastruttura definisce una rete interna bridge privata isolata (`armaia_internal` con parametro `internal: true`), priva di instradamento esterno verso l'host, alla quale accedono unicamente il Database PostGIS e il Backend Node.js.
- **Reverse Proxy Nginx:** Unico container attestato sia sulla rete interna che su quella esposta (`armaia_public`), operante come terminatore HTTP sulla porta host **8055** con intestazioni di sicurezza restrittive (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `server_tokens off`) e caching immutabile delle miniature WebP.

### Prerequisiti
L'unico prerequisito richiesto è la presenza di **Docker** (comprensivo di Docker Compose) installato e attivo sulla macchina host.

### Avvio Rapido dell'Infrastruttura
Dalla radice del repository (`/armaia-dei-nodi`), eseguire:

```bash
docker compose up --build
```

L'applicazione sarà immediatamente accessibile tramite il reverse proxy all'indirizzo:
👉 **http://localhost:8055**

Per arrestare i servizi mantenendo la persistenza del database sul volume Docker:

```bash
docker compose down
```

Per eseguire il benchmark prestazionale degli indici GiST (100.000 tuple):

```powershell
Get-Content database/benchmark.sql | docker compose exec -T db psql -U postgres -d armaia_nodi
```

## Guida al Testing e Scenari Mock
Poiché l'applicazione si basa su dinamiche relazionali (prestiti P2P tra nodi custodi), il database viene pre-popolato con record dimostrativi georeferenziati lungo la macroregione ligure-piemontese-toscana.

Per testare la **Gestione Prestiti**, l'**Esplorazione Mappa** e **La mia libreria**, è possibile selezionare dal modulo di login i seguenti account preconfigurati:

1. **`speleo_ge` (Nodo di Genova - 44.4056 N, 8.9463 E)**:
   - Custode di volumi specialistici (es. *Manuale di speleologia*, *Fisica del clima sotterraneo*).
   - Riceve e invia richieste di consultazione verso gli altri nodi della rete.
2. **`carsico_cn` (Nodo di Cuneo / Alpi Marittime - 44.3833 N, 7.5500 E)**:
   - Custode di testi storici e monografie (es. *La fenice delle grotte*, *Aquanaut*).
3. **`apuane_lu` (Nodo delle Alpi Apuane / Corchia - 44.0167 N, 10.5000 E)**:
   - Custode di rilievi e monografie d'abisso (es. *Monte Corchia*).

