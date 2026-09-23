import "./safety/require-managed.mjs";
import { getManagedTestContext } from "./safety/require-managed.mjs";
import { test, expect, Page, Route } from "@playwright/test";

// This suite exercises the real /supporter route. Every identity and record
// below is supplied only through Playwright's request interception; it does
// not add an application login or demo path.
const baseURL = getManagedTestContext().baseURL;
if (!baseURL) throw new Error("managed browser server is unavailable");
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/repl/tools/bin/chromium";

test.use({ launchOptions: { executablePath: chromiumPath } });

const activeNow = "2025-05-01T01:00:00.000Z";
const childA = { id: 101, name: "あおい", birthday: "2024-01-02", grants: [{ id: 701, startsAt: "2025-04-30T00:00:00.000Z", endsAt: "2025-05-03T00:00:00.000Z" }] };
const childB = { id: 102, name: "みどり", birthday: "2023-02-03", grants: [{ id: 702, startsAt: "2025-04-30T00:00:00.000Z", endsAt: "2025-05-03T00:00:00.000Z" }] };
const jstInput = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
type InvitationFixture = {
  id: number;
  childId: number;
  childName: string;
  recipientAddress: string;
  displayName: string;
  startsAt: string;
  endsAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

const recordFor = (child: typeof childA, message: string) => ({
  child: { id: child.id, name: child.name, birthday: child.birthday },
  records: [{ id: child.id * 10, type: "handoff_note", createdAt: activeNow, message, recorderDisplayName: "ぶどうの木", canEdit: true, fields: {} }],
  grants: child.grants,
  serverNow: activeNow,
});

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installPortalApi(page: Page, options: {
  children?: () => Array<typeof childA>;
  serverNow?: () => string;
  recordForA?: () => ReturnType<typeof recordFor>;
  onRecordPost?: (route: Route) => Promise<void>;
  onRecordPatch?: (route: Route) => Promise<void>;
  onRecordDelete?: (route: Route) => Promise<void>;
  onExport?: (route: Route) => Promise<void>;
  invitations?: () => InvitationFixture[];
  onInvitationAccept?: (route: Route) => Promise<void>;
} = {}) {
  await page.route("**/api/supporter/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/supporter/status") {
      return fulfillJson(route, { enabled: true, authenticated: true, canManage: false, isSupporter: true, displayName: "ぶどうの木" });
    }
    if (url.pathname === "/api/supporter/children" && request.method() === "GET") {
      return fulfillJson(route, { children: options.children?.() ?? [childA, childB], serverNow: options.serverNow?.() ?? activeNow });
    }
    if (url.pathname === "/api/supporter/invitations" && request.method() === "GET") return fulfillJson(route, { invitations: options.invitations?.() ?? [] });
    if (url.pathname.match(/^\/api\/supporter\/invitations\/\d+\/accept$/) && request.method() === "POST" && options.onInvitationAccept) return options.onInvitationAccept(route);
    if (url.pathname === `/api/supporter/children/${childA.id}/records` && request.method() === "GET") return fulfillJson(route, options.recordForA?.() ?? recordFor(childA, "Aだけの申し送り"));
    if (url.pathname === `/api/supporter/children/${childB.id}/records` && request.method() === "GET") return fulfillJson(route, recordFor(childB, "Bだけの申し送り"));
    if (url.pathname === `/api/supporter/children/${childA.id}/records` && request.method() === "POST" && options.onRecordPost) return options.onRecordPost(route);
    if (url.pathname.match(new RegExp(`/api/supporter/children/${childA.id}/records/\\d+$`)) && request.method() === "PATCH" && options.onRecordPatch) return options.onRecordPatch(route);
    if (url.pathname.match(new RegExp(`/api/supporter/children/${childA.id}/records/\\d+$`)) && request.method() === "DELETE" && options.onRecordDelete) return options.onRecordDelete(route);
    if (url.pathname === `/api/supporter/children/${childA.id}/export` && request.method() === "POST" && options.onExport) return options.onExport(route);
    return fulfillJson(route, { message: "unexpected supporter fixture request" }, 404);
  });
}

async function openPortal(page: Page, firstRecord: string | false = "Aだけの申し送り") {
  await page.goto(`${baseURL}/supporter`);
  await expect(page.getByRole("heading", { name: "サポーターポータル" })).toBeVisible();
  if (firstRecord) await expect(page.getByText(firstRecord)).toBeVisible();
}

