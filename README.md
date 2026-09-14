# Trainr

Een evidence-based coachingapplicatie die het coachingproces uitvoert, niet alleen
reps opschrijft. Gebouwd volgens `AI_AGENT_INSTRUCTION_FitnessCoachApp.md`: intake,
risicostratificatie, fasering, The Rule, veiligheidsprotocollen, voeding, metingen
en proactieve coaching.

## Snel starten

```bash
npm install
npm run dev         # frontend, poort 5173
npm run dev:server  # backend voor de coach, poort 3001
npm test            # 155 tests op de beslisregels
npm run build       # typecheck (app en server) + productiebundel
npm start           # serveert de gebouwde app plus de coach-API
```

Zonder `OPENAI_API_KEY` werkt alles behalve de gesprekscoach. De adaptieve
planner heeft geen internet nodig.

Doorloop in een echte browser, tegen een draaiende `npm run preview`:

```bash
npm run build && npm run preview &
npm run e2e          # intake, rode vlaggen, sessie loggen, navigatie
npm run e2e:mobile   # elk scherm op 390 pixels: overflow en raakvlakken
npm run e2e:coach    # controleert wat er werkelijk naar OpenAI gaat, zonder sleutel
```

`e2e:coach` start een nepserver die zich voordoet als OpenAI en controleert het
verzoek dat de backend verstuurt. Typecontrole ziet niet of een veldnaam klopt
met wat de API verwacht; deze controle wel, en hij kost geen tokens.

Bij de eerste start kun je de intake doorlopen of op **demodata laden** klikken:
veertien weken fase 1 van een gebruiker met knieklachten en een verhoogd
voedingsrisico, inclusief een pijnpiek, een plateau en een slechte week, zodat de
signalering zichtbaar wordt.

## Wat er is gebouwd

| Laag | Bestand | Wat het doet |
|---|---|---|
| Datamodel | `src/domain/types.ts` | Profiel, trainingslog, metingen, veiligheidsvlaggen (secties 2.1, 4.1, 6.2, 9) |
| The Rule | `src/domain/rule.ts` | De universele progressieregel (secties 3.1, 4.2) |
| Risico | `src/domain/risk.ts` | Risicostratificatie, veiligheidsinstellingen, doorverwijzingen (sectie 2.2) |
| Programma | `src/domain/program.ts` | Sessiegeneratie per fase, deloadautomatisering (secties 3.3, 3.4) |
| Voorschrift | `src/domain/prescribe.ts` | Van historie naar het voorschrift van vandaag |
| Signalering | `src/domain/triggers.ts` | Pijn, techniek, plateau, opkomst, volume, gewrichtsplafond, RIR (secties 4.3, 9.2) |
| Voeding | `src/domain/nutrition.ts` | Risicogebonden voedingsmodel en beschermingslagen (secties 5, 9.3) |
| Blokken | `src/domain/blocks.ts` | Blokperiodisering fase 4, specialisatiecycli fase 5, onderhoud fase 6 (sectie 3.2) |
| Skills | `src/domain/skills.ts` | Droomdoelen als route met toelatingseisen (secties 2.1, 3.2) |
| Gates | `src/domain/gates.ts` | Criteria-gedreven faseovergang (secties 3.3, 6.4) |
| Blokevaluatie | `src/domain/blockReview.ts` | Beslisboom in de deloadweek (sectie 6.3) |
| Bewegingskwaliteit | `src/domain/movement.ts` | Nulmeting van de bewegingspatronen (secties 6.1, 7.2) |
| Adaptieve planner | `src/domain/adapt.ts` | Past het plan daadwerkelijk aan, met een veiligheidspoort die geen enkele bron passeert |
| Coachcontext | `src/domain/coachContext.ts` | De samenvatting die de taalmodel-laag te zien krijgt |
| Backend | `server/` | Houdt de API-sleutel vast en praat met Claude |
| Coaching | `src/domain/coaching.ts` | Wekelijkse check-in en maandrapport (secties 6.2, 7.1) |

De domeinlaag is puur en kent geen React, storage of netwerk. Dat is bewust: de
progressie- en veiligheidsregels zijn het product, en ze moeten los testbaar zijn.

## De vier beslisregels die het gedrag bepalen

