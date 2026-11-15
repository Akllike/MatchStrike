const counter = value => typeof value === 'number' && Number.isFinite(value) && value >= 0

export function hasCompleteMvpStats(players) {
  return players.length > 0 && players.every(player => {
    const stats = player.donutStats
    return counter(stats?.kills ?? player.kills) && counter(stats?.deaths ?? player.deaths)
      && ['assists', 'clutchWins', 'damage'].every(field => counter(stats?.[field]))
  })
}

// DonutStats: kills + assists * 0.5 + clutchWins * 2 - deaths * 0.25.
// Integer weights avoid rounding differences; ties use kills, then damage.
export function selectMatchMvp(players, { preferReported = true } = {}) {
  if (preferReported && players.some(player => player.donutStats?.isMvp !== undefined)) {
    const winners = players.filter(player => player.donutStats?.isMvp === true || player.donutStats?.isMvp === 1)
    return winners.length === 1 ? winners[0] : null
  }
  if (!hasCompleteMvpStats(players)) return null
  let winner = null
  let best = null
  let tied = false
  for (const player of players) {
    const stats = player.donutStats
    const kills = stats.kills ?? player.kills
    const deaths = stats.deaths ?? player.deaths
    const rank = [kills * 4 + stats.assists * 2 + stats.clutchWins * 8 - deaths, kills, stats.damage]
    const difference = best ? rank.map((value, index) => value - best[index]).find(value => value !== 0) ?? 0 : 1
    if (difference > 0) {
      winner = player
      best = rank
      tied = false
    } else if (difference === 0) tied = true
  }
  return tied ? null : winner
}
