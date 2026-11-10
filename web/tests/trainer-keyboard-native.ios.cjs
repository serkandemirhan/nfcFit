/* Native Safari accessibility + real iOS keyboard. Does not depend on Web Inspector. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const { api } = require("./trainer-browser-fixture.cjs");
const out =
  process.env.TRAINER_KEYBOARD_OUTPUT ||
  path.resolve(
    __dirname,
    "../../test-results/trainer-quality-recovery/keyboard",
  );
const session = JSON.parse(
    fs.readFileSync(path.join(out, "native-session.json")),
  ).value.sessionId,
  base = "http://127.0.0.1:4723/session/" + session;
const elementId = (e) => e["element-6066-11e4-a52e-4f735466cecf"];
async function req(route, body) {
  const r = await fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const j = await r.json();
  if (!r.ok) throw Error(JSON.stringify(j));
  return j.value;
}
const find = (value, using = "-ios predicate string") =>
  req("/element", { using, value });
const named = (name) =>
  find('type == "XCUIElementTypeButton" AND name == ' + JSON.stringify(name));
const click = (e) => req("/element/" + elementId(e) + "/click", {}),
  rect = (e) => req("/element/" + elementId(e) + "/rect");
async function wait(fn) {
  let error;
  for (let i = 0; i < 25; i++) {
    try {
      return await fn();
    } catch (e) {
      error = e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw error;
}
async function tapVisible(e) {
  for (let n = 0; n < 5; n++) {
    const r = await rect(e);
    if (r.y >= 20 && r.y + r.height < 570) break;
    await req("/execute/sync", {
      script: "mobile: swipe",
      args: [{ direction: "up" }],
    });
  }
  await click(e);
}
(async () => {
  const templates = await api(
      "trainer@planning.test",
      "/coaching/workout-templates?tenant_id=planning-club",
    ),
    t = templates.find((t) => t.content.name === "Mobil Teknik · Klavye");
  t.content.exercises[0].sets = 4;
  t.content.exercises[0].kg = 20;
  await api("trainer@planning.test", "/coaching/workout-templates", {
    id: t.id,
    tenant_id: t.tenant_id,
    expected_version: t.version,
    content: t.content,
  });
  console.log("Native Safari session", session);
  let login = false;
  try {
    await named("Giriş yap");
    login = true;
  } catch {}
  if (login) {
    const email = await find(
      "//XCUIElementTypeWebView//XCUIElementTypeTextField",
      "xpath",
    );
    await click(email);
    await req("/element/" + elementId(email) + "/value", {
      text: "trainer@planning.test",
    });
    const password = await find('type == "XCUIElementTypeSecureTextField"');
    await click(password);
    await req("/element/" + elementId(password) + "/value", {
      text: "PlanningTestOnly!26",
    });
    await click(await named("Giriş yap"));
  }
  await click(await wait(() => named("Antrenmanlar")));
  const edit = await wait(() =>
    find(
      '//XCUIElementTypeStaticText[@name="Mobil Teknik · Klavye"]/ancestor::XCUIElementTypeOther[.//XCUIElementTypeButton[@name="Antrenmanı düzenle"]][1]//XCUIElementTypeButton[@name="Antrenmanı düzenle"]',
      "xpath",
    ),
  );
  await tapVisible(edit);
  const sets = await wait(() =>
    find('type == "XCUIElementTypeTextField" AND value == "4"'),
  );
  await tapVisible(sets);
  await req("/element/" + elementId(sets) + "/clear", {});
  const key = await wait(() =>
    find(
      '(type == "XCUIElementTypeKey" OR type == "XCUIElementTypeButton") AND (name == "5" OR label == "5")',
    ),
  );
  await click(key);
  const changed = await find(
    'type == "XCUIElementTypeTextField" AND value == "5"',
  );
  const keyboard = await find('type == "XCUIElementTypeKeyboard"'),
    save = await named("Şablon olarak kaydet");
  const geometry = {
    input: await rect(changed),
    save: await rect(save),
    keyboard: await rect(keyboard),
  };
  assert(
    geometry.input.y + geometry.input.height <= geometry.save.y,
    "Input must be above save",
  );
  assert(
    geometry.save.y + geometry.save.height <= geometry.keyboard.y,
    "Save must be above keyboard",
  );
  assert(
    geometry.input.x >= 0 && geometry.input.x + geometry.input.width <= 375,
  );
  assert(geometry.save.x >= 0 && geometry.save.x + geometry.save.width <= 375);
  fs.writeFileSync(
    path.join(out, "screenshots/precision/S17-ios-system-numeric-keyboard.png"),
    Buffer.from(await req("/screenshot"), "base64"),
  );
  await click(save);
  await wait(() =>
    find(
      'type == "XCUIElementTypeStaticText" AND label == "Şablon kaydedildi"',
    ),
  );
  const stored = (
    await api(
      "trainer@planning.test",
      "/coaching/workout-templates?tenant_id=planning-club",
    )
  ).find((x) => x.id === t.id);
  assert.equal(stored.content.exercises[0].sets, 5);
  assert.equal(stored.content.exercises[0].kg, 20);
  fs.writeFileSync(
    path.join(out, "native-keyboard-results.json"),
    JSON.stringify(
      {
        status: "PASS",
        device: "iPhone SE (3rd generation)",
        os: "iOS 17.2 simulator",
        cssWidth: 375,
        nativeKeyPressed: "5",
        beforeSets: 4,
        savedSets: 5,
        savedWeightKg: 20,
        geometry,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS actual iOS key 5 edits 4→5 sets; input/save clear keyboard; persisted API 5 sets/20kg and UI saved status verified",
    JSON.stringify(geometry),
  );
})().catch(async (e) => {
  console.error(e);
  try {
    fs.writeFileSync(
      path.join(out, "native-failure.xml"),
      await req("/source"),
    );
    fs.writeFileSync(
      path.join(out, "native-failure.png"),
      Buffer.from(await req("/screenshot"), "base64"),
    );
  } catch {}
  process.exit(1);
});
