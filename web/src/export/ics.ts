import { componenti } from '../nucleo/calendario'

/**
 * File calendario (.ics, standard iCalendar) da aprire con il Calendario di Apple, Google ecc.
 * Ogni evento ha un identificativo stabile: importando di nuovo, il Calendario riconosce lo stesso evento.
 */
export interface EventoIcs {
  uid: string
  titolo: string
  inizio: number
  fine: number
  tuttoIlGiorno?: boolean
  luogo?: string
  note?: string
  modificatoIl?: number
}

const due = (n: number) => String(n).padStart(2, '0')

function utc(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${due(d.getUTCMonth() + 1)}${due(d.getUTCDate())}T${due(d.getUTCHours())}${due(d.getUTCMinutes())}${due(d.getUTCSeconds())}Z`
}

/** Data (senza ora) nel giorno italiano dell'istante. */
function data(ms: number): string {
  const c = componenti(ms)
  return `${c.anno}${due(c.mese)}${due(c.giorno)}`
}

export function escapeIcs(testo: string): string {
  return testo.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Righe oltre 75 byte vanno spezzate (RFC 5545), con uno spazio all'inizio della continuazione. */
export function piega(riga: string): string {
  const byte = new TextEncoder()
  if (byte.encode(riga).length <= 75) return riga
  const parti: string[] = []
  let corrente = ''
  for (const ch of riga) {
    if (byte.encode(corrente + ch).length > (parti.length ? 74 : 75)) {
      parti.push(corrente)
      corrente = ''
    }
    corrente += ch
  }
  parti.push(corrente)
  return parti.join('\r\n ')
}

export function creaIcs(eventi: EventoIcs[], nomeCalendario: string, adesso = Date.now()): string {
  const righe = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agenda//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(nomeCalendario)}`, 'X-WR-TIMEZONE:Europe/Rome',
  ]
  for (const e of eventi) {
    const modificato = e.modificatoIl ?? adesso
    righe.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${utc(adesso)}`, `LAST-MODIFIED:${utc(modificato)}`, `SEQUENCE:${Math.floor(modificato / 1000)}`)
    if (e.tuttoIlGiorno) righe.push(`DTSTART;VALUE=DATE:${data(e.inizio)}`, `DTEND;VALUE=DATE:${data(e.fine)}`, 'TRANSP:TRANSPARENT')
    else righe.push(`DTSTART:${utc(e.inizio)}`, `DTEND:${utc(e.fine)}`)
    righe.push(`SUMMARY:${escapeIcs(e.titolo)}`)
    if (e.luogo) righe.push(`LOCATION:${escapeIcs(e.luogo)}`)
    if (e.note) righe.push(`DESCRIPTION:${escapeIcs(e.note)}`)
    righe.push('END:VEVENT')
  }
  righe.push('END:VCALENDAR')
  return righe.map(piega).join('\r\n') + '\r\n'
}