**1. The Rule** (`rule.ts`). Eén regel voor alle gebruikers, oefeningen en fasen.
De volgorde van beslissen zet veiligheid boven progressie:

```
deloadweek → pijn → techniekverlies → RIR te laag → bovenkant bereikt → reps erbij
```

Nooit twee variabelen tegelijk. Elke verlaging die uit een veiligheidsregel volgt,
wordt naar beneden afgerond: bij twijfel liever iets te licht.

**2. Risicostratificatie** (`risk.ts`). De intake bepaalt de startdosis, het
deloadinterval, de pijngrens, de progressiestap en het voedingsmodel. Een extreme
voedingshistorie of een neurologisch symptoom verandert niet de toon van een
advies, maar de instellingen waarmee het programma draait.

**3. Gates** (`gates.ts`). Faseovergangen zijn criteria-gedreven, nooit
kalender-gedreven. Pijn wordt beoordeeld op pieken en op het aandeel sessies boven
de grens, niet op een gemiddelde: vier sessies met 0 en vier met 6 komen gemiddeld
op 3 uit, terwijl dat precies het patroon is dat je niet wilt doorlaten.

**4. Eén ding tegelijk zwaar** (`blocks.ts`). Vanaf fase 4 krijgt één
bewegingspatroon zes weken de ruimte, de rest draait op onderhoud. Onderhoud is
niet nul: wegvallen kost meer dan het oplevert. Fase 5 werkt met cycli van acht
weken op massa, kracht of skill; fase 6 piekt eerst op de droomdoelen en gaat
daarna naar drie sessies per week die je jaren volhoudt.

**5. Beschermend voedingsmodel** (`nutrition.ts`). Bij een verhoogd risico
verdwijnen calorieën, eetvensters en gewichtsdoelen uit de interface. Ze worden
niet ontraden, ze zijn er niet. Dat verschil zit in het plan-object en niet in
losse UI-checks, zodat het niet per ongeluk te omzeilen is.

## Veiligheid

- Rode vlaggen uit sectie 9.1 pauzeren het hele programma. Opheffen kan alleen via
  Instellingen, na het vastleggen van wie je beoordeeld heeft en wat de conclusie was.
- Volumesprongen boven de ingestelde grens, overschreden volumeplafonds per
  gewricht en trainen tot falen leiden tot een melding met een concrete handeling.
- Deloads zijn automatisch en niet overslaanbaar.
- Elk advies draagt een bronvermelding naar de sectie waaruit de regel komt.

## De AI-coach

Twee lagen, en de volgorde is niet vrijblijvend.

**Laag 1, de adaptieve planner** (`adapt.ts`) is deterministisch. Hij leidt uit
je logs, gewicht en voeding af welke aanpassing het programma nodig heeft, en
past die na akkoord echt toe: sets erbij of eraf, een trede terug, een oefening
pauzeren, een deload naar voren halen. Werkt offline en kost niets.

**Laag 2, de gesprekscoach** draait op OpenAI via de backend in `server/`. Hij
leest een samenvatting van je data en kan aanpassingen voorstellen.

De provider zit uitsluitend in `server/`. De planner, de veiligheidspoort en de
contextopbouw staan in `src/domain` en weten niets van OpenAI: van provider
wisselen is een wijziging in één map, niet in de app.

Wat de twee lagen scheidt is de veiligheidspoort. Elk voorstel, of het nu van de
regelmotor of van het taalmodel komt, gaat langs `validateAdjustment`. Daarvoor
zit nog een controle op de server: een taalmodel levert JSON als tekst, en die
tekst hoeft nergens aan te voldoen. Een verzonnen soort aanpassing of een
voorstel zonder onderbouwing strandt daar en bereikt de client niet.

De poort laat onder meer niet door:

- zwaarder maken bij pijn op of boven je persoonlijke grens
- zwaarder maken terwijl de techniek nog niet staat
- welke wijziging dan ook tijdens een medische pauze
- volume erbij vlak voor een verplichte deload
- meer dan één variabele tegelijk
- een trede omhoog voordat de bovenkant van het repbereik gehaald is

