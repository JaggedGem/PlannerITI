const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add global variable definitions to silence warnings
config.transformer = {
  ...config.transformer,
  globalScope: `
    global.SharedArrayBuffer = global.SharedArrayBuffer || Object;
    global.DebuggerInternal = global.DebuggerInternal || {};
    global.setTimeout = global.setTimeout || (() => {});
    global.clearTimeout = global.clearTimeout || (() => {});
    global.setImmediate = global.setImmediate || (cb => setTimeout(cb, 0));
    global.queueMicrotask = global.queueMicrotask || (cb => Promise.resolve().then(cb));
    global.cancelAnimationFrame = global.cancelAnimationFrame || (() => {});
    global.requestAnimationFrame = global.requestAnimationFrame || (cb => setTimeout(cb, 16));
    global.MessageChannel = global.MessageChannel || class {};
    global.structuredClone = global.structuredClone || (obj => JSON.parse(JSON.stringify(obj)));
    ${process.env.NODE_ENV === 'test' ? 'global.jest = global.jest || {};' : ''}
  `,
};

module.exports = config;