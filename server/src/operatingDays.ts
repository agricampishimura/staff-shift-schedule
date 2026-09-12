import { getHolidayName } from "./holidays.js";

// 事業所がその日「稼働日」かどうかを判定する(2026-09-12追加、常時稼働職員の自動配置用)。
// 祝日・臨時休業・曜日別必要人数0の日は非稼働。必要配置人数マスタに行が無い
// (未設定)曜日も、実際には運用していない曜日である可能性が高いため非稼働として扱う
// (勤務表チェック画面のUNCONFIGURED表示は判定対象外というだけで「稼働扱い」ではないため、
// ここでも稼働日とはみなさない)。
export function isFacilityOperatingDay(
  date: Date,
  requiredCountForWeekday: number | undefined,
  isManuallyClosed: boolean
): boolean {
  if (getHolidayName(date)) return false;
  if (isManuallyClosed) return false;
  if (!requiredCountForWeekday || requiredCountForWeekday <= 0) return false;
  return true;
}
