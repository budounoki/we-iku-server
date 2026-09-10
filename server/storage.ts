import { db } from "./db";
import {
  children, logs, settings, events, coupons, userCoupons, notifications,
  sleepChecklist, sleepRoutines, sleepRoutineLogs, growthRecords, sleepSessions,
  skillCompletions, feedbacks, weBoard, healthRecords, vaccinationRecords, customVaccines,
  foodIngredients, customChildcareItems, customQuickActions, mamaHealthLogs,
  type Child, type InsertChild,
  type Log, type InsertLog,
  type Setting, type InsertSetting,
  type Event, type InsertEvent,
  type Coupon, type InsertCoupon,
  type UserCoupon, type InsertUserCoupon,
  type Notification, type InsertNotification,
  type SleepChecklist, type InsertSleepChecklist,
  type SleepRoutine, type InsertSleepRoutine,
  type SleepRoutineLog, type InsertSleepRoutineLog,
  type GrowthRecord, type InsertGrowthRecord,
  type SleepSession, type InsertSleepSession,
  type SkillCompletion, type InsertSkillCompletion,
  type Feedback, type InsertFeedback,
  type WeBoard, type InsertWeBoard,
  type HealthRecord, type InsertHealthRecord,
  type VaccinationRecord, type InsertVaccinationRecord,
  type CustomVaccine, type InsertCustomVaccine,
  type FoodIngredient, type InsertFoodIngredient,
  type CustomChildcareItem, type InsertCustomChildcareItem,
  type CustomQuickAction, type InsertCustomQuickAction,
  type MamaHealthLog, type InsertMamaHealthLog,
  familyPlans, type FamilyPlan,
} from "@shared/schema";
import { eq, and, desc, asc, isNull, like, ne } from "drizzle-orm";

