'use strict';

var Conf  = require('./.Conf-Srv.json');

var debug = require('debug')('SRV');
debug.log = console.log.bind(console);
var error = console.error;
var log   = console.log;

var request    = require('request');
var express    = require('express');
var isEmpty    = require('./isEmpty');
var extend     = require('util')._extend
var async      = require('async');

var IPsList     = new Array();
var ServiceList = new Array();


(function loop(){
  log('SRV Loop ( %d ).....', Conf.LoopTime);

  var P = getPingList(function(err){
    if(err) error("getPingList err: %s", err);
    debug("IPsList: %s", JsonString(IPsList));
  });

  var S = getServiceList(function(err){
    if(err) error("getServiceList err: %s", err);
    debug("ServiceList: %s", JsonString(ServiceList));
  });

  setTimeout(loop, Conf.LoopTime);
})();

function getPingList (callback) {
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
        else IPsList = extend([], tmpList);
        callback(null);
      });
    }
  });
}

function getServiceList (callback) {
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
        else ServiceList = extend([], tmpList);
        callback(null);
      });

    }
  });
}


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

app.get('/IPsList', function (req, res) {
  res.send(JsonString(IPsList));
});

app.get('/ServiceList', function (req, res) {
  res.send(JsonString(ServiceList));
});

app.listen(Conf.ListenPort);

function JsonLog(obj){
  return log(JsonString(obj));
}

function JsonString(obj) {
  return JSON.stringify(obj, null, "    ");
}

function JsonGet (url, cb) {
  var headers, get;
  headers = {
    'User-Agent': 'curl'
  };
  get = request.get({
    url: url,
    headers: headers,
    json: true
  }, function(err, res, body) {
    if(err) cb(err, res, "JsonGet func error.");
    else if (res.statusCode !== 200) cb('Error Respons statusCode.', res, body);
    else cb(err, res, body);
  });
}
