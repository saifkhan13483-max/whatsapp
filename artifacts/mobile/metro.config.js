const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ],
  unstable_enableSymlinks: true,
  blockList: [
    /node_modules\/\.pnpm\/puppeteer.*/,
    /node_modules\/\.pnpm\/devtools-protocol.*/,
    /devtools-protocol_tmp_.*/,
    /\/\.git\/.*/,
    /artifacts\/api-server\/.*/,
  ],
};

module.exports = config;
