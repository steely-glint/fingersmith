/**
 * Created by thp on 17/01/2017.
 */
var duct = null;
var chout;
var snap = null ;

var sha256 = require("js/sha256");
var gotId= function(id) {
    duct = new PipeDuct(id);
    duct.setOnDataChannel(onNewDc);
};

function onDcMessage(evt) {
    var resp = JSON.parse(evt.data);
    if (resp.status === "ok") {
        duct.addRemote(snap,
            function() {
                document.getElementById("result").innerHTML = "<H3>Device Added</H3>";
                chout.close();
            });
    } else {
        console.log("problem with claim " + evt.data);
    }
}
function onNewDc(channel) {
    console.log("New DC ")
    channel.onmessage = onDcMessage;
}
var makedc = function (tofinger,nonceS) {
    duct.setTo(tofinger);
    duct.setNonce(nonceS);
    var channel = duct.createDataChannel("cert", {});
    channel.onopen = function() {
        console.log("Outbound channel ");
        var jmess = JSON.stringify({id: "1", action: "list"});
        console.log("sending " + jmess);
        channel.send(jmess);
    };
    channel.onmessage = onDcMessage;
    chout = channel;
};

/*
steps we care about :
1) do we have capability to run |pipe| ?
2) pair with selected device
3) outcome
 */