#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawn, execSync } = require('child_process');
const readline = require('readline/promises');

// ─────────────────────────────────────────────────────────────────────────────
//  ANSI helpers
// ─────────────────────────────────────────────────────────────────────────────

const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
};

const ansiLen  = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;
const paint    = (col, text) => `${c[col] || ''}${text}${c.reset}`;
const bold     = (t) => paint('bold', t);
const dim      = (t) => paint('dim',  t);
const cyan     = (t) => paint('cyan', t);
const gray     = (t) => paint('gray', t);
const green    = (t) => paint('green', t);
const yellow   = (t) => paint('yellow', t);
const red      = (t) => paint('red', t);

// ─────────────────────────────────────────────────────────────────────────────
//  Box drawing
// ─────────────────────────────────────────────────────────────────────────────

const BOX = { tl:'╭', tr:'╮', bl:'╰', br:'╯', h:'─', v:'│', lm:'├', rm:'┤', tm:'┬', bm:'┴' };

const hRule = (w, l = BOX.tl, r = BOX.tr, mid = BOX.lm, fill = BOX.h) =>
  l + fill.repeat(w - 2) + r;

const row = (content, w) => {
  const pad = Math.max(0, w - 2 - ansiLen(content) - 2);
  return `${BOX.v} ${content}${' '.repeat(pad)} ${BOX.v}`;
};

const printBox = (lines, w = 62) => {
  process.stdout.write('\n');
  console.log(cyan(hRule(w)));
  for (const line of lines) {
    console.log(cyan(BOX.v) + ' ' + line + ' '.repeat(Math.max(0, w - 2 - ansiLen(line) - 2)) + ' ' + cyan(BOX.v));
  }
  console.log(cyan(hRule(w, BOX.bl, BOX.br)));
};

// ─────────────────────────────────────────────────────────────────────────────
//  Spinner  (pauses automatically around child processes)
// ─────────────────────────────────────────────────────────────────────────────

const FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];

class Spinner {
  constructor() { this._timer = null; this._frame = 0; this._label = ''; }

  start(label) {
    this._label = label;
    this._frame = 0;
    process.stdout.write('\x1b[?25l');
    this._tick();
    this._timer = setInterval(() => this._tick(), 80);
    return this;
  }

  _tick() {
    const f = FRAMES[this._frame++ % FRAMES.length];
    process.stdout.write(`\r  ${cyan(f)} ${this._label}   `);
  }

  update(label) { this._label = label; }

  _clear() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    process.stdout.write('\r\x1b[K');
    process.stdout.write('\x1b[?25h');
  }

  succeed(msg) { this._clear(); console.log(`  ${green('✓')} ${msg}`); }
  fail(msg)    { this._clear(); console.error(`  ${red('✗')} ${msg}`); }
  stop()       { this._clear(); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Logging
// ─────────────────────────────────────────────────────────────────────────────

const log = {
  header() {
    console.clear();
    printBox([
      bold('  PlannerITI  ') + gray('APK Builder'),
      gray('  Bundletool-based Android release packager'),
      '',
      gray('  --gen-keystore   Generate a new signing keystore'),
      gray('  --include-universal   Also build a universal APK'),
      gray('  --help            Show all flags'),
    ], 58);
    console.log();
  },

  section(title) {
    console.log(`\n  ${cyan(BOX.lm + BOX.h)} ${bold(title)}`);
  },

  info(msg)    { console.log(`  ${cyan('→')} ${msg}`); },
  success(msg) { console.log(`  ${green('✓')} ${msg}`); },
  warn(msg)    { console.log(`  ${yellow('!')} ${msg}`); },
  error(msg)   { console.error(`  ${red('✗')} ${msg}`); },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────────────────────

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key  = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { args[key] = true; }
    else { args[key] = next; i++; }
  }
  return args;
};

const normalizeList = (v) =>
  !v ? [] : String(v).split(',').map(s => s.trim()).filter(Boolean);