export interface IStorage {
  getChildren(familyId: string): Promise<Child[]>;
  createChild(data: InsertChild): Promise<Child>;
  updateChild(id: number, data: Partial<InsertChild>): Promise<Child>;
  deleteChild(id: number): Promise<void>;
  getLogs(familyId: string): Promise<Log[]>;
  createLog(log: InsertLog): Promise<Log>;
  updateLog(id: number, data: { createdAt?: Date; message?: string; bodyTemperature?: number | null; symptoms?: string | null; symptomNote?: string | null }): Promise<Log>;
  deleteLog(id: number): Promise<void>;
  updateHealthRecord(id: number, data: { title?: string; detail?: string | null; recordedAt?: string | null }): Promise<HealthRecord>;
  updateSleepSession(id: number, data: { startedAt?: Date; endedAt?: Date; durationMin?: number }): Promise<SleepSession>;
  deleteSleepSession(id: number): Promise<void>;
  deleteSleepSessionWithLog(id: number): Promise<void>;
  getSettings(familyId: string): Promise<Setting>;
  updateSettings(setting: InsertSetting): Promise<Setting>;
  getEvents(familyId: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
  completeEvent(id: number, completedBy: string): Promise<Event>;
  getCoupons(familyId: string): Promise<Coupon[]>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, data: { title?: string; cost?: number }): Promise<Coupon>;
  deleteCoupon(id: number): Promise<void>;
  getUserCoupons(familyId: string): Promise<UserCoupon[]>;
  exchangeCoupon(data: InsertUserCoupon): Promise<UserCoupon>;
  redeemCoupon(id: number): Promise<UserCoupon>;
  getNotifications(familyId: string, targetUser: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<void>;
  findNotificationByDedupeKey(familyId: string, targetUser: string, dedupeKey: string): Promise<Notification | null>;
  markNotificationsReadByDedupePrefix(familyId: string, dedupePrefix: string, excludeDedupeKey?: string): Promise<void>;
  getFamilyPriceTier(familyId: string): Promise<string>;
  getSleepChecklist(familyId: string, date: string): Promise<SleepChecklist | null>;
  upsertSleepChecklist(data: InsertSleepChecklist): Promise<SleepChecklist>;
  getSleepRoutines(familyId: string): Promise<SleepRoutine[]>;
  createSleepRoutine(data: InsertSleepRoutine): Promise<SleepRoutine>;
  updateSleepRoutine(id: number, data: Partial<InsertSleepRoutine>): Promise<SleepRoutine>;
  deleteSleepRoutine(id: number): Promise<void>;
  getSleepRoutineLogs(familyId: string, date: string): Promise<SleepRoutineLog[]>;
  completeSleepRoutineStep(data: InsertSleepRoutineLog): Promise<SleepRoutineLog>;
  getGrowthRecords(familyId: string): Promise<GrowthRecord[]>;
  createGrowthRecord(data: InsertGrowthRecord): Promise<GrowthRecord>;
  getSleepSessions(familyId: string): Promise<SleepSession[]>;
  getActiveSleepSession(familyId: string, childId?: number): Promise<SleepSession | null>;
  startSleepSession(data: InsertSleepSession): Promise<SleepSession>;
  endSleepSession(id: number, overrides?: Partial<InsertSleepSession>): Promise<SleepSession>;
  endSleepSessionAt(id: number, endedAt: Date, overrides?: Partial<InsertSleepSession>): Promise<SleepSession>;
  createManualSleepSession(data: InsertSleepSession): Promise<SleepSession>;
  getSkillCompletions(familyId: string): Promise<SkillCompletion[]>;
  completeSkill(data: InsertSkillCompletion): Promise<SkillCompletion>;
  deleteSkillCompletion(familyId: string, userId: string, skillId: string): Promise<void>;
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getWeBoardMessages(familyId: string): Promise<WeBoard[]>;
  createWeBoardMessage(data: InsertWeBoard): Promise<WeBoard>;
  getHealthRecords(familyId: string): Promise<HealthRecord[]>;
  createHealthRecord(data: InsertHealthRecord): Promise<HealthRecord>;
  deleteHealthRecord(id: number): Promise<void>;
  getVaccinationRecords(familyId: string, childId?: number): Promise<VaccinationRecord[]>;
  createVaccinationRecord(data: InsertVaccinationRecord): Promise<VaccinationRecord>;
  updateVaccinationRecord(id: number, data: { administeredDate?: string; note?: string | null }): Promise<VaccinationRecord>;
  deleteVaccinationRecord(id: number): Promise<void>;
  getCustomVaccines(familyId: string, childId?: number): Promise<CustomVaccine[]>;
  createCustomVaccine(data: InsertCustomVaccine): Promise<CustomVaccine>;
  deleteCustomVaccine(id: number): Promise<void>;
  getFoodIngredients(familyId: string, childId: number): Promise<FoodIngredient[]>;
  upsertFoodIngredient(data: InsertFoodIngredient): Promise<FoodIngredient>;
  deleteFoodIngredient(id: number): Promise<void>;
  getCustomChildcareItems(familyId: string): Promise<CustomChildcareItem[]>;
  createCustomChildcareItem(data: InsertCustomChildcareItem): Promise<CustomChildcareItem>;
  updateCustomChildcareItem(id: number, data: Partial<InsertCustomChildcareItem>): Promise<CustomChildcareItem>;
  deleteCustomChildcareItem(id: number): Promise<void>;
  updateLogSleepDetail(id: number, data: { settlingMethod?: string; sleepLocation?: string; sleepNote?: string | null }): Promise<Log>;
  updateGrowthRecord(id: number, data: Partial<InsertGrowthRecord>): Promise<GrowthRecord | undefined>;
  deleteGrowthRecord(id: number): Promise<void>;
  updateFoodIngredientById(id: number, data: Partial<InsertFoodIngredient>): Promise<FoodIngredient>;
  getCustomQuickActions(familyId: string): Promise<CustomQuickAction[]>;
  createCustomQuickAction(data: InsertCustomQuickAction): Promise<CustomQuickAction>;
  deleteCustomQuickAction(id: number): Promise<void>;
  getMamaHealthLogs(userId: number): Promise<MamaHealthLog[]>;
  getTodayMamaHealthLog(userId: number): Promise<MamaHealthLog | undefined>;
  getMamaHealthLogByDate(userId: number, date: string): Promise<MamaHealthLog | undefined>;
  upsertMamaHealthLog(userId: number, data: Partial<InsertMamaHealthLog>, date?: string): Promise<MamaHealthLog>;
}

export class DatabaseStorage implements IStorage {
  async getChildren(familyId: string): Promise<Child[]> {
    return await db.select().from(children)
      .where(eq(children.familyId, familyId))
      .orderBy(asc(children.createdAt));
  }

