/* 
 * soucecode copyright Westhawk Ltd 2014 - all rights reserved.
 */

;
(function() {
    Ipseorama = {
        addMyCertToPeerConf: function (peerconf) {
            myCert = localStorage["IpseCert"];
            if !(myCert){
                console.log("")
                myCert = mozRTCPeerConnection.generateCertificate( { name: "ECDSA", namedCurve: "P-256" })
            }
        },
        getFinger: function(descsdp) {
            var sdp = Phono.sdp.parseSDP(descsdp)
            var myfp = JSON.stringify(sdp.contents[0].fingerprint.print);
            myfp = myfp.split(":").join("");
            myfp = myfp.split('"').join("");
            console.log("fingerprint is " + myfp)
            return myfp;
        },
        whoAmI: function(okCB, failCB) {
            if window.localstore
            var peerconfig = {"iceServers": [{url: "stun:stun.l.google.com:19302"}]};
            var offerCreated = function(localDesc) {
                var myfp = Ipseorama.getFinger(localDesc.sdp)
                okCB(myfp);
            }
            var pc = null;
                if (typeof webkitRTCPeerConnection == "function") {
                    pc = new webkitRTCPeerConnection(peerconfig, null);
                } else if (typeof mozRTCPeerConnection == "function") {
                    if (typeof mozRTCPeerConnection.generateCertificate == "function"){
                        addMyCertToPC(peerconfig);
                    }
                    pc = new mozRTCPeerConnection(peerconfig, null);
                }
            pc.createDataChannel('channel', {});
            pc.createOffer(offerCreated,
                    function(e) {
                        failCB("Couldn't creat offer")
                    },
                    {mandatory: {
                            OfferToReceiveVideo: false,
                            OfferToReceiveAudio: false,
                        }});
        }
    }
}());


