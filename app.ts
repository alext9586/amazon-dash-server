var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cmd = require('node-cmd');

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// io.on('connection', function (socket) {
//     socket.on('chat message', function (msg) {
//         io.emit('chat message', msg);
//     });
// });

http.listen(3000, () => {
    console.log('listening on *:3000');
});

var poll = (counter) => {
    cmd.get(
        'arp -a',
        (err, data, stderr) => {
            var message = "Attempt: " + counter + "\r\n" + data;
            io.emit("arp-table", message);
            var splitData = data.split("\r\n")
                .map(item=>item.trim())
                .map(item => item.split(" ").filter(t => t.trim() !== ""))
                .filter(t2 => t2.length === 3);
            
            console.log(splitData);
        }
    );
};

var counter = 0;
var maxCounter = 1;

var tickFcn = () =>  {
    setTimeout(() =>  {
        poll(counter);
        if (counter < maxCounter) {
            counter++;
            tickFcn();
        }
     }, 10);
};

var iplist = [];
var recursivePing = (addr) => {
    var ipaddress = "192.168.0." + addr;
    cmd.get(
        "ping " + ipaddress + " -n 1",
        (err, data, stderr) => {
            iplist[addr] = true;
        }
    );
};

var start = () =>  {
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
    setTimeout(() =>  {
        var count = iplist.filter(item => item).length;
        io.emit("ip-table", count + " of 255");
        poll(1);
    }, 10000);
};


io.on('connection', (socket) => {
    socket.on('start-poll', function (msg) {
        start();
    });

    socket.on('stop-poll', (msg) => {
        counter = maxCounter;
    });
});

// https://github.com/fiveseven808/AmazonDashButtonHack/blob/master/src/AmazonButton_Discovery_160715_2304.ahk