  async createChild(data: InsertChild): Promise<Child> {
    const [child] = await db.insert(children).values(data).returning();
    return child;
  }

  async updateChild(id: number, data: Partial<InsertChild>): Promise<Child> {
    const [child] = await db.update(children)
      .set(data)
      .where(eq(children.id, id))
      .returning();
    return child;
  }

  async deleteChild(id: number): Promise<void> {
    await db.delete(children).where(eq(children.id, id));
  }

  async getLogs(familyId: string): Promise<Log[]> {
    return await db.select().from(logs)
      .where(eq(logs.familyId, familyId))
      .orderBy(logs.createdAt);
  }

  async updateLog(id: number, data: { createdAt?: Date; message?: string; bodyTemperature?: number | null; symptoms?: string | null; symptomNote?: string | null }): Promise<Log> {
    const [log] = await db.update(logs).set(data).where(eq(logs.id, id)).returning();
    return log;
  }

  async deleteLog(id: number): Promise<void> {
    await db.delete(logs).where(eq(logs.id, id));
  }

  async updateHealthRecord(id: number, data: { title?: string; detail?: string | null; recordedAt?: string | null }): Promise<HealthRecord> {
    const [record] = await db.update(healthRecords).set(data).where(eq(healthRecords.id, id)).returning();
    return record;
  }

  async updateSleepSession(id: number, data: { startedAt?: Date; endedAt?: Date; durationMin?: number }): Promise<SleepSession> {
    const [session] = await db.update(sleepSessions).set(data).where(eq(sleepSessions.id, id)).returning();
    return session;
  }

  async deleteSleepSession(id: number): Promise<void> {
    await db.delete(sleepSessions).where(eq(sleepSessions.id, id));
  }

  async deleteSleepSessionWithLog(id: number): Promise<void> {
    const [session] = await db.select().from(sleepSessions).where(eq(sleepSessions.id, id));
    if (!session) return;

    if (session.endedAt) {
      const endTime = new Date(session.endedAt);
      const windowStart = new Date(endTime.getTime() - 60000);
      const windowEnd = new Date(endTime.getTime() + 60000);
      const matchingLogs = await db.select().from(logs)
        .where(and(
          eq(logs.familyId, session.familyId),
          eq(logs.type, "sleep"),
          eq(logs.userId, session.createdBy),
        ));
      for (const log of matchingLogs) {
        const logTime = new Date(log.createdAt);
        if (logTime >= windowStart && logTime <= windowEnd) {
          await db.delete(logs).where(eq(logs.id, log.id));
          break;
        }
      }
    }

    await db.delete(sleepSessions).where(eq(sleepSessions.id, id));
  }

