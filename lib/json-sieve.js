// ## JSONSieve
//
// Picks out line-delimited JSON arrays and objects in a data stream, and
// parses the rest into lines.
//
// Class `JSONSieve` is an `EventEmitter`.
//
var events = require('events')
  , util = require('util')
  ;


function JSONSieve() {
  this.lineBuffer_ = '';
}


JSONSieve.prototype.observe = function(dataStr) {
  this.lineBuffer_ += dataStr;
  this.parseLineBuffer_();
};


JSONSieve.prototype.parseLineBuffer_ = function() {
  var lines = [];
  var dataStr = this.lineBuffer_;
  var idx = dataStr.indexOf('\n');
  while(idx >= 0) {
    lines.push(dataStr.substr(0, idx));  // Excludes terminating new line.
    dataStr = dataStr.substr(idx + 1);   // Skip newline.
    idx = dataStr.indexOf('\n');
  }
  this.lineBuffer_ = dataStr;
  lines.forEach(this.processLine_, this);
};


JSONSieve.prototype.processLine_ = function(line) {
  // Allow some fuzz in the form of leading and trailing space.
  var trimmedLine = (line || '').replace(/^\s*|\s*$/g, '');

  // Check for necessary conditions for line-delimited JSON objects and arrays,
  // even empty ones.
  var len = trimmedLine.length;
  if (len >= 2) {
    // Test for trimmedLine-delimited JSON objects.
    if (trimmedLine[0] === '{' && trimmedLine[len - 1] === '}') {
      // Possible JSON object.
      try {
        var jsonObj = JSON.parse(trimmedLine);
        return this.emit('json_object', jsonObj);
      } catch(e) {
        // Nope, not a JSON object.
      }
    }

    // Test for trimmedLine-delimited JSON arrays.
    if (trimmedLine[0] === '[' && trimmedLine[len - 1] === ']') {
      // Possible JSON array.
      try {
        var jsonArr = JSON.parse(trimmedLine);
        return this.emit('json_array', jsonArr);
      } catch(e) {
        // Nope, not a JSON array.
      }
    }
  }

  // Emit as a raw line.
  return this.emit('stdout_line', line);
};


// Finish up any remaining data, usually the last line of output.
JSONSieve.prototype.close = function(cb) {
  if (this.lineBuffer_) {
    this.processLine_(this.lineBuffer_);
    delete this.lineBuffer_;
  }
  return (cb && cb());
};


util.inherits(JSONSieve, events.EventEmitter);


module.exports = JSONSieve;
