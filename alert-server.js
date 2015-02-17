var log  = console.log;
var http = require('http');

http.createServer(function (req, res) {
  if (req.url === '/platon/alert' && req.method=='POST') {
    var body = '';
    req.on('data', function (dat) {
      body +=dat;
    });
    req.on('end',function(){
      try {
        var obj = JSON.parse(body);
        if (! obj.Alert) {
          log("%s - Error Not Implemented. %s", (new Date()), req.ip);
          res.writeHead(403, {'Content-Type':'application/json; charset=utf-8'});
          res.end('{"result":"Error Not Implemented"}\n');
        } else {
          log("%s - Platon Alert Request POST. %s", (new Date()), req.ip);
          text = JSON.stringify(obj, null, "    ");
          log(text);
          //res.writeHead(200, {'Content-Type': 'text/plain'});
          res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
          res.end('{"result":"Alert POST OK"}\n');
        }
      } catch (e) {
        log("%s -   Fail this request. %s", (new Date()), req.ip);
        res.writeHead(501, {'Content-Type':'application/json; charset=utf-8'});
        res.end('{"result":"Fail this request."}\n');
      }
    });
  }
}).listen(9090);
