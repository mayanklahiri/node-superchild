var crypto = require('crypto')
  , spawn = require('child_process').spawn
  ;

spawn('node infinite-loop-child.js', {shell: true, stdio: 'inherit'});

var noop = function() {};

// Ignore SIGTERMs and SIGHUPs
process.on('SIGTERM', noop);
process.on('SIGHUP', noop);

while (true) {
  crypto.randomBytes(1024);
}
