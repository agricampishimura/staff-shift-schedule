export type PermissionLevel = "SYSTEM_ADMIN" | "ADMIN" | "PLANNER" | "GENERAL_STAFF";
export type StaffEmploymentType =
  | "FULL_TIME_40H"
  | "FULL_TIME_32H"
  | "PART_TIME_WELFARE"
  | "PART_TIME_DRIVER"
  | "ARBEIT_TRANSPORT";
export type EmploymentStatus = "ZAISEKI_CHU" | "KYUSHOKU_CHU" | "REWORK" | "TAISHOKU";
export type DrivingCapacityBand =
  | "BAND_A"
  | "BAND_B"
  | "BAND_C"
  | "BAND_D"
  | "BAND_E"
  | "BAND_F"
  | "BAND_G"
  | "BAND_H";
export type ShiftAssignmentStatus = "DRAFT" | "CONFIRMED";

export interface Facility {
  id: string;
  name: string;
}

export interface Staff {
  id: string;
  name: string;
  permissionLevel: PermissionLevel;
  employmentType: StaffEmploymentType | null;
  employmentStatus: EmploymentStatus;
  drivingCapacityBand: DrivingCapacityBand | null;
  phoneNumber: string | null;
  email: string | null;
  primaryFacilityId: string | null;
  primaryFacility?: Facility | null;
}

export interface RequiredStaffing {
  id: string;
  facilityId: string;
  weekday: number;
  requiredCount: number;
  note: string | null;
}

export interface ShiftAssignment {
  id: string;
  date: string;
  staffId: string;
  facilityId: string;
  startTime: string;
  endTime: string;
  status: ShiftAssignmentStatus;
  note: string | null;
  staff?: Staff;
  facility?: Facility;
}

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  SYSTEM_ADMIN: "システム管理者",
  ADMIN: "管理者",
  PLANNER: "予定作成者",
  GENERAL_STAFF: "一般職員",
};

export const EMPLOYMENT_TYPE_LABELS: Record<StaffEmploymentType, string> = {
  FULL_TIME_40H: "正社員(週40時間)",
  FULL_TIME_32H: "正社員(週32時間)",
  PART_TIME_WELFARE: "パート(福祉職)",
  PART_TIME_DRIVER: "パート(運転専従)",
  ARBEIT_TRANSPORT: "アルバイト(送迎対象)",
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  ZAISEKI_CHU: "在籍中",
  KYUSHOKU_CHU: "休職中",
  REWORK: "リワーク",
  TAISHOKU: "退職",
};

export const DRIVING_CAPACITY_LABELS: Record<DrivingCapacityBand, string> = {
  BAND_A: "A(1.5 < A < 2.0)",
  BAND_B: "B(1.2 < A < 1.5)",
  BAND_C: "C(1.0 < A < 1.3)",
  BAND_D: "D(0.9 < A < 1.2)",
  BAND_E: "E(0.8 < A < 1.0)",
  BAND_F: "F(0.7 < A < 0.9)",
  BAND_G: "G(A < 0.8)",
  BAND_H: "H(運転不可)",
};

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export type DayScheduleType = "WORK" | "OFF";

export interface WorkTimeCategory {
  id: string;
  code: string;
  label: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workHours: number;
  note: string | null;
}

export interface StaffDaySchedule {
  id: string;
  staffId: string;
  date: string;
  dayType: DayScheduleType;
  workTimeCategoryId: string | null;
  workTimeCategory?: WorkTimeCategory | null;
  customStartTime: string | null;
  customEndTime: string | null;
  note: string | null;
}
