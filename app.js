var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cmd = require('node-cmd');
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
// io.on('connection', function (socket) {
//     socket.on('chat message', function (msg) {
//         io.emit('chat message', msg);
//     });
// });
http.listen(3000, function () {
    console.log('listening on *:3000');
});
var poll = function (counter) {
    cmd.get('arp -a', function (err, data, stderr) {
        var message = "Attempt: " + counter + "\r\n" + data;
        io.emit("arp-table", message);
        var splitData = data.split("\r\n")
            .map(function (item) { return item.trim(); })
            .map(function (item) { return item.split(" ").filter(function (t) { return t.trim() !== ""; }); })
            .filter(function (t2) { return t2.length === 3; });
        console.log(splitData);
    });
};
var counter = 0;
var maxCounter = 1;
var tickFcn = function () {
    setTimeout(function () {
        poll(counter);
        if (counter < maxCounter) {
            counter++;
            tickFcn();
        }
    }, 10);
};
var iplist = [];
var recursivePing = function (addr) {
    var ipaddress = "192.168.0." + addr;
    cmd.get("ping " + ipaddress + " -n 1", function (err, data, stderr) {
        iplist[addr] = true;
    });
};
var start = function () {
    iplist = [];
    for (var i = 0; i < 255; i++) {
        iplist.push(false);
        recursivePing(i);
    }
    // var count = iplist.filter(function (item) { return item; }).length;
    // while (count < 255) {
    //     io.emit("ip-table", count + " of 255");
    //     count = iplist.filter(function (item) { return item; }).length;
    // }
    setTimeout(function () {
        var count = iplist.filter(function (item) { return item; }).length;
        io.emit("ip-table", count + " of 255");
        poll(1);
    }, 10000);
};
io.on('connection', function (socket) {
    socket.on('start-poll', function (msg) {
        start();
    });
    socket.on('stop-poll', function (msg) {
        counter = maxCounter;
    });
});
// https://github.com/fiveseven808/AmazonDashButtonHack/blob/master/src/AmazonButton_Discovery_160715_2304.ahk 
