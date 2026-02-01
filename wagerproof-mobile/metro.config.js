// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable watchman - use node crawler instead
config.watchFolders = config.watchFolders || [];
config.watcher = {
  watchman: {
    deferStates: [],
  },
};
config.resolver = {
  ...config.resolver,
  useWatchman: false,
};

module.exports = config;

