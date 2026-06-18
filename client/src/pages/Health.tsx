import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, TrendingUp, Thermometer, Stethoscope,
  Plus, Loader2, Ruler, Weight, CircleDot, Activity, Syringe, Check,
  FileDown, AlertTriangle, ClipboardList, X, Trash2, Pencil, Heart, CalendarDays, Pill, Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BottomNav } from "@/components/Navigation";
import { useLogs, useSettings, useGrowthRecords, useCreateGrowthRecord, useUpdateGrowthRecord, useDeleteGrowthRecord, useCreateLog, useChildren, useUpdateChild, useHealthRecords, useCreateHealthRecord, useDeleteHealthRecord, useUpdateHealthRecord, useUpdateLog, useDeleteLog, useVaccinationRecords, useCreateVaccinationRecord, useUpdateVaccinationRecord, useDeleteVaccinationRecord, useCustomVaccines, useCreateCustomVaccine, useDeleteCustomVaccine, useTodayMamaHealthLog, useSaveMamaHealthLog, useMamaHealthLogs } from "@/hooks/use-app-data";
import { useActiveChild } from "@/hooks/use-active-child";
import { differenceInMonths, differenceInMinutes, parseISO, format, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart,
} from "recharts";
import {
  WEIGHT_STANDARDS_MALE, WEIGHT_STANDARDS_FEMALE,
  HEIGHT_STANDARDS_MALE, HEIGHT_STANDARDS_FEMALE,
  buildStandardCurve,
} from "@/lib/growth-standards";
import { generateHealthSummaryPdf } from "@/lib/health-summary-pdf";
import { VACCINE_DEFINITIONS, getVaccineAgeGroups, getNextDoseRecommendation, getStandardScheduleDate, getVaccineStatus, getVaccineById, getFilteredVaccineDefinitions, getActiveRotaVaccineIds, type RotavirusType } from "@/lib/vaccine-schedule";
import type { VaccinationRecord } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";

const SYMPTOM_LABELS: Record<string, string> = {
  cough: "咳",
  runny_nose: "鼻水",
  rash: "湿疹",
  vomit: "嘔吐",
  diarrhea: "下痢",
  fever: "発熱",
};

const SYMPTOM_CHECKLIST = [
  { id: "fever", label: "発熱", icon: Thermometer, color: "text-red-500", bg: "bg-red-50" },
  { id: "cough_runny", label: "咳・鼻水", icon: Stethoscope, color: "text-blue-500", bg: "bg-blue-50" },
  { id: "rash", label: "湿疹・肌荒れ", icon: Activity, color: "text-pink-500", bg: "bg-pink-50" },
  { id: "diarrhea", label: "下痢・便秘", icon: Activity, color: "text-amber-500", bg: "bg-amber-50" },
  { id: "vomit", label: "吐き戻し・嘔吐", icon: Activity, color: "text-orange-500", bg: "bg-orange-50" },
  { id: "fussy", label: "機嫌が悪い（ぐずり）", icon: Activity, color: "text-purple-500", bg: "bg-purple-50" },
  { id: "poor_appetite", label: "飲みが悪い（食欲不振）", icon: Activity, color: "text-teal-500", bg: "bg-teal-50" },
];

const vaccineList = VACCINE_DEFINITIONS;

