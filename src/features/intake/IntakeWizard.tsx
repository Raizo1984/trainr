/**
 * Intake (sectie 2.1). Niets wordt overgeslagen met "dat vragen we later wel".
 * De wizard blokkeert doorlopen zolang verplichte velden ontbreken, en toont aan
 * het einde precies wat de antwoorden betekenen voor het programma.
 */

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  HeartPulse,
  Moon,
  Plus,
  Sun,
  Target,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CheckRow,
  ChoiceGroup,
  Field,
  NumberInput,
  ScalePicker,
  SectionTitle,
  Select,
  SourceNote,
  TextArea,
  TextInput,
  cx,
} from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { emptyIntake } from '@/domain/defaults'
import { assessRisk } from '@/domain/risk'
import { BODY_REGIONS, EQUIPMENT_LABEL, RED_FLAG_LABEL, REGION_LABEL } from '@/domain/types'
import type { BodyRegion, Complaint, Equipment, IntakeData, RedFlagSymptom, TrainingLevel } from '@/domain/types'
import { getPhase } from '@/domain/phases'
import { DOEL_LABEL } from '@/domain/taal'

const STEPS = [
  { id: 'basis', title: 'Wie je bent', icon: Activity },
  { id: 'medisch', title: 'Medische situatie', icon: HeartPulse },
  { id: 'training', title: 'Trainen', icon: Activity },
  { id: 'klachten', title: 'Klachten', icon: AlertTriangle },
  { id: 'voeding', title: 'Voeding', icon: UtensilsCrossed },
  { id: 'doelen', title: 'Doelen', icon: Target },
  { id: 'leven', title: 'Leefsituatie', icon: Moon },
  { id: 'samenvatting', title: 'Wat dit betekent', icon: Check },
] as const