const readPackageVersion = () => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).version || ''; }
  catch { return ''; }
};

const sanitize = (v) => v.replace(/[^a-zA-Z0-9._-]+/g, '-');
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

const formatBytes = (b) => {
  if (b < 1024)        return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const findApkFiles = (dir) => {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findApkFiles(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.apk')) results.push(full);
  }
  return results;
};

const pickPreferredApk = (paths) => {
  if (!paths.length) return null;
  const items = paths.map(p => ({ p, n: path.basename(p).toLowerCase() }));
  return (
    items.find(i => i.n.includes('universal'))?.p  ||
    items.find(i => i.n.includes('standalone'))?.p ||
    items.find(i => i.n.includes('base-master'))?.p ||
    items[0].p
  );
};

// Runs a child process, capturing stderr for better error messages.
// When silent=true the child's stdout/stderr are piped (used during spinner).
let VERBOSE = false;

const runCommand = (cmd, cmdArgs, { silent = false } = {}) =>
  new Promise((resolve, reject) => {
    const pipe  = silent && !VERBOSE;
    const stdio = pipe ? ['pipe', 'pipe', 'pipe'] : 'inherit';
    const child = spawn(cmd, cmdArgs, { stdio });

    let stderr = '', stdout = '';
    if (pipe) {
      if (child.stderr) child.stderr.on('data', d => { stderr += d; });
      if (child.stdout) child.stdout.on('data', d => { stdout += d; });
    }

    child.on('error', (err) => {
      const hint = err.code === 'ENOENT'
        ? `\n  '${cmd}' not found. Install it or pass --bundletool <path>.`
        : '';
      reject(new Error(`Could not run '${cmd}': ${err.message}${hint}`));
    });
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      const detail = [stderr, stdout].map(s => s.trim()).filter(Boolean).join('\n');
      reject(new Error(`bundletool failed (exit ${code})${detail ? `:\n${detail}` : ''}`));
    });
  });

// ─────────────────────────────────────────────────────────────────────────────
//  Config file  (.apkbuilder.json — never stores passwords)
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(process.cwd(), '.apkbuilder.json');

const loadConfig = () => {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return {}; }
};

const saveConfig = (cfg) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
};

// ─────────────────────────────────────────────────────────────────────────────
//  Keystore generation
// ─────────────────────────────────────────────────────────────────────────────

const genKeystore = async (ask) => {
  log.section('Generate Signing Keystore');
  log.info('This creates a keystore for GitHub / direct distribution.\n');

  const outPath  = path.resolve(await ask('Output path', 'github-release.jks'));
  const alias    = await ask('Key alias', 'planneriti-github');
  const password = await ask('Password (min 6 chars)');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  const cn       = await ask('Your name or organization', 'PlannerITI');
  const validity = await ask('Validity in days', '10000');

  const keytoolArgs = [
    '-genkey', '-v',
    '-keystore', outPath,
    '-alias', alias,
    '-keyalg', 'RSA',
    '-keysize', '4096',
    '-validity', validity,
    '-dname', `CN=${cn},OU=Mobile,O=${cn},L=Unknown,ST=Unknown,C=US`,
    '-storepass', password,
    '-keypass', password,
  ];

  console.log();
  await runCommand('keytool', keytoolArgs);

  // Read fingerprints
  let sha1 = '', sha256 = '';
  try {
    const out = execSync(
      `keytool -list -v -keystore "${outPath}" -alias "${alias}" -storepass "${password}"`,
      { encoding: 'utf8' }
    );
    sha1   = out.match(/SHA1:\s*([A-F0-9:]+)/i)?.[1]   || '';
    sha256 = out.match(/SHA-256:\s*([A-F0-9:]+)/i)?.[1] || '';
  } catch { /* fingerprint display is optional */ }

  printBox([
    bold(green('Keystore created!')),
    '',
    `  Path   ${gray(outPath)}`,
    `  Alias  ${gray(alias)}`,
    ...(sha1   ? [`  SHA1   ${yellow(sha1)}`] : []),
    ...(sha256 ? [`  SHA256 ${gray(sha256.substring(0, 44) + '…')}`] : []),
    '',
    yellow('  ⚠  Back up this file and password safely.'),
    yellow('  ⚠  Add it to .gitignore — never commit it.'),
  ], 66);
};

