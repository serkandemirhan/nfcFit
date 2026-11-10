const { api, launch, login } = require("./trainer-browser-fixture.cjs"),
  fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
(async () => {
  const out = path.resolve(
      __dirname,
      "../../test-results/trainer-panel-completion",
    ),
    env = await launch(),
    { page, browser } = env;
  try {
    await login(page, "trainer@planning.test");
    await page.getByRole("button", { name: "Üyelerim", exact: true }).waitFor();
    await page.getByRole("button", { name: "Üyelerim", exact: true }).click();
    const before = await api("member@planning.test", "/coaching/overview");
    await page
      .getByLabel("Üye seç", { exact: true })
      .selectOption(before.account_id);
    await page.locator(".trainer-workout-progress").first().waitFor();
    const archive = page.locator(".trainer-scheduled-programs");
    assert.equal(await archive.getAttribute("open"), null);
    const count = await archive.locator(".trainer-scheduled-row").count();
    assert(count > 0);
    const recordCount = await page.locator(".trainer-workout-progress").count();
    await archive.locator(":scope>summary").click();
    assert((await archive.getAttribute("open")) !== null);
    await page.screenshot({
      path: path.join(out, "refinements/10-explicit-future-programs.png"),
      fullPage: false,
    });
    await archive
      .getByRole("button", { name: "Gelecek planı düzenle", exact: true })
      .first()
      .click();
    await page.getByText("ÜYEYE ÖZEL PROGRAM", { exact: true }).waitFor();
    assert.equal(await page.locator(".tp[data-view=program]").count(), 1);
    assert.deepEqual(
      (await api("member@planning.test", "/coaching/overview")).workouts,
      before.workouts,
    );
    assert.equal(env.errors.length, 0);
    fs.writeFileSync(
      path.join(out, "scheduled-results.json"),
      JSON.stringify(
        {
          status: "PASS",
          scheduledRows: count,
          completedRecords: recordCount,
          defaultCollapsed: true,
          futureEditorAccessible: true,
          actualsUnchanged: true,
          errors: env.errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS future programs start collapsed, open on request, keep future editing accessible and preserve all member actuals",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
