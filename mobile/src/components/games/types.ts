// Oyun motorlarının ortak tipleri ve önbellekleri.
// shared.tsx ile useGameSession.ts ikisi de buradan içe aktarır (aralarında döngü oluşmaz).

export type Player = { id: string; name: string; color: string };

/** finish_session sonucunu sonuç ekranına taşımak için bellek içi önbellek */
export type FinishResult = {
  xp?: number;
  matches?: number;
  rounds?: number;
  couple_xp?: number;
  flirt?: { level: number; name: string; floor: number; next: number | null };
  already?: boolean;
  session?: Record<string, any>;
};
export const finishCache = new Map<string, FinishResult>();
