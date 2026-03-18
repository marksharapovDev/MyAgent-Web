import type { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { createLogger } from '@my-agent/shared';

const log = createLogger('ws');

// ── Types ─────────────────────────────────────────────────────────────────────

interface WSClient {
  ws: WebSocket;
  userId: string;
  projectId?: string;
}

type WSClientMessage =
  | { type: 'select_project'; projectId: string }
  | { type: 'message'; content: string }
  | { type: 'set_mode'; planId: string; mode: 'autopilot' | 'detail' }
  | { type: 'voice_chunk'; audio: string };

export type WSServerMessage =
  | { type: 'connected'; userId: string }
  | { type: 'discussion_response'; text: string; metadata: unknown }
  | { type: 'task_started'; taskId: string; title: string }
  | { type: 'task_progress'; taskId: string; progress: number; status: string }
  | { type: 'design_ready'; taskId: string; screenshots: { desktop: string; mobile: string }; htmlCode: string }
  | { type: 'code_ready'; taskId: string; files: unknown[]; diff: string }
  | { type: 'deploy_ready'; taskId: string; url: string }
  | { type: 'error'; taskId?: string; error: string }
  | { type: 'plan_update'; plan: unknown }
  | { type: 'stt_transcript'; text: string; isFinal: boolean };

// ── Client registry ───────────────────────────────────────────────────────────

const clients = new Map<string, WSClient>();

export function sendToDesktop(userId: string, data: WSServerMessage): void {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}

// ── Connection handler ────────────────────────────────────────────────────────

export function wsHandler(ws: WebSocket, req: IncomingMessage): void {
  // Auth via ?token= query param (Desktop uses this for WS upgrade)
  const rawUrl = req.url ?? '';
  const token = new URL(rawUrl, 'http://localhost').searchParams.get('token');

  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    log.error('JWT_SECRET not set, closing WS');
    ws.close(1011, 'Server misconfiguration');
    return;
  }

  let userId: string;
  try {
    const payload = jwt.verify(token ?? '', secret) as { userId: string };
    userId = payload.userId;
  } catch {
    log.warn('WS auth failed, closing connection');
    ws.close(4001, 'Unauthorized');
    return;
  }

  clients.set(userId, { ws, userId });
  log.info('WS client connected', { userId });

  sendToDesktop(userId, { type: 'connected', userId });

  ws.on('message', (raw) => {
    let msg: WSClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as WSClientMessage;
    } catch {
      log.warn('WS: failed to parse message', { userId });
      return;
    }

    switch (msg.type) {
      case 'select_project': {
        const client = clients.get(userId);
        if (client) client.projectId = msg.projectId;
        log.debug('WS: project selected', { userId, projectId: msg.projectId });
        break;
      }

      case 'message':
        // TODO Week 2: route to DiscussionSession
        log.debug('WS: message received', { userId, content: msg.content });
        break;

      case 'set_mode':
        // TODO Week 3: autopilot.setMode(msg.planId, msg.mode)
        log.debug('WS: mode change', { userId, planId: msg.planId, mode: msg.mode });
        break;

      case 'voice_chunk':
        // TODO Week 4: sttStream.sendChunk(userId, msg.audio)
        log.debug('WS: voice chunk received', { userId });
        break;

      default: {
        const _exhaustive: never = msg;
        log.warn('WS: unknown message type', { msg: _exhaustive });
      }
    }
  });

  ws.on('close', () => {
    clients.delete(userId);
    log.info('WS client disconnected', { userId });
  });

  ws.on('error', (err) => {
    log.error('WS error', { userId, message: err.message });
    clients.delete(userId);
  });
}
