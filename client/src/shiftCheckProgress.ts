// 勤務表チェックの作成途中の状態(対象月・選択中の日付)をlocalStorageへ保存する(2026-09-12追加)。
// シフト作成トップ画面に戻った後も「作成中のシフト作成に戻る」で復帰できるようにするため、
// アプリ内タブ切り替えだけでなく、ページの再読み込みをまたいでも状態を復元できるようにする。

const STORAGE_KEY = "shiftCheckProgress";

export interface ShiftCheckProgress {
  month: string;
  selectedDay: string | null;
}

export function loadShiftCheckProgress(): ShiftCheckProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.month !== "string") return null;
    return {
      month: parsed.month,
      selectedDay: typeof parsed.selectedDay === "string" ? parsed.selectedDay : null,
    };
  } catch {
    return null;
  }
}

export function saveShiftCheckProgress(progress: ShiftCheckProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorageが使用できない環境(プライベートモード等)では何もしない
  }
}

export function clearShiftCheckProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
