var PipeBLE = (function () {
    let serviceUuid = parseInt("0x919E");

    let values = [
        {uuid: "0xFC0A", name: "fpa"},
        {uuid: "0xFC0B", name: "fpb"},
        {uuid: "0xFC0C", name: "nonce"}
    ];
    var state;
    var bluetoothDevice;



    function onGATTDisconnected () {
        state = "Disconnected";
        console.log('Disconnected Bluetooth Device...');
    }
    function requestDevice () {
        // navigator.bluetooth.referringDevice. may be pre-set if we arrived via a beacon
        console.log('Requesting Bluetooth Device...');
        return navigator.bluetooth.requestDevice({
            filters: [
                {name: "Pipe"},
                {services: [serviceUuid]}
            ],
        }).then(device => {
            bluetoothDevice = device;
            console.log('Got Bluetooth Device...');

            device.addEventListener('gattserverdisconnected',
                onGATTDisconnected.bind(this));
            return device;
        });
    };

    function createHexString(value) {
        var result = "";
        var arr = new Uint8Array(value.buffer);
        for (i in arr) {
            var str = arr[i].toString(16);
            str = str.length == 0 ? "00" :
                str.length == 1 ? "0" + str :
                    str.length == 2 ? str :
                        str.substring(str.length - 2, str.length);
            result += str;
        }
        return result.toUpperCase();
    }

    var connect = function () {
        return requestDevice().then(device => {
            return device.gatt.connect();
        })
            .then(server => {
                return server.getPrimaryService(serviceUuid);
            })
            .then(service => {
                var sequence = Promise.resolve();
                values.forEach(value => {
                    sequence = sequence.then(_ => {
                        return service.getCharacteristic(parseInt(value.uuid));
                    })
                        .then(charc => {
                            value.chara = charc;
                        });
                });
                values.forEach(value => {
                    sequence = sequence.then(_ => {
                        return value.chara.readValue();
                    })
                        .then(vb => {
                            value.hex = createHexString(vb);
                        });
                });
                return sequence;
            })
            .then(_ => {
                console.log("Values " + JSON.stringify(values));
                console.log("Connection fully established - disconnecting.");
                bluetoothDevice.gatt.disconnect();
                bluetoothDevice = null;
                return Promise.resolve(values);
            })
            .catch(err => {
                bluetoothDevice = null;
                console.log(err);
            })

    }
    return {
        connect:connect
    };
})();
