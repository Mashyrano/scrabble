const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useCallback, useEffect, useRef, useState } from 'react';

export default function useScrabbleRoom(code, { name, maxPlayers } = {}) {
  const [state, setState] = useState(null);
  const [rack, setRack] = useState([]);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const roomRef = useRef(null);

  useEffect(() => {
    if (!code || !name) return undefined;
    const storageKey = `scrabble:conn:${code}`;
    let connId = sessionStorage.getItem(storageKey);
    if (!connId) {
      connId = crypto.randomUUID();
      sessionStorage.setItem(storageKey, connId);
    }

    const room = db.actors.ScrabbleRoom(code).connect({ id: connId });
    roomRef.current = room;
    const subscription = room.subscribe((msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'state') setState(msg.state);
      else if (msg.type === 'rack') setRack(msg.tiles || []);
      else if (msg.type === 'you') setMe(msg);
      else if (msg.type === 'error') setError({ message: msg.message, at: Date.now() });
    });

    room.send({ type: 'join', name, code, maxPlayers });

    return () => {
      subscription.unsubscribe();
      room.close();
      roomRef.current = null;
    };
  }, [code, name, maxPlayers]);

  const send = useCallback((message) => roomRef.current?.send(message), []);
  const clearError = useCallback(() => setError(null), []);

  return { state, rack, me, error, clearError, send };
}