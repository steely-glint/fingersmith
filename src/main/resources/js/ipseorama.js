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
        cleanDb: function(app, doneCB) {
            var request = indexedDB.deleteDatabase("ipseorama");
            request.onsuccess = function() {
                console.log("Indexdb.deleteDatabase() ok");
            };
            request.onerror = function(event) {
                console.log("Indexdb.deleteDatabase() error is " + event.target.error.message);
            };
            request.onblocked = function(event) {
                console.log("Indexdb.deleteDatabase() blocked.");
            };
        },
        dbDone: function() {
            if (Ipseorama.db != null) {
                console.log("close db");
                Ipseorama.db.close();
                Ipseorama.db = null;
            }
        },
        createCert: function(app, doneCB) {
            console.log("create a new cert");
            var creq = mozRTCPeerConnection.generateCertificate({name: "ECDSA", namedCurve: "P-256"})
//            var creq =mozRTCPeerConnection.generateCertificate({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" , expires: 365*24*60*60*1000*1000 });
            creq.then(function(cert) {
                console.log("created a new cert, now store it.");
                var tx = Ipseorama.db.transaction("IpseCert", "readwrite");
                tx.oncomplete = function() {
                    Ipseorama.dbDone();
                    doneCB(cert);
                    console.log("transaction done .");
                };
                tx.onerror = function(event) {
                    console.log("transaction error is " + event.target.error.message);
                };
                var store = tx.objectStore("IpseCert");
                var updateRequest = store.put({app: app, cert: cert, timestamp: Date.now()});
                updateRequest.onsuccess = function() {
                    console.log("cert stored.");
                };
                updateRequest.onerror = function(event) {
                    console.log("update error is " + event.target.error.message);
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
                console.log("ev " + JSON.stringify(ev));
                console.log("request " + JSON.stringify(request));
                console.log("this " + JSON.stringify(this));

                var matching = this.result;
                if (matching) {
                    console.log("Returning matched cert in DB");
                    doneCB(matching.cert);
                } else {
                    console.log("No suitable cert in DB - creating one ");
                    Ipseorama.createCert(app, doneCB);
                }
            };
            request.oncomplete = function(ev) {
                Ipseorama.dbDone();
                console.log("Search for cert in DB - complete");
                console.log("ev " + JSON.stringify(ev));
            };
            request.onerror = function(event) {
                console.log("Get failed" + JSON.stringify(event));
            };
        },
        dbDelPrint: function(print, doneCB) {
            Ipseorama.openDb(print, Ipseorama.delPrint, doneCB);
        },
        delPrint: function(print, doneCB) {
            console.log("delete existing print ");
            var tx = Ipseorama.db.transaction("IpseFinger", "readwrite");
            tx.oncomplete = function() {
                Ipseorama.dbDone();
                doneCB(print);
                console.log("transaction done .");
            };
            tx.onerror = function(event) {
                console.log("transaction error is " + event.target.error.message);
            };
            var store = tx.objectStore("IpseFinger");
            var updateRequest = store.delete(print);
            updateRequest.onsuccess = function() {
                console.log("print deleted.");
            };
            updateRequest.onerror = function(event) {
                console.log("print delete error is " + event.target.error.message);
            };
        },
        dbAddPrint: function(print, doneCB) {
            Ipseorama.openDb(print, Ipseorama.addPrint, doneCB);
        },
        addPrint: function(print, doneCB) {
            console.log("Adding a new print ");
            var tx = Ipseorama.db.transaction("IpseFinger", "readwrite");
            tx.oncomplete = function() {
                Ipseorama.dbDone();
                doneCB(print);
                console.log("transaction done .");
            };
            tx.onerror = function(event) {
                console.log("transaction error is " + event.target.error.message);
            };
            var store = tx.objectStore("IpseFinger");
            print.timestamp = Date.now();
            var updateRequest = store.put(print);
            updateRequest.onsuccess = function() {
                console.log("print stored.");
            };
            updateRequest.onerror = function(event) {
                console.log("print insert error is " + event.target.error.message);
            };
        },
        dbIfMaster: function(print, doneCB) {
            Ipseorama.openDb(print, Ipseorama.ifMaster, doneCB);
        },
        ifMaster: function(finger, doneCB) {
            var checkMaster = function(data) {
                if (data.alias === "master") {
                    doneCB()
                } else {
                    console.log("not master");
                }
            };
            Ipseorama.findPrint(finger, checkMaster)
        },
        dbFindPrint: function(print, doneCB) {
            Ipseorama.openDb(print, Ipseorama.findPrint, doneCB);
        },
        findPrint: function(finger, doneCB) {
            var tx = Ipseorama.db.transaction("IpseFinger", "readonly");
            var store = tx.objectStore("IpseFinger");
            var index = store.index("by_finger");
            console.log("Looking for finger in Indexdb");

            var request = index.get(finger);
            request.onsuccess = function(ev) {
                console.log("ev " + JSON.stringify(ev));
                console.log("request " + JSON.stringify(request));
                console.log("this " + JSON.stringify(this));

                var matching = this.result;
                if (matching) {
                    console.log("Returning matched print in DB");
                    doneCB(matching);
                } else {
                    doneCB(null);
                }
            };
            request.oncomplete = function(ev) {
                Ipseorama.dbDone();
                console.log("Search for print in DB - complete");
                console.log("ev " + JSON.stringify(ev));
            };
            request.onerror = function(event) {
                console.log("Get failed" + JSON.stringify(event));
            };
        },
        dbListPrint: function(doneCB) {
            Ipseorama.openDb("friends", Ipseorama.listPrint, doneCB);
        },
        listPrint: function(thing, doneCB) {
            var prints = [];

            var tx = Ipseorama.db.transaction("IpseFinger", "readonly");
            tx.oncomplete = function() {
                Ipseorama.dbDone();
                console.log("transaction done .");
                doneCB(prints);
            };
            var store = tx.objectStore("IpseFinger");

            store.openCursor().onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    prints.push(cursor.value);
                    cursor.continue();
                }
            };
        },
        openDb: function(app, action, doneCB) {
            if (Ipseorama.db == null) {
                var request = indexedDB.open("ipseorama");
                request.onupgradeneeded = function(ev) {
                    console.log("Indexdb.open() needed upgrade...");
                    console.log("ev " + JSON.stringify(ev));

                    var db = ev.target.result;
                    if ((!ev.oldVersion) || (ev.oldVersion < 1)) {
                        console.log("createObjectStore and  createIndex for new database ");
                        // The database did not previously exist, so create object stores and indexes. var db = request.result;
                        var cstore = db.createObjectStore("IpseCert", {keyPath: "app"});
                        var cappIndex = cstore.createIndex("by_app", "app");
                        var fstore = db.createObjectStore("IpseFinger", {keyPath: "finger"});
                        var fappIndex = fstore.createIndex("by_finger", "finger");
                    }
                };
                request.onsuccess = function() {
                    console.log("Indexdb.open() ok");
                    Ipseorama.db = request.result;
                    action(app, doneCB);
                };
                request.onerror = function(event) {
                    console.log("Indexdb.open() error is " + event.target.error.message);
                };
                request.onblocked = function(event) {
                    // If some other tab is loaded with the database, then it needs to be closed
                    // before we can proceed.
                    console.log("Indexdb.open() open blocked.");
                };
            } else {
                action(app, doneCB);
            }
        },
        findOrCreateCertAndDB: function(app, doneCB) {
            Ipseorama.openDb(app, Ipseorama.findOrCreateCert, doneCB);
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
                if (typeof webkitRTCPeerConnection.generateCertificate == "function") {
                    Ipseorama.addMyCertToPeerConf(peerconfig, function() {
                        var wcpc = new webkitRTCPeerConnection(peerconfig, null)
                        withPc(wcpc);
                    });
                } else {
                    console.log("No cert generation available ?");
                    var wcpc = new webkitRTCPeerConnection(peerconfig, null);
                    withPc(wcpc);
                }
            } else if (typeof mozRTCPeerConnection == "function") {
                var todo = withPc;
                if (typeof mozRTCPeerConnection.generateCertificate == "function") {
                    Ipseorama.addMyCertToPeerConf(peerconfig, function() {
                        var mozpc = new mozRTCPeerConnection(peerconfig, null);
                        todo(mozpc);
                    });
                }
            }

        }
    }
}());


