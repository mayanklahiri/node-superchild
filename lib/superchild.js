// # Superchild
//
// **Superchild** is a POSIX-only (e.g., Linux, Mac OS X) wrapper around
// node.js's built-in `child_process` module, which requires a lot of
// care and attention to use correctly.
//
// The purpose of Superchild is to allow large node.js programs
// to be split into independent processes (and sub-processes, resulting
// in **process trees**), while handling the tedious parts of process
// management and communication.
//
// Superchild also aims to be **compatible** with any program
// that reads from and writes to their `stdin`, `stdout`, and `stderr`
// streams, regardless of what language the program is written in.
// This allows interesting hacks like using `ssh` to execute a
// module, on a remote host, written in another language, and over an
// encrypted link, while using the near-universal format of line-delimited
// JSON messages over `stdio` for inter-process communication.
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
//      emitting an `exit` event, unlike `child_process`.
//
//   3. Handle isolating child process and its children in a
//      separate, __detached process group__ that can be terminated
//      as a subtree using the POSIX `kill` command. This means
//      that calling `close()` on a Superchild instance will kill
//      not just the child process, but all _its_ child processes
//      and so on (i.e., the entire process group lead by the child).
//      Note that if any processes in the sub-tree detach themselves
//      into a new process group, they will not be part of our
//      child's process group, and will not be killed.
//
//   4. Handle __graceful termination__ of child's entire process group
//      using `SIGINT` -> `SIGTERM` -> `SIGKILL` signals with a
//      configurable timeout between each stage.
//
//   5. Handle __unexpected termination__ of current process by killing
//      the child's entire process group.
//
//   6. Automatically serialize and deserialize __line-delimited JSON__
//      values (LD-JSON) sent to and received from child, intermixed
//      with `stdout` and `stderr`. Demultiplex child's `stdout`
//      stream into `stdout_line` (parsed raw text lines), `json_object`
//      (parsed LD-JSON objects), and `json_array` (parsed LD-JSON
//      arrays) event streams. Regular processes have 3 I/O streams,
//      Superchildren have 5 streams!
//
// ### Install
//
//       npm install superchild
//
// ### Usage
//
// ##### Run a shell command
//
// Get a directory listing line-by-line using `ls`.
//
//       var superchild = require('superchild');
//       var child = superchild('find . | wc -l');
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
// ### Events emitted
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
// ### Methods
//
// | Method          | Description                                                                    |
// | ----------------| -------------------------------------------------------------------------------|
// | `send(jsonVal)` | Serialize and send a JSON-serializable object or array to the child as LD-JSON.|
// | `close(cb)`     | Gracefully terminate the child, invoking the callback when the child has died. |
//
// ### Requirements
//
//   * `node.js` version 0.11.13 or higher, due to the use of `spawnSync`.
//   * POSIX-compliant platform, such as Linux or Mac OS.
//
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
  try {
    child = spawn(commandLine, {
      detached: true,
      shell: opt.shell,
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
  //   1. Send a `SIGINT` signal to the child process only.
  //   2. Wait for `opt.cleanupTimeoutMs` milliseconds.
  //   3. Send a `SIGTERM` signal to the child's entire process group.
  //
  // This method is a public method that is offered
  // via the return value of the `superchild()` call.
  //
  // Note that we wait for the proxy emitter's `exit` event before invoking
  // the callback rather than the underlying child process's `exit` event.
  // This is in order to wait for all output streams to flush before
  // actually emitting the `exit` event.
  //
  emitter.close = function(cb) {
    cb = cb || function() {};
    if (!child.pid) throw new Error('superchild: child is not running.');
    var killChildCmdLine = fmt('/bin/kill -SIGHUP -- %d', child.pid);
    var killGroupCmdLine = fmt('/bin/kill -SIGTERM -- -%d', child.pid);
    spawnSync(killChildCmdLine, {shell: true, stdio: 'inherit'});
    setTimeout(function() {
      if (child.pid) {
        spawnSync(killGroupCmdLine, {shell: true, stdio: 'inherit'});
      }
    }, opt.cleanupTimeoutMs);
    emitter.once('exit', cb);
    child.stdin.close();
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
      if (child.pid) {
        var killCmdLine = fmt('kill -SIGTERM -- -%d', child.pid);
        spawnSync(killCmdLine, {shell: true});
      }
    });
  }

  // If the child exits, then we need to wait for its streams to
  // close as well, and then flush the JSON sieve before emitting
  // the 'exit' event through the proxy emitter.
  var hasExited = false, stdoutEnded = false, stderrEnded = false;
  var exitCode, exitSignal;
  var cleanupFn = function() {
    if (hasExited && stdoutEnded && stderrEnded) {
      sieve.close(function() {
        emitter.emit('exit', exitCode, exitSignal);
      });
    }
  };
  child.stdout.once('end', function() {
    stdoutEnded = true;
    cleanupFn();
  });
  child.stderr.once('end', function() {
    stderrEnded = true;
    cleanupFn();
  });
  child.once('exit', function(code, signal) {
    exitCode = code;
    exitSignal = signal;
    hasExited = true;
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

//
// See current test coverage report at [coverage/lib/index.html](coverage/lib/index.html),
// generated using [Istanbul](https://github.com/gotwarlost/istanbul).
//
