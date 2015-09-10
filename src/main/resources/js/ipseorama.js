/* 
 * soucecode copyright Westhawk Ltd 2014 - all rights reserved.
 */

;
(function() {
    Ipseorama = {
        db: null,
        createCert: function(app, doneCB) {
            var creq = mozRTCPeerConnection.generateCertificate({name: "ECDSA", namedCurve: "P-256"})
            creq.then(function(cert) {
                var tx = Ipseorama.db.transaction("IpseCert", "readwrite");
                var store = tx.objectStore("IpseCert");
                store.put({app: app, cert: cert});
                tx.oncomplete = function() {
                    doneCB(cert);
                };
            }
            );

        },
        findOrCreateCert: function(app, doneCB) {
            var tx = Ipseorama.db.transaction("IpseCert", "readonly");
            var store = tx.objectStore("IpseCert");
            var index = store.index("by_app");
            var request = index.get(app);
            request.onsuccess = function(ev) {
                var matching = ev.result;
                if (matching !== undefined) {
                    // A match was found.
                    doneCB(matching.cert);
                } else {
                    // No match was found. - yet
                    Ipseorama.createCert(app, doneCB);
                }
            };
        },
        findOrCreateCertAndDB: function(app, doneCB) {
            if (Ipseorama.db == null) {
                var request = indexedDB.open("IpseCert");
                request.onupgradeneeded = function() {
                    var db = request.result;
                    // The database did not previously exist, so create object stores and indexes. var db = request.result;
                    var store = db.createObjectStore("IpseCert", {keyPath: "app"});
                    var appIndex = store.createIndex("by_app", "app");
                };
                request.onsuccess = function() {
                    Ipseorama.db = request.result;
                    Ipseorama.findOrCreateCert(app, doneCB);
                };
            } else {
                Ipseorama.findOrCreateCert(app, doneCB);
            }
        },
        addMyCertToPeerConf: function(peerconf, mkpc) {
            Ipseorama.findOrCreateCertAndDB("test",
                    function(cert) {
                        console.log("got cert" + cert);
                        peerconf.certificates = [cert];
                        mkpc();
                    }
            );
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
            var peerconfig = {"iceServers": [{url: "stun:stun.l.google.com:19302"}]};
            var offerCreated = function(localDesc) {
                var myfp = Ipseorama.getFinger(localDesc.sdp)
                okCB(myfp);
            }
            var withPc = function(pc) {
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
            if (typeof webkitRTCPeerConnection == "function") {
                var wcpc = new webkitRTCPeerConnection(peerconfig, null);
                withPc(wcpc);
            } else if (typeof mozRTCPeerConnection == "function") {
                if (typeof mozRTCPeerConnection.generateCertificate == "function") {
                    Ipseorama.addMyCertToPeerConf(peerconfig, function() {
                        var mozpc = new mozRTCPeerConnection(peerconfig, null)
                        withPc(mozpc);
                    });
                }
            }

        }
    }
}());


