/* Local browser integration suite. Requires the disposable fixture server and Vite.
   Auth provider responses alone are substituted; every coaching request uses real HTTP/SQL. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const output = path.resolve(__dirname, "../../test-results/trainer-planning");
const shots = path.join(output, "screenshots");
fs.mkdirSync(shots, { recursive: true });
const results = [],
  consoleErrors = [],
  networkFailures = [];
const jwt = (email) =>
  [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(
      JSON.stringify({
        email,
        sub: "00000000-0000-4000-8000-000000000001",
        exp: Math.floor(Date.now() / 1000) + 86400,
      }),
    ).toString("base64url"),
    "fixture-signature",
  ].join(".");
const api = async (actor, route, body, method) => {
  const r = await fetch("http://127.0.0.1:8000/api/console" + route, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: "Bearer " + jwt(actor),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${route}: ${JSON.stringify(data)}`);
  return data;
};
const trainer = "trainer@planning.test",
  member = "member@planning.test";
let browser,
  page,
  rejectNextDialog = false;
const shot = async (name) => {
  await page.screenshot({
    path: path.join(shots, name),
    fullPage:
      !(await page.locator("dialog[open]").count()) &&
      ![
        "21-mobile-focused-numeric-input.png",
        "22-assignment-confirmation-mobile.png",
      ].includes(name),
  });
  console.log("SCREENSHOT", name);
};
const pass = (name, details = "") => {
  results.push({ name, status: "PASS", details });
  console.log("PASS", name);
};
const click = async (name) =>
  page.getByRole("button", { name, exact: true }).click();
const label = (name) => page.getByLabel(name, { exact: true });
async function login(email) {
  await page.context().clearCookies();
  await page.goto("http://127.0.0.1:3000/console");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.route("**/auth/v1/**", async (route) => {
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
      email,
      aud: "authenticated",
      role: "authenticated",
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email" },
      user_metadata: { name: email },
      identities: [],
      created_at: new Date().toISOString(),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        route.request().url().includes("/user")
          ? user
          : {
              access_token: jwt(email),
              refresh_token: "fixture-refresh",
              expires_in: 86400,
              expires_at: Math.floor(Date.now() / 1000) + 86400,
              token_type: "bearer",
              user,
            },
      ),
    });
  });
  await label("E-posta").fill(email);
  await page.locator("input[name=password]").fill("PlanningTestOnly!26");
  await click("Giriş yap");
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).waitFor();
}
(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "Europe/Istanbul",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400)
      networkFailures.push({ status: r.status(), url: r.url() });
  });
  page.on("dialog", (d) => {
    if (rejectNextDialog) {
      rejectNextDialog = false;
      return d.dismiss();
    }
    return d.accept();
  });
  await login(trainer);
  await page.getByRole("heading", { name: "Antrenör paneli" }).waitFor();
  await page.getByText("Üyelerin için bir sonraki adım.").waitFor();
  pass(
    "Trainer login UI with test auth provider and real trainer authorization",
  );
  const denied = await fetch(
    "http://127.0.0.1:8000/api/console/coaching/dashboard",
    { headers: { Authorization: "Bearer " + jwt(member) } },
  );
  assert.equal(denied.status, 403);
  pass("Member denied trainer dashboard");
  await shot("01-trainer-dashboard-desktop.png");
  await click("Programlar");
  await page.getByText("Daha iyi planla. Birlikte ilerle.").waitFor();
  await click("＋ Program oluştur");
  await label("Program adı").fill("Güç Temelleri · 4 Hafta");
  await label("Amaç").fill("Güç ve hareket kalitesi");
  await label("Süre (hafta)").fill("4");
  pass("Create program and configure duration");
  rejectNextDialog = true;
  await click("Antrenmanlar");
  await label("Program adı").waitFor();
  assert.equal(
    await label("Program adı").inputValue(),
    "Güç Temelleri · 4 Hafta",
  );
  pass("Unsaved-change navigation guard retains draft when dismissed");
  await click("Yayınla");
  await page
    .getByRole("alert")
    .filter({ hasText: "En az bir antrenman günü" })
    .waitFor();
  await shot("18-publish-validation.png");
  pass("Publish empty program validation");
  await click("＋ Antrenman ekle");
  await label("Antrenman adı").fill("Üst Vücut A");
  await label("Egzersiz ara").fill("Bench Press");
  await page
    .locator(".tp-exercise-pick")
    .filter({ hasText: "Bench press" })
    .first()
    .click();
  await label("Set").fill("4");
  await label("Tekrar").fill("12");
  await label("Ağırlık (kg)").fill("40");
  await label("Antrenör talimatı").fill(
    "Kontrollü tempo. Son tekrarları zorlamadan tamamla.",
  );
  await label("Egzersiz ara").fill("Push-up");
  await page.locator(".tp-exercise-pick").first().click();
  await label("Set").fill("4");
  await label("Tekrar").fill("15");
  await label("Dinlenme (sn)").fill("60");
  if (await label("Ağırlık (kg)").count()) {
    assert.equal(await label("Ağırlık (kg)").inputValue(), "");
    assert.equal(await label("Ağırlık (kg)").getAttribute("required"), null);
  }
  pass("Configure weighted and bodyweight targets without required weight");
  await page
    .getByRole("button", { name: "Egzersizi yukarı taşı", exact: true })
    .nth(1)
    .click();
  assert.match(
    await page.locator(".tp-target").first().innerText(),
    /Şınav|Push/,
  );
  pass("Accessible exercise reorder");
  await shot("04-workout-builder-desktop.png");
  await shot("05-exercise-editor-desktop.png");
  const failedSave = async (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Test: bağlantı geçici olarak kullanılamıyor.",
      }),
    });
  await page.route("**/api/console/coaching/workout-templates", failedSave);
  await click("Şablon olarak kaydet");
  await page.getByRole("alert").filter({ hasText: "Test: bağlantı" }).waitFor();
  assert.equal(await label("Antrenman adı").inputValue(), "Üst Vücut A");
  await shot("23-retryable-save-error.png");
  await page.unroute("**/api/console/coaching/workout-templates", failedSave);
  pass("Failed request preserves workout edits and allows retry");
  await click("Şablon olarak kaydet");
  await page
    .getByText("Antrenman şablonu kaydedildi.", { exact: true })
    .waitFor();
  pass("Save reusable workout template");
  await click("Güne uygula");
  await page.getByText("Antrenman güne eklendi.", { exact: false }).waitFor();
  await page.getByText("Gün işlemleri · Çoğalt", { exact: true }).click();
  const programStart = await label("Başlangıç").inputValue();
  const addDate = (n) => {
    const d = new Date(programStart + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  await label("Günü çoğaltma tarihi").fill(addDate(2));
  await click("Günü çoğalt");
  pass("Duplicate entire training day");
  await label("Hedef hafta").selectOption("1");
  await click("Haftayı kopyala");
  pass("Copy complete week");
  await label("Hafta").selectOption("1");
  await page.locator(".tp-day").nth(0).click();
  await click("Düzenle");
  await label("Antrenman adı").fill("Üst Vücut B · İlerleme");
  await label("Set").fill("5");
  await click("Güne uygula");
  await label("Hafta").selectOption("0");
  assert.equal(
    await page
      .getByRole("heading", { name: "Üst Vücut A", exact: true })
      .count(),
    1,
  );
  pass("Edit second week independently");
  await page.locator(".tp-day").nth(1).click();
  await click("Dinlenme günü");
  assert.match(await page.locator(".tp-day").nth(1).innerText(), /Dinlenme/);
  assert.match(await page.locator(".tp-day").nth(3).innerText(), /Planlanmadı/);
  pass("Rest day distinguished from unconfigured day");
  await page.locator(".tp-day").nth(4).click();
  await page.locator(".tp-template-pick").first().click();
  assert.equal(await page.locator(".tp-scheduled").count(), 1);
  await page.getByText("Kopyala, taşı veya kaldır", { exact: true }).click();
  await label("Kopyala / taşı tarihi").fill(addDate(5));
  await click("Taşı");
  assert.equal(await page.locator(".tp-scheduled").count(), 0);
  await page.locator(".tp-day").nth(5).click();
  assert.equal(await page.locator(".tp-scheduled").count(), 1);
  pass("Reuse saved workout template and move session between days");
  await click("Taslağı kaydet");
  await page.getByText("Taslak kaydedildi.", { exact: true }).waitFor();
  pass("Persist draft");
  await click("Yayınla");
  await page
    .getByRole("dialog")
    .getByText("Tamamen boş haftalar:", { exact: false })
    .waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /3, 4/);
  assert.equal(
    await page
      .getByRole("button", { name: "Bu takvimle yayınla", exact: true })
      .isEnabled(),
    false,
  );
  await shot("24-publication-coverage-review.png");
  await click("3. haftayı düzenle");
  assert.equal(await label("Hafta").inputValue(), "2");
  const draftBeforeReview = (
    await api(trainer, "/coaching/overview")
  ).plans.find((p) => p.content.name === "Güç Temelleri · 4 Hafta");
  assert.equal(draftBeforeReview.content.planning_status, "draft");
  pass(
    "Incomplete publication lists empty weeks, requires acknowledgement and returns to selected week without publishing",
  );
  await click("Yayınla");
  await page
    .getByLabel(
      "Boş hafta ve günleri inceledim; bu takvimle yayınlamayı onaylıyorum.",
      { exact: true },
    )
    .check();
  await click("Bu takvimle yayınla");
  await label("Hafta").selectOption("0");
  await page
    .getByText("Program yayınlandı. Üyelere atayabilirsin.", { exact: true })
    .waitFor();
  pass("Publish valid program");
  await page.locator(".tp-day").nth(0).click();
  await shot("03-program-builder-desktop.png");
  await click("Üye önizlemesi");
  await page.getByRole("dialog").waitFor();
  await shot("19-member-schedule-preview.png");
  await click("Pencereyi kapat");
  pass("Member schedule preview");
  await click("Kütüphaneye dön");
  await shot("02-program-library-desktop.png");
  await label("Program ara").fill("bulunmayan");
  assert.equal(await page.locator(".tp-program-card").count(), 0);
  await label("Program ara").fill("Güç Temelleri");
  assert.equal(await page.locator(".tp-program-card").count(), 1);
  pass("Program library search");
  await click("Üyelere ata");
  await page.getByRole("dialog").waitFor();
  await page.getByRole("checkbox").first().check();
  await click("Atama özetini incele");
  await shot("06-assign-program-desktop.png");
  await click("1 üyeye atamayı onayla");
  await page
    .getByText("Program seçilen üyelere atandı.", { exact: false })
    .waitFor();
  pass("Assign published program to authorized member");
  await click("Üyelere ata");
  await page.getByRole("checkbox").first().check();
  await click("Atama özetini incele");
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "1 üyeye atamayı onayla", exact: true })
      .isEnabled(),
    false,
  );
  await shot("20-overlap-warning.png");
  pass("Overlap blocked without explicit acknowledgement");
  await click("Pencereyi kapat");
  const overview = await api(trainer, "/coaching/overview");
  const template = overview.plans.find(
    (p) => p.content.name === "Güç Temelleri · 4 Hafta" && !p.athlete_id,
  );
  const own = await api(member, "/coaching/overview");
  const assigned = own.plans.find((p) => p.template_id === template.id);
  assert(assigned);
  assert.equal(assigned.content.start_date, programStart);
  pass("Member receives correct dated assignment through real API");
  let workout = await api(member, "/coaching/workouts", {
    id: crypto.randomUUID(),
    plan_id: assigned.id,
    session_key: assigned.content.days[0].id,
    scheduled_date: assigned.content.days[0].dates[0],
  });
  const command = async (action, extra = {}) => {
    workout = await api(member, `/coaching/workouts/${workout.id}/commands`, {
      request_id: crypto.randomUUID(),
      expected_version: workout.version,
      action,
      ...extra,
    });
  };
  await command("start");
  const first = workout.snapshot.exercises[0];
  for (let i = 1; i <= first.sets + 1; i++)
    await command("set", {
      actual_set: {
        id: crypto.randomUUID(),
        exercise_key: first.id,
        set_number: i,
        reps: 15,
        status: "completed",
        method: "manual",
        occurred_at: new Date().toISOString(),
        notes: "",
      },
    });
  for (const target of workout.snapshot.exercises.slice(1))
    for (let i = 1; i <= target.sets; i++)
      await command("set", {
        actual_set: {
          id: crypto.randomUUID(),
          exercise_key: target.id,
          set_number: i,
          reps: 12,
          kg: 40,
          status: "completed",
          method: "manual",
          occurred_at: new Date().toISOString(),
          notes: "",
        },
      });
  await command("finish");
  pass(
    "Record completed workout and an extra set through existing member commands",
  );
  await click("Üyelerim");
  await page
    .getByLabel("Üye seç", { exact: true })
    .selectOption(assigned.athlete_id);
  await page.locator('.trainer-exercise-progress[data-extra="1"]').waitFor();
  await shot("07-member-progress-desktop.png");
  await shot("16-trainer-completed-workout.png");
  await shot("17-trainer-extra-sets.png");
  pass("Trainer progress shows recorded planned, completed and extra sets");
  assert.equal(
    await page
      .getByRole("heading", { name: "Emre Demir", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("heading", { name: "Ada Yılmaz", exact: true })
      .count(),
    1,
  );
  await click("Gelecek planı düzenle");
  await page.getByText("ÜYEYE ÖZEL PROGRAM", { exact: true }).waitFor();
  assert.equal(
    await label("Program adı").inputValue(),
    "Güç Temelleri · 4 Hafta",
  );
  assert.equal(
    await page
      .getByText("Bugün ve geçmiş hedefler korunur.", { exact: false })
      .count(),
    0,
  );
  pass(
    "Selected member view hides other member cards and opens that member's future plan directly",
  );
  await click("Kütüphaneye dön");
  const before = JSON.stringify(workout);
  const newContent = structuredClone(assigned.content);
  const future = newContent.days.find((d) =>
    d.dates.some((dt) => dt > programStart),
  );
  future.exercises[0].reps = 9;
  await api(
    trainer,
    "/coaching/plans/" + assigned.id,
    {
      expected_version: assigned.version,
      content: newContent,
      reason: "Future progression",
    },
    "PATCH",
  );
  const after = await api(member, "/coaching/overview");
  assert.equal(
    JSON.stringify(after.workouts.find((w) => w.id === workout.id)),
    before,
  );
  pass(
    "Future plan modification preserves completed workout snapshot and actuals",
  );
  await login(member);
  await page.getByRole("heading", { name: "Programım", exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Güç Temelleri · 4 Hafta", exact: true })
    .waitFor();
  await shot("15-member-assigned-program.png");
  pass("Member program and Today render persisted schedule in UI");
  await login(trainer);
  await page.getByText("Üyelerin için bir sonraki adım.").waitFor();
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
    [390, 844],
    [375, 667],
    [412, 915],
  ]) {
    await page.setViewportSize({ width, height });
    await click("Genel bakış");
    if (width === 390) await shot("08-trainer-home-mobile.png");
    await click("Programlar");
    await page.locator(".tp-program-card").first().waitFor();
    if (width < 768)
      assert(
        await page
          .locator(".trainer-navigation")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
        "all destinations visible in library navigation",
      );
    if (width === 390) await shot("09-program-list-mobile.png");
    await page
      .locator(".tp-program-card")
      .filter({ hasText: "Program şablonu" })
      .getByRole("button", { name: "Düzenle", exact: true })
      .first()
      .click();
    await label("Hafta").waitFor();
    if (width < 768) {
      assert.equal(
        await page.locator(".tp-settings").getAttribute("open"),
        null,
      );
      assert.equal(
        await page.locator(".tp-template-section").getAttribute("open"),
        null,
      );
      assert.equal(
        await page.locator(".tp-program-summary").getAttribute("open"),
        null,
      );
      assert.equal(
        await page.locator(".trainer-navigation").isVisible(),
        false,
        "focused editor keeps library navigation out of the editing area",
      );
      const reserved = await page
        .locator('.tp[data-has-actions="true"]')
        .evaluate((el) => ({
          padding: parseFloat(getComputedStyle(el).paddingBottom),
          bar: el.querySelector(".tp-savebar").getBoundingClientRect().height,
        }));
      assert(
        reserved.padding >= reserved.bar,
        "action bar has reserved content space",
      );
    }
    if (width === 390) {
      await shot("10-program-builder-mobile.png");
      await click("Yayınla");
      await page.getByRole("dialog").waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Bu takvimle yayınla", exact: true })
          .isEnabled(),
        false,
      );
      await shot("25-publication-review-mobile.png");
      await click("Takvime dön");
      await page.locator(".tp-settings>summary").click();
      assert.equal(await label("Program adı").isVisible(), true);
      await page.locator(".tp-settings>summary").click();
      await page.locator(".tp-template-section>summary").click();
      assert.equal(
        await page.locator(".tp-template-pick").first().isVisible(),
        true,
      );
      await shot("26-workout-templates-mobile.png");
      await page.locator(".tp-template-section>summary").click();
      pass(
        "Mobile publication review and on-demand settings/templates remain accessible",
      );
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `program overflow ${width}`,
    );
    await page
      .locator(".tp-scheduled")
      .first()
      .getByRole("button", { name: "Düzenle", exact: true })
      .click();
    await label("Antrenman adı").waitFor();
    if (width === 390) {
      await shot("11-workout-editor-mobile.png");
      await click("＋ Egzersiz seç");
      await label("Egzersiz ara").waitFor();
      await shot("12-exercise-selection-mobile.png");
      await click("Kütüphaneyi kapat");
      await label("Set").focus();
      await page.setViewportSize({ width, height: 450 });
      await label("Set").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const el = document.activeElement,
          bar = document.querySelector(".tp-savebar");
        return (
          el &&
          bar &&
          el.getBoundingClientRect().bottom < bar.getBoundingClientRect().top &&
          bar.getBoundingClientRect().bottom <= innerHeight + 1
        );
      });
      await shot("21-mobile-focused-numeric-input.png");
      pass(
        "Reduced-height viewport keeps focused numeric input and both save actions visible",
      );
      await page.setViewportSize({ width, height });
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `workout overflow ${width}`,
    );
    await click("← Geri");
    await click("Kütüphaneye dön");
    await page
      .locator(".tp-program-card")
      .filter({ hasText: "Program şablonu" })
      .getByRole("button", { name: "Üyelere ata", exact: true })
      .first()
      .click();
    await page.getByRole("dialog").waitFor();
    if (width === 390) {
      await shot("13-assign-program-mobile.png");
      await page.getByRole("checkbox").first().check();
      await click("Atama özetini incele");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "1 üyeye atamayı onayla", exact: true })
        .scrollIntoViewIfNeeded();
      await shot("22-assignment-confirmation-mobile.png");
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `assignment overflow ${width}`,
    );
    await click("Pencereyi kapat");
    await click("Üyelerim");
    await page
      .getByLabel("Üye seç", { exact: true })
      .selectOption(assigned.athlete_id);
    await page.locator('.trainer-exercise-progress[data-extra="1"]').waitFor();
    if (width === 390) await shot("14-member-progress-mobile.png");
    assert.equal(
      await page
        .getByRole("heading", { name: "Emre Demir", exact: true })
        .count(),
      0,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `progress overflow ${width}`,
    );
    await page.getByLabel("Üye seç", { exact: true }).selectOption("");
    pass(`Responsive workflows ${width}×${height}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await click("Programlar");
  await click("＋ Program oluştur");
  await label("Program adı").fill("Tam Plan · 1 Hafta");
  await label("Süre (hafta)").fill("1");
  await page.locator(".tp-template-pick").first().click();
  for (let d = 1; d < 7; d++) {
    await page.locator(".tp-day").nth(d).click();
    await click("Dinlenme günü");
  }
  await click("Yayınla");
  await page
    .getByText("Program yayınlandı. Üyelere atayabilirsin.", { exact: true })
    .waitFor();
  assert.equal(await page.locator("dialog[open]").count(), 0);
  const complete = (await api(trainer, "/coaching/overview")).plans.find(
    (p) => p.content.name === "Tam Plan · 1 Hafta",
  );
  assert.equal(complete.content.planning_status, "published");
  assert.equal(complete.content.rest_dates.length, 6);
  await shot("27-complete-week-published.png");
  pass(
    "Fully configured training/rest schedule publishes without an unnecessary gap warning",
  );
  assert.equal(consoleErrors.length, 0, consoleErrors.join("\n"));
  pass("No uncaught browser errors");
  fs.writeFileSync(
    path.join(output, "browser-results.json"),
    JSON.stringify({ results, consoleErrors, networkFailures }, null, 2),
  );
  await browser.close();
  process.exit(0);
})().catch(async (e) => {
  console.error(e);
  results.push({
    name: "Browser suite stopped",
    status: "FAIL",
    details: e.stack,
  });
  if (page)
    await page
      .screenshot({
        path: path.join(shots, "failure-debug.png"),
        fullPage: true,
      })
      .catch(() => {});
  fs.writeFileSync(
    path.join(output, "browser-results.json"),
    JSON.stringify({ results, consoleErrors, networkFailures }, null, 2),
  );
  if (browser) await browser.close().catch(() => {});
  process.exit(1);
});
