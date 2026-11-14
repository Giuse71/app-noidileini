# App Noi di Leyni — Leinì Volley (Convenzione Sponsor)

Italian UI. Sponsor-discount program: athletes show a QR tessera, partner merchants register discounted purchases, club admin tracks everything.

## Roles (email + password, httpOnly cookie `lv_session`, JWT; role re-read from DB each request)
- **athlete**: registers (nome, cognome, categoria, foto, email, password) → gets code `LV-XXXXXX` + QR. Pages: /atleta (tessera+QR, savings), /atleta/convenzioni, /atleta/movimenti, /atleta/profilo.
- **merchant**: registers business (logo, nome, ragione sociale, P.IVA 11-16 chars, settore, indirizzo, contatti, discount_percent). Pages: /commerciante (cassa: scan QR / manual code / athletes list → amount → discount calc → register), /commerciante/storico, /commerciante/profilo.
- **admin**: /admin tabs: Panoramica, Transazioni (filter + CSV), Atleti, Commercianti, Categorie (add/delete), Associazione (logo + data).
- Public: / landing (association info + partner list), /login (tabs: Accedi, Registrati atleta, Registrati commerciante; demo buttons).

## Data (Mongo)
users{id,email,password_hash,role} · athletes{id,user_id,first_name,last_name,category_id,category_name,photo(dataURL),code} · merchants{id,user_id,...MerchantUpdate} · categories{id,name,order} · association{id:"main",...} · transactions{id,merchant_id,merchant_name,athlete_id,athlete_name,athlete_code,category_name,amount,discount_percent,discount_amount,final_amount,note,created_at}
Discount is computed server-side from the merchant's discount_percent.

## API (/api)
auth: POST /auth/register/athlete, /auth/register/merchant, /auth/login, /auth/logout; GET /auth/me (null if anonymous)
GET /association (public), PUT (admin) · GET /categories (public), POST/DELETE (admin)
GET/PUT /athletes/me (athlete) · GET /athletes?q= , /athletes/by-code/{code} (merchant, admin)
GET /merchants (public) · GET/PUT /merchants/me (merchant)
POST /transactions (merchant) · GET /transactions/mine (athlete|merchant) · GET /admin/transactions (admin)

## Seed (python seed.py, idempotent)
8 categories, 8 athletes (e.g. Giulia Rossi LV-GR1606 Under 16), 6 merchants (Pizzeria Da Gianni 15%, ...), 14 transactions. Credentials in test_credentials.md.

## v2 additions
- **Familiari collegati** (/atleta/famiglia): athlete adds unlimited family members {first_name,last_name,relation}; each gets own code LV-XXXXXX + QR (collection family_members{id,athlete_id,code,...}). GET/POST /athletes/me/family, DELETE /athletes/me/family/{id} (owner only, else 404). /athletes/by-code resolves family codes (is_family=true, family_member_id, holder_name, relation). POST /transactions accepts family_member_id → tx.family_member_name/relation, athlete_id = holder.
- **Icone app = logo associazione**: routers/icons.py. GET /api/icons/{16|32|180|192|512}.png[?maskable=true] renders the association logo (Admin → Associazione) — opaque logos centre-cropped square, transparent ones padded on white; fallback backend/default-icon.png; in-memory cache keyed by logo ref, Cache-Control 5 min. GET /api/manifest.webmanifest is dynamic (icon URLs versioned ?v=<logo file id>). index.html links favicon/apple-touch/manifest to these.
- **Tessera sul telefono**: PWA (manifest now served by /api/manifest.webmanifest, public/sw.js network-first + offline fallback). InstallCard on /atleta (native prompt on Android, instructions dialog on iOS). Logout clears "lv-cache".
- **15 spazi commercianti**: seed adds placeholders "Spazio partner 07..15" (partnerNN@leinivolley.it / Negozio2026!, published=false, hidden from public /merchants). Admin tab Commercianti: edit any merchant (logo, data, discount, account email, new password, visible toggle) via GET/POST /admin/merchants, PUT /admin/merchants/{id}. Merchants then log in and edit their own data.
- **Report mensile**: .emergent/crons.yml "0 8 1 * *" Europe/Rome → POST /api/cron/monthly-report (Bearer WEBHOOK_CRON_SECRET, idempotent by run_id in cron_runs, background). Emails each merchant with transactions in previous month (to merchant login email + association email as CC recipient) via Emergent managed Resend (lib/email.py). @example.* addresses skipped. Admin tab "Report mensili": GET /admin/reports/monthly?month=YYYY-MM, POST /admin/reports/monthly/send?month= (force resend), GET /admin/reports/logs.
- Association email is blank until the admin sets the real one.

