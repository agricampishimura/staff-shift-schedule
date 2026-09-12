// 日本の祝日判定(勤務表チェックで祝日を休業日として扱うためのサーバー側実装)。
// client/src/holidays.ts と同一のロジック(固定日・ハッピーマンデー・
// 春分/秋分(近似式、2000〜2099年で有効)・振替休日・国民の休日)。
// 両者の計算ロジックを変更する場合は必ず両方を更新すること。

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function nthMonday(year: number, month: number, n: number) {
  const first = new Date(year, month - 1, 1);
  const offset = (1 - first.getDay() + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

function vernalEquinoxDay(year: number) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnalEquinoxDay(year: number) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function baseHolidays(year: number): Map<string, string> {
  const map = new Map<string, string>();
  const add = (m: number, d: number, name: string) => map.set(dateKey(year, m, d), name);

  add(1, 1, "元日");
  add(1, nthMonday(year, 1, 2), "成人の日");
  add(2, 11, "建国記念の日");
  add(2, 23, "天皇誕生日");
  add(3, vernalEquinoxDay(year), "春分の日");
  add(4, 29, "昭和の日");
  add(5, 3, "憲法記念日");
  add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");
  add(7, nthMonday(year, 7, 3), "海の日");
  add(8, 11, "山の日");
  add(9, nthMonday(year, 9, 3), "敬老の日");
  add(9, autumnalEquinoxDay(year), "秋分の日");
  add(10, nthMonday(year, 10, 2), "スポーツの日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  return map;
}

function computeYearHolidays(year: number): Map<string, string> {
  const holidays = baseHolidays(year);

  for (const [key] of [...holidays]) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getDay() === 0) {
      const sub = new Date(y, m - 1, d + 1);
      while (holidays.has(dateKey(sub.getFullYear(), sub.getMonth() + 1, sub.getDate()))) {
        sub.setDate(sub.getDate() + 1);
      }
      holidays.set(dateKey(sub.getFullYear(), sub.getMonth() + 1, sub.getDate()), "振替休日");
    }
  }

  const entries = [...holidays.keys()].map((k) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d);
  });
  for (const date of entries) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextKey = dateKey(next.getFullYear(), next.getMonth() + 1, next.getDate());
    if (holidays.has(nextKey)) continue;
    if (next.getDay() === 0) continue;
    const nextNext = new Date(next);
    nextNext.setDate(nextNext.getDate() + 1);
    const nextNextKey = dateKey(nextNext.getFullYear(), nextNext.getMonth() + 1, nextNext.getDate());
    if (holidays.has(nextNextKey)) {
      holidays.set(nextKey, "国民の休日");
    }
  }

  return holidays;
}

const cache = new Map<number, Map<string, string>>();

export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  if (!cache.has(year)) cache.set(year, computeYearHolidays(year));
  const key = dateKey(year, date.getMonth() + 1, date.getDate());
  return cache.get(year)!.get(key) ?? null;
}