async function installManageApi(page: Page, options: {
  invitations?: () => InvitationFixture[];
  onCreate?: (route: Route) => Promise<void>;
  onExtend?: (route: Route) => Promise<void>;
  onRevoke?: (route: Route) => Promise<void>;
} = {}) {
  await page.route("**/api/supporter/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/supporter/status") {
      return fulfillJson(route, { enabled: true, authenticated: true, canManage: true, isSupporter: false, displayName: "パパ" });
    }
    if (url.pathname === "/api/supporter/manage" && request.method() === "GET") {
      return fulfillJson(route, {
        children: [{ id: childA.id, name: childA.name, birthday: childA.birthday }],
        invitations: options.invitations?.() ?? [],
      });
    }
    if (url.pathname === "/api/supporter/invitations" && request.method() === "POST" && options.onCreate) return options.onCreate(route);
    if (url.pathname.match(/^\/api\/supporter\/invitations\/\d+$/) && request.method() === "PATCH" && options.onExtend) return options.onExtend(route);
    if (url.pathname.match(/^\/api\/supporter\/invitations\/\d+\/revoke$/) && request.method() === "POST" && options.onRevoke) return options.onRevoke(route);
    return fulfillJson(route, { message: "unexpected supporter manage fixture request" }, 404);
  });
}

test("two children keep a dirty draft until the user explicitly discards it", async ({ page }) => {
  await installPortalApi(page);
  await openPortal(page);

  await page.getByRole("button", { name: "記録を追加" }).click();
  await page.locator("textarea").fill("Aの未保存メモ");
  await page.getByRole("button", { name: /みどり/ }).click();
  await expect(page.getByText("入力中の内容があります")).toBeVisible();

  await page.getByRole("button", { name: "入力を続ける" }).click();
  await expect(page.locator("textarea")).toHaveValue("Aの未保存メモ");
  await expect(page.getByText("Aだけの申し送り")).toBeVisible();

  await page.getByRole("button", { name: /みどり/ }).click();
  await page.getByRole("button", { name: "破棄して切り替える" }).click();
  await expect(page.getByText("Bだけの申し送り")).toBeVisible();
  await expect(page.getByText("Aだけの申し送り")).toHaveCount(0, { timeout: 35_000 });
  await expect(page.getByRole("button", { name: "記録を追加" })).toBeVisible();
});

test("a delayed A save cannot mix into B after switching", async ({ page }) => {
  let releaseSave!: () => void;
  const delayedSave = new Promise<void>((resolve) => { releaseSave = resolve; });
  await installPortalApi(page, {
    onRecordPost: async (route) => {
      await delayedSave;
      await fulfillJson(route, { id: 999, type: "handoff_note", createdAt: activeNow, message: "A保存済み", recorderDisplayName: "ぶどうの木", canEdit: true, fields: {} }, 201);
    },
  });
  await openPortal(page);
  await page.getByRole("button", { name: "記録を追加" }).click();
  await page.locator("form textarea").fill("A保存リクエスト");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("button", { name: "保存中…" })).toBeVisible();

  await page.getByRole("button", { name: /みどり/ }).click();
  await page.getByRole("button", { name: "破棄して切り替える" }).click();
  await expect(page.getByText("Bだけの申し送り")).toBeVisible();
  releaseSave();
  await page.waitForTimeout(150);
  await expect(page.getByText("Bだけの申し送り")).toBeVisible();
  await expect(page.getByText("A保存済み")).toHaveCount(0);
});

test("offline saving has the exact Japanese error and remains unsaved", async ({ page, context }) => {
  await installPortalApi(page);
  await openPortal(page);
  await page.getByRole("button", { name: "記録を追加" }).click();
  await page.locator("form textarea").fill("通信断メモ");
  await context.setOffline(true);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("通信が切れています。保存できません。未保存です。")).toBeVisible();
  await expect(page.locator("form textarea")).toHaveValue("通信断メモ");
  await context.setOffline(false);
});

test("polling expiry/revocation clears only expired child data", async ({ page }) => {
  test.setTimeout(50_000);
  let calls = 0;
  await installPortalApi(page, {
    children: () => {
      calls += 1;
      // Initial active list; the next poll represents a server-confirmed revoke.
      return calls === 1 ? [childA, childB] : [childB];
    },
  });
  await openPortal(page);
  await expect(page.getByText("Aだけの申し送り")).toBeVisible();
  // The product poll is intentionally 30 seconds so an open shared terminal
  // learns about a revocation without adding an idle lock.
  await expect(page.getByText("Aだけの申し送り")).toHaveCount(0, { timeout: 42_000 });
  await expect(page.getByText("Bだけの申し送り")).toBeVisible();
});

