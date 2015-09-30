var IpseDataChannel = function (finger, wssLoc) {
    this.finger = finger;
    this.wssUrl = wssLoc;
    this.ws = null;
    this.session = "new";
    this.toFinger = undefined;
    this.peerCon = undefined;
    this.meVid = undefined;
    this.youVid = undefined;

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


IpseDataChannel.prototype.setVideoElms = function (me, you) {
    this.meVid = me;
    this.youVid = you;
}

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
        console.log("recv -> " + event.data);
        var pc = that.peerCon;

        var data = JSON.parse(event.data);
        if (data.type == 'candidate') {
            var jc = {
                sdpMLineIndex: data.candidate.sdpMLineIndex,
                candidate: data.candidate.candidate
            };
            var nc = "Huh? ";
            if (typeof mozRTCIceCandidate == "function") {
                nc = new mozRTCIceCandidate(jc);
            } else {
                nc = new RTCIceCandidate(jc);
            }
            pc.addIceCandidate(nc);
        }
        if ((data.type == 'offer') || (data.type == 'answer')) {
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
                    if (that.hasMedia(data,'video')){
                        that.createVideo(that.createAnswer);
                    } else {
                        that.createAnswer();
                    }
                }
            }, function (e) {
                console.log("Set Remote description error " + e);
            });
        }
    };
    return socket;
};

IpseDataChannel.prototype.logError = function (error) {
    console.log(error.name + ": " + error.message);
};

IpseDataChannel.prototype.onnegotiationneeded = function () {
    console.log("In onnegotiationneeded ");
}

IpseDataChannel.prototype.createAnswer = function () {
    var pc = this.peerCon;
    var that = this;
    pc.createAnswer(function (desc) {
        pc.setLocalDescription(desc, function () {
            console.log("Set Local description " + JSON.stringify(desc));
            if (window.showStatus) {
                showStatus("Got Answer");
            }
            that.sendLocal();
        }, function (e) {
            console.log("Set Local description error " + e);
        });
    }, function (e) {
        console.log("Create answer error " + e);
    });
}

IpseDataChannel.prototype.createOffer = function () {
    var sdpConstraints = {};
    var that = this;
    this.peerCon.createOffer(function (desc) {
        that.peerCon.setLocalDescription(desc, function () {
            console.log("Set Local description");
            that.sendLocal();
        }, that.logError);
    }, this.logError, sdpConstraints);
}

IpseDataChannel.prototype.ondatachannel = function (evt) {
    if (this.ondatachannel) {
        this.ondatachannel(evt);
    }
};

IpseDataChannel.prototype.onaddstream = function (evt) {
    this.youVid.src = URL.createObjectURL(evt.stream);
};

IpseDataChannel.prototype.sendLocal = function () {
    var sdpObj = Phono.sdp.parseSDP(this.peerCon.localDescription.sdp);
    console.log("this.toFinger:" + this.toFinger);

    var sdpcontext = {
        "to": this.toFinger,
        "type": this.peerCon.localDescription.type,
        "sdp": sdpObj,
        "session": this.session,
        "from": this.finger

    };
    console.log("send <- " + JSON.stringify(sdpcontext))

    this.ws.send(JSON.stringify(sdpcontext));
    if (window.showStatus) {
        showStatus("Sent sdp.");
    }
}