  async createLog(insertLog: InsertLog): Promise<Log> {
    const now = new Date();
    const hour = now.getHours();
    let points = 10;
    
    if (insertLog.type === 'play') {
      points = 15;
    } else if (insertLog.type === 'thanks') {
      points = 5;
    } else if (insertLog.type === 'milestone') {
      points = 30;
    } else if (insertLog.type === 'event_done') {
      points = 10;
    } else if (insertLog.type === 'routine_complete') {
      points = 30;
    } else if (insertLog.type === 'temp') {
      points = 10;
    } else if (insertLog.type === 'symptom') {
      points = 10;
    } else if (insertLog.type === 'chore') {
      points = 10;
    }
    
    if (hour >= 0 && hour < 5) {
      points += 10;
    }

    // Drizzle expects Date objects for timestamp columns; the schema
    // override lets clients send ISO strings, so coerce here.
    const values: any = { ...insertLog, points };
    if (typeof values.holdEndAt === 'string') values.holdEndAt = new Date(values.holdEndAt);
    if (typeof values.walkEndAt === 'string') values.walkEndAt = new Date(values.walkEndAt);
    const [log] = await db.insert(logs).values(values).returning();
    return log;
  }

  async getSettings(familyId: string): Promise<Setting> {
    const [setting] = await db.select().from(settings)
      .where(eq(settings.familyId, familyId))
      .limit(1);
    
    if (!setting) {
      return this.updateSettings({ 
        familyId,
        babyName: "赤ちゃんのなまえ", 
        currentCaregiver: "パパ",
        specialTrick: "ビニール袋の音"
      });
    }
    return setting;
  }

