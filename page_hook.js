// page_hook.js - WebSocket Interceptor (runs in page context)
// This script hooks into the native WebSocket to intercept messages without breaking functionality

(function() {
  'use strict';

  // Save reference to original WebSocket constructor
  const OriginalWebSocket = window.WebSocket;

  // Create wrapper function
  function WebSocketWrapper(url, protocols) {
    // Create original WebSocket instance
    const ws = protocols 
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    // Intercept incoming messages
    ws.addEventListener('message', (event) => {
      try {
        // Forward message to content script via postMessage
        window.postMessage({
          source: 'EXT_WS_HOOK',
          payload: event.data
        }, '*');
      } catch (error) {
        console.error('[WS Hook] Error forwarding message:', error);
      }
    });

    return ws;
  }

  // Copy static properties from original WebSocket
  WebSocketWrapper.CONNECTING = OriginalWebSocket.CONNECTING;
  WebSocketWrapper.OPEN = OriginalWebSocket.OPEN;
  WebSocketWrapper.CLOSING = OriginalWebSocket.CLOSING;
  WebSocketWrapper.CLOSED = OriginalWebSocket.CLOSED;

  // Copy prototype
  WebSocketWrapper.prototype = OriginalWebSocket.prototype;

  // Replace global WebSocket with wrapper
  window.WebSocket = WebSocketWrapper;

  console.log('[WS Hook] WebSocket successfully hooked');
})();
