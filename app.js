var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cmd = require('node-cmd');
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
http.listen(3000, function () {
    console.log('listening on *:3000');
});
var amazonMacAddr = [
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
var detectedMacAddr = [];
var isDashButton = function (macAddr) {
    return amazonMacAddr.some(function (amzMacAddr) {
        return macAddr.toUpperCase().indexOf(amzMacAddr) === 0;
    });
};
var poll = function () {
    cmd.get('arp -a', function (err, data, stderr) {
        detectedMacAddr = data.split("\r\n")
            .map(function (item) { return item.trim(); })
            .map(function (item) { return item.split(" ").filter(function (item) { return item.trim() !== ""; }); })
            .filter(function (item) { return item.length === 3; })
            .map(function (item) {
            return {
                ipAddr: item[0],
                macAddr: item[1],
                isDashButton: isDashButton(item[1])
            };
        });
        var sb = [];
        detectedMacAddr.forEach(function (item) {
            sb.push(item.ipAddr + " : " + item.macAddr + " " + (item.isDashButton ? "<-" : ""));
        });
        io.emit("arp-table", sb.join('\r\n'));
    });
};
var start = function () {
    var checkPing = function (i) {
        var ipaddress = "192.168.0." + i;
        cmd.get("ping " + ipaddress + " -n 1", function (err, data, stderr) {
            io.emit("ip-table", i + " of 255");
            if (i === 255) {
                setTimeout(function () {
                    io.emit("ip-table", "Ping Sweep Complete");
                    poll();
                }, 500);
            }
        });
        if (i < 255) {
            setTimeout(function () {
                checkPing(i + 1);
            }, 100);
        }
    };
    checkPing(0);
};
io.on('connection', function (socket) {
    socket.on('start-poll', function (msg) {
        console.log("start pressed");
        start();
    });
});
//# sourceMappingURL=app.js.map