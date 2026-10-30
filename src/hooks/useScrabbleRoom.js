import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '@/api/supabaseClient';

// Every action goes to the `room` edge function. The table's public state and
// this player's rack come back over Realtime, and presence shows who is online.
export default function useScrabbleRoom(code, { userId, maxPlayers } = {}) {
  const [state, setState] = useState(null);
  const [rack, setRack] = useState([]);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState([]);
  const stateVersion = useRef(0);
  const rackVersion = useRef(0);

  // Updates can arrive out of order (reply vs. Realtime); keep the newest.
  const applyState = useCallback((next) => {
    if (!next || next.version < stateVersion.current) return;
    stateVersion.current = next.version;
    setState(next);
  }, []);

  const applyRack = useCallback((tiles, version) => {
    if (!Array.isArray(tiles) || version < rackVersion.current) return;
    rackVersion.current = version;
    setRack(tiles);
  }, []);

  const call = useCallback(async (message) => {
    const { data, error: invokeError } = await supabase.functions.invoke('room', { body: { code, ...message } });
    if (invokeError || !data) {
      setError({ message: 'The table could not be reached — please try again.', at: Date.now() });
      return null;
    }
    if (data.error) {
      setError({ message: data.error, at: Date.now() });
      return data;
    }
    applyState(data.state);
    applyRack(data.rack, data.version);
    return data;
  }, [code, applyState, applyRack]);

  useEffect(() => {
    if (!code || !userId) return undefined;
    stateVersion.current = 0;
    rackVersion.current = 0;

    const channel = supabase.channel(`room:${code}`, { config: { presence: { key: userId } } });
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_states', filter: `code=eq.${code}` }, (payload) => {
        applyState(payload.new?.state);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_hands', filter: `code=eq.${code}` }, (payload) => {
        if (payload.new?.user_id === userId) applyRack(payload.new.tiles, payload.new.version);
      })
      .on('presence', { event: 'sync' }, () => setOnline(Object.keys(channel.presenceState())))
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        channel.track({ online_at: new Date().toISOString() });
        // Join once subscribed, so no update between the two can be missed.
        call({ type: 'join', maxPlayers }).then((data) => {
          if (data?.seat) setMe({ seat: data.seat, userId });
        });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, userId, maxPlayers, call, applyState, applyRack]);

  const withPresence = useMemo(() => {
    if (!state) return null;
    return { ...state, players: state.players.map((p) => ({ ...p, connected: online.includes(p.userId) })) };
  }, [state, online]);

  const send = useCallback((message) => call(message), [call]);
  const clearError = useCallback(() => setError(null), []);

  return { state: withPresence, rack, me, error, clearError, send };
}
