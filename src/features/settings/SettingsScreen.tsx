/**
 * Instellingen: eigenaarschap over de data (sectie 8.2) en het opheffen van
 * een medische pauze. Exporteren en verwijderen kan altijd, zonder drempels.
 */

import { useState } from 'react'
import { Database, Download, Play, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge, Button, Card, SectionTitle, SourceNote, TextArea } from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useCurrentPhase } from '@/store/selectors'

export default function SettingsScreen() {
  const state = useAppStore()
  const phase = useCurrentPhase()
  const [confirmReset, setConfirmReset] = useState(false)
  const [clearance, setClearance] = useState('')

  const download = () => {
    const blob = new Blob([state.exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `trainr-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <header className="pb-1">
        <h1 className="text-[26px] font-bold tracking-tight">Instellingen</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">Je data, je apparaat, je keuze.</p>
      </header>

      {state.medicalHold?.active && (
        <Card>
          <SectionTitle
            title="Medische pauze opheffen"
            subtitle="Alleen doen als een arts je daadwerkelijk groen licht heeft gegeven."
            right={<Badge tone="serious">Actief sinds {state.medicalHold.since}</Badge>}
          />
          <p className="text-[13.5px] leading-relaxed text-ink-2">{state.medicalHold.reason}</p>
          <div className="mt-4">
            <TextArea
              value={clearance}
              onChange={(e) => setClearance(e.target.value)}
              placeholder="Wie heeft je beoordeeld, wanneer, en wat was de conclusie?"
            />
          </div>
          <Button
            variant="primary"
            className="mt-3"
            disabled={clearance.trim().length < 10}
            onClick={() => state.clearMedicalHold()}
            icon={<Play className="size-4" />}
          >
            Groen licht bevestigen en programma starten
          </Button>
          <SourceNote>Sectie 9.1, hervatten na medische beoordeling.</SourceNote>
        </Card>
      )}

      <Card delay={0.05}>
        <SectionTitle title="Je profiel" subtitle="Wat de app op dit moment over je weet." right={<ShieldCheck className="size-4 text-ink-3" />} />
        <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          <Row label="Naam" value={state.intake.name || '—'} />
          <Row label="Fase" value={phase.name} />
          <Row label="Risiconiveau" value={state.risk?.level ?? 'onbekend'} />
          <Row label="Voedingsmodel" value={state.risk?.nutritionModel === 'hoog-risico' ? 'Beschermend' : 'Standaard'} />
          <Row label="Sessies gelogd" value={String(state.sessions.length)} />
          <Row label="Metingen" value={String(state.measurements.length)} />
          <Row label="Voedingsdagen" value={String(state.nutritionDays.length)} />
          <Row label="Deloadinterval" value={`${state.risk?.safety.deloadIntervalWeeks ?? 6} weken`} />
        </dl>
      </Card>

      <Card delay={0.1}>
        <SectionTitle
          title="Je data"
          subtitle="Alles staat lokaal in je browser. Er gaat niets naar een server, en er wordt niets verkocht."
          right={<Database className="size-4 text-ink-3" />}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={download} icon={<Download className="size-4" />}>
            Exporteren als JSON
          </Button>
          <Button onClick={() => state.loadDemo()} icon={<RotateCcw className="size-4" />}>
            Demodata laden
          </Button>
          {confirmReset ? (
            <Button
              variant="danger"
              onClick={() => {
                state.resetAll()
                setConfirmReset(false)
              }}
              icon={<Trash2 className="size-4" />}
            >
              Weet je het zeker? Alles wissen
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmReset(true)} icon={<Trash2 className="size-4" />}>
              Alles verwijderen
            </Button>
          )}
        </div>
        <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
          <li>Je kunt op elk moment exporteren of verwijderen.</li>
          <li>Er is geen profilering en geen doorverkoop van gegevens.</li>
          <li>Gezondheidsdata blijft beperkt tot wat de coaching nodig heeft.</li>
        </ul>
        <SourceNote>Sectie 8.2, dataprivacy en eigenaarschap.</SourceNote>
      </Card>

      <Card delay={0.15}>
        <SectionTitle title="Wat deze app niet is" subtitle="Grenzen zijn belangrijker dan beloftes." />
        <ul className="space-y-2 text-[13.5px] leading-relaxed text-ink-2">
          <li>Geen medisch hulpmiddel. Bij rode vlaggen gaat de app op pauze en verwijst ze door.</li>
          <li>Geen diagnose. Klachten worden gevolgd en gerespecteerd, niet geduid.</li>
          <li>Geen diëtist. Bij verhoogd risico is menselijke begeleiding onderdeel van het plan.</li>
          <li>Geen garantie. De verwachte uitkomsten zijn kansverdelingen, geen beloftes.</li>
        </ul>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1.5">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="text-[13px] font-medium">{value}</dd>
    </div>
  )
}
