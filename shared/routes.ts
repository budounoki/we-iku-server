import { z } from 'zod';
import { insertChildSchema, insertLogSchema, insertSettingSchema, insertEventSchema, insertCouponSchema, insertSleepChecklistSchema, insertSleepRoutineSchema, insertSleepRoutineLogSchema, insertGrowthRecordSchema, insertSleepSessionSchema, insertSkillCompletionSchema, insertFeedbackSchema, insertWeBoardSchema, insertHealthRecordSchema, children, logs, settings, events, coupons, userCoupons, notifications, sleepChecklist, sleepRoutines, sleepRoutineLogs, growthRecords, sleepSessions, skillCompletions, feedbacks, weBoard, healthRecords } from './schema';

export const api = {
  children: {
    list: {
      method: 'GET' as const,
      path: '/api/children/:familyId' as const,
      responses: {
        200: z.array(z.custom<typeof children.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/children' as const,
      input: insertChildSchema,
      responses: {
        201: z.custom<typeof children.$inferSelect>(),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/children/:id' as const,
      input: insertChildSchema.partial(),
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/children/:id' as const,
    },
  },
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs/:familyId' as const,
      responses: {
        200: z.array(z.custom<typeof logs.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/logs' as const,
      input: insertLogSchema,
      responses: {
        201: z.custom<typeof logs.$inferSelect>(),
      },
    },
  },
  settings: {
    get: {
      method: 'GET' as const,
      path: '/api/settings/:familyId' as const,
      responses: {
        200: z.custom<typeof settings.$inferSelect>(),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/settings' as const,
      input: insertSettingSchema,
      responses: {
        200: z.custom<typeof settings.$inferSelect>(),
      },
    },
  },
  events: {
    list: {
      method: 'GET' as const,
      path: '/api/events/:familyId' as const,
      responses: {
        200: z.array(z.custom<typeof events.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/events' as const,
      input: insertEventSchema,
      responses: {
        201: z.custom<typeof events.$inferSelect>(),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/events/:id' as const,
      input: insertEventSchema.partial(),
      responses: {
        200: z.custom<typeof events.$inferSelect>(),
      },
    },
    complete: {
      method: 'POST' as const,
      path: '/api/events/:id/complete' as const,
      input: z.object({ completedBy: z.string() }),
      responses: {
        200: z.custom<typeof events.$inferSelect>(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/events/:id' as const,
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
  },
  coupons: {
    list: {
      method: 'GET' as const,
      path: '/api/coupons/:familyId' as const,
    },
    create: {
      method: 'POST' as const,
      path: '/api/coupons' as const,
      input: insertCouponSchema,
    },
    update: {
      method: 'POST' as const,
      path: '/api/coupons/:id/update' as const,
      input: z.object({ title: z.string().optional(), cost: z.number().optional() }),
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/coupons/:id' as const,
    },
    exchange: {
      method: 'POST' as const,
      path: '/api/coupons/exchange' as const,
      input: z.object({
        familyId: z.string(),
        couponId: z.number(),
        couponTitle: z.string(),
        cost: z.number(),
        ownerId: z.string(),
      }),
    },
    userCoupons: {
      method: 'GET' as const,
      path: '/api/user-coupons/:familyId' as const,
    },
    redeem: {
      method: 'POST' as const,
      path: '/api/user-coupons/:id/redeem' as const,
      input: z.object({ userId: z.string(), familyId: z.string() }),
    },
  },
  notifications: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications/:familyId/:targetUser' as const,
    },
    markRead: {
      method: 'POST' as const,
      path: '/api/notifications/:id/read' as const,
    },
  },
  sleep: {
    checklist: {
      get: {
        method: 'GET' as const,
        path: '/api/sleep/checklist/:familyId/:date' as const,
      },
      update: {
        method: 'POST' as const,
        path: '/api/sleep/checklist' as const,
        input: insertSleepChecklistSchema,
      },
    },
    routines: {
      list: {
        method: 'GET' as const,
        path: '/api/sleep/routines/:familyId' as const,
      },
      create: {
        method: 'POST' as const,
        path: '/api/sleep/routines' as const,
        input: insertSleepRoutineSchema,
      },
      update: {
        method: 'POST' as const,
        path: '/api/sleep/routines/:id' as const,
        input: insertSleepRoutineSchema.partial(),
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/sleep/routines/:id' as const,
      },
    },
    routineLogs: {
      list: {
        method: 'GET' as const,
        path: '/api/sleep/routine-logs/:familyId/:date' as const,
      },
      complete: {
        method: 'POST' as const,
        path: '/api/sleep/routine-logs/complete' as const,
        input: z.object({
          familyId: z.string(),
          routineId: z.number(),
          date: z.string(),
          completedBy: z.string(),
        }),
      },
    },
  },
  growth: {
    list: {
      method: 'GET' as const,
      path: '/api/growth/:familyId' as const,
    },
    create: {
      method: 'POST' as const,
      path: '/api/growth' as const,
      input: insertGrowthRecordSchema,
    },
  },
  sleepSessions: {
    list: {
      method: 'GET' as const,
      path: '/api/sleep-sessions/:familyId' as const,
    },
    active: {
      method: 'GET' as const,
      path: '/api/sleep-sessions/:familyId/active' as const,
    },
    start: {
      method: 'POST' as const,
      path: '/api/sleep-sessions/start' as const,
      input: z.object({ familyId: z.string(), createdBy: z.string(), childId: z.number().int().optional(), startedAt: z.string().optional(), settlingMethod: z.string().optional(), sleepLocation: z.string().optional(), sleepNote: z.string().optional() }),
    },
    end: {
      method: 'POST' as const,
      path: '/api/sleep-sessions/:id/end' as const,
    },
    manual: {
      method: 'POST' as const,
      path: '/api/sleep-sessions/manual' as const,
      input: z.object({
        familyId: z.string(),
        createdBy: z.string(),
        childId: z.number().int().optional(),
        durationMin: z.number().min(1),
        startedAt: z.string(),
        settlingMethod: z.string().optional(),
        settlingMinutes: z.number().int().min(0).optional(),
        sleepLocation: z.string().optional(),
        sleepNote: z.string().optional(),
      }),
    },
  },
  skills: {
    list: {
      method: 'GET' as const,
      path: '/api/skills/:familyId' as const,
    },
    complete: {
      method: 'POST' as const,
      path: '/api/skills/complete' as const,
      input: insertSkillCompletionSchema,
    },
    uncomplete: {
      method: 'POST' as const,
      path: '/api/skills/uncomplete' as const,
      input: z.object({
        familyId: z.string(),
        userId: z.string(),
        skillId: z.string(),
      }),
    },
  },
  feedbacks: {
    create: {
      method: 'POST' as const,
      path: '/api/feedbacks' as const,
      input: insertFeedbackSchema,
    },
  },
  weBoard: {
    list: {
      method: 'GET' as const,
      path: '/api/we-board/:familyId' as const,
      responses: {
        200: z.array(z.custom<typeof weBoard.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/we-board' as const,
      input: insertWeBoardSchema,
      responses: {
        201: z.custom<typeof weBoard.$inferSelect>(),
      },
    },
  },
  healthRecords: {
    list: {
      method: 'GET' as const,
      path: '/api/health-records/:familyId' as const,
      responses: {
        200: z.array(z.custom<typeof healthRecords.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/health-records' as const,
      input: insertHealthRecordSchema,
      responses: {
        201: z.custom<typeof healthRecords.$inferSelect>(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/health-records/:id' as const,
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
