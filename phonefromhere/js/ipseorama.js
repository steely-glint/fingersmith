/* 
 * soucecode copyright Westhawk Ltd 2014 - all rights reserved.
 */

;
(function () {
    Ipseorama = {
        idb: null,
        cleanDb: function () {
            Ipseorama.idb.certs.clear()
                .then(function () {
                    console.log("Certs wiped");
                })
        },
        createCert: function (app, doneCB) {
            console.log("create a new cert");
            var creq = mozRTCPeerConnection.generateCertificate({name: "ECDSA", namedCurve: "P-256"})
            //           var creq = mozRTCPeerConnection.generateCertificate({name: "RSA"})
            creq.then(function (cert) {
                    console.log("created a new cert, now store it.");
                    Ipseorama.idb.certs.add(
                        {app: app, cert: cert, timestamp: Date.now()}
                    ).then(function (item) {
                            console.log("transaction done .");
                            doneCB(cert);
                        });
                }
            );

        },

        findOrCreateCert: function (app, doneCB) {
            console.log("Looking for cert in Indexdb");
            var q = Ipseorama.idb.certs.query('app', app);
                q.all.execute().then(function (results) {
                    console.log("lookup result " + JSON.stringify(results));
                    if (results) {
                        console.log("Returning matched cert in DB");
                        doneCB(results[0]);
                    } else {
                        console.log("No suitable cert in DB - creating one ");
                        Ipseorama.createCert(app, doneCB);
                    }
                });
        },

        findOrCreateCertAndDB: function (app, doneCB) {
            console.log("open Indexdb for cert ");
            if (Ipseorama.idb == null) {
                db.open({
                    server: 'certsdb',
                    version: 1,
                    schema: {
                        certs: {
                            key: {keyPath: 'id',autoIncrement: true},
                            indexes: {
                                app: { unique: true }
                            }
                        }
                    }
                }).then(function (s) {
                    Ipseorama.idb = s;
                    console.log("opened index db ");
                    Ipseorama.findOrCreateCert(app, doneCB);
                });
            } else {
                console.log("index db already open");
                Ipseorama.findOrCreateCert(app, doneCB);
            }
        },
        addMyCertToPeerConf: function (peerconf, mkpc) {
            Ipseorama.findOrCreateCertAndDB("test",
                function (cert) {
                    console.log("got cert" + cert);
                    peerconf.certificates = [cert];
                    mkpc();
                }
            );
        },
        getFinger: function (descsdp) {
            var sdp = Phono.sdp.parseSDP(descsdp)
            var myfp = JSON.stringify(sdp.contents[0].fingerprint.print);
            myfp = myfp.split(":").join("");
            myfp = myfp.split('"').join("");
            console.log("fingerprint is " + myfp)
            return myfp;
        },
        whoAmI: function (okCB, failCB) {
            var peerconfig = {"iceServers": [{url: "stun:stun.l.google.com:19302"}]};
            var offerCreated = function (localDesc) {
                var myfp = Ipseorama.getFinger(localDesc.sdp)
                okCB(myfp);
            }
            var withPc = function (pc) {
                pc.createDataChannel('channel', {});
                pc.createOffer(offerCreated,
                    function (e) {
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
                    Ipseorama.addMyCertToPeerConf(peerconfig, function () {
                        var mozpc = new mozRTCPeerConnection(peerconfig, null)
                        withPc(mozpc);
                    });
                }
            }

        }
    }
}());


