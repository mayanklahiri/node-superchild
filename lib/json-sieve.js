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
var EventEmitter = require('events')
  , util = require('util')
  ;


function JSONSieve() {
  EventEmitter.call(this);
  this.lineBuffer_ = '';
}

util.inherits(JSONSieve, EventEmitter);

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
  var trimmedLine = line.replace(/^[\s\u0000-\u001f]*|[\s\u0000-\u001f]*$/g, '');

  // Check for necessary conditions for line-delimited JSON objects and arrays,
  // even empty ones.
  var len = trimmedLine.length;
  if (len >= 2) {
    // Test for possible line-delimited JSON objects.
    if (trimmedLine[0] === '{' && trimmedLine[len - 1] === '}') {
      var jsonObj;
      try {
        jsonObj = JSON.parse(trimmedLine);
      } catch(e) { }  // Nope, not a JSON object.
      if (jsonObj && typeof jsonObj == 'object') {
        return this.emit('json_object', jsonObj);
      }
    }

    // Test for possible line-delimited JSON arrays.
    if (trimmedLine[0] === '[' && trimmedLine[len - 1] === ']') {
      var jsonArr;
      try {
        jsonArr = JSON.parse(trimmedLine);
      } catch(e) { }  // Nope, not a JSON array.
      if (jsonArr && typeof jsonArr == 'object' && 'length' in jsonArr) {
        return this.emit('json_array', jsonArr);
      }
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


module.exports = JSONSieve;
