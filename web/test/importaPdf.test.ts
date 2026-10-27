import { describe, expect, it } from 'vitest'
import { leggiTurni, meseDelFile, meseDelNome, modelloPerSigla, type PezzoTesto } from '../src/moduli/turni/importaPdf'

/** Tabella finta: righe di caselle a colonne fisse (x = 40 + 80·i), una riga ogni 20 punti. */
function tabella(righe: string[][], pagina = 1, y0 = 100): PezzoTesto[] {
  return righe.flatMap((r, i) => r.flatMap((testo, j) => (testo ? [{ testo, x: 40 + 80 * j, y: y0 + 20 * i, larghezza: testo.length * 5, pagina }] : [])))
}

describe('lettura dei turni dal PDF', () => {
  const titolo: PezzoTesto = { testo: 'Novembre 2026', x: 250, y: 60, larghezza: 100, pagina: 1 }

  it('trova il mese', () => {
    expect(meseDelFile([titolo])).toBe('2026-11')
  })

  it('nome nelle caselle: la sigla viene dalla colonna (G / N)', () => {
    const pezzi = [titolo, ...tabella([
      ['', 'Gruppo A G', 'Gruppo B G', 'Gruppo A N', 'Gruppo B N'],
      ['Domenica 1', 'Rossi', 'Bianchi', 'Verdi', 'Neri'],
      ['Lunedì 2', 'Bianchi', 'Rossi R.', 'Rossi', 'Gialli'],
      ['Martedì 3', 'Verdi', 'Gialli', 'Bianchi', 'Rossi'],
    ])]
    expect(leggiTurni(pezzi, ['rossi']).turni).toEqual([
      { giorno: '2026-11-01', sigla: 'G', colonna: 'Gruppo A G' },
      { giorno: '2026-11-02', sigla: 'N', colonna: 'Gruppo A N' },
      { giorno: '2026-11-03', sigla: 'N', colonna: 'Gruppo B N' },
    ])
  })

  it('colonna per persona: la sigla è nella casella, lo smonto si salta', () => {
    const pezzi = [titolo, ...tabella([['ALTRA TABELLA'], ['', 'Rossi', 'Bianchi'], ['Lunedì 2', '', 'GSP'], ['Martedì 3', 'NSP', ''], ['Mercoledì 4', 'smo', 'GSP']], 2)]
    expect(leggiTurni(pezzi, ['Rossi']).turni).toEqual([{ giorno: '2026-11-03', sigla: 'NSP', colonna: 'Rossi' }])
  })

  it('senza mese o senza nome non trova niente', () => {
    const pezzi = tabella([['', 'Rossi'], ['Lunedì 2', 'G']])
    expect(leggiTurni(pezzi, ['Rossi']).turni).toEqual([])
    expect(leggiTurni([titolo, ...pezzi], []).turni).toEqual([])
  })

  it('collega la sigla al turno tipo', () => {
    expect(modelloPerSigla('gsp', [{ sigla: 'G' }, { sigla: 'GSP' }])).toEqual({ sigla: 'GSP' })
  })
})

describe('mese dal nome del file', () => {
  it('legge mese e anno', () => {
    expect(meseDelNome('Guardie novembre 2026.docx.pdf')).toBe('2026-11')
    expect(meseDelNome('turni_Dicembre.pdf', 2026)).toBe('2026-12')
    expect(meseDelNome('turni.pdf', 2026)).toBeUndefined()
  })
})

describe('file dei turni per mese', () => {
  it('raggruppa per mese del nome o del caricamento', async () => {
    const { fileTurniPerMese } = await import('../src/moduli/turni/fileTurni')
    const ott = Date.parse('2026-10-27T12:00:00Z')
    const g = fileTurniPerMese([
      { nome: 'Guardie novembre 2026.pdf', creatoIl: ott, collegatoA: 'file-turni' },
      { nome: 'turni.pdf', creatoIl: ott + 1, collegatoA: 'file-turni' },
      { nome: 'Turni novembre.pdf', creatoIl: ott + 2, collegatoA: 'file-turni' },
      { nome: 'altro.pdf', creatoIl: ott, collegatoA: 'procedura:1' },
    ])
    expect(g.map((x) => [x.mese, x.file.map((f) => f.nome)])).toEqual([
      ['2026-11', ['Turni novembre.pdf', 'Guardie novembre 2026.pdf']],
      ['2026-10', ['turni.pdf']],
    ])
  })
})
