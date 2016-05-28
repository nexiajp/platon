'use strict';

var debug   = require('debug')('modSlack');
debug.log   = console.log.bind(console);
var error   = console.error;
var log     = console.log;

var isEmpty = require('./isEmpty');

var Slack = require('slack-node');
var Token = require('./.Conf-Srv.json').SlackToken;
var WebhookUri  = "https://hooks.slack.com/services" + Token;

var DefUsername = "Platon-Check";
var DefChannel  = "#alert";
var DefMessage  = "this message is test POST to [#tmp] channel";

function postSend ( message, channel, username, callback) {
  if( isEmpty(message) )  message  =  DefMessage;
  if( isEmpty(channel) )  channel  =  DefChannel;
  if( isEmpty(username) ) username =  DefUsername;

  var slack = new Slack();
  slack.setWebhook(WebhookUri);

  slack.webhook({
    channel: channel,
    username: username,
    text: message
  }, function(err, res) {
    callback(err, res);
  });
}
exports.PostSend = postSend;
