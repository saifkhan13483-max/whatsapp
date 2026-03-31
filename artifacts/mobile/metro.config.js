const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;

config.watchFolders = [workspaceRoot];

const blocklistRE = /.*_tmp_\d+.*/;

config.resolver = {
  ...config.resolver,
  blockList: blocklistRE,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ],
};

module.exports = config;
