/**
 * Created by thp on 17/01/2017.
 */
var duct = null;
var chout;
var snap = null ;
var timer;

var sha256 = require("js/sha256");
var gotId= function(id) {

};

function onDcMessage(evt) {
    var resp = JSON.parse(evt.data);
    if (resp.status === "ok") {
        if (timer){
            clearInterval(timer);
        }
        duct.addRemote(snap,
            function() {
                if (resp.page) {
                    localStorage[resp.page] = duct.toFinger;
                }
                document.getElementById("result").innerHTML = "<a href='/iot/"+resp.page+"'><img  src='/img/pipe@2x.png'/></a>";
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
function showStatus(stat){
    document.getElementById("result").innerHTML = "<H4>"+stat+ "</H4>";
}
var dopair = function (id, toId, nonceS) {
    console.log("Trying data to pair");
    duct = new PipeDuct(id);
    duct.connect().then(function (d) {
        console.log("Duct promise returned ");
        duct.setOnDataChannel(onNewDc);
        duct.setTo(toId);
        duct.setNonce(nonceS);

        var channel = duct.createDataChannel("cert", {});
        channel.onopen = function () {
            console.log("Outbound channel ");
            var jmess = JSON.stringify({id: "1", action: "list"});
            console.log("sending " + jmess);
            channel.send(jmess);
        };
        channel.onmessage = onDcMessage;
        chout = channel;
    });
};

/*
steps we care about :
1) do we have capability to run |pipe| ?
2) pair with selected device
3) outcome
 */