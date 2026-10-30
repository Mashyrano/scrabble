import { createClient } from 'npm:@supabase/supabase-js@2';
import { applyAction, gameRecord, initGame, normalizeCode, publicState, statRows } from '../_shared/room.ts';

// Every table action goes through here. The full game (bag and racks included)
// lives in `rooms`, which only this function can reach; `save_room` publishes the
// public state and each player's own rack, and clients follow those over Realtime.

const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Refused moves are a normal answer, not an HTTP failure, so they come back as 200.
const reply = (body, status = 200) => Response.json(body, { status, headers: CORS });

function displayName(user) {
  const meta = user.user_metadata || {};
  return meta.full_name || meta.name || String(user.email || '').split('@')[0] || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth?.user) return reply({ error: 'Please sign in to play.' });
    const user = { id: auth.user.id, name: displayName(auth.user) };

    const msg = await req.json().catch(() => null);
    const code = normalizeCode(msg?.code);
    if (!code) return reply({ error: 'Missing table code.' });

    // Optimistic concurrency: if another player saved first, replay on their result.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: row, error: loadError } = await admin.from('rooms').select('game, version').eq('code', code).maybeSingle();
      if (loadError) throw loadError;
      if (!row && msg.type !== 'join') return reply({ error: 'That table does not exist.' });

      const version = row ? row.version : 0;
      const game = row ? row.game : initGame(code);
      const outcome = applyAction(game, user, msg);
      if (outcome.error) return reply({ error: outcome.error });

      const next = version + 1;
      const state = publicState(game, next);
      const hands = game.players.map((p) => ({ user_id: p.userId, seat: p.seat, tiles: p.rack }));
      const { data: saved, error: saveError } = await admin.rpc('save_room', {
        p_code: code,
        p_version: version,
        p_game: game,
        p_state: state,
        p_hands: hands,
      });
      if (saveError) throw saveError;
      if (!saved) continue;

      if (outcome.finished) await storeResult(game, outcome.finished);
      const me = game.players.find((p) => p.userId === user.id);
      return reply({ ok: true, seat: me?.seat ?? null, version: next, state, rack: me ? me.rack : [] });
    }
    return reply({ error: 'The table is busy — please try again.' });
  } catch (error) {
    console.error('room failed', error);
    return reply({ error: 'Something went wrong — please try again.' }, 500);
  }
});

async function storeResult(game, finished) {
  try {
    const { data: inserted, error: insertError } = await admin
      .from('games')
      .upsert(gameRecord(game, finished), { onConflict: 'game_key', ignoreDuplicates: true })
      .select('id');
    if (insertError) throw insertError;
    if (!inserted?.length) return; // already recorded

    const ids = finished.adjusted.map((f) => f.userId).filter(Boolean);
    const { data: existing, error: statsError } = await admin.from('player_stats').select('*').in('user_id', ids);
    if (statsError) throw statsError;
    const { error: upsertError } = await admin
      .from('player_stats')
      .upsert(statRows(game, finished, existing || []), { onConflict: 'user_id' });
    if (upsertError) throw upsertError;
  } catch (error) {
    console.error('storing the result failed', error);
  }
}
