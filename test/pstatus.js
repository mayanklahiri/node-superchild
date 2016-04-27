var _ = require('lodash')
  , fmt = require('util').format
  , fs = require('fs')
  , spawnSync = require('child_process').spawnSync
  , _SC_CLK_TCK = parseInt(require('cpu-clock-ticks')(), 10)
  ;


function GetProcessTreeStatus(pid) {
  if (!pid) throw new Error('pid not specified.');
  // Get all child processes of pid.
  var processGroup = _.filter((spawnSync('/usr/bin/pgrep', ['-P', pid]).stdout || '').toString('utf-8').split('\n'));
  processGroup.push(pid);

  var procStatuses = _.map(processGroup, function(pid) {
    // Get memory usage of process from /proc/<pid>/status
    var statusFile = fmt('/proc/%d/status', pid);
    var readStatus = fs.readFileSync(statusFile, 'utf-8');
    var lines = readStatus.split('\n');
    var statObj = _.fromPairs(_.filter(_.map(lines, function(line) {
      var idxSep = line.indexOf(':');
      if (idxSep > 0) {
        var firstPart = _.trim(line.substr(0, idxSep)).toLowerCase();
        var secondPart = _.trim(line.substr(idxSep + 1)).replace(/\t/g, ' ');
        if (secondPart.match(/ kB/)) {
          secondPart = parseInt(secondPart, 10);
        }
        return [firstPart, secondPart];
      }
    })));

    // Get CPU cycle count from /proc/<pid>/stat
    var statFile = fmt('/proc/%d/stat', pid);
    var readStat = fs.readFileSync(statFile, 'utf-8').replace(/\s\s*/gm, ' ');
    var statFields = readStat.split(/ /);
    var cpuStat = {
      utime: parseFloat(statFields[13]) / _SC_CLK_TCK,
      stime: parseFloat(statFields[14]) / _SC_CLK_TCK,
      cutime: parseFloat(statFields[15]) / _SC_CLK_TCK,
      cstime: parseFloat(statFields[16]) / _SC_CLK_TCK,
    };

    // Assemble composite process status
    var pStatus = _.merge(cpuStat, _.pick(statObj, [
      'name',
      'pid',
      'ppid',
      'vmrss',
      'vmpeak',
      'vmsize',
    ]));

    return pStatus;
  });

  var ptreeStatus = _.reduce(procStatuses, function(acc, itr) {
    acc.utime = (acc.utime || 0) + itr.utime;
    acc.stime = (acc.utime || 0) + itr.stime;
    acc.cutime = (acc.cutime || 0) + itr.cutime;
    acc.cstime = (acc.cstime || 0) + itr.cstime;
    acc.vmpeak = (acc.vmpeak || 0) + itr.vmpeak;
    acc.vmrss = (acc.vmrss || 0) + itr.vmrss;
    acc.vmsize = (acc.vmsize || 0) + itr.vmsize;
    acc.processes = acc.processes || [];
    acc.processes.push(itr.name);
    return acc;
  }, {});

  return ptreeStatus;
}


module.exports = GetProcessTreeStatus;
