var log      = console.log;
var errlog   = console.error;
var extend   = require('util')._extend;
var fs       = require('fs');
var request  = require('request');
var isEmpty  = require('./isEmpty');
var isObject = require('./isObject');
var ping     = require("net-ping");

var Conf = JSON.parse( fs.readFileSync( __dirname + '/.Config.json', 'UTF-8' ) );
if(!isObject(Conf)) return;

// ping Default options
var PingOptions = {
    networkProtocol: ping.NetworkProtocol.IPv4,
    packetSize: 16,
    retries: 3,
    sessionId: (process.pid % 65535),
    timeout: 2000,
    ttl: 128
};

JsonGet(Conf.Ping[0].JsonURL, function(err,json){
  if(err){
    errlog("Error: Json Data, URL: %s", Conf.Ping[0].JsonURL);
    JsonGet(Conf.Ping[0].JsonSlave, function(err,json){
      if(err){
        errlog("Error: Json Data, URL: %s", Conf.Ping[0].JsonSlave);
        return;
      }
    });
  }
  var DataObj = JSON.parse(json);
  if(!isObject(DataObj.ec2IPs)){ errlog("Error: Json Data"); return; }

  var p = ipParse(DataObj);
});

function ipParse(obj){
  var DataObj = extend({}, obj);
  for(var i in DataObj.ec2IPs){
    for(var j in DataObj.ec2IPs[i].EIPs){
      var Account  = extend({}, DataObj.ec2IPs[i]);
      var PublicIp = DataObj.ec2IPs[i].EIPs[j].PublicIp;
      var c = PingCheck(Account, PublicIp, function(err, Account, PublicIp, target){
        if(!err) log("Ping OK. Profile: %s. ip: %s target : %s", Account.Profile, PublicIp, target);
        else{
          log("Ping Error. Profile: %s. ip: %s target: %s", Account.Profile, PublicIp, target);
          AlertSend(Account,PublicIp);
        }
      });
    }
  }
}

function PingCheck(Account, PublicIp, cb){
  log("ping start..... " + PublicIp);
  var session = ping.createSession (PingOptions);
  session.pingHost (PublicIp, function (error, target) {
    if (error)
      if (error instanceof ping.RequestTimedOutError)
        console.log (target + ": Not alive");
      else
        console.log (target + ": " + error.toString ());
    else
      console.log (target + ": Alive");
    log("ping check end.");
    return cb(error, Account, PublicIp, target);
  });
}

function JsonGet(url, cb){
  request(url, function (err, res, body) {
    if (err || res.statusCode != 200) {
      errlog("Error: " + err);
      errlog("Status: %d", res.statusCode);
      return cb(err,body);
    }
    return cb(null, body);
  });
}

function AlertSend(Account,PublicIp){
  log("AlertSend: %s", PublicIp);
  return;
}

function IPlistView(obj){
  for(var i in obj.IPs)
    log(obj.IPs[i]);
  return true;
}
