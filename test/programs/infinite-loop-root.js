var crypto = require('crypto')
  , spawn = require('child_process').spawn
  ;

spawn('node', ['infinite-loop-child.js'], {stdio: 'inherit'});

var noop = function() {};

// Ignore SIGTERMs and SIGHUPs
process.on('SIGTERM', noop);
process.on('SIGHUP', noop);

var i = 0;
while (true) {
  i += 2;
}
