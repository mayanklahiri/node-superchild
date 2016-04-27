

[![GitHub issues](https://img.shields.io/github/issues/mayanklahiri/node-superchild.svg)](https://github.com/mayanklahiri/node-superchild/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/mayanklahiri/node-superchild/master/LICENSE)
[![Twitter](https://img.shields.io/twitter/url/https/github.com/mayanklahiri/node-superchild.svg?style=social)](https://twitter.com/intent/tweet?text=Wow:&url=%5Bobject%20Object%5D)

# Superchild

**Superchild** is a POSIX-only (e.g., Linux, Mac OS X) wrapper around
node.js's built-in `child_process` module, which requires a lot of
care and attention to use correctly.

The purpose of Superchild is to allow large node.js programs
to be split into independent processes (and sub-processes, resulting
in **process trees**), while handling the tedious parts of process
management and communication.

Superchild also aims to be **compatible** with any program
that reads from and writes to their `stdin`, `stdout`, and `stderr`
streams, regardless of what language the program is written in.
This allows interesting hacks like using `ssh` to execute a
module, on a remote host, written in another language, and over an
encrypted link, while using the near-universal format of line-delimited
JSON messages over `stdio` for inter-process communication.

**Features** that make Superchild different from node's built-in
`child_process` module include the following (many of these
are currently possible only due to restricting focus to POSIX
platforms, i.e., not Windows):

  1. A single function to replace `fork()`, `exec()`,
     and `spawn()` from the built-in `child_process` module.

  2. Waits for `stdout` and `stderr` streams to end before
     emitting an `exit` event, unlike `child_process`.

  3. Handle isolating child process and its children in a
     separate, __detached process group__ that can be terminated
     as a subtree using the POSIX `kill` command. This means
     that calling `close()` on a Superchild instance will kill
     not just the child process, but all _its_ child processes
     and so on (i.e., the entire process group lead by the child).
     Note that if any processes in the sub-tree detach themselves
     into a new process group, they will not be part of our
     child's process group, and will not be killed.

  4. Handle __graceful termination__ of child's entire process group
     using `SIGINT` -> `SIGTERM` -> `SIGKILL` signals with a
     configurable timeout between each stage.

  5. Handle __unexpected termination__ of current process by killing
     the child's entire process group.

  6. Automatically serialize and deserialize __line-delimited JSON__
     values (LD-JSON) sent to and received from child, intermixed
     with `stdout` and `stderr`. Demultiplex child's `stdout`
     stream into `stdout_line` (parsed raw text lines), `json_object`
     (parsed LD-JSON objects), and `json_array` (parsed LD-JSON
     arrays) event streams. Regular processes have 3 I/O streams,
     Superchildren have 5 streams!

### Install

      npm install superchild

### Usage

##### Run a shell command

Get a directory listing line-by-line using `ls`.

      var superchild = require('superchild');
      var child = superchild('find . | wc -l');
      child.on('stdout_line', function(line) {
        console.log('[stdout]: ', line);
      });

##### Spawn and communicate with a module

Spawn a node.js module in another process and communicate with it.
Note that the child uses the `superchild.unlogger` helper function
to parse its standard input for LD-JSON arrays and objects.

_master.js_

     var assert = require('assert');
     var superchild = require('superchild');
     var child = superchild('node echo.js');
     child.send({
       some: 'data',
     });
     child.on('json_object', function(jsonObj) {
       assert.equal(jsonObj.some, 'data');
     });

_echo.js_

     var unlogger = require('superchild').unlogger;
     unlogger.start().on('json_object', function(jsonObj) {
       // Echo JSON object from parent back to parent.
       unlogger.send(jsonObj);
     });


### Events emitted

Superchild is an EventEmitter. The following events can be listened for
using `child.on()` and `child.once()` functions.

| Event          | Arguments                | Description                                             |
| ---------------| -------------------------|---------------------------------------------------------|
| `exit`         | `code`, `signal`         | Child process exited, identical to `child_process.exit` |
| `stderr_data`  | `dataStr`                | Received unbuffered data on child's `stderr` stream.    |
| `stdout_line`  | `lineStr`                | Received a full line of text from the child process.    |
| `json_object`  | `jsonObj`                | Parsed a line-delimited JSON object from child's `stdout` stream. |
| `json_array`   | `jsonArr`                | Parsed a line-delimited JSON array from child's `stdout` stream.  |

### Methods

| Method          | Description                                                                    |
| ----------------| -------------------------------------------------------------------------------|
| `send(jsonVal)` | Serialize and send a JSON-serializable object or array to the child as LD-JSON.|
| `close(cb)`     | Gracefully terminate the child, invoking the callback when the child has died. |

### Requirements

  * `node.js` version 0.11.13 or higher, due to the use of `spawnSync`.
  * POSIX-compliant platform, such as Linux or Mac OS.


See current test coverage report at [coverage/lib/index.html](coverage/lib/index.html),
generated using [Istanbul](https://github.com/gotwarlost/istanbul).

