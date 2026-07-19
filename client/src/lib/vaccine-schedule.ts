import { addDays, addMonths, parseISO, format } from "date-fns";

export interface VaccineDefinition {
  id: string;
  name: string;
  group: string;
  doseNumber: number;
  totalDoses: number;
  standardAgeMonths: number;
  minIntervalDays: number | null;
  previousDoseId: string | null;
  nextDoseId: string | null;
  isOptional: boolean;
  ageGroupLabel: string;
  ageGroupMin: number;
  ageGroupMax: number;
}

export const VACCINE_DEFINITIONS: VaccineDefinition[] = [
  { id: "5mix_1", name: "五種混合(1)", group: "五種混合", doseNumber: 1, totalDoses: 4, standardAgeMonths: 2, minIntervalDays: null, previousDoseId: null, nextDoseId: "5mix_2", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "5mix_2", name: "五種混合(2)", group: "五種混合", doseNumber: 2, totalDoses: 4, standardAgeMonths: 3, minIntervalDays: 20, previousDoseId: "5mix_1", nextDoseId: "5mix_3", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "5mix_3", name: "五種混合(3)", group: "五種混合", doseNumber: 3, totalDoses: 4, standardAgeMonths: 4, minIntervalDays: 20, previousDoseId: "5mix_2", nextDoseId: "5mix_boost", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "5mix_boost", name: "五種混合(追加)", group: "五種混合", doseNumber: 4, totalDoses: 4, standardAgeMonths: 18, minIntervalDays: 180, previousDoseId: "5mix_3", nextDoseId: null, isOptional: false, ageGroupLabel: "幼児前期（1〜2歳）", ageGroupMin: 12, ageGroupMax: 23 },

  { id: "pcv_1", name: "肺炎球菌(1)", group: "肺炎球菌", doseNumber: 1, totalDoses: 4, standardAgeMonths: 2, minIntervalDays: null, previousDoseId: null, nextDoseId: "pcv_2", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "pcv_2", name: "肺炎球菌(2)", group: "肺炎球菌", doseNumber: 2, totalDoses: 4, standardAgeMonths: 3, minIntervalDays: 27, previousDoseId: "pcv_1", nextDoseId: "pcv_3", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "pcv_3", name: "肺炎球菌(3)", group: "肺炎球菌", doseNumber: 3, totalDoses: 4, standardAgeMonths: 4, minIntervalDays: 27, previousDoseId: "pcv_2", nextDoseId: "pcv_boost", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "pcv_boost", name: "肺炎球菌(追加)", group: "肺炎球菌", doseNumber: 4, totalDoses: 4, standardAgeMonths: 12, minIntervalDays: 60, previousDoseId: "pcv_3", nextDoseId: null, isOptional: false, ageGroupLabel: "幼児前期（1〜2歳）", ageGroupMin: 12, ageGroupMax: 23 },

  { id: "hepB_1", name: "B型肝炎(1)", group: "B型肝炎", doseNumber: 1, totalDoses: 3, standardAgeMonths: 2, minIntervalDays: null, previousDoseId: null, nextDoseId: "hepB_2", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "hepB_2", name: "B型肝炎(2)", group: "B型肝炎", doseNumber: 2, totalDoses: 3, standardAgeMonths: 3, minIntervalDays: 27, previousDoseId: "hepB_1", nextDoseId: "hepB_3", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "hepB_3", name: "B型肝炎(3)", group: "B型肝炎", doseNumber: 3, totalDoses: 3, standardAgeMonths: 7, minIntervalDays: 139, previousDoseId: "hepB_1", nextDoseId: null, isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },

  { id: "rota_1", name: "ロタ(1)", group: "ロタ", doseNumber: 1, totalDoses: 3, standardAgeMonths: 2, minIntervalDays: null, previousDoseId: null, nextDoseId: "rota_2", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "rota_2", name: "ロタ(2)", group: "ロタ", doseNumber: 2, totalDoses: 3, standardAgeMonths: 3, minIntervalDays: 27, previousDoseId: "rota_1", nextDoseId: "rota_3", isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },
  { id: "rota_3", name: "ロタ(3)", group: "ロタ", doseNumber: 3, totalDoses: 3, standardAgeMonths: 4, minIntervalDays: 27, previousDoseId: "rota_2", nextDoseId: null, isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },

  { id: "bcg", name: "BCG", group: "BCG", doseNumber: 1, totalDoses: 1, standardAgeMonths: 5, minIntervalDays: null, previousDoseId: null, nextDoseId: null, isOptional: false, ageGroupLabel: "乳児期（0〜1歳）", ageGroupMin: 0, ageGroupMax: 11 },

  { id: "mr_1", name: "MR 麻しん風しん(1期)", group: "MR", doseNumber: 1, totalDoses: 2, standardAgeMonths: 12, minIntervalDays: null, previousDoseId: null, nextDoseId: "mr_2", isOptional: false, ageGroupLabel: "幼児前期（1〜2歳）", ageGroupMin: 12, ageGroupMax: 23 },
  { id: "mr_2", name: "MR 麻しん風しん(2期)", group: "MR", doseNumber: 2, totalDoses: 2, standardAgeMonths: 60, minIntervalDays: null, previousDoseId: "mr_1", nextDoseId: null, isOptional: false, ageGroupLabel: "就学準備期（4〜6歳）", ageGroupMin: 48, ageGroupMax: 72 },

  { id: "vzv_1", name: "水痘(1)", group: "水痘", doseNumber: 1, totalDoses: 2, standardAgeMonths: 12, minIntervalDays: null, previousDoseId: null, nextDoseId: "vzv_2", isOptional: false, ageGroupLabel: "幼児前期（1〜2歳）", ageGroupMin: 12, ageGroupMax: 23 },
  { id: "vzv_2", name: "水痘(2)", group: "水痘", doseNumber: 2, totalDoses: 2, standardAgeMonths: 18, minIntervalDays: 180, previousDoseId: "vzv_1", nextDoseId: null, isOptional: false, ageGroupLabel: "幼児前期（1〜2歳）", ageGroupMin: 12, ageGroupMax: 23 },

  { id: "mumps_1", name: "おたふくかぜ(1)", group: "おたふくかぜ", doseNumber: 1, totalDoses: 2, standardAgeMonths: 12, minIntervalDays: null, previousDoseId: null, nextDoseId: "mumps_2", isOptional: true, ageGroupLabel: "幼児前期（1〜2歳）", ageGroupMin: 12, ageGroupMax: 23 },
  { id: "mumps_2", name: "おたふくかぜ(2)", group: "おたふくかぜ", doseNumber: 2, totalDoses: 2, standardAgeMonths: 60, minIntervalDays: null, previousDoseId: "mumps_1", nextDoseId: null, isOptional: true, ageGroupLabel: "就学準備期（4〜6歳）", ageGroupMin: 48, ageGroupMax: 72 },

  { id: "je_1", name: "日本脳炎(1回目)", group: "日本脳炎", doseNumber: 1, totalDoses: 3, standardAgeMonths: 36, minIntervalDays: null, previousDoseId: null, nextDoseId: "je_2", isOptional: false, ageGroupLabel: "幼児後期（3〜4歳）", ageGroupMin: 24, ageGroupMax: 47 },
  { id: "je_2", name: "日本脳炎(2回目)", group: "日本脳炎", doseNumber: 2, totalDoses: 3, standardAgeMonths: 36, minIntervalDays: 7, previousDoseId: "je_1", nextDoseId: "je_boost", isOptional: false, ageGroupLabel: "幼児後期（3〜4歳）", ageGroupMin: 24, ageGroupMax: 47 },
  { id: "je_boost", name: "日本脳炎(追加)", group: "日本脳炎", doseNumber: 3, totalDoses: 3, standardAgeMonths: 48, minIntervalDays: 365, previousDoseId: "je_2", nextDoseId: null, isOptional: false, ageGroupLabel: "就学準備期（4〜6歳）", ageGroupMin: 48, ageGroupMax: 72 },
];

