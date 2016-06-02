// ## respawn.js
//
// Backport of node 5+ behavior on spawn() and spawnSync() to
// 0.11.13 <= node_version < 5.
//
var spawn = require('child_process').spawn
  , spawnSync = require('child_process').spawnSync
  ;


// Node v4.x.x (LTS) and below:
//
//   1. `child_process.spawn` did not support the `shell` option, so a
//      platform-specific shell has to be manually prefixed to the command line.
//
var NODE_MAJOR = parseInt(process.version.replace(/\..+/, '').substr(1), 10);
var LEGACY_NODE = NODE_MAJOR < 5;
var IS_WINDOWS = process.platform === 'win32';


exports.spawn = function(commandLine, spawnOpt) {
  if (!LEGACY_NODE) {
    return spawn(commandLine, spawnOpt);
  }

  // If the `shell` option is not set, pass through to spawn.
  if (!spawnOpt || !spawnOpt.shell) {
    return spawn(commandLine, spawnOpt);
  }

  // Node 4 (LTS) and below: polyfill the `shell` option.
  var childArgs = IS_WINDOWS ?
                    ['/A', '/C', commandLine] :
                    ['-c', commandLine];
  var shellBin = IS_WINDOWS ? 'cmd.exe' : '/bin/sh';
  return spawn(shellBin, childArgs, spawnOpt);
};


exports.spawnSync = function(commandLine, spawnOpt) {
  if (!LEGACY_NODE) {
    return spawnSync(commandLine, spawnOpt);
  }

  // If the `shell` option is not set, pass through to spawn.
  if (!spawnOpt || !spawnOpt.shell) {
    return spawnSync(commandLine, spawnOpt);
  }

  // Node 4 (LTS) and below: polyfill the `shell` option.
  var childArgs = IS_WINDOWS ?
                    ['/A', '/C', commandLine] :
                    ['-c', commandLine];
  var shellBin = IS_WINDOWS ? 'cmd.exe' : '/bin/sh';
  return spawnSync(shellBin, childArgs, spawnOpt);
};
