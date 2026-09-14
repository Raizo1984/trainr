/**
 * Progressieladders (sectie 3.1 en 3.3).
 *
 * Elke lader is geordend op `rung`. De app verhoogt nooit tegelijk trede en
 * belasting — zie `rule.ts`, regel "never change two variables at once".
 */

import type { ExerciseLadder, Equipment, LadderStep } from './types'

const GYM: Equipment[] = ['sportschool', 'machines']
const FREE: Equipment[] = ['sportschool', 'halters', 'kettlebell']
const BODY: Equipment[] = ['geen', 'sportschool', 'halters', 'banden', 'pull-up-bar']

export const LADDERS: ExerciseLadder[] = [
  {
    id: 'squat',
    name: 'Squat / kniepatroon',
    pattern: 'squat',
    goal: 'Quad- en knie-uithoudingsvermogen, vormcontrole',
    rule: 'Pijnvrije diepte, traag en gecontroleerd. Diepte nooit forceren.',
    steps: [
      { id: 'squat-1', name: 'Box squat (hoge box)', rung: 1, equipment: BODY, cue: 'Tik de box aan, duw niet weg met de rug.', loadType: 'gewicht' },
      { id: 'squat-2', name: 'Box squat (lage box)', rung: 2, equipment: BODY, cue: 'Zelfde tempo, iets meer bereik.', loadType: 'gewicht' },
      { id: 'squat-3', name: 'Goblet squat', rung: 3, equipment: FREE, cue: 'Gewicht tegen de borst, ellebogen binnen de knieën.', loadType: 'gewicht' },
      { id: 'squat-4', name: 'Brede goblet squat', rung: 4, equipment: FREE, cue: 'Bredere stand, knieën volgen de tenen.', loadType: 'gewicht' },
      { id: 'squat-5', name: 'Front squat / hack squat', rung: 5, equipment: GYM, cue: 'Romp rechtop, gecontroleerde daling.', loadType: 'gewicht' },
      { id: 'squat-6', name: 'Back squat', rung: 6, equipment: ['sportschool', 'barbell'], cue: 'Brace eerst (Starrett), dan pas zakken.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'hinge',
    name: 'Glute / heupextensie',
    pattern: 'hinge',
    goal: 'Bilspieren, glutale activatie, heupuithouding — prioriteit in fase 1',
    rule: 'Bekken kantelen, top knijpen, geen hyperextensie in de rug.',
    steps: [
      { id: 'hinge-1', name: 'Glute bridge', rung: 1, equipment: BODY, cue: 'Ribben omlaag, bekken kantelen vóór het opdrukken.', loadType: 'gewicht' },
      { id: 'hinge-2', name: 'Eenbenige bridge', rung: 2, equipment: BODY, cue: 'Heupen recht houden, geen kanteling.', loadType: 'gewicht' },
      { id: 'hinge-3', name: 'Hip thrust (bank)', rung: 3, equipment: FREE, cue: 'Kin ingetrokken, ribben omlaag.', loadType: 'gewicht' },
      { id: 'hinge-4', name: 'Zware hip thrust', rung: 4, equipment: ['sportschool', 'barbell'], cue: '1 seconde pauze in de top.', loadType: 'gewicht' },
      { id: 'hinge-5', name: 'Romanian deadlift (licht)', rung: 5, equipment: FREE, cue: 'Neutrale rug, stop waar de hamstring op spanning komt.', loadType: 'gewicht' },
      { id: 'hinge-6', name: 'Romanian deadlift', rung: 6, equipment: ['sportschool', 'barbell'], cue: 'Heup naar achteren, staaf tegen het been.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'h-push',
    name: 'Horizontale push',
    pattern: 'horizontale-push',
    goal: 'Borst, voorzijde schouder, triceps',
    rule: 'Pijnvrije range, schouderblad stabiel op de ribbenkast.',
    steps: [
      { id: 'push-1', name: 'Wall push-up', rung: 1, equipment: ['geen'], cue: 'Lichaam als één lijn, geen doorzakkende heup.', loadType: 'trede' },
      { id: 'push-2', name: 'Hoge incline push-up', rung: 2, equipment: ['geen'], cue: 'Ellebogen circa 45 graden.', loadType: 'trede' },
      { id: 'push-3', name: 'Lage incline push-up', rung: 3, equipment: ['geen'], cue: 'Schouderbladen actief, niet inzakken.', loadType: 'trede' },
      { id: 'push-4', name: 'Push-up op de vloer', rung: 4, equipment: ['geen'], cue: 'Volledige range, borst tot vuisthoogte.', loadType: 'trede' },
      { id: 'push-5', name: 'Dumbbell bench press', rung: 5, equipment: FREE, cue: 'Schouderbladen ingetrokken.', loadType: 'gewicht' },
      { id: 'push-6', name: 'Bench press', rung: 6, equipment: ['sportschool', 'barbell'], cue: 'Voeten geplant, gecontroleerde daling.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'h-pull',
    name: 'Horizontale pull',
    pattern: 'horizontale-pull',
    goal: 'Rug, scapulacontrole, tractiebasis',
    rule: 'Schouders eerst naar beneden, dán pas trekken.',
    steps: [
      { id: 'pull-1', name: 'Machine row', rung: 1, equipment: GYM, cue: 'Borst tegen de steun, geen rompbeweging.', loadType: 'gewicht' },
      { id: 'pull-2', name: 'Chest-supported row', rung: 2, equipment: GYM, cue: 'Schouderblad eerst intrekken.', loadType: 'gewicht' },
      { id: 'pull-3', name: 'Dumbbell row (gesteund)', rung: 3, equipment: FREE, cue: 'Neutrale rug, elleboog langs het lichaam.', loadType: 'gewicht' },
      { id: 'pull-4', name: 'Inverted row (hoog)', rung: 4, equipment: ['sportschool', 'pull-up-bar'], cue: 'Lichaam gespannen als een plank.', loadType: 'trede' },
      { id: 'pull-5', name: 'Inverted row (laag)', rung: 5, equipment: ['sportschool', 'pull-up-bar'], cue: 'Hakken op de grond, volledige range.', loadType: 'trede' },
      { id: 'pull-6', name: 'Barbell row', rung: 6, equipment: ['sportschool', 'barbell'], cue: 'Romphoek vast, geen zwaai.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'v-pull',
    name: 'Verticale pull (pull-up pad)',
    pattern: 'verticale-pull',
    goal: 'Droomdoel pull-up, via de lader van Low',
    rule: 'Techniek boven reps. Negatieven altijd traag (3-5 seconden).',
    steps: [
      { id: 'vpull-1', name: 'Lat pulldown', rung: 1, equipment: GYM, cue: 'Schouders omlaag, borst omhoog.', loadType: 'gewicht' },
      { id: 'vpull-2', name: 'Scapula pull-up (hang)', rung: 2, equipment: ['pull-up-bar', 'sportschool'], cue: 'Alleen de schouderbladen bewegen.', loadType: 'trede' },
      { id: 'vpull-3', name: 'Assisted pull-up (band)', rung: 3, equipment: ['pull-up-bar', 'banden', 'sportschool'], cue: 'Zo min mogelijk bandspanning.', loadType: 'gewicht' },
      { id: 'vpull-4', name: 'Negatieve pull-up', rung: 4, equipment: ['pull-up-bar', 'sportschool'], cue: '3 tot 5 seconden zakken, volledige controle.', loadType: 'trede' },
      { id: 'vpull-5', name: 'Pull-up', rung: 5, equipment: ['pull-up-bar', 'sportschool'], cue: 'Volledige hang tot kin over de stang.', loadType: 'trede' },
      { id: 'vpull-6', name: 'Verzwaarde pull-up', rung: 6, equipment: ['pull-up-bar', 'sportschool'], cue: 'Pas verzwaren bij 8 schone reps.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'v-push',
    name: 'Verticale push (dip pad)',
    pattern: 'verticale-push',
    goal: 'Schouder, triceps, droomdoel dips',
    rule: 'Schouder nooit onder de elleboog bij pijn. Range opbouwen, niet forceren.',
    steps: [
      { id: 'vpush-1', name: 'Dumbbell shoulder press (zittend)', rung: 1, equipment: FREE, cue: 'Ribben omlaag, geen rugholte.', loadType: 'gewicht' },
      { id: 'vpush-2', name: 'Bench dip (voeten op de grond)', rung: 2, equipment: ['geen'], cue: 'Schouders laag, niet naar de oren.', loadType: 'trede' },
      { id: 'vpush-3', name: 'Assisted dip', rung: 3, equipment: ['sportschool', 'banden'], cue: 'Lichte voorwaartse romphoek.', loadType: 'gewicht' },
      { id: 'vpush-4', name: 'Negatieve dip', rung: 4, equipment: ['sportschool'], cue: '3 tot 5 seconden zakken.', loadType: 'trede' },
      { id: 'vpush-5', name: 'Dip', rung: 5, equipment: ['sportschool'], cue: 'Volledige controle, geen bounce onderin.', loadType: 'trede' },
    ],
  },
  {
    id: 'l-sit',
    name: 'L-sit',
    pattern: 'skill',
    goal: 'Droomdoel L-sit: rompkracht in gestrekte positie',
    rule: 'Houden tot de vorm wegzakt, niet tot falen. Schouders altijd omlaag gedrukt.',
    steps: [
      { id: 'lsit-1', name: 'Gesteunde knieheffing (parallettes)', rung: 1, equipment: ['geen', 'sportschool'], cue: 'Schouders omlaag drukken, armen gestrekt.', loadType: 'tijd' },
      { id: 'lsit-2', name: 'Tuck hold', rung: 2, equipment: ['geen', 'sportschool'], cue: 'Knieën tegen de borst, bekken gekanteld.', loadType: 'tijd' },
      { id: 'lsit-3', name: 'Gevorderde tuck hold', rung: 3, equipment: ['geen', 'sportschool'], cue: 'Bovenbenen horizontaal, onderbenen los.', loadType: 'tijd' },
      { id: 'lsit-4', name: 'Eén been gestrekt', rung: 4, equipment: ['geen', 'sportschool'], cue: 'Wissel per set van been.', loadType: 'tijd' },
      { id: 'lsit-5', name: 'L-sit', rung: 5, equipment: ['geen', 'sportschool'], cue: 'Beide benen gestrekt en horizontaal.', loadType: 'tijd' },
    ],
  },
  {
    id: 'hang-rope',
    name: 'Hang en touwklimmen',
    pattern: 'skill',
    goal: 'Droomdoel touwklimmen: grip, hangkracht en beenklem',
    rule: 'Grip is de begrenzing, niet de rug. Stop bij gripverlies, niet erna.',
    steps: [
      { id: 'rope-1', name: 'Passieve dead hang', rung: 1, equipment: ['pull-up-bar', 'sportschool'], cue: 'Ontspannen hangen, schouders bij de oren mag hier.', loadType: 'tijd' },
      { id: 'rope-2', name: 'Actieve hang', rung: 2, equipment: ['pull-up-bar', 'sportschool'], cue: 'Schouderbladen omlaag en vast.', loadType: 'tijd' },
      { id: 'rope-3', name: 'Handdoekhang', rung: 3, equipment: ['pull-up-bar', 'sportschool'], cue: 'Dikkere grip, korter volhouden is normaal.', loadType: 'tijd' },
      { id: 'rope-4', name: 'Touwhang met beenklem', rung: 4, equipment: ['sportschool'], cue: 'Voeten klemmen eerst, dan pas ontspannen de armen.', loadType: 'tijd' },
      { id: 'rope-5', name: 'Touwklimmen met beenklem', rung: 5, equipment: ['sportschool'], cue: 'Klemmen, strekken, verplaatsen. Nooit alleen op de armen.', loadType: 'afstand' },
    ],
  },
  {
    id: 'handstand',
    name: 'Handstand',
    pattern: 'skill',
    goal: 'Droomdoel handstand: schouderstabiliteit boven het hoofd',
    rule: 'Alleen bij pijnvrije schouder en pols. Opbouwen in seconden, niet in pogingen.',
    steps: [
      { id: 'hs-1', name: 'Plank met de voeten tegen de muur', rung: 1, equipment: ['geen'], cue: 'Ribben omlaag, geen doorzakkende heup.', loadType: 'tijd' },
      { id: 'hs-2', name: 'Handstand met rug naar de muur', rung: 2, equipment: ['geen'], cue: 'Handen een halve voetlengte van de muur.', loadType: 'tijd' },
      { id: 'hs-3', name: 'Handstand met borst naar de muur', rung: 3, equipment: ['geen'], cue: 'Rechte lijn, billen aangespannen.', loadType: 'tijd' },
      { id: 'hs-4', name: 'Vrijstaande handstand', rung: 4, equipment: ['geen'], cue: 'Corrigeren met de vingers, niet met de heup.', loadType: 'tijd' },
    ],
  },
  {
    id: 'muscle-up',
    name: 'Muscle-up',
    pattern: 'skill',
    goal: 'Droomdoel muscle-up: overgang van trekken naar drukken',
    rule: 'Pas beginnen bij acht schone pull-ups en acht schone dips. Eerder is het geen skillwerk maar een blessure in wording.',
    steps: [
      { id: 'mu-1', name: 'Hoge pull-up tot borsthoogte', rung: 1, equipment: ['pull-up-bar', 'sportschool'], cue: 'Trek tot de stang je onderste ribben raakt.', loadType: 'trede' },
      { id: 'mu-2', name: 'Overgang met band', rung: 2, equipment: ['pull-up-bar', 'banden', 'sportschool'], cue: 'Pols doorrollen op het hoogste punt.', loadType: 'gewicht' },
      { id: 'mu-3', name: 'Negatieve muscle-up', rung: 3, equipment: ['pull-up-bar', 'sportschool'], cue: 'Traag terugzakken door de overgang.', loadType: 'trede' },
      { id: 'mu-4', name: 'Muscle-up', rung: 4, equipment: ['pull-up-bar', 'sportschool'], cue: 'Geen zwaai. Kan het niet strikt, dan is de basis nog niet klaar.', loadType: 'trede' },
    ],
  },
  {
    id: 'carry-core',
    name: 'Carry / core',
    pattern: 'carry-core',
    goal: 'Grip, anti-rotatie, romp­stabiliteit (McGill)',
    rule: 'Rechte lijnen lopen, geen compensatie. Ademen blijft rustig.',
    steps: [
      { id: 'carry-1', name: 'Dead bug', rung: 1, equipment: ['geen'], cue: 'Onderrug blijft op de grond.', loadType: 'trede' },
      { id: 'carry-2', name: 'Pallof press', rung: 2, equipment: ['banden', 'sportschool'], cue: 'Heupen blijven recht naar voren.', loadType: 'gewicht' },
      { id: 'carry-3', name: 'Suitcase carry', rung: 3, equipment: FREE, cue: 'Niet overhellen, schouders gelijk.', loadType: 'afstand' },
      { id: 'carry-4', name: 'Farmer carry', rung: 4, equipment: FREE, cue: 'Borst omhoog, korte passen.', loadType: 'afstand' },
      { id: 'carry-5', name: 'Sled push', rung: 5, equipment: ['sportschool'], cue: 'Lage romphoek, constante druk.', loadType: 'afstand' },
    ],
  },
  {
    id: 'quad-iso',
    name: 'Quad-isolatie',
    pattern: 'isolatie',
    goal: 'Knie-uithouding en quadvolume zonder rompbelasting',
    rule: 'Volledige range binnen pijnvrij bereik, 2 seconden excentrisch.',
    steps: [
      { id: 'quad-1', name: 'Wall sit', rung: 1, equipment: ['geen'], cue: 'Gelijkmatige druk door de hele voet.', loadType: 'tijd' },
      { id: 'quad-2', name: 'Step-up (lage box)', rung: 2, equipment: ['geen'], cue: 'Niet afzetten met het achterste been.', loadType: 'gewicht' },
      { id: 'quad-3', name: 'Leg extension', rung: 3, equipment: GYM, cue: 'Geen zwaai, rustig terug.', loadType: 'gewicht' },
      { id: 'quad-4', name: 'Split squat', rung: 4, equipment: FREE, cue: 'Voorste scheenbeen rustig naar voren.', loadType: 'gewicht' },
      { id: 'quad-5', name: 'Bulgarian split squat', rung: 5, equipment: FREE, cue: 'Achterste voet los, romp licht voorover.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'ham-iso',
    name: 'Hamstring-isolatie',
    pattern: 'isolatie',
    goal: 'Hamstringkracht in lange positie',
    rule: 'Excentrisch accent, nooit tot kramp.',
    steps: [
      { id: 'ham-1', name: 'Hamstring bridge walkout', rung: 1, equipment: ['geen'], cue: 'Heupen hoog houden tijdens het lopen.', loadType: 'trede' },
      { id: 'ham-2', name: 'Leg curl', rung: 2, equipment: GYM, cue: 'Bekken blijft op de bank.', loadType: 'gewicht' },
      { id: 'ham-3', name: 'Nordic negatief (geassisteerd)', rung: 3, equipment: ['geen'], cue: 'Zo traag mogelijk zakken.', loadType: 'trede' },
    ],
  },
  {
    id: 'rear-delt',
    name: 'Face pull / achterste deltoid',
    pattern: 'isolatie',
    goal: 'Schoudergezondheid en scapulabalans',
    rule: 'Hoge reps, lichte belasting, nooit tot falen.',
    steps: [
      { id: 'rd-1', name: 'Band pull-apart', rung: 1, equipment: ['banden'], cue: 'Ellebogen licht gebogen, schouders laag.', loadType: 'gewicht' },
      { id: 'rd-2', name: 'Face pull', rung: 2, equipment: ['sportschool', 'banden'], cue: 'Handen naar het voorhoofd, niet naar de kin.', loadType: 'gewicht' },
      { id: 'rd-3', name: 'Reverse fly', rung: 3, equipment: FREE, cue: 'Geen zwaai vanuit de romp.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'biceps',
    name: 'Biceps',
    pattern: 'isolatie',
    goal: 'Elleboogbelastbaarheid en armvolume',
    rule: 'Volledige range, geen zwaai. Bij elleboogklachten: trede terug.',
    steps: [
      { id: 'bi-1', name: 'Band curl', rung: 1, equipment: ['banden'], cue: 'Ellebogen vast langs het lichaam.', loadType: 'gewicht' },
      { id: 'bi-2', name: 'Dumbbell curl', rung: 2, equipment: FREE, cue: 'Rustig laten zakken.', loadType: 'gewicht' },
      { id: 'bi-3', name: 'Incline curl', rung: 3, equipment: FREE, cue: 'Langere spierlengte, lichter gewicht.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'triceps',
    name: 'Triceps',
    pattern: 'isolatie',
    goal: 'Elleboogbelastbaarheid en pushvolume',
    rule: 'Hoge reps (12-20), pijnvrije elleboog.',
    steps: [
      { id: 'tri-1', name: 'Band pushdown', rung: 1, equipment: ['banden'], cue: 'Ellebogen stil.', loadType: 'gewicht' },
      { id: 'tri-2', name: 'Cable pushdown', rung: 2, equipment: GYM, cue: 'Volledige strekking zonder blokkeren.', loadType: 'gewicht' },
      { id: 'tri-3', name: 'Overhead extension', rung: 3, equipment: FREE, cue: 'Alleen bij pijnvrije schouder.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'calf',
    name: 'Kuit / tibialis',
    pattern: 'isolatie',
    goal: 'Achillespees en onderbeen, vaste cool-down (sectie 3.3)',
    rule: 'Volledige range, 1 seconde pauze onderin en bovenin.',
    steps: [
      { id: 'calf-1', name: 'Calf raise (vlakke grond)', rung: 1, equipment: ['geen'], cue: 'Gelijkmatig door beide voeten.', loadType: 'trede' },
      { id: 'calf-2', name: 'Calf raise vanaf een opstapje', rung: 2, equipment: ['geen'], cue: 'Diep zakken, rustig omhoog.', loadType: 'gewicht' },
      { id: 'calf-3', name: 'Eenbenige calf raise', rung: 3, equipment: ['geen'], cue: 'Balans aan de muur.', loadType: 'gewicht' },
    ],
  },
  {
    id: 'tibialis',
    name: 'Tibialis raise',
    pattern: 'isolatie',
    goal: 'Voorzijde onderbeen, knie- en enkelbelastbaarheid',
    rule: 'Vaste cool-down, altijd hetzelfde.',
    steps: [
      { id: 'tib-1', name: 'Tibialis raise tegen de muur', rung: 1, equipment: ['geen'], cue: 'Hakken tegen de muur, tenen optrekken.', loadType: 'trede' },
    ],
  },
  {
    id: 'warmup-cardio',
    name: 'Warming-up cardio',
    pattern: 'conditie',
    goal: 'Doorbloeding en temperatuur, 5 minuten',
    rule: 'Rustig tempo, praten moet kunnen.',
    steps: [
      { id: 'wu-1', name: 'Achterwaarts lopen op de loopband (traag)', rung: 1, equipment: ['sportschool'], cue: 'Korte passen, rechtop.', loadType: 'tijd' },
      { id: 'wu-2', name: 'Rustig fietsen', rung: 1, equipment: ['sportschool'], cue: 'Laag weerstandsniveau.', loadType: 'tijd' },
      { id: 'wu-3', name: 'Stevig wandelen', rung: 1, equipment: ['geen'], cue: 'Buiten of op de plaats.', loadType: 'tijd' },
    ],
  },
  {
    id: 'birddog',
    name: 'Bird dog',
    pattern: 'carry-core',
    goal: 'Rompstabiliteit (McGill), vaste warming-up',
    rule: 'Bekken stil, traag bewegen.',
    steps: [{ id: 'bd-1', name: 'Bird dog', rung: 1, equipment: ['geen'], cue: 'Onderrug neutraal, geen kanteling.', loadType: 'trede' }],
  },
  {
    id: 'mobility-hip',
    name: 'Heupmobiliteit',
    pattern: 'conditie',
    goal: 'Bewegingsorganisatie (Starrett)',
    rule: 'Geen pijn, alleen rek.',
    steps: [
      { id: 'mh-1', name: '90/90 heuprotatie', rung: 1, equipment: ['geen'], cue: 'Rustig heen en weer, rechtop.', loadType: 'tijd' },
      { id: 'mh-2', name: 'Couch stretch', rung: 2, equipment: ['geen'], cue: 'Bilspier aanspannen, ribben omlaag.', loadType: 'tijd' },
    ],
  },
]

const LADDER_INDEX = new Map(LADDERS.map((l) => [l.id, l]))
const STEP_INDEX = new Map<string, { ladder: ExerciseLadder; step: LadderStep }>()
for (const ladder of LADDERS) {
  for (const step of ladder.steps) STEP_INDEX.set(step.id, { ladder, step })
}

export function getLadder(id: string): ExerciseLadder {
  const ladder = LADDER_INDEX.get(id)
  if (!ladder) throw new Error(`Onbekende lader: ${id}`)
  return ladder
}

export function getStep(stepId: string): LadderStep {
  const hit = STEP_INDEX.get(stepId)
  if (!hit) throw new Error(`Onbekende trede: ${stepId}`)
  return hit.step
}

export function tryGetStep(stepId: string): LadderStep | null {
  return STEP_INDEX.get(stepId)?.step ?? null
}

export function exerciseName(ladderId: string, stepId: string): string {
  const step = tryGetStep(stepId)
  return step ? step.name : getLadder(ladderId).name
}

/** Eén trede terug in de lader; `null` als de gebruiker al onderaan staat. */
export function regressStep(ladderId: string, stepId: string): LadderStep | null {
  const ladder = getLadder(ladderId)
  const index = ladder.steps.findIndex((s) => s.id === stepId)
  if (index <= 0) return null
  return ladder.steps[index - 1]
}

/** Eén trede vooruit; `null` als de lader op is. */
export function advanceStep(ladderId: string, stepId: string): LadderStep | null {
  const ladder = getLadder(ladderId)
  const index = ladder.steps.findIndex((s) => s.id === stepId)
  if (index < 0 || index === ladder.steps.length - 1) return null
  return ladder.steps[index + 1]
}

/**
 * Hoogste trede die met de beschikbare apparatuur uitvoerbaar is en niet boven
 * `maxRung` uitkomt. Valt terug op de laagste trede als niets past, zodat de
 * app nooit een onuitvoerbare oefening voorschrijft.
 */
export function selectStep(ladderId: string, equipment: Equipment[], maxRung: number): LadderStep {
  const ladder = getLadder(ladderId)
  // Een oefening die geen apparatuur nodig heeft, kan iedereen doen. Zonder deze
  // regel zou een sportschoolgebruiker geen push-up of calf raise voorgeschreven
  // krijgen, puur omdat "alleen lichaamsgewicht" niet is aangevinkt.
  const available: Equipment[] = equipment.includes('geen') ? equipment : [...equipment, 'geen']
  const usable = ladder.steps.filter(
    (s) => s.rung <= maxRung && s.equipment.some((e) => available.includes(e)),
  )
  if (usable.length > 0) return usable[usable.length - 1]
  const anyUsable = ladder.steps.filter((s) => s.equipment.some((e) => available.includes(e)))
  return anyUsable[0] ?? ladder.steps[0]
}
