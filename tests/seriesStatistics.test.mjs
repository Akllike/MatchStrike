import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateSeriesPlayers } from '../src/seriesStatistics.mjs'

const player = (extra = {}) => ({ name: 'Player', steamId: 'account:1:12345', kills: 10, deaths: 5, account: null, donutStats: null, ...extra })
const map = (playersCt, playersT = [], teamCt = 'Alpha', teamT = 'Beta') => ({ map: 'de_dust2', mapIndex: 1, playersCt, playersT, teamCt: { name: teamCt, score: 13 }, teamT: { name: teamT, score: 11 } })
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze) }
  return value
}

test('series totals include kills and deaths from detailed data without mutating maps', () => {
  const maps = freeze([
    map([player({ donutStats: { kills: 20, deaths: 10, headshots: 8, damage: 2000, rounds: 24 } })]),
    map([player({ donutStats: { kills: 30, deaths: 15, headshots: 12, damage: 3000, rounds: 26 } })]),
  ])
  const original = structuredClone(maps)
  for (let i = 0; i < 3; i++) {
    const total = aggregateSeriesPlayers(maps, 'Alpha', 'Beta')[0].players[0]
    assert.equal(total.kills, 50)
    assert.equal(total.deaths, 25)
    assert.equal(total.donutStats.kills, 50)
    assert.equal(total.donutStats.deaths, 25)
    assert.equal(total.donutStats.headshots, 20)
    assert.equal(total.donutStats.damage / total.donutStats.rounds, 100)
    assert.deepEqual(maps, original)
  }
})

test('the same player remains in the same team when CT and T switch across maps', () => {
  const maps = [map([player()]), map([], [player({ name: 'Renamed' })], 'Beta', 'Alpha')]
  const teams = aggregateSeriesPlayers(maps, 'Alpha', 'Beta')
  assert.equal(teams[0].players.length, 1)
  assert.equal(teams[0].players[0].kills, 20)
  assert.equal(teams[1].players.length, 0)
})

test('different Steam accounts with identical nicknames are not merged', () => {
  const teams = aggregateSeriesPlayers([map([player(), player({ steamId: 'account:0:5' })])], 'Alpha', 'Beta')
  assert.equal(teams[0].players.length, 2)
})

test('legacy players with identical names on opposing teams remain separate', () => {
  const teams = aggregateSeriesPlayers([map([player({ steamId: null })], [player({ steamId: null })])], 'Alpha', 'Beta')
  assert.equal(teams[0].players.length, 1)
  assert.equal(teams[1].players.length, 1)
})

test('mixed detailed and legacy maps retain all known kills and deaths in either order', () => {
  const detailed = map([player({ donutStats: { kills: 20, deaths: 10, headshots: 8 } })])
  const legacy = map([player({ kills: 7, deaths: 9 })])
  for (const maps of [[detailed, legacy], [legacy, detailed]]) {
    const total = aggregateSeriesPlayers(maps, 'Alpha', 'Beta')[0].players[0]
    assert.equal(total.kills, 27)
    assert.equal(total.deaths, 19)
    assert.equal(total.donutStats.kills, 27)
    assert.equal(total.donutStats.headshots, 8)
  }
})

test('missing stats stay unavailable rather than becoming zero', () => {
  const total = aggregateSeriesPlayers([map([player({ kills: null, deaths: null })])], 'Alpha', 'Beta')[0].players[0]
  assert.equal(total.kills, null)
  assert.equal(total.deaths, null)
  assert.equal(total.donutStats, null)
  assert.deepEqual(aggregateSeriesPlayers([], 'Alpha', 'Beta').map(team => team.players), [[], []])
})

test('weapon and clutch counters are summed separately without changing their source arrays', () => {
  const stats = { weapons: [{ id: 'ak47', shots: 30, kills: 2 }], clutchesByX: [{ opponents: 2, wins: 1, attempts: 2 }] }
  const maps = freeze([map([player({ donutStats: stats })]), map([player({ donutStats: stats })])])
  const total = aggregateSeriesPlayers(maps, 'Alpha', 'Beta')[0].players[0]
  assert.deepEqual(total.donutStats.weapons, [{ id: 'ak47', shots: 60, kills: 4 }])
  assert.deepEqual(total.donutStats.clutchesByX, [{ opponents: 2, wins: 2, attempts: 4 }])
  assert.equal(stats.weapons[0].shots, 30)
})
