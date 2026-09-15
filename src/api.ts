/**
 * Eén plek voor alle aanroepen naar onze eigen server.
 *
 * Elk verzoek dat iets wijzigt draagt een eigen kopregel. Een formulier op een
 * andere website kan wel een verzoek naar ons sturen met jouw cookie erbij,
 * maar geen eigen kopregel meesturen: daarvoor is een fetch nodig, en die
 * wordt door de browser eerst bij ons nagevraagd. Zo kan niemand jou
 * ongemerkt iets laten doen dat je niet wilde.
 *
 * Staat dit op meerdere plekken los in de code, dan vergeet je het bij de
 * volgende aanroep en krijg je een 403 waar niemand de oorzaak van ziet.
 */

export const CLIENT_HEADER = 'X-Trainr-Client'

export async function apiFetch(pad: string, opties: RequestInit = {}): Promise<Response> {
  const headers = new Headers(opties.headers)
  headers.set(CLIENT_HEADER, '1')
  if (opties.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(pad, {
    ...opties,
    headers,
    // De sessiecookie hoort mee te gaan, ook bij een fetch.
    credentials: 'same-origin',
  })
}

/** Verstuurt JSON en leest JSON terug. */
export async function apiJson<T>(
  pad: string,
  opties: RequestInit & { json?: unknown } = {},
): Promise<{ status: number; body: T }> {
  const { json, ...rest } = opties
  const response = await apiFetch(pad, {
    ...rest,
    body: json === undefined ? rest.body : JSON.stringify(json),
  })
  const tekst = await response.text()
  let body: unknown = null
  try {
    body = tekst ? JSON.parse(tekst) : null
  } catch {
    body = null
  }
  return { status: response.status, body: body as T }
}
