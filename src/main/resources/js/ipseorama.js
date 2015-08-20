/* 
 * soucecode copyright Westhawk Ltd 2014 - all rights reserved.
 */

;
(function() {
    Ipseorama = {
        getFinger: function(descsdp) {
            var sdp = Phono.sdp.parseSDP(descsdp)
            var myfp = JSON.stringify(sdp.contents[0].fingerprint.print);
            myfp = myfp.split(":").join("");
            myfp = myfp.split('"').join("");
            console.log("fingerprint is " + myfp)
            return myfp;
        },
        whoAmI: function(okCB, failCB) {
            var peerconfig = {"iceServers": [{url: "stun:stun.l.google.com:19302"}]};
            var offerCreated = function(localDesc) {
                var myfp = Ipseorama.getFinger(localDesc.sdp)
                okCB(myfp);
            }
            var pc = null;
                if (typeof webkitRTCPeerConnection == "function") {
                    pc = new webkitRTCPeerConnection(peerconfig, null);
                } else if (typeof mozRTCPeerConnection == "function") {
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


