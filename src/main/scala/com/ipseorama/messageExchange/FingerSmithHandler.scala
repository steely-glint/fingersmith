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

import java.text.SimpleDateFormat
import java.util.GregorianCalendar

import akka.actor.Actor
import akka.event.Logging
import org.mashupbots.socko.events.{HttpRequestEvent, WebSocketFrameEvent}
import rapture.json.Json
import rapture.json.jsonBackends.jackson._
/**
 * Web Socket processor for chatting
 */
class FingerSmithHandler extends Actor {
  val log = Logging(context.system, this)

  /**
   * Process incoming events
   */
  def receive = {
    case event: HttpRequestEvent =>
      // Return the HTML page to setup web sockets in the browser
      writeHTML(event)
      context.stop(self)
    case event: WebSocketFrameEvent =>
      // Echo web socket text frames
      writeWebSocketResponse(event)
      context.stop(self)
    case _ => {
      log.info("received unknown message of type: ")
      context.stop(self)
    }
  }

  /**
   * Write HTML page to setup a web socket on the browser
   */
  private def writeHTML(ctx: HttpRequestEvent) {
    // Send 100 continue if required
    if (ctx.request.is100ContinueExpected) {
      ctx.response.write100Continue()
    }
    val buf = new StringBuilder()
    buf.append("<html><head><title>Socko Web Socket Example</title></head>\n")
    buf.append("<body>\n")
    buf.append("<ul>\n")
    val all = FingerSmithApp.webServer.webSocketConnections.allWebSocketChannels.toArray()
    all.foreach( c =>
      buf.append(s"<li>$c.name</li>")
    )
    buf.append("</ul>\n")
    buf.append("</body>\n")
    buf.append("</html>\n")

    ctx.response.write(buf.toString, "text/html; charset=UTF-8")
  }

  /**
   * Echo the details of the web socket frame that we just received; but in upper case.
   */
  private def writeWebSocketResponse(event: WebSocketFrameEvent) {
    log.info("TextWebSocketFrame: " + event.readText)
    val json = Json.parse(event.readText());
    val toFinger = json.to.as[String]
    val message = json.message.as[String]
    val fromFinger = event.webSocketId
    FingerSmithApp.webServer.webSocketConnections.writeText("message "+event.readText(),toFinger)
    System.out.println(s"sending $message to $toFinger from $fromFinger closed")
  }

}

