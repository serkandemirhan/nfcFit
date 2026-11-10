// Requires the dedicated precision fixture and an active Appium Safari session saved in precision-ios-session.json.
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const path = require("node:path");
const root =
  process.env.TRAINER_KEYBOARD_OUTPUT ||
  path.resolve(__dirname, "../../test-results/trainer-planning");
const session = JSON.parse(
  fs.readFileSync(root + "/precision-ios-session.json"),
).value.sessionId;
const base = "http://127.0.0.1:4723/session/" + session;
async function req(route, body, method) {
  const r = await fetch(base + route, {
    method: method || (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json();
  if (!r.ok) throw Error(JSON.stringify(j));
  return j.value;
}
const js = (script) => req("/execute/sync", { script, args: [] });
async function wait(script) {
  for (let i = 0; i < 40; i++) {
    if (await js(script)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("wait failed " + script);
}
async function click(css) {
  const e = await req("/element", { using: "css selector", value: css });
  return req(
    "/element/" + e["element-6066-11e4-a52e-4f735466cecf"] + "/click",
    {},
  );
}
(async () => {
  const { api: fixtureApi } = require("./trainer-browser-fixture.cjs");
  const fixtures = await fixtureApi(
    "trainer@planning.test",
    "/coaching/workout-templates?tenant_id=planning-club",
  );
  const fixture = fixtures.find(
    (t) => t.content.name === "Mobil Teknik · Klavye",
  );
  fixture.content.exercises[0].sets = 4;
  fixture.content.exercises[0].kg = 20;
  await fixtureApi("trainer@planning.test", "/coaching/workout-templates", {
    id: fixture.id,
    tenant_id: fixture.tenant_id,
    expected_version: fixture.version,
    content: fixture.content,
  });
  const currentContext = await req("/context");
  const initialContexts =
    currentContext !== "NATIVE_APP"
      ? ["NATIVE_APP", currentContext]
      : await req("/contexts");
  console.log("SESSION", session, initialContexts);
  await req("/context", {
    name: initialContexts.find((c) => c.startsWith("WEBVIEW")),
  });
  await req("/url", { url: "http://127.0.0.1:3000/console" });
  await js("localStorage.clear(); location.reload();");
  await wait('return !!document.querySelector("input[name=password]")');
  await js(
    `for(const [el,v] of [[document.querySelector('input[type=email]'),'trainer@planning.test'],[document.querySelector('input[name=password]'),'PlanningTestOnly!26']]){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('form button').click();`,
  );
  await wait(
    `return [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Antrenmanlar')`,
  );
  await js(
    ` [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Antrenmanlar').click();`,
  );
  await wait(
    `return [...document.querySelectorAll('article')].some(e=>e.textContent.includes('Mobil Teknik · Klavye'))`,
  );
  await js(
    ` [...document.querySelectorAll('article')].find(e=>e.textContent.includes('Mobil Teknik · Klavye')).querySelector('button').click();`,
  );
  await wait(`return !!document.querySelector('.tp-target.selected input')`);
  await js(
    `document.querySelector('.tp-target.selected input').scrollIntoView({block:'center'})`,
  );
  await click(".tp-target.selected input");
  const webContext = await req("/context");
  await req("/context", { name: "NATIVE_APP" });
  const nativeSet = await req("/element", {
    using: "-ios predicate string",
    value: 'type == "XCUIElementTypeTextField" AND value == "4"',
  });
  const nativeSetId = nativeSet["element-6066-11e4-a52e-4f735466cecf"];
  await req("/element/" + nativeSetId + "/click", {});
  await req("/element/" + nativeSetId + "/clear", {});
  const key = await req("/element", {
    using: "-ios predicate string",
    value:
      '(type == "XCUIElementTypeKey" OR type == "XCUIElementTypeButton") AND (label == "5" OR name == "5")',
  });
  await req(
    "/element/" + key["element-6066-11e4-a52e-4f735466cecf"] + "/click",
    {},
  );
  await req("/context", { name: webContext });
  await wait(
    'return document.querySelector(".tp-target.selected input").value === "5"',
  );
  assert(
    await js(
      'return document.activeElement === document.querySelector(".tp-target.selected input")',
    ),
    "Native key must edit the Set field",
  );
  await new Promise((r) => setTimeout(r, 1800));
  const contexts = ["NATIVE_APP", webContext];
  const web = await req("/context");
  const geometry = await js(
    `const i=document.activeElement.getBoundingClientRect(),b=document.querySelector('.tp-savebar').getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,input:{top:i.top,bottom:i.bottom},bar:{top:b.top,bottom:b.bottom},viewport:{top:visualViewport.offsetTop,height:visualViewport.height},active:document.activeElement.outerHTML}`,
  );
  await req("/context", { name: "NATIVE_APP" });
  const keyboard = await req("/element", {
    using: "class name",
    value: "XCUIElementTypeKeyboard",
  });
  const rect = await req(
    "/element/" + keyboard["element-6066-11e4-a52e-4f735466cecf"] + "/rect",
  );
  fs.writeFileSync(
    root + "/screenshots/precision/S17-ios-system-numeric-keyboard.png",
    Buffer.from(await req("/screenshot"), "base64"),
  );
  fs.writeFileSync(
    root + "/precision-ios-keyboard-results.json",
    JSON.stringify(
      {
        device: "iPhone SE (3rd generation)",
        os: "iOS 17.2 simulator",
        contexts,
        keyboard: rect,
        geometry,
      },
      null,
      2,
    ),
  );
  assert.equal(geometry.width, 375);
  assert(geometry.scrollWidth <= 375);
  assert(geometry.input.bottom <= geometry.bar.top);
  assert(
    geometry.bar.bottom <= geometry.viewport.top + geometry.viewport.height + 2,
  );
  await req("/context", { name: web });
  await js(
    `document.querySelector('.tp-savebar button').dataset.iosSave='true'`,
  );
  await click("[data-ios-save]");
  await wait(
    `return !!document.querySelector('.tp-save-state[data-save-state=saved]') || document.body.textContent.includes('Antrenman şablonu kaydedildi.')`,
  );
  const { api } = require("./trainer-browser-fixture.cjs");
  const templates = await api(
    "trainer@planning.test",
    "/coaching/workout-templates?tenant_id=planning-club",
  );
  assert.equal(
    templates.find((t) => t.content.name === "Mobil Teknik · Klavye").content
      .exercises[0].sets,
    5,
  );
  assert.equal(
    templates.find((t) => t.content.name === "Mobil Teknik · Klavye").content
      .exercises[0].kg,
    20,
  );
  const evidence = JSON.parse(
    fs.readFileSync(root + "/precision-ios-keyboard-results.json"),
  );
  evidence.status = "PASS";
  evidence.nativeKeyPressed = "5";
  evidence.savedSets = 5;
  evidence.savedWeightKg = 20;
  fs.writeFileSync(
    root + "/precision-ios-keyboard-results.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log("PASS saved 5 sets through real iOS keyboard and real API");
  console.log(
    "PASS genuine native keyboard and visible numeric input/save controls",
    JSON.stringify(geometry),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
