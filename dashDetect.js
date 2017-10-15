"use strict";
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var httpPackage = require("http");
var cmd = require("node-cmd");
var socketIo = require("socket.io");
var app = express();
var http = new httpPackage.Server(app);
var io = socketIo(http);
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
var poll = function () {
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
        });
    });
};
var isDashButton = function (macAddr) {
    return _this.amazonMacAddr.some(function (amzMacAddr) {
        return macAddr.toUpperCase().indexOf(amzMacAddr) === 0;
    });
};
var start = function () {
    var iplist = [];
    for (var i = 0; i < 255; i++) {
        iplist.push(false);
        var ipaddress = "192.168.0." + i;
        cmd.get("ping " + ipaddress + " -n 1", function (err, data, stderr) {
            iplist[i] = true;
        });
    }
    var checkPingComplete = function () {
        var count = iplist.filter(function (item) { return item; }).length;
        io.emit("ip-table", count + " of 255");
        if (count < 255) {
            setTimeout(checkPingComplete(), 100);
        }
        else {
            _this.poll();
        }
    };
    checkPingComplete();
};
module.exports = {
    start: start()
};
