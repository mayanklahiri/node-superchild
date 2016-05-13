var unlogger = require('../../').unlogger;

unlogger(process.stdin).on('json_object', function(obj) {
  console.log('Stdout garbage.');
  console.log(JSON.stringify(obj));
});
