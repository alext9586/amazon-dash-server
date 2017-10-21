var app = require('express')();
var bodyParser = require('body-parser');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cmd = require('node-cmd');
var network = require('network');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
http.listen(3000, function () {
    console.log('listening on *:3000');
});
io.on('connection', function (sock) {
    sock.emit('connection-made', null);
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
        this.subnetStart = 0;
        this.subnetEnd = 255;
        this.watchEnd = false;
        var maskedIpLength = gatewayIp.lastIndexOf(".") + 1;
        this.maskedIp = gatewayIp.substr(0, maskedIpLength);
    }
    DashDetect.prototype.isDashButton = function (macAddr) {
        return this.amazonMacAddr.some(function (amzMacAddr) {
            return macAddr.toUpperCase().indexOf(amzMacAddr) === 0;
        });
    };
    DashDetect.prototype.parseArpResult = function (data) {
        var _this = this;
        return data.split("\r\n")
            .map(function (item) { return item.trim(); })
            .map(function (item) { return item.split(" ").filter(function (item) { return item.trim() !== ""; }); })
            .filter(function (item) { return item.length === 3; })
            .map(function (item) {
            var subnetAddr = item[0].substr(item[0].lastIndexOf('.') + 1);
            return {
                subnetAddr: +subnetAddr,
                ipAddr: item[0],
                macAddr: item[1],
                isDashButton: _this.isDashButton(item[1])
            };
        })
            .filter(function (item) { return item.ipAddr.indexOf(_this.maskedIp) !== -1; });
    };
    DashDetect.prototype.displayArpTable = function () {
        var sb = [];
        this.detectedMacAddr.forEach(function (item) {
            sb.push(item.ipAddr + " : " + item.macAddr + " " + (item.isDashButton ? "<- Amazon Device" : ""));
        });
        this.socket.emit("arp-table", sb.join('\r\n'));
    };
    DashDetect.prototype.doArp = function (callback, ipaddress) {
        cmd.get("arp " + ipaddress + " -a", function (err, data, stderr) {
            callback(err, data, stderr);
        });
    };
    DashDetect.prototype.ping = function (ipaddress, tries, callback) {
        cmd.get("ping " + ipaddress + " -w 1 -n " + tries, function (err, data, stderr) {
            callback(err, data, stderr);
        });
    };
    DashDetect.prototype.checkPing = function (i) {
        var _this = this;
        var ipaddress = this.maskedIp + i;
        var checkEndPing = function () {
            if (i === _this.subnetEnd) {
                setTimeout(function () {
                    _this.socket.emit("ip-table", "Ping Sweep Complete");
                    _this.detectedMacAddr.sort(function (a, b) {
                        if (a.subnetAddr < b.subnetAddr)
                            return -1;
                        if (a.subnetAddr > b.subnetAddr)
                            return 1;
                        return 0;
                    });
                    _this.displayArpTable();
                }, 500);
            }
        };
        this.ping(ipaddress, 5, function (err, data, stderr) {
            _this.socket.emit("ip-table", i + " of 255");
            if (data.toUpperCase().indexOf("REPLY")) {
                _this.doArp(function (err, data, stderr) {
                    var parsedData = _this.parseArpResult(data);
                    if (parsedData[0]) {
                        _this.detectedMacAddr.push(parsedData[0]);
                    }
                    checkEndPing();
                }, ipaddress);
            }
            else {
                checkEndPing();
            }
        });
        if (i < this.subnetEnd) {
            setTimeout(function () {
                _this.checkPing(i + 1);
            }, 50);
        }
    };
    DashDetect.prototype.setSubnetRange = function (start, end) {
        this.subnetStart = start;
        this.subnetEnd = end;
    };
    DashDetect.prototype.start = function () {
        this.socket.emit("ip-table", "Starting Ping Sweep...");
        this.detectedMacAddr = [];
        this.checkPing(this.subnetStart);
    };
    DashDetect.prototype.watch = function (ipaddress) {
        var _this = this;
        this.ping(ipaddress, 1, function (err, data, stderr) {
            var interval = 5;
            if (data.toUpperCase().indexOf("BYTES=") > 0) {
                interval = 10000;
                console.log("button pressed");
                _this.socket.emit("dash-button-pressed", true);
            }
            if (_this.watchEnd) {
                _this.watchEnd = false;
            }
            else {
                setTimeout(function () {
                    _this.watch(ipaddress);
                }, interval);
            }
        });
    };
    DashDetect.prototype.endWatch = function () {
        this.watchEnd = true;
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
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
app.post('/scan', function (req, res) {
    dashDetect.setSubnetRange((+req.body.subnetStart || 0), (+req.body.subnetEnd || 255));
    dashDetect.start();
    res.send("Scan Started");
});
app.post('/watch', function (req, res) {
    var action = req.body.action.toUpperCase();
    if (action === "START") {
        var ipaddress = req.body.ipaddress;
        dashDetect.watch(ipaddress);
    }
    else {
        dashDetect.endWatch();
    }
    res.send("Watch Success");
});
//# sourceMappingURL=app.js.map