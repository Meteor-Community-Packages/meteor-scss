#!/usr/bin/env node
var spawn = require('child_process').spawn;

var meteor = spawn('./meteor/meteor', ['test-packages', '--driver-package', 'test-in-console', '-p', 10012, './']);
meteor.stdout.pipe(process.stdout);
meteor.stderr.pipe(process.stderr);

meteor.stdout.on('data', function startTesting(data) {
  var data = data.toString();
  if(data.match(/10012/)) {
    console.log('starting testing...');
    meteor.stdout.removeListener('data', startTesting);
    runTestSuite();
  } 
});

function runTestSuite() {
  process.env.URL = "http://localhost:10012/"
  var phantomjs = spawn('phantomjs', ['./meteor/packages/test-in-console/runner.js']);
  phantomjs.stdout.pipe(process.stdout);
  phantomjs.stderr.pipe(process.stderr);

  phantomjs.on('close', function(code) {
    meteor.kill();
    process.exit(code);
  });
}