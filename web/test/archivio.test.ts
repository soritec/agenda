import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { ascolta, chiudiPerTest, elenca, elencaTutti, elimina, leggiImpostazioni, salva, salvaImpostazioni, salvaTanti } from '../src/dati/archivio'

beforeEach(async () => {
  await chiudiPerTest()
  await new Promise<void>((ok) => {
    const r = indexedDB.deleteDatabase('agenda')
    r.onsuccess = () => ok()
  })
})

describe('Archivio locale', () => {
  test('crea e aggiorna mantenendo id e data di creazione', async () => {
    const ente = await salva('enti', { nome: 'Ente A', tipoRapporto: 'dipendente' })
    expect(ente.id).toMatch(/^[0-9a-f-]{36}$/)
    const aggiornato = await salva('enti', { ...ente, nome: 'Ente A (sede centrale)' })
    expect(aggiornato.id).toBe(ente.id)
    expect(aggiornato.creatoIl).toBe(ente.creatoIl)
    expect(aggiornato.modificatoIl).toBeGreaterThanOrEqual(ente.modificatoIl)
    expect(await elenca('enti')).toHaveLength(1)
  })

  test('eliminazione morbida', async () => {
    const [a, b] = await salvaTanti('turni', [
      { inizio: 1, fine: 2, tipo: 'reparto', stato: 'pianificato', origine: 'manuale' },
      { inizio: 3, fine: 4, tipo: 'reparto', stato: 'pianificato', origine: 'manuale' },
    ])
    await elimina('turni', a!.id)
    expect((await elenca('turni')).map((t) => t.id)).toEqual([b!.id])
    const tutti = await elencaTutti('turni')
    expect(tutti.find((t) => t.id === a!.id)?.eliminatoIl).toBeTypeOf('number')
  })

  test('impostazioni con valori predefiniti', async () => {
    expect(await leggiImpostazioni()).toMatchObject({ sabatoFestivo: true, riposoMinimoMinuti: 660, usaReperibilita: false })
    await salvaImpostazioni({ sabatoFestivo: false })
    expect((await leggiImpostazioni()).sabatoFestivo).toBe(false)
  })

  test('notifica i cambiamenti', async () => {
    let volte = 0
    const smetti = ascolta(() => volte++)
    await salva('sedi', { nome: 'Ospedale' })
    smetti()
    await salva('sedi', { nome: 'Altra' })
    expect(volte).toBe(1)
  })
})
