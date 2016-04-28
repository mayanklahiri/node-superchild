var crypto = require('crypto')
  , spawn = require('child_process').spawn
  ;

spawn('node infinite-loop-child.js', {shell: true, stdio: 'inherit'});

while (true) {
  crypto.randomBytes(1024);
}
