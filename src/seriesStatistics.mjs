const additiveFields = [
  'headshots', 'assists', 'damage', 'damageTaken', 'rounds', 'roundsWithKill',
  'killsInWonRounds', 'killsInSurvivedRounds', 'roundWinContributionRounds', 'kastRounds',
  'multikills', 'tripleKills', 'quadKills', 'aceKills', 'clutchWins', 'clutchAttempts',
  'roundsWon', 'roundsLost', 'openingAttempts', 'openingKills', 'openingDeaths',
  'openingDeathsTraded', 'openingTimeTotalMs', 'openingTimeSamples', 'lastAliveRounds',
  'postPlantRounds', 'alivePostPlantRounds', 'roundsWithSniper', 'roundsWithAWP',
  'sniperKills', 'awpKills', 'smokesThrown', 'flashesThrown', 'molotovsThrown',
  'heGrenadesThrown', 'tradeableDeaths', 'deathsTraded', 'tradeKills', 'tradeOpportunities',
  'tradeDenials', 'baitAssists', 'baitKills', 'killsAssisted', 'timeAliveSeconds', 'weaponAttacks',
]
const numeric = value => typeof value === 'number' && Number.isFinite(value)
const nameKey = name => (name ?? '').trim().toLocaleLowerCase()

export function aggregateSeriesPlayers(maps, teamAName, teamBName) {
  const totals = new Map()
  for (const map of maps) {
    for (const [side, team, players] of [['CT', map.teamCt, map.playersCt], ['T', map.teamT, map.playersT]]) {
      for (const player of players) {
        const teamName = nameKey(team.name)
        const stableSide = teamName && teamName === nameKey(teamAName) ? 'CT' : teamName && teamName === nameKey(teamBName) ? 'T' : side
        const key = player.steamId ? `steam:${player.steamId}` : player.account ? `account:${player.account.id}` : `name:${stableSide}:${nameKey(player.name)}`
        let current = totals.get(key)
        if (!current) {
          current = { ...player, side: stableSide, kills: null, deaths: null, donutStats: null }
          totals.set(key, current)
        }
        const stats = player.donutStats
        for (const field of ['kills', 'deaths']) {
          const value = numeric(stats?.[field]) ? stats[field] : player[field]
          if (numeric(value)) current[field] = (current[field] ?? 0) + value
        }
        if (stats) {
          if (!current.donutStats) {
            current.donutStats = structuredClone(stats)
            for (const field of additiveFields) delete current.donutStats[field]
            delete current.donutStats.weapons
            delete current.donutStats.clutchesByX
          }
          for (const field of additiveFields) {
            if (numeric(stats[field])) current.donutStats[field] = (current.donutStats[field] ?? 0) + stats[field]
          }
          for (const [field, identity, counters] of [
            ['weapons', 'id', ['shots', 'hits', 'damage', 'kills', 'headshots', 'rounds']],
            ['clutchesByX', 'opponents', ['wins', 'attempts']],
          ]) {
            if (!Array.isArray(stats[field])) continue
            const merged = new Map((current.donutStats[field] ?? []).map(item => [item[identity], item]))
            for (const item of stats[field]) {
              const sum = merged.get(item[identity]) ?? { [identity]: item[identity] }
              for (const counter of counters) if (numeric(item[counter])) sum[counter] = (sum[counter] ?? 0) + item[counter]
              merged.set(item[identity], sum)
            }
            current.donutStats[field] = [...merged.values()]
          }
        }
        if (current.donutStats) {
          current.donutStats.kills = current.kills
          current.donutStats.deaths = current.deaths
        }
      }
    }
  }
  return [
    { side: 'CT', name: teamAName || 'Спецназ', players: [...totals.values()].filter(player => player.side === 'CT') },
    { side: 'T', name: teamBName || 'Террористы', players: [...totals.values()].filter(player => player.side === 'T') },
  ]
}
