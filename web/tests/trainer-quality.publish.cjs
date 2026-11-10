const { api, launch, login } = require("./trainer-browser-fixture.cjs"),
  assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
const out = path.resolve(
    __dirname,
    "../../test-results/trainer-quality-recovery",
  ),
  results = [];
let page, browser;
const pass = (name) => {
  results.push({ name, status: "PASS" });
  console.log("PASS", name);
};
(async () => {
  const e = await launch();
  ({ page, browser } = e);
  await login(page, "trainer@planning.test");
  await page.getByRole("button", { name: "Programlar", exact: true }).waitFor();
  const rows = (await api("trainer@planning.test", "/coaching/overview")).plans,
    source = rows.find(
      (p) =>
        !p.athlete_id &&
        p.content.name.startsWith("Kalite İncelemesi") &&
        p.content.planning_status === "published",
    );
  assert(source);
  const copies = structuredClone(
    rows.filter((p) => p.template_id === source.id),
  );
  await page.getByRole("button", { name: "Programlar", exact: true }).click();
  await page
    .locator(".tp-program-card")
    .filter({
      has: page.getByRole("heading", {
        name: source.content.name,
        exact: true,
      }),
    })
    .filter({ hasText: "Program şablonu" })
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  await page.locator(".tp-settings>summary").click();
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", {
      name: "Yayından kaldır ve taslağı kaydet",
      exact: true,
    })
    .click();
  let actual = (
    await api("trainer@planning.test", "/coaching/overview")
  ).plans.find((p) => p.id === source.id);
  assert.equal(actual.version, source.version);
  assert.equal(actual.content.planning_status, "published");
  pass(
    "Cancelling explicit unpublish/draft confirmation changes no persisted version or publication",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "Yayından kaldır ve taslağı kaydet",
      exact: true,
    })
    .click();
  await page.locator(".tp-save-state[data-save-state=saved]").waitFor();
  actual = (
    await api("trainer@planning.test", "/coaching/overview")
  ).plans.find((p) => p.id === source.id);
  assert.equal(actual.content.planning_status, "draft");
  assert.match(
    await page.locator(".tp-save-state").innerText(),
    /yayında değil/,
  );
  await page.screenshot({
    path: path.join(
      out,
      "refinements/08-explicitly-unpublished-saved-draft.png",
    ),
  });
  const after = (await api("trainer@planning.test", "/coaching/overview"))
    .plans;
  assert.deepEqual(
    after.filter((p) => p.template_id === source.id),
    copies,
  );
  await page.getByRole("button", { name: "Yayınla", exact: true }).click();
  await page.locator(".tp-save-state[data-save-state=published]").waitFor();
  pass(
    "Explicit draft save unpublishes only source, says what changed, preserves member copies and can republish",
  );
  await page
    .getByRole("button", { name: "Kütüphaneye dön", exact: true })
    .click();
  await page.getByRole("button", { name: "Üyelerim", exact: true }).click();
  const link = (
    await api("trainer@planning.test", "/coaching/overview")
  ).links.find((l) => l.name === "Emre Demir");
  await page
    .getByLabel("Üye seç", { exact: true })
    .selectOption(link.athlete_id);
  await page.locator(".trainer-workout-progress").first().waitFor();
  await page
    .getByText("Antrenman ve gelişim filtreleri", { exact: true })
    .click();
  await page.getByLabel("Başlangıç", { exact: true }).fill("2035-01-01");
  assert.equal(await page.locator(".trainer-workout-progress").count(), 0);
  assert.match(
    await page.locator(".trainer-recent-history").innerText(),
    /filtrelerde antrenman kaydı yok|Henüz antrenman kaydı yok/,
  );
  await page.screenshot({
    path: path.join(out, "refinements/09-filtered-progress-empty-state.png"),
  });
  pass(
    "Empty filtered progress shows explicit no-record state instead of invented set/performance values",
  );
  fs.writeFileSync(
    path.join(out, "publication-results.json"),
    JSON.stringify({ results, errors: e.errors }, null, 2),
  );
  assert.equal(e.errors.length, 0);
  await browser.close();
})().catch(async (err) => {
  console.error(err);
  results.push({ name: err.message, status: "FAIL" });
  fs.writeFileSync(
    path.join(out, "publication-results.json"),
    JSON.stringify({ results }, null, 2),
  );
  if (page)
    await page
      .screenshot({
        path: path.join(out, "diagnostics/publication-failure.png"),
      })
      .catch(() => {});
  await browser?.close();
  process.exit(1);
});
