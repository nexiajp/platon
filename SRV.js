'use strict';

var Conf  = require('./.Conf-Srv.json');

var debug = require('debug')('on');
debug.log = console.log.bind(console);
var error = console.error;
var log   = console.log;

var fs       = require('fs');
var dns      = require('dns');
var request  = require('request');
var express  = require('express');
var isEmpty  = require('./isEmpty');
var extend   = require('util')._extend
var async    = require('async');
var AWS      = require('aws-sdk');

var modDoc   = require("./module-doc");
var modSlack = require("./module-slack");
var AlertChannel = Conf.AlertChannel;
var AlertCycle   = Conf.AlertCycle;

var IPsList     = {};
var ServiceList = {};
var ProfileList = new Array();

var CredentialsFile = process.env.HOME + '/.aws/credentials';

var cache      = require('memory-cache');
var AlertTTL   = Conf.AlertTTL; // ms ; 1000*60*10 = 10min


var getAWSProfiles = function (callback){

  fs.readFile(CredentialsFile, 'utf8', function (err, data) {

    var tmpList = new Array();
    var tmpProfile, tmpRegion;

    if (err) callback("getAWSProfiles func readFile err: " + err);
    else {
      var lines = data.split("\n");

      async.each(lines, function(l, next) {
        var line = l.trim();

        if( line.match( /^\[/ ) ){
          if(
            ! line.match(/\[preview\]/)
            && ! line.match(/\[default\]/)
            && ! line.match(/\[stop/)
            && ! line.match(/-s3/)
            && ! line.match(/-dynamodb/)
            && ! line.match(/-sns/)
          ) {
            tmpProfile = line.replace(/^\[/, '').replace(/\].*$/, '');
          }
        }

        if( line.match( /^region\s+=/ ) ) {
          tmpRegion = line.replace( /^region\s+=\s+/, '' );
          if( tmpProfile ){
            tmpList.push({ profile: tmpProfile, region: tmpRegion });
          }
        }
        next();
      },
      function(err){
        ProfileList = extend([], tmpList);
        callback(err);
      });

    }

  });

};

var getEIPs = function (callback){

  var tmpEIPs = new Array();

  async.each(ProfileList, function(List, next){

    var credentials = new AWS.SharedIniFileCredentials(
      {
        filename: CredentialsFile,
        profile : List.profile
      }
    );
    AWS.config.credentials = credentials;
    AWS.config.region      = List.region;

    var ec2 = new AWS.EC2({apiVersion: '2015-10-01'});
    var params = {};
    ec2.describeAddresses(params, function(err, data) {
      if (err) {
        if(err.statusCode !== 403) {
          error("getEIPs func ec2.describeAddresses profile: %s err: %s", List.profile, JsonString(err));
        }
        next();
      } else {
        if ( data.Addresses.length  < 1 ) next();
        else {

          var obj = {};
          obj.Profile = List.profile;
          obj.FunctionName = "platonIPcheck";
          obj.EIPs = new Array();
          async.each(data.Addresses, function(Addr, done){
            if( typeof Addr.PublicIp !== 'undefined' && typeof Addr.InstanceId !== 'undefined') {
              dns.reverse(Addr.PublicIp, function(err, name){
                var PublicDnsName;
                if ( !err && name.length > 0 ) {
                  if ( name[0].match(/.compute.amazonaws.com/) ) PublicDnsName = Addr.InstanceId;
                  else PublicDnsName = name[0];
                } else {
                  PublicDnsName = Addr.InstanceId;
                }
                var buf = {
                  PublicIp: Addr.PublicIp,
                  PublicDnsName: PublicDnsName,
                  InstanceId: Addr.InstanceId,
                  PrivateIpAddress: Addr.PrivateIpAddress
                };
                obj.EIPs.push(buf);
                done();
              });
            } else {
              done();
            }
          },
          function(err){
            // debug("obj: %s", JsonString(obj));
            if( obj.EIPs.length > 0 ) tmpEIPs.push(obj);
            next();
          });

        }
      }
    });

  },
  function(err){
    // debug("tmpEIPs: %s", JsonString(tmpEIPs));
    if( typeof IPsList.PingList !== 'undefined' ) {
      Array.prototype.push.apply(IPsList.PingList, tmpEIPs);
    } else {
      IPsList.PingLis = extend([], tmpEIPs);
    }

    callback(err);
  });

};

var getPingList = function (callback) {
  debug("Conf.PingList: %s", Conf.PingList);
  JsonGet(Conf.PingList, function(err, res, body){
    if(err) callback(err);
    else if(isEmpty(body.PingList)) callback("PingList is Empty.");
    else {
      var tmpList = new Array();
      async.each(body.PingList, function(List, next){
        if( typeof List.Disable !== 'undefined' && List.Disable === true ) return next();
        if( typeof List.JsonURL !== 'undefined' ) {
          JsonGet(List.JsonURL, function(err, res, body){
            if(err) error("getPingList JsonGet url: %s err: %s", List.JsonURL, err);
            else if( body.IPs !== 'undefined' ){
              Array.prototype.push.apply(tmpList, body.IPs);
            }
            next();
          });
        } else {
          next();
        }
      }, function(err){
        if(err) error("getPingList async.each err: %s", err);
        else{
          var obj = {};
          obj.PingList = tmpList;
          if( typeof body.Exclude !== 'undefined' ) obj.Exclude = body.Exclude;
          IPsList = extend({}, obj);
        }
        callback(null);
      });
    }
  });
};

var getServiceList = function (callback) {
  debug("Conf.ServiceList: %s", Conf.ServiceList);
  JsonGet(Conf.ServiceList, function(err, res, body){
    if(err) callback(err);
    else {

      var tmpList = new Array();

      async.series([
        function(cb) {
          if( typeof body.ServiceList !== 'undefined' ) {
            Array.prototype.push.apply(tmpList, body.ServiceList);
          }
          cb(null);
        },
        function(cb) {
          if( typeof body.Include === 'undefined' ) return cb(null);

          async.each(body.Include, function(Inc, next){
            if( typeof Inc.Disable !== 'undefined' && Inc.Disable === true ) return next();
            if( typeof Inc.URL === 'undefined' ) return next();

            JsonGet(Inc.URL, function(err, res, body){
              if(err) error("getServiceList JsonGet url %s err: %s", Inc.URL, err);
              else if( body.ServiceList !== 'undefined' ){
                Array.prototype.push.apply(tmpList, body.ServiceList);
              }
              next();
            });

          }, function(err){
            cb(err);
          });

        }
      ], function(err, results) {
        if(err) error("getServiceList async.each err: %s", err);
        else {
          var obj = {};
          obj.ServiceList = tmpList;
          if( typeof body.Exclude !== 'undefined' ) obj.Exclude = body.Exclude;
          ServiceList = extend({}, obj);
        }
        callback(null);
      });

    }
  });
};


var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded(
  { extended: true,
    parameterLimit: 10000,
    limit: 1024 * 1024 * 10
  }
));
// app.use( function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
//   next();
// });

app.get('/', function (req, res) {
  debug("req / :  %s", req.headers['user-agent']);
  log('express: Url: %s, IP: %s', req.originalUrl, req.ip);
  res.send('PLATON Server.\n');
});

app.get('/ENV', function (req, res) {
  log('express: Url: %s, IP: %s', req.originalUrl, req.ip);
  var EVN = {};
  ENV.procenv = (extend({}, process.env));
  if( typeof ENV.procenv.LS_COLORS !== 'undefined') delete ENV.procenv.LS_COLORS;
  res.send(JsonString(ENV));
});

app.get('/IPsList', function (req, res) {
  debug("IPsList request IP: %s", req.ip);
  res.send(JsonString(IPsList));
});

app.get('/ServiceList', function (req, res) {
  debug("ServiceList request IP: %s", req.ip);
  res.send(JsonString(ServiceList));
});

app.get('/ProfileList', function (req, res) {
  debug("ProfileList request IP: %s", req.ip);
  res.send(JsonString(ProfileList));
});

app.post('/IpCheckAlert', function(req, res) {
  debug("/IpCheckAlert Request body: %s", JsonString(req.body));
  if(DataCheck(req.body) === false) res.send( { Status : "Error Data not Object." } );
  else {
    res.send( { Status : "OK" } );

    var doc = req.body;
    var hashkey = doc.PublicIp;
    var AlertCount = cache.get(hashkey);

    if ( AlertCount ) doc.AlertCount = AlertCount + 1;
    else doc.AlertCount = 1;

    cache.put(hashkey, doc.AlertCount, AlertTTL);

    modDoc.PutItem(doc, 'PingAlert', function(err){
      if(err) error("modDoc putItem func err: %s", err);
    });

    var alert_cycle = AlertCycle;
    if ( doc.AlertCount > 10 ) alert_cycle = AlertCycle * 3;
    if ( doc.AlertCount > 30 ) alert_cycle = AlertCycle * 6;

    if ( doc.AlertCount % alert_cycle === 0 ) {
      modSlack.PostSend( JsonString(doc), AlertChannel, 'PingAlert', function(err, res) {
        if(err) error("IpCheckAlert modSlack.PostSend err: %s", err);
      });
    }

  }
});

app.post('/ServiceCheckAlert', function(req, res) {
  debug("/ServiceCheckAlert Request body: %s", JsonString(req.body));
  if(DataCheck(req.body) === false) res.send( { Status : "Error Data not Object." } );
  else {
    res.send( { Status : "OK" } );

    var doc = req.body;
    var hashkey = doc.Target;
    var AlertCount = cache.get(hashkey);

    if ( AlertCount ) doc.AlertCount = AlertCount + 1;
    else doc.AlertCount = 1;

    cache.put(hashkey, doc.AlertCount, AlertTTL);

    modDoc.PutItem(doc, 'ServiceAlert', function(err){
      if(err) error("modDoc putItem func err: %s", err);
    });

    var alert_cycle = AlertCycle;
    if ( doc.AlertCount > 10 ) alert_cycle = AlertCycle * 3;
    if ( doc.AlertCount > 30 ) alert_cycle = AlertCycle * 6;

    if ( doc.AlertCount % alert_cycle === 0 ) {
      modSlack.PostSend( JsonString(doc), AlertChannel, 'ServiceAlert', function(err, res) {
        if(err) error("ServiceCheckAlert modSlack.PostSend err: %s", err);
      });
    }

  }
});

app.listen(Conf.ListenPort);

var JsonLog = function (obj){
  return log(JsonString(obj));
};

var JsonString = function (obj) {
  return JSON.stringify(obj, null, "    ");
};

var DataCheck = function (body) {
  try{
    if(isEmpty(extend({}, body))) return false;
    return true;
  } catch (e) {
    return false;
  }
};

var JsonGet = function (url, cb) {
  var headers;
  headers = {
    'User-Agent': 'curl'
  };
  request.get({
    url: url,
    headers: headers,
    json: true
  }, function(err, res, body) {
    if(err) cb(err, res, "JsonGet func error.");
    else if (res.statusCode !== 200) cb('Error Respons statusCode.', res, body);
    else cb(err, res, body);
  });
};

function Main (callback) {

  async.series([
    function(done){

      getPingList(function(err){
        if(err) error("getPingList err: %s", err);
        // debug("IPsList: %s", JsonString(IPsList));
        done(null);
      });

    },
    function(done){

      getServiceList(function(err){
        if(err) error("getServiceList err: %s", err);
        // debug("ServiceList: %s", JsonString(ServiceList));
        done(null);
      });

    },
    function(done){

      getAWSProfiles(function(err){
        if(err) error("getAWSProfiles func err: %s", err);

        // debug("ProfileList: %s", JsonString(ProfileList));

        getEIPs(function(err){
          if(err) error("getEIPs func err: %s", err);
          done(null);
        });

      });

    }
    ], function(err, results) {

      // debug("results: %s", JsonString(results));
      callback(err, null);

    });

}

(function loop(){
  log('SRV Loop ( %d ).....', Conf.LoopTime);

  Main ( function (err, res) {
    if(err) error("Main Func err: %s", err)
    if(res) debug("Main res: %s", res);
    if ( global.gc ) global.gc();
  });
  setTimeout(loop, Conf.LoopTime);

})();
