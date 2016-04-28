// ## JSONSieve
//
// Picks out line-delimited JSON arrays and objects in a data stream, and
// parses the rest into lines.
//
// ### Usage
//
//     var sieve = new JSONSieve();
//     process.stdin.on('data', function(chunk) {
//       sieve.observe(chunk);
//     });
//     process.stdin.on('end', function() {
//       sieve.close();  // important
//     });
//     sieve.on('stdout_line', ...);
//     sieve.on('stderr_data', ...);
//     sieve.on('json_object', ...);
//     sieve.on('json_array', ...);
//
// `JSONSieve` is an `EventEmitter`.
//
// __Warning:__ Note that JSON will not be parsed if it
// is "pretty-printed" with whitespace.
//
// ### Source
var events = require('events')
  , util = require('util')
  ;


function JSONSieve() {
  this.lineBuffer_ = '';
}

// After construction, chunked data may be passed to `observe()`.
JSONSieve.prototype.observe = function(dataStr) {
  this.lineBuffer_ += dataStr;
  this.parseLineBuffer_();
};

// On every chunk, we add the new data to the existing line buffer,
// and attempting to find newlines to split on. If there are no newlines,
// then assume that the last chunk we got was a partial line.
JSONSieve.prototype.parseLineBuffer_ = function() {
  var lines = [];
  var dataStr = this.lineBuffer_;
  var idx = dataStr.indexOf('\n');
  while(idx >= 0) {
    lines.push(dataStr.substr(0, idx));  // Excludes terminating new line.
    dataStr = dataStr.substr(idx + 1);   // Skip newline.
    idx = dataStr.indexOf('\n');
  }
  this.lineBuffer_ = dataStr;            // Linebuffer contains leftovers.
  if (lines.length) {
    lines.forEach(this.processLine_, this);
  }
};

// For every line parsed out of the stream, attempt to decode JSON strings
// and arrays. A decision is made here not to attempt to decode JSON strings
// and numbers, because they are too accidentally common in most output streams.
JSONSieve.prototype.processLine_ = function(line) {
  // Allow some fuzz in the input in the form of leading and trailing whitespace.
  var trimmedLine = line.replace(/^\s*|\s*$/g, '');

  // Check for necessary conditions for line-delimited JSON objects and arrays,
  // even empty ones.
  var len = trimmedLine.length;
  if (len >= 2) {
    // Test for possible line-delimited JSON objects.
    if (trimmedLine[0] === '{' && trimmedLine[len - 1] === '}') {
      try {
        var jsonObj = JSON.parse(trimmedLine);
        return this.emit('json_object', jsonObj);
      } catch(e) { }  // Nope, not a JSON object.
    }

    // Test for possible line-delimited JSON arrays.
    if (trimmedLine[0] === '[' && trimmedLine[len - 1] === ']') {
      try {
        var jsonArr = JSON.parse(trimmedLine);
        return this.emit('json_array', jsonArr);
      } catch(e) { }  // Nope, not a JSON array.
    }
  }

  // Emit as a raw line.
  return this.emit('stdout_line', line);
};

// Finish up any remaining data remaining in the line buffer, usually the
// last line of output if it does not have a terminating newline.
JSONSieve.prototype.close = function(cb) {
  if (this.lineBuffer_) {
    this.processLine_(this.lineBuffer_);
    delete this.lineBuffer_;
  }
  return (cb && cb());
};

util.inherits(JSONSieve, events.EventEmitter);

module.exports = JSONSieve;
