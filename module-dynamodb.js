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
var credentials = new AWS.SharedIniFileCredentials(
  {
    filename: process.env.HOME + '/.aws/credentials',
    profile: 'nexia-dynamodb'
  }
);
vogels.AWS.config.credentials = credentials;
vogels.AWS.config.update({ region: "us-west-2" });

exports.setSchemaIPcheck = function (){
  var name = 'IPcheck';
  var IPcheck = vogels.define( name, {
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
  return IPcheck;
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
