import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { ascolta, chiudiPerTest, elenca, elencaTutti, elimina, leggiImpostazioni, ripristina, salva, salvaImpostazioni, salvaTanti } from '../src/dati/archivio'

beforeEach(async () => {
  await chiudiPerTest()
  await new Promise<void>((ok) => {
    const r = indexedDB.deleteDatabase('agenda')
    r.onsuccess = () => ok()
  })
})

describe('Archivio locale', () => {
  test('crea e aggiorna mantenendo id e data di creazione', async () => {
    const sede = await salva('sedi', { nome: 'Sede A' })
    expect(sede.id).toMatch(/^[0-9a-f-]{36}$/)
    const aggiornato = await salva('sedi', { ...sede, nome: 'Sede A (padiglione 2)' })
    expect(aggiornato.id).toBe(sede.id)
    expect(aggiornato.creatoIl).toBe(sede.creatoIl)
    expect(aggiornato.modificatoIl).toBeGreaterThanOrEqual(sede.modificatoIl)
    expect(await elenca('sedi')).toHaveLength(1)
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
    expect(await leggiImpostazioni()).toMatchObject({ sabatoFestivo: true })
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

  test('archivio dei periodi di rotazione (versione 2)', async () => {
    await salva('periodiRotazione', { meseInizio: '2026-10', area: 'ostetricia' })
    expect(await elenca('periodiRotazione')).toHaveLength(1)
  })

  test('ferie ed eliminazione annullabile', async () => {
    const f = await salva('ferie', { giorno: '2026-10-21' })
    await elimina('ferie', f.id)
    expect(await elenca('ferie')).toHaveLength(0)
    await ripristina('ferie', f.id)
    const ripristinate = await elenca('ferie')
    expect(ripristinate.map((x) => x.giorno)).toEqual(['2026-10-21'])
    expect(ripristinate[0]!.eliminatoIl).toBeUndefined()
  })
})
