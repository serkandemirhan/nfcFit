// Team IDs are public identifiers, never Apple passwords or signing keys.
const fs = require('node:fs');
const path = require('node:path');
const team = process.argv[2];
if (!/^[A-Z0-9]{10}$/.test(team ?? '')) {
  console.error('Usage: node scripts/configure-ios-links.cjs APPLE_TEAM_ID (10 uppercase letters/digits)');
  process.exit(1);
}
const root = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const identifier = `${team}.${app.expo.ios.bundleIdentifier}`;
const destination = path.resolve(root, '../../web/public/.well-known/apple-app-site-association');
fs.writeFileSync(destination, JSON.stringify({ applinks: { apps: [], details: [{ appID: identifier, paths: ['/tag/*'] }] } }, null, 2) + '\n');
console.log(`AASA configured for ${identifier}. Deploy web and produce a signed iOS build with Associated Domains enabled.`);
