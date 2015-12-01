/* 
 * soucecode copyright Westhawk Ltd 2014 - all rights reserved.
 */

window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || {READ_WRITE: "readwrite"}; // This line should only be needed if it is needed to support the object's constants for older browsers
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
if (!window.indexedDB) {
    window.alert("Your browser doesn't support a stable version of IndexedDB. Persistent certs feature will not be available.");
}

(function() {
    Ipseorama = {
        db: null,
        cleanDb: function(app, doneCB){
            var request =indexedDB.deleteDatabase("ipseorama");
            request.onsuccess = function() {
                console.log("Indexdb.deleteDatabase() ok");
            };
            request.onerror = function(event) {
                console.log("Indexdb.deleteDatabase() error is "+event.target.error.message);
            };
            request.onblocked = function(event) {
                console.log("Indexdb.deleteDatabase() blocked.");
            };
        },
        dbDone: function(){
            if (Ipseorama.db != null){
                console.log("close db");
                Ipseorama.db.close();
                Ipseorama.db=null;
               }
        },
        createCert: function(app, doneCB) {
            console.log("create a new cert");
            var creq = mozRTCPeerConnection.generateCertificate({name: "ECDSA", namedCurve: "P-256"})
 //           var creq = mozRTCPeerConnection.generateCertificate({name: "RSA"})

            creq.then(function(cert) {
                console.log("created a new cert, now store it.");
                var tx = Ipseorama.db.transaction("IpseCert", "readwrite");
                tx.oncomplete = function() {
                    Ipseorama.dbDone();
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
                console.log("ev "+JSON.stringify(ev));
                console.log("request "+JSON.stringify(request));
                console.log("this "+JSON.stringify(this));

                var matching = this.result;
                if (matching) {
                    console.log("Returning matched cert in DB");
                    doneCB(matching.cert);
                } else {
                    console.log("No suitable cert in DB - creating one ");
                    Ipseorama.createCert(app, doneCB);
                }
            };
            request.oncomplete = function(ev){
                  console.log("Search for cert in DB - complete");
                  console.log("ev "+JSON.stringify(ev));
            };
            request.onerror = function(event) {
                  console.log("Get failed"+JSON.stringify(event));
            };
        },
        findOrCreateCertAndDB: function(app, doneCB) {
            if (Ipseorama.db == null) {
                var request = indexedDB.open("ipseorama");
                request.onupgradeneeded = function(ev) {
                    console.log("Indexdb.open() needed upgrade...");
                    console.log("ev "+JSON.stringify(ev));

                    var db = ev.target.result;
                    if (ev.oldVersion < 1) {
                        console.log("createObjectStore and  createIndex for new database ");
                        // The database did not previously exist, so create object stores and indexes. var db = request.result;
                        var store = db.createObjectStore("IpseCert", {keyPath: "app"});
                        var appIndex = store.createIndex("by_app", "app");
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
                request.onblocked = function(event) {
                  // If some other tab is loaded with the database, then it needs to be closed
                  // before we can proceed.
                    console.log("Indexdb.open() open blocked.");
                };
            } else {
                Ipseorama.findOrCreateCert(app, doneCB);
            }
        },
        addMyCertToPeerConf: function(peerconf, mkpc) {
            Ipseorama.findOrCreateCertAndDB("me",
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


