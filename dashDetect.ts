import * as express from 'express';
import * as httpPackage from 'http';
import * as cmd from 'node-cmd';
import * as socketIo from 'socket.io';

const app = express();
const http = new httpPackage.Server(app);
const io = socketIo(http);

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

var poll = () => {
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
                });
        }
    );
};

var isDashButton = (macAddr: string): boolean => {
    return this.amazonMacAddr.some(amzMacAddr => {
        return macAddr.toUpperCase().indexOf(amzMacAddr) === 0;
    });
}

var start = (): void => {
    var iplist = [];
    for(var i = 0; i< 255; i++) {
        iplist.push(false);

        var ipaddress = "192.168.0." + i;
        cmd.get(
            "ping " + ipaddress + " -n 1",
            (err, data, stderr) => {
                iplist[i] = true;
            }
        );
    }

    var checkPingComplete = () => {
        var count = iplist.filter(item => item).length;
        io.emit("ip-table", count + " of 255");

        if (count < 255) {
            setTimeout(checkPingComplete(), 100);
        } else {
            this.poll();
        }
    }

    checkPingComplete();
}

module.exports = {
    start: start()
}