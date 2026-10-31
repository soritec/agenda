import { describe, expect, test } from 'vitest'
import { leggiProgramma, righeDaDocx } from '../src/moduli/specializzazione/programma'
import { consultoriDaScegliere, leggiSediConsultorio } from '../src/moduli/turni/consultorio'
import { istante } from '../src/nucleo/calendario'

describe('programmi di lezioni e riunioni', () => {
  test('tabella con intestazione: data, sede, argomento, responsabile', () => {
    const righe = [['RIUNIONI NOVEMBRE 2026'], ['Data/ora', 'Sede', 'Argomento', 'responsabile'], ['9/11', 'Aula A', 'Tesi', ''], ['16/11 ore 14.30', 'Aula B', 'Protocollo nuovo', 'Rossi, Bianchi'], ['31/11', 'Aula', 'Data impossibile', '']]
    expect(leggiProgramma(righe, 'x.docx', 2020)).toEqual([
      { giorno: '2026-11-09', titolo: 'Tesi', sede: 'Aula A', responsabile: undefined },
      { giorno: '2026-11-16', titolo: 'Protocollo nuovo', sede: 'Aula B', responsabile: 'Rossi, Bianchi', minuto: 870 },
    ])
  })

  test('senza intestazione: la data ovunque e il testo più lungo come titolo', () => {
    expect(leggiProgramma([['12 novembre', 'Lezione di ecografia', 'Aula']], 'turni dicembre 2027.pdf', 2020).map((v) => [v.giorno, v.titolo])).toEqual([['2027-11-12', 'Lezione di ecografia']])
  })

  test('legge le tabelle di Word', () => {
    const xml = '<w:p><w:r><w:t>Titolo &amp; mese</w:t></w:r></w:p><w:tbl><w:tr w:x="1"><w:tc><w:p><w:t>9/11</w:t></w:p></w:tc><w:tc><w:p><w:t xml:space="preserve">Aula </w:t><w:t>A</w:t></w:p></w:tc></w:tr></w:tbl>'
    expect(righeDaDocx(xml)).toEqual([['Titolo & mese'], ['9/11', 'Aula A']])
  })
})

describe('consultorio', () => {
  test('legge le righe delle sedi', () => {
    expect(leggiSediConsultorio('lunedì; Sede A; 8:30; 16:00; Rossi\nvenerdi; Sede B\nriga sbagliata')).toEqual([
      { giorno: 1, nome: 'Sede A', inizio: 510, fine: 960, nota: 'Rossi' },
      { giorno: 5, nome: 'Sede B', inizio: undefined, fine: undefined, nota: undefined },
    ])
  })

  test('chiede solo oggi e domani, se manca la sede', () => {
    const oggi = { anno: 2026, mese: 11, giorno: 22 }
    const m = new Map([['c', { sigla: 'Cs', nome: 'Consultorio' }], ['a', { sigla: 'ECO', nome: 'Eco' }]])
    const t = (id: string, giorno: number, modelloId = 'c', sedeId?: string) => ({ id, inizio: istante(2026, 11, giorno, 0), modelloId, sedeId })
    expect(consultoriDaScegliere([t('sì', 23), t('oggi', 22), t('dopo', 24), t('eco', 23, 'a'), t('fatto', 23, 'c', 's')], m, oggi, ['oggi']).map((x) => x.id)).toEqual(['sì'])
  })
})
