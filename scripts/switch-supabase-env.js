const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const env = process.argv[2];
const allowed = new Set(['dev', 'prod']);

if (!allowed.has(env)) {
  console.error('Usage: node scripts/switch-supabase-env.js <dev|prod>');
  process.exit(1);
}

const configFile = path.join(root, 'supabase', env, 'config.json');
const exampleFile = path.join(root, 'supabase', env, 'config.example.json');

if (!fs.existsSync(configFile)) {
  const hint = fs.existsSync(exampleFile)
    ? ` Create ${path.relative(root, configFile)} from ${path.relative(root, exampleFile)}.`
    : '';
  console.error(`Missing Supabase config: ${path.relative(root, configFile)}.${hint}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const required = ['projectRef', 'url', 'anonKey', 'planBackend'];
const missing = required.filter(key => !config[key] || String(config[key]).startsWith('YOUR_'));

if (missing.length > 0) {
  console.error(`Supabase ${env} config has missing values: ${missing.join(', ')}`);
  process.exit(1);
}

const envFile = path.join(root, '.env');
const existing = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const lines = existing.split(/\r?\n/).filter(Boolean);
const next = new Map();

for (const line of lines) {
  const index = line.indexOf('=');
  if (index <= 0) continue;
  next.set(line.slice(0, index), line.slice(index + 1));
}

next.set('EXPO_PUBLIC_PLAN_BACKEND', config.planBackend);
next.set('EXPO_PUBLIC_SUPABASE_URL', config.url);
next.set('EXPO_PUBLIC_SUPABASE_ANON_KEY', config.anonKey);

const output = `${Array.from(next.entries()).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
fs.writeFileSync(envFile, output);
console.log(`${env} -> ${path.relative(root, envFile)}`);

const constantsDir = path.join(root, 'src', 'constants');
if (!fs.existsSync(constantsDir)) fs.mkdirSync(constantsDir, { recursive: true });

const envConstFile = path.join(constantsDir, 'SupabaseEnv.js');
fs.writeFileSync(
  envConstFile,
  `export const SUPABASE_ENV = '${env}';\nexport const SUPABASE_PROJECT_REF = '${config.projectRef}';\nexport const SUPABASE_CONFIG_URL = '${config.url}';\nexport const SUPABASE_CONFIG_ANON_KEY = '${config.anonKey}';\nexport const SUPABASE_PLAN_BACKEND = '${config.planBackend}';\nexport const IS_SUPABASE_DEV = SUPABASE_ENV === 'dev';\n`
);
console.log(`${env} -> ${path.relative(root, envConstFile)}`);

const firebaseDir = path.join(root, 'firebase', env);
const firebaseFiles = [
  ['GoogleService-Info.plist', ['GoogleService-Info.plist', path.join('ios', 'TodoWeather', 'GoogleService-Info.plist')]],
  ['google-services.json', ['google-services.json', path.join('android', 'app', 'google-services.json')]],
];

if (fs.existsSync(firebaseDir)) {
  for (const [sourceName, targetNames] of firebaseFiles) {
    const source = path.join(firebaseDir, sourceName);
    if (fs.existsSync(source)) {
      for (const targetName of targetNames) {
        const target = path.join(root, targetName);
        if (!fs.existsSync(path.dirname(target))) continue;
        fs.copyFileSync(source, target);
        console.log(`${env} -> ${path.relative(root, target)}`);
      }
    }
  }
}

console.log(`Supabase environment switched to ${env}`);
console.log(`Project ref: ${config.projectRef}`);
