var _ = require('lodash')
  , fmt = require('util').format
  , fs = require('fs')
  , spawnSync = require('../lib/respawn').spawnSync
  ;


function GetProcessTreeStatus(pgid) {
  if (!pgid) throw new Error('pid not specified.');

  // Use `ps` to get running process status.
  var psFields = [
    'pid',
    'pgid',
    '%cpu',
    '%mem',
    'cp',
    'rss',
    'sz',
    'comm',
  ];
  var cmdLine = ['--no-header', 'xao', psFields.join(',')];
  var psOutput = spawnSync('ps', cmdLine, {
    stdio: 'pipe'
  }).stdout.toString('utf-8');
  var table = _.map(_.filter(psOutput.split('\n')), function(lineStr) {
    return lineStr.
              replace(/\s\s*/g, ' ').       // collapse whitespace
              replace(/^\s*|\s*$/g, '').    // trim leading and trailing whitespace
              split(' ').                   // split fields on whitespace
              map(function(val) {           // convert most rows to numbers
                return val.match(/^[0-9\.]+$/) ? parseFloat(val) : val;
              });
  });

  // Filter table rows where process group ID matches pgid.
  var pGroup = _.filter(table, function(row) {
    return row[1] === pgid;
  });

  // Convert table to a list of objects.
  pGroup = _.map(pGroup, function(row) {
    return _.zipObject(psFields, row);
  });

  return pGroup;
}


module.exports = GetProcessTreeStatus;
