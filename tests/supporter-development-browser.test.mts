/**
 * Manual, real-DB browser flow for the development-only supporter workbench.
 *
 * This suite intentionally has no route interception or identity mock. Run it
 * only after the development app is running with the documented flags and the
 * isolated heliumdb database:
 *
 *   node tests/run-managed-tests.mjs browser
 *
 * It uses two browser contexts because one browser's cookie is one session:
 * parent and facility cannot be active simultaneously in the same context.
 * Cleanup removes only this test's grant, audit/idempotency rows, and record;
 * fixed development users, children, account, and example records remain.
 */
import "./safety/require-managed.mjs";
import { getManagedTestContext } from "./safety/require-managed.mjs";
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { pool } from "../server/db.ts";

const baseURL = getManagedTestContext().baseURL;
if (!baseURL) throw new Error("managed browser server is unavailable");
const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/repl/tools/bin/chromium";
const familyId = "supporter-dev-family-budounoki";
const publicCode = "BUDOUNOKI-DEV";

test.use({ launchOptions: { executablePath: chromiumPath } });
test.setTimeout(120_000);

function localDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return [
    parts.year,
    parts.month,
    parts.day,
  ].join("-") + `T${pad(Number(parts.hour))}:${pad(Number(parts.minute))}`;
}

async function enterPersona(page: Page, persona: "parent" | "facility") {
  await page.goto(`${baseURL}/supporter/development`);
  await expect(page.getByText("サポーター手動検証")).toBeVisible();
  await expect(page.getByRole("button", {
    name: persona === "parent" ? "保護者として入る" : "施設として入る",
  })).toBeEnabled();
  await page.getByRole("button", {
    name: persona === "parent" ? "保護者として入る" : "施設として入る",
  }).click();
  await page.waitForURL(
    persona === "parent" ? /\/supporter\/manage\/?$/ : /\/supporter\/?$/,
  );
}

