import sbt._
import Keys._
import sbtassembly.Plugin._
import AssemblyKeys._

name := "fingersmith"

scalaVersion := "2.11.2"

resolvers += "Typesafe Repository" at "http://repo.typesafe.com/typesafe/releases/"

libraryDependencies += "org.mashupbots.socko" % "socko-webserver_2.11" % "0.6.0"

libraryDependencies ++= Seq("com.propensive" %% "rapture-json-jackson" % "1.1.0")

version := "1.0"

mergeStrategy in assembly := {
  case PathList("org", "mashupbots", xs@_ *) => MergeStrategy.first
  case x =>
     val oldStrategy = (mergeStrategy in assembly).value
     oldStrategy(x)
}
    