test("a clock-only poll preserves the keyed unsaved draft", async ({ page }) => {
  test.setTimeout(45_000);
  let calls = 0;
  await installPortalApi(page, {
    serverNow: () => {
      calls += 1;
      return calls === 1 ? activeNow : "2025-05-01T01:00:30.000Z";
    },
  });
  await openPortal(page);
  await page.getByRole("button", { name: "記録を追加" }).click();
  await page.locator("form textarea").fill("時計更新後も残す下書き");
  // A real poll returns a newer server clock but unchanged active grants.
  await page.waitForTimeout(31_000);
  await expect(page.locator("form textarea")).toHaveValue("時計更新後も残す下書き");
});

test("export is fetched fresh and print HTML escapes untrusted record text", async ({ page }) => {
  let exportCalls = 0;
  await installPortalApi(page, {
    onExport: async (route) => {
      exportCalls += 1;
      expect(JSON.parse(route.request().postData() || "{}")).toEqual({ grantIds: [701] });
      await fulfillJson(route, {
        child: { id: childA.id, name: childA.name, birthday: childA.birthday },
        records: [{ id: 50, type: "handoff_note", createdAt: activeNow, message: "<img src=x onerror=alert(1)>", recorderDisplayName: "ぶどうの木", canEdit: false, fields: {} }],
        facilityName: "ぶどうの木",
        exportedAt: activeNow,
        periods: childA.grants.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
      });
    },
  });
  await openPortal(page);
  await page.context().addInitScript(() => {
    try {
      Object.defineProperty(window, "print", {
        configurable: true,
        writable: true,
        value: () => undefined,
      });
    } catch {
      window.print = () => undefined;
    }
  });
  await page.evaluate(() => {
    const originalOpen = window.open.bind(window);
    window.open = ((url?: string, target?: string, features?: string) => {
      const child = originalOpen(url, target, features);
      if (child) child.print = () => undefined;
      return child;
    }) as typeof window.open;
  });
  const [printPage] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "最新の記録を印刷 / PDF保存" }).click(),
  ]);
  await printPage.evaluate(() => {
    window.print = () => undefined;
  });
  await expect.poll(() => exportCalls).toBe(1);
  await expect(printPage.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
  await expect(printPage.locator("img")).toHaveCount(0);
  const styles = await printPage.locator("style").allTextContents();
  expect(styles.some((style) => style.includes("page-break-inside:avoid"))).toBe(true);
  await expect(printPage.getByRole("heading", { name: "アレルギーに関する観察", exact: true })).toBeVisible();
  const pdf = await printPage.pdf({ format: "A4", printBackground: true });
  expect(pdf.byteLength).toBeGreaterThan(1_000);
  expect(pdf.toString("latin1")).toContain("/Type /Page");
});

test("a delayed export is discarded when the selected child changes", async ({ page }) => {
  let releaseExport!: () => void;
  const delayedExport = new Promise<void>((resolve) => { releaseExport = resolve; });
  await installPortalApi(page, {
    onExport: async (route) => {
      await delayedExport;
      await fulfillJson(route, {
        child: { id: childA.id, name: childA.name, birthday: childA.birthday }, records: [],
        facilityName: "ぶどうの木", exportedAt: activeNow,
        periods: childA.grants.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
      });
    },
  });
  await openPortal(page);
  let popupOpened = false;
  page.on("popup", () => { popupOpened = true; });
  await page.getByRole("button", { name: "最新の記録を印刷 / PDF保存" }).click();
  await page.getByRole("button", { name: /みどり/ }).click();
  await expect(page.getByText("Bだけの申し送り")).toBeVisible();
  releaseExport();
  await page.waitForTimeout(200);
  expect(popupOpened).toBe(false);
});

test("an expiry timer aborts a pending export before opening a print page", async ({ page }) => {
  const expiringA = {
    ...childA,
    grants: [{ ...childA.grants[0], endsAt: "2025-05-01T01:00:00.400Z" }],
  };
  let childCalls = 0;
  let releaseExport!: () => void;
  const delayedExport = new Promise<void>((resolve) => { releaseExport = resolve; });
  await installPortalApi(page, {
    children: () => {
      childCalls += 1;
      return childCalls === 1 ? [expiringA, childB] : [childB];
    },
    onExport: async (route) => {
      await delayedExport;
      await fulfillJson(route, {
        child: { id: childA.id, name: childA.name, birthday: childA.birthday }, records: [],
        facilityName: "ぶどうの木", exportedAt: activeNow,
        periods: expiringA.grants.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
      });
    },
  });
  await openPortal(page);
  let popupOpened = false;
  page.on("popup", () => { popupOpened = true; });
  await page.getByRole("button", { name: "最新の記録を印刷 / PDF保存" }).click();
  await expect(page.getByText("Bだけの申し送り")).toBeVisible({ timeout: 2_000 });
  releaseExport();
  await page.waitForTimeout(200);
  expect(popupOpened).toBe(false);
});

