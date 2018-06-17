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
    this.candyRStash = [];
    this.openTimer;
    this.onextra;
    this.patches = [];
    this.sdpConstraints = {'mandatory': {'OfferToReceiveAudio': false, 'OfferToReceiveVideo': false}}
    this.configuration = {
                "iceServers": [
                    {urls: "stun:146.148.121.175:3478"},
                    {urls: "turn:146.148.121.175:3478?transport=udp", 'credential': 'snoopy', 'username': 'pet'},
                ],
                //"iceTransportPolicy": "relay",
                "bundlePolicy":"max-bundle","iceCandidatePoolSize":1
            };


}
PipeDuct.prototype.connect = function() {
    var that = this;

    var promise = new Promise(function(resolve, reject) {

            PipeDb.addMyCertToPeerConf(that.configuration, function () {
                var wcpc = new RTCPeerConnection(that.configuration, null)
                that.withPc(wcpc, resolve);
            });
    });
    return promise;
}
PipeDuct.prototype.tohex = function(buffer) {
  var hexCodes = [];
  var view = new DataView(buffer);
  for (var i = 0; i < view.byteLength; i += 4) {
    // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
    var value = view.getUint32(i)
    // toString(16) will give the hex representation of the number without padding
    var stringValue = value.toString(16)
    // We use concatenation and slice for padding
    var padding = '00000000'
    var paddedValue = (padding + stringValue).slice(-padding.length)
    hexCodes.push(paddedValue);
  }

  // Join all the hex strings into one
  return hexCodes.join("");
}
PipeDuct.prototype.setOnextra = function (extract) {
    return this.onextra = extract;
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
    if (host.includes("github.io")){ //poc typically
        host="pi.pe";
        protocol="wss:";
    } 

    // reuse of existing ws.
    if (this.ws != null){
        socket = this.ws;
    }else {
        socket = new WebSocket( protocol + "//" + host + "/websocket/?finger=" + this.myFinger);
    }
    if (socket.readyState != 1) {
        socket.onopen = function (event) {
            console.log("wsopen " + JSON.stringify(event));
            resolve(that);
        };
    }
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
                if (pc.signalingState == 'stable') {
                   pc.addIceCandidate(nc);
                } else {
                   console.log("stashing remote")
                   that.candyRStash.push(nc);
                } 
            }
            if ((data.type == 'offer') || (data.type == 'answer')) {
                var sdp = Phono.sdp.buildSDP(data.sdp);
                if(that.patches[data.type]){
                    sdp = Phono.sdp.patch(sdp,that.patches[data.type]).sdp;
                } /*else if (pc.signalingState == 'stable') {
                   console.log("already stable");
                   return;
                }*/
                console.log("sent sdp is " + sdp);
                if (window.showStatus) {
                    showStatus("Got "+data.type);
                }
                var message = {'sdp': sdp, 'type': data.type};
                var rtcd;
                rtcd = new RTCSessionDescription(message);
                console.log("rtcd is " + rtcd);
                pc.setRemoteDescription(rtcd).then(function () {
                    console.log("set " + data.type + " ok");
                    if (data.type == 'offer') {
                        var theirfp = JSON.stringify(data.sdp.contents[0].fingerprint.print);
                        theirfp = theirfp.split(":").join("");
                        theirfp = theirfp.split('"').join("");
                        console.log("their fingerprint is " + theirfp)
                        that.setTo(theirfp);
                        this.session = data.session;
                        pc.createAnswer().then(function (desc) {
                            pc.setLocalDescription(desc).then ( function () {
                                console.log("Set Local description");
                                that.sendSDP(pc);
                            }).catch( function (e) {
                                console.log("Set Local description error " + e);
                            });
                        }).catch( function (e) {
                            console.log("Create answer error " + e);
                        });
                    }
                }).catch( function (e) {
                    console.log("Set Remote description error " + e);
                });
            }
            if (data.type == 'extra') {
                if (data.extra && that.onextra)
                that.onextra(data.extra);
            }
            } else {
            console.log("no session in my data");
        }
    };
    this.ws =  socket;
    if (socket.readyState == 1){
        resolve(this);
    }
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
        console.log("local candidate")
        if (evt.candidate != null) {
            if (pc.signalingState == 'stable') {
                console.log("sending")
                that.sendCandy(evt.candidate);
            } else {
                console.log("stashing")
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
            var nc;
            while (nc = that.candyRStash.pop()) {
                console.log("popping Remote candidate off stash")
                pc.addIceCandidate(nc);
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
    this.peerCon.getStats().then(function (res) {
        // ToDo - really need to grab this once - and store it or it becomes a 3rd party metadata source.
        // and ideally use random hash not our FP? Needs thought.
        if (tag == null) {
            tag = "https://robohash.org/"+print+".jpg?size=320x240&ignoreext=false";
        }
        var printncert = {finger: that.toFinger, cert: "unavailable-firefox-cert", tag: tag};
        res.forEach(function (result) {
            console.log(">>>>type>>" + result.type);
            console.log(">>>>id>>>>" + result.id);
            if (result.type === "certificate") {
                var print = result.fingerprint
                print = print.split(":").join("");
                if (print === printncert.finger) {
                    printncert.cert= result.base64Certificate;;
                    console.log("found matching print ");
                } else {
                    console.log("skipping print " + print + " is not " + that.toFinger);
                }
            } else {
                console.log("Entry ->"+JSON.stringify(result));
            }
        });
        console.log("adding print+cert " + JSON.stringify(printncert));
        PipeDb.dbAddPrint(printncert, function () {
            console.log("add print done.")
            if (done){
                done();
            }
        })
    });


};
/*function sha256(str) {
  // We transform the string into an arraybuffer.
  var buffer = new TextEncoder("utf-8").encode(str);
  return crypto.subtle.digest("SHA-256", buffer).then(function (hash) {
    return hex(hash);
  });
} */
PipeDuct.prototype.setNonce = function (n) {
    this.nonceS = n;
    var that = this;
    var sense =this.toFinger + ":" + this.nonceS + ":" + this.myFinger; 
    console.log("sense : "+ sense); 
    var buffer = new TextEncoder("utf-8").encode(sense);
    return crypto.subtle.digest("SHA-256", buffer).then(function (hash) {
        that.nonsense = that.tohex(hash).toUpperCase();
    });
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
    this.openTimer = setInterval(sendFunc, 15000);
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
