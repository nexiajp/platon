#!/usr/bin/env node

'use strict';

var debug = require('debug')('on');
debug.log = console.log.bind(console);
var error = console.error;
var log   = console.log;

var ping  = require("net-ping");
var dns   = require('dns');
var async = require('async')
var os    = require("os");
var request  = require('request');

var hostname = os.hostname();


var IPs = [
//  "54.65.158.4",
  "www.google.co.jp",
  "www.yahoo.co.jp",
  // "112.78.205.43",
  // "112.78.205.44",
  // "112.78.205.45",
  "49.212.192.234",
  "54.65.57.39",
  "soy.nexia.jp"
];

var AlertURL = "http://localhost:9090/platon/alert";

if ( process.argv[2] ){
  var reg = new RegExp( "-v", "i" );
  if( process.argv[2].match(reg) ) {
    log(IPs);
    return;
  }
}


var reg = new RegExp( '^\\d+\\.\\d+\\.\\d+\\.\\d+$' );

/*
//
// for
//
var len = IPs.length;
//for(var i in IPs){
for(var i=0; i<len; i++){
  var host = IPs[i];
  if(host.match(reg)){
    var ip = host;
    PingCheck(ip, function(err, msg){ log(host + ' : ' + msg); });
  }else{
    dnsLokkup(host, function(err, ip){
      if(err)
        log(host + ' : ' + ip + "err.code: " + err);
      else{
        log("NameHost : " + host + ", IP : " + ip);
        PingCheck(ip, function(err, msg){ log(host + ' : ' + msg); });
      }
    });
  }
}
return;
*/

/*
//
// function to value
//
for(var i in IPs){
  var host = IPs[i];
  var a = HostFunc(host);
}
function HostFunc(host){
  if(host.match(reg)){
    var ip = host;
    PingCheck(ip, function(err, msg){ log(host + ' : ' + msg); });
  }else{
    dnsLokkup(host, function(err, ip){
      if(err)
        log(host + ' : ' + ip + "err.code: " + err);
      else{
        log("NameHost : " + host + ", IP : " + ip);
        PingCheck(ip, function(err, msg){ log(host + ' : ' + msg); });
      }
    });
  }
}
return;
*/

/*
//
// function to object
//
var b = HostFuncObj(IPs);
function HostFuncObj(obj){
  var len = obj.length;
  for(var i=0; i<len; i++){
    var host = obj[i];
    if(host.match(reg)){
      var ip = host;
      PingCheck(ip, function(err, msg){ log(host + ' : ' + msg); });
    }else{
      dnsLokkup(host, function(err, ip){
        if(err)
          log(host + ' : ' + ip + "err.code: " + err);
        else{
          log("NameHost : " + host + ", IP : " + ip);
          PingCheck(ip, function(err, msg){ log(host + ' : ' + msg); });
        }
      });
    }
  }
}
return;
*/

//
// function self call
//
(function next(i) {
  if (i === IPs.length) {
    return;
  }

  var Profile = "testProfile";
  var host = IPs[i];
  if(host.match(reg)){
    var ip = host;
    PingCheck(ip, function(err, msg){
      if(err) {
        error("PingCheck ip: %s, err: %s", ip, err);
        error("msg: %s", msg);
        Alart(msg, Profile, ip);
      }else{
        log("PingCheck ip: %s, OK", ip);
      }
    });
  }else{
    dnsLokkup(host, function(err, ip){
      if(err)
        error("hsot: %s, ip: %s, err: %s", host, ip, err);
      else{
        // debug("host: %s, ip: %s", host, ip);
        PingCheck(ip, function(err, msg){
          if(err) {
            error("PingCheck ip: %s, err: %s", ip, err);
            error("msg: %s", msg);
            Alart(msg, Profile, ip);
          }else{
            log("PingCheck ip: %s, OK host: %s", ip, host);
          }
        });
      }
    });
  }

  next(i + 1);
})(0);
return;

