import {
  Milk, Baby, Moon, Utensils, Footprints, Heart, Star, Thermometer, Stethoscope,
  Sun, Droplets, UtensilsCrossed, MessageCircle, ThumbsUp, School, Pill,
  Palette, Award, CalendarCheck, GraduationCap, TrendingUp, Blocks, Cookie, Apple, Bath,
  Sparkles, Scissors, Hand, Timer, GlassWater
} from "lucide-react";

export interface PhaseActionConfig {
  id: string;
  label: string;
  iconName: string;
  icon: typeof Milk;
  color: string;
  dialogType: "quick" | "milk" | "diaper" | "sleep" | "food" | "play" | "milestone" | "temp" | "symptom" | "thanks"
    | "toilet" | "meal" | "words" | "discipline" | "school_report" | "medicine"
    | "hobby" | "achievement" | "schedule" | "school_prep" | "growth_note" | "snack" | "bath" | "toothbrush" | "temperature" | "nail_care" | "skincare" | "clinic" | "express" | "drink" | "hold";
  options?: { id: string; label: string; icon: string; desc: string }[];
}

export interface PhaseDefinition {
  id: number;
  name: string;
  ageLabel: string;
  minMonths: number;
  maxMonths: number;
  actions: PhaseActionConfig[];
}

export const PLAY_OPTIONS = [
  { id: "tummy", label: "うつ伏せ練習" },
  { id: "peekaboo", label: "いないいないばあ" },
  { id: "rhythm", label: "お歌・リズム遊び" },
  { id: "walk", label: "お散歩" },
  { id: "toy", label: "おもちゃ遊び" },
  { id: "reading", label: "絵本" },
  { id: "other", label: "その他" },
];

