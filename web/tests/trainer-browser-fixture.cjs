const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const output = path.resolve(__dirname, "../../test-results/trainer-planning");
const shots = path.join(output, "screenshots/precision");
fs.mkdirSync(shots, { recursive: true });
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
    "fixture-only",
  ].join(".");
async function raw(actor, route, body, method) {
  const response = await fetch("http://127.0.0.1:8000/api/console" + route, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: "Bearer " + jwt(actor),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
async function api(actor, route, body, method) {
  const r = await raw(actor, route, body, method);
  assert(r.status < 400, `${r.status} ${route}: ${JSON.stringify(r.data)}`);
  return r.data;
}
async function launch() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "Europe/Istanbul",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [],
    consoleMessages = [],
    failures = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleMessages.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push({ status: r.status(), url: r.url() });
  });
  page.on("dialog", (d) => d.accept());
  return { browser, page, errors, consoleMessages, failures };
}
async function login(page, email) {
  await page.goto("http://127.0.0.1:3000/console");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.locator("input[name=password]").fill("PlanningTestOnly!26");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).waitFor();
}
module.exports = { api, raw, launch, login, output, shots };
