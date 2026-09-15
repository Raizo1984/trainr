# Trainr

Een evidence-based coachingapplicatie die het coachingproces uitvoert, niet alleen
reps opschrijft. Gebouwd volgens `AI_AGENT_INSTRUCTION_FitnessCoachApp.md`: intake,
risicostratificatie, fasering, The Rule, veiligheidsprotocollen, voeding, metingen
en proactieve coaching.

## Snel starten

```bash
npm install
npm run dev:all   # frontend op 5000 plus backend op 3001, met hot reload
npm test          # 162 tests op de beslisregels
npm run build     # typecontrole van app en server, daarna de bundel
npm start         # serveert de gebouwde app plus de coach-API op een poort
```

Alleen `npm run dev` start de frontend zonder backend. De app werkt dan, maar de
coach lijkt kapot terwijl hij simpelweg niet draait. Draaien op Replit staat in
`replit.md`.

Zonder `OPENAI_API_KEY` werkt alles behalve de gesprekscoach. De adaptieve
planner heeft geen internet nodig.

Doorloop in een echte browser, tegen een draaiende `npm run preview`:

```bash
npm run build && npm run preview &
npm run e2e          # intake, rode vlaggen, sessie loggen, navigatie
npm run e2e:mobile   # elk scherm op 390 pixels: overflow en raakvlakken
npm run e2e:coach    # controleert wat er werkelijk naar OpenAI gaat, zonder sleutel
npm run size         # bewaakt wat het eerste scherm over de lijn haalt
npm run e2e:offline  # start de app opnieuw met het netwerk uit
npm run e2e:speech   # spreekt een set in via een nepherkenner
npm run e2e:complaint # meldt een klacht en controleert het voorstel
npm run e2e:report   # weekrapport, inclusief een verzonnen getal
npm run e2e:wger     # het ophaalscript tegen een nep-wger
npm run e2e:getalveld # getalvelden op een telefoonscherm
```

De accounttests vragen een lege database:

```bash
DATABASE_URL=postgres://... npm run e2e:accounts       # de laag eronder
DATABASE_URL=postgres://... npm run e2e:account-http   # de eindpunten
DATABASE_URL=postgres://... npm run e2e:account-ui     # twee toestellen in de browser
DATABASE_URL=postgres://... npm run e2e:offline-sync   # trainen zonder bereik, later synchroniseren
DATABASE_URL=postgres://... npm run e2e:herstel        # wachtwoord vergeten, van knop tot inloggen
DATABASE_URL=postgres://... npm run e2e:welkom         # wie het startscherm ziet, en wie nooit
```

De tests met een eigen server (`e2e:coach`, `e2e:complaint`, `e2e:report`)
starten elk hun eigen backend. Draai ze los van elkaar, anders botsen ze op
dezelfde poort.

`e2e:coach` start een nepserver die zich voordoet als OpenAI en controleert het
verzoek dat de backend verstuurt. Typecontrole ziet niet of een veldnaam klopt
met wat de API verwacht; deze controle wel, en hij kost geen tokens.

## Controles draaien automatisch

`.github/workflows/controles.yml` draait bij elke push en elke pull request.
Twee taken, bewust gescheiden.

De snelle taak doet de typecontrole van app en server, de unit tests, de build
en het budget. Die geeft binnen een minuut antwoord en dekt het meeste af.

De browsertaak draait daarna, en alleen als de snelle groen is: de doorloop,
offline, de lopende sessie, inspreken, de mobiele audit, de coach, klacht
melden, het weekrapport, het wger-script en de vier accounttests tegen een
echte PostgreSQL uit een service-container. Bij een fout worden de
schermafdrukken en het serverlogboek bewaard, want een rode test zonder beeld
kost een halve dag raden.

Een rood kruisje binnen een minuut is meer waard dan een compleet antwoord na
tien, vandaar die volgorde.

## Aan de deur

