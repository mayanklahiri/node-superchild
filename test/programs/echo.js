var unlogger = require('../../').unlogger;

unlogger(process.stdin).on('json_object', function(obj) {
  console.log('JUST MOAR GARBAGE.');
  console.log(JSON.stringify(obj));
});
