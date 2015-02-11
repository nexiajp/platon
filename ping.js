var log      = console.log;
var errlog   = console.error;
var extend   = require('util')._extend;
var fs       = require('fs');
var request  = require('request');
var isEmpty  = require('./isEmpty');
var isObject = require('./isObject');
var ping     = require("net-ping");
var argv     = require('argv');

var scriptname = ( process.argv[ 1 ] || '' ).split( '/' ).pop();

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

argv.option([
  {
    name: 'view',
    short: 'v',
    type : 'string',
    description :'Confing Json View.',
    example: "'"+scriptname+" -v'"
  },
  {
    name: 'profile',
    short: 'p',
    type : 'string',
    description :'Ping List Filter as Profile Name.',
    example: "'"+scriptname+" --profile=value' or '"+scriptname+" -p value'"
  },
  {
    name: 'loop',
    short: 'l',
    type : 'boolean',
    description :'loop on . --loop=1 is enable, --loop=0 is disable',
    example: "'"+scriptname+" --loop=1' or '"+scriptname+" -l 0'"
  },
  {
    name: 'time',
    short: 't',
    type : 'int',
    description :'check Loop Time Wate Minute.',
    example: "'"+scriptname+" --time=10' or '"+scriptname+" -t 10'"
  }
]);

var args = argv.run();
if(args.options.view) { log(JSON.stringify(Conf, null, "    ")); return; }
var Profile = args.options.profile ? args.options.profile : null;
var TimeWateMin = args.options.time ? args.options.time : Conf.Ping[0].TimeWateMin;
var Loop = Conf.Ping[0].Loop;
if( args.options.loop != null) Loop = args.options.loop;

Main();
if( Loop === false ) return;
var count = 1;
setInterval(function(){
  log("count = %d", count);
  if( Main() === false) return;
  if( count++ > 999) count = 1;
}, TimeWateMin * 60 * 1000 );

function Main(){
  for (var i in Conf.Ping) {
    var url = Profile ? Conf.Ping[i].JsonURL+'?p='+Profile : Conf.Ping[i].JsonURL;
    JsonGet(url, function(err,json){
      if(err){
        var msg = "Error: Ping Json Data, URL: " +  url;
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
