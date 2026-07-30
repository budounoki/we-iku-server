import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { logs, settings, feedbacks, invitationCodes, users, foodIngredients, customChildcareItems, sponsors, promotions, sponsoredCoupons, promotionImpressions, userCoupons as userCouponsTable, communityProfiles, communityRooms, communityMemberships, communityPosts, communityReactions, communityReports, communityBlocks, mamaHealthRecords, mamaMedicineRecords } from "@shared/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { z } from "zod";
import { sendFamilyPush } from "./push";
import { parsePiyoLog } from "./piyolog";

const DEFAULT_COUPONS = [
  { title: "1時間の一人お風呂券", cost: 300 },
  { title: "朝までぐっすり眠れる券", cost: 1000 },
  { title: "好きなランチ出前券", cost: 500 },
  { title: "30分のマッサージ券", cost: 200 },
];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // --- Children ---
  app.get(api.children.list.path, async (req, res) => {
    const childList = await storage.getChildren(req.params.familyId);
    res.json(childList);
  });

  app.post(api.children.create.path, async (req, res) => {
    try {
      const input = api.children.create.input.parse(req.body);
      const existing = await storage.getChildren(input.familyId);
      const duplicate = existing.find((c) => c.name === input.name);
      if (duplicate) {
        return res.status(200).json(duplicate);
      }
      const child = await storage.createChild(input);
      res.status(201).json(child);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/children/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = api.children.update.input.parse(req.body);
      const child = await storage.updateChild(id, data);
      res.json(child);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/children/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteChild(id);
    res.json({ success: true });
  });

  app.get(api.logs.list.path, async (req, res) => {
    const logs = await storage.getLogs(req.params.familyId);
    res.json(logs);
  });

  app.get("/api/families/:familyId/medicine-names", async (req, res) => {
    const logs = await storage.getLogs(req.params.familyId);
    const names = [...new Set(
      logs
        .filter((l: any) => l.type === "medicine" && l.medicineName)
        .map((l: any) => l.medicineName as string)
    )];
    res.json(names);
  });

  app.post(api.logs.create.path, async (req, res) => {
    try {
      const customCreatedAt = req.body.createdAt;
      const input = api.logs.create.input.parse(req.body);
      let log = await storage.createLog(input);

      if (customCreatedAt) {
        log = await storage.updateLog(log.id, { createdAt: new Date(customCreatedAt) });
      }

      if (input.type === "thanks" && input.familyId && input.userId) {
        const partnerUser = input.userId === "papa" ? "mama" : "papa";
        const userLabel = input.userId === "papa" ? "パパ" : "ママ";
        await storage.createNotification({
          familyId: input.familyId,
          targetUser: partnerUser,
          message: `${userLabel}から「ありがとう」が届きました！`,
          type: "thanks",
          childId: input.childId ?? undefined,
        });
        // Send push notification to all family members except the sender.
        const senderIdNum = parseInt(input.userId) || null;
        sendFamilyPush(db as any, input.familyId, senderIdNum, "We育", `${userLabel}から「ありがとう」が届きました！`).catch(() => {});
      }

      res.status(201).json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post("/api/logs/:id/update-time", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { createdAt } = z.object({ createdAt: z.string() }).parse(req.body);
      const log = await storage.updateLog(id, { createdAt: new Date(createdAt) });
      res.json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/logs/:id/update", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schema = z.object({
        createdAt: z.string().optional(),
        message: z.string().optional(),
        bodyTemperature: z.number().nullable().optional(),
        symptoms: z.string().nullable().optional(),
        symptomNote: z.string().nullable().optional(),
        formulaMl: z.number().nullable().optional(),
        breastLeftMin: z.number().nullable().optional(),
        breastRightMin: z.number().nullable().optional(),
        expressedMl: z.number().nullable().optional(),
        performedBy: z.string().nullable().optional(),
        spitUp: z.boolean().optional(),
        spitUpAmount: z.string().nullable().optional(),
        spitUpTiming: z.string().nullable().optional(),
        spitUpNote: z.string().nullable().optional(),
        // Sleep-log edit fields — client feedback 2026-07-30. Previously
        // these were captured on entry but silently dropped by this
        // endpoint, so the edit dialog appeared broken to the user.
        settlingMethod: z.string().nullable().optional(),
        settlingMinutes: z.number().nullable().optional(),
        sleepLocation: z.string().nullable().optional(),
        sleepNote: z.string().nullable().optional(),
        memo: z.string().nullable().optional(),
      });
      const data = schema.parse(req.body);
      const updateData: any = {};
      if (data.createdAt !== undefined) updateData.createdAt = new Date(data.createdAt);
      if (data.message !== undefined) updateData.message = data.message;
      if (data.bodyTemperature !== undefined) updateData.bodyTemperature = data.bodyTemperature;
      if (data.symptoms !== undefined) updateData.symptoms = data.symptoms;
      if (data.symptomNote !== undefined) updateData.symptomNote = data.symptomNote;
      if (data.formulaMl !== undefined) updateData.formulaMl = data.formulaMl;
      if (data.breastLeftMin !== undefined) updateData.breastLeftMin = data.breastLeftMin;
      if (data.breastRightMin !== undefined) updateData.breastRightMin = data.breastRightMin;
      if (data.expressedMl !== undefined) updateData.expressedMl = data.expressedMl;
      if (data.performedBy !== undefined) updateData.performedBy = data.performedBy;
      if (data.spitUp !== undefined) updateData.spitUp = data.spitUp;
      if (data.spitUpAmount !== undefined) updateData.spitUpAmount = data.spitUpAmount;
      if (data.spitUpTiming !== undefined) updateData.spitUpTiming = data.spitUpTiming;
      if (data.spitUpNote !== undefined) updateData.spitUpNote = data.spitUpNote;
      if (data.settlingMethod !== undefined) updateData.settlingMethod = data.settlingMethod;
      if (data.settlingMinutes !== undefined) updateData.settlingMinutes = data.settlingMinutes;
      if (data.sleepLocation !== undefined) updateData.sleepLocation = data.sleepLocation;
      if (data.sleepNote !== undefined) updateData.sleepNote = data.sleepNote;
      if (data.memo !== undefined) (updateData as any).memo = data.memo;
      const log = await storage.updateLog(id, updateData);
      res.json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/logs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLog(id);
      res.json({ ok: true });
    } catch (err) {
      throw err;
    }
  });

  app.post("/api/sleep-sessions/:id/update-time", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schema = z.object({
        startedAt: z.string(),
        endedAt: z.string().optional(),
      });
      const { startedAt, endedAt } = schema.parse(req.body);
      const start = new Date(startedAt);
      const end = endedAt ? new Date(endedAt) : undefined;
      const durationMin = end ? Math.round((end.getTime() - start.getTime()) / 60000) : undefined;
      const session = await storage.updateSleepSession(id, {
        startedAt: start,
        endedAt: end,
        durationMin,
      });
      res.json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/sleep-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSleepSessionWithLog(id);
      res.json({ ok: true });
    } catch (err) {
      throw err;
    }
  });

  app.post("/api/sleep-success", async (req, res) => {
    try {
      const sleepSuccessSchema = z.object({
        familyId: z.string().min(1),
        userId: z.string().min(1),
        childId: z.number().int().nullable().optional(),
        elapsedMinutes: z.number().int().min(0).default(0),
      });
      const parsed = sleepSuccessSchema.parse(req.body);
      const { familyId, userId, childId, elapsedMinutes } = parsed;
      const userLabel = userId === "papa" ? "パパ" : "ママ";
      const partnerUser = userId === "papa" ? "mama" : "papa";

      const existing = await storage.getActiveSleepSession(familyId, childId);
      if (existing) {
        return res.status(400).json({ message: "既に睡眠セッションが進行中です" });
      }

      const session = await storage.startSleepSession({
        familyId,
        createdBy: userId,
        childId: childId ?? null,
        startedAt: new Date(),
      });

      await storage.createNotification({
        familyId,
        targetUser: partnerUser,
        message: `${userLabel}のネントレで赤ちゃんが寝ました（${elapsedMinutes || 0}分）`,
        type: "sleep_success",
        childId: childId ?? undefined,
      });

      res.status(201).json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Sleep success error:", err);
      res.status(500).json({ message: "Failed to record sleep success" });
    }
  });

  app.get(api.settings.get.path, async (req, res) => {
    const settings = await storage.getSettings(req.params.familyId);
    res.json(settings);
  });

  app.post(api.settings.update.path, async (req, res) => {
    try {
      const input = api.settings.update.input.parse(req.body);
      const settings = await storage.updateSettings(input);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.events.list.path, async (req, res) => {
    const events = await storage.getEvents(req.params.familyId);
    res.json(events);
  });

  app.post(api.events.create.path, async (req, res) => {
    try {
      const input = api.events.create.input.parse(req.body);
      const event = await storage.createEvent(input);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/events/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = api.events.update.input.parse(req.body);
      const event = await storage.updateEvent(id, data);
      res.json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/events/:id/complete", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { completedBy } = api.events.complete.input.parse(req.body);
      const event = await storage.completeEvent(id, completedBy);

      await storage.createLog({
        familyId: event.familyId,
        userId: completedBy,
        type: "event_done",
        message: `${event.title} を完了！`,
      });

      res.json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteEvent(id);
    res.json({ success: true });
  });

  // --- Coupons ---
  app.get(api.coupons.list.path, async (req, res) => {
    const familyId = req.params.familyId;
    let couponList = await storage.getCoupons(familyId);
    if (couponList.length === 0) {
      for (const c of DEFAULT_COUPONS) {
        await storage.createCoupon({ ...c, familyId, isCustom: false });
      }
      couponList = await storage.getCoupons(familyId);
    }
    res.json(couponList);
  });

  app.post(api.coupons.create.path, async (req, res) => {
    try {
      const input = api.coupons.create.input.parse(req.body);
      const coupon = await storage.createCoupon(input);
      res.status(201).json(coupon);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.coupons.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.coupons.update.input.parse(req.body);
      const coupon = await storage.updateCoupon(id, input);
      res.json(coupon);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteCoupon(id);
    res.json({ success: true });
  });

  app.post(api.coupons.exchange.path, async (req, res) => {
    try {
      const input = api.coupons.exchange.input.parse(req.body);
      const { familyId, couponId, ownerId } = input;

      const couponList = await storage.getCoupons(familyId);
      const coupon = couponList.find(c => c.id === couponId);
      if (!coupon) {
        return res.status(404).json({ message: "クーポンが見つかりません" });
      }

      const allLogs = await storage.getLogs(familyId);
      const userLogs = allLogs.filter(l => l.userId === ownerId);
      const totalEarned = userLogs.reduce((sum, l) => sum + (l.points || 0), 0);

      const allUserCoupons = await storage.getUserCoupons(familyId);
      const userOwned = allUserCoupons.filter(uc => uc.ownerId === ownerId);
      const totalSpent = userOwned.reduce((sum, uc) => sum + (uc.cost || 0), 0);

      const currentPoints = totalEarned - totalSpent;

      if (currentPoints < coupon.cost) {
        return res.status(400).json({
          message: `あと${coupon.cost - currentPoints}pt足りないっす！次のタスクで稼ぐっすよ！`,
          shortage: coupon.cost - currentPoints,
        });
      }

      const uc = await storage.exchangeCoupon({
        familyId,
        couponId,
        couponTitle: coupon.title,
        cost: coupon.cost,
        ownerId,
        status: "owned",
      });

      const partnerUser = ownerId === "papa" ? "mama" : "papa";
      const ownerLabel = ownerId === "papa" ? "パパ" : "ママ";
      await storage.createNotification({
        familyId,
        targetUser: partnerUser,
        message: `${ownerLabel}が『${coupon.title}』を交換しました！`,
        type: "coupon_exchange",
      });
      sendFamilyPush(db as any, familyId, null, "We育", `${ownerLabel}が『${coupon.title}』を交換しました！`).catch(() => {});

      res.status(201).json(uc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.coupons.userCoupons.path, async (req, res) => {
    const uc = await storage.getUserCoupons(req.params.familyId);
    res.json(uc);
  });

  app.post("/api/user-coupons/:id/redeem", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { userId, familyId } = api.coupons.redeem.input.parse(req.body);
      const uc = await storage.redeemCoupon(id);

      const partnerUser = userId === "papa" ? "mama" : "papa";
      const ownerLabel = userId === "papa" ? "パパ" : "ママ";
      await storage.createNotification({
        familyId,
        targetUser: partnerUser,
        message: `${ownerLabel}が『${uc.couponTitle}』を使いました！全力でサポートしましょう！`,
        type: "coupon_redeem",
      });
      sendFamilyPush(db as any, familyId, null, "We育", `${ownerLabel}が『${uc.couponTitle}』を使いました！全力でサポートしましょう！`).catch(() => {});

      res.json(uc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Sleep Training ---
  const DEFAULT_ROUTINES = [
    { title: "お風呂", assignee: "パパ", sortOrder: 0 },
    { title: "着替え", assignee: "ママ", sortOrder: 1 },
    { title: "授乳/ミルク", assignee: "ママ", sortOrder: 2 },
    { title: "絵本", assignee: "パパ", sortOrder: 3 },
    { title: "消灯（入眠）", assignee: "未定", sortOrder: 4 },
  ];

  app.get(api.sleep.checklist.get.path, async (req, res) => {
    const checklist = await storage.getSleepChecklist(req.params.familyId, req.params.date);
    res.json(checklist || { darkness: false, temperature: false, safety: false, whiteNoise: false });
  });

  app.post(api.sleep.checklist.update.path, async (req, res) => {
    try {
      const input = api.sleep.checklist.update.input.parse(req.body);
      const checklist = await storage.upsertSleepChecklist(input);
      res.json(checklist);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.sleep.routines.list.path, async (req, res) => {
    const familyId = req.params.familyId;
    let routines = await storage.getSleepRoutines(familyId);
    if (routines.length === 0) {
      for (const r of DEFAULT_ROUTINES) {
        await storage.createSleepRoutine({ ...r, familyId });
      }
      routines = await storage.getSleepRoutines(familyId);
    }
    res.json(routines);
  });

  app.post(api.sleep.routines.create.path, async (req, res) => {
    try {
      const input = api.sleep.routines.create.input.parse(req.body);
      const routine = await storage.createSleepRoutine(input);
      res.status(201).json(routine);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/sleep/routines/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = api.sleep.routines.update.input.parse(req.body);
      const routine = await storage.updateSleepRoutine(id, data);
      res.json(routine);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/sleep/routines/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteSleepRoutine(id);
    res.json({ success: true });
  });

  app.get(api.sleep.routineLogs.list.path, async (req, res) => {
    const logs = await storage.getSleepRoutineLogs(req.params.familyId, req.params.date);
    res.json(logs);
  });

  app.post(api.sleep.routineLogs.complete.path, async (req, res) => {
    try {
      const input = api.sleep.routineLogs.complete.input.parse(req.body);
      const { familyId, routineId, date, completedBy } = input;

      const allRoutines = await storage.getSleepRoutines(familyId);
      const completedRoutine = allRoutines.find(r => r.id === routineId);
      if (!completedRoutine || completedRoutine.familyId !== familyId) {
        return res.status(404).json({ message: "ルーティンが見つかりません" });
      }

      const existingLogs = await storage.getSleepRoutineLogs(familyId, date);
      const alreadyDone = existingLogs.some(l => l.routineId === routineId);
      if (alreadyDone) {
        return res.status(400).json({ message: "このステップは既に完了しています" });
      }

      const wasAllDoneBefore = allRoutines.every(r => existingLogs.some(l => l.routineId === r.id));

      const routineLog = await storage.completeSleepRoutineStep(input);

      const partnerUser = completedBy === "papa" ? "mama" : "papa";
      const userLabel = completedBy === "papa" ? "パパ" : "ママ";

      await storage.createNotification({
        familyId,
        targetUser: partnerUser,
        message: `${userLabel}が『${completedRoutine.title}』を完了しました！`,
        type: "routine_step",
      });

      const allLogsAfter = await storage.getSleepRoutineLogs(familyId, date);
      const allDone = allRoutines.every(r => allLogsAfter.some(l => l.routineId === r.id));

      if (allDone && !wasAllDoneBefore) {
        await storage.createLog({
          familyId,
          userId: completedBy,
          type: "routine_complete",
          message: "ねんねルーティン完了！チーム3倍ポイント！",
        });

        await storage.createNotification({
          familyId,
          targetUser: partnerUser,
          message: "ねんねルーティン全完了！チーム3倍ポイント獲得！",
          type: "routine_complete",
        });
      }

      res.status(201).json({ routineLog, allDone });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Sleep Sessions ---
  app.get(api.sleepSessions.list.path, async (req, res) => {
    const sessions = await storage.getSleepSessions(req.params.familyId);
    res.json(sessions);
  });

  app.get(api.sleepSessions.active.path, async (req, res) => {
    const childIdParam = req.query.childId;
    const childId = childIdParam ? parseInt(childIdParam as string) : undefined;
    const session = await storage.getActiveSleepSession(req.params.familyId, childId);
    res.json(session);
  });

  app.post(api.sleepSessions.start.path, async (req, res) => {
    try {
      const { familyId, createdBy, childId } = api.sleepSessions.start.input.parse(req.body);
      const existing = await storage.getActiveSleepSession(familyId, childId);
      if (existing) {
        return res.status(400).json({ message: "既に睡眠セッションが進行中です" });
      }
      const session = await storage.startSleepSession({ familyId, createdBy, childId: childId ?? null, startedAt: new Date() });
      res.status(201).json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/sleep-sessions/:id/end", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customEndedAt = req.body?.endedAt ? new Date(req.body.endedAt) : undefined;
      const session = customEndedAt
        ? await storage.endSleepSessionAt(id, customEndedAt)
        : await storage.endSleepSession(id);

      const hour = (customEndedAt || new Date()).getHours();
      const isLateNight = hour >= 0 && hour < 5;
      const points = isLateNight ? 20 : 10;

      await storage.createLog({
        familyId: session.familyId,
        childId: session.childId ?? undefined,
        userId: session.createdBy,
        type: "sleep",
        points,
        message: `${session.durationMin}分のねんねを記録しました！`,
      });

      res.json(session);
    } catch (err) {
      throw err;
    }
  });

  app.post(api.sleepSessions.manual.path, async (req, res) => {
    try {
      const { familyId, createdBy, childId, durationMin, startedAt } = api.sleepSessions.manual.input.parse(req.body);
      const start = new Date(startedAt);
      const end = new Date(start.getTime() + durationMin * 60000);
      const session = await storage.createManualSleepSession({
        familyId,
        createdBy,
        childId: childId ?? null,
        startedAt: start,
        endedAt: end,
        durationMin,
      });

      await storage.createLog({
        familyId,
        childId: childId ?? undefined,
        userId: createdBy,
        type: "sleep",
        message: `${durationMin}分のねんねを記録しました！（手入力）`,
      });

      res.status(201).json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Growth Records ---
  app.get(api.growth.list.path, async (req, res) => {
    const records = await storage.getGrowthRecords(req.params.familyId);
    res.json(records);
  });

  app.post(api.growth.create.path, async (req, res) => {
    try {
      const input = api.growth.create.input.parse(req.body);
      const record = await storage.createGrowthRecord(input);
      res.status(201).json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Skills ---
  app.get(api.skills.list.path, async (req, res) => {
    const completions = await storage.getSkillCompletions(req.params.familyId);
    res.json(completions);
  });

  app.post(api.skills.complete.path, async (req, res) => {
    try {
      const input = api.skills.complete.input.parse(req.body);
      const existing = await storage.getSkillCompletions(input.familyId);
      const alreadyDone = existing.some(
        (c) => c.userId === input.userId && c.skillId === input.skillId
      );
      if (alreadyDone) {
        return res.status(400).json({ message: "このスキルは既に習得済みです" });
      }
      const completion = await storage.completeSkill(input);
      res.status(201).json(completion);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.skills.uncomplete.path, async (req, res) => {
    try {
      const { familyId, userId, skillId } = api.skills.uncomplete.input.parse(req.body);
      await storage.deleteSkillCompletion(familyId, userId, skillId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Notifications ---
  app.get(api.notifications.list.path, async (req, res) => {
    const notifs = await storage.getNotifications(req.params.familyId, req.params.targetUser);
    res.json(notifs);
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.markNotificationRead(id);
    res.json({ success: true });
  });

  // --- Feedbacks ---
  app.post(api.feedbacks.create.path, async (req, res) => {
    try {
      const input = api.feedbacks.create.input.parse(req.body);
      const feedback = await storage.createFeedback(input);
      res.status(201).json(feedback);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.weBoard.list.path, async (req, res) => {
    const messages = await storage.getWeBoardMessages(req.params.familyId);
    res.json(messages);
  });

  app.post(api.weBoard.create.path, async (req, res) => {
    try {
      const input = api.weBoard.create.input.parse(req.body);
      const msg = await storage.createWeBoardMessage(input);
      res.status(201).json(msg);
    } catch (err: any) {
      if (err?.errors) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.healthRecords.list.path, async (req, res) => {
    const records = await storage.getHealthRecords(req.params.familyId);
    res.json(records);
  });

  app.post(api.healthRecords.create.path, async (req, res) => {
    try {
      const input = api.healthRecords.create.input.parse(req.body);
      const record = await storage.createHealthRecord(input);
      res.status(201).json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/health-records/:id/update", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schema = z.object({
        title: z.string().optional(),
        detail: z.string().nullable().optional(),
        recordedAt: z.string().nullable().optional(),
      });
      const data = schema.parse(req.body);
      const record = await storage.updateHealthRecord(id, data);
      res.json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.healthRecords.delete.path, async (req, res) => {
    await storage.deleteHealthRecord(parseInt(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/vaccination-records/:familyId/:childId", async (req, res) => {
    const records = await storage.getVaccinationRecords(req.params.familyId, parseInt(req.params.childId));
    res.json(records);
  });

  app.get("/api/vaccination-records/:familyId", async (req, res) => {
    const records = await storage.getVaccinationRecords(req.params.familyId);
    res.json(records);
  });

  app.post("/api/vaccination-records", async (req, res) => {
    try {
      const schema = z.object({
        familyId: z.string(),
        childId: z.number().nullable().optional(),
        vaccineId: z.string(),
        administeredDate: z.string(),
        note: z.string().nullable().optional(),
      });
      const data = schema.parse(req.body);
      const record = await storage.createVaccinationRecord(data as any);
      res.json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/vaccination-records/:id/update", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schema = z.object({
        administeredDate: z.string().optional(),
        note: z.string().nullable().optional(),
      });
      const data = schema.parse(req.body);
      const record = await storage.updateVaccinationRecord(id, data);
      res.json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/vaccination-records/:id", async (req, res) => {
    await storage.deleteVaccinationRecord(parseInt(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/custom-vaccines/:familyId/:childId", async (req, res) => {
    const records = await storage.getCustomVaccines(req.params.familyId, parseInt(req.params.childId));
    res.json(records);
  });

  app.get("/api/custom-vaccines/:familyId", async (req, res) => {
    const records = await storage.getCustomVaccines(req.params.familyId);
    res.json(records);
  });

  app.post("/api/custom-vaccines", async (req, res) => {
    try {
      const schema = z.object({
        familyId: z.string(),
        childId: z.number().nullable().optional(),
        name: z.string().min(1),
      });
      const data = schema.parse(req.body);
      const record = await storage.createCustomVaccine(data);
      res.status(201).json(record);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/custom-vaccines/:id", async (req, res) => {
    await storage.deleteCustomVaccine(parseInt(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/families/:familyId/food-ingredients/:childId", async (req, res) => {
    const items = await storage.getFoodIngredients(req.params.familyId, parseInt(req.params.childId));
    res.json(items);
  });

  app.post("/api/families/:familyId/food-ingredients", async (req, res) => {
    try {
      const data = {
        ...req.body,
        familyId: req.params.familyId,
      };
      const item = await storage.upsertFoodIngredient(data);
      res.status(201).json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/families/:familyId/food-ingredients/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const allItems = await db.select().from(foodIngredients).where(eq(foodIngredients.id, id));
    if (allItems.length === 0 || allItems[0].familyId !== req.params.familyId) {
      return res.status(404).json({ error: "Not found" });
    }
    await storage.deleteFoodIngredient(id);
    res.json({ ok: true });
  });

  app.get("/api/families/:familyId/custom-childcare-items", async (req, res) => {
    const items = await storage.getCustomChildcareItems(req.params.familyId);
    res.json(items);
  });

  app.post("/api/families/:familyId/custom-childcare-items", async (req, res) => {
    try {
      const data = {
        ...req.body,
        familyId: req.params.familyId,
      };
      const item = await storage.createCustomChildcareItem(data);
      res.status(201).json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/families/:familyId/custom-childcare-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await db.select().from(customChildcareItems).where(eq(customChildcareItems.id, id));
      if (existing.length === 0 || existing[0].familyId !== req.params.familyId) {
        return res.status(404).json({ error: "Not found" });
      }
      const item = await storage.updateCustomChildcareItem(id, req.body);
      res.json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/families/:familyId/custom-childcare-items/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await db.select().from(customChildcareItems).where(eq(customChildcareItems.id, id));
    if (existing.length === 0 || existing[0].familyId !== req.params.familyId) {
      return res.status(404).json({ error: "Not found" });
    }
    await storage.deleteCustomChildcareItem(id);
    res.json({ ok: true });
  });

  app.post("/api/admin/generate-codes", async (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY.trim()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { count = 10, prefix = "BUDOU" } = req.body;
    const codes: string[] = [];
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for (let i = 0; i < Math.min(count, 200); i++) {
      let suffix = "";
      for (let j = 0; j < 4; j++) {
        suffix += chars[Math.floor(Math.random() * chars.length)];
      }
      codes.push(`${prefix}-${suffix}`);
    }

    const values = codes.map(code => ({ code }));
    try {
      await db.insert(invitationCodes).values(values).onConflictDoNothing();
      res.json({ success: true, codes });
    } catch (err) {
      console.error("Generate codes error:", err);
      res.status(500).json({ message: "Failed to generate codes" });
    }
  });

  app.get("/api/admin/invitation-codes", async (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY.trim()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const codes = await db
        .select()
        .from(invitationCodes)
        .orderBy(sql`${invitationCodes.createdAt} DESC`);
      res.json(codes);
    } catch (err) {
      console.error("Invitation codes error:", err);
      res.status(500).json({ message: "Failed to fetch codes" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY.trim()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const allUsers = await db
        .select()
        .from(users)
        .orderBy(sql`${users.createdAt} DESC`);
      res.json(allUsers);
    } catch (err) {
      console.error("Admin users error:", err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/stats", async (_req, res) => {
    try {
      const totalFamilies = await db.select({ count: sql<number>`count(*)` }).from(settings);
      const totalLogs = await db.select({ count: sql<number>`count(*)` }).from(logs);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayLogs = await db.select({ count: sql<number>`count(*)` }).from(logs)
        .where(sql`${logs.createdAt} >= ${today}`);

      const papaCount = await db.select({ count: sql<number>`count(distinct ${logs.familyId})` }).from(logs)
        .where(eq(logs.userId, "papa"));
      const mamaCount = await db.select({ count: sql<number>`count(distinct ${logs.familyId})` }).from(logs)
        .where(eq(logs.userId, "mama"));
      const pairedFamilies = await db.select({ count: sql<number>`count(*)` }).from(
        sql`(SELECT ${logs.familyId} FROM ${logs} GROUP BY ${logs.familyId} HAVING count(distinct ${logs.userId}) >= 2) sub`
      );

      const feedbackCount = await db.select({ count: sql<number>`count(*)` }).from(feedbacks);

      res.json({
        totalFamilies: Number(totalFamilies[0]?.count ?? 0),
        totalLogs: Number(totalLogs[0]?.count ?? 0),
        todayLogs: Number(todayLogs[0]?.count ?? 0),
        papaFamilies: Number(papaCount[0]?.count ?? 0),
        mamaFamilies: Number(mamaCount[0]?.count ?? 0),
        pairedFamilies: Number(pairedFamilies[0]?.count ?? 0),
        feedbackCount: Number(feedbackCount[0]?.count ?? 0),
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      res.status(500).json({ message: "Stats query failed" });
    }
  });

  app.get("/api/admin/feedbacks", async (_req, res) => {
    try {
      const allFeedbacks = await db
        .select()
        .from(feedbacks)
        .orderBy(sql`${feedbacks.createdAt} DESC`);
      res.json(allFeedbacks);
    } catch (err) {
      console.error("Admin feedbacks error:", err);
      res.status(500).json({ message: "Feedbacks query failed" });
    }
  });

  // ─── Widget Summary ──────────────────────────────────────────────────────────
  // Returns a compact snapshot for home screen widgets (Small / Medium / Large).
  app.get("/api/widget-summary/:familyId", async (req, res) => {
    const { familyId } = req.params;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const recentLogs = await db
      .select()
      .from(logs)
      .where(and(eq(logs.familyId, familyId), gte(logs.createdAt, todayStart)))
      .orderBy(desc(logs.createdAt));

    const allFeeding = recentLogs.filter(
      (l) => l.type === "breastfeed" || l.type === "formula" || l.type === "expressed",
    );
    const allDiaper = recentLogs.filter(
      (l) => l.type === "diaper_wet" || l.type === "diaper_poop",
    );
    const allSleep = recentLogs.filter((l) => l.type === "sleep");

    const lastFeeding = allFeeding[0] ?? null;
    const lastDiaper = allDiaper[0] ?? null;
    const lastSleep = allSleep[0] ?? null;

    // Determine sleep state: last "sleep" sub-type indicates awake (起床) or asleep (就寝).
    let sleepStatus = "unknown";
    if (lastSleep) {
      sleepStatus = lastSleep.subType === "wake" ? "awake" : "sleeping";
    }

    res.json({
      lastFeeding: lastFeeding
        ? {
            time: lastFeeding.createdAt,
            type: lastFeeding.type,
            formulaMl: lastFeeding.formulaMl,
            breastLeftMin: lastFeeding.breastLeftMin,
            breastRightMin: lastFeeding.breastRightMin,
          }
        : null,
      lastDiaper: lastDiaper
        ? { time: lastDiaper.createdAt, type: lastDiaper.type }
        : null,
      sleepStatus,
      lastSleepTime: lastSleep?.createdAt ?? null,
      todayCounts: {
        feedings: allFeeding.length,
        diapers: allDiaper.length,
        sleepSessions: allSleep.filter((l) => l.subType !== "wake").length,
      },
      updatedAt: new Date().toISOString(),
    });
  });

  // ─── PiyoLog import ──────────────────────────────────────────────────────────
  // POST /api/import/piyolog
  // Body: { text: string, familyId: string, childId: number, userId: string }
  // Parses .txt content and bulk-inserts logs. Returns a preview if dryRun=true.
  app.post("/api/import/piyolog", async (req, res) => {
    try {
      const schema = z.object({
        text: z.string().min(10, "テキストが短すぎます"),
        familyId: z.string(),
        childId: z.number(),
        userId: z.string(),
        dryRun: z.boolean().optional().default(false),
      });

      const { text, familyId, childId, userId, dryRun } = schema.parse(req.body);
      const { entries, skipped, errors } = parsePiyoLog(text);

      if (dryRun) {
        return res.json({
          preview: entries.slice(0, 20).map((e) => ({
            dateTime: e.dateTime,
            type: e.type,
            rawCategory: e.rawCategory,
            detail: e.rawDetail,
          })),
          totalEntries: entries.length,
          skipped,
          errors,
        });
      }

      // Bulk insert
      let imported = 0;
      for (const entry of entries) {
        try {
          const logData: any = {
            familyId,
            childId,
            userId,
            type: entry.type,
            points: 1,
            subType: entry.subType ?? null,
            message: entry.message ?? null,
            breastLeftMin: entry.breastLeftMin ?? null,
            breastRightMin: entry.breastRightMin ?? null,
            formulaMl: entry.formulaMl ?? null,
            bodyTemperature: entry.bodyTemperature ?? null,
          };
          let created = await storage.createLog(logData);
          // Override createdAt with the original timestamp from ぴよログ
          await storage.updateLog(created.id, { createdAt: entry.dateTime });
          imported++;
        } catch {
          // Skip individual failures — continue with remaining entries.
        }
      }

      res.json({ success: true, imported, skipped, errors });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // ── Promotions (In-Context) ─────────────────────────────────────────────────

  app.get("/api/promotions/contextual/:logType", async (req, res) => {
    try {
      const { logType } = req.params;
      const currentHour = new Date().getHours();

      const allPromos = await db
        .select()
        .from(promotions)
        .where(and(
          eq(promotions.triggerLogType, logType),
          eq(promotions.isActive, true),
        ));

      const matched = allPromos.filter((p) => {
        if (p.triggerTimeStart != null && p.triggerTimeEnd != null) {
          if (p.triggerTimeStart <= p.triggerTimeEnd) {
            return currentHour >= p.triggerTimeStart && currentHour < p.triggerTimeEnd;
          }
          return currentHour >= p.triggerTimeStart || currentHour < p.triggerTimeEnd;
        }
        return true;
      });

      if (matched.length === 0) {
        return res.json(null);
      }

      const promo = matched[Math.floor(Math.random() * matched.length)];

      await db
        .update(promotions)
        .set({ impressionCount: sql`${promotions.impressionCount} + 1` })
        .where(eq(promotions.id, promo.id));

      let sponsor = null;
      if (promo.sponsorId) {
        const [s] = await db.select().from(sponsors).where(eq(sponsors.id, promo.sponsorId));
        sponsor = s ?? null;
      }

      res.json({ ...promo, sponsor });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch promotion" });
    }
  });

  app.post("/api/promotions/:id/click", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { familyId, userId } = req.body;

      await db
        .update(promotions)
        .set({ clickCount: sql`${promotions.clickCount} + 1` })
        .where(eq(promotions.id, id));

      await db.insert(promotionImpressions).values({
        promotionId: id,
        familyId,
        userId,
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to record click" });
    }
  });

  // ── Sponsored Coupons ─────────────────────────────────────────────────────

  app.get("/api/sponsored-coupons", async (_req, res) => {
    try {
      const items = await db
        .select()
        .from(sponsoredCoupons)
        .where(eq(sponsoredCoupons.isActive, true))
        .orderBy(desc(sponsoredCoupons.createdAt));

      const withSponsors = await Promise.all(
        items.map(async (sc) => {
          const [sponsor] = await db
            .select()
            .from(sponsors)
            .where(eq(sponsors.id, sc.sponsorId));
          return { ...sc, sponsor: sponsor ?? null };
        }),
      );

      res.json(withSponsors);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sponsored coupons" });
    }
  });

  app.post("/api/sponsored-coupons/:id/exchange", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { familyId, ownerId } = req.body;

      const [sc] = await db
        .select()
        .from(sponsoredCoupons)
        .where(eq(sponsoredCoupons.id, id));

      if (!sc) return res.status(404).json({ message: "Not found" });
      if (sc.remainingStock != null && sc.remainingStock <= 0) {
        return res.status(400).json({ message: "Out of stock" });
      }

      const allLogs = await db.select().from(logs).where(eq(logs.familyId, familyId));
      const earned = allLogs.reduce((s, l) => s + (l.points ?? 0), 0);

      const owned = await db
        .select()
        .from(userCouponsTable)
        .where(eq(userCouponsTable.familyId, familyId));
      const spent = owned.reduce((s, uc) => s + (uc.cost ?? 0), 0);
      const available = earned - spent;

      if (available < sc.pointsCost) {
        return res.status(400).json({ message: "Not enough points" });
      }

      await db.insert(userCouponsTable).values({
        familyId,
        couponId: 0,
        couponTitle: `[Sponsor] ${sc.title}`,
        cost: sc.pointsCost,
        ownerId,
        status: "owned",
      });

      if (sc.remainingStock != null) {
        await db
          .update(sponsoredCoupons)
          .set({ remainingStock: sql`${sponsoredCoupons.remainingStock} - 1` })
          .where(eq(sponsoredCoupons.id, id));
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Exchange failed" });
    }
  });

  // ── Sponsors (Admin) ──────────────────────────────────────────────────────

  app.get("/api/sponsors", async (_req, res) => {
    try {
      const items = await db.select().from(sponsors).where(eq(sponsors.isActive, true));
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sponsors" });
    }
  });

  app.post("/api/sponsors", async (req, res) => {
    try {
      const [sponsor] = await db.insert(sponsors).values(req.body).returning();
      res.json(sponsor);
    } catch (err) {
      res.status(500).json({ message: "Failed to create sponsor" });
    }
  });

  app.post("/api/promotions", async (req, res) => {
    try {
      const [promo] = await db.insert(promotions).values(req.body).returning();
      res.json(promo);
    } catch (err) {
      res.status(500).json({ message: "Failed to create promotion" });
    }
  });

  app.post("/api/sponsored-coupons", async (req, res) => {
    try {
      const [sc] = await db.insert(sponsoredCoupons).values(req.body).returning();
      res.json(sc);
    } catch (err) {
      res.status(500).json({ message: "Failed to create sponsored coupon" });
    }
  });

  // ── Community ──────────────────────────────────────────────────────────────

  const NG_WORDS = ["死ね", "殺す", "馬鹿", "アホ", "クソ", "出会い", "LINE交換", "連絡先"];

  function containsNgWord(text: string): boolean {
    return NG_WORDS.some((w) => text.includes(w));
  }

  const AVATAR_ICONS = ["bear", "rabbit", "cat", "dog", "panda", "penguin", "koala", "hamster"];

  // Profile
  app.get("/api/community/profile/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const [profile] = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, userId));
      res.json(profile ?? null);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/community/profile", async (req, res) => {
    try {
      const { userId, nickname, avatarIcon, childAgeMonths, showChildAge } = req.body;
      if (!nickname || nickname.length > 20) {
        return res.status(400).json({ message: "ニックネームは1〜20文字で入力してください" });
      }
      if (containsNgWord(nickname)) {
        return res.status(400).json({ message: "使用できないニックネームです" });
      }
      if (avatarIcon && !AVATAR_ICONS.includes(avatarIcon)) {
        return res.status(400).json({ message: "無効なアイコンです" });
      }

      const existing = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, userId));
      if (existing.length > 0) {
        const [updated] = await db.update(communityProfiles)
          .set({ nickname, avatarIcon: avatarIcon ?? "bear", childAgeMonths, showChildAge: showChildAge ?? true })
          .where(eq(communityProfiles.userId, userId))
          .returning();
        return res.json(updated);
      }

      const [profile] = await db.insert(communityProfiles).values({
        userId,
        nickname,
        avatarIcon: avatarIcon ?? "bear",
        childAgeMonths,
        showChildAge: showChildAge ?? true,
      }).returning();
      res.status(201).json(profile);
    } catch (err) {
      res.status(500).json({ message: "Failed to save profile" });
    }
  });

  // Rooms
  app.get("/api/community/rooms", async (_req, res) => {
    try {
      const rooms = await db.select().from(communityRooms).where(eq(communityRooms.isActive, true));
      res.json(rooms);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch rooms" });
    }
  });

  app.get("/api/community/rooms/recommend/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const [profile] = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, userId));
      const allRooms = await db.select().from(communityRooms).where(eq(communityRooms.isActive, true));

      const familyId = userId.split("_")[0];
      let userLogTypes: string[] = [];
      if (familyId) {
        const userLogs = await db.select().from(logs).where(eq(logs.familyId, familyId));
        userLogTypes = [...new Set(userLogs.map((l) => l.type))];
      }

      const scored = allRooms.map((room) => {
        let score = 0;
        if (room.triggerLogTypes) {
          const triggers = room.triggerLogTypes.split(",");
          const overlap = triggers.filter((t) => userLogTypes.includes(t)).length;
          score += overlap * 10;
        }
        if (profile?.childAgeMonths != null) {
          if (room.ageMonthsMin != null && room.ageMonthsMax != null) {
            if (profile.childAgeMonths >= room.ageMonthsMin && profile.childAgeMonths <= room.ageMonthsMax) {
              score += 5;
            }
          }
        }
        if (room.type === "challenge") score += 2;
        return { ...room, score };
      });

      scored.sort((a, b) => b.score - a.score);
      res.json(scored.slice(0, 5));
    } catch (err) {
      res.status(500).json({ message: "Failed to recommend rooms" });
    }
  });

  // Membership
  app.get("/api/community/memberships/:profileId", async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const memberships = await db.select().from(communityMemberships).where(eq(communityMemberships.profileId, profileId));
      const roomIds = memberships.map((m) => m.roomId);
      if (roomIds.length === 0) return res.json([]);
      const rooms = await db.select().from(communityRooms);
      res.json(rooms.filter((r) => roomIds.includes(r.id)));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch memberships" });
    }
  });

  app.post("/api/community/rooms/:roomId/join", async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const { profileId } = req.body;

      const [room] = await db.select().from(communityRooms).where(eq(communityRooms.id, roomId));
      if (!room) return res.status(404).json({ message: "ルームが見つかりません" });
      if (room.currentMembers >= room.maxMembers) {
        return res.status(400).json({ message: "このルームは満員です" });
      }

      const existing = await db.select().from(communityMemberships)
        .where(and(eq(communityMemberships.roomId, roomId), eq(communityMemberships.profileId, profileId)));
      if (existing.length > 0) return res.json({ already: true });

      await db.insert(communityMemberships).values({ roomId, profileId });
      await db.update(communityRooms)
        .set({ currentMembers: sql`${communityRooms.currentMembers} + 1` })
        .where(eq(communityRooms.id, roomId));

      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to join room" });
    }
  });

  app.post("/api/community/rooms/:roomId/leave", async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const { profileId } = req.body;

      await db.delete(communityMemberships)
        .where(and(eq(communityMemberships.roomId, roomId), eq(communityMemberships.profileId, profileId)));
      await db.update(communityRooms)
        .set({ currentMembers: sql`GREATEST(${communityRooms.currentMembers} - 1, 0)` })
        .where(eq(communityRooms.id, roomId));

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to leave room" });
    }
  });

  // Posts
  app.get("/api/community/rooms/:roomId/posts", async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const profileId = req.query.profileId ? parseInt(req.query.profileId as string) : null;

      let blockedIds: number[] = [];
      if (profileId) {
        const blocks = await db.select().from(communityBlocks).where(eq(communityBlocks.blockerProfileId, profileId));
        blockedIds = blocks.map((b) => b.blockedProfileId);
      }

      const posts = await db.select().from(communityPosts)
        .where(and(eq(communityPosts.roomId, roomId), eq(communityPosts.isHidden, false)))
        .orderBy(desc(communityPosts.createdAt))
        .limit(50);

      const filtered = posts.filter((p) => !blockedIds.includes(p.profileId));

      const withProfiles = await Promise.all(
        filtered.map(async (post) => {
          const [profile] = await db.select().from(communityProfiles).where(eq(communityProfiles.id, post.profileId));
          const reactions = await db.select().from(communityReactions).where(eq(communityReactions.postId, post.id));
          const wakaru = reactions.filter((r) => r.type === "wakaru").length;
          const ganbare = reactions.filter((r) => r.type === "ganbare").length;
          const myReaction = profileId
            ? reactions.find((r) => r.profileId === profileId)?.type ?? null
            : null;
          return {
            ...post,
            profile: profile ? { nickname: profile.nickname, avatarIcon: profile.avatarIcon, childAgeMonths: profile.showChildAge ? profile.childAgeMonths : null } : null,
            reactions: { wakaru, ganbare },
            myReaction,
          };
        }),
      );

      res.json(withProfiles);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.post("/api/community/rooms/:roomId/posts", async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const { profileId, body } = req.body;

      if (!body || body.length === 0 || body.length > 140) {
        return res.status(400).json({ message: "投稿は1〜140文字で入力してください" });
      }
      if (containsNgWord(body)) {
        return res.status(400).json({ message: "不適切な表現が含まれています" });
      }

      const [post] = await db.insert(communityPosts).values({ roomId, profileId, body }).returning();
      res.status(201).json(post);
    } catch (err) {
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  // Reactions
  app.post("/api/community/posts/:postId/react", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const { profileId, type } = req.body;
      if (!["wakaru", "ganbare"].includes(type)) {
        return res.status(400).json({ message: "Invalid reaction type" });
      }

      const existing = await db.select().from(communityReactions)
        .where(and(eq(communityReactions.postId, postId), eq(communityReactions.profileId, profileId)));

      if (existing.length > 0) {
        await db.delete(communityReactions)
          .where(and(eq(communityReactions.postId, postId), eq(communityReactions.profileId, profileId)));
        return res.json({ removed: true });
      }

      await db.insert(communityReactions).values({ postId, profileId, type });
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to react" });
    }
  });

  // Report
  app.post("/api/community/report", async (req, res) => {
    try {
      const { postId, reporterProfileId, targetProfileId, reason } = req.body;
      await db.insert(communityReports).values({
        postId,
        reporterProfileId,
        targetProfileId,
        reason: reason ?? "不適切な投稿",
      });
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to report" });
    }
  });

  // Block
  app.post("/api/community/block", async (req, res) => {
    try {
      const { blockerProfileId, blockedProfileId } = req.body;
      const existing = await db.select().from(communityBlocks)
        .where(and(eq(communityBlocks.blockerProfileId, blockerProfileId), eq(communityBlocks.blockedProfileId, blockedProfileId)));
      if (existing.length > 0) return res.json({ already: true });

      await db.insert(communityBlocks).values({ blockerProfileId, blockedProfileId });
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to block" });
    }
  });

  app.delete("/api/community/block", async (req, res) => {
    try {
      const { blockerProfileId, blockedProfileId } = req.body;
      await db.delete(communityBlocks)
        .where(and(eq(communityBlocks.blockerProfileId, blockerProfileId), eq(communityBlocks.blockedProfileId, blockedProfileId)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to unblock" });
    }
  });

  // Admin: manage posts (hide)
  app.post("/api/community/posts/:postId/hide", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      await db.update(communityPosts).set({ isHidden: true }).where(eq(communityPosts.id, postId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to hide post" });
    }
  });

  // Seed default rooms
  app.post("/api/community/seed-rooms", async (_req, res) => {
    try {
      const existing = await db.select().from(communityRooms);
      if (existing.length > 0) return res.json({ message: "Rooms already exist", count: existing.length });

      const defaultRooms = [
        { type: "challenge", slug: "nentore", name: "ねんトレ中", description: "睡眠トレーニングに取り組んでいるパパ・ママの交流の場", icon: "😴", triggerLogTypes: "sleep", maxMembers: 150 },
        { type: "challenge", slug: "rinyushoku", name: "離乳食スタート", description: "離乳食の進め方を共有しましょう", icon: "🥣", triggerLogTypes: "food", ageMonthsMin: 5, ageMonthsMax: 18, maxMembers: 150 },
        { type: "challenge", slug: "toitore", name: "トイトレ中", description: "トイレトレーニングの悩みや工夫を共有", icon: "🚽", ageMonthsMin: 18, ageMonthsMax: 48, maxMembers: 150 },
        { type: "challenge", slug: "yonaki", name: "夜泣き対策", description: "夜泣きに悩むパパ・ママの応援ルーム", icon: "🌙", triggerLogTypes: "sleep,breastfeed,formula", ageMonthsMin: 0, ageMonthsMax: 18, maxMembers: 150 },
        { type: "challenge", slug: "futago", name: "双子・多胎育児", description: "双子・三つ子の育児を頑張る仲間と繋がろう", icon: "👶👶", maxMembers: 100 },
        { type: "age", slug: "age-0-3m", name: "0〜3ヶ月", description: "新生児期のパパ・ママの交流ルーム", icon: "🍼", ageMonthsMin: 0, ageMonthsMax: 3, maxMembers: 200 },
        { type: "age", slug: "age-4-6m", name: "4〜6ヶ月", description: "首すわり〜寝返りの時期のルーム", icon: "👶", ageMonthsMin: 4, ageMonthsMax: 6, maxMembers: 200 },
        { type: "age", slug: "age-7-12m", name: "7〜12ヶ月", description: "おすわり〜つかまり立ちの時期のルーム", icon: "🧸", ageMonthsMin: 7, ageMonthsMax: 12, maxMembers: 200 },
        { type: "age", slug: "age-1y", name: "1歳", description: "1歳のお子さまのルーム", icon: "🎂", ageMonthsMin: 12, ageMonthsMax: 23, maxMembers: 200 },
        { type: "age", slug: "age-2y", name: "2歳", description: "2歳のお子さまのルーム", icon: "✌️", ageMonthsMin: 24, ageMonthsMax: 35, maxMembers: 200 },
      ];

      for (const room of defaultRooms) {
        await db.insert(communityRooms).values(room);
      }

      res.json({ message: "Default rooms created", count: defaultRooms.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to seed rooms" });
    }
  });

  // ── ママのからだ記録 ────────────────────────────────────────────────────────
  app.get("/api/mama-health/:familyId", async (req, res) => {
    try {
      const records = await db
        .select()
        .from(mamaHealthRecords)
        .where(eq(mamaHealthRecords.familyId, req.params.familyId))
        .orderBy(desc(mamaHealthRecords.recordedDate));
      res.json(records);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch mama health records" });
    }
  });

  app.post("/api/mama-health", async (req, res) => {
    try {
      const [record] = await db.insert(mamaHealthRecords).values(req.body).returning();
      res.json(record);
    } catch (e) {
      res.status(500).json({ message: "Failed to save mama health record" });
    }
  });

  // ── ママのお薬記録 ────────────────────────────────────────────────────────
  app.get("/api/mama-medicine/:familyId", async (req, res) => {
    try {
      const records = await db
        .select()
        .from(mamaMedicineRecords)
        .where(eq(mamaMedicineRecords.familyId, req.params.familyId))
        .orderBy(desc(mamaMedicineRecords.takenAt));
      res.json(records);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch mama medicine records" });
    }
  });

  app.post("/api/mama-medicine", async (req, res) => {
    try {
      const [record] = await db.insert(mamaMedicineRecords).values(req.body).returning();
      res.json(record);
    } catch (e) {
      res.status(500).json({ message: "Failed to save mama medicine record" });
    }
  });

  // --- Ported from WeYu/server: endpoints required by mobile Quick Log / Settings / MamaHealth screens ---

  app.get("/api/families/:familyId/caregiver-medicine-names", async (req, res) => {
    const allLogs = await storage.getLogs(req.params.familyId);
    const caregiverLogs = allLogs
      .filter((l: any) => l.type === "caregiver_medicine")
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const names = [...new Set(
      caregiverLogs.filter((l: any) => l.medicineName).map((l: any) => l.medicineName as string)
    )];
    const lastLog = caregiverLogs[0] || null;
    res.json({ names, lastLog });
  });

  app.post("/api/logs/bulk-delete", async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.number().int()) }).parse(req.body);
    await Promise.all(ids.map((id) => storage.deleteLog(id)));
    res.json({ ok: true, deleted: ids.length });
  });

  app.patch("/api/logs/:logId/sleep-detail", async (req, res) => {
    try {
      const logId = parseInt(req.params.logId);
      if (isNaN(logId)) return res.status(400).json({ message: "Invalid logId" });
      const schema = z.object({
        settlingMethod: z.string().optional(),
        sleepLocation: z.string().optional(),
        sleepNote: z.string().nullable().optional(),
      });
      const data = schema.parse(req.body);
      const log = await storage.updateLogSleepDetail(logId, data);
      res.json(log);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to update sleep detail" });
    }
  });

  app.patch("/api/growth/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const { weightGrams, heightCm, measuredAt } = req.body;
    const data: any = {};
    if (weightGrams !== undefined) data.weightGrams = weightGrams;
    if (heightCm !== undefined) data.heightCm = heightCm;
    if (measuredAt !== undefined) data.measuredAt = measuredAt;
    const record = await storage.updateGrowthRecord(id, data);
    if (!record) return res.status(404).json({ message: "Not found" });
    res.json(record);
  });

  app.delete("/api/growth/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteGrowthRecord(id);
    res.status(204).send();
  });

  app.post("/api/families/:familyId/food-ingredients/bulk", async (req, res) => {
    try {
      const schema = z.object({
        childId: z.number(),
        items: z.array(z.object({
          ingredientName: z.string(),
          category: z.string(),
          status: z.string().default("ok"),
          firstTriedDate: z.string().nullable().optional(),
        })),
      });
      const { childId, items } = schema.parse(req.body);
      const today = new Date().toISOString().slice(0, 10);
      const results = await Promise.all(
        items.map(item =>
          storage.upsertFoodIngredient({
            familyId: req.params.familyId,
            childId,
            ingredientName: item.ingredientName,
            category: item.category,
            status: item.status,
            firstTriedDate: item.firstTriedDate ?? today,
            isCustom: false,
          })
        )
      );
      res.status(201).json(results);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/families/:familyId/food-ingredients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allItems = await db.select().from(foodIngredients).where(eq(foodIngredients.id, id));
      if (allItems.length === 0 || allItems[0].familyId !== req.params.familyId) {
        return res.status(404).json({ error: "Not found" });
      }
      const schema = z.object({
        ingredientName: z.string().min(1).optional(),
        category: z.string().optional(),
        status: z.string().optional(),
        firstTriedDate: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      });
      const data = schema.parse(req.body);
      const updated = await storage.updateFoodIngredientById(id, data);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/families/:familyId/custom-quick-actions", async (req, res) => {
    const items = await storage.getCustomQuickActions(req.params.familyId);
    res.json(items);
  });

  app.post("/api/families/:familyId/custom-quick-actions", async (req, res) => {
    const { label, iconName = "Star", colorScheme = "purple" } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: "label required" });
    const existing = await storage.getCustomQuickActions(req.params.familyId);
    if (existing.length >= 10) return res.status(400).json({ error: "最大10件まで作成できます" });
    const item = await storage.createCustomQuickAction({
      familyId: req.params.familyId,
      label: label.trim(),
      iconName,
      colorScheme,
      sortOrder: existing.length,
      isActive: true,
    });
    res.json(item);
  });

  app.delete("/api/families/:familyId/custom-quick-actions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteCustomQuickAction(id);
    res.json({ ok: true });
  });

  app.get("/api/mama-health-logs/today", async (req, res) => {
    const s = req.session as any;
    if (!s?.userId) return res.status(401).json({ message: "Unauthorized" });
    const log = await storage.getTodayMamaHealthLog(s.userId);
    res.json(log || null);
  });

  app.get("/api/mama-health-logs", async (req, res) => {
    const s = req.session as any;
    if (!s?.userId) return res.status(401).json({ message: "Unauthorized" });
    const logs = await storage.getMamaHealthLogs(s.userId);
    res.json(logs);
  });

  app.post("/api/mama-health-logs", async (req, res) => {
    const s = req.session as any;
    if (!s?.userId) return res.status(401).json({ message: "Unauthorized" });
    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      bowel: z.boolean().nullish(),
      bowelNote: z.string().nullish(),
      lochia: z.string().nullish(),
      perinealPain: z.number().int().min(0).max(4).nullish(),
      mood: z.number().int().min(0).max(4).nullish(),
      sleepHours: z.number().min(0).max(24).nullish(),
      nursingIssues: z.array(z.string()).nullish(),
      nursingNote: z.string().nullish(),
      weightKg: z.number().min(0).max(300).nullish(),
      swelling: z.boolean().nullish(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const { date, ...data } = parsed.data;
    const log = await storage.upsertMamaHealthLog(s.userId, data as any, date);
    res.json(log);
  });

  return httpServer;
}
