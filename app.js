var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cmd = require('node-cmd');
var network = require('network');
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
http.listen(3000, function () {
    console.log('listening on *:3000');
});
var DashDetect = /** @class */ (function () {
    function DashDetect(socket, gatewayIp) {
        this.socket = socket;
        this.gatewayIp = gatewayIp;
        this.amazonMacAddr = [
            "74-C2-46-",
            "F0-D2-F1-",
            "0C-47-C9-",
            "44-65-0D-",
            "50-F5-DA-",
            "74-75-48-",
            "84-D6-D0-",
            "F0-27-2D-",
            "A0-02-DC-",
            "AC-63-BE-"
        ];
        this.detectedMacAddr = [];
        this.maskedIp = "";
        var maskedIpLength = gatewayIp.lastIndexOf(".") + 1;
        this.maskedIp = gatewayIp.substr(0, maskedIpLength);
        socket.on('connection', function (sock) {
            sock.on('start-poll', function (msg) {
                console.log("start pressed");
                dashDetect.start();
            });
        });
    }
    DashDetect.prototype.isDashButton = function (macAddr) {
        return this.amazonMacAddr.some(function (amzMacAddr) {
            return macAddr.toUpperCase().indexOf(amzMacAddr) === 0;
        });
    };
    DashDetect.prototype.poll = function () {
        var _this = this;
        cmd.get('arp -a', function (err, data, stderr) {
            _this.detectedMacAddr = data.split("\r\n")
                .map(function (item) { return item.trim(); })
                .map(function (item) { return item.split(" ").filter(function (item) { return item.trim() !== ""; }); })
                .filter(function (item) { return item.length === 3; })
                .map(function (item) {
                return {
                    ipAddr: item[0],
                    macAddr: item[1],
                    isDashButton: _this.isDashButton(item[1])
                };
            })
                .filter(function (item) { return item.ipAddr.indexOf(_this.maskedIp) !== -1; });
            var sb = [];
            _this.detectedMacAddr.forEach(function (item) {
                sb.push(item.ipAddr + " : " + item.macAddr + " " + (item.isDashButton ? "<- Amazon Device" : ""));
            });
            _this.socket.emit("arp-table", sb.join('\r\n'));
        });
    };
    DashDetect.prototype.checkPing = function (i) {
        var _this = this;
        var ipaddress = this.maskedIp + i;
        cmd.get("ping " + ipaddress + " -n 1", function (err, data, stderr) {
            _this.socket.emit("ip-table", i + " of 255");
            if (i === 255) {
                setTimeout(function () {
                    _this.socket.emit("ip-table", "Ping Sweep Complete");
                    _this.poll();
                }, 500);
            }
        });
        if (i < 255) {
            setTimeout(function () {
                _this.checkPing(i + 1);
            }, 100);
        }
    };
    DashDetect.prototype.start = function () {
        this.checkPing(0);
    };
    return DashDetect;
}());
var dashDetect;
network.get_gateway_ip(function (err, ip) {
    console.log(err || ip); // err may be 'No active network interface found.'
    if (!err) {
        dashDetect = new DashDetect(io, ip);
    }
});
/* what the fuck
https://github.com/oneillsp96/node-amazon-dash-button-windows
*/
// var Cap = require('cap').Cap,
//     decoders = require('cap').decoders,
//     PROTOCOL = decoders.PROTOCOL;
// var c = new Cap(),
//     device = Cap.findDevice(),
//     filter = 'arp',
//     bufSize = 10 * 1024 * 1024,
//     buffer = new Buffer(65535);
// var linkType = c.open(device, filter, bufSize, buffer);
// c.setMinBytes && c.setMinBytes(0);
// var just_emitted = {};
// just_emitted = false;
// c.on('packet', function (nbytes, trunc) {
//     console.log('packet: length ' + nbytes + ' bytes, truncated? '
//         + (trunc ? 'yes' : 'no'));
//     if (linkType === 'ETHERNET') {
//         var ret = decoders.Ethernet(buffer);
//         // console.log("protocol: " + PROTOCOL.ETHERNET[ret.info.type]);
//         if (ret.info.type === PROTOCOL.ETHERNET.ARP) {
//             // console.log('Decoding ARP ...');
//             // console.log("srcmac " + ret.info.srcmac);
//         }
//         if (ret.info.srcmac === "44:65:0d:0d:70:73") {
//             if (!just_emitted) {
//                 console.log("amazon dash button pressed");
//                 just_emitted = true;
//                 setTimeout(function () { just_emitted = false; }, 3000); //sometimes one click triggers 2 or more ARP requests, this prevents multiple actions taking placep
//             }
//         }
//     }
// }); 
//# sourceMappingURL=app.js.map