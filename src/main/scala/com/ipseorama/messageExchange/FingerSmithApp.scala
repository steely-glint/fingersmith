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
import org.mashupbots.socko.webserver.WebServer
import org.mashupbots.socko.webserver.WebServerConfig
import akka.actor.{Props, ActorSystem, actorRef2Scala}
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
  val actorConfig = """
	my-pinned-dispatcher {
	  type=PinnedDispatcher
	  executor=thread-pool-executor
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
  val actorSystem = ActorSystem("FingersithActorSystem", ConfigFactory.parseString(actorConfig))
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
      case PathSegments("js" :: relativePath) => {
        // Serve the static js content from resources
        staticContentHandlerRouter ! new StaticResourceRequest(httpRequest, relativePath.mkString("js/", "/", ""))
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
  val webServer = new WebServer(WebServerConfig("FingerSmith", "0.0.0.0", 8888), routes, actorSystem)

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