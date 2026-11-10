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
