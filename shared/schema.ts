import { pgTable, text, serial, integer, boolean, timestamp, date, real, varchar, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  lineUserId: text("line_user_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  pictureUrl: text("picture_url"),
  familyId: text("family_id").notNull(),
  role: text("role").notNull().default("papa"),
  invitationVerified: boolean("invitation_verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invitationCodes = pgTable("invitation_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  isUsed: boolean("is_used").notNull().default(false),
  usedBy: text("used_by"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type AppUser = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  name: text("name").notNull(),
  birthday: date("birthday"),
  gender: text("gender"),
  bloodType: text("blood_type"),
  color: text("color").notNull().default("#805AAA"),
  sleepTrainingEnabled: boolean("sleep_training_enabled").notNull().default(true),
  rotavirusVaccineType: text("rotavirus_vaccine_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  points: integer("points").notNull().default(10),
  message: text("message"),
  subType: text("sub_type"),
  foodItems: text("food_items"),
  foodAmount: text("food_amount"),
  foodNote: text("food_note"),
  isNewFood: boolean("is_new_food").default(false),
  imageUrl: text("image_url"),
  poopColor: text("poop_color"),
  poopConsistency: text("poop_consistency"),
  bodyTemperature: real("body_temperature"),
  symptoms: text("symptoms"),
  symptomNote: text("symptom_note"),
  breastLeftMin: integer("breast_left_min"),
  breastRightMin: integer("breast_right_min"),
  isExpressed: boolean("is_expressed").default(false),
  expressedMl: integer("expressed_ml"),
  formulaMl: integer("formula_ml"),
  stoolType: text("stool_type"),
  stoolAmount: text("stool_amount"),
  stoolColor: text("stool_color"),
  medicineName: text("medicine_name"),
  medicineDose: text("medicine_dose"),
  performedBy: text("performed_by"),
  settlingMethod: text("settling_method"),
  settlingMinutes: integer("settling_minutes"),
  sleepLocation: text("sleep_location"),
  sleepNote: text("sleep_note"),
  spitUp: boolean("spit_up").default(false),
  spitUpAmount: text("spit_up_amount"),
  spitUpTiming: text("spit_up_timing"),
  spitUpNote: text("spit_up_note"),
  holdEndAt: timestamp("hold_end_at"),
  walkEndAt: timestamp("walk_end_at"),
  // When true, this milk log is skipped by the "next feeding" interval
  // predictor (e.g. a top-up alongside solids that shouldn't reset the timer).
  excludeFromInterval: boolean("exclude_from_interval").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().unique(),
  babyName: text("baby_name").notNull().default("赤ちゃんのなまえ"),
  babyBirthday: date("baby_birthday"),
  specialTrick: text("special_trick").default("ビニール袋の音"),
  currentCaregiver: text("current_caregiver").notNull().default("パパ"),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  title: text("title").notNull(),
  date: date("date").notNull(),
  time: text("time"),
  assignee: text("assignee").notNull().default("未定"),
  completed: boolean("completed").notNull().default(false),
  completedBy: text("completed_by"),
  points: integer("points").notNull().default(10),
  memo: text("memo"),
  icon: text("icon"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  title: text("title").notNull(),
  cost: integer("cost").notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userCoupons = pgTable("user_coupons", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  couponId: integer("coupon_id").notNull(),
  couponTitle: text("coupon_title").notNull(),
  cost: integer("cost").notNull(),
  ownerId: text("owner_id").notNull(),
  status: text("status").notNull().default("owned"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  targetUser: text("target_user").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("coupon"),
  read: boolean("read").notNull().default(false),
  childId: integer("child_id"),
  // Used by vaccine-reminder sync (and future recurring-notification
  // features) to dedupe re-sent reminders: format "vaccine:<childId>:<vaccineId>:<stage>"
  dedupeKey: text("dedupe_key"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("notifications_dedupe_unique")
    .on(table.familyId, table.targetUser, table.dedupeKey)
    .where(sql`dedupe_key IS NOT NULL`),
]);

export const growthRecords = pgTable("growth_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  userId: text("user_id").notNull(),
  weightGrams: integer("weight_grams"),
  heightCm: real("height_cm"),
  headCircumferenceCm: real("head_circumference_cm"),
  measuredAt: date("measured_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChildSchema = createInsertSchema(children).omit({ id: true, createdAt: true });
// Timestamps arrive as ISO strings from JSON clients but drizzle-zod maps
// `timestamp("…")` columns to `z.date()`. Clients (web + mobile) send ISO
// strings, so relax those fields to accept strings that will be coerced
// to Date by the DB driver.
export const insertLogSchema = createInsertSchema(logs)
  .omit({ id: true, createdAt: true })
  .extend({
    holdEndAt: z.string().datetime().nullable().optional(),
    walkEndAt: z.string().datetime().nullable().optional(),
  });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true });
export const insertUserCouponSchema = createInsertSchema(userCoupons).omit({ id: true, createdAt: true, usedAt: true });
export const insertGrowthRecordSchema = createInsertSchema(growthRecords).omit({ id: true, createdAt: true });

export const sleepChecklist = pgTable("sleep_checklist", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  date: date("date").notNull(),
  darkness: boolean("darkness").notNull().default(false),
  temperature: boolean("temperature").notNull().default(false),
  safety: boolean("safety").notNull().default(false),
  whiteNoise: boolean("white_noise").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sleepRoutines = pgTable("sleep_routines", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  title: text("title").notNull(),
  assignee: text("assignee").notNull().default("未定"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sleepRoutineLogs = pgTable("sleep_routine_logs", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  routineId: integer("routine_id").notNull(),
  date: date("date").notNull(),
  completedBy: text("completed_by").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const sleepSessions = pgTable("sleep_sessions", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  durationMin: integer("duration_min"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const skillCompletions = pgTable("skill_completions", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  userId: text("user_id").notNull(),
  skillId: text("skill_id").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  userId: text("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const weBoard = pgTable("we_board", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  userId: text("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWeBoardSchema = createInsertSchema(weBoard).omit({ id: true, createdAt: true });

export const insertSkillCompletionSchema = createInsertSchema(skillCompletions).omit({ id: true, completedAt: true });
export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({ id: true, createdAt: true });

export const insertSleepSessionSchema = createInsertSchema(sleepSessions).omit({ id: true, createdAt: true });

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertSleepChecklistSchema = createInsertSchema(sleepChecklist).omit({ id: true, createdAt: true });
export const insertSleepRoutineSchema = createInsertSchema(sleepRoutines).omit({ id: true, createdAt: true });
export const insertSleepRoutineLogSchema = createInsertSchema(sleepRoutineLogs).omit({ id: true, completedAt: true });

export type Child = typeof children.$inferSelect;
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type UserCoupon = typeof userCoupons.$inferSelect;
export type InsertUserCoupon = z.infer<typeof insertUserCouponSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type GrowthRecord = typeof growthRecords.$inferSelect;
export type InsertGrowthRecord = z.infer<typeof insertGrowthRecordSchema>;
export type SleepChecklist = typeof sleepChecklist.$inferSelect;
export type InsertSleepChecklist = z.infer<typeof insertSleepChecklistSchema>;
export type SleepRoutine = typeof sleepRoutines.$inferSelect;
export type InsertSleepRoutine = z.infer<typeof insertSleepRoutineSchema>;
export type SleepRoutineLog = typeof sleepRoutineLogs.$inferSelect;
export type InsertSleepRoutineLog = z.infer<typeof insertSleepRoutineLogSchema>;
export type SleepSession = typeof sleepSessions.$inferSelect;
export type InsertSleepSession = z.infer<typeof insertSleepSessionSchema>;
export type SkillCompletion = typeof skillCompletions.$inferSelect;
export type InsertSkillCompletion = z.infer<typeof insertSkillCompletionSchema>;
export type Feedback = typeof feedbacks.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type WeBoard = typeof weBoard.$inferSelect;
export type InsertWeBoard = z.infer<typeof insertWeBoardSchema>;

export const healthRecords = pgTable("health_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  detail: text("detail"),
  recordedAt: date("recorded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHealthRecordSchema = createInsertSchema(healthRecords).omit({ id: true, createdAt: true });
export type HealthRecord = typeof healthRecords.$inferSelect;
export type InsertHealthRecord = z.infer<typeof insertHealthRecordSchema>;

export const vaccinationRecords = pgTable("vaccination_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  vaccineId: text("vaccine_id").notNull(),
  administeredDate: date("administered_date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVaccinationRecordSchema = createInsertSchema(vaccinationRecords).omit({ id: true, createdAt: true });
export type VaccinationRecord = typeof vaccinationRecords.$inferSelect;
export type InsertVaccinationRecord = z.infer<typeof insertVaccinationRecordSchema>;

export const customVaccines = pgTable("custom_vaccines", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  childId: integer("child_id"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomVaccineSchema = createInsertSchema(customVaccines).omit({ id: true, createdAt: true });
export type CustomVaccine = typeof customVaccines.$inferSelect;
export type InsertCustomVaccine = z.infer<typeof insertCustomVaccineSchema>;

export const foodIngredients = pgTable("food_ingredients", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  childId: integer("child_id"),
  ingredientName: text("ingredient_name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("not_tried"),
  firstTriedDate: date("first_tried_date"),
  notes: text("notes"),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFoodIngredientSchema = createInsertSchema(foodIngredients).omit({ id: true, createdAt: true, updatedAt: true });
export type FoodIngredient = typeof foodIngredients.$inferSelect;
export type InsertFoodIngredient = z.infer<typeof insertFoodIngredientSchema>;

export const customChildcareItems = pgTable("custom_childcare_items", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  itemName: text("item_name").notNull(),
  icon: text("icon").notNull().default("Star"),
  createdBy: text("created_by"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomChildcareItemSchema = createInsertSchema(customChildcareItems).omit({ id: true, createdAt: true });
export type CustomChildcareItem = typeof customChildcareItems.$inferSelect;
export type InsertCustomChildcareItem = z.infer<typeof insertCustomChildcareItemSchema>;

export const customQuickActions = pgTable("custom_quick_actions", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  label: text("label").notNull(),
  iconName: text("icon_name").notNull().default("Star"),
  colorScheme: text("color_scheme").notNull().default("purple"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomQuickActionSchema = createInsertSchema(customQuickActions).omit({ id: true, createdAt: true });
export type CustomQuickAction = typeof customQuickActions.$inferSelect;
export type InsertCustomQuickAction = z.infer<typeof insertCustomQuickActionSchema>;

export const mamaHealthLogs = pgTable("mama_health_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  loggedAt: timestamp("logged_at").defaultNow().notNull(),
  bowel: boolean("bowel"),
  bowelNote: text("bowel_note"),
  lochia: text("lochia"),
  perinealPain: integer("perineal_pain"),
  mood: integer("mood"),
  sleepHours: real("sleep_hours"),
  nursingIssues: text("nursing_issues").array(),
  nursingNote: text("nursing_note"),
  weightKg: real("weight_kg"),
  swelling: boolean("swelling"),
});

export const insertMamaHealthLogSchema = createInsertSchema(mamaHealthLogs).omit({ id: true, loggedAt: true });
export type MamaHealthLog = typeof mamaHealthLogs.$inferSelect;
export type InsertMamaHealthLog = z.infer<typeof insertMamaHealthLogSchema>;

// ============================================================================
// Sponsors / Promotions / Sponsored Coupons
// ============================================================================

export const sponsors = pgTable("sponsors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSponsorSchema = createInsertSchema(sponsors).omit({ id: true, createdAt: true });
export type Sponsor = typeof sponsors.$inferSelect;
export type InsertSponsor = z.infer<typeof insertSponsorSchema>;

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  sponsorId: integer("sponsor_id"),
  triggerLogType: text("trigger_log_type").notNull(),
  triggerTimeStart: integer("trigger_time_start"),
  triggerTimeEnd: integer("trigger_time_end"),
  isActive: boolean("is_active").notNull().default(true),
  impressionCount: integer("impression_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  ctaUrl: text("cta_url"),
  ctaLabel: text("cta_label"),
  displayType: text("display_type").notNull().default("banner"),
  targetLogTypes: text("target_log_types"),
  weight: integer("weight").notNull().default(1),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true, impressionCount: true, clickCount: true });
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;

export const sponsoredCoupons = pgTable("sponsored_coupons", {
  id: serial("id").primaryKey(),
  sponsorId: integer("sponsor_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  pointsCost: integer("points_cost").notNull(),
  remainingStock: integer("remaining_stock"),
  quantity: integer("quantity"),
  discountValue: integer("discount_value"),
  discountType: text("discount_type"),
  exchangedAt: timestamp("exchanged_at"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSponsoredCouponSchema = createInsertSchema(sponsoredCoupons).omit({ id: true, createdAt: true });
export type SponsoredCoupon = typeof sponsoredCoupons.$inferSelect;
export type InsertSponsoredCoupon = z.infer<typeof insertSponsoredCouponSchema>;

export const promotionImpressions = pgTable("promotion_impressions", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id").notNull(),
  familyId: text("family_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPromotionImpressionSchema = createInsertSchema(promotionImpressions).omit({ id: true, createdAt: true });
export type PromotionImpression = typeof promotionImpressions.$inferSelect;
export type InsertPromotionImpression = z.infer<typeof insertPromotionImpressionSchema>;

// ============================================================================
// Community
// ============================================================================

export const communityProfiles = pgTable("community_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  nickname: text("nickname").notNull(),
  avatarIcon: text("avatar_icon").notNull().default("bear"),
  childAgeMonths: integer("child_age_months"),
  showChildAge: boolean("show_child_age").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCommunityProfileSchema = createInsertSchema(communityProfiles).omit({ id: true, createdAt: true });
export type CommunityProfile = typeof communityProfiles.$inferSelect;
export type InsertCommunityProfile = z.infer<typeof insertCommunityProfileSchema>;

export const communityRooms = pgTable("community_rooms", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  triggerLogTypes: text("trigger_log_types"),
  ageMonthsMin: integer("age_months_min"),
  ageMonthsMax: integer("age_months_max"),
  maxMembers: integer("max_members").notNull().default(100),
  currentMembers: integer("current_members").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCommunityRoomSchema = createInsertSchema(communityRooms).omit({ id: true, createdAt: true });
export type CommunityRoom = typeof communityRooms.$inferSelect;
export type InsertCommunityRoom = z.infer<typeof insertCommunityRoomSchema>;

export const communityMemberships = pgTable("community_memberships", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  profileId: integer("profile_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCommunityMembershipSchema = createInsertSchema(communityMemberships).omit({ id: true, createdAt: true });
export type CommunityMembership = typeof communityMemberships.$inferSelect;
export type InsertCommunityMembership = z.infer<typeof insertCommunityMembershipSchema>;

export const communityPosts = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  profileId: integer("profile_id").notNull(),
  body: text("body").notNull(),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCommunityPostSchema = createInsertSchema(communityPosts).omit({ id: true, createdAt: true });
export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;

export const communityReactions = pgTable("community_reactions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  profileId: integer("profile_id").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCommunityReactionSchema = createInsertSchema(communityReactions).omit({ id: true, createdAt: true });
export type CommunityReaction = typeof communityReactions.$inferSelect;
export type InsertCommunityReaction = z.infer<typeof insertCommunityReactionSchema>;

export const communityReports = pgTable("community_reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  reporterProfileId: integer("reporter_profile_id").notNull(),
  targetProfileId: integer("target_profile_id").notNull(),
  reason: text("reason").notNull().default("不適切な投稿"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCommunityReportSchema = createInsertSchema(communityReports).omit({ id: true, createdAt: true });
export type CommunityReport = typeof communityReports.$inferSelect;
export type InsertCommunityReport = z.infer<typeof insertCommunityReportSchema>;

export const communityBlocks = pgTable("community_blocks", {
  id: serial("id").primaryKey(),
  blockerProfileId: integer("blocker_profile_id").notNull(),
  blockedProfileId: integer("blocked_profile_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCommunityBlockSchema = createInsertSchema(communityBlocks).omit({ id: true, createdAt: true });
export type CommunityBlock = typeof communityBlocks.$inferSelect;
export type InsertCommunityBlock = z.infer<typeof insertCommunityBlockSchema>;

// ============================================================================
// Mama Health Records (family-scoped, date-bucketed — distinct from mamaHealthLogs)
// ============================================================================

export const mamaHealthRecords = pgTable("mama_health_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  userId: text("user_id").notNull(),
  recordedDate: date("recorded_date").notNull(),
  bowelMovement: boolean("bowel_movement"),
  bowelNote: text("bowel_note"),
  lochiaState: text("lochia_state"),
  perineumPain: integer("perineum_pain"),
  mood: integer("mood"),
  sleepHours: integer("sleep_hours"),
  sleepMinutes: integer("sleep_minutes"),
  breastfeedingTrouble: text("breastfeeding_trouble"),
  weightKg: text("weight_kg"),
  hasEdema: boolean("has_edema"),
  holdingTime: integer("holding_time"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMamaHealthRecordSchema = createInsertSchema(mamaHealthRecords).omit({ id: true, createdAt: true });
export type MamaHealthRecord = typeof mamaHealthRecords.$inferSelect;
export type InsertMamaHealthRecord = z.infer<typeof insertMamaHealthRecordSchema>;

export const mamaMedicineRecords = pgTable("mama_medicine_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  userId: text("user_id").notNull(),
  medicineName: text("medicine_name").notNull(),
  dosage: text("dosage"),
  memo: text("memo"),
  takenAt: timestamp("taken_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMamaMedicineRecordSchema = createInsertSchema(mamaMedicineRecords).omit({ id: true, createdAt: true });
export type MamaMedicineRecord = typeof mamaMedicineRecords.$inferSelect;
export type InsertMamaMedicineRecord = z.infer<typeof insertMamaMedicineRecordSchema>;
