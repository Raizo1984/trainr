/**
 * De klok vastzetten voor een testronde.
 *
 * Deze app rekent overal met datums: weekvolume per kalenderweek, "hoeveel
 * weken geleden", opbouwsnelheid. Een test die daarop leunt kan maandag
 * slagen en donderdag falen, en dan zoek je het later terug als een fout in de
 * code die er niet is. Zie `scripts/datumtests.mjs`.
 */

import { beforeEach, vi } from 'vitest'

const dag = process.env.NEP_DATUM

beforeEach(() => {
  if (!dag) return
  // Alleen Date vervangen, niet de timers: die worden elders wel gebruikt.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${dag}T09:00:00Z`))
})