  async updateSettings(insertSetting: InsertSetting): Promise<Setting> {
    const [existing] = await db.select().from(settings)
      .where(eq(settings.familyId, insertSetting.familyId))
      .limit(1);
    
    if (existing) {
      const [updated] = await db.update(settings)
        .set(insertSetting)
        .where(eq(settings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(settings).values(insertSetting).returning();
      return created;
    }
  }

  async getEvents(familyId: string): Promise<Event[]> {
    return await db.select().from(events)
      .where(eq(events.familyId, familyId))
      .orderBy(events.date);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event> {
    const [event] = await db.update(events)
      .set(data)
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async completeEvent(id: number, completedBy: string): Promise<Event> {
    const [event] = await db.update(events)
      .set({ completed: true, completedBy })
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async getCoupons(familyId: string): Promise<Coupon[]> {
    return await db.select().from(coupons)
      .where(eq(coupons.familyId, familyId))
      .orderBy(coupons.cost);
  }

  async createCoupon(insertCoupon: InsertCoupon): Promise<Coupon> {
    const [coupon] = await db.insert(coupons).values(insertCoupon).returning();
    return coupon;
  }

  async updateCoupon(id: number, data: { title?: string; cost?: number }): Promise<Coupon> {
    const [coupon] = await db.update(coupons).set(data).where(eq(coupons.id, id)).returning();
    return coupon;
  }

  async deleteCoupon(id: number): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  async getUserCoupons(familyId: string): Promise<UserCoupon[]> {
    return await db.select().from(userCoupons)
      .where(eq(userCoupons.familyId, familyId))
      .orderBy(desc(userCoupons.createdAt));
  }

  async exchangeCoupon(data: InsertUserCoupon): Promise<UserCoupon> {
    const [uc] = await db.insert(userCoupons).values(data).returning();
    return uc;
  }

  async redeemCoupon(id: number): Promise<UserCoupon> {
    const [uc] = await db.update(userCoupons)
      .set({ status: "used", usedAt: new Date() })
      .where(eq(userCoupons.id, id))
      .returning();
    return uc;
  }

  async getNotifications(familyId: string, targetUser: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(and(eq(notifications.familyId, familyId), eq(notifications.targetUser, targetUser)))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notif] = await db.insert(notifications).values(data).returning();
    return notif;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }

  async findNotificationByDedupeKey(familyId: string, targetUser: string, dedupeKey: string): Promise<Notification | null> {
    const [row] = await db.select().from(notifications)
      .where(and(
        eq(notifications.familyId, familyId),
        eq(notifications.targetUser, targetUser),
        eq(notifications.dedupeKey, dedupeKey),
      ))
      .limit(1);
    return row || null;
  }

  async markNotificationsReadByDedupePrefix(familyId: string, dedupePrefix: string, excludeDedupeKey?: string): Promise<void> {
    const conditions = [
      eq(notifications.familyId, familyId),
      eq(notifications.read, false),
      like(notifications.dedupeKey, `${dedupePrefix}%`),
    ];
    if (excludeDedupeKey) {
      conditions.push(ne(notifications.dedupeKey, excludeDedupeKey));
    }
    await db.update(notifications)
      .set({ read: true })
      .where(and(...conditions));
  }

  /** No row = 'standard' (paid-eligible). Pre-existing monitor families are backfilled to 'free_forever'. */
  async getFamilyPriceTier(familyId: string): Promise<string> {
    const [row] = await db.select().from(familyPlans)
      .where(eq(familyPlans.familyId, familyId))
      .limit(1);
    return row?.priceTier ?? "standard";
  }

  async getSleepChecklist(familyId: string, date: string): Promise<SleepChecklist | null> {
    const [row] = await db.select().from(sleepChecklist)
      .where(and(eq(sleepChecklist.familyId, familyId), eq(sleepChecklist.date, date)))
      .limit(1);
    return row || null;
  }

  async upsertSleepChecklist(data: InsertSleepChecklist): Promise<SleepChecklist> {
    const existing = await this.getSleepChecklist(data.familyId, data.date);
    if (existing) {
      const [updated] = await db.update(sleepChecklist)
        .set(data)
        .where(eq(sleepChecklist.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(sleepChecklist).values(data).returning();
    return created;
  }

  async getSleepRoutines(familyId: string): Promise<SleepRoutine[]> {
    return await db.select().from(sleepRoutines)
      .where(eq(sleepRoutines.familyId, familyId))
      .orderBy(asc(sleepRoutines.sortOrder));
  }

  async createSleepRoutine(data: InsertSleepRoutine): Promise<SleepRoutine> {
    const [routine] = await db.insert(sleepRoutines).values(data).returning();
    return routine;
  }

  async updateSleepRoutine(id: number, data: Partial<InsertSleepRoutine>): Promise<SleepRoutine> {
    const [routine] = await db.update(sleepRoutines)
      .set(data)
      .where(eq(sleepRoutines.id, id))
      .returning();
    return routine;
  }

  async deleteSleepRoutine(id: number): Promise<void> {
    await db.delete(sleepRoutines).where(eq(sleepRoutines.id, id));
  }

  async getSleepRoutineLogs(familyId: string, date: string): Promise<SleepRoutineLog[]> {
    return await db.select().from(sleepRoutineLogs)
      .where(and(eq(sleepRoutineLogs.familyId, familyId), eq(sleepRoutineLogs.date, date)));
  }

  async completeSleepRoutineStep(data: InsertSleepRoutineLog): Promise<SleepRoutineLog> {
    const [log] = await db.insert(sleepRoutineLogs).values(data).returning();
    return log;
  }

  async getGrowthRecords(familyId: string): Promise<GrowthRecord[]> {
    return await db.select().from(growthRecords)
      .where(eq(growthRecords.familyId, familyId))
      .orderBy(asc(growthRecords.measuredAt));
  }

  async createGrowthRecord(data: InsertGrowthRecord): Promise<GrowthRecord> {
    const [record] = await db.insert(growthRecords).values(data).returning();
    return record;
  }

  async getSleepSessions(familyId: string): Promise<SleepSession[]> {
    return await db.select().from(sleepSessions)
      .where(eq(sleepSessions.familyId, familyId))
      .orderBy(desc(sleepSessions.startedAt));
  }

  async getActiveSleepSession(familyId: string, childId?: number): Promise<SleepSession | null> {
    const conditions = [
      eq(sleepSessions.familyId, familyId),
      isNull(sleepSessions.endedAt),
    ];
    if (childId !== undefined) {
      conditions.push(eq(sleepSessions.childId, childId));
    }
    const [session] = await db.select().from(sleepSessions)
      .where(and(...conditions))
      .orderBy(desc(sleepSessions.startedAt))
      .limit(1);
    return session || null;
  }

  async startSleepSession(data: InsertSleepSession): Promise<SleepSession> {
    const [session] = await db.insert(sleepSessions).values({
      ...data,
      startedAt: new Date(),
    }).returning();
    return session;
  }

  async endSleepSession(id: number, overrides?: Partial<InsertSleepSession>): Promise<SleepSession> {
    const [existing] = await db.select().from(sleepSessions)
      .where(eq(sleepSessions.id, id))
      .limit(1);
    if (!existing) throw new Error("Session not found");
    const endedAt = new Date();
    const durationMin = Math.round((endedAt.getTime() - new Date(existing.startedAt).getTime()) / 60000);
    const [session] = await db.update(sleepSessions)
      .set({ ...overrides, endedAt, durationMin })
      .where(eq(sleepSessions.id, id))
      .returning();
    return session;
  }

  async endSleepSessionAt(id: number, endedAt: Date, overrides?: Partial<InsertSleepSession>): Promise<SleepSession> {
    const [existing] = await db.select().from(sleepSessions)
      .where(eq(sleepSessions.id, id))
      .limit(1);
    if (!existing) throw new Error("Session not found");
    const durationMin = Math.round((endedAt.getTime() - new Date(existing.startedAt).getTime()) / 60000);
    const [session] = await db.update(sleepSessions)
      .set({ ...overrides, endedAt, durationMin })
      .where(eq(sleepSessions.id, id))
      .returning();
    return session;
  }

  async createManualSleepSession(data: InsertSleepSession): Promise<SleepSession> {
    const [session] = await db.insert(sleepSessions).values(data).returning();
    return session;
  }

  async getSkillCompletions(familyId: string): Promise<SkillCompletion[]> {
    return await db.select().from(skillCompletions)
      .where(eq(skillCompletions.familyId, familyId))
      .orderBy(desc(skillCompletions.completedAt));
  }

  async completeSkill(data: InsertSkillCompletion): Promise<SkillCompletion> {
    const [completion] = await db.insert(skillCompletions).values(data).returning();
    return completion;
  }

  async deleteSkillCompletion(familyId: string, userId: string, skillId: string): Promise<void> {
    await db.delete(skillCompletions)
      .where(and(
        eq(skillCompletions.familyId, familyId),
        eq(skillCompletions.userId, userId),
        eq(skillCompletions.skillId, skillId)
      ));
  }

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const [feedback] = await db.insert(feedbacks).values(data).returning();
    return feedback;
  }

  async getWeBoardMessages(familyId: string): Promise<WeBoard[]> {
    return await db.select().from(weBoard)
      .where(eq(weBoard.familyId, familyId))
      .orderBy(desc(weBoard.createdAt))
      .limit(10);
  }

  async createWeBoardMessage(data: InsertWeBoard): Promise<WeBoard> {
    const [msg] = await db.insert(weBoard).values(data).returning();
    return msg;
  }
  async getHealthRecords(familyId: string): Promise<HealthRecord[]> {
    return await db.select().from(healthRecords)
      .where(eq(healthRecords.familyId, familyId))
      .orderBy(desc(healthRecords.createdAt));
  }

  async createHealthRecord(data: InsertHealthRecord): Promise<HealthRecord> {
    const [record] = await db.insert(healthRecords).values(data).returning();
    return record;
  }

  async deleteHealthRecord(id: number): Promise<void> {
    await db.delete(healthRecords).where(eq(healthRecords.id, id));
  }

  async getVaccinationRecords(familyId: string, childId?: number): Promise<VaccinationRecord[]> {
    if (childId) {
      return await db.select().from(vaccinationRecords)
        .where(and(eq(vaccinationRecords.familyId, familyId), eq(vaccinationRecords.childId, childId)))
        .orderBy(asc(vaccinationRecords.administeredDate));
    }
    return await db.select().from(vaccinationRecords)
      .where(eq(vaccinationRecords.familyId, familyId))
      .orderBy(asc(vaccinationRecords.administeredDate));
  }

  async createVaccinationRecord(data: InsertVaccinationRecord): Promise<VaccinationRecord> {
    const childCondition = data.childId
      ? eq(vaccinationRecords.childId, data.childId)
      : isNull(vaccinationRecords.childId);
    const existing = await db.select().from(vaccinationRecords)
      .where(and(
        eq(vaccinationRecords.familyId, data.familyId),
        eq(vaccinationRecords.vaccineId, data.vaccineId),
        childCondition,
      ))
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [record] = await db.insert(vaccinationRecords).values(data).returning();
    return record;
  }

  async updateVaccinationRecord(id: number, data: { administeredDate?: string; note?: string | null }): Promise<VaccinationRecord> {
    const [record] = await db.update(vaccinationRecords)
      .set(data)
      .where(eq(vaccinationRecords.id, id))
      .returning();
    return record;
  }

  async deleteVaccinationRecord(id: number): Promise<void> {
    await db.delete(vaccinationRecords).where(eq(vaccinationRecords.id, id));
  }

  async getCustomVaccines(familyId: string, childId?: number): Promise<CustomVaccine[]> {
    if (childId) {
      return await db.select().from(customVaccines)
        .where(and(eq(customVaccines.familyId, familyId), eq(customVaccines.childId, childId)))
        .orderBy(asc(customVaccines.createdAt));
    }
    return await db.select().from(customVaccines)
      .where(eq(customVaccines.familyId, familyId))
      .orderBy(asc(customVaccines.createdAt));
  }

  async createCustomVaccine(data: InsertCustomVaccine): Promise<CustomVaccine> {
    const [record] = await db.insert(customVaccines).values(data).returning();
    return record;
  }

  async deleteCustomVaccine(id: number): Promise<void> {
    await db.delete(customVaccines).where(eq(customVaccines.id, id));
  }

  async getFoodIngredients(familyId: string, childId: number): Promise<FoodIngredient[]> {
    return await db.select().from(foodIngredients)
      .where(and(eq(foodIngredients.familyId, familyId), eq(foodIngredients.childId, childId)))
      .orderBy(asc(foodIngredients.createdAt));
  }

  async upsertFoodIngredient(data: InsertFoodIngredient): Promise<FoodIngredient> {
    const existing = await db.select().from(foodIngredients)
      .where(and(
        eq(foodIngredients.familyId, data.familyId),
        eq(foodIngredients.childId, data.childId!),
        eq(foodIngredients.ingredientName, data.ingredientName),
        eq(foodIngredients.category, data.category),
      ))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(foodIngredients)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(foodIngredients.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(foodIngredients).values(data).returning();
    return created;
  }

  async deleteFoodIngredient(id: number): Promise<void> {
    await db.delete(foodIngredients).where(eq(foodIngredients.id, id));
  }

  async getCustomChildcareItems(familyId: string): Promise<CustomChildcareItem[]> {
    return await db.select().from(customChildcareItems)
      .where(and(eq(customChildcareItems.familyId, familyId), eq(customChildcareItems.isActive, true)))
      .orderBy(asc(customChildcareItems.createdAt));
  }

  async createCustomChildcareItem(data: InsertCustomChildcareItem): Promise<CustomChildcareItem> {
    const [item] = await db.insert(customChildcareItems).values(data).returning();
    return item;
  }

  async updateCustomChildcareItem(id: number, data: Partial<InsertCustomChildcareItem>): Promise<CustomChildcareItem> {
    const [item] = await db.update(customChildcareItems)
      .set(data)
      .where(eq(customChildcareItems.id, id))
      .returning();
    return item;
  }

  async deleteCustomChildcareItem(id: number): Promise<void> {
    await db.delete(customChildcareItems).where(eq(customChildcareItems.id, id));
  }

  async updateLogSleepDetail(id: number, data: { settlingMethod?: string; sleepLocation?: string; sleepNote?: string | null }): Promise<Log> {
    const [log] = await db.update(logs).set(data).where(eq(logs.id, id)).returning();
    return log;
  }

  async updateGrowthRecord(id: number, data: Partial<InsertGrowthRecord>): Promise<GrowthRecord | undefined> {
    const [record] = await db.update(growthRecords).set(data).where(eq(growthRecords.id, id)).returning();
    return record;
  }

  async deleteGrowthRecord(id: number): Promise<void> {
    await db.delete(growthRecords).where(eq(growthRecords.id, id));
  }

  async updateFoodIngredientById(id: number, data: Partial<InsertFoodIngredient>): Promise<FoodIngredient> {
    const [updated] = await db.update(foodIngredients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(foodIngredients.id, id))
      .returning();
    return updated;
  }

  async getCustomQuickActions(familyId: string): Promise<CustomQuickAction[]> {
    return await db.select().from(customQuickActions)
      .where(and(eq(customQuickActions.familyId, familyId), eq(customQuickActions.isActive, true)))
      .orderBy(asc(customQuickActions.sortOrder), asc(customQuickActions.createdAt));
  }

  async createCustomQuickAction(data: InsertCustomQuickAction): Promise<CustomQuickAction> {
    const [item] = await db.insert(customQuickActions).values(data).returning();
    return item;
  }

  async deleteCustomQuickAction(id: number): Promise<void> {
    await db.delete(customQuickActions).where(eq(customQuickActions.id, id));
  }

  async getMamaHealthLogs(userId: number): Promise<MamaHealthLog[]> {
    return await db.select().from(mamaHealthLogs)
      .where(eq(mamaHealthLogs.userId, userId))
      .orderBy(desc(mamaHealthLogs.loggedAt));
  }

  async getTodayMamaHealthLog(userId: number): Promise<MamaHealthLog | undefined> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const { sql: rawSql } = await import("drizzle-orm");
    const rows = await db.select().from(mamaHealthLogs)
      .where(and(
        eq(mamaHealthLogs.userId, userId),
        rawSql`${mamaHealthLogs.loggedAt} >= ${todayStart} AND ${mamaHealthLogs.loggedAt} <= ${todayEnd}`
      ))
      .orderBy(desc(mamaHealthLogs.loggedAt))
      .limit(1);
    return rows[0];
  }

  async getMamaHealthLogByDate(userId: number, date: string): Promise<MamaHealthLog | undefined> {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);
    const { sql: rawSql } = await import("drizzle-orm");
    const rows = await db.select().from(mamaHealthLogs)
      .where(and(
        eq(mamaHealthLogs.userId, userId),
        rawSql`${mamaHealthLogs.loggedAt} >= ${dayStart} AND ${mamaHealthLogs.loggedAt} <= ${dayEnd}`
      ))
      .orderBy(desc(mamaHealthLogs.loggedAt))
      .limit(1);
    return rows[0];
  }

  async upsertMamaHealthLog(userId: number, data: Partial<InsertMamaHealthLog>, date?: string): Promise<MamaHealthLog> {
    const existing = date
      ? await this.getMamaHealthLogByDate(userId, date)
      : await this.getTodayMamaHealthLog(userId);
    if (existing) {
      const [updated] = await db.update(mamaHealthLogs)
        .set({ ...data, userId })
        .where(eq(mamaHealthLogs.id, existing.id))
        .returning();
      return updated;
    }
    const loggedAt = date ? new Date(`${date}T12:00:00`) : new Date();
    const [created] = await db.insert(mamaHealthLogs)
      .values({ ...data, userId, loggedAt } as any)
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
