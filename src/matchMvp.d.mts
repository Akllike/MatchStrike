import type { MatchPlayer } from './api'
export function hasCompleteMvpStats(players: MatchPlayer[]): boolean
export function selectMatchMvp(players: MatchPlayer[], options?: { preferReported?: boolean }): MatchPlayer | null
