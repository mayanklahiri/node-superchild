var JSONSieve = require('./json-sieve');


function unlogger(inStream) {
  var sieve = new JSONSieve();
  inStream = inStream || process.stdin;
  inStream.setEncoding('utf8');
  inStream.on('data', sieve.observe.bind(sieve));
  inStream.once('end', function() {
    sieve.close();
  });
  return sieve;
}


module.exports = unlogger;
