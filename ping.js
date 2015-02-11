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

Main();
if( Conf.Ping[0].Loop === false ) return;
var count = 1;
setInterval(function(){
  log("count = %d", count);
  if( Main() === false) return;
  if( count++ > 999) count = 1;
}, Conf.Ping[0].TimeWateMin * 60 * 1000 );

function Main(){
  for (var i in Conf.Ping) {
    JsonGet(Conf.Ping[i].JsonURL, function(err,json){
      if(err){
        var msg = "Error: Ping Json Data, URL: " +  Conf.Ping[i].JsonURL;
        var AlertObj = {Alert: msg, CheckHost: Conf.MyHost};
        log(msg);
        AlertSend(AlertObj, function(err, res){ if(err) log(res); });
        return false;
      }
      var DataObj = JSON.parse(json);
      if(!isObject(DataObj.ec2IPs)){ log("Error: Json Data NG"); return; }
      if(  isEmpty(DataObj.ec2IPs)){ log("Error: Json Data Null"); return; }
      log("Start ping check....." + ( new Date() ).toString() );
      var p = ipParse(DataObj);
    });
  }
}

function ipParse(obj){
  var DataObj = extend({}, obj);
  for(var i in DataObj.ec2IPs){
    for(var j in DataObj.ec2IPs[i].EIPs){
      var Account  = extend({}, DataObj.ec2IPs[i]);
      var PublicIp = DataObj.ec2IPs[i].EIPs[j].PublicIp;
      var c = PingCheck(Account, PublicIp, function(err, Account, PublicIp, msg){
        if(!err) log("%s Profile: %s - %s", msg, Account.Profile, PublicIp);
        else{
          log("%s Profile: %s - %s", msg, Account.Profile, PublicIp);
          var AlertObj = {};
          AlertObj.Alert = msg;
          AlertObj.Profile = Account.Profile;
          AlertObj.PublicIp = PublicIp;
          AlertObj.CheckHost = Conf.MyHost;
          AlertSend(AlertObj, function(err, res){
            if(err) log(res);
          });
        }
      });
    }
  }
}

function PingCheck(Account, PublicIp, cb){
  var msg = '';
  var session = ping.createSession (PingOptions);
  session.pingHost (PublicIp, function (err, target) {
    if (err)
      if (err instanceof ping.RequestTimedOutError)
        msg = "Ping Err: Not alive.";
      else
        msg = "Ping Err: " + err.toString() + ".";
    else
      msg = "Ping Alive.";
    return cb(err, Account, PublicIp, msg);
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

function AlertSend(AlertObj, cb){
  var Params = {
    uri:  Conf.AlertURL,
    form: AlertObj,
    json: true
  };
  request.post(Params, function(err, res, body){
    if (!err && res.statusCode == 200) {
      cb(null, body);
    } else {
      cb(err,'Error: '+ res.statusCode + ". " + err.toString());
    }
  });
}

function IPlistView(obj){
  for(var i in obj.IPs)
    log(obj.IPs[i]);
  return true;
}
