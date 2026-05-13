const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// campaignId → Set of socket ids
const campaignRooms = new Map();

// ── État du combat en mémoire ──────────────────────────────────
const combatStates = new Map();

// ── État audio en mémoire ──────────────────────────────────────
// campaignId → { type, preset?, url?, track_name, loop, volume }
const audioStates = new Map();

// fogStates: `${campaignId}:${mapId}` → { circles: [{x,y,r}], allRevealed: bool }
const fogStates = new Map();

// visionModeStates: campaignId → 'all' | 'character' | 'none'
const visionModeStates = new Map();

// weatherStates: campaignId → { type, intensity }
const weatherStates = new Map();

// nightModeStates: campaignId → bool
const nightModeStates = new Map();

// hpDisplayStates: campaignId → { pc_mode, npc_mode, threshold_high, threshold_low }
// pc_mode / npc_mode : 'none' | 'bar' | 'exact'
const hpDisplayStates = new Map();

module.exports = function setupSocket(io) {

  // ── Auth middleware Socket.io ──────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token manquant'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Connecté : ${socket.user.username} (${socket.id})`);

    // ── Rejoindre une campagne ─────────────────────────────
    socket.on('join_campaign', async ({ campaign_id }) => {
      try {
        const m = await db.query(
          'SELECT role FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
          [campaign_id, socket.user.id]
        );
        if (!m.rows[0]) return socket.emit('error', { message: 'Accès refusé' });

        socket.join(campaign_id);
        socket.campaignId = campaign_id;
        socket.role = m.rows[0].role;

        // Charger les 50 derniers messages
        const msgs = await db.query(
          `SELECT m.*, u.username FROM messages m
           LEFT JOIN users u ON u.id = m.user_id
           WHERE m.campaign_id = $1
           ORDER BY m.created_at DESC LIMIT 50`,
          [campaign_id]
        );

        // Carte active + tokens
        const map = await db.query(
          'SELECT id,name,background_url,grid_size,width,height,is_active,fog_of_war,walls,lights,objects FROM maps WHERE campaign_id = $1 AND is_active = TRUE LIMIT 1',
          [campaign_id]
        );
        let tokens = [];
        if (map.rows[0]) {
          const t = await db.query(
            `SELECT t.*, c.name AS char_name, c.portrait_url AS char_portrait,
                    c.user_id AS char_user_id, c.vision_radius AS char_vision_radius,
                    c.vision_angle AS char_vision_angle,
                    COALESCE(t.hp_max, c.hp_max) AS hp_max
             FROM tokens t LEFT JOIN characters c ON c.id = t.character_id
             WHERE t.map_id = $1 AND (t.visible = TRUE OR $2 = 'gm')`,
            [map.rows[0].id, socket.role]
          );
          tokens = t.rows;
        }

        socket.emit('campaign_state', {
          messages: msgs.rows.reverse(),
          map: map.rows[0] || null,
          tokens,
        });

        // Envoyer l'état du combat actif si existant
        const existingCombat = combatStates.get(campaign_id);
        if (existingCombat) socket.emit('combat_state', existingCombat);

        // Envoyer l'état audio actif si existant
        const existingAudio = audioStates.get(campaign_id);
        if (existingAudio) socket.emit('audio_state', existingAudio);

        // Envoyer l'état du brouillard — priorité mémoire, sinon DB
        const fogKey = map.rows[0] ? `${campaign_id}:${map.rows[0].id}` : null;
        let existingFog = fogKey ? fogStates.get(fogKey) : null;
        if (!existingFog && map.rows[0]?.fog_of_war) {
          try {
            const dbFog = typeof map.rows[0].fog_of_war === 'string'
              ? JSON.parse(map.rows[0].fog_of_war) : map.rows[0].fog_of_war;
            if (dbFog && (dbFog.circles || dbFog.allRevealed)) {
              existingFog = dbFog;
              fogStates.set(fogKey, existingFog);
            }
          } catch {}
        }
        if (existingFog) socket.emit('fog_update', { map_id: map.rows[0].id, ...existingFog });

        // Charger les réglages persistés depuis la DB et initialiser la mémoire
        const campRow  = await db.query('SELECT settings FROM campaigns WHERE id = $1', [campaign_id]);
        const dbSetting = campRow.rows[0]?.settings || {};

        if (dbSetting.vision_mode && !visionModeStates.has(campaign_id))
          visionModeStates.set(campaign_id, dbSetting.vision_mode);
        if (dbSetting.hp_display && !hpDisplayStates.has(campaign_id))
          hpDisplayStates.set(campaign_id, dbSetting.hp_display);

        // Envoyer l'état vision (mémoire ou settings DB)
        const visionMode = visionModeStates.get(campaign_id) || dbSetting.vision_mode || 'all';
        socket.emit('vision_mode', { mode: visionMode });

        // Envoyer l'état météo actif si existant
        const existingWeather = weatherStates.get(campaign_id);
        if (existingWeather) socket.emit('weather_state', existingWeather);

        // Envoyer l'état mode nuit
        const existingNight = nightModeStates.get(campaign_id);
        if (existingNight) socket.emit('night_mode_state', { enabled: true });

        // Envoyer les réglages d'affichage des PV
        const hpState = hpDisplayStates.get(campaign_id)
          || dbSetting.hp_display
          || { pc_mode:'bar', npc_mode:'none', threshold_high:70, threshold_low:30 };
        socket.emit('hp_display_state', hpState);

        // Envoyer la liste des utilisateurs déjà connectés au nouveau venu
        const roomSockets = await io.in(campaign_id).fetchSockets();
        const onlineUsers = roomSockets
          .filter(s => s.id !== socket.id)
          .map(s => ({ id: s.user.id, username: s.user.username }));
        socket.emit('online_users', onlineUsers);

        // Informer les autres
        socket.to(campaign_id).emit('user_joined', {
          id: socket.user.id,
          username: socket.user.username,
        });

        console.log(`[WS] ${socket.user.username} a rejoint la campagne ${campaign_id}`);
      } catch (err) {
        console.error('[WS] join_campaign error:', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── Message chat ──────────────────────────────────────
    socket.on('chat_message', async ({ campaign_id, content, character_name }) => {
      if (!content?.trim()) return;
      // Vérifie que le campaign_id correspond à la campagne rejointe par ce socket
      if (campaign_id !== socket.campaignId) return socket.emit('error', { message: 'Campagne invalide' });
      try {
        const r = await db.query(
          `INSERT INTO messages (campaign_id, user_id, character_name, content, type)
           VALUES ($1, $2, $3, $4, 'chat') RETURNING *`,
          [campaign_id, socket.user.id, character_name || socket.user.username, content.trim()]
        );
        const msg = { ...r.rows[0], username: socket.user.username };
        io.to(campaign_id).emit('message_received', msg);
      } catch (err) {
        console.error('[WS] chat_message error:', err);
      }
    });

    // ── Annonce de combat (MJ) ───────────────────────────
    socket.on('combat_announce', ({ campaign_id, text }) => {
      if (socket.role !== 'gm') return;
      if (!text?.trim()) return;
      io.to(campaign_id).emit('message_received', {
        type: 'combat',
        content: text.trim(),
        username: socket.user.username,
        created_at: new Date(),
      });
    });

    // ── Chuchotement (message privé) ─────────────────────
    socket.on('whisper', async ({ campaign_id, to_username, content, character_name }) => {
      if (!content?.trim() || !to_username) return;
      try {
        // Trouver le socket destinataire dans la campagne
        const roomSockets = await io.in(campaign_id).fetchSockets();
        const targetSocket = roomSockets.find(s => s.user.username.toLowerCase() === to_username.toLowerCase());
        const now = new Date();
        const whisperData = {
          type: 'whisper',
          content: content.trim(),
          username: socket.user.username,
          character_name: character_name || socket.user.username,
          to_username: targetSocket?.user?.username || to_username,
          created_at: now,
        };
        // Envoyer à l'expéditeur (vue "envoyé")
        socket.emit('whisper_received', { ...whisperData, from_me: true });
        // Envoyer au destinataire si connecté
        if (targetSocket) {
          targetSocket.emit('whisper_received', { ...whisperData, from_me: false });
        }
        // MJ voit tous les chuchotements (sauf si c'est lui l'expéditeur ou destinataire)
        roomSockets.forEach(s => {
          if (s.role === 'gm' && s.id !== socket.id && s.id !== targetSocket?.id) {
            s.emit('whisper_received', { ...whisperData, from_me: false });
          }
        });
      } catch (err) { console.error('[WS] whisper error:', err); }
    });

    // ── Lancer de dés ─────────────────────────────────────
    socket.on('dice_roll', async ({ campaign_id, dice, character_name, modifier, macro_name, label }) => {
      if (campaign_id !== socket.campaignId) return socket.emit('error', { message: 'Campagne invalide' });
      try {
        const result = rollDice(dice, modifier || 0);
        const displayLabel = label || macro_name || null;
        const roll_data = { dice, modifier: modifier || 0, rolls: result.rolls, total: result.total, macro_name: macro_name || null, label: displayLabel };
        const content = `🎲 ${displayLabel ? `[${displayLabel}] ` : ''}${dice}${modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ''} → **${result.total}**`;

        const r = await db.query(
          `INSERT INTO messages (campaign_id, user_id, character_name, content, type, roll_data)
           VALUES ($1, $2, $3, $4, 'roll', $5) RETURNING *`,
          [campaign_id, socket.user.id, character_name || socket.user.username,
           content, JSON.stringify(roll_data)]
        );
        const msg = { ...r.rows[0], username: socket.user.username };
        io.to(campaign_id).emit('message_received', msg);
        io.to(campaign_id).emit('dice_rolled', {
          ...roll_data,
          character_name: character_name || socket.user.username,
          username: socket.user.username,
        });
      } catch (err) {
        console.error('[WS] dice_roll error:', err);
      }
    });

    // ── Déplacer un token ─────────────────────────────────
    socket.on('token_move', async ({ campaign_id, map_id, token_id, x, y, facing }) => {
      try {
        // Ownership check : le MJ peut tout bouger, un joueur seulement son token
        if (socket.role !== 'gm') {
          const check = await db.query(
            `SELECT c.user_id AS char_user_id
             FROM tokens t LEFT JOIN characters c ON c.id = t.character_id
             WHERE t.id = $1`,
            [token_id]
          );
          const row = check.rows[0];
          // Token sans personnage (PNJ) ou personnage d'un autre joueur → refus silencieux
          if (!row || !row.char_user_id || row.char_user_id !== socket.user.id) return;
        }
        await db.query('UPDATE tokens SET x = $1, y = $2, facing = COALESCE($4, facing) WHERE id = $3',
          [x, y, token_id, facing ?? null]);
        socket.to(campaign_id).emit('token_moved', { token_id, x, y, facing, moved_by: socket.user.id });
      } catch (err) {
        console.error('[WS] token_move error:', err);
      }
    });

    // ── Réassigner un personnage à un autre joueur (MJ uniquement) ─
    socket.on('token_reassign', async ({ campaign_id, character_id, new_user_id }) => {
      if (socket.role !== 'gm') return;
      try {
        await db.query('UPDATE characters SET user_id = $1 WHERE id = $2', [new_user_id, character_id]);
        // Mettre à jour char_user_id sur tous les tokens liés à ce personnage
        io.to(campaign_id).emit('character_reassigned', { character_id, new_user_id });
      } catch (err) {
        console.error('[WS] token_reassign error:', err);
      }
    });

    // ── Créer un token (MJ) ───────────────────────────────
    socket.on('token_create', async ({ campaign_id, map_id, label, x, y, color, character_id, size, image_url, hp_current, hp_max }) => {
      if (socket.role !== 'gm') return;
      try {
        const r = await db.query(
          `INSERT INTO tokens (map_id, character_id, label, x, y, color, size, image_url, hp_current, hp_max)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [map_id, character_id || null, label || 'Token', x, y, color || '#c9a227', size || 1,
           image_url || null, hp_current ?? null, hp_max ?? hp_current ?? null]
        );
        const token = r.rows[0];
        if (character_id) {
          const c = await db.query('SELECT name, portrait_url, user_id, vision_radius, vision_angle FROM characters WHERE id = $1', [character_id]);
          if (c.rows[0]) {
            token.char_name    = c.rows[0].name;
            token.char_portrait = c.rows[0].portrait_url;
            token.char_user_id  = c.rows[0].user_id;
            token.char_vision_radius = c.rows[0].vision_radius || 0;
            token.char_vision_angle  = c.rows[0].vision_angle  || 360;
          }
        }
        io.to(campaign_id).emit('token_created', token);
      } catch (err) {
        console.error('[WS] token_create error:', err);
      }
    });

    // ── Supprimer un token (MJ) ───────────────────────────
    socket.on('token_delete', async ({ campaign_id, token_id }) => {
      if (socket.role !== 'gm') return;
      try {
        await db.query('DELETE FROM tokens WHERE id = $1', [token_id]);
        io.to(campaign_id).emit('token_deleted', { token_id });
      } catch (err) {
        console.error('[WS] token_delete error:', err);
      }
    });

    // ── Changer la carte active (MJ) ──────────────────────
    socket.on('map_change', async ({ campaign_id, map_id }) => {
      if (socket.role !== 'gm') return;
      try {
        await db.query('UPDATE maps SET is_active = FALSE WHERE campaign_id = $1', [campaign_id]);
        await db.query('UPDATE maps SET is_active = TRUE WHERE id = $1', [map_id]);
        const map = await db.query('SELECT id,name,background_url,grid_size,width,height,is_active,fog_of_war,walls,lights FROM maps WHERE id = $1', [map_id]);
        const tokens = await db.query(
          `SELECT t.*, c.name AS char_name, c.portrait_url AS char_portrait,
                  c.user_id AS char_user_id, c.vision_radius AS char_vision_radius,
                  c.vision_angle AS char_vision_angle,
                  COALESCE(t.hp_max, c.hp_max) AS hp_max
           FROM tokens t LEFT JOIN characters c ON c.id = t.character_id
           WHERE t.map_id = $1`, [map_id]
        );
        io.to(campaign_id).emit('map_changed', { map: map.rows[0], tokens: tokens.rows });
      } catch (err) {
        console.error('[WS] map_change error:', err);
      }
    });

    // ── AUDIO : Jouer ─────────────────────────────────────────
    socket.on('audio_play', ({ campaign_id, type, preset, url, track_name, loop, volume }) => {
      if (socket.role !== 'gm') return;
      const state = { type, preset, url, track_name, loop: loop !== false, volume: volume ?? 0.7, playing: true };
      audioStates.set(campaign_id, state);
      io.to(campaign_id).emit('audio_state', state);
    });

    // ── AUDIO : Stop ──────────────────────────────────────────
    socket.on('audio_stop', ({ campaign_id }) => {
      if (socket.role !== 'gm') return;
      audioStates.delete(campaign_id);
      io.to(campaign_id).emit('audio_stopped');
    });

    // ── AUDIO : Volume (MJ ajuste le volume global) ───────────
    socket.on('audio_volume', ({ campaign_id, volume }) => {
      if (socket.role !== 'gm') return;
      const state = audioStates.get(campaign_id);
      if (state) state.volume = volume;
      io.to(campaign_id).emit('audio_volume', { volume });
    });

    // ── MODE NUIT ─────────────────────────────────────────────
    socket.on('night_mode_set', ({ campaign_id, enabled }) => {
      if (socket.role !== 'gm') return;
      nightModeStates.set(campaign_id, !!enabled);
      io.to(campaign_id).emit('night_mode_state', { enabled: !!enabled });
    });

    // ── AFFICHAGE PV ─────────────────────────────────────────
    socket.on('hp_display_update', ({ campaign_id, pc_mode, npc_mode, threshold_high, threshold_low }) => {
      if (socket.role !== 'gm') return;
      const state = {
        pc_mode:         ['none','bar','exact'].includes(pc_mode)  ? pc_mode  : 'bar',
        npc_mode:        ['none','bar','exact'].includes(npc_mode) ? npc_mode : 'none',
        threshold_high:  Math.max(1, Math.min(99, parseInt(threshold_high)  || 70)),
        threshold_low:   Math.max(1, Math.min(99, parseInt(threshold_low)   || 30)),
      };
      hpDisplayStates.set(campaign_id, state);
      io.to(campaign_id).emit('hp_display_state', state);
    });

    // ── MÉTÉO / AMBIANCE ──────────────────────────────────────
    socket.on('weather_set', ({ campaign_id, type, intensity }) => {
      if (socket.role !== 'gm') return;
      const state = { type: type || 'none', intensity: intensity ?? 5 };
      weatherStates.set(campaign_id, state);
      io.to(campaign_id).emit('weather_state', state);
    });

    // ── BROUILLARD DE GUERRE ──────────────────────────────────
    socket.on('fog_reveal', async ({ campaign_id, map_id, circles }) => {
      if (socket.role !== 'gm') return;
      const key = `${campaign_id}:${map_id}`;
      const state = fogStates.get(key) || { circles: [], allRevealed: false };
      state.circles.push(...circles);
      fogStates.set(key, state);
      io.to(campaign_id).emit('fog_update', { map_id, circles: state.circles, allRevealed: state.allRevealed });
      try { await db.query('UPDATE maps SET fog_of_war=$1 WHERE id=$2', [JSON.stringify(state), map_id]); } catch {}
    });

    socket.on('fog_clear', async ({ campaign_id, map_id }) => {
      if (socket.role !== 'gm') return;
      const key = `${campaign_id}:${map_id}`;
      const state = { circles: [], allRevealed: true };
      fogStates.set(key, state);
      io.to(campaign_id).emit('fog_update', { map_id, circles: [], allRevealed: true });
      try { await db.query('UPDATE maps SET fog_of_war=$1 WHERE id=$2', [JSON.stringify(state), map_id]); } catch {}
    });

    socket.on('fog_reset', async ({ campaign_id, map_id }) => {
      if (socket.role !== 'gm') return;
      const key = `${campaign_id}:${map_id}`;
      const state = { circles: [], allRevealed: false };
      fogStates.set(key, state);
      io.to(campaign_id).emit('fog_update', { map_id, circles: [], allRevealed: false });
      try { await db.query('UPDATE maps SET fog_of_war=$1 WHERE id=$2', [JSON.stringify(state), map_id]); } catch {}
    });

    // ── CONDITIONS DE STATUT ──────────────────────────────────
    socket.on('token_conditions', ({ campaign_id, token_id, conditions }) => {
      if (socket.role !== 'gm') return;
      io.to(campaign_id).emit('token_conditions_updated', { token_id, conditions });
    });

    // ── PING DE CARTE ─────────────────────────────────────────
    // N'importe quel membre peut pinger un endroit sur la carte
    socket.on('map_ping', ({ campaign_id, x, y }) => {
      if (!socket.user) return;
      // Broadcaster à tous les autres (pas l'émetteur — déjà affiché localement)
      socket.to(campaign_id).emit('map_ping', {
        x, y,
        username: socket.user.username,
      });
    });

    // ── MESURE DE DISTANCE (partagée) ────────────────────────
    socket.on('measure_show', ({ campaign_id, points }) => {
      if (!socket.user) return;
      socket.to(campaign_id).emit('measure_show', {
        points,
        username: socket.user.username,
      });
    });

    socket.on('measure_clear', ({ campaign_id }) => {
      if (!socket.user) return;
      socket.to(campaign_id).emit('measure_clear', {
        username: socket.user.username,
      });
    });

    // ── DESSIN SUR LA CARTE ──────────────────────────────────
    socket.on('draw_stroke', async ({ campaign_id, map_id, stroke }) => {
      if (!socket.user) return;
      // Charger les drawings existants depuis la DB
      try {
        const res = await db.query('SELECT drawings FROM maps WHERE id = $1', [map_id]);
        if (!res.rows[0]) return;
        let drawings = res.rows[0].drawings || [];
        if (typeof drawings === 'string') drawings = JSON.parse(drawings);
        drawings.push(stroke);
        await db.query('UPDATE maps SET drawings = $1 WHERE id = $2', [JSON.stringify(drawings), map_id]);
        socket.to(campaign_id).emit('draw_stroke', { stroke });
      } catch (err) {
        console.error('[WS] draw_stroke error:', err);
      }
    });

    socket.on('draw_undo', async ({ campaign_id, map_id }) => {
      if (!socket.user) return;
      try {
        const res = await db.query('SELECT drawings FROM maps WHERE id = $1', [map_id]);
        if (!res.rows[0]) return;
        let drawings = res.rows[0].drawings || [];
        if (typeof drawings === 'string') drawings = JSON.parse(drawings);
        if (drawings.length === 0) return;
        const removed = drawings.pop();
        await db.query('UPDATE maps SET drawings = $1 WHERE id = $2', [JSON.stringify(drawings), map_id]);
        socket.to(campaign_id).emit('draw_undo', { removed });
      } catch (err) {
        console.error('[WS] draw_undo error:', err);
      }
    });

    socket.on('draw_clear', async ({ campaign_id, map_id }) => {
      if (!socket.user) return;
      try {
        await db.query('UPDATE maps SET drawings = $1 WHERE id = $2', ['[]', map_id]);
        socket.to(campaign_id).emit('draw_clear', {});
      } catch (err) {
        console.error('[WS] draw_clear error:', err);
      }
    });

    // ── CIBLAGE ──────────────────────────────────────────────
    // Stocké en mémoire : { campaign_id: [{ from_token_id, to_token_id, player_id, player_name, revealed }] }
    const campaignTargets = new Map();

    socket.on('set_target', ({ campaign_id, from_token_id, to_token_id, to_token_name }) => {
      if (!socket.user) return;
      if (!campaignTargets.has(campaign_id)) campaignTargets.set(campaign_id, []);
      const targets = campaignTargets.get(campaign_id);
      // Supprimer l'ancienne cible du même joueur pour le même from_token
      const idx = targets.findIndex(t => t.player_id === socket.user.id && t.from_token_id === from_token_id);
      const target = { from_token_id, to_token_id, to_token_name: to_token_name || 'Inconnu', player_id: socket.user.id, player_name: socket.user.username, revealed: false };
      if (idx >= 0) targets[idx] = target;
      else targets.push(target);
      // Envoyer au MJ toutes les cibles
      if (socket.role === 'gm') {
        io.to(campaign_id).emit('targets_state', targets.map(t => ({ ...t, player_name: t.player_id === socket.user.id ? t.player_name : t.player_name })));
      } else {
        // Joueur : voir ses propres cibles, le MJ voit tout
        socket.emit('targets_state', targets.filter(t => t.player_id === socket.user.id || t.revealed));
        const gmSockets = [...io.sockets.adapter.rooms.get(campaign_id) || []]
          .map(id => io.sockets.sockets.get(id)).filter(s => s?.role === 'gm');
        gmSockets.forEach(gmSocket => gmSocket.emit('targets_state', targets));
      }
    });

    socket.on('clear_target', ({ campaign_id, from_token_id }) => {
      if (!socket.user) return;
      if (campaignTargets.has(campaign_id)) {
        const targets = campaignTargets.get(campaign_id);
        const cleared = targets.filter(t => !(t.player_id === socket.user.id && t.from_token_id === from_token_id));
        campaignTargets.set(campaign_id, cleared);
        // Notifier le MJ
        const gmSockets = [...io.sockets.adapter.rooms.get(campaign_id) || []]
          .map(id => io.sockets.sockets.get(id)).filter(s => s?.role === 'gm');
        gmSockets.forEach(gmSocket => gmSocket.emit('targets_state', cleared));
        socket.emit('targets_state', cleared.filter(t => t.player_id === socket.user.id || t.revealed));
      }
    });

    socket.on('reveal_targets_on_roll', ({ campaign_id, from_token_id, dice_data }) => {
      if (!socket.user || !campaignTargets.has(campaign_id)) return;
      const targets = campaignTargets.get(campaign_id);
      // Trouver les cibles du joueur pour ce token
      const playerTargets = targets.filter(t => t.player_id === socket.user.id && t.from_token_id === from_token_id);
      for (const t of playerTargets) {
        // Vérifier si d'autres ennemis sont adjacents à la cible
        // La vérification est faite côté client, on reçoit l'info
        t.revealed = true;
      }
      // Mettre à jour tous les joueurs
      const gmSockets = [...io.sockets.adapter.rooms.get(campaign_id) || []]
        .map(id => io.sockets.sockets.get(id)).filter(s => s?.role === 'gm');
      gmSockets.forEach(gmSocket => gmSocket.emit('targets_state', targets));
      socket.to(campaign_id).emit('targets_state', targets.filter(t => t.revealed));
      socket.emit('targets_state', targets.filter(t => t.player_id === socket.user.id || t.revealed));
    });

    // ── HANDOUTS (broadcast partage) ─────────────────────────
    socket.on('handout_share_broadcast', ({ campaign_id, handout }) => {
      if (socket.role !== 'gm') return;
      socket.to(campaign_id).emit('handout_shared', { handout });
    });

    socket.on('handout_unshare_broadcast', ({ campaign_id, handout_id }) => {
      if (socket.role !== 'gm') return;
      socket.to(campaign_id).emit('handout_unshared', { handout_id });
    });

    socket.on('handout_deleted_broadcast', ({ campaign_id, handout_id }) => {
      if (socket.role !== 'gm') return;
      socket.to(campaign_id).emit('handout_deleted', { handout_id });
    });

    // ── ZONES DE SORTS ────────────────────────────────────────
    socket.on('zone_add', ({ campaign_id, zone }) => {
      if (!socket.user) return;
      io.to(campaign_id).emit('zone_added', { zone });
    });

    socket.on('zone_remove', ({ campaign_id, zone_id }) => {
      if (!socket.user) return;
      io.to(campaign_id).emit('zone_removed', { zone_id });
    });

    socket.on('zones_clear', ({ campaign_id }) => {
      if (!socket.user) return;
      io.to(campaign_id).emit('zones_cleared');
    });

    socket.on('zone_move', ({ campaign_id, zone }) => {
      if (!socket.user) return;
      io.to(campaign_id).emit('zone_moved', { zone });
    });

    // ── HP token (MJ) ────────────────────────────────────────
    socket.on('token_hp', async ({ campaign_id, token_id, hp_current }) => {
      if (socket.role !== 'gm') return;
      try {
        await db.query('UPDATE tokens SET hp_current=$1 WHERE id=$2', [hp_current, token_id]);
        io.to(campaign_id).emit('token_hp_updated', { token_id, hp_current });
      } catch (err) { console.error('[WS] token_hp error:', err); }
    });

    // ── COMBAT : Démarrer (MJ envoie uniquement les ennemis) ──
    socket.on('combat_start', async ({ campaign_id, combatants }) => {
      if (socket.role !== 'gm') return;
      const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
      const state = { combatants: sorted, current_turn: 0, round: 1 };
      combatStates.set(campaign_id, state);
      io.to(campaign_id).emit('combat_state', state);

      // Récupérer les personnages de la campagne pour savoir qui doit lancer son initiative
      try {
        const chars = await db.query(
          `SELECT c.id, c.name, c.user_id, c.hp_current, c.hp_max, c.stats
           FROM characters c
           JOIN campaign_members cm ON cm.campaign_id = c.campaign_id AND cm.user_id = c.user_id
           WHERE c.campaign_id = $1`,
          [campaign_id]
        );
        io.to(campaign_id).emit('combat_roll_needed', { characters: chars.rows });
      } catch {}

      io.to(campaign_id).emit('message_received', {
        type: 'system', content: '⚔ Le combat commence ! Chaque joueur doit lancer son initiative.', created_at: new Date()
      });
    });

    // ── COMBAT : Joueur soumet son initiative ─────────────
    socket.on('combat_roll_initiative', ({ campaign_id, combatant }) => {
      const state = combatStates.get(campaign_id);
      if (!state) return;
      // Vérifier que ce perso n'est pas déjà dans la liste
      if (state.combatants.find(c => c.char_id === combatant.char_id)) return;
      state.combatants.push(combatant);
      state.combatants.sort((a, b) => b.initiative - a.initiative);
      io.to(campaign_id).emit('combat_state', state);
      io.to(campaign_id).emit('message_received', {
        type: 'system',
        content: `🎲 ${combatant.name} — Initiative : ${combatant.initiative}`,
        created_at: new Date()
      });
    });

    // ── COMBAT : Tour suivant ─────────────────────────────
    socket.on('combat_next', ({ campaign_id }) => {
      if (socket.role !== 'gm') return;
      const state = combatStates.get(campaign_id);
      if (!state) return;
      state.current_turn++;
      if (state.current_turn >= state.combatants.length) {
        state.current_turn = 0;
        state.round++;
        io.to(campaign_id).emit('message_received', {
          type: 'system', content: `🔄 Round ${state.round}`, created_at: new Date()
        });
      }
      const cur = state.combatants[state.current_turn];
      io.to(campaign_id).emit('combat_state', state);
      io.to(campaign_id).emit('message_received', {
        type: 'system', content: `▶ Tour de ${cur.name}`, created_at: new Date()
      });
    });

    // ── COMBAT : Tour précédent ───────────────────────────
    socket.on('combat_prev', ({ campaign_id }) => {
      if (socket.role !== 'gm') return;
      const state = combatStates.get(campaign_id);
      if (!state) return;
      state.current_turn--;
      if (state.current_turn < 0) {
        state.current_turn = state.combatants.length - 1;
        state.round = Math.max(1, state.round - 1);
      }
      io.to(campaign_id).emit('combat_state', state);
    });

    // ── COMBAT : Mise à jour HP ───────────────────────────
    socket.on('combat_hp', ({ campaign_id, combatant_id, hp }) => {
      const state = combatStates.get(campaign_id);
      if (!state) return;
      const c = state.combatants.find(c => c.id === combatant_id);
      if (c) c.hp = Math.max(0, Math.min(c.hp_max, hp));
      io.to(campaign_id).emit('combat_state', state);
      // Sync DB si c'est un vrai personnage
      if (c?.char_id) {
        db.query('UPDATE characters SET hp_current = $1 WHERE id = $2', [c.hp, c.char_id]).catch(() => {});
      }
    });

    // ── COMBAT : Ajouter un combattant (mid-fight) ────────
    socket.on('combat_add', ({ campaign_id, combatant }) => {
      if (socket.role !== 'gm') return;
      const state = combatStates.get(campaign_id);
      if (!state) return;
      state.combatants.push(combatant);
      state.combatants.sort((a, b) => b.initiative - a.initiative);
      io.to(campaign_id).emit('combat_state', state);
    });

    // ── COMBAT : Retirer un combattant ────────────────────
    socket.on('combat_remove', ({ campaign_id, combatant_id }) => {
      if (socket.role !== 'gm') return;
      const state = combatStates.get(campaign_id);
      if (!state) return;
      const idx = state.combatants.findIndex(c => c.id === combatant_id);
      if (idx >= 0) {
        state.combatants.splice(idx, 1);
        if (state.current_turn >= state.combatants.length) state.current_turn = 0;
      }
      io.to(campaign_id).emit('combat_state', state);
    });

    // ── COMBAT : Terminer ─────────────────────────────────
    socket.on('combat_end', ({ campaign_id }) => {
      if (socket.role !== 'gm') return;
      combatStates.delete(campaign_id);
      io.to(campaign_id).emit('combat_ended');
      io.to(campaign_id).emit('message_received', {
        type: 'system', content: '🏳 Le combat est terminé.', created_at: new Date()
      });
    });

    // ── MURS : Sauvegarder les segments de mur ────────────────────
    socket.on('walls_save', async ({ campaign_id, map_id, walls }) => {
      if (socket.role !== 'gm') return;
      try {
        await db.query('UPDATE maps SET walls = $1 WHERE id = $2', [JSON.stringify(walls), map_id]);
        io.to(campaign_id).emit('walls_updated', { map_id, walls });
      } catch (err) { console.error('[WS] walls_save error:', err); }
    });

    // ── LUMIÈRES : rétrocompatibilité ────────────────────────────
    socket.on('lights_save', async ({ campaign_id, map_id, lights }) => {
      if (socket.role !== 'gm') return;
      try {
        await db.query('UPDATE maps SET lights = $1 WHERE id = $2', [JSON.stringify(lights), map_id]);
        io.to(campaign_id).emit('lights_updated', { map_id, lights });
      } catch (err) { console.error('[WS] lights_save error:', err); }
    });

    // ── OBJETS : Sauvegarder les objets de la carte ───────────────
    socket.on('objects_save', async ({ campaign_id, map_id, objects }) => {
      if (socket.role !== 'gm') return;
      try {
        await db.query('UPDATE maps SET objects = $1 WHERE id = $2', [JSON.stringify(objects), map_id]);
        io.to(campaign_id).emit('objects_updated', { map_id, objects });
      } catch (err) { console.error('[WS] objects_save error:', err); }
    });

    // ── VISION : Changer le mode ('all' | 'character' | 'none') ──
    socket.on('vision_mode_set', ({ campaign_id, mode }) => {
      if (socket.role !== 'gm') return;
      const validModes = ['all', 'character', 'none'];
      if (!validModes.includes(mode)) return;
      visionModeStates.set(campaign_id, mode);
      io.to(campaign_id).emit('vision_mode', { mode });
    });

    // ── VISION : Mettre à jour la vision d'un personnage ──────────
    socket.on('character_vision_set', async ({ campaign_id, char_id, vision_radius }) => {
      if (socket.role !== 'gm') return;
      try {
        await db.query('UPDATE characters SET vision_radius = $1 WHERE id = $2', [vision_radius, char_id]);
        // Mettre à jour les tokens qui utilisent ce personnage sur la carte active
        const activeMap = await db.query(
          'SELECT id FROM maps WHERE campaign_id = $1 AND is_active = TRUE LIMIT 1',
          [campaign_id]
        );
        if (activeMap.rows[0]) {
          await db.query(
            'UPDATE tokens SET char_vision_radius_cache = $1 WHERE character_id = $2 AND map_id = $3',
            [vision_radius, char_id, activeMap.rows[0].id]
          ).catch(() => {}); // colonne cache optionnelle — ignore si inexistante
        }
        io.to(campaign_id).emit('character_vision_updated', { char_id, vision_radius });
      } catch (err) {
        console.error('[WS] character_vision_set error:', err);
      }
    });

    // ── Montée de niveau (D&D 5e) ─────────────────────────────

    // ── Tables D&D 5e (12 classes officielles) ────────────────
    // Dés de vie par classe (français normalisé NFD → ASCII)
    const DND5E_HIT_DICE = {
      // d12
      'barbare': 12, 'barbarian': 12,
      // d10
      'guerrier': 10, 'fighter': 10,
      'paladin':  10,
      'rodeur':   10, 'ranger': 10,      // rôdeur → rodeur après NFD
      // d8
      'barde':      8, 'bard':    8,
      'clerc':      8, 'cleric':  8,
      'druide':     8, 'druid':   8,
      'moine':      8, 'monk':    8,
      'occultiste': 8, 'warlock': 8,
      'roublard':   8, 'rogue':   8,
      // d6
      'ensorceleur': 6, 'sorcerer': 6,
      'magicien':    6, 'wizard':   6,
    };

    // Emplacements de sorts — Full Casters
    // (Barde, Clerc, Druide, Ensorceleur, Magicien)
    const FULL_CASTER_SLOTS = [
      null,
      {1:2},                                          // niv 1
      {1:3},                                          // niv 2
      {1:4, 2:2},                                     // niv 3
      {1:4, 2:3},                                     // niv 4
      {1:4, 2:3, 3:2},                                // niv 5
      {1:4, 2:3, 3:3},                                // niv 6
      {1:4, 2:3, 3:3, 4:1},                           // niv 7
      {1:4, 2:3, 3:3, 4:2},                           // niv 8
      {1:4, 2:3, 3:3, 4:3, 5:1},                      // niv 9
      {1:4, 2:3, 3:3, 4:3, 5:2},                      // niv 10
      {1:4, 2:3, 3:3, 4:3, 5:2, 6:1},                 // niv 11
      {1:4, 2:3, 3:3, 4:3, 5:2, 6:1},                 // niv 12
      {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1},            // niv 13
      {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1},            // niv 14
      {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1, 8:1},       // niv 15
      {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1, 8:1},       // niv 16
      {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1, 8:1, 9:1},  // niv 17
      {1:4, 2:3, 3:3, 4:3, 5:3, 6:1, 7:1, 8:1, 9:1},  // niv 18
      {1:4, 2:3, 3:3, 4:3, 5:3, 6:2, 7:1, 8:1, 9:1},  // niv 19
      {1:4, 2:3, 3:3, 4:3, 5:3, 6:2, 7:2, 8:1, 9:1},  // niv 20
    ];

    // Half Casters (Paladin, Rôdeur)
    const HALF_CASTER_SLOTS = [
      null,
      {},                         // niv 1 — aucun slot
      {1:2},                      // niv 2
      {1:3},                      // niv 3
      {1:3},                      // niv 4
      {1:4, 2:2},                 // niv 5
      {1:4, 2:2},                 // niv 6
      {1:4, 2:3},                 // niv 7
      {1:4, 2:3},                 // niv 8
      {1:4, 2:3, 3:2},            // niv 9
      {1:4, 2:3, 3:2},            // niv 10
      {1:4, 2:3, 3:3},            // niv 11
      {1:4, 2:3, 3:3},            // niv 12
      {1:4, 2:3, 3:3, 4:1},       // niv 13
      {1:4, 2:3, 3:3, 4:1},       // niv 14
      {1:4, 2:3, 3:3, 4:2},       // niv 15
      {1:4, 2:3, 3:3, 4:2},       // niv 16
      {1:4, 2:3, 3:3, 4:3, 5:1},  // niv 17
      {1:4, 2:3, 3:3, 4:3, 5:1},  // niv 18
      {1:4, 2:3, 3:3, 4:3, 5:2},  // niv 19
      {1:4, 2:3, 3:3, 4:3, 5:2},  // niv 20
    ];

    // Third Casters (Chevalier des Runes/Eldritch Knight, Archer Arcanique/Arcane Trickster)
    // Slots débloqués à partir du niv 3 de personnage
    const THIRD_CASTER_SLOTS = [
      null,
      {}, {},                       // niv 1-2
      {1:2},                        // niv 3
      {1:3},                        // niv 4
      {1:3},                        // niv 5
      {1:3},                        // niv 6
      {1:4, 2:2},                   // niv 7
      {1:4, 2:2},                   // niv 8
      {1:4, 2:2},                   // niv 9
      {1:4, 2:3},                   // niv 10
      {1:4, 2:3},                   // niv 11
      {1:4, 2:3},                   // niv 12
      {1:4, 2:3, 3:2},              // niv 13
      {1:4, 2:3, 3:2},              // niv 14
      {1:4, 2:3, 3:2},              // niv 15
      {1:4, 2:3, 3:3},              // niv 16
      {1:4, 2:3, 3:3},              // niv 17
      {1:4, 2:3, 3:3},              // niv 18
      {1:4, 2:3, 3:3, 4:1},         // niv 19
      {1:4, 2:3, 3:3, 4:1},         // niv 20
    ];

    // Occultiste — Magie des Pactes (récupération sur repos court)
    // { s: nombre de slots, l: niveau des slots }
    const WARLOCK_PACT = [
      null,
      {s:1, l:1}, {s:2, l:1},                       // niv 1-2
      {s:2, l:2}, {s:2, l:2},                        // niv 3-4
      {s:2, l:3}, {s:2, l:3},                        // niv 5-6
      {s:2, l:4}, {s:2, l:4},                        // niv 7-8
      {s:2, l:5}, {s:2, l:5},                        // niv 9-10
      {s:3, l:5}, {s:3, l:5}, {s:3, l:5}, {s:3, l:5}, // niv 11-14
      {s:3, l:5}, {s:3, l:5},                        // niv 15-16
      {s:4, l:5}, {s:4, l:5}, {s:4, l:5}, {s:4, l:5}, // niv 17-20
    ];

    // Norme ASCII pour comparaison de noms de classe/sous-classe
    function dnd5eNorm(s) {
      return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    }

    // Type de lanceur selon classe ET sous-classe
    function dnd5eClassType(cls, subclass) {
      const c  = dnd5eNorm(cls);
      const sc = dnd5eNorm(subclass);
      // Full casters
      if (['barde','bard','clerc','cleric','druide','druid',
           'ensorceleur','sorcerer','magicien','wizard'].some(x => c.includes(x)))
        return 'full';
      // Half casters
      if (['paladin','rodeur','ranger'].some(x => c.includes(x)))
        return 'half';
      // Occultiste — Pact Magic
      if (['occultiste','warlock'].some(x => c.includes(x)))
        return 'warlock';
      // Tiers-lanceurs via sous-classe
      if (['chevalier des runes','eldritch knight',
           'archer arcanique','arcane trickster'].some(x => sc.includes(x)))
        return 'third';
      return 'none';
    }

    function dnd5eSpellSlots(cls, subclass, level) {
      const lvl  = Math.min(20, Math.max(1, level));
      const type = dnd5eClassType(cls, subclass);
      if (type === 'full')    return { ...(FULL_CASTER_SLOTS[lvl]  || {}) };
      if (type === 'half')    return { ...(HALF_CASTER_SLOTS[lvl]  || {}) };
      if (type === 'third')   return { ...(THIRD_CASTER_SLOTS[lvl] || {}) };
      if (type === 'warlock') {
        const w = WARLOCK_PACT[lvl];
        return w ? { [w.l]: w.s } : {};
      }
      return {};
    }

    function dnd5eHitDie(cls) {
      const c = dnd5eNorm(cls);
      for (const [k, v] of Object.entries(DND5E_HIT_DICE)) {
        if (c.includes(k)) return v;
      }
      return 8; // défaut
    }

    function dnd5eProfBonus(level) {
      return Math.ceil(level / 4) + 1;
    }

    function dnd5eConMod(stats) {
      return Math.floor(((stats?.con ?? 10) - 10) / 2);
    }

    // Calcule et retourne les PV gagnés côté serveur
    function dnd5eRollHp(cls, stats, method) {
      const hitDie = dnd5eHitDie(cls);
      const conmod = dnd5eConMod(stats);
      let base;
      if (method === 'roll') {
        base = Math.floor(Math.random() * hitDie) + 1;
      } else {
        base = Math.floor(hitDie / 2) + 1; // valeur moyenne officielle D&D 5e
      }
      return { roll: method === 'roll' ? base : null, gained: Math.max(1, base + conmod), hitDie, conmod };
    }

    // Capacités spéciales notables par niveau (pour message d'information)
    function dnd5eLevelNotes(cls, level) {
      const c = dnd5eNorm(cls);
      const notes = [];
      // ASI pour la plupart des classes (niveaux 4, 8, 12, 16, 19)
      const asiLevels = { default: [4,8,12,16,19], guerrier: [4,6,8,12,14,16,19], roublard: [4,8,10,12,16,19] };
      let asiList = asiLevels.default;
      if (c.includes('guerrier') || c.includes('fighter')) asiList = asiLevels.guerrier;
      if (c.includes('roublard') || c.includes('rogue'))   asiList = asiLevels.roublard;
      if (asiList.includes(level)) notes.push('Amélioration de Caractéristique (ASI) — à saisir manuellement dans la fiche');
      // Bonus de maîtrise
      const newProf = dnd5eProfBonus(level);
      const oldProf = dnd5eProfBonus(level - 1);
      if (newProf > oldProf) notes.push(`Bonus de maîtrise augmente : +${newProf}`);
      return notes;
    }

    // Joueur → demande montée de niveau (hp_method seulement, PAS de jet ici)
    socket.on('level_up_request', async ({ campaign_id, character_id, hp_method }) => {
      if (campaign_id !== socket.campaignId) return;
      try {
        const m = await db.query(
          'SELECT role FROM campaign_members WHERE campaign_id=$1 AND user_id=$2',
          [campaign_id, socket.user.id]
        );
        if (!m.rows[0]) return;

        const charQ = await db.query(
          'SELECT id, name, class, subclass, level, stats, user_id FROM characters WHERE id=$1 AND campaign_id=$2',
          [character_id, campaign_id]
        );
        const char = charQ.rows[0];
        if (!char) return;
        if (char.user_id !== socket.user.id && m.rows[0].role !== 'gm') return;

        // Vérifie qu'il n'y a pas déjà une demande en attente
        const existing = await db.query(
          "SELECT id FROM level_up_requests WHERE character_id=$1 AND status='pending'",
          [character_id]
        );
        if (existing.rows.length > 0) {
          return socket.emit('level_up_error', { message: 'Une demande est déjà en attente pour ce personnage.' });
        }

        const method  = hp_method === 'roll' ? 'roll' : 'average';
        const hitDie  = dnd5eHitDie(char.class);
        const conmod  = dnd5eConMod(char.stats);
        const oldLvl  = char.level;
        const newLvl  = oldLvl + 1;
        const avgHp   = Math.max(1, Math.floor(hitDie / 2) + 1 + conmod);

        // On stocke la méthode mais PAS le résultat — le jet se fait à l'approbation
        const req = await db.query(
          `INSERT INTO level_up_requests
             (campaign_id, character_id, requested_by, status, hp_method, old_level, new_level)
           VALUES ($1,$2,$3,'pending',$4,$5,$6) RETURNING *`,
          [campaign_id, character_id, socket.user.id, method, oldLvl, newLvl]
        );

        socket.emit('level_up_requested', { request_id: req.rows[0].id, character_name: char.name, new_level: newLvl });

        // Notifier tous les MJ de la campagne
        const sockets = await io.in(campaign_id).fetchSockets();
        for (const s of sockets) {
          if (s.role === 'gm') {
            s.emit('level_up_pending', {
              request_id: req.rows[0].id,
              character_id,
              character_name: char.name,
              character_class: char.class,
              character_subclass: char.subclass,
              player: socket.user.username,
              old_level: oldLvl,
              new_level: newLvl,
              hp_method: method,
              hit_die: hitDie,
              con_mod: conmod,
              avg_hp: avgHp,
            });
          }
        }
      } catch (err) {
        console.error('[WS] level_up_request error:', err);
      }
    });

    // MJ → liste des demandes en attente
    socket.on('level_up_requests_list', async ({ campaign_id }) => {
      if (campaign_id !== socket.campaignId) return;
      try {
        const m = await db.query(
          'SELECT role FROM campaign_members WHERE campaign_id=$1 AND user_id=$2',
          [campaign_id, socket.user.id]
        );
        if (!m.rows[0] || m.rows[0].role !== 'gm') return;

        const rows = await db.query(
          `SELECT r.*,
                  c.name     AS character_name,
                  c.class    AS character_class,
                  c.subclass AS character_subclass,
                  c.race     AS character_race,
                  c.stats    AS character_stats,
                  u.username AS player_name
           FROM level_up_requests r
           JOIN characters c ON c.id = r.character_id
           JOIN users u      ON u.id = r.requested_by
           WHERE r.campaign_id=$1 AND r.status='pending'
           ORDER BY r.created_at`,
          [campaign_id]
        );
        // Enrichir avec hit_die et con_mod (calculés à la volée)
        const requests = rows.rows.map(r => {
          const hitDie = dnd5eHitDie(r.character_class);
          const conmod = dnd5eConMod(r.character_stats);
          const avg    = Math.max(1, Math.floor(hitDie / 2) + 1 + conmod);
          return { ...r, hit_die: hitDie, con_mod: conmod, avg_hp: avg };
        });
        socket.emit('level_up_requests_list', { requests });
      } catch (err) {
        console.error('[WS] level_up_requests_list error:', err);
      }
    });

    // MJ → approuve ou refuse
    socket.on('level_up_resolve', async ({ campaign_id, request_id, approved, reject_reason }) => {
      if (campaign_id !== socket.campaignId) return;
      try {
        const m = await db.query(
          'SELECT role FROM campaign_members WHERE campaign_id=$1 AND user_id=$2',
          [campaign_id, socket.user.id]
        );
        if (!m.rows[0] || m.rows[0].role !== 'gm') return;

        const reqQ = await db.query(
          "SELECT * FROM level_up_requests WHERE id=$1 AND campaign_id=$2 AND status='pending'",
          [request_id, campaign_id]
        );
        if (!reqQ.rows[0]) return socket.emit('level_up_error', { message: 'Demande introuvable ou déjà traitée.' });
        const req = reqQ.rows[0];

        if (!approved) {
          await db.query(
            "UPDATE level_up_requests SET status='rejected', reject_reason=$1, resolved_at=NOW() WHERE id=$2",
            [reject_reason || null, request_id]
          );
          io.to(campaign_id).emit('level_up_resolved_broadcast', { request_id, approved: false, character_id: req.character_id, reject_reason: reject_reason || null });
          return;
        }

        // ── Approbation : on récupère le perso et on calcule MAINTENANT ──
        const charQ = await db.query('SELECT * FROM characters WHERE id=$1', [req.character_id]);
        const char = charQ.rows[0];
        if (!char) return;

        // Jet de dés côté serveur — résultat vierge de toute triche
        const { roll, gained: hpGained, hitDie, conmod } = dnd5eRollHp(char.class, char.stats, req.hp_method);

        const newLevel  = req.new_level;
        const newHpMax  = (char.hp_max || 10) + hpGained;
        const newHpCurr = (char.hp_current || 10) + hpGained;
        const newProf   = dnd5eProfBonus(newLevel);

        // Emplacements de sorts recalculés
        const newSlots = dnd5eSpellSlots(char.class, char.subclass, newLevel);
        const currentSpells    = char.spells || {};
        const currentSlotsUsed = currentSpells.slots_used || {};
        const newSlotsUsed     = {};
        for (const [lvl, max] of Object.entries(newSlots)) {
          newSlotsUsed[lvl] = Math.min(currentSlotsUsed[lvl] || 0, max);
        }
        const updatedSpells = { ...currentSpells, slots: newSlots, slots_used: newSlotsUsed };

        await db.query(
          `UPDATE characters SET level=$1, hp_max=$2, hp_current=$3, proficiency_bonus=$4, spells=$5 WHERE id=$6`,
          [newLevel, newHpMax, newHpCurr, newProf, JSON.stringify(updatedSpells), char.id]
        );
        await db.query(
          "UPDATE level_up_requests SET status='approved', hp_roll=$1, hp_gained=$2, resolved_at=NOW() WHERE id=$3",
          [roll, hpGained, request_id]
        );

        const notes = dnd5eLevelNotes(char.class, newLevel);

        io.to(campaign_id).emit('level_up_resolved_broadcast', {
          request_id,
          approved: true,
          character_id:   char.id,
          character_name: char.name,
          new_level:      newLevel,
          hp_method:      req.hp_method,
          hp_roll:        roll,
          hp_gained:      hpGained,
          hit_die:        hitDie,
          con_mod:        conmod,
          new_hp_max:     newHpMax,
          new_prof:       newProf,
          new_slots:      newSlots,
          notes,
          updated_char: { ...char, level: newLevel, hp_max: newHpMax, hp_current: newHpCurr, proficiency_bonus: newProf, spells: updatedSpells },
        });
      } catch (err) {
        console.error('[WS] level_up_resolve error:', err);
      }
    });

    // ── Déconnexion ───────────────────────────────────────
    socket.on('disconnect', () => {
      if (socket.campaignId) {
        socket.to(socket.campaignId).emit('user_left', { id: socket.user.id, username: socket.user.username });
      }
      console.log(`[WS] Déconnecté : ${socket.user.username}`);
    });
  });
};

// ── Utilitaire dés ────────────────────────────────────────────
function rollDice(diceExpr, modifier) {
  // Supporte "2d6", "d20", "4d6"
  const m = diceExpr.toLowerCase().match(/^(\d*)d(\d+)$/);
  if (!m) return { rolls: [0], total: 0 };
  const count = parseInt(m[1] || '1', 10);
  const faces = parseInt(m[2], 10);
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { rolls, total };
}
