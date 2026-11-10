const { api, launch, login } = require("./trainer-browser-fixture.cjs"),
  assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
const out = path.resolve(
    __dirname,
    "../../test-results/trainer-quality-recovery",
  ),
  shots = path.join(out, "refinements");
fs.mkdirSync(shots, { recursive: true });
let page, browser, env;
const results = [];
const b = (n) => page.getByRole("button", { name: n, exact: true }),
  f = (n) => page.getByLabel(n, { exact: true }),
  click = (n) => b(n).click();
const pass = (n) => {
  results.push({ name: n, status: "PASS" });
  console.log("PASS", n);
};
const shot = async (n) => {
  await page.screenshot({ path: path.join(shots, n + ".png") });
  console.log("SHOT", n);
};
const open = async (selector) => {
  const d = page.locator(selector).first();
  if ((await d.getAttribute("open")) === null)
    await d.locator(":scope>summary").click();
};
(async () => {
  env = await launch();
  ({ page, browser } = env);
  await login(page, "trainer@planning.test");
  await b("Programlar").waitFor();
  await click("Programlar");
  await open(".tp-more-filters");
  await f("Seviye filtresi").selectOption("beginner");
  await f("Program ara").fill("Kuvvet ve Denge");
  await click("Filtreleri temizle");
  assert.equal(await f("Seviye filtresi").inputValue(), "");
  assert.equal(await f("Program ara").inputValue(), "Kuvvet ve Denge");
  pass("Optional program filters clear independently from search");
  const source = (
    await api("trainer@planning.test", "/coaching/overview")
  ).plans.find(
    (p) => !p.athlete_id && p.content.name === "Kuvvet ve Denge · Ada",
  );
  const before = structuredClone(source);
  const card = page
    .locator(".tp-program-card")
    .filter({
      has: page.getByRole("heading", {
        name: source.content.name,
        exact: true,
      }),
    })
    .filter({ hasText: "Program şablonu" });
  await card.getByRole("button", { name: "Düzenle", exact: true }).click();
  await click("Üye önizlemesi");
  assert.equal(await page.locator("dialog .tp-preview-week").count(), 4);
  assert.equal(await page.locator("dialog .tp-preview-week[open]").count(), 1);
  await page
    .locator("dialog .tp-preview-week")
    .nth(3)
    .locator("summary")
    .click();
  await shot("01-selected-week-preview-desktop");
  await click("Pencereyi kapat");
  assert.deepEqual(
    (await api("trainer@planning.test", "/coaching/overview")).plans.find(
      (p) => p.id === source.id,
    ),
    before,
  );
  pass(
    "Preview expands selected week, reveals other weeks and never publishes/mutates",
  );
  await page
    .locator(".tp-scheduled")
    .first()
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  const widthBefore = await page
    .locator(".tp-workspace>main")
    .evaluate((e) => e.getBoundingClientRect().width);
  await page.locator(".tp-summary>summary").click();
  assert(
    (await page
      .locator(".tp-workspace>main")
      .evaluate((e) => e.getBoundingClientRect().width)) > widthBefore,
  );
  pass("Collapsing optional desktop summary expands dominant editor");
  await page.locator(".tp-target-title").nth(1).click();
  await page
    .locator(".tp-target.selected")
    .getByRole("button", { name: "Egzersizi yukarı taşı", exact: true })
    .click();
  assert.match(await page.locator(".tp-edit-feedback").innerText(), /sıra/);
  const id = await page
    .locator(".tp-target.selected")
    .getAttribute("data-target-id");
  await click("Egzersizi kaldır");
  await page.getByRole("dialog", { name: "Egzersizi kaldır?" }).waitFor();
  await shot("02-safe-removal");
  await click("Vazgeç");
  assert.equal(await page.locator(`[data-target-id="${id}"]`).count(), 1);
  await click("Egzersizi kaldır");
  await click("Kaldırmayı onayla");
  assert.equal(await page.locator(`[data-target-id="${id}"]`).count(), 0);
  await click("Kaldırmayı geri al");
  assert.equal(await page.locator(`[data-target-id="${id}"]`).count(), 1);
  pass(
    "Reordering reports position; cancellation and undo preserve exercise ID/targets",
  );
  await login(page, "trainer@planning.test");
  await b("Programlar").waitFor();
  await click("Programlar");
  await click("＋ Program oluştur");
  await f("Program adı").fill("Eksik Takvim · Görsel Kontrol");
  await click("＋ Antrenman ekle");
  await f("Antrenman adı").fill("Tek Gün · 3×10");
  await f("Egzersiz ara").fill("Bench press");
  await click("Bench press egzersizini ekle");
  await click("Güne uygula");
  await click("Yayınla");
  await page
    .getByRole("dialog", { name: "Yayınlamadan önce takvimi kontrol et" })
    .waitFor();
  await page.locator(".tp-day-issues").nth(1).locator("summary").click();
  await shot("03-incomplete-validation-1440x900");
  await page.setViewportSize({ width: 375, height: 667 });
  await shot("04-incomplete-validation-375x667");
  const g = await b("Bu takvimle yayınla").boundingBox();
  assert(g.y + g.height <= 667);
  assert(await b("Bu takvimle yayınla").isDisabled());
  await page
    .locator(".tp-day-issues")
    .nth(1)
    .getByRole("button")
    .first()
    .click();
  assert.equal(
    await page.locator(".tp").getAttribute("data-program-view"),
    "day",
  );
  assert.match(
    await page.getByRole("region", { name: "Seçili hafta ve gün" }).innerText(),
    /2. hafta/,
  );
  pass(
    "Incomplete review has visible reserved footer and exact mobile day links; rest is intentional",
  );
  await login(page, "trainer@planning.test");
  await b("Programlar").waitFor();
  await click("Programlar");
  const sc = page
    .locator(".tp-program-card")
    .filter({
      has: page.getByRole("heading", {
        name: source.content.name,
        exact: true,
      }),
    })
    .filter({ hasText: "Program şablonu" });
  await sc.getByRole("button", { name: "Çoğalt", exact: true }).click();
  await click("Genel bakış");
  const mobileName = "Mobil Düzenleme · " + Date.now().toString().slice(-6);
  await f("Program adı").fill(mobileName);
  await click("Hafta");
  await page.locator(".tp-day").nth(0).click();
  assert.equal(
    await page.locator(".tp").getAttribute("data-program-view"),
    "day",
  );
  await shot("05-mobile-selected-day");
  await page
    .locator(".tp-scheduled")
    .first()
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  await click("＋ Egzersiz seç");
  await f("Egzersiz ara").fill("Lat");
  await open(".tp-library-filters");
  await f("Kas grubu").selectOption("back");
  await f("Ekipman").selectOption("cable");
  await shot("06-mobile-search-filters");
  await click("Lat çekiş egzersizini ekle");
  assert(await f("Set").evaluate((e) => e === document.activeElement));
  await f("Set").fill("");
  assert.equal(await f("Set").inputValue(), "");
  await click("Şablon olarak kaydet");
  await page.locator(".tp-save-state[data-save-state=failed]").waitFor();
  await f("Set").fill("3");
  await f("Tekrar").fill("12");
  await f("Ağırlık (kg)").fill("35,5");
  await f("Dinlenme (sn)").fill("75");
  await click("Güne uygula");
  await click("Taslağı kaydet");
  await page.locator(".tp-save-state[data-save-state=saved]").waitFor();
  let saved = (
    await api("trainer@planning.test", "/coaching/overview")
  ).plans.find((p) => p.content.name === mobileName);
  assert.equal(saved.content.days[0].exercises.at(-1).kg, 35.5);
  await page.reload();
  await b("Programlar").waitFor();
  await click("Programlar");
  await page
    .locator(".tp-program-card")
    .filter({
      has: page.getByRole("heading", { name: mobileName, exact: true }),
    })
    .filter({ hasText: "Program şablonu" })
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  await click("Seçili gün");
  await page
    .locator(".tp-scheduled")
    .first()
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  await f("Düzenlenen egzersiz").selectOption(
    saved.content.days[0].exercises.at(-1).id,
  );
  assert.equal(await f("Ağırlık (kg)").inputValue(), "35.5");
  await page.setViewportSize({ width: 375, height: 450 });
  await f("Set").focus();
  await shot("07-mobile-reduced-viewport-target");
  const rect = await f("Set").boundingBox(),
    bar = await page.locator(".tp-savebar").boundingBox();
  assert(rect.y + rect.height <= bar.y);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    375,
  );
  pass(
    "375px focused mobile views/search/numeric edits persist after reload without horizontal overflow or reduced-viewport input obstruction",
  );
  assert.deepEqual(
    (await api("trainer@planning.test", "/coaching/overview")).plans.find(
      (p) => p.id === source.id,
    ),
    before,
  );
  pass("Source template remains unchanged by copied-program mobile edits");
  assert.equal(env.errors.length, 0);
  pass("No uncaught JavaScript errors during refinement cases");
  fs.writeFileSync(
    path.join(out, "refinement-results.json"),
    JSON.stringify({ results, errors: env.errors }, null, 2),
  );
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  results.push({ name: e.message, status: "FAIL" });
  fs.writeFileSync(
    path.join(out, "refinement-results.json"),
    JSON.stringify({ results }, null, 2),
  );
  if (page)
    await page
      .screenshot({
        path: path.join(out, "diagnostics/refinement-failure.png"),
      })
      .catch(() => {});
  await browser?.close();
  process.exit(1);
});
