'use strict';

// node trace-route.js 20 soy.nexia.jp

var dns   = require('dns');
var ping  = require ("net-ping");
var async = require ("async");

var log   = console.log;
var error = console.error;

if (process.argv.length < 4) {
	log ("usage: node trace-route <ttl> <target> [<target> ...]");
	process.exit (-1);
}

var ttl = parseInt (process.argv[2]);
var targets = [];
var Report  = {};

for (var i = 3; i < process.argv.length; i++){
	targets.push(process.argv[i]);
}

var options = {
	retries: 1,
	timeout: 2000
};

var session = ping.createSession (options);

session.on ("error", function (err) {
	console.trace (err.toString ());
});


function feedCb (err, target, ttl, sent, rcvd) {
	var ms = rcvd - sent;
	if (err) {
		if (err instanceof ping.TimeExceededError) {
			log(target + ": " + err.source + " (ttl=" + ttl + " ms=" + ms +")");
		} else {
			log(target + ": " + err.toString () + " (ttl=" + ttl + " ms=" + ms +")");
		}
	} else {
		log(target + ": " + target + " (ttl=" + ttl + " ms=" + ms +")");
	}
}

function traceRoute (addr, callback) {
	session.traceRoute (addr, ttl, feedCb, function (err, target) {
		if (err) log("target: " + target + ", err: " + err);
		else log("target: " + target + " Done.");
		callback(err, target);
	});
}

async.each(targets, function(host, done){

	Report[host] = new Array();

	if( host.match( /^\d+\.\d+\.\d+\.\d+$/ ) ) { // if ip addr ?

		traceRoute(host, function(err, target){
			done();
		});

	} else { // hostname


		dns.resolve4(host, function(err, addr){
			if (err) {

				Report[host].push("dns.resolve4 host: " + host + " err: " + JSON.stringify(err));
				done();

			} else {

				delete Report[host];
				var ip_addr = addr.toString().trim();
				Report[ip_addr] = new Array();

				traceRoute(ip_addr, function(err, target){
					done();
				});

			}
		});

	}

}, function(err){
	log("trace-route exit.")
	session.close();
	JSON.stringify(Report, null, "    ");
	ReportView();
});

function ReportView () {
	async.map(Report, function(item, done){
		async.forEach(item, function(line, next){
			log(line);
			next;
		}, function(err){
			log("\n");
			done();
		});
	});
}
