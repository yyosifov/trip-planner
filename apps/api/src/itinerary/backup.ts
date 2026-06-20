export interface BackupPlace { id: string; weatherDependent: boolean; kidSuitability: number; }

export function rankBackups<T extends BackupPlace>(weatherItemPlaces: T[], likedPool: T[]): T[] {
  const exclude = new Set(weatherItemPlaces.map((p) => p.id));
  return likedPool
    .filter((p) => !p.weatherDependent && !exclude.has(p.id))
    .sort((a, b) => b.kidSuitability - a.kidSuitability);
}
