var ping  = require("net-ping");
var log   = console.log;
var dns   = require('dns');
var async = require('async')

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

var IPs = [
  "54.65.158.4",
  "www.google.co.jp",
  "www.yahoo.co.jp",
  "54.65.57.39",
  "abc.nexia.jp"
];
var reg = new RegExp( '^\\d+\\.\\d+\\.\\d+\\.\\d+$' );

for(var i in IPs){
  var host = IPs[i];
  if(host.match(reg)){
    PingCheck(host, null);
  }else{
    HostPingCheck(host, function(err, res){
      if(err) log(res + "err.code: " + err);
      else PingCheck(res, host);
    });
  }
}
return;

function HostPingCheck(host,cb){
  dns.lookup(host, 4, function(err, address){
    if(err) cb(err,"Error: dns.lookup. " + address);
    else cb(null,address);
  });
}

function PingCheck(ip, host){
  var name = host ? host : '';
  session.pingHost (ip, function (err, target) {
    if (err)
      if (err instanceof ping.RequestTimedOutError)
        msg = "Ping Error: " + target + " Not alive.";
      else
        msg = "Ping Error: " + target + " " + err.toString() + ".";
    else
      msg   = "Ping Alive: " + target;
    log(msg + " " + host);
  });
}
