#!/usr/local/bin/node

// Copyright 2014 IDX, LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIC,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var util  = require('util');
var exec = require('child_process').exec;
var fs    = require ('fs');
var net   = require ('net');

var REPO_PATH = process.argv[2];
var REV   = process.argv[3];
var REPO = /[^\/]+$/.exec(REPO_PATH)[0];

// Make a function that always uses util's colors option.
console.clog = function() {
	var args = [];
	Array.prototype.slice.call(arguments).forEach(function (arg, ind) {
		args[ind] = util.inspect(arg, {colors: true});
	});
	console.log.apply(null, args);
}

console.error(process.cwd())
var config = JSON.parse(fs.readFileSync(REPO_PATH+'/conf/hooks.json', {encoding: 'utf8'}));

// If this isn't a configured repo, exit
if (!config) process.exit();

// List of path refixes we're dealing with for this REPO
var paths = Object.keys(config)

// A regex for gathering the path prefix from the file name.
var pathRegExp = new RegExp("^" + paths.join("|^"));

console.clog({ path: REPO_PATH, repo: REPO, rev: REV})

var child = exec('svnlook changed ' + REPO_PATH + ' -r ' + REV, function svnlook(error, stdout, stderr) {
	console.log("svnlook:\n" + stdout + "\n------------------");
	var changes = stdout.split("\n");
	var prep = {};
	changes.forEach(function (item) {
		// There's usually a trailing newline, skip it.
		if (item.length == 0) return

		var code = item.substr(0, 1); // Change that happened (U=update, A=change, D=delete)
		var file = item.substr(4); // File that changed relative to repo root

		// If the current file doesn't start with any of the paths we care about, skip it
		if (!paths.some(function (path) { return file.indexOf(path) === 0 }))
			return

		// Where each file goes depends on its prefix
		var prefix = pathRegExp.exec(file)[0]
		if (!prep[prefix]) prep[prefix] = { 'exports': [], 'deletes': [], repo: REPO, rev: REV }

		// If the file was deleted, add to the deletes array, otherwise it was added or modified and needs to be exported.
		prep[prefix][code=='D'?'deletes':'exports'].push(file);

	})
	Object.keys(prep).forEach(function (path) {
		var info = prep[path]

		var client = net.connect({ port: config[path].port||2069, host: config[path].host })
		client.end(JSON.stringify(info))
	})
});