Een voorstel dat te ver gaat wordt teruggeknipt in plaats van geweigerd: drie
sets erbij worden er één, en de gebruiker ziet waarom. En een voorstel verandert
niets tot je het accepteert. Een coach die ongevraagd je plan herschrijft is geen
coach maar een verrassing.

De opbouwgrens begrenst de **snelheid**, niet de stap. Eén set is de kleinste
stap die bestaat; bij een streng risicoprofiel is die stap al meer dan de
weekgrens toestaat. Zonder die nuance zou juist de gebruiker die de meeste
bescherming nodig heeft als enige nooit meer vooruit kunnen.

### Sleutel, model en kosten

De sleutel staat uitsluitend op de server, in de Replit Secrets onder
`OPENAI_API_KEY`. Hij komt nooit in de browser: alles wat de browser kent kan
iedere bezoeker met de ontwikkelaarsconsole uitlezen.

Het model staat in `OPENAI_MODEL` en niet in de code. Modelnamen bij OpenAI
veranderen regelmatig en welke beschikbaar zijn hangt af van het account; een
naam hardcoderen levert vroeg of laat een 404 op die niemand verwacht. Zonder
instelling gebruikt de server `gpt-4o`. Welke namen jouw sleutel mag gebruiken
zie je op `/api/coach/models`; een onbekend model geeft een foutmelding die
precies dat zegt.

Wat een gesprek kost hangt af van het gekozen model. Kijk op de prijslijst van
OpenAI voor het model dat je instelt; een gesprek stuurt ongeveer twee- tot
vierduizend tokens aan context mee.

De coach krijgt een samenvatting, geen dump: geen naam, geen geboortejaar, geen
vrije notities uit de intake. Sectie 8.2 schrijft voor dat er niet meer wordt
verzameld dan de coaching nodig heeft, en elke overbodige regel kost tokens
zonder het advies beter te maken.

## Mobiel

De app is op telefoonformaat gebouwd en daar ook gecontroleerd: geen enkel scherm
heeft horizontale overflow op 390 pixels, raakvlakken zijn minimaal 40 pixels, en
de onderrand houdt rekening met `safe-area-inset`. Op een telefoon verhuist de
navigatie naar een balk onderin, staan thema en instellingen in een vaste kopbalk,
en plakt de knoppenbalk van de intake onderaan het scherm in plaats van onder een
lange pagina. `npm run e2e:mobile` loopt die controle na en meldt afwijkingen.

## Techniek

React 19, TypeScript, Vite, Tailwind v4, Zustand, Recharts en Motion. Data blijft
lokaal in `localStorage` en is exporteerbaar en verwijderbaar (sectie 8.2). De app
draait volledig client-side; er is geen backend nodig om hem te beoordelen.

Grafiekkleuren komen uit een palet dat op kleurenblindheidsscheiding en contrast is
gevalideerd in beide thema's. Statuskleuren (groen, amber, rood) zijn gereserveerd
voor toestand en worden nooit als seriekleur gebruikt.

## Droomdoelen zijn geen decoratie

Elk droomdoel uit de intake hangt aan een progressielader met toelatingseisen. Een
muscle-up opent pas na acht schone pull-ups en acht schone dips; tot die tijd staat
er wat er nog ontbreekt, niet alleen dat het op slot zit. Wat opengaat wordt in de
bestaande sessies opgenomen, maximaal twee tegelijk, want skillwerk telt gewoon mee
in het volume van schouder en elleboog.

## Wat er nog niet in zit

Bewust buiten scope gehouden, omdat het externe diensten of een backend vereist:
videoanalyse van techniek (sectie 7.2), wearable- en voedingsapp-koppelingen
(sectie 8.1), fotoanalyse, en pushnotificaties. De coachingmomenten uit sectie 7.1
zijn wel geïmplementeerd, maar bereiken de gebruiker in de app in plaats van via
push of SMS.

Sectie 7.2 beschrijft een AI die video analyseert op gewrichtsposities en tempo.
Die zit er niet in, en de app doet ook niet alsof. Wat er wel in zit is het
bruikbare deel: zes bewegingspatronen met de checklist die een coach ook zou
nalopen, dezelfde groen-geel-rood uitkomst en een concrete correctie per punt.
Het resultaat vult het gate-criterium bewegingsruimte, dat daarvoor een vinkje
was.
