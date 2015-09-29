/* 
 * soucecode copyright Westhawk Ltd 2014 - all rights reserved.
 */

;
(function() {
    Ipseorama = {
        db: null,
        createCert: function(app, doneCB) {
            console.log("create a new cert");
            var creq = mozRTCPeerConnection.generateCertificate({name: "ECDSA", namedCurve: "P-256"})
 //           var creq = mozRTCPeerConnection.generateCertificate({name: "RSA"})

            creq.then(function(cert) {
                console.log("created a new cert, now store it.");
                var tx = Ipseorama.db.transaction("IpseCert", "readwrite");
                tx.oncomplete = function() {
                    doneCB(cert);
                    console.log("transaction done .");
                };
                tx.onerror = function(event) {
                    console.log("transaction error is "+event.target.error.message);
                };
                var store = tx.objectStore("IpseCert");
                var updateRequest = store.put({app: app, cert: cert, timestamp: Date.now()});
                updateRequest.onsuccess =  function() {
                    console.log("cert stored.");
                };
                updateRequest.onerror = function(event) {
                    console.log("update error is "+event.target.error.message);
                };

            }
            );

        },
        findOrCreateCert: function(app, doneCB) {
            var tx = Ipseorama.db.transaction("IpseCert", "readonly");
            var store = tx.objectStore("IpseCert");
            var index = store.index("by_app");
            console.log("Looking for cert in Indexdb");

            var request = index.get(app);
            request.onsuccess = function(ev) {
                try {
                    console.log("lookup result " + JSON.stringify(this));
                    if (this.result) {
                        console.log("Returning matched cert in DB");
                        doneCB(this.result.cert);
                    } else {
                        console.log("No suitable cert in DB - creating one ");
                        Ipseorama.createCert(app, doneCB);
                    }
                } catch (e) {
                    console.log("Exception looking for cert in DB "+e+" - creating one ");
                    Ipseorama.createCert(app, doneCB);
                }
            };
        },
        findOrCreateCertAndDB: function(app, doneCB) {
            if (Ipseorama.db == null) {
                var request = indexedDB.open("IpseCert",4);
                request.onupgradeneeded = function(event) {
                    var db = request.result;
                    console.log("Indexdb.open() needed upgrade...");
                    if (event.oldVersion === 0) {
                        // The database did not previously exist, so create object stores and indexes. var db = request.result;
                        var store = db.createObjectStore("IpseCert", {keyPath: "app"});
                        var appIndex = store.createIndex("by_app", "app");
                    } else {
                        console.log("version sepcific upgrade goes here");
                    }
                };
                request.onsuccess = function() {
                    console.log("Indexdb.open() ok");
                    Ipseorama.db = request.result;
                    Ipseorama.findOrCreateCert(app, doneCB);
                };
                request.onerror = function(event) {
                    console.log("Indexdb.open() error is "+event.target.error.message);
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
                        }
                        /*,{mandatory: {
                                OfferToReceiveVideo: false,
                                OfferToReceiveAudio: false,
                            }}*/);
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


