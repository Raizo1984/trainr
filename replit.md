# Trainr op Replit

Trainr bestaat uit twee delen:

- een React-app (TypeScript, Vite) die alle gebruikersdata in `localStorage`
  van de browser bewaart;
- een kleine Node-backend in `server/` die de OpenAI-sleutel vasthoudt en
  `/api/coach` aanbiedt.

De backend is niet optioneel als je de gesprekscoach wilt gebruiken. Zonder
backend werkt de rest van de app gewoon, maar geeft `/api/coach` niets terug.

## Draaien

**Productie, één proces, dit hoort onder de Run-knop:**

```bash
npm run build && npm start
```

De server serveert dan de gebouwde app én de coach-API op één poort. Op Replit
luistert hij op 5000, want dat is de poort die `.replit` naar buiten wijst.

**Ontwikkeling, met hot reload:**

```bash
npm run dev:all
```

Dat start de frontend op 5000 en de backend op 3001; Vite stuurt `/api` door
naar de backend. Alleen `npm run dev` start de frontend zonder backend, en dan
lijkt de coach kapot terwijl hij simpelweg niet draait.

## Secrets

| Sleutel | Nodig | Waarvoor |
|---|---|---|
| `OPENAI_API_KEY` | voor de coach | Zonder deze sleutel werkt alles behalve de gesprekscoach |
| `OPENAI_MODEL` | optioneel | Welk model de coach gebruikt. Standaard `gpt-4o`. Zie `/api/coach/models` voor wat jouw sleutel mag gebruiken |
| `PORT` | optioneel | Standaard 5000 op Replit |

De sleutel hoort uitsluitend in de Secrets, nooit in de code of in de browser.
Alles wat de browser kent kan iedere bezoeker met de ontwikkelaarsconsole
uitlezen.

## Controles

```bash
npm test          # 162 tests op de beslisregels
npm run build     # typecontrole van app en server, daarna de bundel
npm run e2e:coach # controleert wat er naar OpenAI gaat, zonder sleutel
```

De browsertests (`npm run e2e`, `npm run e2e:mobile`) vragen een draaiende
server; zie `README.md`.

## Let op bij automatische wijzigingen

`vite.config.ts` had op een gegeven moment twee `server`-blokken, doordat er een
tweede naast het bestaande werd gezet in plaats van erin. In JavaScript wint dan
het laatste blok en verdwijnt de rest zonder foutmelding. `npm run build` vangt
dit af. Draai die opdracht voordat je iets pusht.