Een nieuwe gebruiker krijgt eerst een keuze: een account maken, inloggen, of
verder zonder account. Geen harde muur, want een registratiescherm voordat
iemand iets van de app heeft gezien is de grootste afhaakplek die er is, en
deze app begint al met een intake van acht stappen.

De uitweg staat er dus, maar klein en met de gevolgen erbij: zonder account
staat alles alleen op dat toestel, en dan is het weg zodra de telefoon weg is.
Na de intake komt de vraag nog één keer, op het moment dat iemand net moeite
heeft gedaan. Daarna niet meer, want dan leert iemand hem wegklikken zonder te
lezen.

Drie regels bepalen wie dit scherm ziet, en twee daarvan zijn er om te
voorkomen dat bestaande gebruikers voor een dichte deur staan:

- Wie op dit toestel al een account had, of al gegevens heeft staan, ziet het
  nooit. Een update mag niemand buitensluiten.
- Zonder verbinding weten we niets van accounts, en dan gaat de app gewoon
  open. Een inlogscherm in een sportschool zonder bereik is een app die niet
  werkt.
- Alleen wie helemaal nieuw is, krijgt de keuze.

`npm run e2e:welkom` controleert precies die drie gevallen.

## Accounts en synchronisatie

De app werkt zonder account. Je gegevens blijven dan op dit toestel en er komt
niets bij ons terecht. Met een account staat er ook een kopie op de server,
zodat je op je telefoon en je laptop hetzelfde ziet.

Zonder `DATABASE_URL` start de app gewoon, maar zonder accounts. Een
ontbrekende database mag geen kapotte app opleveren.

**Wachtwoorden** gaan door scrypt uit `node:crypto`, met de parameters in de
hash zelf zodat ze later te verhogen zijn zonder bestaande wachtwoorden
ongeldig te maken. Geen extra pakket: bcrypt of argon2 zouden hier niets
toevoegen behalve een compileerstap die op de ene hoster wel werkt en op de
andere niet.

**Sessies** zijn willekeurige tokens in een HttpOnly-cookie, geen JWT. Alleen
de hash gaat de database in, dus wie de database leest kan daarmee niet
inloggen. En een token in de database kun je intrekken; een ondertekend broodje
dat zichzelf geldig verklaart niet.

**Inloggen** kost bij een onbekend adres net zoveel tijd als bij een bestaand,
want er wordt altijd een hash berekend. Anders is aan de snelheid te merken wie
er een account heeft, en bij een app met gezondheidsgegevens is dat op zichzelf
al gevoelige informatie. Na tien mislukte pogingen binnen een kwartier gaat de
deur dicht, geteld in de database en niet in het geheugen, want een publicatie
die meeschaalt draait meerdere kopieën.

**Verzoeken van een andere website** worden geweigerd: alles wat iets wijzigt
draagt een eigen kopregel, en die kan een formulier op een vreemde site niet
meesturen.

**Synchroniseren** houdt de lokale opslag leidend, zodat offline blijft werken.
De server krijgt een kopie zodra dat kan.

Het scenario waar dit voor gemaakt is: je staat in een sportschool zonder
bereik, logt je sets, doet de app dicht, en pas thuis gaat hij weer open. Wat je
daar invoerde moet er dan nog zijn en vanzelf naar de server gaan.

Daarvoor onthoudt de app twee dingen die een herstart overleven: met welke
serverversie dit toestel voor het laatst gelijk stond, en of er sindsdien iets
gewijzigd is dat nog niet verstuurd is. Met die twee is het verschil te zien
tussen "ik heb offline getraind en de server weet er nog niets van" en "iemand
anders heeft ondertussen ook iets gewijzigd". Het eerste is gewoon versturen.
Alleen het tweede is een echte botsing waar jij in moet kiezen.

Zonder die boekhouding lijkt elk verschil op een botsing, en krijg je na elke
offline sessie de vraag welke versie je wilt houden. Kies je dan de verkeerde,
dan is je training van die avond weg.