test("staggered overlapping grants purge old-only records at the first boundary", async ({ page }) => {
  test.setTimeout(12_000);
  const overlapA = {
    ...childA,
    grants: [
      { ...childA.grants[0], endsAt: "2025-05-01T01:00:01.000Z" },
      { id: 703, startsAt: "2025-05-01T00:30:00.000Z", endsAt: "2025-05-01T01:10:00.000Z" },
    ],
  };
  let childCalls = 0;
  let recordCalls = 0;
  await installPortalApi(page, {
    children: () => {
      childCalls += 1;
      return [overlapA, childB];
    },
    serverNow: () => childCalls <= 1 ? activeNow : "2025-05-01T01:00:02.000Z",
    recordForA: () => {
      recordCalls += 1;
      const visibleUnderBoth = recordFor(overlapA, "最初の権限だけで見えた記録");
      if (recordCalls === 1) return visibleUnderBoth;
      return {
        ...visibleUnderBoth,
        records: [{ id: 7030, type: "handoff_note", createdAt: activeNow, message: "継続中の権限で見える記録", recorderDisplayName: "ぶどうの木", canEdit: true, fields: {} }],
        grants: [overlapA.grants[1]],
        serverNow: "2025-05-01T01:00:02.000Z",
      };
    },
  });
  await openPortal(page, false);
  await expect(page.getByText("最初の権限だけで見えた記録")).toBeVisible();
  await expect(page.getByText("継続中の権限で見える記録")).toBeVisible({ timeout: 3_500 });
  await expect(page.getByText("最初の権限だけで見えた記録")).toHaveCount(0);
  await expect(page.getByText("あおい（2024-01-02）")).toBeVisible();
  await expect(page.getByRole("button", { name: "記録を追加" })).toBeVisible();
});

test("the portal shows every own invitation period and accepts only pending periods", async ({ page }) => {
  const start = new Date(Date.now() - 60_000).toISOString();
  const end = new Date(Date.now() + 60 * 60_000).toISOString();
  const invitations: InvitationFixture[] = [
    { id: 801, childId: childA.id, childName: childA.name, recipientAddress: "FACILITY-PUBLIC-001", displayName: "ぶどうの木", startsAt: start, endsAt: end, acceptedAt: null, revokedAt: null },
    { id: 802, childId: childA.id, childName: childA.name, recipientAddress: "FACILITY-PUBLIC-001", displayName: "ぶどうの木", startsAt: start, endsAt: end, acceptedAt: start, revokedAt: null },
    { id: 803, childId: childA.id, childName: childA.name, recipientAddress: "FACILITY-PUBLIC-001", displayName: "ぶどうの木", startsAt: start, endsAt: end, acceptedAt: start, revokedAt: end },
  ];
  let accepted = false;
  await installPortalApi(page, {
    invitations: () => invitations.map((invite) => accepted && invite.id === 801 ? { ...invite, acceptedAt: start } : invite),
    onInvitationAccept: async (route) => {
      expect(route.request().url()).toContain("/api/supporter/invitations/801/accept");
      accepted = true;
      await fulfillJson(route, { id: 801, acceptedAt: start });
    },
  });
  await openPortal(page);
  await expect(page.getByText("受け入れ待ち")).toBeVisible();
  await expect(page.getByText("状態: 受け入れ済み", { exact: true })).toBeVisible();
  await expect(page.getByText("状態: 取り消し済み", { exact: true })).toBeVisible();
  await expect(page.getByText(/利用期間（JST）:/)).toHaveCount(3);
  await page.getByRole("button", { name: "受け入れる" }).click();
  await expect.poll(() => accepted).toBe(true);
  await expect(page.getByRole("button", { name: "受け入れる" })).toHaveCount(0);
});