test("real parent invite -> facility accept/record/edit/delete/PDF -> parent revoke", async ({
  browser,
}) => {
  const parentContext = await browser.newContext();
  const facilityContext = await browser.newContext();
  const parent = await parentContext.newPage();
  const facility = await facilityContext.newPage();
  const requestIds: string[] = [];
  let grantId: number | undefined;
  let createdRecordId: number | undefined;
  const runStartedAt = new Date();
  const inviteStart = new Date();
  inviteStart.setSeconds(0, 0);
  inviteStart.setTime(inviteStart.getTime() - 60_000);
  const inviteEnd = new Date(inviteStart.getTime() + 2 * 60 * 60_000);

  const collectRequestId = (page: Page) => {
    page.on("request", (request) => {
      if (
        request.method() !== "POST" &&
        request.method() !== "PATCH" &&
        request.method() !== "DELETE"
      ) return;
      if (!request.url().includes("/api/supporter/children/")) return;
      try {
        const body = JSON.parse(request.postData() || "{}");
        if (typeof body.requestId === "string") requestIds.push(body.requestId);
      } catch {
        // Non-JSON browser requests are not record mutations.
      }
    });
  };
  collectRequestId(facility);

  try {
    await enterPersona(parent, "parent");
    await expect(parent.getByRole("heading", { name: "サポーター管理" })).toBeVisible();
    const childOptions = parent.locator("#supporter-child option");
    await expect(childOptions).toHaveCount(3);
    await expect(childOptions.nth(1)).toHaveText("ひなた（開発用）（2024-05-15）");
    await expect(childOptions.nth(2)).toHaveText("そら（開発用）（2024-11-02）");
    const invitedChildId = await childOptions.nth(1).getAttribute("value");
    expect(invitedChildId).toBeTruthy();
    await parent.locator("#supporter-child").selectOption(invitedChildId!);
    await expect(parent.locator("#supporter-child")).toHaveValue(invitedChildId!);
    await parent.locator("#supporter-recipient-code").fill(publicCode);
    await parent.locator("#supporter-starts-at").fill(localDateTime(inviteStart));
    await parent.locator("#supporter-ends-at").fill(localDateTime(inviteEnd));
    const invitationResponse = parent.waitForResponse((response) =>
      response.url().includes("/api/supporter/invitations")
      && response.request().method() === "POST",
    );
    await parent.getByRole("button", { name: "招待を作成" }).click();
    const invitation = await (await invitationResponse).json();
    grantId = invitation.id;
    expect(invitation.recipientAddress).toBe(publicCode);
    expect(invitation.acceptedAt).toBeNull();
    const parentInvitation = parent.locator("section").filter({ hasText: "ひなた（開発用）" });
    await expect(parentInvitation.getByText("状態: 受け入れ待ち", { exact: true })).toBeVisible();

    await enterPersona(facility, "facility");
    await expect(facility.getByRole("heading", { name: "サポーターポータル" })).toBeVisible();
    await expect(facility.getByText("ひなた（開発用） さんへの招待", { exact: true })).toBeVisible();
    await expect(facility.getByText("そら（開発用） さんへの招待", { exact: true })).toHaveCount(0);
    await facility.getByRole("button", { name: "受け入れる" }).click();
    await expect(facility.getByRole("button", { name: /ひなた（開発用）/ })).toBeVisible();
    await expect(facility.getByRole("button", { name: /そら（開発用）/ })).toHaveCount(0);

    await facility.getByRole("button", { name: "記録を追加" }).click();
    const message = `ブラウザ検証の申し送り（${runStartedAt.getTime()}）`;
    const recordForm = facility.locator("form").filter({ hasText: "記録を追加" });
    await recordForm.locator("textarea").fill(message);
    const createResponse = facility.waitForResponse((response) =>
      response.url().match(/\/api\/supporter\/children\/\d+\/records$/) !== null
      && response.request().method() === "POST",
    );
    await recordForm.getByRole("button", { name: "保存する" }).click();
    const created = await (await createResponse).json();
    createdRecordId = created.id;
    await expect(facility.getByText(message)).toBeVisible();

    const recordRow = facility.locator("div.border-b").filter({ hasText: message });
    await recordRow.getByRole("button", { name: "修正" }).click();
    const corrected = `${message}・編集済み`;
    const editForm = facility.locator("form").filter({ hasText: "記録を修正" });
    await editForm.locator("textarea").fill(corrected);
    await editForm.locator("input[required]").last().fill("browser flow correction");
    await editForm.getByRole("button", { name: "保存する" }).click();
    await expect(facility.getByText(corrected)).toBeVisible();

    await facilityContext.addInitScript(() => {
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
    await facility.evaluate(() => {
      const originalOpen = window.open.bind(window);
      window.open = ((url?: string, target?: string, features?: string) => {
        const child = originalOpen(url, target, features);
        if (child) child.print = () => undefined;
        return child;
      }) as typeof window.open;
    });
    const [printPage] = await Promise.all([
      facility.waitForEvent("popup"),
      facility.getByRole("button", { name: "最新の記録を印刷 / PDF保存" }).click(),
    ]);
    // The real browser flow captures the rendered print document rather than
    // handing it to a system printer. Install this before the async font
    // load completes so headless Chromium cannot close the popup on print().
    await printPage.evaluate(() => {
      window.print = () => undefined;
    });
    await expect(printPage.getByText("サポート記録")).toBeVisible();
    const fontStatus = await printPage.evaluate(async () => {
      const sample = "サポート記録 施設 お子さま 利用期間 出力日 アレルギー 申告 観察";
      await document.fonts.ready;
      await document.fonts.load('400 10pt "Noto Sans JP"', sample);
      await document.fonts.ready;
      return {
        loaded: Array.from(document.fonts).some((face) =>
          face.family.replace(/["']/g, "").split(",")[0].trim() === "Noto Sans JP"
          && face.status === "loaded",
        ),
        checked: document.fonts.check('400 10pt "Noto Sans JP"', sample),
        family: getComputedStyle(document.body).fontFamily,
      };
    });
    expect(fontStatus.loaded).toBe(true);
    expect(fontStatus.checked).toBe(true);
    expect(fontStatus.family).toContain("Noto Sans JP");
    await expect(printPage.getByText(corrected, { exact: true })).toBeVisible();
    await expect(printPage.getByRole("heading", { name: "アレルギーの申告", exact: true })).toBeVisible();
    await printPage.screenshot({
      path: path.join(process.env.HOME!, "supporter-real-print.jpg"),
      fullPage: true,
    });
    const pdf = await printPage.pdf({ format: "A4", printBackground: true });
    expect(pdf.byteLength).toBeGreaterThan(1_000);
    await printPage.close();

    const correctedRow = facility.locator("div.border-b").filter({ hasText: corrected });
    await correctedRow.getByRole("button", { name: "削除" }).click();
    const deleteDialog = facility.locator("div.border-red-200").filter({ hasText: "この記録を削除しますか？" });
    await deleteDialog.getByPlaceholder("削除理由（必須）").fill("browser flow cleanup");
    await deleteDialog.getByRole("button", { name: "理由を付けて削除" }).click();
    await expect(facility.getByText(corrected)).toHaveCount(0);

    await parent.reload();
    const acceptedInvitation = parent.locator("section").filter({ hasText: "ひなた（開発用）" });
    await expect(acceptedInvitation.getByText("状態: 受け入れ済み", { exact: true })).toBeVisible();
    parent.once("dialog", (dialog) => dialog.accept());
    const revokeResponse = parent.waitForResponse((response) =>
      response.url().match(/\/api\/supporter\/invitations\/\d+\/revoke$/) !== null
      && response.request().method() === "POST",
    );
    await acceptedInvitation.getByRole("button", { name: "取り消す" }).click();
    expect((await revokeResponse).ok()).toBe(true);
    await expect(acceptedInvitation.getByText("状態: 取り消し済み", { exact: true })).toBeVisible();
  } finally {
    // Look up the invitation only if a response was not captured before a
    // browser failure. The exact timestamp/code pair belongs to this run.
    if (!grantId) {
      const found = await pool.query(
        `SELECT id FROM supporter_grants
         WHERE family_id = $1 AND supporter_account_id = (
           SELECT id FROM supporter_accounts WHERE public_code = $2
         ) AND starts_at = $3 AND ends_at = $4
         ORDER BY id DESC LIMIT 1`,
        [familyId, publicCode, inviteStart, inviteEnd],
      );
      grantId = found.rows[0]?.id;
    }
    if (requestIds.length) {
      await pool.query(
        `DELETE FROM supporter_idempotency WHERE request_id = ANY($1::varchar[])`,
        [requestIds],
      );
      await pool.query(
        `DELETE FROM supporter_audit_logs WHERE request_id = ANY($1::varchar[])`,
        [requestIds],
      );
    }
    if (grantId) {
      // Invite/accept/revoke audits have no request id; grant ownership makes
      // this deletion unambiguous for this test run.
      await pool.query(
        `DELETE FROM supporter_audit_logs WHERE supporter_grant_id = $1`,
        [grantId],
      );
      await pool.query(`DELETE FROM supporter_grants WHERE id = $1`, [grantId]);
    }
    if (createdRecordId) {
      await pool.query(`DELETE FROM logs WHERE id = $1`, [createdRecordId]);
    }
    await parentContext.close();
    await facilityContext.close();
    await pool.end();
  }
});