// ─────────────────────────────────────────────────────────────────────────────
//  APK build (single target)
// ─────────────────────────────────────────────────────────────────────────────

const buildApk = async ({
  bundletoolCmd, aabPath, outputDir, version, appName,
  abi, locales, screenDensity, sdkVersion,
  keystore, keyAlias, ksPass, keyPass,
  universal = false,
}) => {
  const label   = universal ? 'universal' : abi;
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'planneriti-'));
  const apksOut = path.join(tmpDir, `${sanitize(appName)}-${label}.apks`);
  const extrDir = path.join(tmpDir, `extract-${label}`);

  if (universal) {
    // Universal mode: --mode=universal, no device-spec.
    // The .apks file is a plain ZIP containing universal.apk — unzip directly.
    await runCommand(bundletoolCmd, [
      'build-apks',
      `--bundle=${aabPath}`,
      `--output=${apksOut}`,
      '--mode=universal',
      `--ks=${keystore}`,
      `--ks-key-alias=${keyAlias}`,
      `--ks-pass=pass:${ksPass}`,
      `--key-pass=pass:${keyPass}`,
    ], { silent: true });

    ensureDir(extrDir);
    await runCommand('unzip', ['-q', apksOut, '-d', extrDir], { silent: true });

  } else {
    // Per-ABI mode: --mode=default with device-spec for both build and extract.
    const specPath = path.join(tmpDir, `spec-${abi}.json`);
    fs.writeFileSync(specPath, JSON.stringify({
      supportedAbis: [abi],
      supportedLocales: locales,
      screenDensity,
      sdkVersion,
    }, null, 2));

    await runCommand(bundletoolCmd, [
      'build-apks',
      `--bundle=${aabPath}`,
      `--output=${apksOut}`,
      '--mode=default',
      `--device-spec=${specPath}`,
      `--ks=${keystore}`,
      `--ks-key-alias=${keyAlias}`,
      `--ks-pass=pass:${ksPass}`,
      `--key-pass=pass:${keyPass}`,
    ], { silent: true });

    ensureDir(extrDir);
    await runCommand(bundletoolCmd, [
      'extract-apks',
      `--apks=${apksOut}`,
      `--output-dir=${extrDir}`,
      `--device-spec=${specPath}`,
    ], { silent: true });
  }

  const selected = pickPreferredApk(findApkFiles(extrDir));
  if (!selected) throw new Error(`No APK extracted for ${label}`);

  const outName = `${sanitize(appName)}-${version}-android-${label}.apk`;
  const outPath = path.join(outputDir, outName);
  fs.copyFileSync(selected, outPath);

  return outPath;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Summary table
// ─────────────────────────────────────────────────────────────────────────────

const printSummary = (results, outputDir) => {
  const COL = { label: 16, size: 10, file: 36 };
  const W   = 68;

  const header = bold('Build Summary');
  const sub    = gray(outputDir);

  console.log();
  console.log(cyan(hRule(W)));
  console.log(row(`  ${header}`, W));
  console.log(row(`  ${sub}`, W));
  console.log(cyan(hRule(W, BOX.lm, BOX.rm)));

  for (const { label, filePath, error } of results) {
    if (error) {
      console.log(row(`  ${red('✗')}  ${label.padEnd(COL.label)}  ${red(error.substring(0, 40))}`, W));
    } else {
      const size = fs.existsSync(filePath) ? formatBytes(fs.statSync(filePath).size) : '?';
      const file = path.basename(filePath);
      const line = `  ${green('✓')}  ${label.padEnd(COL.label)}  ${gray(size.padStart(COL.size - 2))}  ${dim(file)}`;
      console.log(row(line, W));
    }
  }

  console.log(cyan(hRule(W, BOX.bl, BOX.br)));
};

