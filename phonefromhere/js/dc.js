var IpseDataChannel = function (finger, wssLoc) {
    this.finger = finger;
    this.wssUrl = wssLoc;
    this.ws = null;
    this.session = "new";
    this.toFinger = undefined;
    this.peerCon = undefined;
    var configuration = {
        "iceServers": [
            {urls: "stun:146.148.121.175:3478"},
            {
                urls: 'turn:146.148.121.175:3478',
                username: 'pet',
                credential: 'snoopy'
            },
            {
                urls: 'turn:146.148.121.175:443',
                username: 'owner',
                credential: 'charliebrown'
            },
            {urls: "stun:stun.l.google.com:19302"},

        ]
    };
    if (typeof webkitRTCPeerConnection == "function") {
        var pc = new webkitRTCPeerConnection(configuration, null);
        this.withPc(pc);
    } else if (typeof mozRTCPeerConnection == "function") {
        var that = this;
        Ipseorama.addMyCertToPeerConf(configuration, function () {
            var mozpc = new mozRTCPeerConnection(configuration, null)
            that.withPc(mozpc);
        });
    }
};
IpseDataChannel.prototype.makeWSUrl = function () {
    var protocol, host, port;
    protocol = "ws:"
    if (window.location.protocol === "https:") {
        protocol = "wss:"
    }
    host = window.location.host;
    port = "";
    if (window.location.port != "") {
        port = ":" + window.location.port

    }
    return (protocol + "//" + host + "/websocket/?finger=")
};

IpseDataChannel.prototype.makeWs = function () {
    var socket;
    var that = this;

    if (!window.WebSocket) {
        window.WebSocket = window.MozWebSocket;
    }
    if (!window.WebSocket) {
        alert("Your browser does not support Web Sockets.");
        return;
    }

    socket = new WebSocket(this.wssUrl + this.finger);

    socket.onopen = function (event) {
        console.log("wsopen " + JSON.stringify(event));
    };
    socket.onclose = function (event) {
        console.log("wsclose " + JSON.stringify(event));
        this.ws = null;
    };
    socket.onmessage = function (event) {
        console.log("message is " + event.data);

        var data = JSON.parse(event.data);
        console.log("data is " + JSON.stringify(data));

        if (data.session) {
            var pc = that.peerCon;
            var sdp = Phono.sdp.buildSDP(data.sdp);
            console.log("answer sdp is " + sdp);
            var message = {'sdp': sdp, 'type': data.type};
            var rtcd;
            if (typeof mozRTCSessionDescription == "function") {
                rtcd = new mozRTCSessionDescription(message);
            } else {
                rtcd = new RTCSessionDescription(message);
            }
            console.log("rtcd is " + rtcd);
            pc.setRemoteDescription(rtcd, function () {
                console.log("set " + data.type + " ok");
                if (data.type == 'offer') {
                    var theirfp = JSON.stringify(data.sdp.contents[0].fingerprint.print);
                    theirfp = theirfp.split(":").join("");
                    theirfp = theirfp.split('"').join("");
                    console.log("their fingerprint is " + theirfp)
                    that.setTo(theirfp);
                    pc.createAnswer(function (desc) {
                        pc.setLocalDescription(desc, function () {
                            console.log("Set Local description " + JSON.stringify(desc));
                            if (window.showStatus) {
                                showStatus("Got Answer");
                            }
                        }, function (e) {
                            console.log("Set Local description error " + e);
                        });
                    }, function (e) {
                        console.log("Create answer error " + e);
                    });
                }
            }, function (e) {
                console.log("Set Remote description error " + e);
            });
        } else {
            console.log("no session in my data");
        }
    };
    return socket;
};

IpseDataChannel.prototype.logError = function (error) {
    console.log(error.name + ": " + error.message);
};

IpseDataChannel.prototype.onnegotiationneeded = function () {
    var sdpConstraints = {'mandatory': {'OfferToReceiveAudio': false, 'OfferToReceiveVideo': false}}
    var that = this;
    this.peerCon.createOffer(function (desc) {
        that.peerCon.setLocalDescription(desc, function () {
            console.log("Set Local description");
        }, that.logError);
    }, this.logError, sdpConstraints);
}

IpseDataChannel.prototype.ondatachannel = function (evt) {
    if (this.ondatachannel) {
        this.ondatachannel(evt);
    }
};

IpseDataChannel.prototype.onicecandidate = function (evt) {
    if (evt.candidate === null) {
        var sdpObj = Phono.sdp.parseSDP(this.peerCon.localDescription.sdp);
        console.log("this.toFinger:" + this.toFinger);

        var sdpcontext = {
            "to": this.toFinger,
            "type": this.peerCon.localDescription.type,
            "sdp": sdpObj,
            "session": this.session
        };
        console.log("sending:" + JSON.stringify(sdpcontext))

        this.ws.send(JSON.stringify(sdpcontext));
        if (window.showStatus) {
            showStatus("Sent offer.");
        }
    } else {
        console.log("ignoring local trickling candidates for now")
        if (window.showStatus) {
            showStatus("Gathering candidates.");
        }
    }
};

IpseDataChannel.prototype.withPc = function (pc) {
// send everything to the peer - via fingersmith
    this.peerCon = pc;
    var that = this;
    pc.onicecandidate = function (evt) {
        that.onicecandidate(evt);
    };
    pc.onnegotiationneeded = function () {
        that.onnegotiationneeded();
    };
    pc.ondatachannel = function (evt) {
        that.ondatachannel(evt);
    };
    if (this.wssUrl == undefined) {
        this.wssUrl = this.makeWSUrl();
    }
    this.ws = this.makeWs();
};

IpseDataChannel.prototype.createDataChannel = function (name, props) {
    return this.peerCon.createDataChannel(name, props)
}
IpseDataChannel.prototype.setTo = function (tof) {
    this.toFinger = tof;
    var d = new Date();
    var n = d.getTime();
    this.session = this.finger + "-" + tof + "-" + n; // fix this
    console.log("this.toFinger:" + this.toFinger);
}
IpseDataChannel.prototype.setOnDataChannel = function (callback) {
    this.ondatachannel = function (evt) {
        callback(evt.channel);
    };
}