IpseDataChannel.prototype.onicecandidate = function (evt) {
    if (evt.candidate != null) {
        var candy = {
            "to": this.toFinger,
            "type": 'candidate',
            "candidate": evt.candidate,
            "session": this.session,
            "from": this.finger
        };
        console.log("send <- " + JSON.stringify(candy))

        this.ws.send(JSON.stringify(candy));
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
    pc.onaddstream = function (evt) {
        that.onaddstream(evt);
    };
    if (this.wssUrl == undefined) {
        this.wssUrl = this.makeWSUrl();
    }
    this.ws = this.makeWs();
};

IpseDataChannel.prototype.createDataChannel = function (name, props) {
    var dc = this.peerCon.createDataChannel(name, props);
    this.createOffer();
    return dc;
}

IpseDataChannel.prototype.createCall = function () {
    this.createVideo(this.createOffer);
}

IpseDataChannel.prototype.createVideo = function (act) {
    var constraints = {
        video: true,
        audio: false // silence is golden in demos.
    };
    var that = this;
    var addstream = function (stream) {
        that.meVid.src = URL.createObjectURL(stream);
        that.peerCon.addStream(stream);
        act();
    }
    if ((navigator.mediaDevices) && (typeof navigator.mediaDevices.getUserMedia == 'function')) {
        var p = navigator.mediaDevices.getUserMedia(constraints);
        p.then(addstream);
        p.catch(that.logError);
    } else if (typeof navigator.mozGetUserMedia == 'function') {
        navigator.mozGetUserMedia(constraints, addstream, this.logError);
    } else if (typeof navigator.webkitGetUserMedia == 'function') {
        navigator.webkitGetUserMedia(constraints, addstream, this.logError);
    } else {
        console.log("No Gum ?");
    }
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
IpseDataChannel.prototype.hasMedia = function(sdpO, mtype){
    var ret = false;
    if (sdp0.sdp){
        sdp = sdp0.sdp;
        for (var n in sdp.contents){
            var cont = sdp.contents[n];
            if (cont.media){
                if (cont.media.type == mtype){
                    ret = true;
                    break;
                }
            }
        }
    }
    return ret;
}

_thing = {
    "to": "556329103E22DE09CA2DA0098873185845C114D755C3EFDAE2852FE31F158DBA",
    "type": "offer",
    "sdp": {
        "contents": [{
            "candidates": [],
            "codecs": [{"id": "100", "name": "VP8", "clockrate": "90000"}, {
                "id": "116",
                "name": "red",
                "clockrate": "90000"
            }, {"id": "117", "name": "ulpfec", "clockrate": "90000"}, {
                "id": "96",
                "name": "rtx",
                "clockrate": "90000"
            }],
            "sctpmap": [],
            "extmap": [{"num": "2", "name": "urn:ietf:params:rtp-hdrext:toffset"}, {
                "num": "3",
                "name": "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time"
            }, {"num": "4", "name": "urn:3gpp:video-orientation"}],
            "ice": {"ufrag": "R2SpRXt/SczfR608", "pwd": "Ptt+xP6BkeyDdgB8WJ7A/N5L"},
            "media": {"type": "video", "port": "9", "proto": "RTP/SAVPF", "pts": ["100", "116", "117", "96"]},
            "connection": {"nettype": "IN", "addrtype": "IP4", "address": "0.0.0.0"},
            "rtcp": {"port": "9", "nettype": "IN", "addrtype": "IP4", "address": "0.0.0.0"},
            "fingerprint": {
                "hash": "sha-256",
                "print": "AD:50:5C:02:53:B5:40:2B:1E:41:BF:1B:EF:CA:46:00:ED:55:C2:E1:41:AE:54:14:EC:F3:B6:BD:2D:E0:E3:C1",
                "required": "1"
            },
            "setup": "actpass",
            "mid": "video",
            "direction": "sendrecv",
            "rtcp-mux": true,
            "ssrc": {
                "ssrc": "2688921042",
                "cname": "Rbe8dfX7TzCowmxe",
                "msid": "cEcVgHMsJFfIXen4bmxNdvREogjqfqeRT0oU",
                "mslabel": "cEcVgHMsJFfIXen4bmxNdvREogjqfqeRT0oU",
                "label": "3217d60c-862e-451a-9017-8b50d3f9d5e6"
            }
        }],
        "session": {
            "username": "-",
            "id": "2592799876580971709",
            "ver": "2",
            "nettype": "IN",
            "addrtype": "IP4",
            "address": "127.0.0.1"
        },
        "group": {"type": "BUNDLE", "contents": ["video"]}
    },
    "session": "AD505C0253B5402B1E41BF1BEFCA4600ED55C2E141AE5414ECF3B6BD2DE0E3C1-556329103E22DE09CA2DA0098873185845C114D755C3EFDAE2852FE31F158DBA-1443621840114",
    "from": "AD505C0253B5402B1E41BF1BEFCA4600ED55C2E141AE5414ECF3B6BD2DE0E3C1"
};