export default function Health() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: settings } = useSettings(familyId);
  const { data: allLogs, isLoading: logsLoading } = useLogs(familyId);
  const { data: growthRecords, isLoading: growthLoading } = useGrowthRecords(familyId);
  const { data: childrenData } = useChildren(familyId);
  const { data: allHealthRecords = [] } = useHealthRecords(familyId);
  const updateChild = useUpdateChild();
  const createHealthRecord = useCreateHealthRecord();
  const deleteHealthRecord = useDeleteHealthRecord();
  const { activeChild } = useActiveChild(familyId);
  const activeChildId = activeChild?.id ?? null;
  const healthRecords = useMemo(() => {
    if (!activeChildId) return allHealthRecords;
    return (allHealthRecords as any[]).filter((r: any) => !r.childId || r.childId === activeChildId);
  }, [allHealthRecords, activeChildId]);

  const logs = useMemo(() => {
    if (!allLogs) return undefined;
    if (!activeChildId) return allLogs;
    return allLogs.filter((l: any) => !l.childId || l.childId === activeChildId);
  }, [allLogs, activeChildId]);
  const createGrowth = useCreateGrowthRecord();
  const updateGrowth = useUpdateGrowthRecord();
  const deleteGrowth = useDeleteGrowthRecord();
  const createLog = useCreateLog();

  const [showGrowthForm, setShowGrowthForm] = useState(false);
  const [editGrowthId, setEditGrowthId] = useState<number | null>(null);
  const [editWeightG, setEditWeightG] = useState("");
  const [editHeightCm, setEditHeightCm] = useState("");
  const [editMeasuredDate, setEditMeasuredDate] = useState("");
  const [deleteGrowthId, setDeleteGrowthId] = useState<number | null>(null);
  const [showVaccineDialog, setShowVaccineDialog] = useState(false);
  const [showTempDialog, setShowTempDialog] = useState(false);
  const [showSymptomDialog, setShowSymptomDialog] = useState(false);
  const [showHealthRecordDialog, setShowHealthRecordDialog] = useState(false);
  const [healthRecordType, setHealthRecordType] = useState<"allergy" | "medical_history" | "health_note">("allergy");
  const [hrTitle, setHrTitle] = useState("");
  const [hrDetail, setHrDetail] = useState("");
  const [hrDate, setHrDate] = useState("");
  const [showBloodTypeDialog, setShowBloodTypeDialog] = useState(false);
  const [selectedVaccineIds, setSelectedVaccineIds] = useState<Set<string>>(new Set());
  const [openVaccineGroups, setOpenVaccineGroups] = useState<Set<string>>(new Set());
  const [showRotaChangeConfirm, setShowRotaChangeConfirm] = useState(false);
  const [pendingRotaType, setPendingRotaType] = useState<RotavirusType>(null);
  const [tempValue, setTempValue] = useState("36.5");
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [symptomNote, setSymptomNote] = useState("");
  const [weightG, setWeightG] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [measuredDate, setMeasuredDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pdfExporting, setPdfExporting] = useState(false);

  const [editingHealthLog, setEditingHealthLog] = useState<any>(null);
  const [editTempValue, setEditTempValue] = useState("");
  const [editSymptomNote, setEditSymptomNote] = useState("");
  const [editHealthLogTime, setEditHealthLogTime] = useState("");
  const [showEditDateInput, setShowEditDateInput] = useState(false);
  const [editingSymptoms, setEditingSymptoms] = useState<Set<string>>(new Set());
  const [editingHr, setEditingHr] = useState<any>(null);
  const [editHrTitle, setEditHrTitle] = useState("");
  const [editHrDetail, setEditHrDetail] = useState("");
  const [editHrDate, setEditHrDate] = useState("");

  const updateLog = useUpdateLog();
  const deleteLog = useDeleteLog();
  const updateHealthRecord = useUpdateHealthRecord();

  useEffect(() => {
    if (!editingHealthLog) return;
    setEditHealthLogTime(format(new Date(editingHealthLog.createdAt), "yyyy-MM-dd'T'HH:mm"));
    setShowEditDateInput(false);
    if (editingHealthLog.type === "temp") {
      setEditTempValue(editingHealthLog.bodyTemperature != null ? String(editingHealthLog.bodyTemperature) : "");
    }
    if (editingHealthLog.type === "symptom") {
      setEditingSymptoms(new Set((editingHealthLog.symptoms || "").split(",").filter(Boolean)));
      setEditSymptomNote(editingHealthLog.symptomNote || "");
    }
  }, [editingHealthLog]);

  const userType = localStorage.getItem("userType") || "papa";
  const { data: todayMamaLog } = useTodayMamaHealthLog();
  const { data: allMamaLogs = [] } = useMamaHealthLogs();
  const saveMamaHealth = useSaveMamaHealthLog();
  const [showMamaHistory, setShowMamaHistory] = useState(false);
  const [showMamaHealthDialog, setShowMamaHealthDialog] = useState(false);
  const [mhDate, setMhDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [mhBowel, setMhBowel] = useState<boolean | null>(null);
  const [mhBowelNote, setMhBowelNote] = useState("");
  const [mhLochia, setMhLochia] = useState("");
  const [mhPerinealPain, setMhPerinealPain] = useState<number | null>(null);
  const [mhMood, setMhMood] = useState<number | null>(null);
  const [mhSleepHrs, setMhSleepHrs] = useState("");
  const [mhSleepMin, setMhSleepMin] = useState("");
  const [mhNursingIssues, setMhNursingIssues] = useState<string[]>([]);
  const [mhNursingNote, setMhNursingNote] = useState("");
  const [mhWeightKg, setMhWeightKg] = useState("");
  const [mhSwelling, setMhSwelling] = useState<boolean | null>(null);

  const [showCaregiverMedDialog, setShowCaregiverMedDialog] = useState(false);
  const [cmName, setCmName] = useState("");
  const [cmDose, setCmDose] = useState("");
  const [cmNote, setCmNote] = useState("");
  const [cmSuggestions, setCmSuggestions] = useState<string[]>([]);
  const [cmLastMed, setCmLastMed] = useState<{ createdAt: string; medicineName: string | null; medicineDose: string | null } | null>(null);

  const openCaregiverMedDialog = () => {
    fetch(`/api/families/${familyId}/caregiver-medicine-names`)
      .then(r => r.json())
      .then(data => {
        setCmSuggestions(data.names || []);
        setCmLastMed(data.lastLog || null);
      })
      .catch(() => {});
    setCmName("");
    setCmDose("");
    setCmNote("");
    setShowCaregiverMedDialog(true);
  };

  const handleCaregiverMedSubmit = () => {
    if (!cmName) return;
    const parts = [cmName, cmDose, cmNote].filter(Boolean);
    createLog.mutate({
      type: "caregiver_medicine",
      message: `服薬: ${parts.join(" ")}`,
      medicineName: cmName,
      medicineDose: cmDose || null,
      familyId,
    } as any, {
      onSuccess: () => {
        setShowCaregiverMedDialog(false);
        toast({ title: "服薬を記録しました", className: "bg-violet-50 border-violet-100 text-violet-900", duration: 500 });
      },
    });
  };

  const openMamaHealthDialog = (existing?: any) => {
    if (existing) {
      setMhDate(format(new Date(existing.loggedAt), "yyyy-MM-dd"));
      setMhBowel(existing.bowel ?? null);
      setMhBowelNote(existing.bowelNote || "");
      setMhLochia(existing.lochia || "");
      setMhPerinealPain(existing.perinealPain ?? null);
      setMhMood(existing.mood ?? null);
      const hrs = existing.sleepHours != null ? Math.floor(existing.sleepHours) : "";
      const mins = existing.sleepHours != null ? Math.round((existing.sleepHours % 1) * 60) : "";
      setMhSleepHrs(hrs === "" ? "" : String(hrs));
      setMhSleepMin(mins === "" ? "" : String(mins));
      setMhNursingIssues(existing.nursingIssues || []);
      setMhNursingNote(existing.nursingNote || "");
      setMhWeightKg(existing.weightKg != null ? String(existing.weightKg) : "");
      setMhSwelling(existing.swelling ?? null);
    } else {
      setMhDate(format(new Date(), "yyyy-MM-dd"));
      setMhBowel(null);
      setMhBowelNote("");
      setMhLochia("");
      setMhPerinealPain(null);
      setMhMood(null);
      setMhSleepHrs("");
      setMhSleepMin("");
      setMhNursingIssues([]);
      setMhNursingNote("");
      setMhWeightKg("");
      setMhSwelling(null);
    }
    setShowMamaHealthDialog(true);
  };

  const handleMamaHealthSubmit = () => {
    const sleepHours = mhSleepHrs !== "" || mhSleepMin !== ""
      ? (parseInt(mhSleepHrs || "0") + parseInt(mhSleepMin || "0") / 60)
      : null;
    saveMamaHealth.mutate({
      date: mhDate,
      bowel: mhBowel,
      bowelNote: mhBowelNote || null,
      lochia: mhLochia || null,
      perinealPain: mhPerinealPain,
      mood: mhMood,
      sleepHours: sleepHours,
      nursingIssues: mhNursingIssues.length > 0 ? mhNursingIssues : null,
      nursingNote: mhNursingNote || null,
      weightKg: mhWeightKg ? parseFloat(mhWeightKg) : null,
      swelling: mhSwelling,
    }, {
      onSuccess: () => {
        setShowMamaHealthDialog(false);
        toast({ title: "記録しました", className: "bg-pink-50 border-pink-100 text-pink-900", duration: 500 });
      },
    });
  };

  const toggleMhNursingIssue = (issue: string) => {
    setMhNursingIssues(prev =>
      prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
    );
  };

  const { data: vaccinationRecordsData = [] } = useVaccinationRecords(familyId, activeChildId);
  const createVaccinationRecord = useCreateVaccinationRecord();
  const updateVaccinationRecord = useUpdateVaccinationRecord();
  const deleteVaccinationRecord = useDeleteVaccinationRecord();

  const { data: customVaccinesData = [] } = useCustomVaccines(familyId, activeChildId);
  const createCustomVaccine = useCreateCustomVaccine();
  const deleteCustomVaccine = useDeleteCustomVaccine();

  const [vaccineDate, setVaccineDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editingVaccineRecord, setEditingVaccineRecord] = useState<any>(null);
  const [editVaccineDate, setEditVaccineDate] = useState("");
  const [newCustomVaccineName, setNewCustomVaccineName] = useState("");

  const months = useMemo(() => {
    const bday = activeChild?.birthday || settings?.babyBirthday;
    return bday ? differenceInMonths(new Date(), parseISO(bday)) : 0;
  }, [activeChild?.birthday, settings?.babyBirthday]);

  const birthday = activeChild?.birthday || settings?.babyBirthday || "";

  const vaccinationRecordMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const rec of vaccinationRecordsData as any[]) {
      map.set(rec.vaccineId, rec);
    }
    return map;
  }, [vaccinationRecordsData]);

  const completedVaccineIdsFromRecords = useMemo(() => {
    return new Set((vaccinationRecordsData as any[]).map((r: any) => r.vaccineId as string));
  }, [vaccinationRecordsData]);

  const healthLogs = useMemo(() => {
    if (!logs) return [];
    return logs
      .filter((l: any) => ["temp", "symptom", "vaccination"].includes(l.type))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }, [logs]);

  const vaccinationLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((l: any) => l.type === "vaccination");
  }, [logs]);

  const migrationDone = useRef(false);
  useEffect(() => {
    migrationDone.current = false;
  }, [familyId, activeChildId]);
  useEffect(() => {
    if (migrationDone.current) return;
    if (!vaccinationRecordsData || !vaccinationLogs.length) return;
    migrationDone.current = true;
    const existingIds = new Set((vaccinationRecordsData as any[]).map((r: any) => r.vaccineId));
    const toMigrate = vaccinationLogs.filter(
      (l: any) => l.subType && !existingIds.has(l.subType)
    );
    toMigrate.forEach((l: any) => {
      createVaccinationRecord.mutate({
        familyId,
        childId: l.childId ?? activeChildId ?? undefined,
        vaccineId: l.subType,
        administeredDate: format(new Date(l.createdAt), "yyyy-MM-dd"),
      });
    });
  }, [vaccinationRecordsData, vaccinationLogs, familyId, activeChildId]);

  const completedVaccineIds = useMemo((): Set<string> => {
    return completedVaccineIdsFromRecords;
  }, [completedVaccineIdsFromRecords]);

  const rotaType = (activeChild?.rotavirusVaccineType as RotavirusType) || null;

  const filteredVaccineDefs = useMemo(() => {
    return getFilteredVaccineDefinitions(rotaType);
  }, [rotaType]);

  const vaccineAgeGroups = useMemo(() => {
    const groupMap = new Map<string, { label: string; minMonths: number; maxMonths: number; vaccines: typeof filteredVaccineDefs }>();
    for (const v of filteredVaccineDefs) {
      if (!groupMap.has(v.ageGroupLabel)) {
        groupMap.set(v.ageGroupLabel, { label: v.ageGroupLabel, minMonths: v.ageGroupMin, maxMonths: v.ageGroupMax, vaccines: [] });
      }
      groupMap.get(v.ageGroupLabel)!.vaccines.push(v);
    }
    return Array.from(groupMap.values());
  }, [filteredVaccineDefs]);

  const sortedVaccineAgeGroups = useMemo(() => {
    const getPhase = (g: (typeof vaccineAgeGroups)[0]) => {
      if (months >= g.minMonths && months <= g.maxMonths) return 0;
      if (months < g.minMonths) return 1;
      return 2;
    };
    return [...vaccineAgeGroups].sort((a, b) => getPhase(a) - getPhase(b));
  }, [vaccineAgeGroups, months]);

  useEffect(() => {
    if (!showVaccineDialog) return;
    const current = vaccineAgeGroups.find(g => months >= g.minMonths && months <= g.maxMonths);
    if (current) {
      setOpenVaccineGroups(new Set([current.label]));
    } else if (vaccineAgeGroups.length > 0) {
      const upcoming = vaccineAgeGroups.filter(g => months < g.minMonths).sort((a, b) => a.minMonths - b.minMonths)[0];
      if (upcoming) setOpenVaccineGroups(new Set([upcoming.label]));
    }
  }, [showVaccineDialog, months]);

  const handleRotaTypeChange = (newType: RotavirusType) => {
    if (rotaType && rotaType !== newType) {
      setPendingRotaType(newType);
      setShowRotaChangeConfirm(true);
    } else {
      applyRotaType(newType);
    }
  };

  const applyRotaType = (newType: RotavirusType) => {
    if (activeChildId) {
      updateChild.mutate({ id: activeChildId, rotavirusVaccineType: newType });
    }
    const validRotaIds = getActiveRotaVaccineIds(newType);
    setSelectedVaccineIds(prev => {
      const next = new Set(prev);
      for (const id of next) {
        if (id.startsWith("rota_") && !validRotaIds.has(id)) {
          next.delete(id);
        }
      }
      return next;
    });
    setShowRotaChangeConfirm(false);
    setPendingRotaType(null);
  };

  const sortedGrowth = useMemo(() => {
    if (!growthRecords || growthRecords.length === 0) return [];
    const filtered = activeChildId
      ? (growthRecords as any[]).filter((r: any) => !r.childId || r.childId === activeChildId)
      : growthRecords;
    return [...filtered].sort((a: any, b: any) => 
      new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
    );
  }, [growthRecords, activeChildId]);

  const growthChartData = useMemo(() => {
    if (sortedGrowth.length === 0) return [];
    return sortedGrowth.map((r: any) => ({
      date: format(parseISO(r.measuredAt), "M/d"),
      weight: r.weightGrams ? r.weightGrams / 1000 : null,
      height: r.heightCm || null,
      
    }));
  }, [sortedGrowth]);

  const latestGrowth = sortedGrowth.length > 0 ? sortedGrowth[sortedGrowth.length - 1] : null;
  const prevGrowth = sortedGrowth.length > 1 ? sortedGrowth[sortedGrowth.length - 2] : null;
  const weightGain = latestGrowth?.weightGrams && prevGrowth?.weightGrams
    ? latestGrowth.weightGrams - prevGrowth.weightGrams
    : null;

  const handleGrowthSubmit = () => {
    if (!weightG && !heightCm) return;
    const userId = localStorage.getItem("userType") || "papa";
    const data: any = { familyId, userId, measuredAt: measuredDate };
    if (activeChildId) data.childId = activeChildId;
    if (weightG) data.weightGrams = Math.round(parseFloat(weightG) * 1000);
    if (heightCm) data.heightCm = parseFloat(heightCm);

    createGrowth.mutate(data, {
      onSuccess: () => {
        setShowGrowthForm(false);
        setWeightG("");
        setHeightCm("");
      },
    });
  };

  const openEditGrowth = (r: any) => {
    setEditGrowthId(r.id);
    setEditWeightG(r.weightGrams ? String(r.weightGrams / 1000) : "");
    setEditHeightCm(r.heightCm ? String(r.heightCm) : "");
    setEditMeasuredDate(r.measuredAt);
  };

  const handleEditGrowthSubmit = () => {
    if (!editGrowthId) return;
    const data: any = { measuredAt: editMeasuredDate };
    if (editWeightG) data.weightGrams = Math.round(parseFloat(editWeightG) * 1000);
    else data.weightGrams = null;
    if (editHeightCm) data.heightCm = parseFloat(editHeightCm);
    else data.heightCm = null;
    updateGrowth.mutate({ id: editGrowthId, data }, {
      onSuccess: () => setEditGrowthId(null),
    });
  };

  const toggleVaccineSelection = (vaccineId: string) => {
    setSelectedVaccineIds((prev) => {
      const next = new Set(prev);
      if (next.has(vaccineId)) {
        next.delete(vaccineId);
      } else {
        next.add(vaccineId);
      }
      return next;
    });
  };

  const handleVaccinateBatch = () => {
    if (!vaccineDate) {
      toast({ title: "接種日を入力してください", variant: "destructive" });
      return;
    }
    const toRecord = filteredVaccineDefs.filter(v => selectedVaccineIds.has(v.id));
    const dateToSave = vaccineDate;
    toRecord.forEach((vaccine) => {
      createLog.mutate({
        type: "vaccination",
        subType: vaccine.id,
        message: `${vaccine.name}を接種しました`,
        createdAt: `${dateToSave}T09:00:00`,
      });
      createVaccinationRecord.mutate({
        familyId,
        childId: activeChildId ?? undefined,
        vaccineId: vaccine.id,
        administeredDate: dateToSave,
      });
    });

    const customToRecord = (customVaccinesData as any[]).filter((cv: any) => selectedVaccineIds.has(`custom_${cv.id}`));
    customToRecord.forEach((cv: any) => {
      const customVaccineId = `custom_${cv.id}`;
      createLog.mutate({
        type: "vaccination",
        subType: customVaccineId,
        message: `${cv.name}を接種しました`,
        createdAt: `${dateToSave}T09:00:00`,
      });
      createVaccinationRecord.mutate({
        familyId,
        childId: activeChildId ?? undefined,
        vaccineId: customVaccineId,
        administeredDate: dateToSave,
      });
    });

    setSelectedVaccineIds(new Set());
    setVaccineDate(format(new Date(), "yyyy-MM-dd"));
    setShowVaccineDialog(false);
  };

  const handleTempSubmit = () => {
    const temp = parseFloat(tempValue);
    if (isNaN(temp) || temp < 35.0 || temp > 40.5) return;
    const userId = localStorage.getItem("userType") || "papa";
    createLog.mutate({
      type: "temp",
      bodyTemperature: temp,
      message: `体温 ${temp}°C`,
    });
    setShowTempDialog(false);
    setTempValue("36.5");
  };

  const handleSymptomSubmit = () => {
    if (selectedSymptoms.size === 0 && !symptomNote.trim()) return;
    createLog.mutate({
      type: "symptom",
      symptoms: Array.from(selectedSymptoms).join(","),
      symptomNote: symptomNote.trim() || undefined,
      message: `症状: ${Array.from(selectedSymptoms).map(s => SYMPTOM_CHECKLIST.find(c => c.id === s)?.label || s).join("、")}`,
    });
    setSelectedSymptoms(new Set());
    setSymptomNote("");
    setShowSymptomDialog(false);
  };

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleHealthRecordSubmit = () => {
    if (!hrTitle.trim()) return;
    createHealthRecord.mutate({
      familyId,
      childId: activeChildId || undefined,
      type: healthRecordType,
      title: hrTitle.trim(),
      detail: hrDetail.trim() || undefined,
      recordedAt: hrDate || undefined,
    }, {
      onSuccess: () => {
        setHrTitle("");
        setHrDetail("");
        setHrDate("");
        setShowHealthRecordDialog(false);
      },
    });
  };

  const handleBloodTypeUpdate = (bt: string) => {
    if (activeChildId) {
      updateChild.mutate({ id: activeChildId, bloodType: bt });
    }
    setShowBloodTypeDialog(false);
  };

  const handlePdfExport = () => {
    if (pdfExporting) return;
    setPdfExporting(true);
    try {
      const childName = activeChild?.name || settings?.babyName || "お子さま";
      const birthday = activeChild?.birthday || settings?.babyBirthday || null;
      const gender = activeChild?.gender || null;
      const bloodType = activeChild?.bloodType || null;
      const vaccineLogs = logs ? logs.filter((l: any) => l.type === "vaccination") : [];
      generateHealthSummaryPdf({
        childName,
        birthday,
        gender,
        bloodType,
        vaccinationLogs: vaccineLogs,
        healthRecords: healthRecords as any[],
      });
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setPdfExporting(false);
    }
  };

  const openAddHealthRecord = (type: "allergy" | "medical_history" | "health_note") => {
    setHealthRecordType(type);
    setHrTitle("");
    setHrDetail("");
    setHrDate("");
    setShowHealthRecordDialog(true);
  };

  const allergies = useMemo(() => (healthRecords as any[]).filter(r => r.type === "allergy"), [healthRecords]);
  const medicalHistoryItems = useMemo(() => (healthRecords as any[]).filter(r => r.type === "medical_history"), [healthRecords]);
  const healthNotes = useMemo(() => (healthRecords as any[]).filter(r => r.type === "health_note"), [healthRecords]);

  const isLoading = logsLoading || growthLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-green-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-green-50 pb-24">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-purple-100">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 py-3">
          <Button
            data-testid="button-health-back"
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-black">
            {activeChild?.name || settings?.babyName || "赤ちゃん"}の健康・成長
          </h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <HealthLogTab
          healthLogs={healthLogs}
          months={months}
          completedVaccineIds={completedVaccineIds}
          onOpenVaccine={() => setShowVaccineDialog(true)}
          onOpenTemp={() => setShowTempDialog(true)}
          onOpenSymptom={() => setShowSymptomDialog(true)}
          onAddGrowth={() => setShowGrowthForm(true)}
          onEditGrowth={openEditGrowth}
          onDeleteGrowth={(id) => setDeleteGrowthId(id)}
          latestGrowth={latestGrowth}
          sortedGrowth={sortedGrowth}
          onEditLog={setEditingHealthLog}
          onDeleteLog={(id) => { if (confirm("この記録を削除しますか？")) deleteLog.mutate(id); }}
          vaccinationRecordMap={vaccinationRecordMap}
          birthday={birthday}
          gender={activeChild?.gender}
          filteredVaccineDefs={filteredVaccineDefs}
        />

        {userType === "mama" && (
          <Card className="rounded-3xl border border-pink-100 bg-pink-50/50 overflow-hidden">
            <div className="p-4 border-b border-pink-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-pink-100 p-2 rounded-xl">
                  <Heart className="w-4 h-4 text-pink-500" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-pink-800">ママのからだ記録</h3>
                  <p className="text-[10px] text-pink-400">あなただけに表示される記録です</p>
                </div>
              </div>
              {todayMamaLog && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openMamaHealthDialog(todayMamaLog)}
                  className="text-pink-600 text-xs font-bold h-8"
                  data-testid="button-mama-health-edit"
                >
                  <Pencil className="w-3 h-3 mr-1" />編集
                </Button>
              )}
            </div>

            {allMamaLogs.length > 1 && (
              <button
                onClick={() => setShowMamaHistory(!showMamaHistory)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-b border-pink-100 text-xs font-bold text-pink-500 hover:bg-pink-50/50 transition-colors"
                data-testid="button-mama-history-toggle"
              >
                <span>過去の記録 ({allMamaLogs.length}件)</span>
                <span>{showMamaHistory ? "▲ 閉じる" : "▼ 見る"}</span>
              </button>
            )}

            {showMamaHistory && (
              <div className="divide-y divide-pink-50 max-h-[50vh] overflow-y-auto">
                {allMamaLogs
                  .slice()
                  .sort((a: any, b: any) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
                  .map((log: any) => {
                    const logDate = new Date(log.loggedAt);
                    const isToday = new Date().toDateString() === logDate.toDateString();
                    return (
                      <div key={log.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-black text-pink-700">
                            {format(logDate, "M月d日（E）", { locale: ja })}
                            {isToday && <span className="ml-1.5 bg-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">今日</span>}
                          </p>
                          <button
                            onClick={() => openMamaHealthDialog(log)}
                            className="text-[10px] font-bold text-pink-400 flex items-center gap-0.5"
                            data-testid={`button-mama-log-edit-${log.id}`}
                          >
                            <Pencil className="w-2.5 h-2.5" />編集
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {log.bowel != null && (
                            <span className="bg-pink-50 text-pink-700 border border-pink-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              お通じ {log.bowel ? "あり" : "なし"}
                            </span>
                          )}
                          {log.lochia && (
                            <span className="bg-pink-50 text-pink-700 border border-pink-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              悪露 {({"heavy":"多め","normal":"普通","light":"少なめ","none":"なし"} as Record<string,string>)[log.lochia] || log.lochia}
                            </span>
                          )}
                          {log.perinealPain != null && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              痛み {log.perinealPain}/4
                            </span>
                          )}
                          {log.mood != null && (
                            <span className="bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              気分 {["辛い","少し辛い","普通","まあまあ","良好"][log.mood]}
                            </span>
                          )}
                          {log.sleepHours != null && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              睡眠 {Math.floor(log.sleepHours)}h{Math.round((log.sleepHours % 1) * 60) > 0 ? `${Math.round((log.sleepHours % 1) * 60)}m` : ""}
                            </span>
                          )}
                          {log.weightKg != null && (
                            <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {log.weightKg}kg{log.swelling != null ? (log.swelling ? " むくみ○" : " むくみ×") : ""}
                            </span>
                          )}
                          {log.nursingIssues && log.nursingIssues.length > 0 && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              授乳: {log.nursingIssues.join("・")}
                            </span>
                          )}
                        </div>
                        {(log.bowelNote || log.nursingNote) && (
                          <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                            {[log.bowelNote, log.nursingNote].filter(Boolean).join(" / ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            <button
              onClick={openCaregiverMedDialog}
              data-testid="button-caregiver-med-open"
              className="w-full flex items-center gap-3 px-4 py-3 border-t border-pink-100 text-left hover:bg-pink-50/50 transition-colors"
            >
              <div className="bg-violet-100 p-1.5 rounded-xl shrink-0">
                <Pill className="w-4 h-4 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-violet-700">自分のお薬を記録</p>
                {cmLastMed && (() => {
                  const lastAt = new Date(cmLastMed.createdAt);
                  const minAgo = differenceInMinutes(new Date(), lastAt);
                  const hAgo = Math.floor(minAgo / 60);
                  const mAgo = minAgo % 60;
                  return (
                    <p className="text-[10px] text-violet-400 mt-0.5 truncate">
                      最後: {cmLastMed.medicineName} — {hAgo > 0 ? `${hAgo}時間${mAgo}分前` : `${mAgo}分前`}
                    </p>
                  );
                })()}
              </div>
              <Plus className="w-4 h-4 text-violet-400 shrink-0" />
            </button>

            {todayMamaLog ? (
              <div className="p-4 grid grid-cols-2 gap-2.5 text-xs">
                {todayMamaLog.bowel != null && (
                  <div className="bg-white rounded-2xl px-3 py-2 border border-pink-100">
                    <p className="text-[10px] text-gray-400 font-bold">お通じ</p>
                    <p className="font-bold text-gray-700">{todayMamaLog.bowel ? "あり" : "なし"}</p>
                    {todayMamaLog.bowelNote && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{todayMamaLog.bowelNote}</p>}
                  </div>
                )}
                {todayMamaLog.lochia && (
                  <div className="bg-white rounded-2xl px-3 py-2 border border-pink-100">
                    <p className="text-[10px] text-gray-400 font-bold">悪露</p>
                    <p className="font-bold text-gray-700">{({"heavy": "多め", "normal": "普通", "light": "少なめ", "none": "なし"} as Record<string,string>)[todayMamaLog.lochia!] || todayMamaLog.lochia}</p>
                  </div>
                )}
                {todayMamaLog.perinealPain != null && (
                  <div className="bg-white rounded-2xl px-3 py-2 border border-pink-100">
                    <p className="text-[10px] text-gray-400 font-bold">会陰の痛み</p>
                    <p className="font-bold text-gray-700">{["なし", "少し", "中程度", "かなり", "とても痛い"][todayMamaLog.perinealPain]}</p>
                  </div>
                )}
                {todayMamaLog.mood != null && (
                  <div className="bg-white rounded-2xl px-3 py-2 border border-pink-100">
                    <p className="text-[10px] text-gray-400 font-bold">気分・メンタル</p>
                    <p className="font-bold text-gray-700">{["とても辛い", "辛い", "普通", "まあまあ", "良好"][todayMamaLog.mood]}</p>
                  </div>
                )}
                {todayMamaLog.sleepHours != null && (
                  <div className="bg-white rounded-2xl px-3 py-2 border border-pink-100">
                    <p className="text-[10px] text-gray-400 font-bold">睡眠</p>
                    <p className="font-bold text-gray-700">{Math.floor(todayMamaLog.sleepHours)}時間{Math.round((todayMamaLog.sleepHours % 1) * 60) > 0 ? `${Math.round((todayMamaLog.sleepHours % 1) * 60)}分` : ""}</p>
                  </div>
                )}
                {todayMamaLog.weightKg != null && (
                  <div className="bg-white rounded-2xl px-3 py-2 border border-pink-100">
                    <p className="text-[10px] text-gray-400 font-bold">体重</p>
                    <p className="font-bold text-gray-700">{todayMamaLog.weightKg}kg{todayMamaLog.swelling != null ? (todayMamaLog.swelling ? " / むくみあり" : " / むくみなし") : ""}</p>
                  </div>
                )}
                {todayMamaLog.nursingIssues && todayMamaLog.nursingIssues.length > 0 && (
                  <div className="bg-white rounded-2xl px-3 py-2 border border-pink-100 col-span-2">
                    <p className="text-[10px] text-gray-400 font-bold">授乳トラブル</p>
                    <p className="font-bold text-gray-700">{todayMamaLog.nursingIssues.join("・")}</p>
                    {todayMamaLog.nursingNote && <p className="text-[10px] text-gray-500 mt-0.5">{todayMamaLog.nursingNote}</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4">
                <Button
                  onClick={() => openMamaHealthDialog()}
                  className="w-full h-12 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-black shadow-lg shadow-pink-100"
                  data-testid="button-mama-health-new"
                >
                  今日の記録を入力
                </Button>
              </div>
            )}
          </Card>
        )}

        <Card className="p-4 rounded-3xl" data-testid="card-health-summary">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-100 p-2 rounded-2xl shrink-0">
              <ClipboardList className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-gray-700">園提出用データ</p>
              <p className="text-[10px] text-gray-400">アレルギー・既往歴・体質メモ</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-gray-600">血液型</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBloodTypeDialog(true)}
                  className="text-xs text-purple-600 font-bold rounded-full h-7"
                  data-testid="button-edit-blood-type"
                >
                  {activeChild?.bloodType || "未登録"} {activeChild?.bloodType ? "" : "/ 設定する"}
                </Button>
              </div>
            </div>

            <HealthRecordSection
              title="アレルギー"
              icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
              items={allergies}
              onAdd={() => openAddHealthRecord("allergy")}
              onDelete={(id) => deleteHealthRecord.mutate(id)}
              emptyText="登録なし"
              testId="section-allergies"
            />

            <HealthRecordSection
              title="既往歴"
              icon={<Stethoscope className="w-4 h-4 text-rose-500" />}
              items={medicalHistoryItems}
              onAdd={() => openAddHealthRecord("medical_history")}
              onDelete={(id) => deleteHealthRecord.mutate(id)}
              emptyText="登録なし"
              showDate
              testId="section-medical-history"
            />

            <HealthRecordSection
              title="体質・園への申し送り"
              icon={<ClipboardList className="w-4 h-4 text-teal-500" />}
              items={healthNotes}
              onAdd={() => openAddHealthRecord("health_note")}
              onDelete={(id) => deleteHealthRecord.mutate(id)}
              emptyText="登録なし"
              testId="section-health-notes"
            />
          </div>

          <Button
            onClick={handlePdfExport}
            disabled={pdfExporting}
            className="w-full mt-4 rounded-2xl bg-purple-500 text-white font-bold gap-2"
            data-testid="button-health-summary-pdf"
          >
            <FileDown className="w-4 h-4" />
            {pdfExporting ? "作成中..." : "提出用データの書き出し"}
          </Button>
        </Card>
      </div>

      <Dialog open={showGrowthForm} onOpenChange={setShowGrowthForm}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">
              身体測定を記録
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs flex items-center gap-1"><Weight className="w-3.5 h-3.5" /> 体重 (kg)</Label>
              <form onSubmit={(e) => e.preventDefault()}>
                <Input data-testid="input-weight" type="text" inputMode="decimal" placeholder="例: 6.5" value={weightG} onChange={(e) => setWeightG(e.target.value)} className="rounded-xl border-2" />
              </form>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> 身長 (cm)</Label>
              <form onSubmit={(e) => e.preventDefault()}>
                <Input data-testid="input-height" type="text" inputMode="decimal" placeholder="例: 65.0" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="rounded-xl border-2" />
              </form>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs">測定日</Label>
              <form onSubmit={(e) => e.preventDefault()}>
                <Input data-testid="input-growth-date" type="date" value={measuredDate} onChange={(e) => setMeasuredDate(e.target.value)} className="rounded-xl border-2" />
              </form>
            </div>
            <Button data-testid="button-growth-submit" onClick={handleGrowthSubmit} disabled={!weightG && !heightCm} className="w-full rounded-2xl bg-green-500 text-white font-black shadow-lg shadow-green-100">
              記録する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 成長記録 編集ダイアログ */}
      <Dialog open={editGrowthId !== null} onOpenChange={(o) => { if (!o) setEditGrowthId(null); }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">測定記録を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs flex items-center gap-1"><Weight className="w-3.5 h-3.5" /> 体重 (kg)</Label>
              <form onSubmit={(e) => e.preventDefault()}>
                <Input type="text" inputMode="decimal" placeholder="例: 6.5" value={editWeightG} onChange={(e) => setEditWeightG(e.target.value)} className="rounded-xl border-2" />
              </form>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> 身長 (cm)</Label>
              <form onSubmit={(e) => e.preventDefault()}>
                <Input type="text" inputMode="decimal" placeholder="例: 65.0" value={editHeightCm} onChange={(e) => setEditHeightCm(e.target.value)} className="rounded-xl border-2" />
              </form>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs">測定日</Label>
              <form onSubmit={(e) => e.preventDefault()}>
                <Input type="date" value={editMeasuredDate} onChange={(e) => setEditMeasuredDate(e.target.value)} className="rounded-xl border-2" />
              </form>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditGrowthId(null)} className="flex-1 rounded-2xl">キャンセル</Button>
              <Button onClick={handleEditGrowthSubmit} disabled={updateGrowth.isPending} className="flex-1 rounded-2xl bg-green-500 text-white font-black">保存する</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 成長記録 削除確認ダイアログ */}
      <Dialog open={deleteGrowthId !== null} onOpenChange={(o) => { if (!o) setDeleteGrowthId(null); }}>
        <DialogContent className="sm:max-w-xs rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-center text-red-600">測定記録を削除</DialogTitle>
          </DialogHeader>
          <div className="py-2 px-2 space-y-4">
            <p className="text-sm text-gray-600 text-center">この測定記録を削除しますか？</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteGrowthId(null)} className="flex-1 rounded-2xl">キャンセル</Button>
              <Button
                variant="destructive"
                disabled={deleteGrowth.isPending}
                onClick={() => {
                  if (deleteGrowthId) deleteGrowth.mutate(deleteGrowthId, { onSuccess: () => setDeleteGrowthId(null) });
                }}
                className="flex-1 rounded-2xl"
              >削除する</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTempDialog} onOpenChange={setShowTempDialog}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center flex items-center justify-center gap-2">
              <Thermometer className="w-5 h-5 text-red-500" />
              体温を記録
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const tv = parseFloat(tempValue);
            const isHigh = tv >= 38.5;
            const isMild = tv >= 37.5 && tv < 38.5;
            const tempColor = isHigh ? "text-red-600" : isMild ? "text-orange-500" : "text-green-600";
            const tempBg = isHigh ? "bg-red-50" : isMild ? "bg-orange-50" : "bg-green-50";
            const tempBorder = isHigh ? "border-red-200" : isMild ? "border-orange-200" : "border-green-200";
            const statusLabel = isHigh ? "高熱" : isMild ? "微熱" : "平熱";
            const statusBadgeBg = isHigh ? "bg-red-500" : isMild ? "bg-orange-400" : "bg-green-500";
            const sliderAccent = isHigh ? "accent-red-500" : isMild ? "accent-orange-500" : "accent-green-500";
            const btnClass = isHigh
              ? "bg-red-500 text-white shadow-lg shadow-red-100"
              : isMild
                ? "bg-orange-500 text-white shadow-lg shadow-orange-100"
                : "bg-green-600 text-white shadow-lg shadow-green-100";

            return (
              <div className="space-y-5 py-4 px-2">
                <div className={`text-center p-6 rounded-3xl border-2 ${tempBg} ${tempBorder} transition-all`}>
                  <p className={`text-5xl font-black tabular-nums ${tempColor} transition-colors`}>
                    {tempValue}<span className="text-2xl opacity-60">°C</span>
                  </p>
                  <span className={`inline-block mt-2 px-3 py-0.5 rounded-full text-[10px] font-black text-white ${statusBadgeBg}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="35.0"
                    max="40.5"
                    step="0.1"
                    value={tempValue}
                    onChange={(e) => setTempValue(parseFloat(e.target.value).toFixed(1))}
                    className={`w-full h-3 rounded-full appearance-none cursor-pointer ${sliderAccent}`}
                    data-testid="input-temp-slider"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 font-bold px-1">
                    <span>35.0°C</span>
                    <span>40.5°C</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="35.0"
                    max="40.5"
                    step="0.1"
                    value={tempValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTempValue(v);
                    }}
                    className={`flex-1 text-center text-lg font-black py-2.5 rounded-2xl border-2 ${tempBorder} ${tempBg} focus:outline-none focus:ring-2 focus:ring-purple-200 tabular-nums`}
                    data-testid="input-temp-number"
                  />
                  <span className="text-sm font-bold text-gray-400">°C</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {["36.0", "36.5", "37.0", "37.5", "38.0", "38.5", "39.0", "40.0"].map((v) => {
                    const pv = parseFloat(v);
                    const presetHigh = pv >= 38.5;
                    const presetMild = pv >= 37.5 && pv < 38.5;
                    const active = tempValue === v;
                    let presetCls = "";
                    if (active) {
                      presetCls = presetHigh ? "bg-red-100 border-red-300 text-red-600" : presetMild ? "bg-orange-100 border-orange-300 text-orange-600" : "bg-green-100 border-green-300 text-green-600";
                    }
                    return (
                      <Button
                        key={v}
                        variant="outline"
                        onClick={() => setTempValue(v)}
                        className={`rounded-2xl font-bold text-xs ${presetCls}`}
                        data-testid={`button-temp-preset-${v}`}
                      >
                        {v}°
                      </Button>
                    );
                  })}
                </div>

                <Button
                  onClick={handleTempSubmit}
                  disabled={createLog.isPending || isNaN(tv) || tv < 35.0 || tv > 40.5}
                  className={`w-full rounded-2xl font-black ${btnClass}`}
                  data-testid="button-temp-submit"
                >
                  {createLog.isPending ? "記録中..." : `${tempValue}°Cで記録する`}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showSymptomDialog} onOpenChange={(open) => {
        setShowSymptomDialog(open);
        if (!open) { setSelectedSymptoms(new Set()); setSymptomNote(""); }
      }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none max-h-[85vh] flex flex-col p-0">
          <div className="px-6 pt-6 pb-3 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-center flex items-center justify-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-500" />
                症状メモ
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-gray-400 text-center mt-2">
              気になる症状を選択してください
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 space-y-3 pb-4">
            {SYMPTOM_CHECKLIST.map((symptom) => {
              const IconComp = symptom.icon;
              const isSelected = selectedSymptoms.has(symptom.id);
              return (
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all ${
                    isSelected
                      ? "bg-teal-50 border-teal-400 ring-2 ring-teal-200"
                      : "bg-white border-gray-100 hover-elevate"
                  }`}
                  data-testid={`button-symptom-${symptom.id}`}
                >
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? "bg-teal-500 border-teal-500"
                      : "border-gray-300 bg-white"
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className={`p-1.5 rounded-xl ${symptom.bg}`}>
                    <IconComp className={`w-4 h-4 ${symptom.color}`} />
                  </div>
                  <span className={`text-sm font-bold flex-1 text-left ${isSelected ? "text-teal-700" : "text-gray-700"}`}>
                    {symptom.label}
                  </span>
                </button>
              );
            })}

            <div className="space-y-2 pt-2">
              <Label className="font-bold text-xs text-gray-500">備考（自由入力）</Label>
              <textarea
                value={symptomNote}
                onChange={(e) => setSymptomNote(e.target.value)}
                placeholder="その他の症状や気になったことをメモ..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300"
                data-testid="input-symptom-note"
              />
            </div>
          </div>

          <div className="px-6 pb-6 pt-3 border-t border-gray-100 shrink-0">
            <Button
              onClick={handleSymptomSubmit}
              disabled={(selectedSymptoms.size === 0 && !symptomNote.trim()) || createLog.isPending}
              className="w-full rounded-2xl bg-teal-500 text-white font-black shadow-lg shadow-teal-100"
              data-testid="button-symptom-submit"
            >
              <Stethoscope className="w-4 h-4 mr-2" />
              {createLog.isPending ? "記録中..." :
                selectedSymptoms.size > 0
                  ? `${selectedSymptoms.size}件の症状を記録する`
                  : symptomNote.trim() ? "メモを記録する" : "症状を選択してください"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVaccineDialog} onOpenChange={(open) => {
        setShowVaccineDialog(open);
        if (!open) {
          setSelectedVaccineIds(new Set());
          setVaccineDate(format(new Date(), "yyyy-MM-dd"));
        }
      }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none max-h-[85vh] flex flex-col p-0">
          <div className="px-6 pt-6 pb-3 space-y-3 shrink-0">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center gap-2 bg-cyan-50 px-4 py-2 rounded-2xl">
                <Syringe className="w-5 h-5 text-cyan-600" />
                <span className="text-lg font-black text-cyan-800">予防接種の記録</span>
              </div>
              <p className="text-2xl font-black text-gray-800">
                生後{months}ヶ月
              </p>
              <p className="text-xs text-gray-400 font-bold">
                {completedVaccineIds.size}/{filteredVaccineDefs.length} 接種済
              </p>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed text-center">
              標準的なスケジュールに基づいています。必ず母子手帳と予診票をご確認ください。
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-cyan-700">ロタウイルスワクチンの種類</p>
              {!rotaType ? (
                <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-xs font-bold text-amber-700">ワクチンの種類を選択してください</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      data-testid="button-rota-rotarix"
                      onClick={() => handleRotaTypeChange("rotarix")}
                      className="p-3 rounded-xl border-2 border-gray-200 bg-white text-center space-y-1 active:scale-95 transition-transform"
                    >
                      <p className="text-xs font-black text-gray-700">ロタリックス</p>
                      <p className="text-[10px] font-bold text-cyan-600">1価・2回接種</p>
                    </button>
                    <button
                      data-testid="button-rota-rotateq"
                      onClick={() => handleRotaTypeChange("rotateq")}
                      className="p-3 rounded-xl border-2 border-gray-200 bg-white text-center space-y-1 active:scale-95 transition-transform"
                    >
                      <p className="text-xs font-black text-gray-700">ロタテック</p>
                      <p className="text-[10px] font-bold text-cyan-600">5価・3回接種</p>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`flex-1 p-2.5 rounded-xl border-2 ${rotaType === "rotarix" ? "bg-cyan-50 border-cyan-300" : "bg-white border-gray-100"}`}>
                    <button
                      data-testid="button-rota-select-rotarix"
                      onClick={() => handleRotaTypeChange("rotarix")}
                      className="w-full text-left"
                    >
                      <p className={`text-xs font-bold ${rotaType === "rotarix" ? "text-cyan-700" : "text-gray-400"}`}>
                        ロタリックス（2回）
                      </p>
                    </button>
                  </div>
                  <div className={`flex-1 p-2.5 rounded-xl border-2 ${rotaType === "rotateq" ? "bg-cyan-50 border-cyan-300" : "bg-white border-gray-100"}`}>
                    <button
                      data-testid="button-rota-select-rotateq"
                      onClick={() => handleRotaTypeChange("rotateq")}
                      className="w-full text-left"
                    >
                      <p className={`text-xs font-bold ${rotaType === "rotateq" ? "text-cyan-700" : "text-gray-400"}`}>
                        ロタテック（3回）
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {sortedVaccineAgeGroups.map((group) => {
              const groupCompleted = group.vaccines.filter((v) => completedVaccineIds.has(v.id)).length;
              const isCurrent = months >= group.minMonths && months <= group.maxMonths;
              const isPast = months > group.maxMonths;
              const isFuture = months < group.minMonths;
              const isOpen = openVaccineGroups.has(group.label);
              const toggleGroup = () => setOpenVaccineGroups(prev => {
                const next = new Set(prev);
                if (next.has(group.label)) next.delete(group.label);
                else next.add(group.label);
                return next;
              });

              return (
                <div key={group.label} className={`rounded-2xl border-2 overflow-hidden ${
                  isCurrent ? "border-cyan-300 bg-cyan-50/50" :
                  isPast ? "border-gray-100 bg-gray-50/50" :
                  "border-blue-100 bg-blue-50/30"
                }`}>
                  <button
                    onClick={toggleGroup}
                    className="w-full flex items-center justify-between px-3.5 py-3"
                    data-testid={`button-vaccine-group-${group.label}`}
                  >
                    <div className="flex items-center gap-2">
                      {isCurrent && <span className="text-[10px] font-black text-white bg-cyan-500 px-2 py-0.5 rounded-full">現在</span>}
                      {isPast && <span className="text-[10px] font-black text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">完了期</span>}
                      {isFuture && <span className="text-[10px] font-black text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">今後</span>}
                      <p className={`text-xs font-bold ${isCurrent ? "text-cyan-700" : isPast ? "text-gray-400" : "text-blue-600"}`}>{group.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${isPast && groupCompleted === group.vaccines.length ? "text-green-500" : "text-gray-400"}`}>
                        {groupCompleted}/{group.vaccines.length} 済
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {isOpen && <div className="px-3.5 pb-3.5 space-y-2">

                  {group.vaccines.map((vaccine) => {
                    const done = completedVaccineIds.has(vaccine.id);
                    const selected = selectedVaccineIds.has(vaccine.id);
                    const record = vaccinationRecordMap.get(vaccine.id);
                    const status = getVaccineStatus(vaccine.id, completedVaccineIds, months);
                    const standardDate = birthday ? getStandardScheduleDate(vaccine.id, birthday) : "";

                    let nextDoseInfo: ReturnType<typeof getNextDoseRecommendation> = null;
                    const activeRotaIds = getActiveRotaVaccineIds(rotaType);
                    const effectiveNextDoseId = vaccine.nextDoseId && (vaccine.group !== "ロタ" || activeRotaIds.has(vaccine.nextDoseId)) ? vaccine.nextDoseId : null;
                    if (done && record && effectiveNextDoseId && !completedVaccineIds.has(effectiveNextDoseId)) {
                      const nextVaccine = getVaccineById(effectiveNextDoseId);
                      if (nextVaccine && nextVaccine.minIntervalDays) {
                        const baseRecord = nextVaccine.previousDoseId
                          ? vaccinationRecordMap.get(nextVaccine.previousDoseId)
                          : record;
                        if (baseRecord) {
                          const recommended = addDays(parseISO(baseRecord.administeredDate), nextVaccine.minIntervalDays);
                          nextDoseInfo = {
                            nextVaccineId: nextVaccine.id,
                            nextVaccineName: nextVaccine.name,
                            recommendedDate: format(recommended, "yyyy-MM-dd"),
                            minIntervalDays: nextVaccine.minIntervalDays,
                          };
                        }
                      }
                    }

                    return (
                      <div key={vaccine.id} className="space-y-1">
                        <button
                          onClick={() => !done && toggleVaccineSelection(vaccine.id)}
                          disabled={done}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all ${
                            done
                              ? "bg-green-50 border-green-200"
                              : selected
                                ? "bg-cyan-50 border-cyan-400 ring-2 ring-cyan-200"
                                : status === "overdue"
                                  ? "bg-orange-50 border-orange-200"
                                  : status === "upcoming"
                                    ? "bg-blue-50 border-blue-200"
                                    : "bg-white border-gray-100"
                          }`}
                          data-testid={`button-vaccine-${vaccine.id}`}
                        >
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                            done
                              ? "bg-green-500 border-green-500"
                              : selected
                                ? "bg-cyan-500 border-cyan-500"
                                : "border-gray-300 bg-white"
                          }`}>
                            {(done || selected) && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-bold ${done ? "text-green-700" : "text-gray-700"}`}>
                                {vaccine.name}
                              </p>
                              {vaccine.isOptional && (
                                <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">任意</span>
                              )}
                            </div>
                            {done && record ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-green-500" />
                                <p className="text-[10px] text-green-600 font-bold">
                                  {format(parseISO(record.administeredDate), "yyyy年M月d日")}に接種
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[10px] text-gray-400">標準: {vaccine.standardAgeMonths}ヶ月〜</p>
                                {standardDate && (
                                  <p className="text-[10px] text-blue-400">
                                    ({format(parseISO(standardDate), "yyyy/M/d")}頃)
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          {done ? (
                            <span className="text-[10px] font-bold text-white bg-green-500 px-2 py-0.5 rounded-full shrink-0">済</span>
                          ) : status === "overdue" ? (
                            <span className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full shrink-0">要確認</span>
                          ) : status === "upcoming" ? (
                            <span className="text-[10px] font-bold text-white bg-blue-500 px-2 py-0.5 rounded-full shrink-0">時期</span>
                          ) : null}
                        </button>

                        {nextDoseInfo && nextDoseInfo.recommendedDate && (
                          <div className="ml-9 px-3 py-2 bg-cyan-50 rounded-xl border border-cyan-100">
                            <p className="text-[10px] font-bold text-cyan-700 flex items-center gap-1">
                              <Syringe className="w-3 h-3" />
                              次回: {nextDoseInfo.nextVaccineName}
                            </p>
                            <p className="text-[10px] text-cyan-600 mt-0.5">
                              {format(parseISO(nextDoseInfo.recommendedDate), "yyyy年M月d日")}以降
                              <span className="text-gray-400 ml-1">(前回から{nextDoseInfo.minIntervalDays}日後〜)</span>
                            </p>
                          </div>
                        )}

                        {done && record && (
                          <div className="ml-9 flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingVaccineRecord(record);
                                setEditVaccineDate(record.administeredDate);
                              }}
                              className="h-6 text-[10px] text-gray-400 px-2"
                              data-testid={`button-edit-vaccine-${vaccine.id}`}
                            >
                              日付を変更
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("この接種記録を削除しますか？")) {
                                  deleteVaccinationRecord.mutate(record.id);
                                }
                              }}
                              className="h-6 text-[10px] text-red-400 px-2"
                              data-testid={`button-delete-vaccine-${vaccine.id}`}
                            >
                              削除
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>}
                </div>
              );
            })}

            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 mb-2">その他のワクチン</p>
              {(customVaccinesData as any[]).map((cv: any) => {
                const customVaccineId = `custom_${cv.id}`;
                const isCompleted = completedVaccineIdsFromRecords.has(customVaccineId);
                const isSelected = selectedVaccineIds.has(customVaccineId);
                const record = vaccinationRecordMap.get(customVaccineId);
                return (
                  <div key={cv.id} className="flex items-center gap-2 mb-2">
                    <button
                      data-testid={`button-custom-vaccine-${cv.id}`}
                      onClick={() => {
                        if (isCompleted) {
                          if (record) { setEditingVaccineRecord({ ...record, vaccineName: cv.name }); setEditVaccineDate(record.administeredDate); }
                          return;
                        }
                        toggleVaccineSelection(customVaccineId);
                      }}
                      className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${
                        isCompleted
                          ? "bg-cyan-50 border-cyan-300"
                          : isSelected
                          ? "bg-cyan-100 border-cyan-400 ring-2 ring-cyan-200"
                          : "bg-white border-gray-100"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isCompleted ? "bg-cyan-500 border-cyan-500" : isSelected ? "bg-cyan-400 border-cyan-400" : "border-gray-300"
                      }`}>
                        {(isCompleted || isSelected) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-xs font-bold ${isCompleted ? "text-cyan-700" : "text-gray-700"}`}>
                        {cv.name}
                      </span>
                      {isCompleted && record && (
                        <span className="text-[10px] text-cyan-600 ml-auto">{record.administeredDate}</span>
                      )}
                    </button>
                    {!isCompleted && (
                      <button
                        data-testid={`button-delete-custom-vaccine-${cv.id}`}
                        onClick={() => deleteCustomVaccine.mutate(cv.id)}
                        className="p-1.5 rounded-lg text-gray-300 active:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2 mt-2">
                <Input
                  data-testid="input-custom-vaccine-name"
                  placeholder="ワクチン名を入力"
                  value={newCustomVaccineName}
                  onChange={(e) => setNewCustomVaccineName(e.target.value)}
                  className="flex-1 rounded-xl border-2 text-sm h-10"
                />
                <Button
                  data-testid="button-add-custom-vaccine"
                  onClick={() => {
                    if (!newCustomVaccineName.trim()) return;
                    createCustomVaccine.mutate({
                      familyId,
                      childId: activeChildId ?? undefined,
                      name: newCustomVaccineName.trim(),
                    });
                    setNewCustomVaccineName("");
                  }}
                  disabled={!newCustomVaccineName.trim() || createCustomVaccine.isPending}
                  className="h-10 rounded-xl bg-cyan-500 text-white font-bold px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-3 border-t border-gray-100 shrink-0 space-y-3">
            {selectedVaccineIds.size > 0 && (
              <div className="space-y-1.5">
                <Label className="font-bold text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> 接種日
                </Label>
                <Input
                  type="date"
                  value={vaccineDate}
                  onChange={(e) => setVaccineDate(e.target.value)}
                  className="rounded-xl border-2"
                  data-testid="input-vaccine-date"
                />
              </div>
            )}
            <Button
              onClick={handleVaccinateBatch}
              disabled={selectedVaccineIds.size === 0 || createLog.isPending}
              className="w-full rounded-2xl bg-cyan-500 text-white font-black shadow-lg shadow-cyan-100"
              data-testid="button-vaccine-submit"
            >
              <Syringe className="w-4 h-4 mr-2" />
              {selectedVaccineIds.size > 0
                ? `選択した${selectedVaccineIds.size}件を記録する`
                : "接種したワクチンを選択してください"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingVaccineRecord} onOpenChange={(open) => {
        if (!open) setEditingVaccineRecord(null);
      }}>
        <DialogContent className="sm:max-w-sm rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-center">接種日を変更</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> 接種日
              </Label>
              <Input
                type="date"
                value={editVaccineDate}
                onChange={(e) => setEditVaccineDate(e.target.value)}
                className="rounded-xl border-2"
                data-testid="input-edit-vaccine-date"
              />
            </div>
            <Button
              onClick={() => {
                if (editingVaccineRecord && editVaccineDate) {
                  updateVaccinationRecord.mutate(
                    {
                      id: editingVaccineRecord.id,
                      administeredDate: editVaccineDate,
                    },
                    {
                      onSuccess: () => setEditingVaccineRecord(null),
                    }
                  );
                }
              }}
              disabled={!editVaccineDate || updateVaccinationRecord.isPending}
              className="w-full rounded-2xl bg-cyan-500 text-white font-black"
              data-testid="button-edit-vaccine-submit"
            >
              {updateVaccinationRecord.isPending ? "変更中..." : "変更する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRotaChangeConfirm} onOpenChange={setShowRotaChangeConfirm}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">ワクチンの種類を変更</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 font-bold">
                ロタウイルスワクチンの種類を変更すると、表示される接種回数が変わります。既に記録済みの接種データはそのまま残ります。
              </p>
            </div>
            <p className="text-sm text-center font-bold text-gray-700">
              {pendingRotaType === "rotarix" ? "ロタリックス（2回）" : "ロタテック（3回）"}に変更しますか？
            </p>
            <div className="flex gap-3">
              <Button
                data-testid="button-rota-change-cancel"
                variant="outline"
                onClick={() => { setShowRotaChangeConfirm(false); setPendingRotaType(null); }}
                className="flex-1 rounded-2xl h-12"
              >
                キャンセル
              </Button>
              <Button
                data-testid="button-rota-change-confirm"
                onClick={() => applyRotaType(pendingRotaType)}
                className="flex-1 rounded-2xl h-12 bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
              >
                変更する
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBloodTypeDialog} onOpenChange={setShowBloodTypeDialog}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">血液型を選択</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 p-4">
            {["A型", "B型", "O型", "AB型"].map((bt) => (
              <Button
                key={bt}
                variant="outline"
                onClick={() => handleBloodTypeUpdate(bt)}
                className={`rounded-2xl py-6 text-lg font-black ${activeChild?.bloodType === bt ? "bg-purple-100 border-purple-400 text-purple-700" : ""}`}
                data-testid={`button-blood-type-${bt}`}
              >
                {bt}
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={() => handleBloodTypeUpdate("")}
              className="rounded-2xl py-6 text-sm font-bold col-span-2 text-gray-400"
              data-testid="button-blood-type-clear"
            >
              未登録に戻す
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHealthRecordDialog} onOpenChange={setShowHealthRecordDialog}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">
              {healthRecordType === "allergy" ? "アレルギーを追加" :
               healthRecordType === "medical_history" ? "既往歴を追加" :
               "体質メモを追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs">
                {healthRecordType === "allergy" ? "アレルギー品目" :
                 healthRecordType === "medical_history" ? "病名" :
                 "体質・特記事項"}
              </Label>
              <Input
                data-testid="input-hr-title"
                placeholder={
                  healthRecordType === "allergy" ? "例: 卵、牛乳、小麦" :
                  healthRecordType === "medical_history" ? "例: 水疱瘡、おたふく" :
                  "例: 熱が出やすい、肌が弱い"
                }
                value={hrTitle}
                onChange={(e) => setHrTitle(e.target.value)}
                className="rounded-xl border-2"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs">詳細（任意）</Label>
              <Textarea
                data-testid="input-hr-detail"
                placeholder={
                  healthRecordType === "allergy" ? "例: 加熱済みなら少量OK" :
                  healthRecordType === "medical_history" ? "例: 軽症で済んだ" :
                  "例: 季節の変わり目に注意"
                }
                value={hrDetail}
                onChange={(e) => setHrDetail(e.target.value)}
                className="rounded-xl border-2 min-h-[80px]"
              />
            </div>
            {healthRecordType === "medical_history" && (
              <div className="space-y-2">
                <Label className="font-bold text-xs">発症時期（任意）</Label>
                <Input
                  data-testid="input-hr-date"
                  type="month"
                  value={hrDate}
                  onChange={(e) => setHrDate(e.target.value)}
                  className="rounded-xl border-2"
                />
              </div>
            )}
            <Button
              data-testid="button-hr-submit"
              onClick={handleHealthRecordSubmit}
              disabled={!hrTitle.trim() || createHealthRecord.isPending}
              className="w-full rounded-2xl bg-purple-500 text-white font-black"
            >
              追加する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 健康ログ編集ダイアログ（体温・症状） */}
      <Dialog open={!!editingHealthLog} onOpenChange={(open) => { if (!open) setEditingHealthLog(null); }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center text-gray-800">
              {editingHealthLog?.type === "temp" ? "体温を編集" : "症状を編集"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 px-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-500">日時</Label>
              {showEditDateInput ? (
                <Input
                  type="datetime-local"
                  value={editHealthLogTime}
                  onChange={e => setEditHealthLogTime(e.target.value)}
                  onBlur={() => setShowEditDateInput(false)}
                  step="60"
                  autoFocus
                  className="rounded-xl border-2 text-base font-bold h-12 text-center"
                  data-testid="input-edit-health-log-time"
                />
              ) : (
                <button
                  type="button"
                  data-testid="button-edit-health-log-time"
                  onClick={() => setShowEditDateInput(true)}
                  className="w-full h-12 rounded-xl border-2 border-gray-200 bg-gray-50 text-base font-bold text-gray-700 flex items-center justify-center gap-2 hover:border-purple-300 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {editHealthLogTime
                    ? format(new Date(editHealthLogTime), "M月d日 HH:mm")
                    : "—"}
                </button>
              )}
            </div>

            {editingHealthLog?.type === "temp" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-500">体温 (°C)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="34"
                  max="42"
                  value={editTempValue}
                  onChange={e => setEditTempValue(e.target.value)}
                  className="rounded-xl border-2 text-2xl font-black h-14 text-center"
                  data-testid="input-edit-temp-value"
                />
              </div>
            )}

            {editingHealthLog?.type === "symptom" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">症状（複数選択可）</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SYMPTOM_CHECKLIST.map(s => {
                      const selected = editingSymptoms.has(s.id);
                      const IconComp = s.icon;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          data-testid={`button-edit-symptom-${s.id}`}
                          onClick={() => setEditingSymptoms(prev => {
                            const next = new Set(prev);
                            next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                            return next;
                          })}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border-2 text-xs font-bold transition-all ${selected ? `${s.bg} ${s.color} border-current` : "bg-gray-50 text-gray-400 border-gray-200"}`}
                        >
                          <IconComp className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-left leading-tight">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">メモ（任意）</Label>
                  <Input
                    value={editSymptomNote}
                    onChange={e => setEditSymptomNote(e.target.value)}
                    placeholder="様子や状況など…"
                    className="rounded-xl border-2 text-sm"
                    data-testid="input-edit-symptom-note"
                  />
                </div>
              </>
            )}

            <Button
              data-testid="button-save-health-log-edit"
              disabled={updateLog.isPending}
              onClick={() => {
                if (!editingHealthLog) return;
                const d = new Date(editHealthLogTime);
                if (isNaN(d.getTime())) return;
                const payload: Record<string, any> = {
                  id: editingHealthLog.id,
                  createdAt: d.toISOString(),
                };
                if (editingHealthLog.type === "temp" && editTempValue) {
                  payload.bodyTemperature = parseFloat(editTempValue);
                }
                if (editingHealthLog.type === "symptom") {
                  payload.symptoms = Array.from(editingSymptoms).join(",");
                  payload.symptomNote = editSymptomNote.trim() || null;
                  payload.message = editingSymptoms.size > 0
                    ? `症状: ${Array.from(editingSymptoms).map(id => SYMPTOM_CHECKLIST.find(c => c.id === id)?.label || id).join("、")}`
                    : editingHealthLog.message;
                }
                updateLog.mutate(payload, {
                  onSuccess: () => {
                    setEditingHealthLog(null);
                    toast({ title: "更新しました", duration: 500 });
                  },
                });
              }}
              className="w-full h-14 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-black text-base"
            >
              {updateLog.isPending ? "保存中…" : "保存する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMamaHealthDialog} onOpenChange={setShowMamaHealthDialog}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none max-h-[90vh] overflow-y-auto" onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center text-pink-700">ママのからだ記録</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center gap-2 -mt-1 mb-1">
            <div className="flex items-center gap-2 bg-pink-50 border border-pink-200 rounded-2xl px-3 py-2">
              <CalendarDays className="w-4 h-4 text-pink-400 shrink-0" />
              <input
                type="date"
                value={mhDate}
                max={format(new Date(), "yyyy-MM-dd")}
                onChange={e => setMhDate(e.target.value)}
                data-testid="input-mh-date"
                className="text-sm font-bold text-pink-700 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>
          </div>
          <div className="space-y-5 py-2 px-1">

            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">お通じ</Label>
              <div className="flex gap-2">
                {[{ val: true, label: "あり" }, { val: false, label: "なし" }].map(({ val, label }) => (
                  <button
                    key={label}
                    data-testid={`chip-bowel-${label}`}
                    onClick={() => setMhBowel(mhBowel === val ? null : val)}
                    className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border transition-all ${mhBowel === val ? "bg-pink-500 text-white border-pink-500" : "bg-pink-50 text-pink-700 border-pink-200"}`}
                  >{label}</button>
                ))}
              </div>
              {mhBowel && (
                <Input
                  data-testid="input-bowel-note"
                  placeholder="コメント（任意）"
                  value={mhBowelNote}
                  onChange={e => setMhBowelNote(e.target.value)}
                  className="rounded-xl border-2 text-sm"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">悪露の状態</Label>
              <div className="flex gap-2 flex-wrap">
                {[{ val: "heavy", label: "多め" }, { val: "normal", label: "普通" }, { val: "light", label: "少なめ" }, { val: "none", label: "なし" }].map(({ val, label }) => (
                  <button
                    key={val}
                    data-testid={`chip-lochia-${val}`}
                    onClick={() => setMhLochia(mhLochia === val ? "" : val)}
                    className={`px-4 py-2 rounded-2xl text-sm font-bold border transition-all ${mhLochia === val ? "bg-pink-500 text-white border-pink-500" : "bg-pink-50 text-pink-700 border-pink-200"}`}
                  >{label}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">会陰の痛み（0=なし〜4=かなり痛い）</Label>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map(v => (
                  <button
                    key={v}
                    data-testid={`chip-perineal-${v}`}
                    onClick={() => setMhPerinealPain(mhPerinealPain === v ? null : v)}
                    className={`flex-1 py-2.5 rounded-2xl text-sm font-black border transition-all ${mhPerinealPain === v ? "bg-pink-500 text-white border-pink-500" : "bg-pink-50 text-pink-700 border-pink-200"}`}
                  >{v}</button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 px-1">
                <span>なし</span><span>かなり痛い</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">気分・メンタル</Label>
              <div className="flex gap-1.5">
                {[
                  { v: 0, label: "辛い" }, { v: 1, label: "..." }, { v: 2, label: "普通" }, { v: 3, label: "..." }, { v: 4, label: "良好" }
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    data-testid={`chip-mood-${v}`}
                    onClick={() => setMhMood(mhMood === v ? null : v)}
                    className={`flex-1 py-2.5 rounded-2xl text-sm font-black border transition-all ${mhMood === v ? "bg-violet-500 text-white border-violet-500" : "bg-violet-50 text-violet-700 border-violet-200"}`}
                  >{v}</button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 px-1">
                <span>とても辛い</span><span>良好</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">自分の睡眠時間</Label>
              <div className="flex items-center gap-2">
                <Input
                  data-testid="input-sleep-hrs"
                  type="number"
                  min="0"
                  max="24"
                  placeholder="0"
                  value={mhSleepHrs}
                  onChange={e => setMhSleepHrs(e.target.value)}
                  className="w-20 rounded-xl border-2 text-center"
                />
                <span className="text-sm text-gray-500 font-bold">時間</span>
                <Input
                  data-testid="input-sleep-min"
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  value={mhSleepMin}
                  onChange={e => setMhSleepMin(e.target.value)}
                  className="w-20 rounded-xl border-2 text-center"
                />
                <span className="text-sm text-gray-500 font-bold">分</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">授乳トラブル（複数選択可）</Label>
              <div className="flex flex-wrap gap-2">
                {["乳首の痛み", "張り", "詰まり", "白斑", "乳腺炎の疑い"].map(issue => (
                  <button
                    key={issue}
                    data-testid={`chip-nursing-${issue}`}
                    onClick={() => toggleMhNursingIssue(issue)}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${mhNursingIssues.includes(issue) ? "bg-rose-500 text-white border-rose-500" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                  >{issue}</button>
                ))}
              </div>
              {mhNursingIssues.length > 0 && (
                <Input
                  data-testid="input-nursing-note"
                  placeholder="メモ（任意）"
                  value={mhNursingNote}
                  onChange={e => setMhNursingNote(e.target.value)}
                  className="rounded-xl border-2 text-sm"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">体重・むくみ</Label>
              <div className="flex items-center gap-2">
                <Input
                  data-testid="input-weight-kg"
                  type="number"
                  min="0"
                  max="300"
                  step="0.1"
                  placeholder="kg"
                  value={mhWeightKg}
                  onChange={e => setMhWeightKg(e.target.value)}
                  className="w-28 rounded-xl border-2 text-center"
                />
                <span className="text-sm text-gray-500 font-bold">kg</span>
              </div>
              <div className="flex gap-2 mt-1">
                {[{ val: false, label: "むくみなし" }, { val: true, label: "むくみあり" }].map(({ val, label }) => (
                  <button
                    key={label}
                    data-testid={`chip-swelling-${label}`}
                    onClick={() => setMhSwelling(mhSwelling === val ? null : val)}
                    className={`px-4 py-2 rounded-2xl text-sm font-bold border transition-all ${mhSwelling === val ? "bg-blue-500 text-white border-blue-500" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                  >{label}</button>
                ))}
              </div>
            </div>

            <Button
              data-testid="button-mama-health-submit"
              onClick={handleMamaHealthSubmit}
              disabled={saveMamaHealth.isPending}
              className="w-full h-14 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-black text-lg shadow-lg shadow-pink-100"
            >
              {saveMamaHealth.isPending ? "保存中..." : "記録する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCaregiverMedDialog} onOpenChange={setShowCaregiverMedDialog}>
        <DialogContent className="sm:max-w-sm rounded-[2.5rem] border-none max-h-[90vh] overflow-y-auto" onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center text-violet-700">自分のお薬を記録</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 px-1">
            {cmLastMed && (() => {
              const lastAt = new Date(cmLastMed.createdAt);
              const minAgo = differenceInMinutes(new Date(), lastAt);
              const hAgo = Math.floor(minAgo / 60);
              const mAgo = minAgo % 60;
              const elapsed = hAgo > 0 ? `${hAgo}時間${mAgo}分前` : `${mAgo}分前`;
              return (
                <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-violet-400 shrink-0" />
                  <div>
                    <p className="text-xs text-violet-500 font-bold">最後に服用したのは</p>
                    <p className="text-sm font-black text-violet-700">
                      {elapsed}（{cmLastMed.medicineName || "お薬"}）
                    </p>
                  </div>
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">お薬の名前</Label>
              <Input
                data-testid="input-cm-name"
                placeholder="例：ロキソニン、葛根湯"
                value={cmName}
                onChange={e => setCmName(e.target.value)}
                className="rounded-xl border-2"
                list="cm-med-suggestions"
              />
              {cmSuggestions.length > 0 && (
                <datalist id="cm-med-suggestions">
                  {cmSuggestions.map(name => <option key={name} value={name} />)}
                </datalist>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">用量（任意）</Label>
              <Input
                data-testid="input-cm-dose"
                placeholder="例：1錠、5ml"
                value={cmDose}
                onChange={e => setCmDose(e.target.value)}
                className="rounded-xl border-2"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs text-gray-500">メモ（任意）</Label>
              <Input
                data-testid="input-cm-note"
                placeholder="例：食後に服用、頭痛のため"
                value={cmNote}
                onChange={e => setCmNote(e.target.value)}
                className="rounded-xl border-2"
              />
            </div>
            <Button
              data-testid="button-cm-submit"
              onClick={handleCaregiverMedSubmit}
              disabled={!cmName || createLog.isPending}
              className="w-full h-14 rounded-2xl bg-violet-500 hover:bg-violet-600 text-white font-black text-lg shadow-lg shadow-violet-100"
            >
              {createLog.isPending ? "保存中..." : "記録する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

function HealthRecordSection({ title, icon, items, onAdd, onDelete, emptyText, showDate, testId }: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  onAdd: () => void;
  onDelete: (id: number) => void;
  emptyText: string;
  showDate?: boolean;
  testId: string;
}) {
  return (
    <div className="bg-gray-50 rounded-2xl p-3" data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs font-bold text-gray-600">{title}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className="text-xs text-purple-600 font-bold rounded-full h-7 gap-1"
          data-testid={`button-add-${testId}`}
        >
          <Plus className="w-3 h-3" />
          追加
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-[10px] text-gray-400 italic">{emptyText}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-700">{item.title}</p>
                {item.detail && <p className="text-[10px] text-gray-500">{item.detail}</p>}
                {showDate && item.recordedAt && (
                  <p className="text-[10px] text-gray-400">{item.recordedAt}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(item.id)}
                className="w-6 h-6 shrink-0 text-gray-400"
                data-testid={`button-delete-hr-${item.id}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthLogTab({ healthLogs, months, completedVaccineIds, onOpenVaccine, onOpenTemp, onOpenSymptom, onAddGrowth, onEditGrowth, onDeleteGrowth, latestGrowth, sortedGrowth, onEditLog, onDeleteLog, vaccinationRecordMap, birthday, gender, filteredVaccineDefs }: {
  healthLogs: any[];
  months: number;
  completedVaccineIds: Set<string>;
  onOpenVaccine: () => void;
  onOpenTemp: () => void;
  onOpenSymptom: () => void;
  onAddGrowth: () => void;
  onEditGrowth: (r: any) => void;
  onDeleteGrowth: (id: number) => void;
  latestGrowth: any;
  sortedGrowth: any[];
  onEditLog: (log: any) => void;
  onDeleteLog: (id: number) => void;
  vaccinationRecordMap: Map<string, any>;
  birthday: string;
  gender?: string;
  filteredVaccineDefs: typeof VACCINE_DEFINITIONS;
}) {
  const [showSymptomHistory, setShowSymptomHistory] = useState(false);
  const tempLogs = healthLogs.filter((l: any) => l.type === "temp");
  const symptomLogs = healthLogs.filter((l: any) => l.type === "symptom");

  const latestTemp = tempLogs.length > 0 ? tempLogs[0] : null;

  const healthTip = useMemo(() => {
    if (months <= 3) {
      if (latestTemp && latestTemp.bodyTemperature >= 37.5) {
        return "体温が少し高めです。母乳やミルクをこまめにあげて、様子を見ましょう。";
      }
      return "体温や症状の記録が赤ちゃんの健康管理に役立ちます。";
    }
    if (latestTemp && latestTemp.bodyTemperature >= 38.0) {
      return "熱が高めです。水分補給をしっかりして、元気がなければお医者さんに相談しましょう。";
    }
    return "毎日の健康チェックで、お子さまの変化を見逃さないようにしましょう。";
  }, [months, latestTemp]);

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-teal-50/50 border-teal-100 rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="bg-teal-100 p-2 rounded-2xl shrink-0">
            <Stethoscope className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="font-bold text-sm text-teal-900">
              健康メモ
            </p>
            <p className="text-xs text-teal-700 mt-1 leading-relaxed" data-testid="text-health-advice">
              {healthTip}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Card
          className="p-3 rounded-2xl text-center cursor-pointer hover-elevate transition-colors"
          onClick={onOpenTemp}
          data-testid="stat-temp-latest"
        >
          <Thermometer className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <p className="text-lg font-black text-gray-800">
            {latestTemp ? `${latestTemp.bodyTemperature}°` : "--"}
          </p>
          <p className="text-[10px] font-bold text-gray-400">最新体温</p>
        </Card>
        <Card
          className="p-3 rounded-2xl text-center cursor-pointer hover-elevate transition-colors"
          onClick={onOpenSymptom}
          data-testid="stat-symptom-count"
        >
          <Stethoscope className="w-5 h-5 text-teal-500 mx-auto mb-1" />
          <p className="text-lg font-black text-gray-800">{symptomLogs.length}</p>
          <p className="text-[10px] font-bold text-gray-400">症状メモ</p>
        </Card>
        <Card
          className="p-3 rounded-2xl text-center cursor-pointer hover-elevate transition-colors"
          onClick={onOpenVaccine}
          data-testid="card-vaccination"
        >
          <Syringe className="w-5 h-5 text-cyan-600 mx-auto mb-1" />
          <p className="text-lg font-black text-gray-800">{completedVaccineIds.size}</p>
          <p className="text-[10px] font-bold text-gray-400">予防接種</p>
        </Card>
      </div>

      {(symptomLogs.length > 0 || tempLogs.some((l: any) => l.bodyTemperature >= 37.5)) && (() => {
        const clinicItems = [
          ...symptomLogs.map((l: any) => ({
            id: l.id,
            date: new Date(l.createdAt),
            kind: "symptom" as const,
            text: l.message?.startsWith("症状: ") ? l.message.slice("症状: ".length) : (l.message || ""),
            note: l.symptomNote || "",
          })),
          ...tempLogs
            .filter((l: any) => l.bodyTemperature >= 37.5)
            .map((l: any) => ({
              id: l.id,
              date: new Date(l.createdAt),
              kind: "temp" as const,
              text: `体温 ${l.bodyTemperature}°C`,
              note: "",
            })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime());

        return (
          <Card className="rounded-3xl overflow-hidden border border-rose-100" data-testid="card-clinic-support">
            <button
              onClick={() => setShowSymptomHistory(!showSymptomHistory)}
              className="w-full flex items-center gap-3 p-4 hover:bg-rose-50/40 transition-colors"
              data-testid="button-clinic-support-toggle"
            >
              <div className="bg-rose-100 p-2 rounded-2xl shrink-0">
                <Stethoscope className="w-4 h-4 text-rose-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-sm text-rose-800">受診サポート</p>
                <p className="text-[10px] text-rose-400">症状の経過を病院で説明するために</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{clinicItems.length}件</span>
                {showSymptomHistory
                  ? <ChevronUp className="w-4 h-4 text-rose-300" />
                  : <ChevronDown className="w-4 h-4 text-rose-300" />}
              </div>
            </button>

            {showSymptomHistory && (
              <div className="divide-y divide-rose-50 max-h-[60vh] overflow-y-auto">
                {clinicItems.map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="px-4 py-3 flex items-start gap-3" data-testid={`clinic-item-${item.id}`}>
                    <div className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${item.kind === "symptom" ? "bg-rose-50" : "bg-amber-50"}`}>
                      {item.kind === "symptom"
                        ? <Stethoscope className="w-3.5 h-3.5 text-rose-500" />
                        : <Thermometer className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-gray-500">
                        {format(item.date, "M月d日（E）HH:mm", { locale: ja })}
                      </p>
                      <p className="text-sm font-bold text-gray-800 mt-0.5">{item.text}</p>
                      {item.note && <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{item.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

      <VaccineScheduleOverview
        months={months}
        completedVaccineIds={completedVaccineIds}
        vaccinationRecordMap={vaccinationRecordMap}
        birthday={birthday}
        onOpenVaccine={onOpenVaccine}
        filteredVaccines={filteredVaccineDefs}
      />

      <Card className="rounded-3xl overflow-hidden" data-testid="health-log-list">
        <div className="p-4 border-b border-gray-100">
          <p className="font-bold text-sm text-gray-700">健康の記録</p>
        </div>
        {healthLogs.length === 0 ? (
          <div className="p-6 text-center">
            <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-bold">まだ記録がありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {healthLogs.slice(0, 20).map((log: any) => (
              <HealthLogItem key={log.id} log={log} onEdit={onEditLog} onDelete={onDeleteLog} />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 rounded-3xl" data-testid="card-body-measurement">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-green-100 p-2 rounded-2xl shrink-0">
            <Ruler className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-gray-700">身体測定</p>
            <p className="text-[10px] text-gray-400">体重・身長の記録</p>
          </div>
        </div>
        {latestGrowth ? (
          <div className="mb-3">
            <p className="text-[10px] text-gray-400 mb-1.5 text-right">
              {format(parseISO(latestGrowth.measuredAt), "yyyy/M/d")} 測定
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 rounded-xl p-2 text-center border border-green-100">
                <Weight className="w-4 h-4 text-green-500 mx-auto mb-0.5" />
                <p className="text-sm font-black text-gray-800">
                  {latestGrowth.weightGrams ? `${(latestGrowth.weightGrams / 1000).toFixed(1)}` : "--"}
                </p>
                <p className="text-[9px] font-bold text-gray-400">体重(kg)</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-2 text-center border border-blue-100">
                <Ruler className="w-4 h-4 text-blue-500 mx-auto mb-0.5" />
                <p className="text-sm font-black text-gray-800">
                  {latestGrowth.heightCm ? `${latestGrowth.heightCm.toFixed(1)}` : "--"}
                </p>
                <p className="text-[9px] font-bold text-gray-400">身長(cm)</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3">まだ測定データがありません</p>
        )}
        <Button
          data-testid="button-add-growth"
          onClick={onAddGrowth}
          className="w-full rounded-2xl bg-green-500 text-white font-bold"
        >
          <Plus className="w-4 h-4 mr-1" />
          身体測定を記録する
        </Button>

        {sortedGrowth.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-gray-500 mb-2">測定履歴</p>
            <div className="space-y-1.5">
              {[...sortedGrowth].reverse().map((r: any, idx: number) => (
                <div key={r.id || idx} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-xl bg-gray-50" data-testid={`growth-record-${r.id || idx}`}>
                  <span className="text-gray-500 font-bold min-w-[45px]">{format(parseISO(r.measuredAt), "M/d")}</span>
                  <span className="text-gray-700 flex-1">
                    {r.weightGrams ? `${(r.weightGrams / 1000).toFixed(1)}kg` : ""}
                    {r.weightGrams && r.heightCm ? " / " : ""}
                    {r.heightCm ? `${r.heightCm.toFixed(1)}cm` : ""}
                  </span>
                  {r.id && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        data-testid={`button-edit-growth-${r.id}`}
                        onClick={() => onEditGrowth(r)}
                        className="p-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        data-testid={`button-delete-growth-${r.id}`}
                        onClick={() => onDeleteGrowth(r.id)}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {sortedGrowth.length >= 1 && (
        <GrowthCurveChart sortedGrowth={sortedGrowth} birthday={birthday} gender={gender} />
      )}
    </div>
  );
}

function GrowthCurveChart({ sortedGrowth, birthday, gender }: {
  sortedGrowth: any[];
  birthday: string;
  gender?: string;
}) {
  const [chartType, setChartType] = useState<"weight" | "height">("weight");

  const weightStandards = gender === "female" ? WEIGHT_STANDARDS_FEMALE : WEIGHT_STANDARDS_MALE;
  const heightStandards = gender === "female" ? HEIGHT_STANDARDS_FEMALE : HEIGHT_STANDARDS_MALE;
  const standards = chartType === "weight" ? weightStandards : heightStandards;

  const chartData = useMemo(() => {
    if (!birthday) return [];
    const bday = parseISO(birthday);
    const maxMonths = Math.max(
      ...sortedGrowth.map((r: any) => differenceInMonths(parseISO(r.measuredAt), bday)),
      12
    );
    const curve = buildStandardCurve(standards, Math.min(maxMonths + 3, 72));

    const standardMap = new Map<number, { p3: number; p50: number; p97: number }>();
    curve.forEach(p => standardMap.set(p.monthsAge, { p3: p.p3, p50: p.p50, p97: p.p97 }));

    const allMonths = new Set<number>();
    curve.forEach(p => allMonths.add(p.monthsAge));
    sortedGrowth.forEach((r: any) => {
      const m = differenceInMonths(parseISO(r.measuredAt), bday);
      allMonths.add(m);
    });

    const sorted = [...allMonths].sort((a, b) => a - b);
    const dataPoints = sorted.map(m => {
      const std = standardMap.get(m);
      const record = sortedGrowth.find((r: any) => differenceInMonths(parseISO(r.measuredAt), bday) === m);
      let value: number | null = null;
      if (record) {
        value = chartType === "weight"
          ? (record.weightGrams ? record.weightGrams / 1000 : null)
          : (record.heightCm || null);
      }
      return {
        month: m,
        label: `${m}ヶ月`,
        p3: std?.p3 ?? null,
        p50: std?.p50 ?? null,
        p97: std?.p97 ?? null,
        value,
      };
    });
    return dataPoints;
  }, [sortedGrowth, birthday, standards, chartType]);

  if (chartData.length === 0 || !birthday) return null;

  const unit = chartType === "weight" ? "kg" : "cm";
  const genderLabel = gender === "female" ? "女の子" : "男の子";

  return (
    <Card className="p-4 rounded-3xl" data-testid="card-growth-curve">
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-indigo-100 p-2 rounded-2xl shrink-0">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-gray-700">成長曲線</p>
          <p className="text-[10px] text-gray-400">{genderLabel}の標準範囲と比較</p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-3">
        <button
          data-testid="button-chart-weight"
          onClick={() => setChartType("weight")}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            chartType === "weight"
              ? "bg-green-500 text-white"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          体重
        </button>
        <button
          data-testid="button-chart-height"
          onClick={() => setChartType("height")}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            chartType === "height"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          身長
        </button>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <defs>
              <linearGradient id="stdRange" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartType === "weight" ? "#86efac" : "#93c5fd"} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartType === "weight" ? "#86efac" : "#93c5fd"} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickFormatter={(v) => `${v}m`}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              unit={unit}
              width={45}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 11, border: "1px solid #e5e7eb" }}
              formatter={(value: any, name: string) => {
                if (value === null) return ["-", name];
                const labels: Record<string, string> = { value: "実測値", p3: "3%タイル", p50: "50%タイル", p97: "97%タイル" };
                return [`${Number(value).toFixed(1)}${unit}`, labels[name] || name];
              }}
              labelFormatter={(label) => `${label}ヶ月`}
            />
            <Area
              type="monotone"
              dataKey="p97"
              stroke="none"
              fill="url(#stdRange)"
              fillOpacity={1}
              connectNulls
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="p3"
              stroke="none"
              fill="#ffffff"
              fillOpacity={1}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p97"
              stroke={chartType === "weight" ? "#86efac" : "#93c5fd"}
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke={chartType === "weight" ? "#4ade80" : "#60a5fa"}
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p3"
              stroke={chartType === "weight" ? "#86efac" : "#93c5fd"}
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={chartType === "weight" ? "#16a34a" : "#2563eb"}
              strokeWidth={2.5}
              dot={{ r: 4, fill: chartType === "weight" ? "#16a34a" : "#2563eb", stroke: "#fff", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-3 h-0.5 ${chartType === "weight" ? "bg-green-600" : "bg-blue-600"}`} />
          <span className="text-[10px] text-gray-500">実測値</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-6 h-3 rounded-sm opacity-30 ${chartType === "weight" ? "bg-green-300" : "bg-blue-300"}`} />
          <span className="text-[10px] text-gray-500">標準範囲 (3〜97%)</span>
        </div>
      </div>
    </Card>
  );
}

function VaccineScheduleOverview({ months, completedVaccineIds, vaccinationRecordMap, birthday, onOpenVaccine, filteredVaccines }: {
  months: number;
  completedVaccineIds: Set<string>;
  vaccinationRecordMap: Map<string, any>;
  birthday: string;
  onOpenVaccine: () => void;
  filteredVaccines: typeof VACCINE_DEFINITIONS;
}) {
  const nextVaccines = useMemo(() => {
    const upcoming: Array<{
      vaccine: typeof VACCINE_DEFINITIONS[0];
      standardDate: string;
      recommendedDate: string;
      source: "standard" | "interval";
    }> = [];

    for (const vaccine of filteredVaccines) {
      if (completedVaccineIds.has(vaccine.id)) continue;

      if (vaccine.previousDoseId) {
        const prevRecord = vaccinationRecordMap.get(vaccine.previousDoseId);
        if (prevRecord && vaccine.minIntervalDays) {
          const recommended = addDays(parseISO(prevRecord.administeredDate), vaccine.minIntervalDays);
          upcoming.push({
            vaccine,
            standardDate: birthday ? getStandardScheduleDate(vaccine.id, birthday) : "",
            recommendedDate: format(recommended, "yyyy-MM-dd"),
            source: "interval",
          });
          continue;
        }
      }

      const status = getVaccineStatus(vaccine.id, completedVaccineIds, months);
      if (status === "upcoming" || status === "overdue") {
        upcoming.push({
          vaccine,
          standardDate: birthday ? getStandardScheduleDate(vaccine.id, birthday) : "",
          recommendedDate: "",
          source: "standard",
        });
      }
    }

    return upcoming.slice(0, 5);
  }, [completedVaccineIds, vaccinationRecordMap, months, birthday, filteredVaccines]);

  if (nextVaccines.length === 0) return null;

  return (
    <Card className="rounded-3xl overflow-hidden" data-testid="card-vaccine-schedule">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-cyan-50 p-1.5 rounded-xl">
            <Syringe className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="font-bold text-sm text-gray-700">次の予防接種</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenVaccine}
          className="text-[10px] text-cyan-600 font-bold h-6 px-2"
          data-testid="button-view-all-vaccines"
        >
          すべて表示
        </Button>
      </div>
      <div className="divide-y divide-gray-50">
        {nextVaccines.map(({ vaccine, standardDate, recommendedDate, source }) => {
          const status = getVaccineStatus(vaccine.id, completedVaccineIds, months);
          return (
            <div key={vaccine.id} className="px-4 py-3 flex items-center gap-3" data-testid={`vaccine-schedule-${vaccine.id}`}>
              <div className={`p-2 rounded-xl shrink-0 ${
                status === "overdue" ? "bg-orange-50" : "bg-cyan-50"
              }`}>
                <Syringe className={`w-4 h-4 ${
                  status === "overdue" ? "text-orange-500" : "text-cyan-600"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-700">{vaccine.name}</p>
                  {status === "overdue" && (
                    <span className="text-[8px] font-bold text-white bg-orange-500 px-1.5 py-0.5 rounded-full">要確認</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {recommendedDate && (
                    <p className="text-[10px] text-cyan-600 font-bold flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(recommendedDate), "yyyy/M/d")}以降
                    </p>
                  )}
                  {standardDate && (
                    <p className="text-[10px] text-gray-400">
                      標準: {format(parseISO(standardDate), "yyyy/M/d")}頃
                    </p>
                  )}
                  {!recommendedDate && !standardDate && (
                    <p className="text-[10px] text-gray-400">{vaccine.standardAgeMonths}ヶ月〜</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function HealthLogItem({ log, onEdit, onDelete }: { log: any; onEdit: (log: any) => void; onDelete: (id: number) => void }) {
  const logDate = new Date(log.createdAt);
  const isToday = new Date().toDateString() === logDate.toDateString();
  const isYesterday = new Date(Date.now() - 86400000).toDateString() === logDate.toDateString();
  const datePrefix = isToday ? "今日" : isYesterday ? "昨日" : format(logDate, "M月d日", { locale: ja });
  const time = `${datePrefix} ${format(logDate, "HH:mm")}`;

  if (log.type === "temp") {
    const isHigh = log.bodyTemperature >= 37.5;
    return (
      <div className="flex items-center gap-3 px-4 py-3" data-testid={`health-log-${log.id}`}>
        <div className={`p-2 rounded-xl shrink-0 ${isHigh ? "bg-red-50" : "bg-blue-50"}`}>
          <Thermometer className={`w-4 h-4 ${isHigh ? "text-red-500" : "text-blue-500"}`} />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(log)} data-testid={`button-edit-log-${log.id}`}>
          <p className="text-sm font-bold text-gray-700">
            体温 {log.bodyTemperature}°C
            {isHigh && <span className="text-red-500 text-xs ml-1">(高め)</span>}
          </p>
          <p className="text-[10px] text-gray-400">{time}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(log.id)}
          className="w-7 h-7 shrink-0 text-gray-400"
          data-testid={`button-delete-log-${log.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  if (log.type === "symptom") {
    const symptomNames = log.symptoms
      ? log.symptoms.split(",").map((s: string) => {
          const found = SYMPTOM_CHECKLIST.find(c => c.id === s);
          return found ? found.label : (SYMPTOM_LABELS[s] || s);
        }).join("、")
      : "";
    return (
      <div className="flex items-center gap-3 px-4 py-3" data-testid={`health-log-${log.id}`}>
        <div className="bg-teal-50 p-2 rounded-xl shrink-0">
          <Stethoscope className="w-4 h-4 text-teal-500" />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(log)} data-testid={`button-edit-log-${log.id}`}>
          <p className="text-sm font-bold text-gray-700">{symptomNames}</p>
          {log.symptomNote && (
            <p className="text-[10px] text-gray-500 mt-0.5">{log.symptomNote}</p>
          )}
          <p className="text-[10px] text-gray-400">{time}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(log.id)}
          className="w-7 h-7 shrink-0 text-gray-400"
          data-testid={`button-delete-log-${log.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  if (log.type === "vaccination") {
    const vaccineInfo = vaccineList.find(v => v.id === log.subType);
    const displayName = vaccineInfo?.name || log.subType || "予防接種";
    return (
      <div className="flex items-center gap-3 px-4 py-3" data-testid={`health-log-${log.id}`}>
        <div className="bg-cyan-50 p-2 rounded-xl shrink-0">
          <Syringe className="w-4 h-4 text-cyan-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-700">{displayName}</p>
          <p className="text-[10px] text-gray-400">{time}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(log.id)}
          className="w-7 h-7 shrink-0 text-gray-400"
          data-testid={`button-delete-log-${log.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return null;
}

