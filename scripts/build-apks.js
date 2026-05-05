#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const readline = require('readline/promises');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const paint = (color, text) => `${colors[color] || ''}${text}${colors.reset}`;

const log = {
  title: (msg) => console.log(paint('bold', msg)),
  info: (msg) => console.log(`${paint('cyan', '•')} ${msg}`),
  step: (msg) => console.log(`${paint('green', '—')} ${msg}`),
  warn: (msg) => console.log(`${paint('yellow', '!')} ${msg}`),
  error: (msg) => console.error(`${paint('red', 'x')} ${msg}`),
  success: (msg) => console.log(`${paint('green', '✓')} ${msg}`),
};

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
};

const normalizeList = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const readPackageVersion = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return pkg.version || '';
  } catch (error) {
    return '';
  }
};

const sanitizeFileName = (value) => value.replace(/[^a-zA-Z0-9._-]+/g, '-');

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const findApkFiles = (dirPath) => {
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...findApkFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.apk')) {
      results.push(fullPath);
    }
  }

  return results;
};

const pickPreferredApk = (apkPaths) => {
  if (apkPaths.length === 0) return null;
  const lower = apkPaths.map((apk) => ({ apk, name: path.basename(apk).toLowerCase() }));
  return (
    lower.find((item) => item.name.includes('universal'))?.apk ||
    lower.find((item) => item.name.includes('standalone'))?.apk ||
    lower.find((item) => item.name.includes('base-master'))?.apk ||
    lower[0].apk
  );
};

const runCommand = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  child.on('error', reject);
  child.on('exit', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`${command} exited with code ${code}`));
  });
});

const buildApksForAbi = async ({
  bundletoolJar,
  aabPath,
  outputDir,
  version,
  appName,
  abi,
  locales,
  screenDensity,
  sdkVersion,
  keystore,
  keyAlias,
  ksPass,
  keyPass,
}) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planneriti-apks-'));
  const specPath = path.join(tempDir, `device-${abi}.json`);
  const apksPath = path.join(tempDir, `${sanitizeFileName(appName)}-${version}-${abi}.apks`);
  const extractDir = path.join(tempDir, `extract-${abi}`);

  const deviceSpec = {
    supportedAbis: [abi],
    supportedLocales: locales,
    screenDensity,
    sdkVersion,
  };

  fs.writeFileSync(specPath, JSON.stringify(deviceSpec, null, 2));

  log.step(`Building ${abi} APK set`);

  const buildArgs = [
    '-jar',
    bundletoolJar,
    'build-apks',
    `--bundle=${aabPath}`,
    `--output=${apksPath}`,
    '--mode=universal',
    `--device-spec=${specPath}`,
    `--ks=${keystore}`,
    `--ks-key-alias=${keyAlias}`,
    `--ks-pass=pass:${ksPass}`,
    `--key-pass=pass:${keyPass}`,
  ];

  await runCommand('java', buildArgs);

  log.step(`Extracting ${abi} APK`);

  ensureDir(extractDir);

  const extractArgs = [
    '-jar',
    bundletoolJar,
    'extract-apks',
    `--apks=${apksPath}`,
    `--output-dir=${extractDir}`,
  ];

  await runCommand('java', extractArgs);

  const apkFiles = findApkFiles(extractDir);
  const selectedApk = pickPreferredApk(apkFiles);

  if (!selectedApk) {
    throw new Error(`No APK found for ABI ${abi}`);
  }

  const outputName = `${sanitizeFileName(appName)}-${version}-android-${abi}.apk`;
  const outputPath = path.join(outputDir, outputName);
  fs.copyFileSync(selectedApk, outputPath);

  log.success(`Saved ${outputName}`);

  return outputPath;
};

const buildUniversalApk = async ({
  bundletoolJar,
  aabPath,
  outputDir,
  version,
  appName,
  keystore,
  keyAlias,
  ksPass,
  keyPass,
}) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planneriti-apks-'));
  const apksPath = path.join(tempDir, `${sanitizeFileName(appName)}-${version}-universal.apks`);
  const extractDir = path.join(tempDir, 'extract-universal');

  log.step('Building universal APK');

  const buildArgs = [
    '-jar',
    bundletoolJar,
    'build-apks',
    `--bundle=${aabPath}`,
    `--output=${apksPath}`,
    '--mode=universal',
    `--ks=${keystore}`,
    `--ks-key-alias=${keyAlias}`,
    `--ks-pass=pass:${ksPass}`,
    `--key-pass=pass:${keyPass}`,
  ];

  await runCommand('java', buildArgs);

  log.step('Extracting universal APK');

  ensureDir(extractDir);

  const extractArgs = [
    '-jar',
    bundletoolJar,
    'extract-apks',
    `--apks=${apksPath}`,
    `--output-dir=${extractDir}`,
  ];

  await runCommand('java', extractArgs);

  const apkFiles = findApkFiles(extractDir);
  const selectedApk = pickPreferredApk(apkFiles);

  if (!selectedApk) {
    throw new Error('No universal APK found');
  }

  const outputName = `${sanitizeFileName(appName)}-${version}-android-universal.apk`;
  const outputPath = path.join(outputDir, outputName);
  fs.copyFileSync(selectedApk, outputPath);

  log.success(`Saved ${outputName}`);

  return outputPath;
};

