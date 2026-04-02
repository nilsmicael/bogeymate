# BogeyMate — Installationsguide
*Din trogna kompis i misären*

Följ dessa steg i ordning. Det tar ungefär 20–30 minuter totalt.
Du behöver ingen teknisk bakgrund — varje steg har bilder och exakt vad du ska klicka på.

---

## STEG 1 — Skapa ett Supabase-konto (gratis)

1. Gå till **https://supabase.com**
2. Klicka på **"Start your project"**
3. Logga in med GitHub (rekommenderas) eller skapa ett konto med e-post
4. Klicka **"New project"**
5. Fyll i:
   - **Name:** `bogeymate`
   - **Database Password:** välj ett starkt lösenord (spara det någonstans säkert)
   - **Region:** `West EU (Ireland)` — närmast Sverige
6. Klicka **"Create new project"** och vänta ca 1 minut

---

## STEG 2 — Skapa databasen

1. I Supabase, klicka på **"SQL Editor"** i vänstermenyn
2. Klicka på **"New query"**
3. Öppna filen `supabase-schema.sql` från BogeyMate-mappen
4. Kopiera hela innehållet och klistra in i SQL-editorn
5. Klicka **"Run"** (eller Ctrl+Enter)
6. Du ska se meddelandet: *"Success. No rows returned"*

---

## STEG 3 — Hämta dina Supabase-nycklar

1. I Supabase, klicka på **"Project Settings"** (kugghjulet nere till vänster)
2. Klicka på **"API"**
3. Du hittar två värden — kopiera dem:
   - **Project URL** → ser ut som `https://abcdefgh.supabase.co`
   - **anon public** → en lång textsträng

4. Öppna filen `src/lib/supabase.js` i en textredigerare (t.ex. Notepad)
5. Hitta dessa två rader (runt rad 15):
   ```
   export const SUPABASE_URL = 'https://DIN-PROJEKT-ID.supabase.co'
   export const SUPABASE_ANON_KEY = 'DIN-ANON-KEY'
   ```
6. Byt ut texten innanför citattecknen med dina riktiga värden:
   ```
   export const SUPABASE_URL = 'https://abcdefgh.supabase.co'
   export const SUPABASE_ANON_KEY = 'eyJhbGciOiJ...(din nyckel)...'
   ```
7. Spara filen

---

## STEG 4 — Skapa ett GitHub-konto och ladda upp koden

GitHub är där koden lagras och Vercel hämtar den därifrån.

1. Gå till **https://github.com** och skapa ett gratis konto
2. Klicka **"New repository"** (gröna knappen)
3. Namn: `bogeymate`
4. Välj **"Public"**
5. Klicka **"Create repository"**

Nu ska du ladda upp filerna. Det enklaste sättet:

1. På GitHub-sidan för ditt nya repo, klicka **"uploading an existing file"**
2. Dra hela `bogeymate`-mappen till uppladdningsrutan
3. Scrolla ner och klicka **"Commit changes"**

---

## STEG 5 — Publicera på Vercel (gratis)

1. Gå till **https://vercel.com**
2. Klicka **"Sign Up"** och logga in med GitHub
3. Klicka **"Add New... → Project"**
4. Välj ditt `bogeymate`-repo och klicka **"Import"**
5. Inställningar (lämna allt som det är, Vercel känner igen Vite automatiskt):
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Klicka **"Deploy"**
7. Vänta ca 1 minut

När det är klart ser du en grön bock och en länk som ser ut som:
`https://bogeymate-dittnamn.vercel.app`

**Det är din app! Dela länken med dina golfkompisar.**

---

## STEG 6 — Lägg till appen på hemskärmen (PWA)

### På iPhone (Safari):
1. Öppna din Vercel-länk i Safari
2. Tryck på dela-ikonen (rutan med pilen upp)
3. Välj **"Lägg till på hemskärmen"**
4. Tryck **"Lägg till"**

### På Android (Chrome):
1. Öppna din Vercel-länk i Chrome
2. Tryck på de tre prickarna uppe till höger
3. Välj **"Lägg till på startskärmen"**
4. Tryck **"Lägg till"**

Nu finns BogeyMate som en ikon på hemskärmen, precis som en vanlig app!

---

## Bjuda in vänner

Dela din Vercel-länk med dina golfkompisar. De skapar egna konton
och dyker sedan upp i appen när de startar eller deltar i rundor.

---

## Vanliga frågor

**Kostar det något?**
Nej. Supabase och Vercel är gratis för privat bruk i den här storleken.
Du och dina vänner kan spela hundratals rundor utan att det kostar en krona.

**Fungerar den utan internet på banan?**
Slag sparas lokalt om du är offline och laddas upp automatiskt
när du får uppkoppling igen. En indikator visas i appen.

**Kan vem som helst se mina rundor?**
Som standard ja, men du kan stänga av det under Inställningar → Sekretess.

**Vad händer om något går fel?**
Kontakta mig (Micael) så tittar vi på det tillsammans.

---

*BogeyMate v1.0 — Byggt med Supabase, Vite och Claude*
