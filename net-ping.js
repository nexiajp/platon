var ping  = require("net-ping");
var log   = console.log;
var dns   = require('dns');
var async = require('async')

var IPs = [
  "54.65.158.4",
  "www.google.co.jp",
  "www.yahoo.co.jp",
  "54.65.57.39",
  "abc.nexia.jp",
  "soy.nexia.jp"
];

if ( process.argv[2] ){
  var reg = new RegExp( "-v", "i" );
  if( process.argv[2].match(reg) ) {
    log(IPs);
    return;
  }
}

// ping Default options
var PingOptions = {
    networkProtocol: ping.NetworkProtocol.IPv4,
    packetSize: 16,
    retries: 3,
    sessionId: (process.pid % 65535),
    timeout: 2000,
    ttl: 128
};
var session = ping.createSession (PingOptions);

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
  session.pingHost (ip, function (err, target) {
    if (err)
      if (err instanceof ping.RequestTimedOutError)
        msg = "Ping Error: " + target + " Not alive.";
      else
        msg = "Ping Error: " + target + " " + err.toString() + ".";
    else
      msg   = "Ping Alive: " + target;
    cb(null, msg);
  });
}
