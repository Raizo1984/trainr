/**
 * Praten met de accounteindpunten.
 *
 * Alleen het verkeer; wat er met de gegevens gebeurt staat in sync.ts en de
 * schermen. Foutmeldingen komen van de server, want daar staat waarom iets
 * niet mocht, en er een eigen tekst over verzinnen levert alleen verwarring op.
 */

import { apiJson } from '@/api'

export interface AccountStatus {
  accountsMogelijk: boolean
  toestemmingVersie: string
  gebruiker: { email: string; toestemmingVersie: string | null } | null
}

export interface ServerStaat {
  versie: number
  data: unknown
  bijgewerktOp?: string
}

export class AccountFout extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
  }
}

type Antwoord = { message?: string; error?: string }

function fout(status: number, body: Antwoord | null): AccountFout {
  return new AccountFout(body?.message ?? 'Er ging iets mis.', body?.error ?? 'onbekend', status)
}

export async function status(): Promise<AccountStatus> {
  try {
    const { status: code, body } = await apiJson<AccountStatus>('/api/account')
    if (code !== 200 || !body) {
      return { accountsMogelijk: false, toestemmingVersie: '', gebruiker: null }
    }
    return body
  } catch {
    // Geen server bereikbaar. De app werkt lokaal door.
    return { accountsMogelijk: false, toestemmingVersie: '', gebruiker: null }
  }
}

export async function registreer(email: string, wachtwoord: string, toestemming: boolean): Promise<void> {
  const { status: code, body } = await apiJson<Antwoord>('/api/account/registreren', {
    method: 'POST',
    json: { email, wachtwoord, toestemming },
  })
  if (code !== 201) throw fout(code, body)
}

export async function inloggen(email: string, wachtwoord: string): Promise<void> {
  const { status: code, body } = await apiJson<Antwoord>('/api/account/inloggen', {
    method: 'POST',
    json: { email, wachtwoord },
  })
  if (code !== 200) throw fout(code, body)
}

export async function uitloggen(): Promise<void> {
  await apiJson('/api/account/uitloggen', { method: 'POST' })
}

export async function wijzigWachtwoord(huidig: string, nieuw: string): Promise<number> {
  const { status: code, body } = await apiJson<Antwoord & { andereApparatenUitgelogd?: number }>(
    '/api/account/wachtwoord',
    { method: 'POST', json: { huidig, nieuw } },
  )
  if (code !== 200) throw fout(code, body)
  return body?.andereApparatenUitgelogd ?? 0
}

export async function verwijderAccount(): Promise<void> {
  const { status: code, body } = await apiJson<Antwoord>('/api/account/verwijderen', {
    method: 'POST',
    json: { bevestiging: 'VERWIJDER' },
  })
  if (code !== 200) throw fout(code, body)
}

export async function haalStaat(): Promise<ServerStaat> {
  const { status: code, body } = await apiJson<ServerStaat & Antwoord>('/api/account/staat')
  if (code !== 200 || !body) throw fout(code, body)
  return { versie: body.versie, data: body.data, bijgewerktOp: body.bijgewerktOp }
}

export type BewaarUitkomst =
  | { ok: true; versie: number }
  | { ok: false; conflict: true; huidige: ServerStaat }

export async function bewaarStaat(data: unknown, versie: number): Promise<BewaarUitkomst> {
  const { status: code, body } = await apiJson<{ versie?: number; huidige?: ServerStaat } & Antwoord>(
    '/api/account/staat',
    { method: 'PUT', json: { data, versie } },
  )

  if (code === 409 && body?.huidige) {
    return { ok: false, conflict: true, huidige: body.huidige }
  }
  if (code !== 200 || typeof body?.versie !== 'number') throw fout(code, body)
  return { ok: true, versie: body.versie }
}

/* ------------------------------------------------------------------ */
/* Wachtwoord vergeten                                                 */
/* ------------------------------------------------------------------ */

export async function herstelMogelijk(): Promise<boolean> {
  try {
    const { status: code, body } = await apiJson<{ mogelijk?: boolean }>('/api/account/herstel-mogelijk')
    return code === 200 && body?.mogelijk === true
  } catch {
    return false
  }
}

export async function vraagHerstel(email: string): Promise<string> {
  const { status: code, body } = await apiJson<Antwoord>('/api/account/wachtwoord-vergeten', {
    method: 'POST',
    json: { email },
  })
  if (code !== 200) throw fout(code, body)
  return body?.message ?? 'Als er een account bij dit adres hoort, is er een herstellink onderweg.'
}

export async function zetNieuwWachtwoord(token: string, wachtwoord: string): Promise<string> {
  const { status: code, body } = await apiJson<Antwoord>('/api/account/wachtwoord-herstellen', {
    method: 'POST',
    json: { token, wachtwoord },
  })
  if (code !== 200) throw fout(code, body)
  return body?.message ?? 'Je wachtwoord is gewijzigd.'
}
