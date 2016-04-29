//
// [![Circle CI](https://circleci.com/gh/mayanklahiri/node-superchild.svg?style=svg)](https://circleci.com/gh/mayanklahiri/node-superchild)
// [![GitHub issues](https://img.shields.io/github/issues/mayanklahiri/node-superchild.svg)](https://github.com/mayanklahiri/node-superchild/issues)
// [![GitHub stars](https://img.shields.io/github/stars/mayanklahiri/node-superchild.svg)](https://github.com/mayanklahiri/node-superchild/stargazers)
// [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/mayanklahiri/node-superchild/master/LICENSE)
// [![npm version](https://badge.fury.io/js/superchild.svg)](https://badge.fury.io/js/superchild)
// [![dependencies](https://david-dm.org/mayanklahiri/node-superchild.svg)](https://david-dm.org/mayanklahiri/node-superchild.svg)
// [![bitHound Overall Score](https://www.bithound.io/github/mayanklahiri/node-superchild/badges/score.svg)](https://www.bithound.io/github/mayanklahiri/node-superchild)
// [![bitHound Code](https://www.bithound.io/github/mayanklahiri/node-superchild/badges/code.svg)](https://www.bithound.io/github/mayanklahiri/node-superchild)
// [![Twitter](https://img.shields.io/twitter/url/https/github.com/mayanklahiri/node-superchild.svg?style=social)](https://twitter.com/intent/tweet?text=Wow:&url=%5Bobject%20Object%5D)
//
// **Superchild** is a POSIX-only (e.g., Linux, Mac OS X) wrapper around
// node.js's built-in `child_process` module, which requires a lot of
// care and attention to use correctly.
//
// Links:
//
//   * [Annotated source code](http://mayanklahiri.github.io/node-superchild/superchild.html)
//   * [Current test coverage](http://mayanklahiri.github.io/node-superchild/coverage/lib/index.html)
//   * [Github page](https://github.com/mayanklahiri/node-superchild)
//   * [NPM page](https://www.npmjs.com/package/superchild)
//
// The purpose of Superchild is to allow large node.js programs
// to be split into independent processes (and sub-processes, resulting
// in **process trees**), while handling the tedious parts of process
// management and communication.
//
// Superchild aims to be **compatible** with any program
// that reads from and writes to their `stdin`, `stdout`, and `stderr`
// streams, regardless of what language the program is written in.
// This allows interesting hacks like using `ssh` to execute a
// module on a remote host, written in another language, over an
// encrypted link, while using the near-universal format of
// line-delimited JSON messages over `stdio`.
//
// **Features** that make Superchild different from node's built-in
// `child_process` module include the following (many of these
// are currently possible only due to restricting focus to POSIX
// platforms, i.e., not Windows):
//
//   1. A single function to replace `fork()`, `exec()`,
//      and `spawn()` from the built-in `child_process` module.
//
//   2. Waits for `stdout` and `stderr` streams to end before
//      emitting an `exit` event, unlike `child_process.ChildProcess`.
//
//   3. Handles isolating child process and its children in a
//      separate, __detached process group__ that can be terminated
//      as a subtree using the POSIX `kill` command. This means
//      that calling `close()` on a Superchild instance will kill
//      not just the child process, but all _its_ child processes
//      and so on (i.e., the entire process group lead by the child).
//      Note that if any processes in the sub-tree detach themselves
//      into a new process group, they will not be part of our
//      child's process group, and will not be killed.
//
//   4. Handles __graceful termination__ of child's entire process group
//      using `SIGTERM` -> `SIGKILL` signals with a configurable timeout.
//
//   5. Handles __unexpected termination__ of the *current* process by
//      killing the child's entire process group immediately with `SIGKILL`.
//
//   6. Automatically serializes and deserializes __line-delimited JSON__
//      values (LD-JSON) sent to and received from child, intermixed
//      with `stdout`. `stderr` is passed through unbuffered. Effectively,
//      this means that the child's `stdout` stream is demultiplexed
//      into the child streams `stdout_line` (parsed raw text lines),
//      `json_object` (parsed JSON objects), and `json_array` (parsed JSON
//      arrays). Regular processes have 3 I/O streams (stdin, stdout,
//      stderr); Superchildren have 6 streams (stdin, stdout, stderr,
//      stdout_line, json_object, json_array).
//
// ## Install
//
//       npm install superchild
//
// ## Usage
//
// ##### Run a shell command
//
// Get a directory listing line-by-line using `ls`.
//
//       var superchild = require('superchild');
//       var child = superchild('ls -lh');
//       child.on('stdout_line', function(line) {
//         console.log('[stdout]: ', line);
//       });
//
// ##### Spawn and communicate with a module
//
// Spawn a node.js module in another process and communicate with it.
// Note that the child uses the `superchild.unlogger` helper function
// to parse its standard input for LD-JSON arrays and objects.
//
// _master.js_
//
//      var assert = require('assert');
//      var superchild = require('superchild');
//      var child = superchild('node echo.js');
//      child.send({
//        some: 'data',
//      });
//      child.on('json_object', function(jsonObj) {
//        assert.equal(jsonObj.some, 'data');
//      });
//
// _echo.js_
//
//      var unlogger = require('superchild').unlogger;
//      unlogger.start().on('json_object', function(jsonObj) {
//        // Echo JSON object from parent back to parent.
//        unlogger.send(jsonObj);
//      });
//
//
// ## Events emitted
//
// Superchild is an EventEmitter. The following events can be listened for
// using `child.on()` and `child.once()` functions.
//
// | Event          | Arguments                | Description                                             |
// | ---------------| -------------------------|---------------------------------------------------------|
// | `exit`         | `code`, `signal`         | Child process exited, identical to `child_process.exit` |
// | `stderr_data`  | `dataStr`                | Received unbuffered data on child's `stderr` stream.    |
// | `stdout_line`  | `lineStr`                | Received a full line of text from the child process.    |
// | `json_object`  | `jsonObj`                | Parsed a line-delimited JSON object from child's `stdout` stream. |
// | `json_array`   | `jsonArr`                | Parsed a line-delimited JSON array from child's `stdout` stream.  |
//
// ## Methods
//
// | Method          | Description                                                                    |
// | ----------------| -------------------------------------------------------------------------------|
// | `send(jsonVal)` | Serialize and send a JSON-serializable object or array to the child as LD-JSON.|
// | `close(cb)`     | Gracefully terminate the child, invoking the callback when the child has died. |
//
// ## Requirements
//
//   * `node.js` version 0.11.13 or higher, due to the use of `spawnSync`.
//   * POSIX-compliant platform, such as Linux or Mac OS.
//
  // ## Source Code
