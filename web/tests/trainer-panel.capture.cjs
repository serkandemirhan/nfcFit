const { api, launch, login } = require("./trainer-panel.fixture.cjs");
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const phase = process.argv[2] || "after",
  out = path.resolve(
    __dirname,
    "../../test-results/trainer-panel-completion",
    phase,
  );
fs.mkdirSync(out, { recursive: true });
const sizes = [
  [1440, 900],
  [1280, 800],
  [390, 844],
  [375, 667],
  [412, 915],
];
const trainer = "trainer@planning.test";
(async () => {
  const env = await launch(),
    { page, browser } = env;
  const checks = [];
  page.setDefaultTimeout(45000);
  await login(page, trainer);
  await page.getByRole("button", { name: "Programlar", exact: true }).waitFor();
  const overview = await api(trainer, "/coaching/overview");
  const plan = overview.plans.find(
    (p) => !p.athlete_id && p.content.name === "Kuvvet ve Denge · Ada",
  );
  assert(plan);
  const nav = async (name) => { const target = page.getByRole("button", { name, exact: true }); if (!(await target.isVisible())) await page.getByRole("button", { name: "Menüyü aç", exact: true }).click(); await target.click(); };
  const button = (name) => page.getByRole("button", { name, exact: true });
  const ready = async () => {
    await login(page, trainer);
    await page.locator(".nfc-page-header, .trainer-navigation-row").waitFor();
  };
  const shot = async (name, full = false) => {
    await page.getByText("Yükleniyor…", { exact: true }).waitFor({ state: "hidden" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.activeElement?.blur());
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: path.join(out, name + ".png"),
      fullPage: full,
    });
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const dims = await page.evaluate(() => {
      const rect = (el) =>
        el
          ? {
              top: el.getBoundingClientRect().top,
              bottom: el.getBoundingClientRect().bottom,
              width: el.getBoundingClientRect().width,
            }
          : null;
      const bar = document.querySelector(".tp-savebar");
      const calendar = document.querySelector(".tp-calendar");
      const target = document.querySelector(".tp-target.selected input");
      const editor = document.querySelector(".tp-workspace > main"),
        lib = document.querySelector(".tp-exercise-library");
      const tiny = [
        ...document.querySelectorAll(
          ".trainer-area button,.trainer-shell > header button",
        ),
      ]
        .filter(
          (e) =>
            e.getClientRects().length &&
            e.getBoundingClientRect().width > 0 &&
            e.checkVisibility?.({ checkVisibilityCSS: true }) !== false,
        )
        .map((e) => ({
          text: e.textContent.trim(),
          w: e.getBoundingClientRect().width,
          h: e.getBoundingClientRect().height,
        }))
        .filter((e) => e.w < 43.8 || e.h < 43.8);
      return {
        w: innerWidth,
        h: innerHeight,
        scroll: document.documentElement.scrollWidth,
        bar: rect(bar),
        calendar: rect(calendar),
        target: rect(target),
        editor: rect(editor),
        library: rect(lib),
        tiny,
        visibleTargets: [...document.querySelectorAll(".tp-target")].filter(
          (e) =>
            e.getClientRects().length && getComputedStyle(e).display !== "none",
        ).length,
      };
    });
    assert(dims.scroll <= dims.w, `${name} overflow`);
    if (
      phase === "after" &&
      !name.includes("full") &&
      !name.includes("exercise-search")
    ) {
      if (dims.bar) {
        assert(dims.bar.bottom <= dims.h + 1, `${name}: Save outside viewport`);
        assert(dims.bar.top >= 0, `${name}: Save above viewport`);
      }
      if (name.endsWith("-program") && dims.w >= 768)
        assert(
          dims.calendar.top < dims.h * 0.55,
          `${name}: Calendar below focus area`,
        );
      if (name.endsWith("-workout")) {
        if (dims.w >= 1280) {
          assert(
            dims.editor.width > dims.library.width * 1.7,
            `${name}: Center must dominate`,
          );
          assert(
            dims.editor.bottom <= dims.bar.top,
            `${name}: Editor covered by save`,
          );
        } else if (dims.w < 768)
          assert(
            dims.target.bottom <= dims.bar.top,
            `${name}: Sets covered on mobile`,
          );
      }
      if (dims.w < 768 && name.endsWith("-workout"))
        assert.equal(
          dims.visibleTargets,
          1,
          `${name}: Only selected exercise should be visible`,
        );
      if (dims.w < 768)
        assert.equal(
          dims.tiny.length,
          0,
          `${name}: Small touch targets ${JSON.stringify(dims.tiny)}`,
        );
    }
    checks.push({ name, status: "PASS", ...dims });
    console.log(name);
  };
  const openProgram = async () => {
    await nav("Programlar");
    const card = page
      .locator(".tp-program-card")
      .filter({
        has: page.getByRole("heading", {
          name: plan.content.name,
          exact: true,
        }),
      })
      .filter({ hasText: "Program şablonu" });
    await card.getByRole("button", { name: "Düzenle", exact: true }).click();
    await page.locator(".tp-calendar").waitFor();
  };
  for (const [w, h] of sizes.filter(
    ([w]) => !process.argv[3] || w === Number(process.argv[3]),
  )) {
    await page.setViewportSize({ width: w, height: h });
    const prefix = `${w}x${h}`;
    await ready();
    await page.locator(".trainer-kpis").waitFor();
    await shot(prefix + "-dashboard");
    await nav("Programlar");
    await page.locator(".tp-program-card").first().waitFor();
    await shot(prefix + "-library");
    await ready();
    await openProgram();
    await shot(prefix + "-program");
    if (w === 1440 || w === 375) await shot(prefix + "-program-full", true);
    if (w < 768) {
      await button("Seçili gün").click();
      await shot(prefix + "-selected-day");
    }
    await page
      .locator(".tp-scheduled")
      .first()
      .getByRole("button", { name: "Düzenle", exact: true })
      .click();
    await page.locator(".tp-target.selected").waitFor();
    await shot(prefix + "-workout");
    if (w === 1440 || w === 375) await shot(prefix + "-workout-full", true);
    if (w < 768) {
      await button("＋ Egzersiz seç").click();
      await page.getByLabel("Egzersiz ara", { exact: true }).fill("Lat");
      await shot(prefix + "-exercise-search");
    }
    await ready();
    await openProgram();
    await button("Üyelere ata").click();
    await page
      .locator(".tp-member-picks label")
      .filter({ hasText: "Ada Yılmaz" })
      .getByRole("checkbox")
      .check();
    await button("Atama özetini incele").click();
    await page
      .getByRole("dialog", { name: "Atamayı son kez kontrol et" })
      .waitFor();
    await page
      .getByText("Tarih çakışması · İki program aynı dönemde görünecek", {
        exact: true,
      })
      .first()
      .waitFor();
    await shot(prefix + "-assignment");
    await button("Pencereyi kapat").click();
    await ready();
    await nav("Üyelerim");
    await page
      .getByLabel("Üye seç", { exact: true })
      .selectOption(
        overview.links.find((a) => a.name === "Ada Yılmaz").athlete_id,
      );
    await page.locator(".trainer-workout-progress").first().waitFor();
    await shot(prefix + "-progress");
    if (w === 1440 || w === 375) await shot(prefix + "-progress-full", true);
  }
  fs.writeFileSync(
    path.join(out, "capture-results.json"),
    JSON.stringify({ checks, errors: env.errors }, null, 2),
  );
  assert.equal(env.errors.length, 0);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
