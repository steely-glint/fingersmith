Simple websocket message passer in Scala
Used to create datachannels between browsers.
Includes some test javascript for demo page used in 
Kranky Geek 2015

It runs ssl on port 9000 - it needs a certificate in a keystore.

build with 
sbt assembly
run with
java -Dkeypass=secret -Dkeystore=path/to/javakeystore -jar {assembledJar}


