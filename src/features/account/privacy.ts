/**
 * De tekst waar iemand mee akkoord gaat.
 *
 * Staat hier als gegevens en niet als opmaak, zodat dezelfde tekst in het
 * scherm én in de export kan staan, en zodat een wijziging opvalt: verandert
 * hij inhoudelijk, dan hoort `TOESTEMMING_VERSIE` in server/accounts.ts mee te
 * veranderen zodat iedereen opnieuw akkoord geeft.
 *
 * Dit is geen juridisch advies en vervangt geen jurist. Het legt vast wat de
 * app feitelijk doet, en dat is het enige wat ik kan weten.
 */

export const PRIVACY_VERSIE = '2026-09-15'

export interface PrivacyBlok {
  kop: string
  regels: string[]
}

export const PRIVACY: PrivacyBlok[] = [
  {
    kop: 'Wat we bewaren',
    regels: [
      'Je e-mailadres en een versleutelde versie van je wachtwoord.',
      'Wat je in de app invult: je intake, je sessies met reps, gewicht, pijn en techniek, je metingen, je voedingsdagen en de aanpassingen aan je programma.',
      'Wanneer je voor het laatst actief was, en welke apparaten een geldige sessie hebben.',
    ],
  },
  {
    kop: 'Waarom dit bijzondere gegevens zijn',
    regels: [
      'Pijnklachten, blessures, lichaamsmaten en eetgedrag zijn gegevens over je gezondheid. De AVG noemt dat een bijzondere categorie, met strengere regels dan gewone persoonsgegevens.',
      'Daarom vragen we bij het aanmaken van een account uitdrukkelijk je toestemming. Zonder die toestemming maken we geen account aan.',
      'Je kunt die toestemming altijd intrekken door je account te verwijderen. Alles wat we van je hebben gaat dan weg.',
    ],
  },
  {
    kop: 'Wie het kan zien',
    regels: [
      'Je gegevens staan onder jouw account en zijn niet zichtbaar voor andere gebruikers.',
      'We verkopen niets en we gebruiken je gegevens niet voor reclame.',
      'Als je de coach gebruikt, gaat een samenvatting van je trainings-, pijn- en voedingsgegevens naar OpenAI om je vraag te beantwoorden. Je naam, je geboortejaar en je vrije notities gaan daarbij niet mee.',
    ],
  },
  {
    kop: 'Hoe lang',
    regels: [
      'Zolang je account bestaat. Verwijder je je account, dan verdwijnen je gegevens direct en onherroepelijk.',
      'Sessies op apparaten verlopen na dertig dagen en worden daarna opgeruimd.',
    ],
  },
  {
    kop: 'Je rechten',
    regels: [
      'Inzage: je kunt al je gegevens exporteren als bestand, bij Instellingen.',
      'Verwijderen: je kunt je account en alles erin in één handeling weggooien.',
      'Correctie: alles wat je hebt ingevuld kun je in de app zelf wijzigen.',
      'Ben je het ergens niet mee eens, dan kun je klagen bij de Autoriteit Persoonsgegevens.',
    ],
  },
  {
    kop: 'Zonder account',
    regels: [
      'De app werkt volledig zonder account. Je gegevens blijven dan uitsluitend op dit toestel staan en komen nergens anders terecht.',
      'Dat is ook meteen het risico: raak je je toestel kwijt, dan is je log weg. Maak dan een export.',
    ],
  },
]

export const TOESTEMMING_TEKST =
  'Ik geef toestemming voor het bewaren en verwerken van mijn gezondheidsgegevens, zoals pijnklachten, blessures, lichaamsmaten en eetgedrag, zodat de app mijn programma daarop kan aanpassen.'