Opnieuw proberen gebeurt bij het terugkomen van de verbinding, bij het
terugkeren naar het tabblad, en elke minuut als vangnet voor een verbinding die
er wel is maar niets doorlaat.

## Wachtwoord vergeten

Zonder herstelweg is iemand die zijn wachtwoord kwijt is permanent
buitengesloten, en staan zijn gezondheidsgegevens onbereikbaar op de server.
Dat raakt ook het recht op inzage.

De link uit de mail werkt een uur en maar één keer. Na het instellen gaan alle
sessies eruit, ook op andere apparaten: wie zijn wachtwoord kwijt was, weet
niet of iemand anders er ondertussen bij kon.

Het antwoord op een aanvraag is letterlijk hetzelfde of het adres bestaat of
niet. Zou dat verschillen, dan kan iemand met een lijst adressen uitvinden wie
hier een account heeft, en dat lidmaatschap is bij een app met
gezondheidsgegevens op zichzelf al gevoelig. Er zit ook een grens op: drie
aanvragen per kwartier, anders laat iemand met een script honderden mails naar
een adres sturen dat hij niet bezit.

E-mail loopt via `server/mail.ts`, met drie uitgangen: Resend als
`RESEND_API_KEY` er staat, het logboek als `MAIL_LOGBOEK=aan`, en anders zegt
de app eerlijk dat herstel uitstaat. Dat laatste is het punt: een herstelmail
die nergens aankomt terwijl het scherm zegt "kijk in je inbox" laat iemand een
uur zoeken naar iets dat niet bestaat.

## Gezondheidsgegevens en de AVG

Deze app bewaart pijnklachten, blessures, lichaamsmaten en eetgedrag. Dat is
onder artikel 9 AVG een bijzondere categorie persoonsgegevens, de zwaarste
klasse die er is.

Wat daarvan in het product zit:

- Uitdrukkelijke toestemming bij het aanmaken van een account, met de versie en
  het tijdstip erbij. Zonder toestemming wordt er geen account aangemaakt.
- Een privacyverklaring die zegt wat er werkelijk gebeurt, in
  `src/features/account/privacy.ts`. Verandert die tekst inhoudelijk, verander
  dan ook `TOESTEMMING_VERSIE` in `server/accounts.ts`, zodat iedereen opnieuw
  akkoord geeft.
- Verwijderen is echt verwijderen, niet een vinkje. Account, sessies en
  gegevens gaan in één transactie weg.
- Exporteren en terugzetten van een back-up, ook zonder account.
- Sessies verlopen na dertig dagen en worden opgeruimd.

Wat hier niet in zit en wel moet gebeuren voordat anderen de app gebruiken: een
verwerkersovereenkomst met je hoster, en een jurist die de privacyverklaring
naast je werkelijke verwerking legt. Dit is code, geen juridisch advies.

## Beeld bij een oefening

Standaard tekent de app de beweging zelf. Per bewegingspatroon staan er in
`src/domain/tekeningen.ts` een of twee standen als coördinaten, en `Poppetje`
zet daar lijnen van. Dat scheelt drie afhankelijkheden: geen licentie om na te
leven, geen koppeling die een mens moet nakijken, en geen server buiten ons
bereik die het beeld moet leveren. Het werkt dus ook offline, en het blijft
werken als iemand anders zijn database opschoont.

De tekeningen zijn met opzet schematisch. Ze laten de richting van de beweging
zien, en meer beloven ze niet: de techniek staat in de regel en de cue ernaast,
en die zijn nagekeken. Isolatie, skill en conditie krijgen geen tekening, want
daar zit te veel verschillends onder om met één poppetje te vangen, en een
tekening die niet klopt is erger dan geen tekening.

### Een foto gaat voor, als die is nagekeken