const vaccineMap = new Map(VACCINE_DEFINITIONS.map(v => [v.id, v]));

export type RotavirusType = "rotarix" | "rotateq" | null;

export function getActiveRotaVaccineIds(rotaType: RotavirusType): Set<string> {
  if (rotaType === "rotarix") return new Set(["rota_1", "rota_2"]);
  if (rotaType === "rotateq") return new Set(["rota_1", "rota_2", "rota_3"]);
  return new Set();
}

export function getFilteredVaccineDefinitions(rotaType: RotavirusType): VaccineDefinition[] {
  const activeRotaIds = getActiveRotaVaccineIds(rotaType);
  return VACCINE_DEFINITIONS.filter(v => {
    if (v.group === "ロタ") return activeRotaIds.has(v.id);
    return true;
  });
}

export function getVaccineById(id: string): VaccineDefinition | undefined {
  return vaccineMap.get(id);
}

export interface VaccineAgeGroup {
  label: string;
  minMonths: number;
  maxMonths: number;
  vaccines: VaccineDefinition[];
}

export function getVaccineAgeGroups(): VaccineAgeGroup[] {
  const groupMap = new Map<string, VaccineAgeGroup>();
  for (const v of VACCINE_DEFINITIONS) {
    if (!groupMap.has(v.ageGroupLabel)) {
      groupMap.set(v.ageGroupLabel, {
        label: v.ageGroupLabel,
        minMonths: v.ageGroupMin,
        maxMonths: v.ageGroupMax,
        vaccines: [],
      });
    }
    groupMap.get(v.ageGroupLabel)!.vaccines.push(v);
  }
  return Array.from(groupMap.values());
}