export const phases: PhaseDefinition[] = [
  {
    id: 0,
    name: "乳児期",
    ageLabel: "0〜12ヶ月",
    minMonths: 0,
    maxMonths: 11,
    actions: [
      { id: "milk", label: "ミルク", iconName: "Milk", icon: Milk, color: "bg-blue-50 text-blue-500 border-blue-100 hover:bg-blue-100", dialogType: "milk" },
      { id: "express", label: "搾乳", iconName: "Timer", icon: Timer, color: "bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100", dialogType: "express" },
      { id: "diaper", label: "おむつ", iconName: "Baby", icon: Baby, color: "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100", dialogType: "diaper" },
      { id: "sleep", label: "ねんね", iconName: "Moon", icon: Moon, color: "bg-indigo-50 text-indigo-500 border-indigo-100 hover:bg-indigo-100", dialogType: "sleep" },
      { id: "food", label: "離乳食", iconName: "Apple", icon: Apple, color: "bg-green-50 text-green-600 border-green-100 hover:bg-green-100", dialogType: "food" },
      { id: "snack", label: "おやつ", iconName: "Cookie", icon: Cookie, color: "bg-pink-50 text-pink-500 border-pink-100 hover:bg-pink-100", dialogType: "snack" },
      { id: "drink", label: "のみもの", iconName: "GlassWater", icon: GlassWater, color: "bg-cyan-50 text-cyan-600 border-cyan-100 hover:bg-cyan-100", dialogType: "drink" },
      { id: "milestone", label: "はじめて", iconName: "Star", icon: Star, color: "bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100", dialogType: "milestone" },
      { id: "bath", label: "おふろ", iconName: "Bath", icon: Bath, color: "bg-sky-50 text-sky-500 border-sky-100 hover:bg-sky-100", dialogType: "bath" },
      { id: "play", label: "あそび", iconName: "Blocks", icon: Blocks, color: "bg-lime-50 text-lime-600 border-lime-100 hover:bg-lime-100", dialogType: "play" },
      { id: "hold", label: "抱っこ", iconName: "Heart", icon: Heart, color: "bg-violet-50 text-violet-500 border-violet-100 hover:bg-violet-100", dialogType: "hold" },
      { id: "school_report", label: "園の記録", iconName: "School", icon: School, color: "bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100", dialogType: "school_report" },
      { id: "toothbrush", label: "はみがき", iconName: "Sparkles", icon: Sparkles, color: "bg-cyan-50 text-cyan-500 border-cyan-100 hover:bg-cyan-100", dialogType: "toothbrush" },
      { id: "nail_care", label: "爪切り", iconName: "Scissors", icon: Scissors, color: "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100", dialogType: "nail_care" },
      { id: "skincare", label: "保湿", iconName: "Hand", icon: Hand, color: "bg-rose-50 text-rose-400 border-rose-100 hover:bg-rose-100", dialogType: "skincare" },
      { id: "medicine", label: "おくすり", iconName: "Pill", icon: Pill, color: "bg-pink-50 text-pink-500 border-pink-100 hover:bg-pink-100", dialogType: "medicine" },
      { id: "temperature", label: "たいおん", iconName: "Thermometer", icon: Thermometer, color: "bg-red-50 text-red-400 border-red-100 hover:bg-red-100", dialogType: "temperature" },
      { id: "clinic", label: "通院", iconName: "Stethoscope", icon: Stethoscope, color: "bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100", dialogType: "clinic" },
      { id: "thanks", label: "ありがとう", iconName: "Heart", icon: Heart, color: "bg-red-50 text-red-500 border-red-100 hover:bg-red-100", dialogType: "thanks" },
    ],
  },
  {
    id: 1,
    name: "幼児前期",
    ageLabel: "1〜2歳",
    minMonths: 12,
    maxMonths: 23,
    actions: [
      { id: "meal", label: "ごはん", iconName: "UtensilsCrossed", icon: UtensilsCrossed, color: "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100", dialogType: "meal" },
      { id: "milk", label: "ミルク", iconName: "Milk", icon: Milk, color: "bg-blue-50 text-blue-500 border-blue-100 hover:bg-blue-100", dialogType: "milk" },
      { id: "snack", label: "おやつ", iconName: "Cookie", icon: Cookie, color: "bg-pink-50 text-pink-500 border-pink-100 hover:bg-pink-100", dialogType: "snack" },
      { id: "drink", label: "のみもの", iconName: "GlassWater", icon: GlassWater, color: "bg-cyan-50 text-cyan-600 border-cyan-100 hover:bg-cyan-100", dialogType: "drink" },
      { id: "toilet", label: "トイレ", iconName: "Droplets", icon: Droplets, color: "bg-cyan-50 text-cyan-600 border-cyan-100 hover:bg-cyan-100", dialogType: "toilet" },
      { id: "sleep", label: "ねんね", iconName: "Moon", icon: Moon, color: "bg-indigo-50 text-indigo-500 border-indigo-100 hover:bg-indigo-100", dialogType: "sleep" },
      { id: "words", label: "ことば", iconName: "MessageCircle", icon: MessageCircle, color: "bg-green-50 text-green-600 border-green-100 hover:bg-green-100", dialogType: "words" },
      { id: "bath", label: "おふろ", iconName: "Bath", icon: Bath, color: "bg-sky-50 text-sky-500 border-sky-100 hover:bg-sky-100", dialogType: "bath" },
      { id: "play", label: "あそび", iconName: "Blocks", icon: Blocks, color: "bg-lime-50 text-lime-600 border-lime-100 hover:bg-lime-100", dialogType: "play" },
      { id: "hold", label: "抱っこ", iconName: "Heart", icon: Heart, color: "bg-violet-50 text-violet-500 border-violet-100 hover:bg-violet-100", dialogType: "hold" },
      { id: "milestone", label: "はじめて", iconName: "Star", icon: Star, color: "bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100", dialogType: "milestone" },
      { id: "diaper", label: "おむつ", iconName: "Baby", icon: Baby, color: "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100", dialogType: "diaper" },
      { id: "school_report", label: "園の記録", iconName: "School", icon: School, color: "bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100", dialogType: "school_report" },
      { id: "toothbrush", label: "はみがき", iconName: "Sparkles", icon: Sparkles, color: "bg-cyan-50 text-cyan-500 border-cyan-100 hover:bg-cyan-100", dialogType: "toothbrush" },
      { id: "nail_care", label: "爪切り", iconName: "Scissors", icon: Scissors, color: "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100", dialogType: "nail_care" },
      { id: "skincare", label: "保湿", iconName: "Hand", icon: Hand, color: "bg-rose-50 text-rose-400 border-rose-100 hover:bg-rose-100", dialogType: "skincare" },
      { id: "medicine", label: "おくすり", iconName: "Pill", icon: Pill, color: "bg-pink-50 text-pink-500 border-pink-100 hover:bg-pink-100", dialogType: "medicine" },
      { id: "temperature", label: "たいおん", iconName: "Thermometer", icon: Thermometer, color: "bg-red-50 text-red-400 border-red-100 hover:bg-red-100", dialogType: "temperature" },
      { id: "clinic", label: "通院", iconName: "Stethoscope", icon: Stethoscope, color: "bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100", dialogType: "clinic" },
      { id: "thanks", label: "ありがとう", iconName: "Heart", icon: Heart, color: "bg-red-50 text-red-500 border-red-100 hover:bg-red-100", dialogType: "thanks" },
    ],
  },
  {
    id: 2,
    name: "幼児後期",
    ageLabel: "2〜4歳",
    minMonths: 24,
    maxMonths: 47,
    actions: [
      { id: "meal", label: "ごはん", iconName: "UtensilsCrossed", icon: UtensilsCrossed, color: "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100", dialogType: "meal" },
      { id: "milk", label: "ミルク", iconName: "Milk", icon: Milk, color: "bg-blue-50 text-blue-500 border-blue-100 hover:bg-blue-100", dialogType: "milk" },
      { id: "snack", label: "おやつ", iconName: "Cookie", icon: Cookie, color: "bg-pink-50 text-pink-500 border-pink-100 hover:bg-pink-100", dialogType: "snack" },
      { id: "drink", label: "のみもの", iconName: "GlassWater", icon: GlassWater, color: "bg-cyan-50 text-cyan-600 border-cyan-100 hover:bg-cyan-100", dialogType: "drink" },
      { id: "diaper", label: "おむつ", iconName: "Baby", icon: Baby, color: "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100", dialogType: "diaper" },
      { id: "toilet", label: "トイレ", iconName: "Droplets", icon: Droplets, color: "bg-cyan-50 text-cyan-600 border-cyan-100 hover:bg-cyan-100", dialogType: "toilet" },
      { id: "sleep", label: "ねんね", iconName: "Moon", icon: Moon, color: "bg-indigo-50 text-indigo-500 border-indigo-100 hover:bg-indigo-100", dialogType: "sleep" },
      { id: "hold", label: "抱っこ", iconName: "Heart", icon: Heart, color: "bg-violet-50 text-violet-500 border-violet-100 hover:bg-violet-100", dialogType: "hold" },
      { id: "discipline", label: "しつけ", iconName: "ThumbsUp", icon: ThumbsUp, color: "bg-yellow-50 text-yellow-700 border-yellow-100 hover:bg-yellow-100", dialogType: "discipline" },
      { id: "bath", label: "おふろ", iconName: "Bath", icon: Bath, color: "bg-sky-50 text-sky-500 border-sky-100 hover:bg-sky-100", dialogType: "bath" },
      { id: "hobby", label: "きょうみ", iconName: "Palette", icon: Palette, color: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100 hover:bg-fuchsia-100", dialogType: "hobby" },
      { id: "achievement", label: "できた!", iconName: "Award", icon: Award, color: "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100", dialogType: "achievement" },
      { id: "words", label: "ことば", iconName: "MessageCircle", icon: MessageCircle, color: "bg-green-50 text-green-600 border-green-100 hover:bg-green-100", dialogType: "words" },
      { id: "school_report", label: "園の記録", iconName: "School", icon: School, color: "bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100", dialogType: "school_report" },
      { id: "toothbrush", label: "はみがき", iconName: "Sparkles", icon: Sparkles, color: "bg-cyan-50 text-cyan-500 border-cyan-100 hover:bg-cyan-100", dialogType: "toothbrush" },
      { id: "nail_care", label: "爪切り", iconName: "Scissors", icon: Scissors, color: "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100", dialogType: "nail_care" },
      { id: "skincare", label: "保湿", iconName: "Hand", icon: Hand, color: "bg-rose-50 text-rose-400 border-rose-100 hover:bg-rose-100", dialogType: "skincare" },
      { id: "medicine", label: "おくすり", iconName: "Pill", icon: Pill, color: "bg-pink-50 text-pink-500 border-pink-100 hover:bg-pink-100", dialogType: "medicine" },
      { id: "temperature", label: "たいおん", iconName: "Thermometer", icon: Thermometer, color: "bg-red-50 text-red-400 border-red-100 hover:bg-red-100", dialogType: "temperature" },
      { id: "clinic", label: "通院", iconName: "Stethoscope", icon: Stethoscope, color: "bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100", dialogType: "clinic" },
      { id: "thanks", label: "ありがとう", iconName: "Heart", icon: Heart, color: "bg-red-50 text-red-500 border-red-100 hover:bg-red-100", dialogType: "thanks" },
    ],
  },
  {
    id: 3,
    name: "就学準備期",
    ageLabel: "4〜6歳",
    minMonths: 48,
    maxMonths: 72,
    actions: [
      { id: "meal", label: "ごはん", iconName: "UtensilsCrossed", icon: UtensilsCrossed, color: "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100", dialogType: "meal" },
      { id: "snack", label: "おやつ", iconName: "Cookie", icon: Cookie, color: "bg-pink-50 text-pink-500 border-pink-100 hover:bg-pink-100", dialogType: "snack" },
      { id: "drink", label: "のみもの", iconName: "GlassWater", icon: GlassWater, color: "bg-cyan-50 text-cyan-600 border-cyan-100 hover:bg-cyan-100", dialogType: "drink" },
      { id: "sleep", label: "ねんね", iconName: "Moon", icon: Moon, color: "bg-indigo-50 text-indigo-500 border-indigo-100 hover:bg-indigo-100", dialogType: "sleep" },
      { id: "school_report", label: "園の記録", iconName: "School", icon: School, color: "bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100", dialogType: "school_report" },
      { id: "discipline", label: "しつけ", iconName: "ThumbsUp", icon: ThumbsUp, color: "bg-yellow-50 text-yellow-700 border-yellow-100 hover:bg-yellow-100", dialogType: "discipline" },
      { id: "schedule", label: "よてい", iconName: "CalendarCheck", icon: CalendarCheck, color: "bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100", dialogType: "schedule" },
      { id: "bath", label: "おふろ", iconName: "Bath", icon: Bath, color: "bg-sky-50 text-sky-500 border-sky-100 hover:bg-sky-100", dialogType: "bath" },
      { id: "hold", label: "抱っこ", iconName: "Heart", icon: Heart, color: "bg-violet-50 text-violet-500 border-violet-100 hover:bg-violet-100", dialogType: "hold" },
      { id: "school_prep", label: "入学準備", iconName: "GraduationCap", icon: GraduationCap, color: "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100", dialogType: "school_prep" },
      { id: "achievement", label: "できた!", iconName: "Award", icon: Award, color: "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100", dialogType: "achievement" },
      { id: "words", label: "ことば", iconName: "MessageCircle", icon: MessageCircle, color: "bg-green-50 text-green-600 border-green-100 hover:bg-green-100", dialogType: "words" },
      { id: "toothbrush", label: "はみがき", iconName: "Sparkles", icon: Sparkles, color: "bg-cyan-50 text-cyan-500 border-cyan-100 hover:bg-cyan-100", dialogType: "toothbrush" },
      { id: "nail_care", label: "爪切り", iconName: "Scissors", icon: Scissors, color: "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100", dialogType: "nail_care" },
      { id: "skincare", label: "保湿", iconName: "Hand", icon: Hand, color: "bg-rose-50 text-rose-400 border-rose-100 hover:bg-rose-100", dialogType: "skincare" },
      { id: "medicine", label: "おくすり", iconName: "Pill", icon: Pill, color: "bg-pink-50 text-pink-500 border-pink-100 hover:bg-pink-100", dialogType: "medicine" },
      { id: "temperature", label: "たいおん", iconName: "Thermometer", icon: Thermometer, color: "bg-red-50 text-red-400 border-red-100 hover:bg-red-100", dialogType: "temperature" },
      { id: "clinic", label: "通院", iconName: "Stethoscope", icon: Stethoscope, color: "bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100", dialogType: "clinic" },
      { id: "thanks", label: "ありがとう", iconName: "Heart", icon: Heart, color: "bg-red-50 text-red-500 border-red-100 hover:bg-red-100", dialogType: "thanks" },
    ],
  },
];

export function getPhaseForAge(months: number): number {
  if (months < 12) return 0;
  if (months < 24) return 1;
  if (months < 48) return 2;
  return 3;
}

export function getActionsForPhase(phase: number): PhaseActionConfig[] {
  const phaseDef = phases.find((p) => p.id === phase);
  return phaseDef ? phaseDef.actions : phases[0].actions;
}

export function getPhaseDefinition(phase: number): PhaseDefinition {
  return phases.find((p) => p.id === phase) || phases[0];
}

export function getAllActions(): Map<string, PhaseActionConfig> {
  const map = new Map<string, PhaseActionConfig>();
  for (const phase of phases) {
    for (const action of phase.actions) {
      if (!map.has(action.id)) map.set(action.id, action);
    }
  }
  return map;
}

export const ALL_LOG_TYPES = [
  "milk", "diaper", "sleep", "food", "play", "milestone", "temp", "symptom", "vaccination", "chore", "thanks",
  "toilet", "meal", "words", "discipline", "school_report", "medicine", "hobby", "achievement", "schedule", "school_prep", "growth_note", "snack", "bath", "toothbrush", "temperature", "nail_care", "skincare", "clinic", "drink", "hold",
] as const;

export type LogType = (typeof ALL_LOG_TYPES)[number];

export const LOG_TYPE_LABELS: Record<string, string> = {
  milk: "ミルク",
  food: "離乳食",
  play: "あそび",
  diaper: "おむつ",
  sleep: "ねんね",
  temp: "体温",
  symptom: "症状メモ",
  vaccination: "予防接種",
  chore: "名もなき育児",
  thanks: "ありがとう",
  milestone: "はじめて",
  toilet: "トイレ",
  meal: "ごはん",
  words: "ことば",
  discipline: "しつけ",
  school_report: "園の記録",
  medicine: "おくすり",
  hobby: "きょうみ",
  achievement: "できた!",
  schedule: "よてい",
  school_prep: "入学準備",
  growth_note: "成長メモ",
  snack: "おやつ",
  bath: "おふろ",
  toothbrush: "はみがき",
  temperature: "たいおん",
  nail_care: "爪切り",
  skincare: "保湿",
  clinic: "通院",
  drink: "のみもの",
  hold: "抱っこ",
};