Is er voor een trede een bevestigde foto, dan komt die in plaats van de
tekening. Die foto's komen uit [wger](https://github.com/wger-project/wger), een
vrije oefeningendatabank. `npm run wger` zoekt per trede een oefening, haalt het
hoofdbeeld op en zet het in `public/exercises/`.

Twee dingen bepalen hoe dat werkt.

**Licentie.** wger staat onder CC-BY-SA, maar hun documentatie zegt dat losse
oefeningen een eigen licentie kunnen hebben. Elk beeld draagt daarom zijn
licentie en maker mee, en zonder die twee komt het er niet in. De
bronvermelding staat zichtbaar onder het beeld, want bij CC-BY-SA is dat een
voorwaarde en geen nette geste.

**Koppeling.** Een zoekopdracht op naam levert bij "Box squat (hoge box)" vroeg
of laat een plaatje van iets anders, en een verkeerd beeld leert iemand een
beweging aan die hij niet moest doen. Daarom komt alles binnen als
`bevestigd: false`, en toont de app onbevestigd beeld niet. Kijk na met
`npm run wger -- --lijst` en zet `bevestigd` met de hand op `true` voor wat
klopt. Zo kan een verkeerde koppeling nooit stil in beeld komen.

Het beeld laadt pas wanneer je de oefening opent, want honderd afbeeldingen
vooraf ophalen maakt precies de winst ongedaan die het eerste scherm licht
houdt.

`npm run e2e:wger` test het ophaalscript tegen een nepversie van wger: geen
netwerk nodig, en niet afhankelijk van wat er vandaag in die databank staat.

## Het weekrapport

De cijfers staan al in de app. Het rapport voegt één ding toe: het verband
ertussen. Dat je opkomst zakt terwijl je volume stijgt, zegt een tabel niet en
moet je wel weten.

Elk getal in de tekst wordt teruggezocht in je eigen data. Staat het er niet
bij, dan komt het rapport niet in beeld en zegt de app waarom. Een taalmodel
schrijft moeiteloos "je opkomst ging van 60 naar 85 procent" terwijl geen van
beide getallen bestaat. Dat leest prettig en is onwaar, en in een rapport over
je eigen vooruitgang is dat niet van de waarheid te onderscheiden zonder de bron
ernaast te leggen.

De controle staat in `src/domain/report.ts` en laat wel toe wat redelijk is: een
verhouding als percentage opschrijven, of een gemiddelde afronden.

## Een klacht in je eigen woorden

Op het trainingsscherm kun je melden dat iets niet goed voelt, bijvoorbeeld
"mijn rechterknie voelt raar vanaf rep 6 bij squats, pijn een 7".

Het taalmodel doet daarbij één ding: het bepaalt welk lichaamsgebied je bedoelt
en welke van je huidige oefeningen dat gebied belasten. Wat er met je programma
gebeurt, rekent de app daarna zelf uit, met dezelfde drempels als De Regel. Het
resultaat is een voorstel dat je nog moet accepteren.

Die scheiding is de kern. Een taalmodel dat zelf mag besluiten hoeveel belasting
eraf gaat, geeft bij dezelfde klacht op dinsdag een ander antwoord dan op
donderdag. Voor een app die letsel moet helpen voorkomen is dat geen
acceptabele eigenschap.

Wat het model teruggeeft wordt nagelezen voordat het de app in gaat. Een
verzonnen oefening, een gebied dat niet bestaat of een pijncijfer buiten 0 tot
10 wordt geweigerd in plaats van gerepareerd. Zonder sleutel of zonder bereik
blijft de gewone weg open: pijn invullen bij de set doet hetzelfde en werkt
offline.

## Een set inspreken

Typen tussen twee sets door is het grootste ongemak in de zaal: bezwete handen,
telefoon op de bank, en je wilt door. De microfoonknop onder de setlijst vult de
laatste set in met wat je zegt, bijvoorbeeld "tien reps vijftig kilo rir drie".