export function getNextDoseRecommendation(
  vaccineId: string,
  administeredDate: string
): { nextVaccineId: string; nextVaccineName: string; recommendedDate: string; minIntervalDays: number } | null {
  const vaccine = vaccineMap.get(vaccineId);
  if (!vaccine || !vaccine.nextDoseId) return null;

  const nextVaccine = vaccineMap.get(vaccine.nextDoseId);
  if (!nextVaccine) return null;

  if (nextVaccine.minIntervalDays) {
    const date = parseISO(administeredDate);
    const recommended = addDays(date, nextVaccine.minIntervalDays);
    return {
      nextVaccineId: nextVaccine.id,
      nextVaccineName: nextVaccine.name,
      recommendedDate: format(recommended, "yyyy-MM-dd"),
      minIntervalDays: nextVaccine.minIntervalDays,
    };
  }

  return {
    nextVaccineId: nextVaccine.id,
    nextVaccineName: nextVaccine.name,
    recommendedDate: "",
    minIntervalDays: 0,
  };
}

export function getStandardScheduleDate(
  vaccineId: string,
  birthday: string
): string {
  const vaccine = vaccineMap.get(vaccineId);
  if (!vaccine) return "";

  const bday = parseISO(birthday);
  const standardDate = addMonths(bday, vaccine.standardAgeMonths);
  return format(standardDate, "yyyy-MM-dd");
}

export type VaccineStatus = "completed" | "upcoming" | "overdue" | "not_yet";

export function getVaccineStatus(
  vaccineId: string,
  completedIds: Set<string>,
  ageMonths: number
): VaccineStatus {
  if (completedIds.has(vaccineId)) return "completed";
  const vaccine = vaccineMap.get(vaccineId);
  if (!vaccine) return "not_yet";

  if (ageMonths >= vaccine.standardAgeMonths + 3) return "overdue";
  if (ageMonths >= vaccine.standardAgeMonths - 1) return "upcoming";
  return "not_yet";
}
