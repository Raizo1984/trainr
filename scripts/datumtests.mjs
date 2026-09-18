/**
 * De tests op elke dag van de week draaien.
 *
 * Aanleiding: een test die twee sessies met drie dagen ertussen neerzette en
 * controleerde dat één set erbij te veel was. Het weekvolume telt per
 * kalenderweek, dus die twee sessies vielen soms in dezelfde week en soms niet.
 * De test slaagde vier dagen per week en faalde drie, en dat merk je pas op de
 * dag dat je iets heel anders aan het doen bent.
 *
 * Zeven achtereenvolgende dagen dekt elke plek in de week af. De jaarwisseling
 * zit erbij omdat weeknummers daar overlopen.
 *
 *   npm run test:datum
 */

import { spawnSync } from 'node:child_process'

const DAGEN = [
  '2026-03-02', // maandag
  '2026-03-03',
  '2026-03-04',
  '2026-03-05',
  '2026-03-06',
  '2026-03-07',
  '2026-03-08', // zondag
  '2026-12-31', // over de jaargrens
  '2027-01-01',
]

const mislukt = []

for (const dag of DAGEN) {
  const uitkomst = spawnSync('npx', ['vitest', 'run', '-c', 'vitest.datum.config.ts'], {
    env: { ...process.env, NEP_DATUM: dag },
    encoding: 'utf8',
  })
  const uitvoer = `${uitkomst.stdout ?? ''}${uitkomst.stderr ?? ''}`
  const regel = /^ +Tests .*$/m.exec(uitvoer)?.[0]?.trim() ?? 'geen uitslag'
  const goed = uitkomst.status === 0
  process.stdout.write(`${goed ? 'PASS  ' : 'FAIL  '}${dag}  ${regel}\n`)
  if (!goed) {
    mislukt.push(dag)
    process.stdout.write(uitvoer.split('\n').slice(-40).join('\n') + '\n')
  }
}

if (mislukt.length > 0) {
  console.error(`\nDeze datums geven een andere uitslag: ${mislukt.join(', ')}`)
  console.error('Een test die van de dag afhangt hoort vastgezet te worden, niet opnieuw gedraaid.')
  process.exit(1)
}
console.log('\nDE TESTS ZIJN NIET VAN DE DAG AFHANKELIJK')
