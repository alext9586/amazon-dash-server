var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cmd = require('node-cmd');

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});

// https://github.com/fiveseven808/AmazonDashButtonHack/blob/master/src/AmazonButton_Discovery_160715_2304.ahk

interface IArp {
    ipAddr: string;
    macAddr: string;
    isDashButton: boolean;
}

var amazonMacAddr: string[] = [
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

var detectedMacAddr: IArp[] = [];

var isDashButton = (macAddr: string): boolean => {
    return amazonMacAddr.some(amzMacAddr => {
        return macAddr.toUpperCase().indexOf(amzMacAddr) === 0;
    });
};

var poll = () => {
    cmd.get(
        'arp -a',
        (err, data, stderr) => {
            detectedMacAddr = data.split("\r\n")
                .map(item => item.trim())
                .map(item => item.split(" ").filter(item => item.trim() !== ""))
                .filter(item => item.length === 3)
                .map((item) => {
                    return <IArp>{
                        ipAddr: item[0],
                        macAddr: item[1],
                        isDashButton: isDashButton(item[1])
                    }
                });
            
            var sb: string[] = [];
            detectedMacAddr.forEach((item) => {
                sb.push(`${item.ipAddr} : ${item.macAddr} ${item.isDashButton ? "<-" : ""}`)
            });
            io.emit("arp-table", sb.join('\r\n'));
        }
    );
};

var start = (): void => {
    var checkPing = (i) => {
        var ipaddress = "192.168.0." + i;
        cmd.get(
            "ping " + ipaddress + " -n 1",
            (err, data, stderr) => {
                io.emit("ip-table", i + " of 255");
                if (i === 255) {
                    setTimeout(() => {
                        io.emit("ip-table", "Ping Sweep Complete");
                        poll();
                    }, 500);
                }
            }
        );

        if (i < 255) {
            setTimeout(() => {
                checkPing(i + 1);
            }, 100);
        }
    };

    checkPing(0);
};

io.on('connection', (socket) => {
    socket.on('start-poll', (msg) => {
        console.log("start pressed");
        start();
    });
});