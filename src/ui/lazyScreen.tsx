/**
 * Lui geladen scherm dat na het voorladen geen wachtmoment meer geeft.
 *
 * `React.lazy` alleen is hier niet genoeg. Ook als de browser de code al in het
 * geheugen heeft, onderbreekt lazy de eerste weergave één keer, en dan ruilt
 * Suspense het vorige scherm in voor een skelet. Bij een tabwissel zag je zo
 * een kwart seconde een lege pagina, terwijl er niets meer op te halen viel.
 *
 * Daarom onthoudt deze wikkel de module zelf. Is die al binnen, dan wordt het
 * echte scherm meteen weergegeven en onderbreekt er niets. Is die er nog niet,
 * dan valt hij terug op `React.lazy` en doet Suspense gewoon zijn werk.
 */

import { createElement, lazy } from 'react'
import type { ComponentType } from 'react'

type Loader<P> = () => Promise<{ default: ComponentType<P> }>

export type LazyScreen<P> = ComponentType<P> & { preload: () => Promise<unknown> }

export function lazyScreen<P extends object>(load: Loader<P>): LazyScreen<P> {
  let loaded: ComponentType<P> | null = null
  const Fallback = lazy(load)

  const preload = () =>
    load()
      .then((m) => {
        loaded = m.default
        return m
      })
      // Mislukt het voorladen, dan probeert Suspense het later gewoon opnieuw.
      .catch(() => undefined)

  const Screen = (props: P) => createElement(loaded ?? Fallback, props)
  return Object.assign(Screen, { preload })
}
