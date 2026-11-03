import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { roomManager } from './src/server/roomManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// REST API for health & public room discovery
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', online: true });
});

app.get('/api/multiplayer/rooms', (_req, res) => {
  res.json({ rooms: roomManager.getPublicLobbies() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const pathname = req.url ? req.url.split('?')[0] : '';
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }
});

wss.on('connection', (ws: WebSocket) => {
  let attachedPlayerId: string | null = null;
  let attachedRoomCode: string | null = null;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case 'c:create_room': {
          const res = roomManager.createRoom(
            data.playerName,
            data.heroId,
            data.loadout,
            ws
          );
          attachedPlayerId = res.playerId;
          attachedRoomCode = res.roomCode;
          ws.send(
            JSON.stringify({
              type: 's:room_created',
              roomCode: res.roomCode,
              playerId: res.playerId,
              isHost: true,
              roomDetails: res.roomDetails,
            })
          );
          break;
        }

        case 'c:join_room': {
          const res = roomManager.joinRoom(
            data.roomCode,
            data.playerName,
            data.heroId,
            data.loadout,
            ws
          );
          if (res.success && res.playerId) {
            attachedPlayerId = res.playerId;
            attachedRoomCode = data.roomCode.trim().toUpperCase();
            ws.send(
              JSON.stringify({
                type: 's:room_joined',
                roomCode: attachedRoomCode,
                playerId: res.playerId,
                isHost: false,
                roomDetails: res.roomDetails,
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                type: 's:join_error',
                error: res.error || 'Failed to join room.',
              })
            );
          }
          break;
        }

        case 'c:quick_join': {
          const res = roomManager.quickJoin(
            data.playerName,
            data.heroId,
            data.loadout,
            ws
          );
          attachedPlayerId = res.playerId;
          attachedRoomCode = res.roomCode;
          ws.send(
            JSON.stringify({
              type: 's:room_joined',
              roomCode: res.roomCode,
              playerId: res.playerId,
              isHost: res.isHost,
              roomDetails: res.roomDetails,
            })
          );
          break;
        }

        case 'c:set_ready': {
          if (attachedPlayerId) {
            roomManager.setReady(attachedPlayerId, Boolean(data.ready));
          }
          break;
        }

        case 'c:set_hero': {
          if (attachedPlayerId) {
            roomManager.setHero(attachedPlayerId, data.heroId, data.loadout);
          }
          break;
        }

        case 'c:start_game': {
          if (attachedPlayerId) {
            const res = roomManager.startGame(attachedPlayerId);
            if (!res.success) {
              ws.send(
                JSON.stringify({
                  type: 's:start_error',
                  error: res.error,
                })
              );
            }
          }
          break;
        }

        case 'c:leave_room': {
          if (attachedPlayerId) {
            roomManager.leaveRoom(attachedPlayerId);
            attachedPlayerId = null;
            attachedRoomCode = null;
          }
          break;
        }

        case 'c:player_state': {
          if (attachedPlayerId && data.state) {
            roomManager.updatePlayerState(attachedPlayerId, data.state);
          }
          break;
        }

        case 'c:player_heal': {
          if (attachedPlayerId) {
            roomManager.handlePlayerHealOrShield(
              attachedPlayerId,
              Number(data.healAmount) || 0,
              Number(data.shieldAmount) || 0
            );
          }
          break;
        }

        case 'c:player_attack': {
          if (attachedPlayerId) {
            roomManager.handlePlayerAttack(attachedPlayerId, data);
          }
          break;
        }

        case 'c:player_skill': {
          if (attachedPlayerId) {
            roomManager.handlePlayerSkill(attachedPlayerId, data);
          }
          break;
        }

        case 'c:enemy_damage': {
          if (attachedPlayerId && typeof data.enemyId === 'number') {
            roomManager.handleEnemyDamage(
              attachedPlayerId,
              data.enemyId,
              data.damage || 10,
              Boolean(data.isCrit),
              data.sparkColor || '#ffffff',
              Number(data.slowDuration) || 0,
              Number(data.staggerDuration) || 0
            );
          }
          break;
        }

        case 'c:loot_pickup': {
          if (attachedPlayerId && typeof data.lootId === 'number') {
            roomManager.handleLootPickup(attachedPlayerId, data.lootId);
          }
          break;
        }

        case 'c:open_chest': {
          if (attachedPlayerId && typeof data.propId === 'string') {
            roomManager.handleOpenChest(attachedPlayerId, data.propId);
          }
          break;
        }

        case 'c:start_revive': {
          if (attachedPlayerId && data.targetPlayerId) {
            roomManager.handleStartRevive(attachedPlayerId, data.targetPlayerId);
          }
          break;
        }

        case 'c:cancel_revive': {
          if (attachedPlayerId) {
            roomManager.handleCancelRevive(attachedPlayerId);
          }
          break;
        }

        case 'c:enter_portal': {
          if (attachedPlayerId) {
            roomManager.handleEnterPortal(attachedPlayerId);
          }
          break;
        }

        case 'c:reconnect': {
          if (data.roomCode && data.playerId) {
            const ok = roomManager.handleReconnect(data.roomCode, data.playerId, ws);
            if (ok) {
              attachedPlayerId = data.playerId;
              attachedRoomCode = data.roomCode.trim().toUpperCase();
            } else {
              ws.send(JSON.stringify({ type: 's:reconnect_failed' }));
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    roomManager.handleDisconnect(ws);
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server },
        watch: disableHmr ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Bonehearth server running at http://0.0.0.0:${PORT} [${isProduction ? 'PROD' : 'DEV'}]`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
