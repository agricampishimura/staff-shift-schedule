// 勤務時間区分マスタの初期データ。
// 出典: ユーザー提供の時間帯リスト(2026-09-08)。
// 実行: npx prisma db seed (package.json の prisma.seed 参照)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { code: "A", startTime: "7:00", endTime: "16:00", breakMinutes: 60, workHours: 8 },
  { code: "B", startTime: "8:00", endTime: "17:00", breakMinutes: 60, workHours: 8 },
  { code: "C", startTime: "8:30", endTime: "17:00", breakMinutes: 60, workHours: 7.5 },
  { code: "D", startTime: "9:00", endTime: "18:00", breakMinutes: 60, workHours: 8 },
  { code: "E", startTime: "9:30", endTime: "18:30", breakMinutes: 60, workHours: 8 },
  { code: "F", startTime: "9:30", endTime: "18:00", breakMinutes: 60, workHours: 7.5 },
  { code: "G", startTime: "10:00", endTime: "18:00", breakMinutes: 60, workHours: 7 },
  { code: "H", startTime: "10:00", endTime: "18:30", breakMinutes: 60, workHours: 7.5 },
  { code: "J", startTime: "10:00", endTime: "19:00", breakMinutes: 60, workHours: 8 },
];

async function main() {
  for (const c of categories) {
    await prisma.workTimeCategory.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        label: `${c.startTime}〜${c.endTime}`,
        startTime: c.startTime,
        endTime: c.endTime,
        breakMinutes: c.breakMinutes,
        workHours: c.workHours,
        note: `休憩1h/実働${c.workHours}時間労働`,
      },
    });
  }
  console.log(`seeded ${categories.length} work time categories`);
}

main().finally(() => prisma.$disconnect());