Dit loopt volledig op het toestel via de spraakherkenning van de browser. Er
gaat geen audio naar onze server, er is geen sleutel voor nodig en het kost
niets per set. Kan de browser het niet, dan verschijnt de knop niet: een knop
die niets doet is erger dan geen knop.

Het begrijpen zelf staat in `src/domain/speech.ts`, los van het scherm, zodat
elke zin te testen is. Twee keuzes daarin:

- Liever niets invullen dan iets verkeerds. Een veld dat niet eenduidig uit de
  zin volgt blijft leeg, en waarden buiten een geloofwaardig bereik worden
  genegeerd.
- "tien vijftig" wordt bewust niet geraden. Het verschil tussen tien reps van
  vijftig kilo en vijftig reps van tien kilo is te groot om naar te gokken.

Let op de richting van een getal in het Nederlands: bij een eenheid staat het
ervoor ("50 kilo"), bij een label erachter ("rir 3"). Behandel je dat als één
geval, dan leest "10 reps 50 kilo" als vijftig reps.

`npm run e2e:speech` vervangt de herkenner door een nepversie met een vaste zin
en controleert daarna de echte keten: parsen, invullen en het oordeel dat erop
volgt.

## Zonder bereik

De app draait zonder netwerk en kan op het beginscherm van een telefoon. Je
data stond altijd al lokaal; wat ontbrak was de app zelf, en die staat nu in
een cache van de browser.

`scripts/sw.mjs` schrijft de service worker na elke build. Die lijst met
bestanden kan niet met de hand bijgehouden worden, want vite zet een hash in
elke bestandsnaam. Vergeet je zo'n lijst, dan werkt de app offline half, en dat
merk je pas in de sportschool. `npm run e2e:offline` haalt het netwerk er
daadwerkelijk uit en controleert of de app dan nog start, inclusief een scherm
dat pas bij gebruik geladen wordt.

Drie keuzes die erin zitten:

- Antwoorden van de coach komen nooit uit de cache. Een oud antwoord op een
  nieuwe vraag is erger dan geen antwoord.
- Een nieuwe versie neemt het pas over als de app helemaal gesloten is. Zou hij
  midden in een sessie wisselen, dan verdwijnen de brokken van de oude versie
  terwijl die pagina ze nog nodig heeft.
- De lettertypen komen van Google en worden niet meegekopieerd. Zonder bereik
  valt de app terug op het systeemlettertype. Dat scheelt honderden kilobytes
  en ziet er op iOS en Android gewoon goed uit.

De iconen maak je opnieuw met `npm run icons`. Dat gebruikt de browser om SVG
naar PNG te zetten, zodat het project daar geen apart gereedschap voor nodig
heeft. De uitkomst staat in `public/` en gaat mee in de repo, dus een gewone
build heeft geen browser nodig.

## Laadtijd op een slechte verbinding

De app wordt in een sportschool gebruikt, waar het bereik vaak slecht is. Wat
het eerste scherm nodig heeft, is daarom gescheiden van de rest:

| | gecomprimeerd |
| --- | --- |
| eerste scherm | 162 kB |
| de zes andere schermen samen | 25 kB, voorgeladen zodra het eerste scherm staat |
| grafieken | 109 kB, pas wanneer je er een in beeld scrolt |

Voor het splitsen was dat 293 kB voor het eerste scherm, met de grafieken erin.
De grafieken zijn met afstand het zwaarste onderdeel en staan op geen enkel
scherm bovenaan, dus die horen daar niet.

Twee dingen houden dit overeind. `npm run size` faalt zodra het eerste scherm
boven de grens komt, bijvoorbeeld doordat ergens een gewone import van `charts`
terugsluipt. En schermen worden geladen via `lazyScreen` in plaats van kaal
`React.lazy`: die onthoudt de module, zodat een tabwissel na het voorladen geen
leeg skelet meer laat zien. Met `React.lazy` alleen gebeurde dat wel, ook als de
code al binnen was.

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
