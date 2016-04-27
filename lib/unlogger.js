var JSONSieve = require('./json-sieve');

function unlogger(inStream) {
  var sieve = new JSONSieve();
  inStream.setEncoding('utf8');
  inStream.on('readable', () => {
    var chunk = inStream.read();
    if (chunk !== null) {
      sieve.observe(chunk);
    }
  });
  inStream.on('end', function() {
    sieve.close();
  });
  return sieve;
}

module.exports = unlogger;
