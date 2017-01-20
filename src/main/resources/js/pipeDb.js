/* 
 * soucecode copyright Westhawk Ltd 2014 - all rights reserved.
 */


if (!window.indexedDB) {
    window.alert("Your browser doesn't support a stable version of IndexedDB. Persistent certs feature will not be available.");
}

(function() {
    function getFinger(descsdp) {
        var sdp = Phono.sdp.parseSDP(descsdp)
        var myfp = JSON.stringify(sdp.contents[0].fingerprint.print);
        myfp = myfp.split(":").join("");
        myfp = myfp.split('"').join("");
        console.log("fingerprint is " + myfp)
        return myfp;
    };

    PipeDb = {
        chromeVersionThatStoresCerts: 53, // sooner hopefully
        db: null,
        cleanDb: function(app, doneCB) {
            var request = indexedDB.deleteDatabase("PipeDb");
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
            if (PipeDb.db != null) {
                console.log("close db");
                PipeDb.db.close();
                PipeDb.db = null;
            }
        },
        createCert: function(app, doneCB) {
            console.log("create a new cert");
            let certParams ={
                name: "RSASSA-PKCS1-v1_5",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256" ,
                expires: 365*24*60*60*1000*1000
            };

            RTCPeerConnection.generateCertificate(certParams).then(function (cert) {
                console.log("created a new cert, now store it.");
                var tx = PipeDb.db.transaction("PipeCert", "readwrite");
                tx.oncomplete = function() {
                    PipeDb.dbDone();
                    doneCB(cert);
                    console.log("transaction done .");
                };
                tx.onerror = function(event) {
                    console.log("transaction error is " + event.target.error.message);
                };
                var store = tx.objectStore("PipeCert");
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
            var tx = PipeDb.db.transaction("PipeCert", "readonly");
            var store = tx.objectStore("PipeCert");
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
                    PipeDb.createCert(app, doneCB);
                }
            };
            request.oncomplete = function(ev) {
                PipeDb.dbDone();
                console.log("Search for cert in DB - complete");
                console.log("ev " + JSON.stringify(ev));
            };
            request.onerror = function(event) {
                console.log("Get failed" + JSON.stringify(event));
            };
        },
        dbDelPrint: function(print, doneCB) {
            PipeDb.openDb(print, PipeDb.delPrint, doneCB);
        },
        delPrint: function(print, doneCB) {
            console.log("delete existing print ");
            var tx = PipeDb.db.transaction("PipeId", "readwrite");
            tx.oncomplete = function() {
                PipeDb.dbDone();
                doneCB(print);
                console.log("transaction done .");
            };
            tx.onerror = function(event) {
                console.log("transaction error is " + event.target.error.message);
            };
            var store = tx.objectStore("PipeId");
            var updateRequest = store.delete(print);
            updateRequest.onsuccess = function() {
                console.log("print deleted.");
            };
            updateRequest.onerror = function(event) {
                console.log("print delete error is " + event.target.error.message);
            };
        },
        dbAddPrint: function(print, doneCB) {
            PipeDb.openDb(print, PipeDb.addPrint, doneCB);
        },
        addPrint: function(print, doneCB) {
            console.log("Adding a new print ");
            var tx = PipeDb.db.transaction("PipeId", "readwrite");
            tx.oncomplete = function() {
                PipeDb.dbDone();
                doneCB(print);
                console.log("transaction done .");
            };
            tx.onerror = function(event) {
                console.log("transaction error is " + event.target.error.message);
            };
            var store = tx.objectStore("PipeId");
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
            PipeDb.openDb(print, PipeDb.ifMaster, doneCB);
        },
        ifMaster: function(finger, doneCB) {
            var checkMaster = function(data) {
                if (data.alias === "master") {
                    doneCB()
                } else {
                    console.log("not master");
                }
            };
            PipeDb.findPrint(finger, checkMaster)
        },
        dbFindPrint: function(print, doneCB) {
            PipeDb.openDb(print, PipeDb.findPrint, doneCB);
        },
        findPrint: function(finger, doneCB) {
            var tx = PipeDb.db.transaction("PipeId", "readonly");
            var store = tx.objectStore("PipeId");
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
                PipeDb.dbDone();
                console.log("Search for print in DB - complete");
                console.log("ev " + JSON.stringify(ev));
            };
            request.onerror = function(event) {
                console.log("Get failed" + JSON.stringify(event));
            };
        },
        dbListPrint: function(doneCB) {
            PipeDb.openDb("friends", PipeDb.listPrint, doneCB);
        },
        listPrint: function(thing, doneCB) {
            var prints = [];

            var tx = PipeDb.db.transaction("PipeId", "readonly");
            tx.oncomplete = function() {
                PipeDb.dbDone();
                console.log("transaction done .");
                doneCB(prints);
            };
            var store = tx.objectStore("PipeId");

            store.openCursor().onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    prints.push(cursor.value);
                    cursor.continue();
                }
            };
        },
        openDb: function(app, action, doneCB) {
            if (PipeDb.db == null) {
                var request = indexedDB.open("PipeDb");
                request.onupgradeneeded = function(ev) {
                    console.log("Indexdb.open() needed upgrade...");
                    console.log("ev " + JSON.stringify(ev));
                    var db = ev.target.result;
                    if ((!ev.oldVersion) || (ev.oldVersion < 1)) {
                        console.log("createObjectStore and  createIndex for new database ");
                        // The database did not previously exist, so create object stores and indexes. var db = request.result;
                        var cstore = db.createObjectStore("PipeCert", {keyPath: "app"});
                        var cappIndex = cstore.createIndex("by_app", "app");
                        var fstore = db.createObjectStore("PipeId", {keyPath: "finger"});
                        var fappIndex = fstore.createIndex("by_finger", "finger");
                    }
                };
                request.onsuccess = function() {
                    console.log("Indexdb.open() ok");
                    PipeDb.db = request.result;
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
            PipeDb.openDb(app, PipeDb.findOrCreateCert, doneCB);
        },
        addMyCertToPeerConf: function(peerconf, mkpc) {
            PipeDb.findOrCreateCertAndDB("me",
                    function(cert) {
                        console.log("got cert" + cert);
                        peerconf.certificates = [cert];
                        mkpc();
                    }
            );
        },

        whoAmI: function(okCB, failCB) {
            let peerconfig = {"iceServers": [{url: "stun:stun.l.google.com:19302"}]};
            /*let offerConstraints = {mandatory: {
                OfferToReceiveVideo: false,
                OfferToReceiveAudio: false,
            }};*/
            PipeDb.addMyCertToPeerConf(peerconfig, function() {
                var pc = new RTCPeerConnection(peerconfig, null);
                pc.createDataChannel('channel', {});
                pc.createOffer()
                    .then(localDesc => {
                        var myfp = getFinger(localDesc.sdp);
                        okCB(myfp);
                    })
                    .catch(error => {failCB(error);});
            });
        }
    }
}());


