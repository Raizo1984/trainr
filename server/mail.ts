/**
 * E-mail versturen.
 *
 * Eén functie, drie mogelijke uitgangen, gekozen met een omgevingsvariabele:
 *
 * - `RESEND_API_KEY`: versturen via Resend, een gewone HTTP-aanroep zonder
 *   extra pakket.
 * - `MAIL_LOGBOEK=aan`: niet versturen maar in het logboek zetten. Handig bij
 *   ontwikkelen en in tests.
 * - niets ingesteld: de app zegt eerlijk dat wachtwoordherstel uitstaat, in
 *   plaats van te doen alsof er een mail onderweg is.
 *
 * Dat laatste is het punt. Een herstelmail die nergens aankomt terwijl het
 * scherm zegt "kijk in je inbox" laat iemand een uur zoeken naar iets dat niet
 * bestaat.
 */

export type MailUitgang = 'resend' | 'logboek' | 'uit'

export function mailUitgang(): MailUitgang {
  if (process.env.RESEND_API_KEY) return 'resend'
  if (process.env.MAIL_LOGBOEK === 'aan') return 'logboek'
  return 'uit'
}

export function mailBeschikbaar(): boolean {
  return mailUitgang() !== 'uit'
}

/** Afzender. Bij Resend moet dit domein daar geverifieerd zijn. */
function afzender(): string {
  return process.env.MAIL_AFZENDER ?? 'Trainr <onboarding@resend.dev>'
}

export interface Bericht {
  aan: string
  onderwerp: string
  tekst: string
  html: string
}

export async function verstuur(bericht: Bericht): Promise<void> {
  const uitgang = mailUitgang()

  if (uitgang === 'uit') {
    throw new Error('Er is geen e-maildienst ingesteld.')
  }

  if (uitgang === 'logboek') {
    console.log('\n--- e-mail (niet verstuurd, alleen gelogd) ---')
    console.log('aan        :', bericht.aan)
    console.log('onderwerp  :', bericht.onderwerp)
    console.log(bericht.tekst)
    console.log('--- einde ---\n')
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: afzender(),
      to: [bericht.aan],
      subject: bericht.onderwerp,
      text: bericht.tekst,
      html: bericht.html,
    }),
  })

  if (!res.ok) {
    const uitleg = await res.text().catch(() => '')
    throw new Error(`Versturen mislukte (${res.status}): ${uitleg.slice(0, 200)}`)
  }
}

/**
 * De herstelmail.
 *
 * Kort, zonder opsmuk en zonder plaatjes. Wat er staat moet ook leesbaar zijn
 * in een mailprogramma dat geen HTML toont, en het moet niet lijken op de
 * phishing waar dit soort mails op lijkt.
 */
export function herstelBericht(aan: string, link: string, geldigMinuten: number): Bericht {
  const tekst = [
    'Je hebt een nieuw wachtwoord aangevraagd voor Trainr.',
    '',
    `Open deze link om er een in te stellen: ${link}`,
    '',
    `De link werkt ${geldigMinuten} minuten en daarna niet meer.`,
    '',
    'Heb je dit niet aangevraagd, dan hoef je niets te doen. Je wachtwoord blijft',
    'zoals het was en niemand heeft toegang gekregen.',
  ].join('\n')

  const html = `<!doctype html><html lang="nl"><body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#111">
<p>Je hebt een nieuw wachtwoord aangevraagd voor Trainr.</p>
<p><a href="${link}" style="display:inline-block;background:#5b4fd6;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Nieuw wachtwoord instellen</a></p>
<p style="color:#555">De link werkt ${geldigMinuten} minuten en daarna niet meer.</p>
<p style="color:#555">Heb je dit niet aangevraagd, dan hoef je niets te doen. Je wachtwoord blijft zoals het was en niemand heeft toegang gekregen.</p>
<p style="color:#888;font-size:13px">Werkt de knop niet, plak dan deze link in je browser:<br>${link}</p>
</body></html>`

  return { aan, onderwerp: 'Nieuw wachtwoord voor Trainr', tekst, html }
}
