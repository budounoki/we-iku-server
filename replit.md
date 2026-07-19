# replit.md

## Overview

"We育" (We-iku) is a Japanese co-parenting web application designed for parents of children aged 0-6, developed by "Budou no Ki" (prenatal/postnatal care hotel). Its core purpose is to facilitate collaborative logging of baby care activities such as feeding, diaper changes, sleep, and emergency calls. The app incorporates an age-based phase system that automatically adjusts quick log buttons and UI elements, along with a gamification system where caregivers earn points for logging activities, including bonuses for late-night entries. Families share a unique ID for seamless data synchronization between parents. The project aims to provide comprehensive support for co-parenting, from daily logs to developmental tracking, within a brand-consistent and user-friendly interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Vite for bundling.
- **Routing**: Wouter for client-side navigation.
- **State Management**: TanStack React Query for server state, featuring polling for real-time updates.
- **Styling**: Tailwind CSS with shadcn/ui (new-york style), custom color theme (Grape Purple #805AAA, natural green accents), 24px+ rounded corners, Lucide React icons exclusively.
- **Fonts**: M PLUS Rounded 1c (Japanese) and Nunito (body).
- **Animations**: Framer Motion for UI interactions.
- **Path Aliases**: `@/` for `client/src/`, `@shared/` for `shared/`.
- **UI/UX Decisions**: Elegant grape purple and natural green color scheme, soft rounded corners, no emojis in UI (except specific action dialogs), neutral system messages for advice (no character personas).
- **Feature Specifications**:
    - **Age-based Phase System**: Automatically switches quick log buttons and UI elements (e.g., Home page summary, SOS button visibility, Growth card) based on the child's age (0-6 years). Manual button customization per child is supported.
    - **Multi-child Support**: Enables management of multiple children with a child switcher.
    - **Sleep Training**: Includes an environment checklist, customizable routine steps, co-op tracking, a night cry coaching timer with a dark UI, and detailed sleep recording options (manual, past, active session management). **"寝た" new flow**: tapping "寝た" shows 2 buttons (今すぐ記録する / 時刻を指定して記録); recording transitions directly to the "NOW SLEEPING" active dialog. "過去のねんねを手入力" moved to Timeline header "手入力" button. API: `PATCH /api/logs/:logId/sleep-detail` to update settlingMethod/sleepLocation. **settlingMethod/sleepLocation** are edited via the Timeline sleep log edit dialog (chip selectors for method and location; pre-populated from existing data on open).
    - **Points System**: Awards points for logs (10-30 points, with bonuses for late-night logs and routine completion).
    - **Team Parenting Skills**: Age-based skill tree system with partner approval and badges.
    - **Vaccination Tracking**: Comprehensive schedule management with date recording, next dose recommendations, and support for Rotavirus vaccine type selection.
    - **Timeline**: Displays a 7-day timeline with log editing (time, deletion) and PDF export functionality.
    - **WeBoard**: Partner bulletin board for status messages.
    - **Onboarding & Pairing**: Initial setup flow for new users, including family ID sharing for partner synchronization, role selection, and an introductory tutorial.
    - **Food Ingredient Tracker**: Category-based checklist for tracking baby's first foods during weaning (離乳食). Supports 3 status states (not tried / ok / caution with allergy notes), custom food additions, progress bar, and search/filter by category. Accessible from the food log dialog via "食材チェックリスト" link. Page: `/food-tracker`.
    - **Log Review Page**: Month-based review page for food logs (離乳食/ごはん/おやつ) and milestone logs (はじめて/できた/ことば etc.). Filterable by tab (全部/食事/マイルストーン), grouped by date, shows foodItems+foodAmount for food logs and message content for milestones. Accessible via "振り返り" button in Timeline header. Page: `/log-review`.
    - **Proxy/Partner Logging**: "だれがやった？" performer selector in all log dialogs. Allows recording logs on behalf of partner. Points are attributed to the actual performer via the `performedBy` field. Dashboard contribution charts use `performedBy || userId` for attribution.
    - **Custom Childcare Items (名もなき育児)**: Family-shared custom chore items (max 10) with preset Lucide icon selection. Added via Dashboard chore dialog, managed in Settings. Stored in `custom_childcare_items` table.
    - **抱っこ記録**: 全フェーズで利用可能な「抱っこ」ログ（type="hold"）。開始時刻（createdAt）・終了時刻（holdEndAt）・担当者・メモを記録。時間差から自動的に分数を算出してメッセージに含める。DBカラム: `hold_end_at`。
    - **搾乳の手入力**: 搾乳ダイアログ（type="milk", subType="express"）のタイマーステップに「タイマー / 手入力」モード切替を追加。手入力モードでは左/右の分数を直接入力（0-120分）。タイマー稼働中に手入力に切り替えると、現在のタイマー値が初期値として転記される。「搾乳完了・量を記録する」ボタンで手入力値を expressLeftSec/expressRightSec に反映してから量入力ステップに遷移。手入力モードではアラーム設定UIは非表示。
    - **Custom Quick Log Buttons**: Family-shared custom quick log buttons (max 10) that appear in the home screen action button area under a "カスタム" section. Created/deleted via arrange mode (並び替え) "+" button. Each button has a label (max 12 chars), icon (22 Lucide options), and color scheme (8 options). Tapping records a log with type="custom", subType=label, and an optional memo. Stored in `custom_quick_actions` table. API: GET/POST/DELETE `/api/families/:familyId/custom-quick-actions`.
    - **Legal Pages**: Privacy Policy and Terms of Service.
    - **Next Feeding Prediction**: In infant phase, Home page shows a "Next Feeding" card predicting next feeding time based on average interval of last 8 feedings. Color-coded (pink/amber/rose) by urgency. Hook: `client/src/hooks/use-feeding-notification.ts`.
    - **Feeding Notification Alarm**: Settings page has a "授乳アラーム" section allowing users to enable browser notifications (Web Notification API) at 5/10/15/20/30 minutes before predicted next feeding. Permission requested on first enable. Stored in localStorage (`feedingNotifyEnabled`, `feedingNotifyMinutes`).
    - **Dark Mode / Theme**: Three-mode theme system: light / dark / auto (auto = dark from 18:00 to 6:00). Hook: `client/src/hooks/use-theme.ts`. Mode stored in localStorage (`we_iku_theme_mode`). Applied via `dark` class on `<html>`. Initialized via inline script in `client/index.html` (prevents flash). Settings UI: 設定 → 画面の明るさ. CSS variables defined in `:root` (light) and `.dark` (dark) in `index.css`, plus global overrides for hardcoded Tailwind color classes.

### Backend
- **Framework**: Express 5 on Node.js with TypeScript.
- **API Design**: REST API with centralized route definitions and Zod schemas for validation.
- **Development**: Vite dev server integrated as middleware with HMR.
- **Production**: Client built to `dist/public`, server bundled with esbuild.

### Data Storage
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Schema**: Comprehensive schema for `logs` (includes `stool_type`, `stool_amount`, `stool_color`, `medicine_name`, `medicine_dose`, `performed_by` columns), `settings`, `events`, `coupons`, `user_coupons`, `notifications`, `sleep_checklist`, `sleep_routines`, `sleep_routine_logs`, `skill_completions`, `feedbacks`, `vaccination_records`, `custom_vaccines`, `we_board`, `food_ingredients`, `custom_childcare_items`, and `custom_quick_actions` tables.
- **Migrations**: Drizzle Kit for schema synchronization.

### Shared Code
- `shared/schema.ts`: Database schema, Zod validation, and TypeScript types.
- `shared/routes.ts`: API route definitions and URL helpers.

### Authentication
- **Method**: LIFF (LINE Front-end Framework) primary, LINE OAuth 2.0 fallback. LIFF keeps authentication entirely within the current browser context (Safari or LINE in-app browser) using the LINE SDK and localStorage-backed tokens. iOS PWA standalone mode escapes to Safari during LINE auth redirect; users complete auth in Safari and use the app from Safari thereafter (Safari maintains 30-day session persistence).
- **LIFF Setup**: LIFF ID stored in `VITE_LIFF_ID` env var. Endpoint URL must match production URL (we-iku.com). Scopes: `profile` and `openid`.
- **LIFF Endpoint**: `POST /api/auth/line-liff` accepts `{ accessToken }`, verifies via LINE API (`/oauth2/v2.1/verify` for client_id check, `/v2/profile` for user info), creates/updates user, and sets the session cookie in the same browser context.
- **Auto-login**: `App.tsx` `useLineLoginCallback` hook calls `tryLiffAutoLogin()` on every visit when no local session — uses LIFF SDK's persistent token to silently re-authenticate without user interaction. `Onboarding.tsx` does the same on mount before showing the login button.
- **Login Button**: `handleLineLogin` in Onboarding calls `liff.login()` (full-page redirect within current browser context); falls back to `/api/auth/line` OAuth flow if LIFF init fails.
- **Session Management**: `express-session` with `connect-pg-simple` (PostgreSQL-backed sessions). Cookie config: `secure: process.env.NODE_ENV === "production"` (must be `true` in prod for proper HTTPS Cookie persistence — `"auto"` causes mis-detection on Replit reverse proxy and breaks 30-day persistence), `httpOnly: true`, `maxAge: 30 days`, `sameSite: "lax"`.
- **OAuth Fallback**: Original `/api/auth/line` and `/api/auth/line/callback` endpoints remain intact for non-PWA browsers and as fallback when LIFF fails.

## External Dependencies

- **PostgreSQL**: Primary database.
- **Google Fonts**: For M PLUS Rounded 1c and Nunito.
- **LINE Login API**: For OAuth 2.0 authentication.
- **express-session + connect-pg-simple**: For server-side session management using a PostgreSQL store.