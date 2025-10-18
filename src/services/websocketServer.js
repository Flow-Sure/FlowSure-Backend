const WebSocket = require('ws');

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.port = process.env.WS_PORT || 3001;
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws'
    });

    // Make wss globally available for event broadcasting
    global.wss = this.wss;

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      console.log(`[WebSocket] Client connected from ${clientIp}`);
      console.log(`[WebSocket] Total clients: ${this.wss.clients.size}`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to FlowSure WebSocket',
        timestamp: Date.now()
      }));

      // Handle incoming messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error.message);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log(`[WebSocket] Client disconnected from ${clientIp}`);
        console.log(`[WebSocket] Total clients: ${this.wss.clients.size}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', error.message);
      });

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    });

    console.log(`[WebSocket] Server initialized on port ${this.port}`);
  }

  handleMessage(ws, data) {
    console.log('[WebSocket] Received message:', data);

    switch (data.type) {
      case 'subscribe':
        this.handleSubscribe(ws, data);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(ws, data);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      default:
        console.log('[WebSocket] Unknown message type:', data.type);
    }
  }

  handleSubscribe(ws, data) {
    const { channel } = data;
    
    if (!ws.subscriptions) {
      ws.subscriptions = new Set();
    }
    
    ws.subscriptions.add(channel);
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      channel,
      timestamp: Date.now()
    }));

    console.log(`[WebSocket] Client subscribed to ${channel}`);
  }

  handleUnsubscribe(ws, data) {
    const { channel } = data;
    
    if (ws.subscriptions) {
      ws.subscriptions.delete(channel);
    }
    
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      channel,
      timestamp: Date.now()
    }));

    console.log(`[WebSocket] Client unsubscribed from ${channel}`);
  }

  broadcast(message, channel = null) {
    if (!this.wss) return;

    const data = JSON.stringify(message);

    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        // If channel specified, only send to subscribed clients
        if (channel && client.subscriptions && !client.subscriptions.has(channel)) {
          return;
        }
        client.send(data);
      }
    });
  }

  broadcastEvent(eventType, eventData) {
    this.broadcast({
      type: 'event',
      eventType,
      data: eventData,
      timestamp: Date.now()
    }, 'events');
  }

  broadcastTransactionUpdate(transactionId, status, details = {}) {
    this.broadcast({
      type: 'transaction_update',
      transactionId,
      status,
      details,
      timestamp: Date.now()
    }, 'transactions');
  }

  broadcastRetryScheduled(actionId, attempt, scheduledFor) {
    this.broadcast({
      type: 'retry_scheduled',
      actionId,
      attempt,
      scheduledFor,
      timestamp: Date.now()
    }, 'retries');
  }

  getStats() {
    return {
      totalClients: this.wss ? this.wss.clients.size : 0,
      isRunning: this.wss !== null
    };
  }
}

module.exports = new WebSocketServer();