export default function IntakeWizard({
  theme,
  onToggleTheme,
}: {
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  const completeIntake = useAppStore((s) => s.completeIntake)
  const loadDemo = useAppStore((s) => s.loadDemo)
  const [step, setStep] = useState(0)
  const [intake, setIntake] = useState<IntakeData>(emptyIntake)

  const patch = (updater: (draft: IntakeData) => void) =>
    setIntake((current) => {
      const draft: IntakeData = structuredClone(current)
      updater(draft)
      return draft
    })

  const blocking = useMemo(() => validate(intake, STEPS[step].id), [intake, step])
  const last = step === STEPS.length - 1

  return (
    <div className="relative z-10 mx-auto min-h-dvh w-full max-w-[760px] px-4 py-6 md:py-12">
      <header className="mb-6 flex items-center justify-between gap-4 md:mb-7 md:items-start">
        <div className="flex items-center gap-3">
          <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-2xl text-white shadow-[0_10px_28px_-10px_var(--brand-1)] md:size-11">
            <Activity className="size-5" strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight md:text-[22px]">Trainr</h1>
            <p className="text-[12.5px] leading-snug text-ink-3 md:text-[13px]">
              Evidence-based coaching, van intake tot vier jaar verder
            </p>
          </div>
        </div>
        <button
          onClick={onToggleTheme}
          aria-label="Thema wisselen"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink-2 transition-colors hover:text-ink"
        >
          {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
      </header>

      <Stepper step={step} onJump={(i) => i < step && setStep(i)} />

      {/*
        De stap schuift 24px van rechts in beeld. Zonder deze clip maakt dat de
        pagina tijdens de animatie even breder dan het scherm, wat op een
        telefoon een horizontale schuifbeweging oplevert van een fractie van een
        seconde. Zichtbaar genoeg om te irriteren, kort genoeg om over het hoofd
        te zien in een test die na afloop meet.
      */}
      <div className="overflow-x-clip">
        <AnimatePresence mode="wait">
          <motion.div
            key={STEPS[step].id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && <BasisStep intake={intake} patch={patch} />}
            {step === 1 && <MedicalStep intake={intake} patch={patch} />}
            {step === 2 && <TrainingStep intake={intake} patch={patch} />}
            {step === 3 && <ComplaintStep intake={intake} patch={patch} />}
            {step === 4 && <NutritionStep intake={intake} patch={patch} />}
            {step === 5 && <GoalsStep intake={intake} patch={patch} />}
            {step === 6 && <LifestyleStep intake={intake} patch={patch} />}
            {step === 7 && <SummaryStep intake={intake} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:static md:mx-0 md:flex-nowrap md:border-0 md:bg-transparent md:px-0 md:pb-0 md:backdrop-blur-none"
        style={{ background: 'color-mix(in oklab, var(--surface-base) 88%, transparent)', borderColor: 'var(--border-subtle)' }}
      >
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} icon={<ArrowLeft className="size-4" />}>
          Terug
        </Button>
        <div className="flex-1" />
        {blocking && <span className="order-last w-full text-[12.5px] text-ink-3 md:order-none md:w-auto">{blocking}</span>}
        <Button
          variant="primary"
          disabled={Boolean(blocking)}
          onClick={() => (last ? completeIntake(intake) : setStep((s) => s + 1))}
          icon={last ? <Check className="size-4" /> : undefined}
        >
          {last ? 'Programma starten' : 'Verder'}
          {!last && <ArrowRight className="size-4" />}
        </Button>
      </div>

      {step === 0 && (
        <p className="mt-6 text-center text-[12.5px] text-ink-3">
          Even rondkijken zonder intake?{' '}
          <button onClick={loadDemo} className="font-semibold underline underline-offset-2" style={{ color: 'var(--brand-2)' }}>
            Laad de demodata
          </button>{' '}
          van veertien weken fase 1.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function validate(intake: IntakeData, stepId: (typeof STEPS)[number]['id']): string | null {
  switch (stepId) {
    case 'basis':
      if (!intake.name.trim()) return 'Vul je naam in'
      if (!intake.birthYear) return 'Vul je geboortejaar in'
      return null
    case 'medisch':
      if (!intake.medical.diagnoses.trim() && !intake.medical.contraindications.trim()) {
        return 'Vul diagnoses in, of schrijf "geen bekende diagnoses"'
      }
      return null
    case 'training':
      if (intake.training.equipment.length === 0) return 'Kies minstens één optie voor apparatuur'
      return null
    case 'voeding':
      if (!intake.nutrition.weightCurrentKg) return 'Vul je huidige gewicht in'
      return null
    case 'doelen':
      if (!intake.goals.vision48m.trim()) return 'Beschrijf je eindbeeld over vier jaar'
      return null
    default:
      return null
  }
}

function Stepper({ step, onJump }: { step: number; onJump: (index: number) => void }) {
  return (
    <div className="mb-6">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-ink">{STEPS[step].title}</span>
        <span className="num text-[12px] text-ink-3">
          {step + 1} / {STEPS.length}
        </span>
      </div>
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onJump(i)}
            aria-label={s.title}
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: 'var(--surface-3)', cursor: i < step ? 'pointer' : 'default' }}
          >
            <motion.span
              className="block h-full rounded-full"
              style={{ background: i <= step ? 'linear-gradient(90deg, var(--brand-1), var(--brand-2))' : 'transparent' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: i <= step ? 1 : 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

type StepProps = { intake: IntakeData; patch: (updater: (draft: IntakeData) => void) => void }

/* ------------------------------------------------------------------ */

function BasisStep({ intake, patch }: StepProps) {
  return (
    <Card>
      <SectionTitle
        title="Laten we beginnen bij het begin"
        subtitle="Deze intake duurt ongeveer acht minuten. Alles wat je hier invult stuurt het programma aan, dus antwoord eerlijk in plaats van optimistisch."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Naam" required>
          <TextInput value={intake.name} onChange={(e) => patch((d) => { d.name = e.target.value })} placeholder="Je voornaam" />
        </Field>
        <Field label="Geboortejaar" required>
          <NumberInput value={intake.birthYear} onChange={(v) => patch((d) => { d.birthYear = v })} min={1900} max={new Date().getFullYear()} placeholder="1983" />
        </Field>
        <Field label="Lengte" hint="Gebruikt voor context bij metingen, niet voor een BMI-oordeel.">
          <NumberInput value={intake.heightCm} onChange={(v) => patch((d) => { d.heightCm = v })} min={100} max={250} suffix="cm" placeholder="182" />
        </Field>
      </div>
      <SourceNote>Sectie 2.1, verplichte intake-items.</SourceNote>
    </Card>
  )
}

function MedicalStep({ intake, patch }: StepProps) {
  const flags = intake.medical.redFlagSymptoms
  const toggleFlag = (flag: RedFlagSymptom) =>
    patch((d) => {
      d.medical.redFlagSymptoms = flags.includes(flag) ? flags.filter((f) => f !== flag) : [...flags, flag]
    })

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Medische geschiedenis"
          subtitle="Niet om je af te remmen, maar om te weten waarbinnen we kunnen bouwen."
        />
        <div className="grid gap-4">
          <Field label="Diagnoses" required hint='Geen? Schrijf dan letterlijk "geen bekende diagnoses".'>
            <TextArea value={intake.medical.diagnoses} onChange={(e) => patch((d) => { d.medical.diagnoses = e.target.value })} placeholder="Bijvoorbeeld: geen bekende diagnoses" />
          </Field>
          <Field label="Eerdere blessures" hint="Locatie, jaartal en hoe het nu is.">
            <TextArea value={intake.medical.previousInjuries} onChange={(e) => patch((d) => { d.medical.previousInjuries = e.target.value })} placeholder="Knie links, 2019, zeurt nog bij traplopen naar beneden" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Operaties" hint="Inclusief plek van het litteken en de impact nu.">
              <TextArea value={intake.medical.surgeries} onChange={(e) => patch((d) => { d.medical.surgeries = e.target.value })} />
            </Field>
            <Field label="Medicatie">
              <TextArea value={intake.medical.medication} onChange={(e) => patch((d) => { d.medical.medication = e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contra-indicaties" hint="Wat heeft een arts of behandelaar je expliciet afgeraden?">
              <TextArea value={intake.medical.contraindications} onChange={(e) => patch((d) => { d.medical.contraindications = e.target.value })} />
            </Field>
            <Field label="Laatste controle" hint="Huisarts of specialist, en wanneer.">
              <TextInput value={intake.medical.lastCheckup} onChange={(e) => patch((d) => { d.medical.lastCheckup = e.target.value })} placeholder="Huisarts, voorjaar 2026" />
            </Field>
          </div>
        </div>
      </Card>

      <Card delay={0.06}>
        <SectionTitle
          title="Rode vlaggen"
          subtitle="Vink aan wat op dit moment speelt. Bij één van deze punten zet de app training op pauze tot je medisch groen licht hebt. Dat is geen straf, dat is hoe het hoort te werken."
          right={<Badge tone="serious">Veiligheid</Badge>}
        />
        <div className="grid gap-2">
          {(Object.keys(RED_FLAG_LABEL) as RedFlagSymptom[]).map((flag) => (
            <CheckRow
              key={flag}
              checked={flags.includes(flag)}
              onChange={() => toggleFlag(flag)}
              label={RED_FLAG_LABEL[flag]}
              tone="serious"
            />
          ))}
        </div>
        <SourceNote>Sectie 9.1, medische rode vlaggen met automatische pauze.</SourceNote>
      </Card>
    </div>
  )
}

function TrainingStep({ intake, patch }: StepProps) {
  const equipment = intake.training.equipment
  const toggleEquipment = (item: Equipment) =>
    patch((d) => {
      d.training.equipment = equipment.includes(item) ? equipment.filter((e) => e !== item) : [...equipment, item]
    })

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Trainingssituatie" subtitle="Het programma past zich aan de werkelijkheid aan, niet andersom." />
        <div className="grid gap-4">
          <Field label="Trainingsniveau">
            <ChoiceGroup<TrainingLevel>
              value={intake.training.level}
              onChange={(v) => patch((d) => { d.training.level = v })}
              options={[
                { value: 'nul', label: 'Praktisch nul', hint: 'Nauwelijks getraind' },
                { value: 'beginner', label: 'Beginner', hint: 'Onregelmatig, of net begonnen' },
                { value: 'intermediate', label: 'Gevorderd', hint: 'Jaren consistent getraind' },
                { value: 'advanced', label: 'Ver gevorderd', hint: 'Ervaren met periodisering' },
              ]}
            />
          </Field>
          <Field label="Sportverleden">
            <TextArea value={intake.training.sportHistory} onChange={(e) => patch((d) => { d.training.sportHistory = e.target.value })} placeholder="Voetbal tot 2008, daarna onregelmatig" />
          </Field>
          <Field label="Beschikbare apparatuur" hint="De app schrijft alleen oefeningen voor die je ook echt kunt uitvoeren.">
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((item) => (
                <CheckRow key={item} checked={equipment.includes(item)} onChange={() => toggleEquipment(item)} label={EQUIPMENT_LABEL[item]} />
              ))}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Realistische frequentie" hint="Niet wat je hoopt, maar wat je een slechte week nog haalt.">
              <NumberInput value={intake.training.sessionsPerWeek} onChange={(v) => patch((d) => { d.training.sessionsPerWeek = v ?? 3 })} min={1} max={7} suffix="x/week" />
            </Field>
            <Field label="Haalbare sessieduur">
              <NumberInput value={intake.training.sessionMinutes} onChange={(v) => patch((d) => { d.training.sessionMinutes = v ?? 60 })} min={20} max={150} step={5} suffix="min" />
            </Field>
          </div>
        </div>
      </Card>
    </div>
  )
}

function ComplaintStep({ intake, patch }: StepProps) {
  const complaints = intake.training.complaints

  const add = () =>
    patch((d) => {
      d.training.complaints.push({
        region: 'onderrug',
        intensity: 3,
        character: 'onbekend',
        course: 'chronisch',
        worseWhen: '',
        reaction24h: 'onbekend',
      })
    })

  const update = (index: number, updater: (complaint: Complaint) => void) =>
    patch((d) => { updater(d.training.complaints[index]) })

  return (
    <Card>
      <SectionTitle
        title="Huidige klachten"
        subtitle="Per lichaamsdeel: hoe erg, wat voor soort pijn, en wat het uitlokt. Geen klachten? Sla deze stap gerust over."
        right={
          <Button size="sm" onClick={add} icon={<Plus className="size-4" />}>
            Klacht
          </Button>
        }
      />

      {complaints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-[13px] text-ink-3">
          Geen klachten opgegeven. Dat scheelt een hoop opbouwtijd.
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((complaint, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="card-quiet space-y-3 p-4"
            >
              <div className="flex items-center gap-2">
                <Select value={complaint.region} onChange={(e) => update(index, (c) => { c.region = e.target.value as BodyRegion })} className="flex-1">
                  {BODY_REGIONS.map((region) => (
                    <option key={region} value={region}>{REGION_LABEL[region]}</option>
                  ))}
                </Select>
                <button
                  onClick={() => patch((d) => { d.training.complaints.splice(index, 1) })}
                  aria-label="Klacht verwijderen"
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink-3 transition-colors hover:text-ink"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <Field label={`Intensiteit: ${complaint.intensity}/10`}>
                <ScalePicker
                  value={complaint.intensity}
                  onChange={(v) => update(index, (c) => { c.intensity = v as Complaint['intensity'] })}
                  labels={['geen pijn', 'ondraaglijk']}
                  tone={complaint.intensity >= 5 ? 'serious' : complaint.intensity >= 3 ? 'warn' : 'good'}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Karakter" hint="Tintelend of uitstralend telt als neurologisch.">
                  <Select value={complaint.character} onChange={(e) => update(index, (c) => { c.character = e.target.value as Complaint['character'] })}>
                    <option value="mechanisch">Mechanisch</option>
                    <option value="neurologisch">Neurologisch</option>
                    <option value="onbekend">Weet ik niet</option>
                  </Select>
                </Field>
                <Field label="Verloop">
                  <Select value={complaint.course} onChange={(e) => update(index, (c) => { c.course = e.target.value as Complaint['course'] })}>
                    <option value="acuut">Acuut</option>
                    <option value="chronisch">Chronisch</option>
                  </Select>
                </Field>
                <Field label="Reactie na 24 uur">
                  <Select value={complaint.reaction24h} onChange={(e) => update(index, (c) => { c.reaction24h = e.target.value as Complaint['reaction24h'] })}>
                    <option value="erger">Erger</option>
                    <option value="gelijk">Gelijk</option>
                    <option value="beter">Beter</option>
                    <option value="onbekend">Weet ik niet</option>
                  </Select>
                </Field>
              </div>

              <Field label="Wanneer is het erger?">
                <TextInput value={complaint.worseWhen} onChange={(e) => update(index, (c) => { c.worseWhen = e.target.value })} placeholder="Traplopen naar beneden, lang zitten" />
              </Field>
            </motion.div>
          ))}
        </div>
      )}
      <SourceNote>Sectie 2.1, pijnkarakterisering en 24-uursreactie op belasting.</SourceNote>
    </Card>
  )
}

function NutritionStep({ intake, patch }: StepProps) {
  const n = intake.nutrition
  const risky = n.extremePatterns || n.eatingDisorderHistory || n.selfReportedExtreme

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Voedingsgeschiedenis"
          subtitle="Dit is het onderdeel waar de meeste programma's op stuklopen. Het bepaalt of de app je calorieën laat zien of juist expliciet buiten beeld houdt."
          right={<Badge tone="warn">Kritisch</Badge>}
        />
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Huidig gewicht" required>
              <NumberInput value={n.weightCurrentKg} onChange={(v) => patch((d) => { d.nutrition.weightCurrentKg = v })} step={0.5} suffix="kg" />
            </Field>
            <Field label="Laagste ooit">
              <NumberInput value={n.weightLowestKg} onChange={(v) => patch((d) => { d.nutrition.weightLowestKg = v })} step={0.5} suffix="kg" />
            </Field>
            <Field label="Hoogste ooit">
              <NumberInput value={n.weightHighestKg} onChange={(v) => patch((d) => { d.nutrition.weightHighestKg = v })} step={0.5} suffix="kg" />
            </Field>
          </div>

          <div className="grid gap-2">
            <CheckRow checked={n.yoyo} onChange={(v) => patch((d) => { d.nutrition.yoyo = v })} label="Mijn gewicht gaat al jaren op en neer" tone="warn" />
            <CheckRow
              checked={n.extremePatterns}
              onChange={(v) => patch((d) => { d.nutrition.extremePatterns = v })}
              label="Ik heb crashdiëten, vasten of intermittent fasting gedaan"
              hint="Ook als het lang geleden is."
              tone="warn"
            />
            <CheckRow
              checked={n.eatingDisorderHistory}
              onChange={(v) => patch((d) => { d.nutrition.eatingDisorderHistory = v })}
              label="Ik heb een eetstoornis gehad, of obsessief met eten omgegaan"
              tone="serious"
            />
            <CheckRow
              checked={n.selfReportedExtreme}
              onChange={(v) => patch((d) => { d.nutrition.selfReportedExtreme = v })}
              label="Ik ben extreem met voeding, of wil drastisch afvallen"
              hint="Korte termijn resultaten gaan bij mij voor."
              tone="serious"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Maaltijden per dag">
              <NumberInput value={n.mealsPerDay} onChange={(v) => patch((d) => { d.nutrition.mealsPerDay = v ?? 3 })} min={1} max={8} />
            </Field>
            <Field label="Focus">
              <Select value={n.focus} onChange={(e) => patch((d) => { d.nutrition.focus = e.target.value as typeof n.focus })}>
                <option value="spier">Spiermassa</option>
                <option value="vet">Vetpercentage</option>
                <option value="gewicht">Gewicht op de weegschaal</option>
                <option value="gezondheid">Gezondheid</option>
              </Select>
            </Field>
          </div>

          <Field label="Voorkeuren en beperkingen">
            <TextArea value={n.preferences} onChange={(e) => patch((d) => { d.nutrition.preferences = e.target.value })} placeholder="Vegetarisch, lactose-intolerant, houdt niet van vis" />
          </Field>
          <Field label="Supplementen die je nu gebruikt">
            <TextInput value={n.supplements} onChange={(e) => patch((d) => { d.nutrition.supplements = e.target.value })} placeholder="Creatine, vitamine D" />
          </Field>
        </div>
      </Card>

      <AnimatePresence>
        {risky && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" style={{ color: 'var(--status-warn)' }} />
                <div>
                  <h3 className="text-[14px] font-semibold">Beschermend voedingsmodel wordt ingeschakeld</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                    Je krijgt geen calorieteller, geen eetvensters en geen gewichtsdoel. De app stuurt uitsluitend op
                    ondergrenzen: minimaal drie maaltijden per dag en een exact eiwitdoel. Daarnaast krijg je een
                    verwijzing naar een diëtist, omdat training en voeding hier samen moeten lopen.
                  </p>
                </div>
              </div>
              <SourceNote>Sectie 2.2 stap 3, sectie 5.1 en sectie 9.3.</SourceNote>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GoalsStep({ intake, patch }: StepProps) {
  const dreams = ['Pull-up', 'Dip', 'Muscle-up', 'L-sit', 'Touwklimmen', 'Handstand', 'Pijnvrij traplopen', '100 kg squat']
  const toggleDream = (dream: string) =>
    patch((d) => {
      d.goals.dreamGoals = d.goals.dreamGoals.includes(dream)
        ? d.goals.dreamGoals.filter((x) => x !== dream)
        : [...d.goals.dreamGoals, dream]
    })

  return (
    <Card>
      <SectionTitle title="Wat wil je bereiken?" subtitle="Eén hoofddoel en een beeld van waar je over een paar jaar wilt staan. Meer tegelijk najagen levert niets op." />
      <div className="grid gap-4">
        <Field label="Waar wil je over een paar jaar staan?" required hint="Wat wil je kunnen, en hoe wil je eruitzien? Eén of twee zinnen is genoeg.">
          <TextArea value={intake.goals.vision48m} onChange={(e) => patch((d) => { d.goals.vision48m = e.target.value })} placeholder="Tien strakke pull-ups, pijnvrij traplopen, zichtbaar sterker dan nu" />
        </Field>
        <Field label="Wat wil je vooral bereiken?" hint="Eén doel. Alles tegelijk najagen levert niets op.">
          <ChoiceGroup
            columns={1}
            value={intake.goals.primary}
            onChange={(v) => patch((d) => { d.goals.primary = v })}
            options={(
              ['spiermassa', 'kracht', 'skill', 'transformatie', 'pijnvrij-bewegen'] as const
            ).map((waarde) => ({
              value: waarde,
              label: DOEL_LABEL[waarde].label,
              hint: DOEL_LABEL[waarde].uitleg,
            }))}
          />
        </Field>
        <Field label="Droomdoelen" hint="Deze worden in fase 3 en verder in het programma verwerkt, niet als los kunstje erbij.">
          <div className="flex flex-wrap gap-2">
            {dreams.map((dream) => {
              const active = intake.goals.dreamGoals.includes(dream)
              return (
                <button
                  key={dream}
                  type="button"
                  onClick={() => toggleDream(dream)}
                  className={cx('rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all', active ? 'border-transparent' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong')}
                  style={active ? { background: 'var(--brand-soft)', color: 'var(--brand-2)', boxShadow: 'inset 0 0 0 1.5px var(--brand-2)' } : undefined}
                >
                  {dream}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Wat mag beslist niet" hint="Deze grens neemt de app over als harde randvoorwaarde.">
          <TextInput value={intake.goals.hardNo} onChange={(e) => patch((d) => { d.goals.hardNo = e.target.value })} placeholder="Geen crashdiëten meer. Nooit meer vasten." />
        </Field>
        <Field label="Hoe leer je het liefst?">
          <ChoiceGroup
            value={intake.goals.learningStyle}
            onChange={(v) => patch((d) => { d.goals.learningStyle = v })}
            options={[
              { value: 'direct', label: 'Direct', hint: 'Zeg wat ik moet doen' },
              { value: 'stap-voor-stap', label: 'Stap voor stap' },
              { value: 'weinig-theorie', label: 'Weinig theorie' },
              { value: 'veel-practicum', label: 'Veel oefenen' },
            ]}
          />
        </Field>
      </div>
    </Card>
  )
}

function LifestyleStep({ intake, patch }: StepProps) {
  const l = intake.lifestyle
  return (
    <Card>
      <SectionTitle title="Leefomstandigheden" subtitle="Herstel is training. Slaap en stress bepalen hoeveel volume zinvol is." />
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Uren slaap per nacht">
            <NumberInput value={l.sleepHours} onChange={(v) => patch((d) => { d.lifestyle.sleepHours = v ?? 7 })} suffix="uur" min={3} max={12} step={0.5} />
          </Field>
          <Field label={`Slaapkwaliteit: ${l.sleepQuality}/5`}>
            <ScalePicker value={l.sleepQuality} min={1} max={5} onChange={(v) => patch((d) => { d.lifestyle.sleepQuality = v as typeof l.sleepQuality })} labels={['slecht', 'uitstekend']} />
          </Field>
        </div>
        <Field label={`Stress: ${l.stress}/10`}>
          <ScalePicker value={l.stress} min={1} max={10} onChange={(v) => patch((d) => { d.lifestyle.stress = v })} labels={['ontspannen', 'overbelast']} tone={l.stress >= 8 ? 'serious' : l.stress >= 6 ? 'warn' : 'good'} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dagelijkse activiteit">
            <Select value={l.dailyActivity} onChange={(e) => patch((d) => { d.lifestyle.dailyActivity = e.target.value as typeof l.dailyActivity })}>
              <option value="zittend">Overwegend zittend</option>
              <option value="gemengd">Gemengd</option>
              <option value="actief">Actief werk</option>
            </Select>
          </Field>
          <Field label="Reispatroon">
            <Select value={l.travel} onChange={(e) => patch((d) => { d.lifestyle.travel = e.target.value as typeof l.travel })}>
              <option value="stabiel">Stabiel, altijd dezelfde plek</option>
              <option value="wisselend">Wisselend</option>
              <option value="veel-reizen">Veel onderweg</option>
            </Select>
          </Field>
        </div>
        <Field label="Thuissituatie" hint="Eten jullie samen? Is er steun voor je trainingsschema?">
          <TextArea value={l.householdSupport} onChange={(e) => patch((d) => { d.lifestyle.householdSupport = e.target.value })} />
        </Field>
      </div>
    </Card>
  )
}

function SummaryStep({ intake }: { intake: IntakeData }) {
  const risk = useMemo(() => assessRisk(intake), [intake])
  const phase = getPhase(risk.startPhase)
  const tone = risk.level === 'hoog' ? 'serious' : risk.level === 'verhoogd' ? 'warn' : 'good'

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Dit is wat je antwoorden betekenen"
          subtitle="Geen algemeen advies, maar de instellingen waarmee jouw programma straks draait."
          right={<Badge tone={tone}>Risico: {risk.level}</Badge>}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card-quiet p-4">
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">Startfase</div>
            <div className="mt-1 text-[15px] font-semibold">{phase.name}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{phase.tagline}</p>
          </div>
          <div className="card-quiet p-4">
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">Voedingsmodel</div>
            <div className="mt-1 text-[15px] font-semibold">
              {risk.nutritionModel === 'hoog-risico' ? 'Beschermend' : 'Standaard'}
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
              {risk.nutritionModel === 'hoog-risico'
                ? 'Alleen ondergrenzen. Geen calorieën, geen eetvensters, geen gewichtsdoel.'
                : 'Calorieën zichtbaar als informatie, eiwit als doel, gewicht als trend.'}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Startdosis" value={`${Math.round(risk.safety.startingSetsFactor * 100)}%`} />
          <MiniStat label="Deload elke" value={`${risk.safety.deloadIntervalWeeks} wk`} />
          <MiniStat label="Pijngrens" value={`${risk.safety.painCeiling}/10`} />
          <MiniStat label="Progressiestap" value={`${risk.safety.loadStepPct}%`} />
        </div>
      </Card>

      {risk.factors.length > 0 && (
        <Card delay={0.06}>
          <SectionTitle title="Wat is opgevallen" subtitle="Elk punt hieronder verandert iets concreets aan je programma." />
          <ul className="space-y-2.5">
            {risk.factors.map((factor, i) => (
              <li key={`${factor.code}-${i}`} className="flex gap-3">
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{
                    background:
                      factor.severity === 'kritiek'
                        ? 'var(--status-serious)'
                        : factor.severity === 'let-op'
                          ? 'var(--status-warn)'
                          : 'var(--status-neutral)',
                  }}
                />
                <div>
                  <div className="text-[13.5px] font-semibold">{factor.label}</div>
                  <p className="text-[12.5px] leading-relaxed text-ink-2">{factor.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {risk.referrals.length > 0 && (
        <Card delay={0.12}>
          <SectionTitle title="Doorverwijzingen" subtitle="De app doet dit deel niet zelf, en doet ook niet alsof." />
          <div className="space-y-2.5">
            {risk.referrals.map((referral, i) => (
              <div key={i} className="card-quiet flex items-start gap-3 p-3.5">
                <Badge tone={referral.blocking ? 'serious' : 'warn'}>
                  {referral.kind === 'medisch' ? 'Arts' : referral.kind === 'fysio' ? 'Fysio' : referral.kind === 'dietist' ? 'Diëtist' : 'Psycholoog'}
                </Badge>
                <p className="flex-1 text-[13px] leading-relaxed text-ink-2">{referral.reason}</p>
              </div>
            ))}
          </div>
          {risk.trainingPaused && (
            <p className="mt-3 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed" style={{ background: 'var(--status-serious-soft)', color: 'var(--status-serious)' }}>
              Training start in pauzestand. Je kunt de app gewoon gebruiken om te loggen en te leren, maar er komt geen
              programma tot je groen licht hebt. Zo hoort het.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-quiet px-3 py-2.5 text-center">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="num mt-0.5 text-[16px] font-bold">{value}</div>
    </div>
  )
}