## v3 additions
- **Invito commercianti**: admin "Invia invito" (POST /admin/merchants/{id}/invite) emails the merchant login email a 7-day set-password link `{origin}/imposta-password?token=…` (password_tokens, sha256-hashed, single use). Public: GET /auth/password-token/{token}, POST /auth/set-password (logs in). Demo @example.* emails rejected (400). Admin can add unlimited merchants; password optional on create.
- **Promozione del mese**: MerchantUpdate promo_title/promo_description/promo_start/promo_end (YYYY-MM-DD); Merchant.promo_active computed server-side (Europe/Rome today). Shown highlighted on athlete tessera + merchant cards. end<start → 422.
- **Avviso nuovi partner**: first time a merchant is visible (self-registration, admin create/publish) → background email to athletes with notify_new_partners != false (toggle in athlete profile); idempotent via merchants.announced_at. Pre-existing partners marked announced in seed.
- **Object storage (Emergent)**: lib/storage.py. Clients still send data-URL images; backend uploads them (athlete photo private, logos public) and stores `/api/files/{id}` refs (files collection, soft delete on replace). GET /api/files/{id}: logos public; athlete photos only owner/merchant/admin (cookie auth). migrate_images.py moves legacy data URLs.

## v4 additions
- **Galleria partner**: MerchantUpdate.gallery (max 6 images, data URLs → /api/files refs, public; removed ones soft-deleted). Shown as thumbnails + lightbox on merchant cards.
- **Classifica sponsor** (admin only): GET /admin/rankings?season=YYYY (season = 1 Sep YYYY → 31 Aug YYYY+1, Europe/Rome; default current; future → 400). Admin tab "Classifica sponsor" with podium + table, ordered by discount granted.
- **Riepilogo promozioni**: cron "0 9 1 * *" Europe/Rome → POST /api/cron/promo-digest (Bearer secret, idempotent). Sends active promos to athletes with notify_new_partners != false (non-demo) only if ≥1 active promo. Manual: POST /admin/promo-digest/send (button in Report tab).
- **Foto familiari**: FamilyMemberIn.photo (private file: owner/merchant/admin). PUT /athletes/me/family/{id} edits name/relation/photo. by-code lookup returns family photo for the till.

## v5 additions
- **Mappa convenzioni** (OpenStreetMap + Leaflet/react-leaflet, no key): MerchantUpdate.lat/lng. lib/geocode.py uses Nominatim (User-Agent, ≤1 req/s, cached in `geocodes`); resolve_coords on every merchant save keeps manual pins, re-geocodes when address changes and pin didn't. GET /geocode?address=&city= (merchant/admin). Athlete /atleta/convenzioni tab "Mappa": pins with discount, popups, "Vicino a me" (browser geolocation) sorts list by distance. Merchant/admin profile has LocationPicker (drag/click pin, "Trova dall'indirizzo").
- **Valutazioni**: POST /transactions/{id}/rating {stars 1-5} by the owning athlete within 30 days (can change). Merchant.rating_avg / rating_count recomputed; average shown on merchant cards/map; merchant Storico shows per-sale stars + average. No comments.

## v6
- **Cambia password** (all roles: athlete, merchant, admin): header button "Password" → dialog. POST /auth/change-password {current_password, new_password ≥6}; wrong current → 400, same as current → 400, anonymous → 401; invalidates pending invite links.
- Demo login buttons read from frontend/.env VITE_DEMO_LOGINS and render only in dev (import.meta.env.DEV).

