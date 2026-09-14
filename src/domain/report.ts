/**
 * Nalezen of een geschreven rapport bij de cijfers blijft.
 *
 * Een taalmodel dat een week samenvat, schrijft moeiteloos "je opkomst ging van
 * 60 naar 85 procent" terwijl geen van beide getallen in je data staat. Dat
 * leest prettig en is onwaar, en juist bij een rapport over je eigen
 * vooruitgang is dat de ergste fout die je kunt maken: het is niet te
 * onderscheiden van de waarheid zonder de bron ernaast te leggen.
 *
 * Daarom wordt elk getal in de tekst teruggezocht in de meegestuurde data.
 * Staat het er niet bij, dan gaat het rapport niet naar het scherm.
 */

/** Alle getallen die ergens in de meegestuurde data voorkomen. */
export function verzamelGetallen(data: unknown, uit = new Set<number>()): Set<number> {
  if (typeof data === 'number' && Number.isFinite(data)) {
    uit.add(data)
    // Een verhouding mag het model als percentage opschrijven.
    if (data > 0 && data <= 1) uit.add(Math.round(data * 100))
    // Afgerond noemen mag ook: 4.7 sessies wordt 5.
    uit.add(Math.round(data))
  } else if (typeof data === 'string') {
    for (const m of data.matchAll(/-?\d+(?:[.,]\d+)?/g)) {
      const n = Number(m[0].replace(',', '.'))
      if (Number.isFinite(n)) {
        uit.add(n)
        uit.add(Math.round(n))
      }
    }
  } else if (Array.isArray(data)) {
    for (const item of data) verzamelGetallen(item, uit)
  } else if (data && typeof data === 'object') {
    for (const waarde of Object.values(data)) verzamelGetallen(waarde, uit)
  }
  return uit
}

/**
 * Getallen in de tekst die niet in de data voorkomen.
 *
 * Jaartallen en datums blijven buiten beschouwing: die schrijft het model uit
 * de context van het gesprek, niet uit je metingen.
 */
export function ongedekteGetallen(tekst: string, toegestaan: Set<number>): number[] {
  const uit: number[] = []
  for (const m of tekst.matchAll(/-?\d+(?:[.,]\d+)?/g)) {
    const n = Number(m[0].replace(',', '.'))
    if (!Number.isFinite(n)) continue
    if (n >= 1900 && n <= 2200 && Number.isInteger(n)) continue
    if (toegestaan.has(n)) continue
    if (!uit.includes(n)) uit.push(n)
  }
  return uit
}

export interface RapportControle {
  ok: boolean
  ongedekt: number[]
}

export function controleerRapport(tekst: string, data: unknown): RapportControle {
  const ongedekt = ongedekteGetallen(tekst, verzamelGetallen(data))
  return { ok: ongedekt.length === 0, ongedekt }
}
