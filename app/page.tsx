"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Clock3, Film, Gamepad2, BookHeart, Plane, Check, Plus, Play,
  Pause, Send, Sparkles, LockKeyhole, MapPin, Volume2, Users, Copy, X
} from "lucide-react";
import { roomId, supabase } from "../lib/supabase";

type CursorPayload = { x: number; y: number; name: string; at: number };
type FeedItem = { id: string; kind: string; text: string; created_at: string };
type Todo = { id: string; text: string; done: boolean };
const USER = process.env.NEXT_PUBLIC_USER_NAME || "You";
const PARTNER = process.env.NEXT_PUBLIC_PARTNER_NAME || "Your person";

function useClock(timeZone: string) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return new Intl.DateTimeFormat("en", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true }).format(now);
}

function StatusCard({ name, city, zone, side }: { name: string; city: string; zone: string; side: "left" | "right" }) {
  const clock = useClock(zone);
  const [weather, setWeather] = useState("A little weather magic");
  useEffect(() => {
    let alive = true;
    const coords: Record<string, [number, number]> = {
      "Cape Town": [-33.9249, 18.4241], "London": [51.5072, -0.1276],
      "New York": [40.7128, -74.006], "Johannesburg": [-26.2041, 28.0473],
      "Sydney": [-33.8688, 151.2093]
    };
    const [lat, lon] = coords[city] || coords["Cape Town"];
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`)
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => {
        if (alive) setWeather(`${Math.round(d.current.temperature_2m)}°C · ${weatherLabel(d.current.weather_code)}`);
      }).catch(() => { if (alive) setWeather("Weather unavailable"); });
    return () => { alive = false; };
  }, [city]);
  const night = Number(clock.slice(0, 2)) >= 7 && clock.toLowerCase().includes("pm");
  return <div className={`status-card ${side} ${night ? "night" : "day"}`}>
    <div className="status-top"><span className="presence-dot" /><span>{name}</span><span className="tiny-label">{side === "left" ? "YOUR SIDE" : "THEIR SIDE"}</span></div>
    <div className="clock">{clock}</div>
    <div className="city"><MapPin size={13} /> {city} <span>· {zone.replaceAll("_", " ")}</span></div>
    <div className="weather"><span>☼</span>{weather}</div>
  </div>;
}
function weatherLabel(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Foggy";
  if (code >= 51 && code <= 67) return "Rainy";
  if (code >= 71 && code <= 86) return "Snow";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}

export default function Home() {
  const [active, setActive] = useState("home");
  const [pulse, setPulse] = useState(false);
  const [hearts, setHearts] = useState<{id:number; x:number}[]>([]);
  const [cursor, setCursor] = useState<CursorPayload | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [countdownDate, setCountdownDate] = useState("2027-01-01T12:00");
  const [now, setNow] = useState(Date.now());
  const [videoUrl, setVideoUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [speed, setSpeed] = useState("1");
  const [question, setQuestion] = useState("What is one tiny thing I do that makes you feel loved?");
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [todoText, setTodoText] = useState("");
  const [todos, setTodos] = useState<Todo[]>([
    { id: "1", text: "Have a movie night", done: false },
    { id: "2", text: "Take silly photobooth pictures", done: true },
    { id: "3", text: "Watch the sunrise together", done: false }
  ]);
  const [xIsNext, setXIsNext] = useState(true);
  const [squares, setSquares] = useState<(string|null)[]>(Array(9).fill(null));
  const [movieLikes, setMovieLikes] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");
  const [roomInput, setRoomInput] = useState(roomId);
  const [showRoom, setShowRoom] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{x:number;y:number}|null>(null);
  const countdown = useMemo(() => {
    const diff = Math.max(0, new Date(countdownDate).getTime() - now);
    return { days: Math.floor(diff / 86400000), hours: Math.floor(diff / 3600000) % 24, mins: Math.floor(diff / 60000) % 60, secs: Math.floor(diff / 1000) % 60 };
  }, [countdownDate, now]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`us-space:${roomId}`, { config: { presence: { key: USER }, broadcast: { self: false } } });
    channel.on("presence", { event: "sync" }, () => setPartnerOnline(Object.keys(channel.presenceState()).some(k => k !== USER)));
    channel.on("broadcast", { event: "cursor" }, ({ payload }) => setCursor(payload as CursorPayload));
    channel.on("broadcast", { event: "pulse" }, ({ payload }) => {
      setPulse(true); setTimeout(() => setPulse(false), 1000);
      setHearts(h => [...h, { id: Date.now(), x: 42 + Math.random() * 16 }]);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(90);
      setToast(`${payload.name || PARTNER} sent you a pulse 💗`); setTimeout(() => setToast(""), 2800);
    });
    channel.on("broadcast", { event: "sync-media" }, ({ payload }) => {
      setPlaying(Boolean(payload.playing)); setVideoTime(Number(payload.time || 0)); setSpeed(String(payload.speed || "1"));
    });
    channel.on("broadcast", { event: "reaction" }, ({ payload }) => {
      setHearts(h => [...h, { id: Date.now() + Math.random(), x: 20 + Math.random() * 60 }]);
      setToast(`${payload.name || PARTNER} sent ${payload.reaction || "a little love"}`);
      setTimeout(() => setToast(""), 2200);
    });
    channel.subscribe(async status => {
      if (status === "SUBSCRIBED") await channel.track({ name: USER, online_at: new Date().toISOString() });
    });
    (window as any).__usSpaceChannel = channel;
    return () => { supabase.removeChannel(channel); };
  }, []);

  const broadcast = useCallback((event: string, payload: object) => {
    const channel = (window as any).__usSpaceChannel;
    if (channel) channel.send({ type: "broadcast", event, payload });
  }, []);
  const sendPulse = () => {
    setPulse(true); setTimeout(() => setPulse(false), 1000);
    setHearts(h => [...h, { id: Date.now(), x: 42 + Math.random() * 16 }]);
    broadcast("pulse", { name: USER, at: Date.now() });
    setToast("Pulse sent 💗"); setTimeout(() => setToast(""), 2000);
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const payload = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, name: USER, at: Date.now() };
      broadcast("cursor", payload);
    };
    let last = 0;
    const throttled = (e: MouseEvent) => { if (Date.now() - last > 45) { last = Date.now(); onMove(e); } };
    window.addEventListener("mousemove", throttled);
    return () => window.removeEventListener("mousemove", throttled);
  }, [broadcast]);

  const mediaAction = (nextPlaying: boolean, nextTime = videoTime, nextSpeed = speed) => {
    setPlaying(nextPlaying); setVideoTime(nextTime); setSpeed(nextSpeed);
    broadcast("sync-media", { playing: nextPlaying, time: nextTime, speed: nextSpeed, at: Date.now(), name: USER });
  };
  const addTodo = () => {
    if (!todoText.trim()) return;
    setTodos(v => [...v, { id: String(Date.now()), text: todoText.trim(), done: false }]); setTodoText("");
  };
  const resetGame = () => { setSquares(Array(9).fill(null)); setXIsNext(true); };
  const winner = calculateWinner(squares);
  const onCanvasDown = (e: React.MouseEvent<HTMLCanvasElement>) => { drawing.current = true; const r = e.currentTarget.getBoundingClientRect(); lastPoint.current = { x: e.clientX-r.left, y: e.clientY-r.top }; };
  const onCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !lastPoint.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d"); if (!ctx) return;
    const r = e.currentTarget.getBoundingClientRect(); const p = { x: e.clientX-r.left, y: e.clientY-r.top };
    ctx.strokeStyle = "#c66d62"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(lastPoint.current.x,lastPoint.current.y); ctx.lineTo(p.x,p.y); ctx.stroke();
    lastPoint.current = p;
    broadcast("reaction", { reaction: "a doodle ✍️", name: USER });
  };
  const onCanvasUp = () => { drawing.current = false; lastPoint.current = null; };

  return <main className={`app-shell ${pulse ? "pulse-screen" : ""}`} onMouseLeave={() => setCursor(null)}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    {cursor && Date.now() - cursor.at < 5000 && <div className="partner-cursor" style={{left:`${cursor.x*100}%`,top:`${cursor.y*100}%`}}>➤<span>{cursor.name}</span></div>}
    <AnimatePresence>{hearts.map(h => <motion.div key={h.id} className="heart-particle" style={{left:`${h.x}%`}} initial={{y:"75vh",opacity:0,scale:.4}} animate={{y:"12vh",opacity:[0,1,0],scale:[.4,1.2,.8],rotate:[0,18,-12]}} transition={{duration:2.2}} onAnimationComplete={() => setHearts(v=>v.filter(x=>x.id!==h.id))}>♥</motion.div>)}</AnimatePresence>
    <header className="topbar">
      <button className="brand" onClick={() => setActive("home")}><span className="brand-mark">u<span>♥</span></span><span>us space<small>a little closer, every day</small></span></button>
      <div className="top-actions"><span className={`connection ${supabase ? (partnerOnline ? "online" : "") : "demo"}`}><i />{!supabase ? "Demo mode" : partnerOnline ? "Together now" : "Room ready"}</span><button className="pulse-button" onClick={sendPulse}><Heart size={17} fill="currentColor" /> Send a pulse</button><button className="icon-button" aria-label="Room settings" onClick={()=>setShowRoom(v=>!v)}><Users size={18}/></button></div>
    </header>
    {showRoom && <div className="room-popover"><strong>Your private room</strong><p>Both people need the same room ID and Supabase setup.</p><div className="room-row"><input value={roomInput} onChange={e=>setRoomInput(e.target.value)} aria-label="Room ID"/><button onClick={()=>{navigator.clipboard?.writeText(roomInput);setToast("Room ID copied");setTimeout(()=>setToast(""),2000)}}><Copy size={15}/></button></div><small>Room ID is configured in .env.local; change it there to switch rooms.</small></div>}
    <section className="welcome-row"><div><p className="eyebrow">YOUR LITTLE CORNER OF THE WORLD</p><h1>Distance is a detail.<br/><em>We’re still together.</em></h1><p className="subcopy">A shared space for the ordinary moments that make us, us.</p></div><div className="countdown-card"><div className="countdown-heading"><span className="countdown-icon"><Clock3 size={17}/></span><div><strong>Until our next hello</strong><small>Every second brings us closer</small></div></div><div className="countdown-numbers">{[[countdown.days,"days"],[countdown.hours,"hrs"],[countdown.mins,"min"],[countdown.secs,"sec"]].map(([n,l])=><div key={String(l)}><strong>{String(n).padStart(2,"0")}</strong><small>{l}</small></div>)}</div><label className="date-label">Our reunion date <input type="datetime-local" value={countdownDate} onChange={e=>setCountdownDate(e.target.value)}/></label></div></section>
    <section className="status-grid"><StatusCard name={USER} city="Cape Town" zone="Africa/Johannesburg" side="left"/><div className="between-heart"><span>♥</span><small>same sky, different places</small></div><StatusCard name={PARTNER} city="London" zone="Europe/London" side="right"/></section>
    <nav className="nav-tabs">{[{id:"home",label:"Our space",icon:Heart},{id:"movie",label:"Movie lounge",icon:Film},{id:"games",label:"Game room",icon:Gamepad2},{id:"vault",label:"Memory vault",icon:BookHeart},{id:"plans",label:"Someday list",icon:Plane}].map(item=><button key={item.id} onClick={()=>setActive(item.id)} className={active===item.id?"active":""}><item.icon size={16}/>{item.label}</button>)}</nav>
    <AnimatePresence mode="wait">
      {active==="home" && <motion.section key="home" className="main-grid" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}>
        <div className="panel daily-card"><div className="panel-heading"><div><p className="eyebrow">A LITTLE DAILY RITUAL</p><h2>One question, two hearts.</h2></div><span className="icon-soft"><Sparkles size={18}/></span></div><p className="question-text">“{question}”</p><textarea value={answer} onChange={e=>{setAnswer(e.target.value);setRevealed(false)}} placeholder="Write your answer here…"/><div className="panel-footer"><span><LockKeyhole size={13}/> In a real room, answers should be stored server-side and hidden until both submit.</span><button className="primary-button" onClick={()=>{if(answer.trim()){setRevealed(true);broadcast("reaction",{reaction:"answered the daily question",name:USER});}}}>Lock in answer <Send size={14}/></button></div>{revealed&&<div className="answer-reveal"><Check size={16}/> Your answer is saved in this demo: “{answer}”</div>}</div>
        <div className="panel bucket-card"><div className="panel-heading"><div><p className="eyebrow">LITTLE THINGS, BIG MEMORIES</p><h2>Our someday list</h2></div><span className="icon-soft"><Plane size={18}/></span></div><div className="progress-track"><span style={{width:`${todos.length?todos.filter(t=>t.done).length/todos.length*100:0}%`}}/></div><p className="progress-label">{todos.filter(t=>t.done).length} of {todos.length} dreams checked off</p><div className="todo-list">{todos.slice(0,4).map(t=><label key={t.id} className={`todo-item ${t.done?"done":""}`}><input type="checkbox" checked={t.done} onChange={()=>setTodos(v=>v.map(x=>x.id===t.id?{...x,done:!x.done}:x))}/><span>{t.text}</span></label>)}</div><form className="add-row" onSubmit={e=>{e.preventDefault();addTodo()}}><input value={todoText} onChange={e=>setTodoText(e.target.value)} placeholder="Add a tiny dream…"/><button aria-label="Add item"><Plus size={18}/></button></form></div>
        <div className="panel memory-card"><div className="memory-art"><span>✦</span><span>♡</span><span>✧</span></div><p className="eyebrow">FROM THE MEMORY VAULT</p><h2>Little notes for later.</h2><p>Save the words you want them to find on the days they need them most.</p><div className="add-row"><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Write a little note…"/><button onClick={()=>{if(note.trim()){setNotes(v=>[note.trim(),...v]);setNote("");}}} aria-label="Save note"><Plus size={18}/></button></div>{notes.length>0&&<div className="saved-notes">{notes.slice(0,2).map((n,i)=><p key={i}>“{n}”</p>)}</div>}</div>
        <div className="panel activity-card"><p className="eyebrow">A SOFT REMINDER</p><h2>You don’t have to do anything big.</h2><p>Stay on the call while you fold laundry. Send a pulse in the middle of class. Watch the same rain from different windows.</p><button className="text-button" onClick={sendPulse}>Send them a little love <Heart size={15}/></button><div className="activity-stats"><div><strong>∞</strong><small>little moments</small></div><div><strong>2</strong><small>people, one team</small></div><div><strong>♡</strong><small>always in progress</small></div></div></div>
      </motion.section>}
      {active==="movie" && <motion.section key="movie" className="movie-layout" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
        <div className="panel cinema-panel"><div className="panel-heading"><div><p className="eyebrow">THE TWO-SEAT CINEMA</p><h2>Movie night, together.</h2></div><span className="icon-soft"><Film size={18}/></span></div><div className="cinema-screen">{videoUrl ? (videoUrl.includes("youtube.com")||videoUrl.includes("youtu.be") ? <div className="embed-note"><Film size={28}/><strong>YouTube link added</strong><span>Paste an embed URL to display it here. For sync, use a controlled player integration.</span></div> : <video src={videoUrl} controls onPlay={()=>mediaAction(true)} onPause={()=>mediaAction(false)} onTimeUpdate={e=>setVideoTime(e.currentTarget.currentTime)} />) : <div className="screen-placeholder"><div className="screen-stars">✦　·　✧</div><Play size={34}/><strong>Our little cinema</strong><span>Bring your own video link</span></div>}<div className="video-bubble you">you</div><div className="video-bubble partner">{PARTNER}</div></div><form className="video-url-row" onSubmit={e=>{e.preventDefault();mediaAction(false,0,speed)}}><input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="Paste a direct .mp4 URL or YouTube link…"/><button className="primary-button">Load video</button></form><div className="media-controls"><button className="round-control" onClick={()=>mediaAction(!playing)}>{playing?<Pause size={17}/>:<Play size={17}/>}</button><span className="timecode">{Math.floor(videoTime/60).toString().padStart(2,"0")}:{Math.floor(videoTime%60).toString().padStart(2,"0")}</span><input aria-label="Seek video" type="range" min="0" max="3600" value={videoTime} onChange={e=>mediaAction(playing,Number(e.target.value))}/><select value={speed} onChange={e=>mediaAction(playing,videoTime,e.target.value)} aria-label="Playback speed"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select><span className="sync-status"><span/> sync event sent</span></div><p className="fine-print">This starter broadcasts playback state. For accurate syncing, connect a controlled player and periodically reconcile currentTime; YouTube needs the IFrame Player API.</p></div>
        <div className="panel reaction-panel"><p className="eyebrow">NO WORDS NEEDED</p><h2>Send a reaction</h2><p>For the plot twist. For the kiss. For the terrible acting.</p><div className="reaction-grid">{[{e:"🍿",l:"Popcorn"},{e:"💗",l:"Heart"},{e:"😱",l:"Gasp"},{e:"😂",l:"LOL"},{e:"🥹",l:"Aww"},{e:"👏",l:"Clap"}].map(r=><button key={r.l} onClick={()=>{broadcast("reaction",{reaction:r.l,name:USER});setToast(`${r.e} sent`);setTimeout(()=>setToast(""),1500)}}><span>{r.e}</span><small>{r.l}</small></button>)}</div><div className="match-box"><span className="poster">♡</span><div><p className="eyebrow">MOVIE MATCH</p><strong>Pick a film for tonight</strong><small>Tap like on the same title to match (demo).</small></div></div>{["About Time","The Princess Bride","Your Name"].map(m=><div className="movie-choice" key={m}><span>{m}</span><button className={movieLikes[m]?"liked":""} onClick={()=>{setMovieLikes(v=>({...v,[m]:!v[m]}));setToast(!movieLikes[m]?`You liked ${m}`:`Removed like for ${m}`);setTimeout(()=>setToast(""),1800)}}>{movieLikes[m]?"♥":"♡"} Like</button></div>)}</div>
      </motion.section>}
      {active==="games" && <motion.section key="games" className="games-layout" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
        <div className="panel game-panel"><div className="panel-heading"><div><p className="eyebrow">QUICK LITTLE SHOWDOWN</p><h2>Tic-tac-toe</h2></div><span className="icon-soft"><Gamepad2 size={18}/></span></div><div className="game-turn">{winner?`Winner: ${winner} 🎉`:squares.every(Boolean)?"It’s a draw!":`Your turn: ${xIsNext?"X":"O"}`}</div><div className="tic-grid">{squares.map((s,i)=><button key={i} onClick={()=>{if(s||winner)return;const next=squares.slice();next[i]=xIsNext?"X":"O";setSquares(next);setXIsNext(!xIsNext);broadcast("reaction",{reaction:"made a move in tic-tac-toe",name:USER});}} className={s?"filled":""}>{s}</button>)}</div><button className="primary-button" onClick={resetGame}>Play again</button><p className="fine-print">Game state is local in this demo. Use a database row with optimistic locking for persistent, fair multiplayer turns.</p></div>
        <div className="panel doodle-panel"><p className="eyebrow">DRAW ON THE SAME PAGE</p><h2>Shared doodle board</h2><p>Draw something for them. This canvas is local until realtime stroke syncing is wired in.</p><canvas ref={canvasRef} width={520} height={260} onMouseDown={onCanvasDown} onMouseMove={onCanvasMove} onMouseUp={onCanvasUp} onMouseLeave={onCanvasUp}/><div className="canvas-actions"><button className="text-button" onClick={()=>{const c=canvasRef.current?.getContext("2d");c?.clearRect(0,0,520,260)}}><X size={14}/> Clear canvas</button><span><Sparkles size={14}/> Made with love</span></div></div>
      </motion.section>}
      {active==="vault" && <motion.section key="vault" className="vault-layout" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}><div className="panel vault-hero"><div className="vault-illustration">✉</div><p className="eyebrow">OPEN WHEN…</p><h2>A little love, saved for later.</h2><p>Write a note for a future day. In this demo, notes stay in your browser session; real time locks must be enforced by the backend, never just the UI.</p><div className="vault-note-form"><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Open when you miss me…"/><button className="primary-button" onClick={()=>{if(note.trim()){setNotes(v=>[note.trim(),...v]);setNote("");setToast("Envelope tucked away 💌");setTimeout(()=>setToast(""),1800)}}}>Seal envelope <LockKeyhole size={14}/></button></div></div><div className="panel saved-vault"><p className="eyebrow">YOUR ENVELOPES</p><h2>Kept close</h2>{notes.length?notes.map((n,i)=><div className="envelope" key={i}><span>💌</span><div><strong>Open when you need a little love</strong><small>{n}</small></div><LockKeyhole size={16}/></div>):<div className="empty-state"><BookHeart size={28}/><p>Your first envelope is waiting to be written.</p></div>}</div></motion.section>}
      {active==="plans" && <motion.section key="plans" className="plans-layout" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}><div className="panel plans-hero"><p className="eyebrow">A FUTURE FULL OF “REMEMBER WHEN”</p><h2>Someday, we’ll be there.</h2><p>Big trips, tiny cafés, the long way home. Keep every idea in one shared place.</p><div className="bucket-large">{todos.map(t=><label className={`bucket-row ${t.done?"done":""}`} key={t.id}><input type="checkbox" checked={t.done} onChange={()=>setTodos(v=>v.map(x=>x.id===t.id?{...x,done:!x.done}:x))}/><span>{t.text}</span><small>{t.done?"Done":"Someday"}</small></label>)}</div><form className="add-row" onSubmit={e=>{e.preventDefault();addTodo()}}><input value={todoText} onChange={e=>setTodoText(e.target.value)} placeholder="Add to your bucket list…"/><button aria-label="Add dream"><Plus size={18}/></button></form></div><div className="panel itinerary"><p className="eyebrow">THE NEXT CHAPTER</p><h2>Plan a little reunion</h2><div className="itinerary-step"><span>01</span><div><strong>Pick your dates</strong><small>Find a weekend that belongs to you two.</small></div></div><div className="itinerary-step"><span>02</span><div><strong>Book the essentials</strong><small>Travel, a place to stay, and one special thing.</small></div></div><div className="itinerary-step"><span>03</span><div><strong>Leave room for magic</strong><small>Keep one day with no plans at all.</small></div></div><div className="ticket-stub"><span>ADMIT TWO</span><strong>THE NEXT HELLO</strong><small>One day closer · forever collectible</small></div></div></motion.section>}
    </AnimatePresence>
    <footer><span>made of little moments <b>♥</b></span><span>US SPACE · PRIVATE BY DESIGN</span></footer>
    <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}}><Heart size={15} fill="currentColor"/>{toast}</motion.div>}</AnimatePresence>
  </main>;
}

function calculateWinner(s: (string|null)[]) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) if (s[a] && s[a]===s[b] && s[a]===s[c]) return s[a];
  return null;
}
