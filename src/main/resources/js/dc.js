function IpseDataChannel(finger) {
    var loc = window.location
    var ws = null;
    var session;
    var toFinger;
    var myFinger;
    var peerCon;
    var that = this;
    var nonceS =null;

    var makeWs = function(finger) {
        if (!window.WebSocket) {
            window.WebSocket = window.MozWebSocket;
        }
        if (!window.WebSocket) {
            alert("Your browser does not support Web Sockets.");
            return;
        }

        var socket, protocol, host, port;
        protocol = "ws:"
        if (window.location.protocol === "https:") {
            protocol = "wss:"
        }
        host = window.location.host;
        port = "";
        if (window.location.port != "") {
            port = ":" + window.location.port
        }
        socket = new WebSocket(protocol + "//" + host + "/websocket/?finger=" + finger);
        session = "new"; // fix this

        socket.onopen = function(event) {
            console.log("wsopen " + JSON.stringify(event));
        };
        socket.onclose = function(event) {
            console.log("wsclose " + JSON.stringify(event));
            ws = null;
        };
        socket.onmessage = function(event) {
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
                pc.setRemoteDescription(rtcd, function() {
                    console.log("set " + data.type + " ok");
                    if (data.type == 'offer') {
                        var theirfp = JSON.stringify(data.sdp.contents[0].fingerprint.print);
                        theirfp = theirfp.split(":").join("");
                        theirfp = theirfp.split('"').join("");
                        console.log("their fingerprint is " + theirfp)
                        that.setTo(theirfp);
                        pc.createAnswer(function(desc) {
                            pc.setLocalDescription(desc, function() {
                                console.log("Set Local description " + JSON.stringify(desc));
                                if (window.showStatus){
                                   showStatus("Got Answer");
                                }
                            }, function(e) {
                                console.log("Set Local description error "+e);
                            });
                        }, function(e) {
                             console.log("Create answer error "+e );
                        });
                    }
                }, function(e) {
                        console.log("Set Remote description error "+e);
                });
            } else {
                console.log("no session in my data");
            }
        };
        return socket;
    };
    var logError = function(error) {
        console.log(error.name + ": " + error.message);
    };

    var withPc = function(pc) {
// send everything to the peer - via fingersmith
        pc.onicecandidate = function(evt) {
            if (evt.candidate === null) {
                var sdpObj = Phono.sdp.parseSDP(pc.localDescription.sdp);
                console.log("this.toFinger:" + this.toFinger);
                console.log("toFinger:" + toFinger);
                console.log("that.toFinger:" + that.toFinger);
                nonsense = sha256.hash(that.toFinger +":"+that.nonceS+":"+that.myFinger).toUpperCase();
                // add sha256 here in a moment.
                var sdpcontext = {
                "to": that.toFinger,
                "from": that.myFinger,
                "type": pc.localDescription.type,
                "sdp": sdpObj,
                "session": session,
                "nonsense":nonsense
                };
                console.log("sending:" + JSON.stringify(sdpcontext))

                that.ws.send(JSON.stringify(sdpcontext));
                if (window.showStatus){
                    showStatus("Sent offer.");
                }
            } else {
                console.log("ignoring local trickling candidates for now")
                if (window.showStatus){
                    showStatus("Gathering candidates.");
                }
            }
        };
        // let the "negotiationneeded" event trigger offer generation
        pc.onnegotiationneeded = function() {
            var sdpConstraints = {'mandatory': {'OfferToReceiveAudio': false, 'OfferToReceiveVideo': false}}
            pc.createOffer(function(desc) {
                pc.setLocalDescription(desc, function() {
                    console.log("Set Local description");
                }, logError);
            }, logError, sdpConstraints);
        }
        that.peerCon = pc;
        pc.ondatachannel = function(evt){
            if (that.ondatachannel){
                that.ondatachannel(evt);
            }
        };
        that.myFinger = finger;
        that.ws = makeWs(finger);
    }
    var configuration = {"iceServers": [
            {url: "stun:stun.l.google.com:19302"}//,
        ]};
    if (typeof webkitRTCPeerConnection == "function") {
        var pc = new webkitRTCPeerConnection(configuration, null);
        withPc(pc);
    } else if (typeof mozRTCPeerConnection == "function") {
        Ipseorama.addMyCertToPeerConf(configuration, function() {
            var mozpc = new mozRTCPeerConnection(configuration, null)
            withPc(mozpc);
        });
    }
}

IpseDataChannel.prototype.createDataChannel = function(name, props) {
    return this.peerCon.createDataChannel(name, props)
}
IpseDataChannel.prototype.setTo = function(tof) {
    this.toFinger = tof;
    var d = new Date();
    var n = d.getTime();
    this.session = this.finger + "-" + tof + "-" + n; // fix this
    console.log("this.toFinger:" + this.toFinger);
};
IpseDataChannel.prototype.setNonce= function(n){
    this.nonceS = n;
};
IpseDataChannel.prototype.setOnDataChannel = function(callback) {
    this.ondatachannel = function(evt) {
        callback(evt.channel);
    };
}

