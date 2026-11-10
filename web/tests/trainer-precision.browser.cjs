const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const {
  api,
  raw,
  launch,
  login,
  output,
  shots,
} = require("./trainer-browser-fixture.cjs");
const trainer = "trainer@planning.test",
  ada = "member@planning.test",
  emre = "second@planning.test";
const results = [];
let env, page, browser;
const pass = (name, details = "") => {
  results.push({ name, status: "PASS", details });
  console.log("PASS", name);
};
const button = (name) => page.getByRole("button", { name, exact: true });
const click = async (name) => button(name).click();
const label = (name) => page.getByLabel(name, { exact: true });
const shot = async (name, fullPage = false) => {
  await page.screenshot({ path: path.join(shots, name), fullPage });
  console.log("SCREENSHOT", name);
};
const pick = async (name) =>
  page
    .getByRole("button", { name: name + " egzersizini ekle", exact: true })
    .click();
const namedCard = (name) =>
  page
    .locator(".tp-program-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .filter({ hasText: "Program şablonu" });
async function chooseMember(name) {
  await page
    .locator(".tp-member-picks label")
    .filter({ hasText: name })
    .getByRole("checkbox")
    .check();
  await click("Atama özetini incele");
  await page
    .getByRole("dialog", { name: "Atamayı son kez kontrol et" })
    .waitFor();
}
async function showMember(id) {
  await click("Üyelerim");
  await label("Üye seç").selectOption(id);
  await page.locator(".trainer-workout-progress").first().waitFor();
}
async function record(actor, plan, extra) {
  let w = await api(actor, "/coaching/workouts", {
    id: crypto.randomUUID(),
    plan_id: plan.id,
    session_key: plan.content.days[0].id,
    scheduled_date: plan.content.days[0].dates[0],
  });
  const cmd = async (action, other = {}) => {
    w = await api(actor, `/coaching/workouts/${w.id}/commands`, {
      request_id: crypto.randomUUID(),
      expected_version: w.version,
      action,
      ...other,
    });
  };
  await cmd("start");
  for (const [index, e] of w.snapshot.exercises.entries())
    for (let n = 1; n <= e.sets + (index === 0 ? extra : 0); n++)
      await cmd("set", {
        actual_set: {
          id: crypto.randomUUID(),
          exercise_key: e.id,
          set_number: n,
          reps: e.reps ?? 12,
          ...(e.kg != null ? { kg: e.kg } : {}),
          method: "manual",
          status: "completed",
          occurred_at: new Date().toISOString(),
          notes: index === 0 && n > e.sets ? "Üyenin ek set kaydı" : "",
        },
      });
  await cmd("finish");
  return w;
}
(async () => {
  env = await launch();
  ({ page, browser } = env);
  await login(page, trainer);
  await page.getByText("Üyelerin için bir sonraki adım.").waitFor();
  pass(
    "Test-provider login uses the normal Supabase client and real scoped APIs",
  );
  const forbidden = await raw(ada, "/coaching/dashboard");
  assert.equal(forbidden.status, 403);
  pass("Ordinary member remains denied trainer access");
  await click("Programlar");
  await click("＋ Program oluştur");
  await label("Program adı").fill("Kuvvet ve Denge · Ada");
  await label("Amaç").fill("Kontrollü güç ve düzenli antrenman");
  await label("Süre (hafta)").fill("4");
  const start = await label("Başlangıç").inputValue();
  const date = (n) => {
    const d = new Date(start + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  await click("＋ Antrenman ekle");
  await label("Antrenman adı").fill("Üst Gövde A · 4×12");
  await label("Egzersiz ara").fill("Bench press");
  await label("Kas grubu").selectOption("chest");
  await label("Ekipman").selectOption("barbell");
  await pick("Bench press");
  assert(await label("Set").evaluate((el) => el === document.activeElement));
  assert.match(
    await page.getByRole("region", { name: "Seçili hafta ve gün" }).innerText(),
    /1\. hafta/,
  );
  pass(
    "Exercise addition focuses its sets directly without losing selected day",
  );
  await label("Set").fill("");
  assert.equal(await label("Set").inputValue(), "");
  assert.equal(await label("Set").getAttribute("aria-invalid"), "true");
  await click("Şablon olarak kaydet");
  await page.getByRole("alert").filter({ hasText: "set sayısı" }).waitFor();
  await label("Set").fill("4");
  await label("Tekrar").fill("12");
  await label("Ağırlık (kg)").fill("42,5");
  await label("Dinlenme (sn)").fill("90");
  pass(
    "Empty numeric text stays editable, validates, and decimal comma input is accepted",
  );
  await click("Filtreleri temizle");
  await label("Egzersiz ara").fill("sinav");
  await pick("Şınav");
  assert(await label("Set").evaluate((el) => el === document.activeElement));
  await label("Set").fill("4");
  await label("Tekrar").fill("15");
  await label("Dinlenme (sn)").fill("60");
  pass(
    "Accent-tolerant exercise search and filter clearing retain the selected workout",
  );
  await page
    .getByRole("button", { name: "Egzersizi yukarı taşı", exact: true })
    .nth(1)
    .focus();
  await page.keyboard.press("Enter");
  assert.match(
    await page.locator(".tp-edit-feedback").innerText(),
    /1\/2 sırasına taşındı/,
  );
  await page
    .getByRole("button", { name: "Egzersizi yukarı taşı", exact: true })
    .nth(1)
    .click();
  assert.match(
    await page.locator(".tp-target").first().innerText(),
    /Bench press/,
  );
  pass("Keyboard-accessible reordering reports the resulting position");
  const targetIds = await page
    .locator(".tp-target")
    .evaluateAll((nodes) => nodes.map((el) => el.dataset.targetId));
  await click("Egzersizi kaldır");
  await page.getByRole("dialog", { name: "Egzersizi kaldır?" }).waitFor();
  await shot("S03-safe-exercise-removal.png");
  await click("Vazgeç");
  assert.equal(await page.locator(".tp-target").count(), 2);
  await click("Egzersizi kaldır");
  await click("Kaldırmayı onayla");
  assert.equal(await page.locator(".tp-target").count(), 1);
  await click("Kaldırmayı geri al");
  assert.deepEqual(
    await page
      .locator(".tp-target")
      .evaluateAll((nodes) => nodes.map((el) => el.dataset.targetId)),
    targetIds,
  );
  assert.equal(await label("Ağırlık (kg)").inputValue(), "42.5");
  pass(
    "Removal requires confirmation; cancel and undo preserve IDs and targets",
  );
  await click("Şablon olarak kaydet");
  await page
    .getByText("Antrenman şablonu kaydedildi.", { exact: true })
    .waitFor();
  const stored = (
    await api(trainer, "/coaching/workout-templates?tenant_id=planning-club")
  ).find((t) => t.content.name === "Üst Gövde A · 4×12");
  assert.equal(stored.content.exercises[0].kg, 42.5);
  await click("Güne uygula");
  await page.locator(".tp-day").nth(1).click();
  await click("Dinlenme günü");
  assert.match(
    await page.getByRole("region", { name: "Seçili hafta ve gün" }).innerText(),
    /Dinlenme günü/,
  );
  assert.match(
    await page.locator(".tp-day").nth(2).getAttribute("aria-label"),
    /Planlanmadı/,
  );
  await shot("S02-rest-versus-unconfigured-desktop.png");
  pass(
    "Intentional rest and unconfigured dates have distinct text and visual states",
  );
  await page.locator(".tp-day").nth(0).click();
  await page.getByText("Gün işlemleri · Çoğalt", { exact: true }).click();
  await label("Günü çoğaltma tarihi").fill(date(2));
  await click("Günü çoğalt");
  for (const n of [3, 4, 5, 6]) {
    await page.locator(".tp-day").nth(n).click();
    await click("Dinlenme günü");
  }
  await label("Hedef hafta").selectOption("1");
  await click("Haftayı kopyala");
  await label("Hafta").selectOption("1");
  await page.locator(".tp-day").nth(0).click();
  await page
    .locator(".tp-scheduled")
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  await label("Antrenman adı").fill("Üst Gövde B · İlerleme");
  await label("Set").fill("5");
  await shot("S01-selected-week-day-workout-desktop.png");
  await click("Güne uygula");
  await click("Taslağı kaydet");
  await page.getByText("Taslak kaydedildi.", { exact: true }).waitFor();
  let source = (await api(trainer, "/coaching/overview")).plans.find(
    (p) => p.content.name === "Kuvvet ve Denge · Ada",
  );
  assert.equal(
    source.content.days.find((d) => d.dates.includes(start)).exercises[0].sets,
    4,
  );
  assert.equal(
    source.content.days.find((d) => d.dates.includes(date(7))).exercises[0]
      .sets,
    5,
  );
  await shot("S04-saved-draft.png");
  pass("Four-week draft persists independent copied-week targets");
  await click("Yayınla");
  await page
    .getByRole("dialog", { name: "Yayınlamadan önce takvimi kontrol et" })
    .waitFor();
  await page.locator(".tp-day-issues").first().locator("summary").click();
  await shot("S05-actionable-incomplete-program.png");
  await page
    .locator(".tp-day-issues")
    .first()
    .getByRole("button")
    .nth(2)
    .click();
  assert.equal(await label("Hafta").inputValue(), "2");
  assert.match(
    await page
      .locator('.tp-day[aria-current="date"]')
      .getAttribute("aria-label"),
    new RegExp(date(16)),
  );
  assert.equal(
    (await api(trainer, "/coaching/overview")).plans.find(
      (p) => p.id === source.id,
    ).content.planning_status,
    "draft",
  );
  pass("Validation links open the exact missing week/day without publishing");
  await label("Hafta").selectOption("0");
  for (const week of [2, 3]) {
    await label("Hedef hafta").selectOption(String(week));
    await click("Haftayı kopyala");
  }
  await click("Yayınla");
  await page
    .getByText("Program yayınlandı. Üyelere atayabilirsin.", { exact: true })
    .waitFor();
  await page.locator(".tp-day").nth(0).click();
  await shot("S06-published-four-week-program.png");
  await label("Amaç").fill("Henüz yayınlanmamış yeni amaç");
  assert.equal(await button("Üyelere ata").isEnabled(), false);
  assert.match(
    await page.locator(".tp-publication-state").innerText(),
    /Yayınlanmamış değişiklikler/,
  );
  await shot("S07-unpublished-changes.png");
  await click("Üye önizlemesi");
  assert.match(
    await page.getByRole("dialog").innerText(),
    /Kaydedilmemiş düzenlemelerin önizlemesi/,
  );
  await click("Pencereyi kapat");
  assert.equal(
    (await api(trainer, "/coaching/overview")).plans.find(
      (p) => p.id === source.id,
    ).content.goal,
    "Kontrollü güç ve düzenli antrenman",
  );
  await label("Amaç").fill("Kontrollü güç ve düzenli antrenman");
  await click("Yayınla");
  await page
    .getByText("Program yayınlandı. Üyelere atayabilirsin.", { exact: true })
    .waitFor();
  pass(
    "Draft, published and local unpublished edits remain separate; preview does not publish",
  );
  await click("Üyelere ata");
  await chooseMember("Ada Yılmaz");
  const confirmation = await page.getByRole("dialog").innerText();
  assert(
    confirmation.includes("Ada Yılmaz") &&
      confirmation.includes(start) &&
      confirmation.includes("Kuvvet ve Denge"),
  );
  await shot("S08-assignment-final-confirmation.png");
  await click("1 üyeye atamayı onayla");
  await page
    .getByText("Program seçilen üyelere atandı.", { exact: false })
    .waitFor();
  let adaPlan = (await api(ada, "/coaching/overview")).plans.find(
    (p) => p.template_id === source.id,
  );
  assert(adaPlan);
  const assignedBefore = structuredClone(adaPlan);
  await label("Hafta").selectOption("1");
  await page.locator(".tp-day").nth(0).click();
  await page
    .locator(".tp-scheduled")
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  await label("Set").fill("6");
  await click("Güne uygula");
  await click("Yayınla");
  await page
    .getByText("Program yayınlandı. Üyelere atayabilirsin.", { exact: true })
    .waitFor();
  assert.deepEqual(
    (await api(ada, "/coaching/overview")).plans.find(
      (p) => p.id === adaPlan.id,
    ),
    assignedBefore,
  );
  pass(
    "Publishing a template revision never overwrites its existing member assignment",
  );
  const emreContent = {
    name: "Temel Kuvvet · Emre",
    goal: "Teknik ve tutarlı set kaydı",
    difficulty: "beginner",
    weeks: 1,
    start_date: start,
    timezone: "Europe/Istanbul",
    planning_status: "published",
    rest_dates: [1, 2, 3, 4, 5, 6].map(date),
    days: [
      {
        id: crypto.randomUUID(),
        name: "Temel Kuvvet · Tam Hedef",
        dates: [start],
        exercises: [
          {
            id: crypto.randomUUID(),
            exercise_id: "lib-bench-press",
            sets: 4,
            reps: 10,
            kg: 45,
            rest_seconds: 90,
            notes:
              "Üyenin kaydettiği değerler; otomatik tekrar doğrulaması yok.",
          },
        ],
      },
    ],
  };
  const emreSource = await api(trainer, "/coaching/plans", {
    id: crypto.randomUUID(),
    tenant_id: "planning-club",
    content: emreContent,
  });
  await click("Kütüphaneye dön");
  await click("Yenile");
  await namedCard(emreContent.name)
    .getByRole("button", { name: "Üyelere ata", exact: true })
    .click();
  await chooseMember("Emre Demir");
  await click("1 üyeye atamayı onayla");
  await page
    .getByText("Program seçilen üyelere atandı.", { exact: false })
    .waitFor();
  const emrePlan = (await api(emre, "/coaching/overview")).plans.find(
    (p) => p.template_id === emreSource.id,
  );
  const emreWorkout = await record(emre, emrePlan, 0),
    adaWorkout = await record(ada, adaPlan, 1);
  assert.notEqual(emreWorkout.id, adaWorkout.id);
  assert.notEqual(emreWorkout.athlete_id, adaWorkout.athlete_id);
  await showMember(emrePlan.athlete_id);
  await page
    .locator(
      '.trainer-exercise-progress[data-planned="4"][data-completed="4"][data-extra="0"]',
    )
    .waitFor();
  await shot("S13-emre-progress-4-of-4.png", true);
  pass("Distinct Emre workout displays planned 4, completed 4, extra 0");
  await label("Üye seç").selectOption(adaPlan.athlete_id);
  await page
    .locator(
      '.trainer-exercise-progress[data-planned="4"][data-completed="5"][data-extra="1"]',
    )
    .waitFor();
  await shot("S14-ada-progress-5-of-4-extra-1.png", true);
  assert.notDeepEqual(
    fs.readFileSync(path.join(shots, "S13-emre-progress-4-of-4.png")),
    fs.readFileSync(path.join(shots, "S14-ada-progress-5-of-4-extra-1.png")),
  );
  pass(
    "Distinct Ada workout displays planned 4, completed 5 and +1 extra in a separate screenshot",
  );
  const futureContent = structuredClone(adaPlan.content);
  futureContent.days.find((d) =>
    d.dates.some((dt) => dt > start),
  ).exercises[0].reps = 9;
  adaPlan = await api(
    trainer,
    "/coaching/plans/" + adaPlan.id,
    {
      expected_version: adaPlan.version,
      content: futureContent,
      reason: "Yalnızca gelecekteki hedef ayarı",
    },
    "PATCH",
  );
  assert.deepEqual(
    (await api(ada, "/coaching/overview")).workouts.find(
      (w) => w.id === adaWorkout.id,
    ),
    adaWorkout,
  );
  assert.deepEqual(
    (await api(emre, "/coaching/overview")).workouts.find(
      (w) => w.id === emreWorkout.id,
    ),
    emreWorkout,
  );
  pass(
    "Future member adjustment preserves both completed workouts, targets and actual sets",
  );
  await label("Üye seç").selectOption("");
  await click("Programlar");
  await namedCard("Kuvvet ve Denge · Ada")
    .getByRole("button", { name: "Üyelere ata", exact: true })
    .click();
  await chooseMember("Ada Yılmaz");
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.equal(await button("1 üyeye atamayı onayla").isEnabled(), false);
  assert.match(
    await page.locator(".tp-member-impact").innerText(),
    /Kuvvet ve Denge/,
  );
  await shot("S09-overlap-affected-assignment.png");
  await click("Mevcut programlardan sonra başlat");
  assert.equal(await label("Başlangıç tarihi").inputValue(), date(28));
  await click("Atama özetini incele");
  assert.equal(await button("1 üyeye atamayı onayla").isEnabled(), true);
  await shot("S10-overlap-rescheduled-confirmation.png");
  await click("1 üyeye atamayı onayla");
  await page
    .getByText("Program seçilen üyelere atandı.", { exact: false })
    .waitFor();
  const adaAfter = await api(ada, "/coaching/overview");
  assert(
    adaAfter.plans.some(
      (p) => p.template_id === source.id && p.content.start_date === date(28),
    ),
  );
  assert.deepEqual(
    adaAfter.plans.find((p) => p.id === adaPlan.id),
    adaPlan,
  );
  assert.deepEqual(
    adaAfter.workouts.find((w) => w.id === adaWorkout.id),
    adaWorkout,
  );
  pass(
    "Overlap resolves by a later start date while preserving the original assignment and history",
  );
  await namedCard("Temel Kuvvet · Emre")
    .getByRole("button", { name: "Üyelere ata", exact: true })
    .click();
  await chooseMember("Emre Demir");
  await page
    .getByLabel(
      "Çakışan programları koruyarak bu programı ayrıca eklemeyi onaylıyorum.",
      { exact: true },
    )
    .check();
  await shot("S11-explicit-overlap-coexistence.png");
  await click("1 üyeye atamayı onayla");
  await page
    .getByText("Program seçilen üyelere atandı.", { exact: false })
    .waitFor();
  const emreAfter = await api(emre, "/coaching/overview");
  assert.equal(
    emreAfter.plans.filter((p) => p.template_id === emreSource.id).length,
    2,
  );
  assert.deepEqual(
    emreAfter.plans.find((p) => p.id === emrePlan.id),
    emrePlan,
  );
  assert.deepEqual(
    emreAfter.workouts.find((w) => w.id === emreWorkout.id),
    emreWorkout,
  );
  pass(
    "Explicit coexistence adds an independent copy and keeps existing 4/4 records intact",
  );
  await page.setViewportSize({ width: 375, height: 667 });
  await namedCard("Kuvvet ve Denge · Ada")
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  await label("Hafta").selectOption("1");
  await page.locator(".tp-day").nth(0).click();
  const selectedContext = await page
    .getByRole("region", { name: "Seçili hafta ve gün" })
    .innerText();
  await shot("S12-mobile-week-day-selection.png", true);
  await page
    .locator(".tp-scheduled")
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  assert.match(
    await page.getByRole("region", { name: "Seçili hafta ve gün" }).innerText(),
    /2\. hafta/,
  );
  assert.equal(await page.locator(".tp-target:visible").count(), 1);
  await click("＋ Egzersiz seç");
  await label("Egzersiz ara").fill("Lat Pulldown");
  await page.locator(".tp-library-filters>summary").click();
  const catalog = await api(trainer, "/coaching/library"),
    lat = catalog.find((e) => e.id === "lib-lat-pulldown");
  await label("Kas grubu").selectOption(lat.muscle);
  await label("Ekipman").selectOption(lat.equipment);
  await shot("S15-mobile-exercise-search-filters.png");
  await pick(lat.name);
  assert(await label("Set").evaluate((el) => el === document.activeElement));
  await label("Set").fill("3");
  await label("Tekrar").fill("12");
  if (await label("Ağırlık (kg)").count())
    await label("Ağırlık (kg)").fill("35,5");
  assert.match(
    await page.getByRole("region", { name: "Seçili hafta ve gün" }).innerText(),
    /2\. hafta/,
  );
  assert.equal(await page.locator(".tp-target:visible").count(), 1);
  pass(
    "375px search, filters, selection and focused target editing retain week/day context",
  );
  await label("Set").focus();
  await page.setViewportSize({ width: 375, height: 450 });
  await page.waitForFunction(() => {
    const a = document.activeElement?.getBoundingClientRect(),
      bar = document.querySelector(".tp-savebar")?.getBoundingClientRect(),
      ctx = document.querySelector(".tp-context-bar")?.getBoundingClientRect();
    return (
      a &&
      bar &&
      ctx &&
      a.top >= ctx.bottom &&
      a.bottom < bar.top &&
      bar.bottom <= innerHeight + 1
    );
  });
  await shot("S16-mobile-focused-number-reduced-viewport.png");
  await page.setViewportSize({ width: 375, height: 667 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await click("Şablon olarak kaydet");
  await page
    .getByText("Antrenman şablonu kaydedildi.", { exact: true })
    .waitFor();
  await click("Güne uygula");
  await click("Yayınla");
  await page
    .getByText("Program yayınlandı. Üyelere atayabilirsin.", { exact: true })
    .waitFor();
  assert.deepEqual(
    (await api(ada, "/coaching/overview")).plans.find(
      (p) => p.id === adaPlan.id,
    ),
    adaPlan,
  );
  pass(
    "Essential 375px edits save/publish without page overflow or reduced-viewport input obstruction",
  );
  const iosTemplate = await api(trainer, "/coaching/workout-templates", {
    id: crypto.randomUUID(),
    tenant_id: "planning-club",
    content: {
      id: crypto.randomUUID(),
      name: "Mobil Teknik · Klavye",
      dates: [start],
      exercises: [
        {
          id: crypto.randomUUID(),
          exercise_id: "lib-bench-press",
          sets: 4,
          reps: 12,
          kg: 20,
          rest_seconds: 60,
          notes: "Gerçek iOS sistem klavyesi için ayrı test şablonu.",
        },
      ],
    },
  });
  fs.writeFileSync(
    path.join(output, "precision-ios-template.json"),
    JSON.stringify(iosTemplate, null, 2),
  );
  assert.equal(env.errors.length, 0, env.errors.join("\n"));
  pass("No uncaught JavaScript errors during the precision journey");
  fs.writeFileSync(
    path.join(output, "precision-browser-results.json"),
    JSON.stringify(
      {
        results,
        errors: env.errors,
        consoleMessages: env.consoleMessages,
        networkFailures: env.failures,
      },
      null,
      2,
    ),
  );
  await browser.close();
  process.exit(0);
})().catch(async (e) => {
  console.error(e);
  results.push({
    name: "Precision suite stopped",
    status: "FAIL",
    details: e.stack,
  });
  if (page)
    await page
      .screenshot({
        path: path.join(shots, "precision-failure.png"),
        fullPage: true,
      })
      .catch(() => {});
  fs.writeFileSync(
    path.join(output, "precision-browser-results.json"),
    JSON.stringify(
      {
        results,
        errors: env?.errors,
        consoleMessages: env?.consoleMessages,
        networkFailures: env?.failures,
      },
      null,
      2,
    ),
  );
  if (browser) await browser.close().catch(() => {});
  process.exit(1);
});
