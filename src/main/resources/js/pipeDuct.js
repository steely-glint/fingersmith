function PipeDuct(finger,oldws) {
    this.loc = window.location
    this.ws = oldws;
    this.session = null;
    this.toFinger = null;
    this.myFinger = finger;
    this.peerCon = null;
    this.nonceS = null;
    this.nonsense = "";
    this.candyStash = [];
    this.openTimer;
    this.patches = [];
    this.sdpConstraints = {'mandatory': {'OfferToReceiveAudio': false, 'OfferToReceiveVideo': false}}



}
PipeDuct.prototype.connect = function() {
    var that = this;

    var promise = new Promise(function(resolve, reject) {
            var configuration = {
                "iceServers": [
                    {urls: "stun:146.148.121.175:3478"},
                    //{urls: "turn:146.148.121.175:3478?transport=udp", 'credential': 'nexus5x', 'username': 'smartphone'},
                    //{url: "turn:146.148.121.175:3478?transport=tcp", 'credential': 'nexus5x', 'username': 'smartphone'},
                    //{url: "turn:146.148.121.175:443?transport=tcp", 'credential': 'nexus5x', 'username': 'smartphone'}
                ],
                //"iceTransportPolicy": "relay",
                //"bundlePolicy":"max-bundle"
            };

            PipeDb.addMyCertToPeerConf(configuration, function () {
                var wcpc = new RTCPeerConnection(configuration, null)
                that.withPc(wcpc, resolve);
            });
    });
    return promise;
}
PipeDuct.prototype.getWs = function () {
    return this.ws;
}
PipeDuct.prototype.setAnswerPatch = function (patch) {
    this.patches['answer'] = patch;
}