/*
//
// async module
//
async.each(IPs, function(host, callback){
  if(host.match(reg)){
    var ip = host;
    PingCheck(ip, function(err, msg){
      log(host + ' : ' + msg);
      callback();
    });
  }else{
    dnsLokkup(host, function(err, ip){
      if(err){
        log(host + ' : ' + ip + "err.code: " + err);
        callback();
      }
      else{
        PingCheck(ip, function(err, msg){
          log(host + ' : ' + msg);
          callback();
        });
      }
    });
  }
}, function(err){
    if(err) throw err;
    log("Ping Check End.")
});
return;
*/

function dnsLokkup(host, cb){
  dns.lookup(host, 4, function(err, address){
    if(err) cb(err, "Error: dns.lookup. " + address);
    else    cb(null, address);
  });
}

function PingCheck(ip, cb){

  var PingOptions = {
      networkProtocol: ping.NetworkProtocol.IPv4,
      packetSize: ( 64 + 12 ),
      retries: 3,
      sessionId: ( randomIntInc(2049, 6553) ),
      timeout: 2000,
      ttl: 128
  };

  var session = ping.createSession (PingOptions);

  var msg;
  session.pingHost (ip, function (err, target, sent, rcvd) {
    var ms = rcvd - sent;
    if (err)
      if (err instanceof ping.RequestTimedOutError)
        msg = "Ping Error: " + target + " Not alive.";
      else
        msg = "Ping Error: " + target + " " + err.toString() + ".";
    else
      msg   = "Ping Alive: " + target;

    log(msg);
    log("sent: %d, rcvd: %d, ms: %d", sent, rcvd, ms);

    traceRoute(session, ip, function(err, res){
      if(err) error("traceRoute err: %s", err);
      cb(err, res);
    })

  });

  function randomIntInc (low, high) {
      return Math.floor(Math.random() * (high - low + 1) + low);
  }

}

function traceRoute ( session, target, callback) {

  var msg = null;
  var ttl = 128;
  var Err;

  session.traceRoute (target, ttl, feedCb, doneCb);

  function doneCb (err, target) {
    if (err) error(target + ": " + error.toString ());
    else log("Done: %s", target);
    callback(Err, msg);
  }

  function feedCb (err, target, ttl, sent, rcvd) {
    var ms = rcvd - sent;
    if (err) {
      if (err instanceof ping.TimeExceededError) {
        msg = target + ": " + err.source + " (ttl=" + ttl + " ms=" + ms +")" ;
      } else {
        msg = target + ": " + err.toString () + " (ttl=" + ttl + " ms=" + ms +")";
      }
    } else {
      msg = target + ": " + target + " (ttl=" + ttl + " ms=" + ms +")";
    }
    Err = err;
  }

}

function Alart(msg, Profile, PublicIp){
  var msg = "Ping Error: Not alive.";
  var AlertObj = AlertJsonMake (msg, Profile, PublicIp);
  AlertSend(AlertObj, function(err, res){
    if(err) error("AlertSend err: ", err);
    debug("AlertSend res: %s", res);
  });
}

function AlertJsonMake (msg, Profile, PublicIp){
  var AlertObj = {};
  AlertObj.Alert = msg;
  AlertObj.Profile = Profile;
  AlertObj.PublicIp = PublicIp;
  AlertObj.CheckHost = os.hostname();
  return AlertObj;
}

function AlertSend(AlertObj, cb){

  log("AlertObj: %s", JsonString(AlertObj));
  return cb(null, "test responce", "test body");

  var Params = {
//    form: JSON.stringify(AlertObj, null, "    "),
    form: AlertObj,
    uri:  AlertURL,
    json: true
  };
  request.post(Params, function(err, res, body){
    if(err) cb(err, res, body);
    else if ( res.statusCode !== 200 ) cb("res.statusCode: " + res.statusCode, res, body);
    else cb(null, res, body);
  });
}

function JsonString(obj) {
  return JSON.stringify(obj, null, "    ");
}
