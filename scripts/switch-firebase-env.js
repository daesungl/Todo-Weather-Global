const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const env = process.argv[2];
const allowed = new Set(['dev', 'prod']);

if (!allowed.has(env)) {
  console.error('Usage: node scripts/switch-firebase-env.js <dev|prod>');
  process.exit(1);
}

const copies = [
  {
    from: path.join(root, 'firebase', env, 'GoogleService-Info.plist'),
    to: path.join(root, 'GoogleService-Info.plist'),
  },
  {
    from: path.join(root, 'firebase', env, 'GoogleService-Info.plist'),
    to: path.join(root, 'ios', 'TodoWeather', 'GoogleService-Info.plist'),
  },
  {
    from: path.join(root, 'firebase', env, 'google-services.json'),
    to: path.join(root, 'google-services.json'),
  },
  {
    from: path.join(root, 'firebase', env, 'google-services.json'),
    to: path.join(root, 'android', 'app', 'google-services.json'),
  },
];

for (const { from, to } of copies) {
  if (!fs.existsSync(from)) {
    console.error(`Missing Firebase config: ${path.relative(root, from)}`);
    process.exit(1);
  }
  fs.copyFileSync(from, to);
  console.log(`${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

const envFile = path.join(root, 'src', 'constants', 'FirebaseEnv.js');
fs.writeFileSync(
  envFile,
  `export const FIREBASE_ENV = '${env}';\nexport const IS_FIREBASE_DEV = FIREBASE_ENV === 'dev';\n`
);
console.log(`${env} -> ${path.relative(root, envFile)}`);

const androidConfig = JSON.parse(
  fs.readFileSync(path.join(root, 'firebase', env, 'google-services.json'), 'utf8')
);

console.log(`Firebase environment switched to ${env}`);
console.log(`Project ID: ${androidConfig.project_info?.project_id || 'unknown'}`);
