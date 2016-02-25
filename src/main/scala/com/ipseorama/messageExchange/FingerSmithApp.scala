//
// Copyright 2012 Vibul Imtarnasan, David Bolton and Socko contributors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package com.ipseorama.messageExchange

import akka.routing.FromConfig
import com.typesafe.config.ConfigFactory
import org.mashupbots.socko.events.HttpResponseStatus
import org.mashupbots.socko.events.WebSocketHandshakeEvent
import org.mashupbots.socko.handlers.{StaticContentHandlerConfig, StaticContentHandler, StaticResourceRequest}
import org.mashupbots.socko.infrastructure.Logger
import org.mashupbots.socko.routes._
import org.mashupbots.socko.webserver.{SslConfig, WebServer, WebServerConfig}
import akka.actor._
import akka.dispatch.OnComplete

/**
 * This example shows how to use web sockets, specifically `org.mashupbots.socko.processors.WebSocketBroadcaster`,
 * for chatting.
 *
 * With `org.mashupbots.socko.processors.WebSocketBroadcaster`, you can broadcast messages to all registered web
 * socket connections
 *
 *  - Open a few browsers and navigate to `http://localhost:8888/html`.
 *  - A HTML page will be displayed
 *  - It will make a web socket connection to `ws://localhost:8888/websocket/`
 *  - Type in some text on one browser and see it come up on the other browsers
 */
object FingerSmithApp extends Logger {
  //
  // STEP #1 - Define Actors and Start Akka
  // `ChatHandler` is created in the route and is self-terminating
  //
  val actorConfig = s"""
	my-pinned-dispatcher {
	  type=PinnedDispatcher
	  executor=thread-pool-executor
	}
  fingersmith {
    server-name=fingersmith
    hostname=0.0.0.0
    port=9000
    idle-connection-timeout=0
    log-network-activity=false
    web-log {
    }
  }

	akka {
	  event-handlers = ["akka.event.slf4j.Slf4jEventHandler"]
	  loglevel=DEBUG
	  actor {
	    deployment {
	      /static-file-router {
	        router = round-robin
	        nr-of-instances = 5
	      }
	      /rest-router {
	        router = round-robin
	        nr-of-instances = 5
	      }
	      /user-api-router {
	        router = round-robin
	        nr-of-instances = 5
	      }
	    }
	  }
	}"""
  /*
   ssl {
   key-store-file=$keystore
   key-store-password=$password
   }
   next to weblog
   */
  object MyWebServerConfig extends ExtensionId[WebServerConfig] with ExtensionIdProvider {
    override def lookup = MyWebServerConfig
    override def createExtension(system: ExtendedActorSystem) =
      new WebServerConfig(system.settings.config, "fingersmith")
  }

  val actorSystem = ActorSystem("FingersmithActorSystem", ConfigFactory.parseString(actorConfig))
  val staticContentHandlerRouter = actorSystem.actorOf(Props(new StaticContentHandler(StaticContentHandlerConfig()))
                                                       .withRouter(FromConfig()).withDispatcher("my-pinned-dispatcher"), "static-file-router")
  //
  // STEP #2 - Define Routes
  // Each route dispatches the request to a newly instanced `WebSocketHandler` actor for processing.
  // `WebSocketHandler` will `stop()` itself after processing the request. 
  //
  val routes = Routes({

      case HttpRequest(httpRequest) => httpRequest match {
          case GET(Path("/status")) => {
              // Return HTML page to establish web socket
              actorSystem.actorOf(Props[FingerSmithHandler]) ! httpRequest
            }
          case GET(Path("/index.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"index.html")
            }
          case GET(Path("/bone.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"bone.html")
            }
          case GET(Path("/vbone.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"vbone.html")
            }
          case GET(Path("/tbone.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"tbone.html")
            }
          case GET(Path("/brick.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"brick.html")
            }
          case GET(Path("/babystar.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"babystar.html")
            }
          case GET(Path("/abrick.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"abrick.html")
            }
          case GET(Path("/share.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"share.html")
            }
          case GET(Path("/shake.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"shake.html")
            }
          case GET(Path("/slide.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"slide.html")
            }
          case GET(Path("/claim.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"claim.html")
            }
          case GET(Path("/delete.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"delete.html")
            }
          case GET(Path("/intro.html")) => {
              // Return HTML page to establish web socket
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest,"intro.html")
            }
          case PathSegments("js" :: relativePath) => {
              // Serve the static js content from resources
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest, relativePath.mkString("js/", "/", ""))
            }
          case PathSegments("image" :: relativePath) => {
              // Serve the static js content from resources
              staticContentHandlerRouter ! new StaticResourceRequest(httpRequest, relativePath.mkString("image/", "/", ""))
            }
          case Path("/favicon.ico") => {
              // If favicon.ico, just return a 404 because we don't have that file
              httpRequest.response.write(HttpResponseStatus.NOT_FOUND)
            }
        }

      case WebSocketHandshake(wsHandshake) => wsHandshake match {
          case Path("/websocket/") => {
              // To start Web Socket processing, we first have to authorize the handshake.
              // This is a security measure to make sure that web sockets can only be established at your specified end points.
              wsHandshake.authorize(
                onComplete = Some(onWebSocketHandshakeComplete),
                onClose = Some(onWebSocketClose))
            }
        }

      case WebSocketFrame(wsFrame) => {
          // Once handshaking has taken place, we can now process frames sent from the client
          actorSystem.actorOf(Props[FingerSmithHandler]) ! wsFrame
        }

    })
  val myWebServerConfig = MyWebServerConfig(actorSystem)
  //val myWebServerConfig = new WebServerConfig();
  val webServer = new WebServer(myWebServerConfig, routes,actorSystem)
  // webServer.start()
  // val webServer = new WebServer(WebServerConfig("FingerSmith", "0.0.0.0", 8888), routes, actorSystem)

  //
  // STEP #3 - Start and Stop Socko Web Server
  //
  def main(args: Array[String]) {
    Runtime.getRuntime.addShutdownHook(new Thread {
        override def run { webServer.stop() }
      })
    webServer.start()

    System.out.println("Open a browsers and navigate to http://localhost:8888/index.html.")
  }

  def onWebSocketHandshakeComplete(webSocketId: String) {
    System.out.println(s"Web Socket $webSocketId connected")
  }

  def onWebSocketClose(webSocketId: String) {
    System.out.println(s"Web Socket $webSocketId closed")
  }

}