// ─────────────────────────────────────────────────────────────────────────────
//  Help
// ─────────────────────────────────────────────────────────────────────────────

const printHelp = () => {
  printBox([
    bold('Usage'),
    '',
    '  node build-apks.js [options]',
    '',
    bold('Flags'),
    `  ${cyan('--aab')} <path>            Path to .aab file`,
    `  ${cyan('--bundletool')} <path>     bundletool JAR or command`,
    `  ${cyan('--version')} <tag>         Release version tag`,
    `  ${cyan('--app')} <name>            App name for file naming`,
    `  ${cyan('--out')} <dir>             Output directory`,
    `  ${cyan('--abis')} <list>           Comma-separated ABI list`,
    `  ${cyan('--keystore')} <path>       Path to .jks keystore`,
    `  ${cyan('--alias')} <alias>         Key alias`,
    `  ${cyan('--ks-pass')} <pass>        Keystore password`,
    `  ${cyan('--key-pass')} <pass>       Key password (defaults to ks-pass)`,
    `  ${cyan('--locales')} <list>        Supported locales (default: en,ro,ru)`,
    `  ${cyan('--density')} <dpi>         Screen density (default: 480)`,
    `  ${cyan('--sdk')} <version>         SDK version (default: 33)`,
    `  ${cyan('--include-universal')}     Also build a universal APK`,
    `  ${cyan('--gen-keystore')}          Generate a new signing keystore`,
    `  ${cyan('--no-save')}               Skip "save config?" prompt`,
    `  ${cyan('--help')}                  Show this help`,
    '',
    bold('Config'),
    '  Settings are saved in .apkbuilder.json (passwords excluded).',
    '  Add this file to .gitignore.',
  ], 64);
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────────────────────

const main = async () => {
  const args    = parseArgs(process.argv.slice(2));
  const config  = loadConfig();
  const spinner = new Spinner();

  if (args.help) { log.header(); printHelp(); return; }
  if (args.verbose) VERBOSE = true;

  log.header();

  const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label, fallback = '') => {
    const hint   = fallback ? ` ${gray(`(${fallback})`)}` : '';
    const answer = await rl.question(`  ${cyan('?')} ${label}${hint}: `);
    return answer.trim() || fallback;
  };

  try {
    // ── Keystore generation shortcut ──────────────────────────────────────────
    if (args['gen-keystore']) {
      await genKeystore(ask);
      return;
    }

    // ── Inputs ────────────────────────────────────────────────────────────────
    log.section('Bundle');

    const aabPath = path.resolve(args.aab || await ask('Path to .aab bundle'));
    if (!fs.existsSync(aabPath)) throw new Error(`AAB not found: ${aabPath}`);
    log.info(`${gray(aabPath)}  ${dim(formatBytes(fs.statSync(aabPath).size))}`);

    const bundletoolRaw = args.bundletool || process.env.BUNDLETOOL_CMD || config.bundletool || 'bundletool';
    const bundletoolCmd = (bundletoolRaw.includes(path.sep) || path.isAbsolute(bundletoolRaw))
      ? path.resolve(bundletoolRaw) : bundletoolRaw;

    const defaultVersion = args.version || process.env.RELEASE_VERSION || config.version || readPackageVersion();
    const version  = await ask('Release version', defaultVersion || '1.0.0');
    const appName  = await ask('App name', args.app || config.appName || 'PlannerITI');

    const defaultOut = args.out || config.outputDir || path.join(process.cwd(), 'dist', 'apks', version);
    const outputDir  = path.resolve(await ask('Output directory', defaultOut));
    ensureDir(outputDir);

    const abiDefault = args.abis || config.abis || 'arm64-v8a,armeabi-v7a,x86_64';
    const abiList    = normalizeList(await ask('ABIs', abiDefault));
    if (!abiList.length) throw new Error('At least one ABI is required.');

    const includeUniversal = args['include-universal'] || config.includeUniversal === true ||
      (await ask('Include universal APK?', 'n')).toLowerCase().startsWith('y');

    log.section('Signing');

    const defaultKs = args.keystore || process.env.KEYSTORE_PATH || config.keystore || '';
    const keystore  = path.resolve(await ask('Keystore path', defaultKs));
    if (!fs.existsSync(keystore)) {
      throw new Error(`Keystore not found: ${keystore}\n  Run with --gen-keystore to create one.`);
    }

    const keyAlias = await ask('Key alias', args.alias || process.env.KEYSTORE_ALIAS || config.keyAlias || '');
    if (!keyAlias) throw new Error('Key alias is required.');

    const ksPass  = args['ks-pass']  || process.env.KEYSTORE_PASS || await ask('Keystore password');
    if (!ksPass) throw new Error('Keystore password is required.');
    const keyPass = args['key-pass'] || process.env.KEY_PASS      || await ask('Key password', ksPass);

    // Advanced (always default, no prompt spam)
    const locales      = normalizeList(args.locales || config.locales || 'en,ro,ru');
    const screenDensity = parseInt(args.density || config.screenDensity || '480', 10);
    const sdkVersion    = parseInt(args.sdk     || config.sdkVersion   || '33',  10);

    // ── Save config ───────────────────────────────────────────────────────────
    if (!args['no-save']) {
      const doSave = (await ask('Save config for next run?', 'y')).toLowerCase().startsWith('y');
      if (doSave) {
        saveConfig({
          bundletool: bundletoolRaw,
          appName,
          outputDir: path.join(process.cwd(), 'dist', 'apks'),
          abis: abiList.join(','),
          includeUniversal,
          keystore,
          keyAlias,
          locales: locales.join(','),
          screenDensity,
          sdkVersion,
        });
        log.success(`Config saved → ${gray('.apkbuilder.json')}  ${yellow('(add to .gitignore!)')}`);
      }
    }

    // ── Build targets ─────────────────────────────────────────────────────────
    const targets = [
      ...abiList.map(abi => ({ label: abi, abi, universal: false })),
      ...(includeUniversal ? [{ label: 'universal', universal: true }] : []),
    ];

    log.section(`Building ${targets.length} APK${targets.length > 1 ? 's' : ''}`);

    const results = [];

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      spinner.start(`[${i + 1}/${targets.length}]  ${t.label}`);

      try {
        const filePath = await buildApk({
          bundletoolCmd, aabPath, outputDir, version, appName,
          abi: t.abi, locales, screenDensity, sdkVersion,
          keystore, keyAlias, ksPass, keyPass,
          universal: t.universal,
        });
        spinner.succeed(`[${i + 1}/${targets.length}]  ${t.label}  ${gray(formatBytes(fs.statSync(filePath).size))}`);
        results.push({ label: t.label, filePath });
      } catch (err) {
        const firstLine = err.message.split('\n')[0];
        const rest      = err.message.split('\n').slice(1).join('\n').trim();
        spinner.fail(`[${i + 1}/${targets.length}]  ${t.label}  ${red(firstLine)}`);
        if (rest) console.error(rest.split('\n').map(l => `        ${l}`).join('\n'));
        results.push({ label: t.label, error: firstLine });
      }
    }

    printSummary(results, outputDir);

    const failed = results.filter(r => r.error).length;
    if (failed) process.exitCode = 1;

  } finally {
    spinner.stop();
    rl.close();
  }
};

main().catch((err) => {
  log.error(err.message || 'Unexpected error');
  process.exit(1);
});