PipeDuct.prototype.makeWs = function (resolve) {
    if (!window.WebSocket) {
        window.WebSocket = window.MozWebSocket;
    }
    if (!window.WebSocket) {
        alert("Your browser does not support Web Sockets.");
        return;
    }
    var that = this;
    var socket, protocol, host, port;
    protocol = "ws:"
    if (window.location.protocol === "https:") {
        protocol = "wss:"
    }
    host = window.location.host;


    if (host.includes("localhost")){ //debugging typically
        host="pi.pe";
        protocol="wss:";
    }

    // reuse of existing ws.
    if (this.ws != null){
        socket = this.ws;
    }else {
        socket = new WebSocket( protocol + "//" + host + "/websocket/?finger=" + this.myFinger);
    }

    socket.onopen = function (event) {
        console.log("wsopen " + JSON.stringify(event));
        resolve(that);
    };
    socket.onclose = function (event) {
        console.log("wsclose " + JSON.stringify(event));
        ws = null;
    };
    socket.onmessage = function (event) {
        console.log("message is " + event.data);
        if (that.openTimer){
            clearInterval(that.openTimer);
            that.openTimer = null;
        }
        var data = JSON.parse(event.data);
        console.log("data is " + JSON.stringify(data));

        if (data.session) {
            var pc = that.peerCon;
            if (data.type == 'candidate') {
                var jc = {
                    sdpMLineIndex: data.sdpMLineIndex,
                    candidate: Phono.sdp.buildCandidate(data.candidate)
                };
                console.log("adding candidate " + JSON.stringify(jc));
                var nc = "Huh? ";
                nc = new RTCIceCandidate(jc);
                pc.addIceCandidate(nc);
            }
            if ((data.type == 'offer') || (data.type == 'answer')) {
                var sdp = Phono.sdp.buildSDP(data.sdp);
                if(that.patches[data.type]){
                    sdp = Phono.sdp.patch(sdp,that.patches[data.type]).sdp;
                }
                console.log("sent sdp is " + sdp);
                if (window.showStatus) {
                    showStatus("Got "+data.type);
                }
                var message = {'sdp': sdp, 'type': data.type};
                var rtcd;
                rtcd = new RTCSessionDescription(message);
                console.log("rtcd is " + rtcd);
                pc.setRemoteDescription(rtcd, function () {
                    console.log("set " + data.type + " ok");
                    if (data.type == 'offer') {
                        var theirfp = JSON.stringify(data.sdp.contents[0].fingerprint.print);
                        theirfp = theirfp.split(":").join("");
                        theirfp = theirfp.split('"').join("");
                        console.log("their fingerprint is " + theirfp)
                        that.setTo(theirfp);
                        this.session = data.session;
                        pc.createAnswer(function (desc) {
                            pc.setLocalDescription(desc, function () {
                                console.log("Set Local description");
                                that.sendSDP(pc);
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
            }
        } else {
            console.log("no session in my data");
        }
    };
    this.ws =  socket;
};
PipeDuct.prototype.logError = function (error) {
    console.log(error.name + ": " + error.message);
};

PipeDuct.prototype.mayNeedAudioLater = function(patch){
    this.sdpConstraints.mandatory.OfferToReceiveAudio = true;
    this.setAnswerPatch(patch);
}
PipeDuct.prototype.withPc = function (pc,promise) {
// send everything to the peer - via fingersmith
    var that = this;
    pc.onicecandidate = function (evt) {
        if (evt.candidate != null) {
            if (pc.signalingState == 'stable') {
                that.sendCandy(evt.candidate);
            } else {
                that.stashCandy(evt.candidate);
            }
        }
    };
    // let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = function () {
        pc.createOffer(function (desc) {
            pc.setLocalDescription(desc, function () {
                console.log("Set Local description");
                that.sendSDP(pc);
            }, that.logError);
        }, that.logError, that.sdpConstraints);
    }
    pc.onsignalingstatechange = function (evt) {
        console.log("signalling state is " + pc.signalingState);
        if (pc.signalingState == 'stable') {
            var can;
            while (can = that.candyStash.pop()) {
                console.log("popping candidate off stash")
                that.sendCandy(can);
            }
        }
    };
    this.peerCon = pc;
    pc.ondatachannel = function (evt) {
        if (that.ondatachannel) {
            that.ondatachannel(evt);
        }
    };
    this.makeWs(promise);
}


PipeDuct.prototype.createDataChannel = function (name, props) {
    return this.peerCon.createDataChannel(name, props)
}
PipeDuct.prototype.setTo = function (tof) {
    this.toFinger = tof;
    var d = new Date();
    var n = d.getTime();
    this.session = this.myFinger + "-" + tof + "-" + n; // fix this
    console.log("this.toFinger:" + this.toFinger);
};
PipeDuct.prototype.addRemote = function (tag,done) {
    var that = this;
    if (typeof webkitRTCPeerConnection == "function") {
        console.log("Peer connection does not have sctp - use getstats ?");
        this.peerCon.getStats(function (res) {
            res.result().forEach(function (result) {
                console.log(">>>>type>>" + result.type);
                console.log(">>>>id>>>>" + result.id);
                if (result.type === "googCertificate") {
                    var print = result.stat("googFingerprint");
                    var fcert = result.stat("googDerBase64");
                    print = print.split(":").join("");
                    if (print === that.toFinger) {
                        // ToDo - really need to grab this once - and store it or it becomes a 3rd party metadata source.
                        // and ideally use random hash not our FP? Needs thought.
                        if (tag == null) {
                            tag = "https://robohash.org/"+print+".jpg?size=320x240&ignoreext=false";
                        }
                        var printncert = {finger: print, cert: fcert, tag: tag};
                        console.log("adding matching print+cert " + JSON.stringify(printncert));
                        PipeDb.dbAddPrint(printncert, function () {
                            console.log("add print done.")
                            if (done){
                                done();
                            }
                        })

                    } else {
                        console.log("skipping print " + print + " is not " + that.toFinger);
                    }

                } else {
                    /*result.names().forEach(function (name) {
                     console.log(name + " = " + result.stat(name))
                     });*/
                }
            });
        });
    } else {
        var cert = "unavailable";
        if (this.peerCon.sctp) {
            console.log("Peer connection does have sctp");
            if (this.peerCon.sctp.transport) {
                console.log("have dtls transport");
                var certs = this.peerCon.sctp.transport.getRemoteCertificates()
                console.log(certs);
                cert = certs[0]; // or perhaps to bas 64 ?
            }
        }
        var printncert = {finger: this.toFinger, cert: cert, tag: tag};
        console.log("adding matching print+cert " + JSON.stringify(printncert));
        PipeDb.dbAddPrint(printncert, function () {
            console.log("add print done.")
        });
        console.log("this.toFinger:" + this.toFinger);
    }
};
PipeDuct.prototype.setNonce = function (n) {
    this.nonceS = n;
};
PipeDuct.prototype.setOnDataChannel = function (callback) {
    this.ondatachannel = function (evt) {
        callback(evt.channel);
    };
};
PipeDuct.prototype.sendSDP = function (pc) {
    var that = this;

    var sdpObj = Phono.sdp.parseSDP(pc.localDescription.sdp);
    console.log("this.toFinger:" + this.toFinger);
    if (this.nonceS) {
        this.nonsense = sha256.hash(this.toFinger + ":" + this.nonceS + ":" + this.myFinger).toUpperCase();
    }
    var sdpcontext = {
        "to": this.toFinger,
        "from": this.myFinger,
        "type": pc.localDescription.type,
        "sdp": sdpObj,
        "session": this.session,
        "nonsense": this.nonsense,
        "retry":0
    };
    var sendFunc =function () {
        console.log("sending:" + JSON.stringify(sdpcontext));
        that.ws.send(JSON.stringify(sdpcontext));
        if (window.showStatus) {
            showStatus("Sent " + sdpcontext.type + " retry number "+sdpcontext.retry);
        }
        sdpcontext.retry ++;
        if (sdpcontext.retry > 5){
            if (that.openTimer){
                clearInterval(that.openTimer);
                console.log("given up on:" + JSON.stringify(sdpcontext));
                if (window.showStatus) {
                    showStatus("Giving up on connection");
                }
            }
        }
    };
    this.openTimer = setInterval(sendFunc, 5000);
    sendFunc();
}

PipeDuct.prototype.sendCandy = function (cand) {
    var can_j = Phono.sdp.parseCandidate("a=" + cand.candidate);
    var candy = {
        "to": this.toFinger,
        "type": 'candidate',
        "candidate": can_j,
        "session": this.session,
        "from": this.myFinger,
        "sdpMLineIndex": cand.sdpMLineIndex,
        "nonsense": this.nonsense

    };
    console.log("send <- " + JSON.stringify(candy))

    this.ws.send(JSON.stringify(candy));
    if (window.showStatus) {
        showStatus("Sending candidates.");
    }
};
PipeDuct.prototype.stashCandy = function (cand) {
    this.candyStash.push(cand);
};
