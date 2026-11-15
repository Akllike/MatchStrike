import test from 'node:test'
import assert from 'node:assert/strict'
import { hasCompleteMvpStats, selectMatchMvp } from '../src/matchMvp.mjs'
import { aggregateSeriesPlayers } from '../src/seriesStatistics.mjs'
import { reactive } from 'vue'

const player = (name, stats = {}) => ({ name, steamId: name, kills: 10, deaths: 10,
  donutStats: { kills: 10, deaths: 10, assists: 0, clutchWins: 0, damage: 1000, ...stats } })

test('uses the actual plugin MVP even when another player has more kills', () => {
  const players = [player('fragger', { kills: 30, isMvp: false }), player('mvp', { isMvp: true })]
  assert.equal(selectMatchMvp(players), players[1])
})

test('legacy calculation includes assists, clutches and death penalty', () => {
  const players = [player('fragger', { kills: 20 }), player('support', { kills: 18, assists: 5, clutchWins: 1 })]
  assert.equal(selectMatchMvp(players), players[1])
  assert.equal(selectMatchMvp([player('negative', { kills: 0, deaths: 20 }), player('less-negative', { kills: 0, deaths: 10 })]).name, 'less-negative')
})

test('breaks ties by kills then damage, leaves exact legacy ties unknown', () => {
  const a = player('a', { kills: 11, deaths: 14 })
  const b = player('b')
  assert.equal(selectMatchMvp([b, a]), a)
  const c = player('c', { damage: 1001 })
  assert.equal(selectMatchMvp([b, c]), c)
  assert.equal(selectMatchMvp([b, player('tie')]), null)
  assert.equal(selectMatchMvp([b, player('tie'), c]), c)
})

test('does not invent MVP when statistics are missing or flags are ambiguous', () => {
  assert.equal(selectMatchMvp([]), null)
  assert.equal(selectMatchMvp([player('a'), { name: 'unknown', kills: 0, deaths: 0 }]), null)
  for (const value of [undefined, null, NaN, -1, '5']) {
    assert.equal(hasCompleteMvpStats([player('a', { damage: value })]), false)
  }
  assert.equal(selectMatchMvp([player('a', { isMvp: false })]), null)
  assert.equal(selectMatchMvp([player('a', { isMvp: true }), player('b', { isMvp: true })]), null)
})

test('series winner is calculated from totals, not a copied map MVP flag', () => {
  const maps = [
    { teamCt: { name: 'A' }, teamT: { name: 'B' }, playersCt: [player('a', { kills: 20, isMvp: true })], playersT: [player('b', { kills: 19, isMvp: false })] },
    { teamCt: { name: 'B' }, teamT: { name: 'A' }, playersCt: [player('b', { kills: 25, isMvp: true })], playersT: [player('a', { kills: 10, isMvp: false })] },
  ]
  const totals = aggregateSeriesPlayers(reactive(maps), 'A', 'B').flatMap(team => team.players)
  assert.equal(selectMatchMvp(totals, { preferReported: false }).name, 'b')
  assert.equal(selectMatchMvp([...maps[0].playersCt, ...maps[0].playersT]).name, 'a')
})
