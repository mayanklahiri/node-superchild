var _ = require('lodash')
  ,   assert = require('chai').assert
  , fmt = require('util').format
  , path = require('path')
  , pstatus = require('./pstatus')
  , superchild = require('../lib/superchild')
  ;


describe('Superchild', function() {

  describe('basic use cases', function() {

    it('should get a long directory listing line-by-line', function(cb) {
      var child = superchild('ls -lh ' + __dirname);
      assert.isOk(child.pid, 'should have a pid in return value');
      var lines = [];
      child.on('stdout_line', function(lineStr) {
        lines.push(lineStr);
      });
      child.once('exit', function(code, signal) {
        assert.equal(0, code, 'ls should terminate with zero exit code');
        assert.isAtLeast(lines.length, 3, 'ls should output the correct number of lines');
        cb();
      });
    });

    it('should filter and parse LD-JSON objects', function(cb) {
      var child = superchild('cat');
      assert.isOk(child.pid, 'should have a pid in return value');
      var objects = [];
      child.on('json_object', function(jsonObj) {
        objects.push(jsonObj);
        child.close();
      });
      child.send({some: 'data'});
      child.once('exit', function(code, signal) {
        assert.isNotOk(code, 'ls should terminate with zero exit code');
        assert.equal(1, objects.length, 'ls should output the correct number of lines');
        assert.equal('data', objects[0].some, 'ls should echo data via cat and event json_object');
        cb();
      });
    });

    it('should filter and parse LD-JSON arrays', function(cb) {
      var child = superchild('cat');
      assert.isOk(child.pid, 'should have a pid in return value');
      var arrays = [];
      child.on('json_array', function(jsonArr) {
        arrays.push(jsonArr);
        child.close();
      });
      child.send([1, 2, 3]);
      child.once('exit', function(code, signal) {
        assert.isNotOk(code, 'ls should terminate with zero exit code');
        assert.equal(1, arrays.length, 'ls should output the correct number of lines');
        assert.deepEqual([1, 2, 3], arrays[0], 'ls should echo data via cat and event json_array');
        cb();
      });
    });

    it('should process the last unterminated line on child exit', function(cb) {
      var child = superchild('echo -n "sentinel"');
      var firstLine;
      child.once('stdout_line', function(lineStr) {
        firstLine = lineStr;
      });
      child.once('exit', function() {
        assert.isOk(firstLine, 'should process the last unterminated line');
        assert.equal(firstLine, 'sentinel', 'should echo the correct string');
        cb();
      });
    });

  });

  describe('basic abuse cases', function() {
    this.slow(3000);

    // Allow child to spawn 4 children: two shells and two node.js
    // processes running busywork and infinite loops.
    it('should kill nested infinite loops on close()', function(cb) {
      var child = superchild('node infinite-loop-root.js', {cwd: path.join(__dirname, 'programs')});
      assert.isOk(child.pid, 'should spawn a child');
      this.timeout = 4000;
      setTimeout(function() {
        var pGroup = pstatus(child.pid);
        assert.equal(pGroup.length, 4, 'should spawn 4 processes');
        _.forEach(pGroup, function(proc) {
          assert.isAtLeast(proc.rss, 1, 'should have positive RSS');
          assert.isAtLeast(proc.sz, 1, 'should have positive sz');
          assert.equal(proc.pgid, child.pid, 'should have pgid == child.pid');
        });
        child.close(function(err) {
          assert.isNotOk(err, 'should close without error');
          var pGroup = pstatus(child.pid);
          assert.strictEqual(pGroup.length, 0, 'should kill all children in process tree');
          cb();
        });
      }, 1000);
    });
  });

});
