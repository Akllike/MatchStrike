import type { GameMatchDetails, MatchPlayer } from './api'
export function aggregateSeriesPlayers(maps: GameMatchDetails['seriesPlayerStats'], teamAName?: string | null, teamBName?: string | null): { side: string; name: string; players: MatchPlayer[] }[]