/** @license The MIT License, Copyright (c) 2016 Mayank Lahiri <mayank@iceroad.io> */
var events = require('events')
  , fmt = require('util').format
  , fs = require('fs')
  , spawn = require('child_process').spawn
  , spawnSync = require('child_process').spawnSync
  , JSONSieve = require('./json-sieve')
  ;


module.exports = function superchild(commandLine, options) {
  if (!commandLine) throw new Error('Superchild: empty commandLine provided.');
  options = (typeof options == 'object' ? options : {});
  var opt = {}, setDefault = function(key, defaultVal) {
    opt[key] = (key in options) ? options[key] : defaultVal;
  };

  // #### Default options
  //
  //   * **`stringEncoding`**: character encoding to use while communicating
  //   with the child. This is required to make node.js return strings instead
  //   of raw buffers. Defaults to **utf-8**.
  setDefault('stringEncoding', 'utf-8');

  //   * **`killOnExit`**: kill child process group when our own process
  //   exits, if the child is still running. Defaults to **true**.
  setDefault('killOnExit', true);

  //   * **`cleanupTimeoutMs`**: amount of walltime to wait for child process
  //     to exit after `close()` is called, before sending it SIGTERM. Defaults
  //     to **500ms**.
  setDefault('cleanupTimeoutMs', 500);

  //   * **`shell`**: run the command line through a system shell, defaults
  //     to **true**.
  setDefault('shell', true);

  //   * **`cwd`**: working directory to execute child process in, defaults
  //     to **process.cwd()**.
  setDefault('cwd', process.cwd());

  // Construct an `EventEmitter` instance to return to the caller. This
  // is a proxy emitter for the child process so that we can
  // re-order events received from the child process if necessary.
  var emitter = new events.EventEmitter();

  // #### Spawning the child process
  //
  // Spawn a child process with the `detached` option makes it
  // the leader of its own process group. This allows us to
  // terminate all its descendant processes (if we need to) by running
  // `kill -$PGID` (negation of the child's process group id).
  //
  var child;
  var hasExited = false, stdoutEnded = false, stderrEnded = false;
  try {
    child = spawn(commandLine, {
      detached: true,
      shell: opt.shell,
      cwd: opt.cwd,
      stdio: 'pipe',
    });
    child.stdin.setDefaultEncoding(opt.stringEncoding);
    child.stdout.setEncoding(opt.stringEncoding);
    child.stderr.setEncoding(opt.stringEncoding);
    if (!child.pid) {
      throw new Error('child did not have a process id.');
    }
    emitter.pid = child.pid;
  } catch(e) {
    throw new Error(fmt(
        'superchild: cannot spawn() child process, reason=%s',
        e.message));
  }

  // #### Reading from the child
  //
  // Read from the child process by parsing out complete lines and line-delimited
  // JSON objects and arrays from its `stdout` stream using `JSONSieve`.
  var sieve = new JSONSieve();
  var sieveClosed = false;
  child.stdout.on('data', function(dataStr) {
    sieve.observe(dataStr);
  });
  sieve.on('json_object', emitter.emit.bind(emitter, 'json_object'));
  sieve.on('json_array', emitter.emit.bind(emitter, 'json_array'));
  sieve.on('stdout_line', emitter.emit.bind(emitter, 'stdout_line'));
  child.stderr.on('data', emitter.emit.bind(emitter, 'stderr_data'));

  // #### Writing to the child: `send()`
  //
  var outbox = [];
  emitter.send = function(jsonVal) {
    if (child && child.pid) {
      var ser = JSON.stringify(jsonVal) + '\n';
      child.stdin.write(ser);
    } else {
      throw new Error('Unable to write to process.');
    }
  };

  // #### Terminating the child: `close()`
  //
  // Kill the child's process group gracefully. This involves the following
  // steps:
  //
  //   1. Send a `SIGTERM` signal to the child process group, allowing all
  //      processes in the group to die gracefully.
  //   2. Wait for `opt.cleanupTimeoutMs` milliseconds.
  //   3. If the child process has not exited, send a `SIGKILL` to the
  //      process group.
  //
  // This method is a public method that is offered
  // via the return value of the `superchild()` call.
  //
  // Note that we wait for the proxy emitter's `exit` event before invoking
  // the callback rather than the underlying node.js child process's `exit` event.
  // This is in order to wait for all output streams to flush before
  // actually emitting the `exit` event, which is not guaranteed with
  // node's underlying child_process implementation.
  //
  emitter.close = function(cb) {
    cb = cb || function() {};
    if (!child || !child.pid) throw new Error('superchild: child is not running.');
    var termGroupCmdLine = fmt('/bin/kill -s SIGTERM -%d', child.pid);
    var killGroupCmdLine = fmt('/bin/kill -s SIGKILL -%d', child.pid);
    spawnSync(termGroupCmdLine, {shell: true, stdio: 'inherit'});
    setTimeout(function() {
      if (!sieveClosed) {
        spawnSync(killGroupCmdLine, {shell: true, stdio: 'inherit'});
      }
    }, opt.cleanupTimeoutMs);
    emitter.once('exit', cb);
  };


  // #### Cleaning up the child process
  //
  // If the `killOnExit` option is specified, then when our own
  // current process exits, kill the child's process group using
  // the POSIX `kill` command with the child's process group ID,
  // which is the negation of its process id, since it is the leader
  // of its own process group.
  //
  if (opt.killOnExit) {
    process.once('exit', function() {
      if (child && child.pid) {
        var killCmdLine = fmt('/bin/kill -s SIGKILL -%d', child.pid);
        spawnSync(killCmdLine, {shell: true, stdio: 'inherit'});
      }
    });
  }

  // If the child exits, then we need to wait for its streams to
  // close as well, and then flush the JSON sieve before emitting
  // the 'exit' event through the proxy emitter.
  var exitCode, exitSignal;
  var cleanupFn = function() {
    if (hasExited && stdoutEnded && stderrEnded && !sieveClosed) {
      sieve.close(function() {
        emitter.emit('exit', exitCode, exitSignal);
      });
      sieveClosed = true;
    }
  };
  child.stdout.once('close', function() {
    stdoutEnded = true;
    cleanupFn();
  });
  child.stderr.once('close', function() {
    stderrEnded = true;
    cleanupFn();
  });
  child.stdout.once('end', function() {
    stdoutEnded = true;
    cleanupFn();
  });
  child.stderr.once('end', function() {
    stderrEnded = true;
    cleanupFn();
  });
  child.once('exit', function(code, signal) {
    hasExited = true;
    exitCode = code;
    exitSignal = signal;
    delete child.pid;
    cleanupFn();
  });


  // #### Return value
  //
  // The `superchild()` call returns a proxy `EventEmitter` with two
  // additional methods that are used to control the child process:
  // `close()` and `send()`.
  return emitter;
};