const main = async () => {
  log.title('PlannerITI APK Split Builder');
  log.info('Bundletool-based Android APK generator');

  const args = parseArgs(process.argv.slice(2));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label, fallback = '') => {
    const suffix = fallback ? paint('gray', ` (${fallback})`) : '';
    const answer = await rl.question(`${label}${suffix}: `);
    return answer.trim() || fallback;
  };

  try {
    const aabPath = path.resolve(args.aab || await ask('Path to .aab bundle'));
    if (!fs.existsSync(aabPath)) {
      throw new Error(`AAB file not found: ${aabPath}`);
    }

    const bundletoolJar = path.resolve(
      args.bundletool ||
      process.env.BUNDLETOOL_JAR ||
      path.join(process.cwd(), 'tools', 'bundletool.jar')
    );

    if (!fs.existsSync(bundletoolJar)) {
      throw new Error(
        `bundletool.jar not found. Provide --bundletool or set BUNDLETOOL_JAR. Tried: ${bundletoolJar}`
      );
    }

    const defaultVersion = args.version || process.env.RELEASE_VERSION || readPackageVersion();
    const version = await ask('Release version tag', defaultVersion || '1.0.0');

    const appName = await ask('App name for file naming', args.app || process.env.APP_NAME || 'PlannerITI');

    const outputDir = path.resolve(
      args.out ||
      process.env.OUTPUT_DIR ||
      path.join(process.cwd(), 'dist', 'apks', version)
    );
    ensureDir(outputDir);

    const abiList = normalizeList(args.abis || process.env.ABIS || 'arm64-v8a,armeabi-v7a,x86_64');
    const locales = normalizeList(args.locales || process.env.LOCALES || 'en,ro,ru');
    const screenDensity = parseInt(args.density || process.env.SCREEN_DENSITY || '480', 10);
    const sdkVersion = parseInt(args.sdk || process.env.SDK_VERSION || '33', 10);

    const keystore = path.resolve(args.keystore || process.env.KEYSTORE_PATH || await ask('Keystore path'));
    const keyAlias = await ask('Keystore alias', args.alias || process.env.KEYSTORE_ALIAS || 'planneriti');

    const ksPass = args['ks-pass'] || process.env.KEYSTORE_PASS || await ask('Keystore password');
    const keyPass = args['key-pass'] || process.env.KEY_PASS || ksPass || await ask('Key password', ksPass);

    if (!fs.existsSync(keystore)) {
      throw new Error(`Keystore not found: ${keystore}`);
    }

    if (!keyAlias) {
      throw new Error('Keystore alias is required');
    }

    if (!ksPass) {
      throw new Error('Keystore password is required');
    }

    log.info(`Output folder: ${outputDir}`);
    log.info(`ABIs: ${abiList.join(', ')}`);
    log.info(`Locales: ${locales.join(', ')}`);
    log.info(`Density: ${screenDensity}, SDK: ${sdkVersion}`);

    for (const abi of abiList) {
      await buildApksForAbi({
        bundletoolJar,
        aabPath,
        outputDir,
        version,
        appName,
        abi,
        locales,
        screenDensity,
        sdkVersion,
        keystore,
        keyAlias,
        ksPass,
        keyPass,
      });
    }

    if (args['include-universal']) {
      await buildUniversalApk({
        bundletoolJar,
        aabPath,
        outputDir,
        version,
        appName,
        keystore,
        keyAlias,
        ksPass,
        keyPass,
      });
    }

    log.success('All APKs generated successfully.');
    log.info(`Naming pattern: ${sanitizeFileName(appName)}-${version}-android-<abi>.apk`);
  } finally {
    rl.close();
  }
};

main().catch((error) => {
  log.error(error.message || 'Build failed');
  process.exit(1);
});
