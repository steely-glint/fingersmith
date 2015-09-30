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
            console.log("Sdp "+data.type+" is " + sdp);
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
                        that.createVideo('answer');
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
    var that = this;
    this.youVid.src = URL.createObjectURL(evt.stream);
    this.youVid.onloadedmetadata = function(e) {
        that.youVid.play();
    };
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
    this.createVideo('offer');
}

IpseDataChannel.prototype.createVideo = function (act) {
    var constraints = {
        video: { width: 640, height: 480 },
        audio: false // silence is golden in demos.
    };
    var that = this;
    var addstream = function (stream) {
        that.meVid.src = URL.createObjectURL(stream);
        that.meVid.onloadedmetadata = function(e) {
            that.meVid.play();
        };
        that.peerCon.addStream(stream);
        if (act == 'answer'){
            that.createAnswer();
        } else if (act == 'offer'){
            that.createOffer();
        } else {
            console.log("unknown act ? "+act);
        }

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
    if (sdpO.sdp){
        sdp = sdpO.sdp;
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


