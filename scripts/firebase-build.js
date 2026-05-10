const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const [env, mode, platform, ...passthroughArgs] = process.argv.slice(2);

const expectedProjectId = {
  dev: 'todo-weather-dev',
  prod: 'todo-weather-global',
};

const usage = () => {
  console.error('Usage: node scripts/firebase-build.js <dev|prod> <run|eas> <ios|android> [extra args...]');
  process.exit(1);
};

if (!expectedProjectId[env] || !['run', 'eas'].includes(mode) || !['ios', 'android'].includes(platform)) {
  usage();
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status || 1);
};

const readAndroidProjectId = () => {
  const file = path.join(root, 'google-services.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')).project_info?.project_id;
};

const readIosProjectId = () => {
  const file = path.join(root, 'GoogleService-Info.plist');
  const plist = fs.readFileSync(file, 'utf8');
  const match = plist.match(/<key>PROJECT_ID<\/key>\s*<string>([^<]+)<\/string>/);
  return match?.[1];
};

const assertFirebaseProject = () => {
  const expected = expectedProjectId[env];
  const androidProjectId = readAndroidProjectId();
  const iosProjectId = readIosProjectId();

  if (androidProjectId !== expected || iosProjectId !== expected) {
    console.error('Firebase config mismatch after environment switch.');
    console.error(`Expected: ${expected}`);
    console.error(`Android:  ${androidProjectId || 'unknown'}`);
    console.error(`iOS:      ${iosProjectId || 'unknown'}`);
    process.exit(1);
  }

  console.log(`Firebase project verified: ${expected}`);
};

run('node', ['scripts/switch-firebase-env.js', env]);
run('node', ['scripts/switch-supabase-env.js', env]);
assertFirebaseProject();

if (mode === 'run') {
  run('npx', ['expo', `run:${platform}`, ...passthroughArgs]);
} else {
  run('npx', ['eas', 'build', '--platform', platform, '--profile', 'production', ...passthroughArgs]);
}
