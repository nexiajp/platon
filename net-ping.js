var ping  = require("net-ping");
var log   = console.log;

// ping Default options
var PingOptions = {
    networkProtocol: ping.NetworkProtocol.IPv4,
    packetSize: 16,
    retries: 3,
    sessionId: (process.pid % 65535),
    timeout: 2000,
    ttl: 128
};

var IPs = [ "54.65.83.103", "54.65.158.4", "54.65.57.39" ];
var session = ping.createSession (PingOptions);

for(var i in IPs){
  session.pingHost (IPs[i], function (err, target) {
    log("IP : " + target);
    if (err)
      if (err instanceof ping.RequestTimedOutError)
        msg = "Ping Err: Not alive.";
      else
        msg = "Ping Err: " + err.toString() + ".";
    else
      msg = "Ping Alive.";
    log(msg);
  });
}
