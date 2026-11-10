/* Recovery workflow: real localhost APIs/SQL; only explicit one-shot 503s are injected. */
const { api, raw, launch, login } = require("./trainer-browser-fixture.cjs");
const assert = require("node:assert/strict"),
  fs = require("fs"),
  path = require("path");
const root = path.resolve(
    __dirname,
    "../../test-results/trainer-quality-recovery",
  ),
  shots = path.join(root, "workflows");
fs.mkdirSync(shots, { recursive: true });
const trainer = "trainer@planning.test",
  member = "member@planning.test",
  other = "second@planning.test";
let page, browser, env;
const results = [];
const pass = (name, details = "") => {
  results.push({ name, status: "PASS", details });
  console.log("PASS", name);
};
const b = (name) => page.getByRole("button", { name, exact: true });
const click = (name) => b(name).click();
const field = (name) => page.getByLabel(name, { exact: true });
const openDetails = async (cls) => {
  const d = page.locator(cls).first();
  if ((await d.count()) && !((await d.getAttribute("open")) !== null))
    await d.locator(":scope > summary").click();
};
const shot = async (name) => {
  await page.screenshot({ path: path.join(shots, name + ".png") });
  console.log("SHOT", name);
};
const state = async (expected) => {
  await page.locator(`.tp-save-state[data-save-state=${expected}]`).waitFor();
};
let source, name, assigned, workoutName;
async function openSource() {
  await click("Programlar");
  const card = page
    .locator(".tp-program-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .filter({ hasText: "Program şablonu" });
  await card.getByRole("button", { name: "Düzenle", exact: true }).click();
  await page.locator(".tp-calendar").waitFor();
}
async function persisted() {
  return (await api(trainer, "/coaching/overview")).plans.find(
    (p) => p.content.name === name && !p.athlete_id,
  );
}
(async () => {
  env = await launch();
  ({ page, browser } = env);
  page.setDefaultTimeout(30000);
  page.on("response", async (r) => {
    if (r.status() === 401)
      console.log("AUTH TRANSITION", r.url(), await r.text().catch(() => ""));
  });
  await login(page, trainer);
  await b("Programlar").waitFor();
  assert.equal((await raw(member, "/coaching/dashboard")).status, 403);
  pass("Trainer authorization remains scoped; ordinary member receives 403");
  const historical = await api(member, "/coaching/overview"),
    historicalOther = await api(other, "/coaching/overview");
  name = "Kalite İncelemesi · Güç ve Denge " + Date.now().toString().slice(-6);
  workoutName = "Üst Gövde · Kontrollü 4×10 · " + name.slice(-6);
  await click("Programlar");
  await click("＋ Program oluştur");
  await field("Program adı").fill(name);
  await field("Amaç").fill("Kontrollü güç ve düzenli hareket");
  await field("Süre (hafta)").fill("4");
  const start = await field("Başlangıç").inputValue();
  await state("unsaved");
  await shot("01-unsaved-program");
  assert.equal(await persisted(), undefined);
  pass(
    "1 Create program: unsaved state is explicit and no phantom persistence exists",
  );
  await click("＋ Antrenman ekle");
  await field("Antrenman adı").fill(workoutName);
  await field("Egzersiz ara").fill("Bench press");
  await click("Bench press egzersizini ekle");
  assert(await field("Set").evaluate((e) => e === document.activeElement));
  await field("Set").fill("4");
  await field("Tekrar").fill("10");
  await field("Ağırlık (kg)").fill("42,5");
  await field("Dinlenme (sn)").fill("90");
  await openDetails(".tp-target.selected .tp-target-notes");
  await field("Antrenör talimatı").fill("Kontrollü indir, iki saniye bekle.");
  await field("Egzersiz ara").fill("sinav");
  await click("Şınav egzersizini ekle");
  await field("Set").fill("3");
  await field("Tekrar").fill("12");
  await shot("02-focused-exercise-targets");
  pass(
    "2–4 Add workout/exercises and configure sets/reps with continuous focus and Turkish search",
  );
  const failTemplate = (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Test: bağlantı kesildi; şablon henüz kaydedilmedi.",
      }),
    });
  await page.route("**/api/console/coaching/workout-templates", failTemplate);
  await click("Şablon olarak kaydet");
  await state("failed");
  assert.equal(await field("Set").inputValue(), "3");
  await shot("03-template-save-failed");
  await page.unroute("**/api/console/coaching/workout-templates", failTemplate);
  await click("Yeniden dene");
  await state("saved");
  const template = (
    await api(trainer, "/coaching/workout-templates?tenant_id=planning-club")
  ).find((t) => t.content.name === workoutName);
  assert(template);
  assert.equal(template.content.exercises[0].kg, 42.5);
  assert.match(
    await page.locator(".tp-save-state").innerText(),
    /Şablon kaydedildi/,
  );
  assert.equal(await persisted(), undefined);
  pass(
    "7 Reusable template retry persists real targets; saving template does not claim program persistence",
  );
  await click("Güne uygula");
  await state("unsaved");
  assert.equal(await page.locator(".tp-scheduled").count(), 1);
  assert.match(
    await page.locator(".tp-save-state").innerText(),
    /yerel değişikliği|kalıcı/,
  );
  assert.equal(await persisted(), undefined);
  await shot("04-applied-to-day-not-persisted");
  pass(
    "5 Apply workout to selected day changes local program draft only and says what to save next",
  );
  const delaySave = async (route) => {
    const response = await route.fetch();
    await new Promise((r) => setTimeout(r, 1200));
    await route.fulfill({ response });
  };
  await page.route("**/api/console/coaching/plans", delaySave);
  await click("Taslağı kaydet");
  await state("saving");
  assert(await page.locator(".tp-planner-layout").evaluate((e) => e.inert));
  assert(await b("Kütüphaneye dön").isDisabled());
  await shot("05-saving-program");
  await state("saved");
  await page.unroute("**/api/console/coaching/plans", delaySave);
  source = await persisted();
  assert.equal(source.content.planning_status, "draft");
  assert.equal(source.content.days[0].exercises[0].sets, 4);
  await shot("06-saved-draft");
  await page.reload();
  await b("Programlar").waitFor();
  await openSource();
  assert.equal(await page.locator(".tp-scheduled").count(), 1);
  await page
    .locator(".tp-scheduled")
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  assert.equal(await field("Set").inputValue(), "4");
  assert.equal(await field("Tekrar").inputValue(), "10");
  assert.equal(await field("Ağırlık (kg)").inputValue(), "42.5");
  await click("← Geri");
  pass(
    "6 Reload verifies persisted day, exercise, sets, repetitions and decimal weight",
  );
  await click("Kütüphaneye dön");
  await click("Antrenmanlar");
  const tc = page.locator("article").filter({
    has: page.getByRole("heading", { name: workoutName, exact: true }),
  });
  assert.equal(await tc.count(), 1);
  await tc
    .getByRole("button", { name: "Antrenmanı düzenle", exact: true })
    .click();
  assert.equal(await field("Set").inputValue(), "4");
  await click("← Geri");
  pass("8 Reusable template appears in library and reopens persisted targets");
  await openSource();
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await page.locator(".tp-day").nth(n).click();
    await click("Dinlenme günü");
  }
  await openDetails(".tp-week-actions");
  for (const n of [1, 2, 3]) {
    await field("Hedef hafta").selectOption(String(n));
    await click("Haftayı kopyala");
  }
  await field("Hafta").selectOption("1");
  await page.locator(".tp-day").nth(0).click();
  await page
    .locator(".tp-scheduled")
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  await field("Set").fill("5");
  await click("Güne uygula");
  await state("unsaved");
  pass(
    "9–10 Modify program and independently copied week: persistent unsaved feedback remains",
  );
  await click("Yayınla");
  await state("published");
  source = await persisted();
  assert.equal(source.content.planning_status, "published");
  assert.equal(source.content.rest_dates.length, 24);
  assert.equal(
    source.content.days.find((d) => d.dates.includes(start)).exercises[0].sets,
    4,
  );
  assert.equal(
    source.content.days.find((d) =>
      d.dates.includes(
        new Date(Date.parse(start) + 7 * 86400000).toISOString().slice(0, 10),
      ),
    ).exercises[0].sets,
    5,
  );
  assert.equal(await b("Yayınla").count(), 0);
  assert.equal(await b("Güncellemeyi yayınla").count(), 0);
  assert(await b("Üyelere ata").isEnabled());
  await shot("07-published-program");
  await page.reload();
  await b("Programlar").waitFor();
  await openSource();
  await state("published");
  pass(
    "11–12 Publish fully configured four-week program and confirm published state after reload; redundant publish action is absent",
  );
  await openDetails(".tp-settings");
  await field("Amaç").fill("İkinci sürüm · Kontrollü kuvvet ilerlemesi");
  await state("unpublished");
  assert(await b("Üyelere ata").isDisabled());
  await shot("08-published-with-unpublished-changes");
  assert.equal(
    (await persisted()).content.goal,
    "Kontrollü güç ve düzenli hareket",
  );
  pass(
    "13–14 Published local edits explicitly remain unpublished; assignment is blocked until persisted",
  );
  const failure = (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Test: bağlantı kesildi; program değişikliklerin korunuyor.",
      }),
    });
  await page.route(`**/api/console/coaching/plans/${source.id}`, failure);
  await click("Güncellemeyi yayınla");
  await state("failed");
  assert.equal(
    await field("Amaç").inputValue(),
    "İkinci sürüm · Kontrollü kuvvet ilerlemesi",
  );
  assert.equal((await persisted()).version, source.version);
  await shot("09-program-save-failed-retry");
  await page.unroute(`**/api/console/coaching/plans/${source.id}`, failure);
  await click("Yeniden dene");
  await state("published");
  source = await persisted();
  assert.equal(
    source.content.goal,
    "İkinci sürüm · Kontrollü kuvvet ilerlemesi",
  );
  await page.reload();
  await b("Programlar").waitFor();
  await openSource();
  await state("published");
  pass(
    "15 Failed publish preserves edits/version, Retry persists and reload confirms new version",
  );
  await click("Üyelere ata");
  await page
    .locator(".tp-member-picks label")
    .filter({ hasText: "Ada Yılmaz" })
    .getByRole("checkbox")
    .check();
  await click("Atama özetini incele");
  await page
    .getByRole("dialog", { name: "Atamayı son kez kontrol et" })
    .waitFor();
  await page.locator(".tp-impact-conflict").first().waitFor();
  assert(await b("1 üyeye atamayı onayla").isDisabled());
  await shot("10-overlap-final-review");
  await click("Mevcut programlardan sonra başlat");
  await click("Atama özetini incele");
  await page.locator(".tp-impact-preserved").first().waitFor();
  await shot("11-non-overlapping-final-review");
  await click("1 üyeye atamayı onayla");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const afterAssign = await api(member, "/coaching/overview");
  assigned = afterAssign.plans.find((p) => p.template_id === source.id);
  assert(assigned);
  assert.deepEqual(afterAssign.workouts, historical.workouts);
  for (const p of historical.plans)
    assert.deepEqual(
      afterAssign.plans.find((x) => x.id === p.id),
      p,
    );
  pass(
    "16 Final assignment names member/program/dates/affected programs; later-start resolution preserves existing assignments/history",
  );
  await login(page, member);
  await page.getByRole("heading", { name: "Programım", exact: true }).waitFor();
  await page.getByRole("heading", { name, exact: true }).waitFor();
  await field("Günü seç").fill(assigned.content.start_date);
  const memberCard = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  assert.match(await memberCard.innerText(), /4 × 10 tekrar/);
  await shot("12-member-persisted-schedule");
  pass(
    "17 Member schedule renders assigned persisted targets on the actual start date",
  );
  await login(page, trainer);
  await b("Programlar").waitFor();
  await openSource();
  await openDetails(".tp-settings");
  await field("Amaç").fill("Kaynak şablon revizyonu · Üye kopyası korunur");
  await click("Güncellemeyi yayınla");
  await state("published");
  assert.deepEqual(
    (await api(member, "/coaching/overview")).plans.find(
      (p) => p.id === assigned.id,
    ),
    assigned,
  );
  assert.deepEqual(
    (await api(member, "/coaching/overview")).workouts,
    historical.workouts,
  );
  assert.deepEqual(
    (await api(other, "/coaching/overview")).workouts,
    historicalOther.workouts,
  );
  await click("Kütüphaneye dön");
  await click("Üyelerim");
  const links = (await api(trainer, "/coaching/overview")).links;
  await field("Üye seç").selectOption(
    links.find((l) => l.name === "Ada Yılmaz").athlete_id,
  );
  await page
    .locator(
      '.trainer-exercise-progress[data-planned="4"][data-completed="5"][data-extra="1"]',
    )
    .first()
    .waitFor();
  await shot("13-ada-five-of-four-extra");
  await field("Üye seç").selectOption(
    links.find((l) => l.name === "Emre Demir").athlete_id,
  );
  await page
    .locator(
      '.trainer-exercise-progress[data-planned="4"][data-completed="4"][data-extra="0"]',
    )
    .first()
    .waitFor();
  await shot("14-emre-four-of-four");
  pass(
    "18 Progress retains distinct 4/4 and 5/4 (+1 extra), frozen targets, actuals and independent member copies",
  );
  for (let i = 0; i < 5; i++) {
    await page.reload();
    await b("Programlar").waitFor();
  }
  pass(
    "Repeated authenticated reload restores Trainer without duplicate-session loading deadlock",
  );
  assert.equal(env.errors.length, 0);
  pass("No uncaught JavaScript errors in the complete workflow");
  fs.writeFileSync(
    path.join(root, "functional-results.json"),
    JSON.stringify(
      {
        results,
        sourceId: source.id,
        sourceName: name,
        assignedId: assigned.id,
        errors: env.errors,
        requests: env.failures,
      },
      null,
      2,
    ),
  );
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  results.push({ name: e.message, status: "FAIL" });
  fs.writeFileSync(
    path.join(root, "functional-results.json"),
    JSON.stringify({ results }, null, 2),
  );
  if (page) {
    await page
      .screenshot({
        path: path.join(root, "diagnostics/functional-failure.png"),
      })
      .catch(() => {});
    fs.writeFileSync(
      path.join(root, "diagnostics/functional-failure.txt"),
      await page
        .locator("body")
        .innerText()
        .catch(() => ""),
    );
  }
  await browser?.close();
  process.exit(1);
});
