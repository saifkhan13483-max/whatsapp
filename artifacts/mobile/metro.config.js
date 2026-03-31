const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const { watchFolders, resolver } = config;

config.watchFolders = [
  ...(watchFolders ?? []),
  path.resolve(__dirname, "../.."),
];

const blocklistRE = /.*_tmp_\d+.*/;

config.resolver = {
  ...(resolver ?? {}),
  blockList: blocklistRE,
};

module.exports = config;