test("parent management uses a facility PUBLIC CODE and retains accepted and revoked JST periods", async ({ page }) => {
  const start = new Date(Date.now() - 60_000).toISOString();
  const end = new Date(Date.now() + 60 * 60_000).toISOString();
  const extendedEnd = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
  const invitations: InvitationFixture[] = [
    { id: 901, childId: childA.id, childName: childA.name, recipientAddress: "FACILITY-PUBLIC-001", displayName: "ぶどうの木", startsAt: start, endsAt: end, acceptedAt: start, revokedAt: null },
    { id: 902, childId: childA.id, childName: childA.name, recipientAddress: "FACILITY-PUBLIC-001", displayName: "ぶどうの木", startsAt: start, endsAt: end, acceptedAt: start, revokedAt: end },
  ];
  let createdBody: any;
  let extendedBody: any;
  let revoked = false;
  await installManageApi(page, {
    invitations: () => invitations,
    onCreate: async (route) => {
      createdBody = JSON.parse(route.request().postData() || "{}");
      await fulfillJson(route, { id: 903, childId: childA.id, recipientAddress: createdBody.recipientAddress, displayName: "ぶどうの木", startsAt: createdBody.startsAt, endsAt: createdBody.endsAt, acceptedAt: null, revokedAt: null }, 201);
    },
    onExtend: async (route) => {
      extendedBody = JSON.parse(route.request().postData() || "{}");
      await fulfillJson(route, { id: 901, startsAt: start, endsAt: extendedEnd });
    },
    onRevoke: async (route) => {
      revoked = true;
      await fulfillJson(route, { id: 901, revokedAt: new Date().toISOString() });
    },
  });
  await page.goto(`${baseURL}/supporter/manage`);
  await expect(page.getByRole("heading", { name: "サポーター管理" })).toBeVisible();
  await expect(page.getByText("施設アカウントの公開コード（PUBLIC CODE）")).toBeVisible();
  await expect(page.getByText("PUBLIC CODE: FACILITY-PUBLIC-001")).toHaveCount(2);
  await expect(page.getByText(/受け入れ済み: /)).toHaveCount(2);
  await expect(page.getByText(/取り消し済み: /)).toBeVisible();
  await expect(page.getByText(/利用期間（JST）:/)).toHaveCount(2);

  await page.locator("#supporter-child").selectOption(String(childA.id));
  await page.locator("#supporter-recipient-code").fill("FACILITY-PUBLIC-NEW");
  await page.locator("#supporter-ends-at").fill(jstInput(new Date(Date.now() + 3 * 60 * 60_000)));
  await page.getByRole("button", { name: "招待を作成" }).click();
  await expect.poll(() => createdBody).toMatchObject({ childId: childA.id, recipientAddress: "FACILITY-PUBLIC-NEW" });
  expect(createdBody.displayName).toBeUndefined();

  await page.getByRole("button", { name: "期限を変更" }).first().click();
  await page.locator("#supporter-extend-end").fill(jstInput(new Date(Date.now() + 2 * 60 * 60_000)));
  await page.getByRole("button", { name: "更新する" }).click();
  await expect.poll(() => extendedBody).toEqual({ endsAt: expect.any(String) });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "取り消す" }).first().click();
  await expect.poll(() => revoked).toBe(true);
});

test("supporter records require reasons for edit and delete and refresh after each change", async ({ page }) => {
  let message = "Aだけの申し送り";
  let patchBody: any;
  let deleteBody: any;
  let deleteUrl = "";
  await installPortalApi(page, {
    recordForA: () => ({ ...recordFor(childA, message), records: message ? [{ id: 1010, type: "handoff_note", createdAt: activeNow, message, recorderDisplayName: "ぶどうの木", canEdit: true, fields: {} }] : [] }),
    onRecordPatch: async (route) => {
      patchBody = JSON.parse(route.request().postData() || "{}");
      message = patchBody.fields.message;
      await fulfillJson(route, { id: 1010, type: "handoff_note", createdAt: activeNow, message, recorderDisplayName: "ぶどうの木", canEdit: true, fields: {} });
    },
    onRecordDelete: async (route) => {
      deleteBody = JSON.parse(route.request().postData() || "{}");
      deleteUrl = route.request().url();
      message = "";
      await fulfillJson(route, { id: 1010, deletedAt: activeNow });
    },
  });
  await openPortal(page);
  await page.getByRole("button", { name: "修正" }).click();
  await page.locator("form textarea").fill("訂正済み申し送り");
  await page.locator("form input[required]").last().fill("記載ミスを訂正");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect.poll(() => patchBody).toMatchObject({ grantId: 701, fields: { message: "訂正済み申し送り" }, reason: "記載ミスを訂正" });
  await expect(page.getByText("訂正済み申し送り")).toBeVisible();

  await page.getByRole("button", { name: "削除" }).click();
  await page.getByPlaceholder("削除理由（必須）").fill("重複記録を削除");
  await page.getByRole("button", { name: "理由を付けて削除" }).click();
  await expect.poll(() => deleteBody).toMatchObject({ grantId: 701, reason: "重複記録を削除" });
  await expect.poll(() => deleteUrl).toMatch(/\/api\/supporter\/children\/101\/records\/1010$/);
  await expect(page.getByText("訂正済み申し送り")).toHaveCount(0);
});