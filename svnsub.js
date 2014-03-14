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

var util   = require('util'); 
var exec  = require('child_process').exec;
var async  = require('async');
var fs     = require('fs');
var net    = require('net');
var rimraf = require('rimraf');

// Load the config
var config = JSON.parse(fs.readFileSync('./config.json', {encoding: 'utf8'}));

// Base arguments sent to svn regardless of configuration
var BASE_SVN_EXEC = 'svn export --force -q --username %s --password %s -r %d %s %s';

// Commit jobs that are received from the server are added to a queue to make sure that we process them one at a
// time.
var queue = async.queue(handleCommit, 1)

var server = net.createServer(function(c) {
	console.log("Client Connected", c.remoteAddress);
	var payload = {
		end: false,
		host: c.remoteAddress
	};
	queue.push(payload);
	var response = "";
	c.on('data', function (data) {
		response += data.toString();
	})
	c.on('end', function () {
		payload.data = JSON.parse(response);
		var repo = payload.data.repo;
		payload.host = util.format("%s://%s:%d/", config[repo].protocol||'http', payload.host, config[repo].repoPort||80)
		payload.end = true;
	})
});
server.listen(process.argv[3]||2069, function () {
});

function handleCommit(task, queueCB) {
	async.whilst(
		function truth() { return !task.end },
		function doThis(cb) { setTimeout(cb, 10); },
		function after() {
			if (!config[task.data.repo]) {
				queueCB("Repo not supported: " + repo);
			}
			var repoConfig = config[task.data.repo];
			var rev = task.data.rev;
			var url = task.host + repoConfig.repoPath + '/';
			console.log("Processing rev. " + rev + " from " + url);
			async.parallel({ 
				exps: function exps(parallelCB) {
					totalExps = 0;
					async.eachLimit(
						task.data.exports,
						100,
						function iterator(file, eachCB) {
							var remotePath = url+file+"@"+rev // The full url/path to retrieve the file from the repo, with a PEGREV
								, localPath = repoConfig.localPath + file.replace(repoConfig.prefix, '') // Full path to where the file should end up

							// Export file
							var svnExec = exec(
								util.format(BASE_SVN_EXEC, repoConfig.svnuser, repoConfig.svnpass, rev, remotePath, localPath),
								{ encoding: 'utf8' },
								function (err, stdout, stderr) {
									if (err) return eachCB(err)
									totalExps++;
									console.log("exported " + remotePath + " to " + localPath)
									eachCB();
								}
							)
						},
						function end(err) {
							parallelCB(err, totalExps);
						}
					);
				},
				dels: function dels(parallelCB) {
					totalDels = 0;
					async.eachLimit(
						task.data.deletes,
						100,
						function iterator(file, eachCB) {
							var localPath = getRealPath(repoConfig.localPath, file), eachCB
							fs.stat(localPath, function(err, stats) {
								// Only pass the error along if it isn't about the file not existing.
								if (err) { return eachCB(err.CODE=='ENOENT'?null:err); }
								totalDels++;
								if (stats.isFile()) {
									fs.unlink(localPath, eachCB);
								}
								else if (stats.isDirectory()) {
									// rimraf is equivalent to command-line `rm -rf`
									rimraf(localPath, eachCB);
								}
							})
						},
						function end(err) {
							parallelCB(err, totalDels);
						}
					);
				}
			},
			function end(err, totals) {
				if (err) console.log("EROR: " + err)
				console.log("Files Exported: " + totals.exps + "; Files Deleted:  " + totals.dels);
				queueCB();
			});
		}
	);
}

function getRealPath(base, file) {
	return base+file.replace(/^trunk\/|branches\/[^\/]+\//, '')
}
