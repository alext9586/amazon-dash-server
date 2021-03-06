var app = require('express')();
var bodyParser = require('body-parser');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cmd = require('node-cmd');
var network = require('network');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

http.listen(3000, () => {
    console.log('listening on *:3000');
});

io.on('connection', (sock) => {
    sock.emit('connection-made', null);
});


// https://github.com/fiveseven808/AmazonDashButtonHack/blob/master/src/AmazonButton_Discovery_160715_2304.ahk

interface IArp {
    subnetAddr: number;
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
    private subnetStart: number = 0;
    private subnetEnd: number = 255;
    private watchEnd: boolean = false;

    constructor(private socket, private gatewayIp: string) {
        var maskedIpLength = gatewayIp.lastIndexOf(".") + 1;
        this.maskedIp = gatewayIp.substr(0, maskedIpLength);
    }

    private isDashButton(macAddr: string): boolean {
        return this.amazonMacAddr.some(amzMacAddr => {
            return macAddr.toUpperCase().indexOf(amzMacAddr) === 0;
        });
    }

    private parseArpResult(data: string): IArp[] {
        return data.split("\r\n")
            .map(item => item.trim())
            .map(item => item.split(" ").filter(item => item.trim() !== ""))
            .filter(item => item.length === 3)
            .map((item) => {
                var subnetAddr = item[0].substr(item[0].lastIndexOf('.') + 1);
                return <IArp>{
                    subnetAddr: +subnetAddr,
                    ipAddr: item[0],
                    macAddr: item[1],
                    isDashButton: this.isDashButton(item[1])
                }
            })
            .filter(item => item.ipAddr.indexOf(this.maskedIp) !== -1);
    }

    private displayArpTable(): void {
        var sb: string[] = [];
        this.detectedMacAddr.forEach((item) => {
            sb.push(`${item.ipAddr} : ${item.macAddr} ${item.isDashButton ? "<- Amazon Device" : ""}`)
        });

        this.socket.emit("arp-table", sb.join('\r\n'));
    }

    private doArp(callback: Function, ipaddress?: string): void {
        cmd.get(
            `arp ${ipaddress} -a`,
            (err, data, stderr) => {
                callback(err, data, stderr);
            }
        );
    }

    private ping(ipaddress: string, tries: number, callback: Function): void {
        cmd.get(
            `ping ${ipaddress} -w 1 -n ${tries}`,
            (err, data, stderr) => {
                callback(err, data, stderr);
            }
        );
    }

    private checkPing(i): void {
        var ipaddress = this.maskedIp + i;

        var checkEndPing = () => {
            if (i === this.subnetEnd) {
                setTimeout(() => {
                    this.socket.emit("ip-table", "Ping Sweep Complete");
                    this.detectedMacAddr.sort((a, b) => {
                        if (a.subnetAddr < b.subnetAddr)
                            return -1;
                        
                        if (a.subnetAddr > b.subnetAddr)
                            return 1;
                        
                        return 0;
                    });
                    this.displayArpTable();
                }, 500);
            }
        };

        this.ping(ipaddress, 5, (err, data, stderr) => {
            this.socket.emit("ip-table", i + " of 255");
            if (data.toUpperCase().indexOf("REPLY")) {
                this.doArp((err, data, stderr) => {
                    var parsedData = this.parseArpResult(data);
                    if (parsedData[0]) {
                        this.detectedMacAddr.push(parsedData[0]);
                    }    
                    checkEndPing();
                }, ipaddress);
            } else {
                checkEndPing();
            }
            
        });

        if (i < this.subnetEnd) {
            setTimeout(() => {
                this.checkPing(i + 1);
            }, 50);
        }
    }

    public setSubnetRange(start: number, end: number): void {
        this.subnetStart = start;
        this.subnetEnd = end;
    }

    public start(): void {
        this.socket.emit("ip-table", "Starting Ping Sweep...");
        this.detectedMacAddr = [];
        this.checkPing(this.subnetStart);
    }

    public watch(ipaddress: string): void {
        this.ping(ipaddress, 1, (err, data, stderr) => {
            var interval = 5;
            
            if (data.toUpperCase().indexOf("BYTES=") > 0) {
                interval = 10000;
                console.log("button pressed");
                this.socket.emit("dash-button-pressed", true);
            }

            if (this.watchEnd) {
                this.watchEnd = false;
            } else {
                setTimeout(() => {
                    this.watch(ipaddress);
                }, interval);
            }
        });
    }

    public endWatch() {
        this.watchEnd = true;
    }
}

var dashDetect;
network.get_gateway_ip((err, ip) => {
    console.log(err || ip); // err may be 'No active network interface found.'

    if (!err) {
        dashDetect = new DashDetect(io, ip);
    }    
});

app.get('/', (req, res) => {
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
    } else {
        dashDetect.endWatch();
    }    
    res.send("Watch Success");
});