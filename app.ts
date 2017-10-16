var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cmd = require('node-cmd');
var network = require('network');

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

class DashDetect{
    private amazonMacAddr: string[] = [
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

    private detectedMacAddr: IArp[] = [];
    private maskedIp: string = "";

    constructor(private socket, private gatewayIp: string) {
        var maskedIpLength = gatewayIp.lastIndexOf(".") + 1;
        this.maskedIp = gatewayIp.substr(0, maskedIpLength);

        socket.on('connection', (sock) => {
            sock.on('start-poll', (msg) => {
                console.log("start pressed");
                dashDetect.start();
            });
        });
    }

    private isDashButton(macAddr: string): boolean {
        return this.amazonMacAddr.some(amzMacAddr => {
            return macAddr.toUpperCase().indexOf(amzMacAddr) === 0;
        });
    }

    private poll() {
        cmd.get(
            'arp -a',
            (err, data, stderr) => {
                this.detectedMacAddr = data.split("\r\n")
                    .map(item => item.trim())
                    .map(item => item.split(" ").filter(item => item.trim() !== ""))
                    .filter(item => item.length === 3)
                    .map((item) => {
                        return <IArp>{
                            ipAddr: item[0],
                            macAddr: item[1],
                            isDashButton: this.isDashButton(item[1])
                        }
                    })
                    .filter(item => item.ipAddr.indexOf(this.maskedIp) !== -1);

                var sb: string[] = [];
                this.detectedMacAddr.forEach((item) => {
                    sb.push(`${item.ipAddr} : ${item.macAddr} ${item.isDashButton ? "<- Amazon Device" : ""}`)
                });
                this.socket.emit("arp-table", sb.join('\r\n'));
            }
        );
    }

    private checkPing(i): void {
        var ipaddress = this.maskedIp + i;
        cmd.get(
            "ping " + ipaddress + " -n 1",
            (err, data, stderr) => {
                this.socket.emit("ip-table", i + " of 255");
                if (i === 255) {
                    setTimeout(() => {
                        this.socket.emit("ip-table", "Ping Sweep Complete");
                        this.poll();
                    }, 500);
                }
            }
        );

        if (i < 255) {
            setTimeout(() => {
                this.checkPing(i + 1);
            }, 100);
        }
    }

    public start(): void {
        this.checkPing(0);
    }
}

var dashDetect;
network.get_gateway_ip((err, ip) => {
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