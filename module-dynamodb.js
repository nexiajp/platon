'use strict';

var debug  = require('debug')('modDynamoDB');
debug.log  = console.log.bind(console);
var error  = console.error;
var log    = console.log;

var vogels = require('vogels'),
    AWS    = vogels.AWS,
    Joi    = require('joi');

var moment = require('moment');

/// AWS Setting
var Conf = require('./.Conf-Srv.json').DynamoDB;
var credentials = new AWS.SharedIniFileCredentials(
  {
    filename: process.env.HOME + '/.aws/credentials',
    profile: Conf.profile
  }
);
vogels.AWS.config.credentials = credentials;
vogels.AWS.config.update({ region: Conf.region });

exports.setSchemaPingAlert = function (){
  var name = 'PingAlert';
  var PingAlert = vogels.define( name, {
    hashKey  : 'FunctionName',
    rangeKey : 'Time',
    schema : {
      FunctionName  : Joi.string(),
      Time          : Joi.number().default((new Date()).getTime()),
      DateTime      : Joi.string(),
      Profile       : Joi.string(),
      CheckHost     : Joi.string(),
      PublicIp      : Joi.string(),
      PublicDnsName : Joi.string(),
    },
    tableName : function () {
      var d = new Date();
      var year  = d.getFullYear();
      var month = ('0' + (d.getMonth() + 1)).slice(-2);

      return [ name, year + month ].join('_');
    },
    indexes : [
      {
        hashKey  : 'Profile',
        rangeKey : 'DateTime',
        name     : 'ProfileIndex',
        type     : 'global'
      }
    ]
  });
  return PingAlert;
}

exports.setSchemaServiceAlert = function (){
  var name = 'ServiceAlert';
  var ServiceAlert = vogels.define( name, {
    hashKey  : 'FunctionName',
    rangeKey : 'Time',
    schema : {
      FunctionName  : Joi.string(),
      Time          : Joi.number().default((new Date()).getTime()),
      DateTime      : Joi.string(),
      Profile       : Joi.string(),
      System        : Joi.string(),
      Target        : Joi.string(),
      Status        : Joi.string(),
    },
    tableName : function () {
      var d = new Date();
      var year  = d.getFullYear();
      var month = ('0' + (d.getMonth() + 1)).slice(-2);

      return [ name, year + month ].join('_');
    },
    indexes : [
      {
        hashKey  : 'Profile',
        rangeKey : 'DateTime',
        name     : 'ProfileIndex',
        type     : 'global'
      }
    ]
  });
  return ServiceAlert;
}

exports.getTableName = function ( Name ){
  var d = new Date();
  var year  = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2);

  return [ Name, year + month ].join('_');
}

exports.createTable = function ( callback ) {
  vogels.createTables( function (err) {
    callback(err);
  });
}

function JsonString(obj){
  return JSON.stringify(obj, null, "    ");
}

function getDateTime(){
  return moment().format('YYYY-MM-DD HH:mm:ss');
}