## v7
- **Password dimenticata**: /login "Password dimenticata?" → POST /auth/forgot-password {email} always 200 (no enumeration); if account exists & non-demo, background email with 60-min single-use link to /imposta-password (throttled: 1 link per 2 min). Older unused links revoked.
- **Direttivo**: admin tab "Direttivo": GET/POST /admin/admins (add by email → admin user + 7-day set-password invite), POST /admin/admins/{id}/invite, DELETE /admin/admins/{id} (not self, not last admin). All admins have full panel rights.

## Hosting esterno (Render)
- frontend/package.json `start` = `vite preview` on $PORT (vite.config preview block), proxying /api to BACKEND_URL (bare host:port accepted) → same-origin cookies. engines node >=22.12.
- render.yaml blueprint: noi-leyni-api (python, uvicorn on $PORT, health /api/) + noi-leyni-web (node, build `yarn build`, start `yarn start`, BACKEND_URL from api hostport).
- emergentintegrations removed from requirements.txt (unused; only on Emergent's private index). lib/email.py tolerates a missing key.
- Not portable: .emergent/crons.yml (needs Render Cron Job), Emergent email/storage keys.

## Fuori da Emergent (automatico se configurato)
- **Foto/loghi su cartella server**: env UPLOAD_DIR → lib/storage.py writes/reads files under that folder (path-traversal guarded); otherwise Emergent object storage. render.yaml mounts a disk at /var/data (UPLOAD_DIR=/var/data/uploads).
- **Email Gmail**: env GMAIL_USER + GMAIL_APP_PASSWORD → lib/email.py sends via smtp.gmail.com:587 STARTTLS (html + plain text, Reply-To); otherwise Emergent managed email.
- **Tessera offline**: queryClient networkMode offlineFirst; sw.js caches /api/auth/me, association, family, merchants, transactions/mine and posts {type:"lv-net", online} to pages. lib/offline.ts useOnline (navigator.onLine && SW) + useLastSync (localStorage "lv-card-updated", cleared at logout). AthleteCard shows badge (athlete-card-sync-badge) and family QR list (athlete-card-family-qr-*) opening the shared QR dialog. Offline only works on a production build (dev server adds ?t= to modules).
- **Testi home modificabili**: Association has hero_image + home_badge/home_title/home_subtitle/step{1,2,3}_{title,text}/partners_title/partners_subtitle (defaults = original texts). Admin → Associazione fieldset "Testi e immagini della home page"; Landing reads them.

## Notizie, galleria eventi, limiti immagini, test email
- routers/board_content.py + models/board_content.py. Soft delete (is_deleted) for news and event photos.
- **Notizie del club**: GET /api/news (athlete+admin only; merchant 403), POST /api/admin/news, DELETE /api/admin/news/{id}. AthleteCard shows latest 5 (athlete-news). Admin tab "Notizie e foto" (admin-tab-bacheca).
- **Galleria eventi home**: GET /api/event-photos (public, latest 12), GET/POST /api/admin/event-photos, DELETE /api/admin/event-photos/{id}. Landing strip (landing-event-strip). Board uploads resized to 1600px.
- **Limiti peso immagini**: env IMAGE_MAX_MB_MEMBERS (default 1) and IMAGE_MAX_MB_BOARD (default 5); save_image(board=True) for admin uploads (association, hero, event photos, admin-edited merchants). GET /api/upload-limits; ImageUpload/GalleryUpload reject heavier originals client-side and show "Max N MB".
- **Email**: GET /api/admin/email/status (gmail|emergent), POST /api/admin/email/test {to}. EmailTestCard at top of Report mensili tab.
- Gmail failures (bad app password / disconnect) fall back to Emergent email for normal sends; the admin test button uses gmail_only=True so it reports the real Gmail outcome. GMAIL_USER + GMAIL_APP_PASSWORD are set in preview but the saved app password is rejected by Google (needs a 16-letter app password).

## Categoria libera, ruolo, ritaglio foto
- AthleteUpdate/Register: category_id ("" allowed) + category_custom (typed, max 60) + team_role (optional, max 60). lib/categories.resolve_category → club category (id+name) or typed name (id None); neither → 400. Athlete exposes team_role; shown on card badge and at the till.
- AthleteFields uses a native <select> (athlete-category-select, last option "__other" → athlete-category-custom-input) + role input with datalist (athlete-role-input). Base UI Select overlay was covering the form/scroll on phones.
- ImageUpload round=true (athlete + family photos) opens PhotoCropDialog: drag + zoom (1–4x) in a round guide, saves 480×480 JPEG.

## Gestione atleti (direttivo)
- Athlete.is_active (default true). PATCH /api/admin/athletes/{id}/status {active} sets athletes.is_active + users.is_active (soft, reversible). Inactive: login 403, existing sessions 401, by-code + transactions 404 "Tessera disattivata" (family cards too). Merchants never see inactive athletes.
- GET /api/athletes filters: q, category (name, case-insensitive exact — covers typed ones), role (exact or "__none"), status active|inactive|all (admin only). Admin rows include email. AthletesTab (components/AthletesAdmin.tsx) with filters + CSV export (atleti-leini-volley.csv) + Disattiva/Riattiva.
- GET /api/admin/categories/proposed → typed categories grouped (active athletes, category_id None). POST /api/admin/categories/adopt {name} → creates/reuses official category and moves matching athletes. UI: ProposedCategories at top of Categorie tab.
- Test athletes Smoke*/Marta Prova are deactivated.

## Unisci duplicati, email ai filtrati, guardia /api
- POST /api/admin/athletes/merge {keep_id, merge_id}: moves transactions (athlete_id/athlete_name, merged_from) and family_members to keep; duplicate gets is_active False + merged_into; its user deactivated; kept account reactivated if needed. 400 same id, 409 already merged. UI: "Unisci" per row → MergeDialog (components/AthleteDialogs.tsx).
- POST /api/admin/athletes/email {q, category, role, status, subject, message}: same filter as the list (members._athlete_filter), one email per athlete in background, demo (@example.*) skipped → {recipients, skipped}. UI: "Scrivi ai filtrati".
- lib/api.ts throws ApiError 502 with a clear message when a 2xx response is not JSON (host answered /api with index.html: missing proxy/rewrite). render.yaml documents: frontend must be a web service (`yarn start` proxy) or a Static Site with an /api/* rewrite placed before /* → /index.html.

## Deploy Render (single service, recommended)
- /Dockerfile: node 22 builds frontend/dist → python 3.11 image; FRONTEND_DIST=/app/frontend/dist; uvicorn on $PORT with proxy headers. .dockerignore excludes .env, node_modules, dist.
- backend/lib/spa.py mount_spa(app) (called in server.py after app.include_router): when FRONTEND_DIST has index.html, GET /{path} serves files (assets/ immutable cache, others no-cache) or index.html; /api and /api/* are never answered with the SPA (JSON 404).
- render.yaml = one Docker web service "noi-leyni" with disk + env vars. The old two-service/`yarn start` proxy path still works but is no longer the blueprint.

## UI mobile / PWA (partner cards, immagini, safe area)
- MerchantList: each card is a button (merchant-card-{id}) with chevron + "Vedi sconto e dettagli" → MerchantDetail dialog (merchant-detail-dialog: logo, discount block, promo, description, gallery, map/phone links). Hints: athlete-merchants-hint (AthleteCard), convenzioni-hint.
- Logos always object-contain on white (Logo component, Crest, ImageUpload without crop). ImageUpload crop prop: "round" (default for round photos, 480²), "square" (hero 1200²), "landscape" 4:3 (event photos 1600×1200) via PhotoCropDialog(aspect, round, outWidth).
- index.html viewport-fit=cover + format-detection; .pt-safe/.px-safe utilities (header, landing header, bottom nav); body overflow-x clip, no tap highlight, overscroll none; native selects text-base on phones (no iOS zoom). Manifest: id, display_override, shortcuts, theme #1e3a8a.

## Preferiti e vicino a me
- athletes.favorite_merchant_ids. GET /api/athletes/me/favorites, PUT/DELETE /api/athletes/me/favorites/{merchant_id} (athlete only; 404 unknown merchant; idempotent). Cached by SW.
- MerchantList: star button per card (merchant-fav-{id}, optimistic), favourites always first (also in the limited list on the card page and landing for athletes); "Vicino a me" (merchant-near-me-button) uses browser geolocation + haversine on merchant lat/lng, shows merchant-distance-{id}; merchants without coordinates go last.

## Verifica email, doppioni, percorso, avvisi promo preferiti, niente demo
- Self-registration (athlete + merchant) creates users.email_verified=False, no session; returns RegisterResult {pending_verification, email}; background send_verification (notify.py) → link /verifica-email?token= (48h, db.email_tokens hashed, throttle 2 min). Login 403 "Conferma prima la tua email…"; current_user rejects unverified. POST /api/auth/verify-email {token} → verified + session (+ announce merchant). POST /api/auth/resend-verification {email} generic ok. set-password (invites/reset) marks verified. Users without the flag (older/admin-created) are treated as verified.
- Login page: no demo buttons (VITE_DEMO_LOGINS no longer read); pending banner verify-email-pending + resend. Page VerifyEmail.tsx.
- seed.py: only indexes, association, default categories, first admin from env.
- GET /api/admin/athletes/duplicates → groups by name (accents/order ignored) or email (case, dots for gmail, +tag). DuplicatesPanel on Athletes tab with one-tap merge (MergeDialog suggestKeepId; keeps oldest active).
- MerchantDetail "Portami qui": Google Maps directions walking/driving (merchant-directions-walking|driving).
- Favourites: "Preferiti (N)" chip filter (sector-filter-preferiti). alert_favorite_promo(merchant) emails athletes who starred the partner (active, opted in, non-demo) once per promo key (title|start|end) when live; triggered on merchant/admin save + daily cron /api/cron/favorite-promos 09:30.

## Database
- Preview MONGO_URL now points to MongoDB Atlas (cluster0.y8uydwi), db "app". Data copied from the old in-pod mongod with backend/copy_db.py (non-destructive upsert by _id; source SOURCE_MONGO_URL default mongodb://localhost:27017, target ATLAS_MONGO_URL, TARGET_DB_NAME default DB_NAME). JSON backup of the old DB in /app/backups/ (gitignored).

## Supervisore, permessi Direttivo, doppia verifica
- users.is_superadmin (role admin). lib/auth: AREAS (athletes, merchants, reports, content, board), users.permissions (None = all), area_for_path() maps admin API prefixes → area inside require_role (unmapped admin paths need all areas: fail-closed); require_super. build_me returns user.is_superadmin + areas.
- routers/supervisor.py (/api/admin/supervisor): GET accounts?role=admin|merchant|athlete, PUT accounts/{id}/permissions {areas}, PATCH accounts/{id}/status {active}; supervisor cannot be blocked/removed (also DELETE /admin/admins/{id} → 403 on supervisor); audit in db.audit_log.
- Admin.tsx: tabs filtered by areas (TAB_AREA), Supervisore tab (SupervisorTab.tsx) first for the supervisor.
- 2FA by email for every role: login → db.login_codes (hashed 6-digit code, 10 min, 5 attempts) + send_login_code; POST /api/auth/login/verify {challenge_id, code, trust_device} → session + lv_trust cookie (30 days, skips the code); POST /api/auth/login/resend (45 s throttle). Demo addresses cannot log in. Login.tsx shows login-otp-form.
- Supervisor account gi.mannone@gmail.com (was a merchant login for shop "Mirò": the shop was detached, merchants.user_id=None, detached_from kept).
