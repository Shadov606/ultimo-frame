'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Copy,
  Crown,
  DoorOpen,
  Eye,
  Film,
  Gauge,
  House,
  Lightbulb,
  ListRestart,
  LockKeyhole,
  Medal,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type EntryMode = 'create' | 'join' | null;
type HomeSection = 'home' | 'explore' | 'games' | 'rankings';
type Session = { code: string; token: string };

type GameSettings = {
  yesPoints: number;
  irrelevantPoints: number;
  framePoints: number;
  solutionPoints: number;
  earlyFrameBonus: number;
  teamStart: number;
  cycleCount: number;
  categories: string[];
  difficulties: string[];
  audio: boolean;
};

type Player = {
  id: string;
  nickname: string;
  score: number;
  masterOrder: number;
  connected: boolean;
  stats: { yes: number; irrelevant: number; frames: number; solved: number; intuitionBonus: number };
};

type PublicCase = {
  title: string;
  category: string;
  difficulty: string;
  publicStory: string;
  totalFrames: number;
  foundFrames: number;
  solution?: string;
  frames?: { text: string; discovered: boolean; discoveredBy: string | null }[];
};

type MasterData = {
  solution: string;
  frames: { index: number; text: string; discovered: boolean; discoveredBy: string | null }[];
  hints: { index: number; text: string; penalty: number; used: boolean; available: boolean }[];
};

type GameState = {
  room: {
    code: string;
    mode: 'COMPETITIVE' | 'PARTY';
    status: string;
    cycleCount: number;
    roundNumber: number;
    totalRounds: number;
    teamScore: number;
    hostPlayerId: string;
    masterPlayerId: string | null;
    winnerPlayerId: string | null;
    revealedHintCount: number;
    lastEventText: string | null;
    lastEventAt: number | null;
    settings: GameSettings;
  };
  me: { id: string; nickname: string; isHost: boolean; isMaster: boolean };
  players: Player[];
  case: PublicCase | null;
  master?: MasterData;
};

type DraftSettings = GameSettings & { mode: 'COMPETITIVE' | 'PARTY' };

type WebTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown): unknown | Promise<unknown>;
};

declare global {
  interface Document {
    modelContext?: { registerTool(tool: WebTool, options?: { signal?: AbortSignal }): void | Promise<void> };
  }
}

function FilmLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'compact' : ''}`} aria-hidden="true">
      <span className="brand-half brand-half-left" />
      <span className="brand-bolt">ϟ</span>
      <span className="brand-half brand-half-right" />
    </div>
  );
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function sortPlayers(players: Player[]) {
  return [...players].sort((a, b) => b.score - a.score || a.masterOrder - b.masterOrder);
}

function tone(kind: 'good' | 'bad' | 'solve') {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = kind === 'bad' ? 180 : kind === 'solve' ? 640 : 420;
    gain.gain.setValueAtTime(.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.09, audio.currentTime + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + (kind === 'solve' ? .55 : .22));
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + (kind === 'solve' ? .6 : .25));
  } catch {
    // Audio feedback is optional and never blocks play.
  }
}

export function GameApp() {
  const [entryMode, setEntryMode] = useState<EntryMode>(null);
  const [homeSection, setHomeSection] = useState<HomeSection>('home');
  const [mode, setMode] = useState<'COMPETITIVE' | 'PARTY'>('COMPETITIVE');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localMuted, setLocalMuted] = useState(false);
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
  const [lobbySettingsOpen, setLobbySettingsOpen] = useState(false);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const guestToken = useRef<string>('');
  const stateRef = useRef<GameState | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  const notify = useCallback((text: string, kind: 'good' | 'bad' | 'solve' = 'good') => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2600);
    const current = stateRef.current;
    if (!localMuted && (current?.room.settings.audio ?? true)) tone(kind);
  }, [localMuted]);

  const loadState = useCallback(async (activeSession: Session, quiet = false) => {
    try {
      const response = await fetch(`/api/game?code=${encodeURIComponent(activeSession.code)}&token=${encodeURIComponent(activeSession.token)}`, { cache: 'no-store' });
      const payload = await response.json() as GameState & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Impossibile sincronizzare la partita.');
      if (payload.me.isMaster && payload.room.status !== 'FINISHED') {
        const masterResponse = await fetch(`/api/game?code=${encodeURIComponent(activeSession.code)}&token=${encodeURIComponent(activeSession.token)}&view=master`, { cache: 'no-store' });
        if (masterResponse.ok) {
          const masterPayload = await masterResponse.json() as GameState;
          setState(masterPayload);
        } else setState(payload);
      } else setState(payload);
      setError(null);
    } catch (caught) {
      if (!quiet) setError(caught instanceof Error ? caught.message : 'Errore di connessione.');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    guestToken.current = crypto.randomUUID();
    const saved = window.localStorage.getItem('ultimo-frame-session');
    const muted = window.localStorage.getItem('ultimo-frame-muted') === '1';
    setLocalMuted(muted);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Session;
        if (parsed.code && parsed.token) {
          setSession(parsed);
          void loadState(parsed);
          return;
        }
      } catch {
        window.localStorage.removeItem('ultimo-frame-session');
      }
    }
    setReady(true);
  }, [loadState]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => void loadState(session, true), 1700);
    return () => window.clearInterval(timer);
  }, [session, loadState]);

  const call = useCallback(async (action: string, data: Record<string, unknown> = {}, successMessage?: string) => {
    if (!session) return null;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, code: session.code, sessionToken: session.token, ...data }),
      });
      const payload = await response.json() as { error?: string; [key: string]: unknown };
      if (!response.ok) throw new Error(payload.error || 'Azione non riuscita.');
      await loadState(session);
      if (successMessage) notify(successMessage, action === 'solve' ? 'solve' : action === 'hint' || data.eventType === 'IRRELEVANT' ? 'bad' : 'good');
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Azione non riuscita.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [session, loadState, notify]);

  const enterGame = useCallback(async (kind: 'create' | 'join', values: { nickname: string; code?: string; mode?: 'COMPETITIVE' | 'PARTY' }) => {
    const name = values.nickname.trim();
    const code = values.code?.trim().toUpperCase();
    if (name.length < 2 || (kind === 'join' && code?.length !== 5)) throw new Error('Controlla nickname e codice stanza.');
    const token = guestToken.current || crypto.randomUUID();
    const response = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: kind, nickname: name, code, mode: values.mode, sessionToken: token }),
    });
    const payload = await response.json() as { code?: string; error?: string };
    if (!response.ok || !payload.code) throw new Error(payload.error || 'Accesso non riuscito.');
    const nextSession = { code: payload.code, token };
    window.localStorage.setItem('ultimo-frame-session', JSON.stringify(nextSession));
    setSession(nextSession);
    setEntryMode(null);
    await loadState(nextSession);
    return { code: payload.code };
  }, [loadState]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: 'create_ultimo_frame_room',
        title: 'Crea una stanza Ultimo Frame',
        description: 'Crea davvero una lobby del party game Ultimo Frame e apre la stanza risultante.',
        inputSchema: {
          type: 'object',
          properties: {
            nickname: { type: 'string', minLength: 2, maxLength: 22 },
            mode: { type: 'string', enum: ['COMPETITIVE', 'PARTY'] },
          },
          required: ['nickname', 'mode'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const value = input as { nickname?: string; mode?: 'COMPETITIVE' | 'PARTY' };
          if (!value.nickname || !['COMPETITIVE', 'PARTY'].includes(value.mode ?? '')) throw new Error('Nickname o modalità non validi.');
          return enterGame('create', { nickname: value.nickname, mode: value.mode });
        },
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: 'join_ultimo_frame_room',
        title: 'Entra in una stanza Ultimo Frame',
        description: 'Entra davvero in una lobby Ultimo Frame esistente usando codice e nickname.',
        inputSchema: {
          type: 'object',
          properties: {
            nickname: { type: 'string', minLength: 2, maxLength: 22 },
            code: { type: 'string', pattern: '^[A-Za-z0-9]{5}$' },
          },
          required: ['nickname', 'code'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const value = input as { nickname?: string; code?: string };
          if (!value.nickname || !value.code) throw new Error('Nickname o codice non validi.');
          return enterGame('join', { nickname: value.nickname, code: value.code });
        },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [enterGame]);

  const leaveDevice = () => {
    window.localStorage.removeItem('ultimo-frame-session');
    setSession(null);
    setState(null);
    setHomeSection('home');
    guestToken.current = crypto.randomUUID();
  };

  const submitEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!entryMode) return;
    setLoading(true);
    setError(null);
    try {
      await enterGame(entryMode, { nickname, code: roomCode, mode });
      notify(entryMode === 'create' ? 'Stanza creata' : 'Sei nella lobby');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Accesso non riuscito.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMute = () => {
    const next = !localMuted;
    setLocalMuted(next);
    window.localStorage.setItem('ultimo-frame-muted', next ? '1' : '0');
  };

  if (!ready) return <LoadingScene />;

  return (
    <main className="game-shell">
      {!state ? (
        <Home
          section={homeSection}
          setSection={setHomeSection}
          mode={mode}
          setMode={setMode}
          openEntry={(kind) => { setEntryMode(kind); setError(null); }}
          openSettings={() => setLocalSettingsOpen(true)}
        />
      ) : state.room.status === 'LOBBY' ? (
        <Lobby state={state} call={call} busy={loading} leave={leaveDevice} openSettings={() => setLobbySettingsOpen(true)} />
      ) : state.room.status === 'FINISHED' ? (
        <FinalScreen state={state} leave={leaveDevice} />
      ) : ['SOLVED', 'REVEALED'].includes(state.room.status) ? (
        <SolutionScreen state={state} call={call} busy={loading} leave={leaveDevice} />
      ) : state.room.status === 'LOST' && !state.me.isMaster ? (
        <LostScreen state={state} call={call} busy={loading} leave={leaveDevice} />
      ) : state.me.isMaster ? (
        <MasterScreen state={state} call={call} busy={loading} leave={leaveDevice} />
      ) : (
        <InvestigatorScreen state={state} leave={leaveDevice} onTheory={() => setTheoryOpen(true)} openSettings={() => setLocalSettingsOpen(true)} />
      )}

      {message && <output className="game-toast" aria-live="polite"><Sparkles />{message}</output>}
      {error && <button className="error-toast" onClick={() => setError(null)}><X />{error}</button>}

      <Dialog open={entryMode !== null} onOpenChange={(open) => !open && setEntryMode(null)}>
        <DialogContent className="mystery-dialog" showCloseButton>
          <form onSubmit={submitEntry} className="dialog-form">
            <DialogHeader>
              <div className="dialog-kicker">ULTIMO FRAME</div>
              <DialogTitle>{entryMode === 'create' ? 'CREA PARTITA' : 'ENTRA IN PARTITA'}</DialogTitle>
              <DialogDescription>
                {entryMode === 'create' ? 'Scegli il tuo nome. Regole e punteggi si rifiniscono nella lobby.' : 'Inserisci il nome e il codice ricevuto dall’Host.'}
              </DialogDescription>
            </DialogHeader>
            <label className="field-label">NICKNAME<Input autoFocus value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Es. Luca" maxLength={22} /></label>
            {entryMode === 'join' && <label className="field-label">CODICE STANZA<Input className="room-code-input" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))} placeholder="K7P4Q" maxLength={5} /></label>}
            <Button type="submit" className="primary-cta" size="lg" disabled={loading}>
              {loading ? 'ATTENDI…' : entryMode === 'create' ? 'CREA LA STANZA' : 'ENTRA'} <ArrowRight />
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={localSettingsOpen} onOpenChange={setLocalSettingsOpen}>
        <DialogContent className="mystery-dialog compact-dialog">
          <DialogHeader><div className="dialog-kicker">PREFERENZE</div><DialogTitle>SUONI</DialogTitle><DialogDescription>I feedback sono brevi e restano disattivabili su ogni dispositivo.</DialogDescription></DialogHeader>
          <button className="setting-toggle" onClick={toggleMute}>{localMuted ? <VolumeX /> : <Volume2 />}<span>{localMuted ? 'Suoni disattivati' : 'Suoni attivi'}</span><b>{localMuted ? 'OFF' : 'ON'}</b></button>
        </DialogContent>
      </Dialog>

      <Dialog open={lobbySettingsOpen} onOpenChange={setLobbySettingsOpen}>
        {state?.room.status === 'LOBBY' && <LobbySettings state={state} close={() => setLobbySettingsOpen(false)} call={call} busy={loading} />}
      </Dialog>

      <Dialog open={theoryOpen} onOpenChange={setTheoryOpen}>
        <DialogContent className="mystery-dialog theory-dialog">
          <DialogHeader><div className="dialog-kicker">HAI COLLEGATO I FRAME?</div><DialogTitle>RACCONTA LA TUA TEORIA</DialogTitle><DialogDescription>Guarda gli altri giocatori e spiega tutto a voce. Il Master deciderà se il caso è risolto.</DialogDescription></DialogHeader>
          <div className="voice-reminder"><DoorOpen /><strong>IL TELEFONO ORA PUÒ FARSI DIMENTICARE.</strong></div>
          <Button className="primary-cta" onClick={() => setTheoryOpen(false)}>HO CAPITO</Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function LoadingScene() {
  return <main className="game-shell"><div className="scene loading-scene"><FilmLogo /><span className="loading-line" /><p>SINCRONIZZAZIONE DEL CASO…</p></div></main>;
}

function SceneHeader({ title, subtitle, back, settings }: { title: string; subtitle?: string; back: () => void; settings?: () => void }) {
  return (
    <header className="screen-header">
      <button className="round-icon amber" onClick={back} aria-label="Esci"><ArrowLeft /></button>
      <div><h1>{title}</h1>{subtitle && <span>{subtitle}</span>}</div>
      {settings ? <button className="round-icon cyan" onClick={settings} aria-label="Impostazioni"><Settings /></button> : <span className="header-spacer" />}
    </header>
  );
}

function Home({ section, setSection, mode, setMode, openEntry, openSettings }: {
  section: HomeSection;
  setSection: (section: HomeSection) => void;
  mode: 'COMPETITIVE' | 'PARTY';
  setMode: (mode: 'COMPETITIVE' | 'PARTY') => void;
  openEntry: (mode: Exclude<EntryMode, null>) => void;
  openSettings: () => void;
}) {
  return (
    <>
      <div className="scene scene-home">
        <header className="topbar">
          <button className="round-icon amber" onClick={() => setSection('games')} aria-label="Le mie partite"><UserRound /></button>
          <button className="round-icon cyan" onClick={openSettings} aria-label="Impostazioni"><Settings /></button>
        </header>
        {section === 'home' ? (
          <>
            <section className="hero" aria-labelledby="game-title">
              <FilmLogo />
              <h1 id="game-title"><span>ULTIMO</span><span>FRAME</span></h1>
              <p>RICOSTRUISCI LA SCENA MANCANTE</p>
            </section>
            <section className="entry-actions" aria-label="Inizia a giocare">
              <button className="action-card action-create" onClick={() => openEntry('create')}>
                <span className="action-medallion"><Film /><Crown className="mini-symbol" /></span>
                <span className="action-copy"><strong>CREA PARTITA</strong><small>Crea una nuova partita<br />e invita i tuoi amici.</small></span>
                <ArrowRight className="action-arrow" />
              </button>
              <button className="action-card action-join" onClick={() => openEntry('join')}>
                <span className="action-medallion"><DoorOpen /></span>
                <span className="action-copy"><strong>ENTRA IN PARTITA</strong><small>Unisciti a una partita<br />con un codice.</small></span>
                <ArrowRight className="action-arrow" />
              </button>
            </section>
            <section className="mode-section" aria-labelledby="mode-title">
              <div className="section-rule"><span /><b id="mode-title">SCEGLI LA MODALITÀ</b><span /></div>
              <div className="mode-grid">
                <button className={`mode-card cyan ${mode === 'COMPETITIVE' ? 'selected' : ''}`} onClick={() => setMode('COMPETITIVE')} aria-pressed={mode === 'COMPETITIVE'}><Trophy /><span><strong>Competitiva</strong><small>Sfida, deduci, vinci.</small></span></button>
                <button className={`mode-card violet ${mode === 'PARTY' ? 'selected' : ''}`} onClick={() => setMode('PARTY')} aria-pressed={mode === 'PARTY'}><UsersRound /><span><strong>Party</strong><small>Divertiti e indovina.</small></span></button>
              </div>
            </section>
            <section className="daily-card">
              <div className="seat-photo" role="img" aria-label="Sedile 17A accanto al finestrino di un aereo" />
              <div className="daily-copy"><h2><Search /> ENIGMA DEL GIORNO</h2><p>Un uomo sale su un aereo felice. Quando vede il posto <em>17A</em>, scende subito. Perché?</p><button onClick={() => openEntry('create')}>SCOPRI IL GIOCO <ArrowRight /></button></div>
            </section>
          </>
        ) : <HomePanel section={section} openEntry={openEntry} />}
      </div>
      <nav className="bottom-nav" aria-label="Navigazione principale">
        <button className={section === 'home' ? 'active' : ''} onClick={() => setSection('home')}><House /><span>HOME</span></button>
        <button className={section === 'explore' ? 'active' : ''} onClick={() => setSection('explore')}><Compass /><span>ESPLORA</span></button>
        <button className={section === 'games' ? 'active' : ''} onClick={() => setSection('games')}><Film /><span>LE MIE PARTITE</span></button>
        <button className={section === 'rankings' ? 'active' : ''} onClick={() => setSection('rankings')}><Gauge /><span>CLASSIFICHE</span></button>
      </nav>
    </>
  );
}

function HomePanel({ section, openEntry }: { section: Exclude<HomeSection, 'home'>; openEntry: (mode: Exclude<EntryMode, null>) => void }) {
  const content = {
    explore: { icon: <Compass />, title: 'COME SI GIOCA', text: 'Un Master conosce la verità. Gli altri ricostruiscono il caso facendo domande soltanto a voce.' },
    games: { icon: <Film />, title: 'LE MIE PARTITE', text: 'Le stanze attive si riaprono automaticamente su questo dispositivo, anche dopo un refresh.' },
    rankings: { icon: <Trophy />, title: 'CLASSIFICHE', text: 'La classifica vive dentro ogni stanza e conserva i punti per tutti i cicli della partita.' },
  }[section];
  return (
    <section className="home-panel">
      <FilmLogo compact />
      <div className="panel-title">{content.icon}<h1>{content.title}</h1></div>
      <p>{content.text}</p>
      {section === 'explore' && <div className="rule-stack"><article><b>1</b><span><strong>FAI DOMANDE</strong>Il Master risponde Sì, No o Irrilevante.</span></article><article><b>2</b><span><strong>TROVA I FRAME</strong>Scopri i dettagli decisivi senza vederli sul telefono.</span></article><article><b>3</b><span><strong>RISOLVI IL CASO</strong>Racconta la teoria completa prima degli altri.</span></article></div>}
      {section === 'games' && <button className="empty-action" onClick={() => openEntry('join')}><DoorOpen /><span><strong>ENTRA CON UN CODICE</strong><small>Riprendi il gioco con i tuoi amici.</small></span><ChevronRight /></button>}
      {section === 'rankings' && <div className="sample-ranking"><span><Medal /> La classifica apparirà quando entri in una stanza.</span></div>}
    </section>
  );
}

function Lobby({ state, call, busy, leave, openSettings }: { state: GameState; call: (action: string, data?: Record<string, unknown>, message?: string) => Promise<Record<string, unknown> | null>; busy: boolean; leave: () => void; openSettings: () => void }) {
  const copyCode = async () => {
    await navigator.clipboard.writeText(state.room.code);
  };
  return (
    <div className="scene lobby-scene">
      <SceneHeader title="Lobby" back={leave} settings={state.me.isHost ? openSettings : undefined} />
      <section className="room-code-card"><span>CODICE STANZA</span><strong>{state.room.code}</strong><button onClick={copyCode}><Copy /> COPIA CODICE</button></section>
      <section className="cinema-card violet-card player-card">
        <h2><UsersRound /> GIOCATORI ({state.players.length}/6)</h2>
        <div className="lobby-players">
          {state.players.map((player) => <div className="lobby-player" key={player.id}><span className={`avatar ${player.id === state.room.hostPlayerId ? 'host' : ''}`}>{initials(player.nickname)}</span><strong>{player.nickname}</strong>{player.id === state.room.hostPlayerId && <b><Crown /> HOST</b>}<small><i /> Connesso</small></div>)}
        </div>
      </section>
      <section className="cinema-card cyan-card lobby-summary">
        <h2><Settings /> IMPOSTAZIONI PARTITA</h2>
        <div><span><Trophy /><small>MODALITÀ</small><strong>{state.room.mode === 'PARTY' ? 'Party' : 'Competitiva'}</strong></span><span><Film /><small>CATEGORIE</small><strong>{state.room.settings.categories.join(', ')}</strong></span><span><Gauge /><small>DIFFICOLTÀ</small><strong>{state.room.settings.difficulties.join(', ')}</strong></span><span><ListRestart /><small>CICLI</small><strong>{state.room.cycleCount}</strong></span></div>
      </section>
      <section className="cinema-card violet-card master-order"><h2><ListRestart /> ORDINE MASTER</h2><div>{state.players.map((player, index) => <span key={player.id}><b>{index + 1}</b><i className="avatar">{initials(player.nickname)}</i><small>{player.nickname}</small>{index < state.players.length - 1 && <ArrowRight />}</span>)}</div></section>
      {state.me.isHost ? <Button className="start-game-button" disabled={busy || state.players.length < 2} onClick={() => void call('start', {}, 'Il caso ha inizio')}><Film /> {state.players.length < 2 ? 'ATTENDI UN GIOCATORE' : 'INIZIA PARTITA'} <ArrowRight /></Button> : <div className="waiting-host"><span className="pulse-dot" /> IN ATTESA DELL’HOST</div>}
    </div>
  );
}

function LobbySettings({ state, close, call, busy }: { state: GameState; close: () => void; call: (action: string, data?: Record<string, unknown>, message?: string) => Promise<Record<string, unknown> | null>; busy: boolean }) {
  const [draft, setDraft] = useState<DraftSettings>({ ...state.room.settings, mode: state.room.mode });
  const number = (key: keyof GameSettings, value: string) => setDraft((current) => ({ ...current, [key]: Number(value) }));
  const save = async () => { const result = await call('settings', draft, 'Impostazioni salvate'); if (result) close(); };
  return (
    <DialogContent className="mystery-dialog settings-dialog">
      <DialogHeader><div className="dialog-kicker">PANNELLO HOST</div><DialogTitle>IMPOSTAZIONI</DialogTitle><DialogDescription>Il server userà questi valori per ogni azione di gioco.</DialogDescription></DialogHeader>
      <div className="settings-scroll">
        <label className="field-label">MODALITÀ<select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as DraftSettings['mode'] })}><option value="COMPETITIVE">Competitiva</option><option value="PARTY">Party</option></select></label>
        <div className="settings-numbers">
          <label>RISPOSTA SÌ<Input type="number" value={draft.yesPoints} onChange={(e) => number('yesPoints', e.target.value)} /></label>
          <label>IRRILEVANTE<Input type="number" value={draft.irrelevantPoints} onChange={(e) => number('irrelevantPoints', e.target.value)} /></label>
          <label>FRAME<Input type="number" value={draft.framePoints} onChange={(e) => number('framePoints', e.target.value)} /></label>
          <label>SOLUZIONE<Input type="number" value={draft.solutionPoints} onChange={(e) => number('solutionPoints', e.target.value)} /></label>
          <label>BONUS / FRAME<Input type="number" value={draft.earlyFrameBonus} onChange={(e) => number('earlyFrameBonus', e.target.value)} /></label>
          <label>PUNTI PARTY<Input type="number" value={draft.teamStart} onChange={(e) => number('teamStart', e.target.value)} /></label>
        </div>
        <label className="field-label">CICLI<select value={draft.cycleCount} onChange={(e) => number('cycleCount', e.target.value)}><option value={1}>1 ciclo</option><option value={2}>2 cicli</option></select></label>
        <label className="field-label">CATEGORIA<select value={draft.categories[0]} onChange={(e) => setDraft({ ...draft, categories: [e.target.value] })}><option value="MIX">Mix</option><option value="CRIME">Crime</option><option value="RELATIONSHIP">Relationship</option><option value="DARK">Dark</option><option value="ONLINE">Online</option><option value="ASSURDO">Assurdo</option></select></label>
        <label className="field-label">DIFFICOLTÀ<select value={draft.difficulties[0]} onChange={(e) => setDraft({ ...draft, difficulties: [e.target.value] })}><option value="MIX">Mix</option><option value="FACILE">Facile</option><option value="MEDIO">Medio</option><option value="DIFFICILE">Difficile</option><option value="ESTREMO">Estremo</option></select></label>
        <button className="setting-toggle" onClick={() => setDraft({ ...draft, audio: !draft.audio })}>{draft.audio ? <Volume2 /> : <VolumeX />}<span>Suoni della stanza</span><b>{draft.audio ? 'ON' : 'OFF'}</b></button>
      </div>
      <Button className="primary-cta" disabled={busy} onClick={() => void save()}>SALVA IMPOSTAZIONI</Button>
    </DialogContent>
  );
}

function InvestigatorScreen({ state, leave, onTheory, openSettings }: { state: GameState; leave: () => void; onTheory: () => void; openSettings: () => void }) {
  const mystery = state.case!;
  const master = state.players.find((player) => player.id === state.room.masterPlayerId);
  const ranking = sortPlayers(state.players.filter((player) => player.id !== state.room.masterPlayerId));
  return (
    <div className="scene game-scene">
      <SceneHeader title="ULTIMO FRAME" subtitle={state.room.mode === 'PARTY' ? 'PARTY' : 'COMPETITIVA'} back={leave} settings={openSettings} />
      {!master?.connected && <div className="offline-banner"><LockKeyhole /> MASTER DISCONNESSO · PARTITA IN PAUSA</div>}
      <section className="case-hero-card"><div><h1>{mystery.title}</h1><p>{mystery.publicStory}</p><span><Crown /> Master: <b>{master?.nickname}</b></span></div><div className="case-seat-photo" /></section>
      <FrameProgress found={mystery.foundFrames} total={mystery.totalFrames} />
      {state.room.mode === 'PARTY' ? <TeamScore score={state.room.teamScore} total={state.room.settings.teamStart} /> : <Leaderboard players={ranking} master={master} />}
      <section className="cinema-card cyan-card event-card"><h2>ULTIMO EVENTO</h2><p>{state.room.lastEventText || 'Il caso è appena iniziato.'}</p></section>
      <button className="i-know-button" onClick={onTheory}><DoorOpen /><span><strong>HO CAPITO</strong><small>PROPONI LA TUA SOLUZIONE</small></span></button>
      <p className="room-footnote">STANZA {state.room.code} · ROUND {state.room.roundNumber + 1}/{state.room.totalRounds}</p>
    </div>
  );
}

function FrameProgress({ found, total }: { found: number; total: number }) {
  return <section className="frame-progress"><div><span>FRAME TROVATI</span><strong>{found}/{total}</strong></div><div className="film-boxes">{Array.from({ length: total }, (_, index) => <Film key={index} className={index < found ? 'found' : ''} />)}</div></section>;
}

function Leaderboard({ players, master }: { players: Player[]; master?: Player }) {
  return <section className="cinema-card violet-card leaderboard"><h2><Trophy /> CLASSIFICA LIVE</h2>{players.map((player, index) => <div key={player.id}><b>{index + 1}</b><span className="avatar">{initials(player.nickname)}</span><strong>{player.nickname}</strong><em>{player.score}</em></div>)}{master && <div className="master-row"><b>—</b><span className="avatar"><Crown /></span><strong>{master.nickname} <small>(Master)</small></strong><em>—</em></div>}</section>;
}

function TeamScore({ score, total }: { score: number; total: number }) {
  const percent = Math.max(0, Math.min(100, score / total * 100));
  const label = percent > 75 ? 'INVESTIGATORI PERFETTI' : percent > 40 ? 'CASO ANCORA APERTO' : percent > 15 ? 'PER UN PELO' : 'MIRACOLO';
  return <section className={`team-score ${percent < 25 ? 'danger' : ''}`}><span>PUNTEGGIO SQUADRA</span><strong>{score}<small>/{total}</small></strong><div><i style={{ width: `${percent}%` }} /></div><b>{label}</b></section>;
}

function MasterScreen({ state, call, busy, leave }: { state: GameState; call: (action: string, data?: Record<string, unknown>, message?: string) => Promise<Record<string, unknown> | null>; busy: boolean; leave: () => void }) {
  const mystery = state.case!;
  const master = state.master!;
  const investigators = state.players.filter((player) => player.id !== state.room.masterPlayerId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [framePlayer, setFramePlayer] = useState<Player | null>(null);
  const [solvePlayer, setSolvePlayer] = useState<Player | null>(null);
  const [hintConfirm, setHintConfirm] = useState(false);
  const nextHint = master.hints.find((hint) => hint.available);
  const event = (playerId: string, eventType: 'YES' | 'IRRELEVANT') => call('player_event', { playerId, eventType, idempotencyKey: crypto.randomUUID() }, eventType === 'YES' ? 'Risposta SÌ registrata' : 'Domanda irrilevante');
  const solve = async () => { if (!solvePlayer) return; const result = await call('solve', { playerId: solvePlayer.id, idempotencyKey: crypto.randomUUID() }, `${solvePlayer.nickname} ha risolto il caso`); if (result) setSolvePlayer(null); };
  const hint = async () => { const result = await call('hint', { idempotencyKey: crypto.randomUUID() }, 'Indizio utilizzato'); if (result) setHintConfirm(false); };
  return (
    <div className="scene master-scene">
      <SceneHeader title={mystery.title} subtitle="PANNELLO MASTER" back={leave} />
      <section className="cinema-card public-story"><h2><Film /> STORIA PUBBLICA</h2><p>{mystery.publicStory}</p><div className="case-seat-photo small" /></section>
      <section className="cinema-card amber-card private-solution"><h2><Lightbulb /> SOLUZIONE · PRIVATA</h2><p>{master.solution}</p><span><ShieldCheck /> Visibile solo su questo dispositivo Master</span></section>
      {state.room.status === 'LOST' ? <PartyLostMaster state={state} call={call} busy={busy} /> : state.room.status === 'ACTIVE_FUN' ? <section className="lost-master-card"><h2>CONTINUA PER DIVERTIMENTO</h2><p>Il punteggio resta a 0 e il caso non può più essere vinto.</p><Button onClick={() => void call('show_solution', {}, 'Soluzione rivelata')}>MOSTRA SOLUZIONE</Button></section> : (
        <section className="cinema-card cyan-card hint-card"><div><Search /><span><small>INDIZIO {state.room.revealedHintCount + 1}</small><p>{nextHint?.text ?? 'Tutti gli indizi sono stati utilizzati.'}</p></span></div>{nextHint && <button onClick={() => setHintConfirm(true)}>USA INDIZIO <b>-{nextHint.penalty}</b></button>}</section>
      )}
      <section className="cinema-card violet-card master-frames"><h2><Film /> FRAME MANCANTI</h2>{master.frames.map((frame) => <div key={frame.index} className={frame.discovered ? 'discovered' : ''}><span>{frame.discovered ? <Check /> : <Film />}</span><p><strong>FRAME {frame.index + 1}</strong>{frame.text}</p>{frame.discovered && <b>SCOPERTO</b>}</div>)}</section>
      <section className="master-players"><div className="master-list-title"><span>GIOCATORI</span><span>PUNTEGGIO</span></div>{investigators.map((player) => <article className={expanded === player.id ? 'expanded' : ''} key={player.id}><button className="player-head" onClick={() => setExpanded(expanded === player.id ? null : player.id)}><span className="avatar">{initials(player.nickname)}</span><strong>{player.nickname}</strong><em>{state.room.mode === 'PARTY' ? 'TEAM' : player.score}</em>{expanded === player.id ? <ChevronDown /> : <ChevronRight />}</button>{expanded === player.id && <div className="quick-actions">{state.room.mode === 'COMPETITIVE' && <button disabled={busy} className="yes" onClick={() => void event(player.id, 'YES')}><strong>+{state.room.settings.yesPoints}</strong><span>SÌ</span></button>}<button disabled={busy} className="irrelevant" onClick={() => void event(player.id, 'IRRELEVANT')}><strong>{state.room.settings.irrelevantPoints}</strong><span>IRRILEVANTE</span></button><button disabled={busy} className="frame" onClick={() => setFramePlayer(player)}><strong>{state.room.mode === 'COMPETITIVE' ? `+${state.room.settings.framePoints}` : <Film />}</strong><span>FRAME</span></button><button disabled={busy || state.room.status !== 'ACTIVE'} className="solved" onClick={() => setSolvePlayer(player)}><Check /><span>STORIA<br />INDOVINATA</span></button></div>}</article>)}</section>
      <button className="undo-button" disabled={busy} onClick={() => void call('undo', {}, 'Ultima azione annullata')}><RotateCcw /> ANNULLA ULTIMA AZIONE</button>

      <Dialog open={Boolean(framePlayer)} onOpenChange={(open) => !open && setFramePlayer(null)}><DialogContent className="mystery-dialog frame-dialog"><DialogHeader><div className="dialog-kicker">ASSEGNA A {framePlayer?.nickname.toUpperCase()}</div><DialogTitle>QUALE FRAME?</DialogTitle><DialogDescription>Un Frame può essere assegnato una sola volta.</DialogDescription></DialogHeader><div className="frame-choice-list">{master.frames.filter((frame) => !frame.discovered).map((frame) => <button key={frame.index} onClick={async () => { const result = await call('frame', { playerId: framePlayer?.id, frameIndex: frame.index, idempotencyKey: crypto.randomUUID() }, 'Frame scoperto'); if (result) setFramePlayer(null); }}><Film /><span><small>FRAME {frame.index + 1}</small>{frame.text}</span><ChevronRight /></button>)}</div></DialogContent></Dialog>
      <Dialog open={Boolean(solvePlayer)} onOpenChange={(open) => !open && setSolvePlayer(null)}><DialogContent className="mystery-dialog confirm-dialog"><DialogHeader><div className="dialog-kicker">AZIONE DEFINITIVA</div><DialogTitle>CASO RISOLTO?</DialogTitle><DialogDescription>Confermi che {solvePlayer?.nickname} ha ricostruito correttamente tutta la storia?</DialogDescription></DialogHeader><div className="confirm-actions"><Button variant="outline" onClick={() => setSolvePlayer(null)}>ANNULLA</Button><Button className="primary-cta" disabled={busy} onClick={() => void solve()}>CONFERMA SOLUZIONE</Button></div></DialogContent></Dialog>
      <Dialog open={hintConfirm} onOpenChange={setHintConfirm}><DialogContent className="mystery-dialog confirm-dialog"><DialogHeader><div className="dialog-kicker">INDIZIO {state.room.revealedHintCount + 1}</div><DialogTitle>USARE L’INDIZIO?</DialogTitle><DialogDescription>{state.room.mode === 'PARTY' ? `La squadra perderà ${nextHint?.penalty} punti.` : `Ogni investigatore perderà ${nextHint?.penalty} punti. Il Master non viene penalizzato.`}</DialogDescription></DialogHeader><div className="confirm-actions"><Button variant="outline" onClick={() => setHintConfirm(false)}>ANNULLA</Button><Button className="danger-cta" disabled={busy} onClick={() => void hint()}>USA · -{nextHint?.penalty}</Button></div></DialogContent></Dialog>
    </div>
  );
}

function PartyLostMaster({ state, call, busy }: { state: GameState; call: (action: string, data?: Record<string, unknown>, message?: string) => Promise<Record<string, unknown> | null>; busy: boolean }) {
  return <section className="lost-master-card"><CircleHelp /><h2>CASO IRRISOLTO</h2><p>La squadra ha raggiunto 0. Puoi rivelare la verità o continuare senza possibilità di vittoria.</p><div><Button disabled={busy} onClick={() => void call('show_solution', {}, 'Soluzione rivelata')}>MOSTRA SOLUZIONE</Button><Button variant="outline" disabled={busy} onClick={() => void call('continue_fun', {}, 'Il caso continua')}>CONTINUA PER DIVERTIMENTO</Button></div></section>;
}

function LostScreen({ state, call, busy, leave }: { state: GameState; call: (action: string, data?: Record<string, unknown>, message?: string) => Promise<Record<string, unknown> | null>; busy: boolean; leave: () => void }) {
  return <div className="scene terminal-scene"><SceneHeader title="CASO IRRISOLTO" subtitle="LA SQUADRA HA PERSO" back={leave} /><div className="failure-symbol"><X /></div><h2>0/{state.room.settings.teamStart}</h2><p>Le deduzioni potranno continuare solo per divertimento. Nessuna vittoria verrà più registrata.</p>{state.me.isHost ? <div className="terminal-actions"><Button className="primary-cta" disabled={busy} onClick={() => void call('show_solution', {}, 'Soluzione rivelata')}>MOSTRA SOLUZIONE</Button><Button variant="outline" disabled={busy} onClick={() => void call('continue_fun', {}, 'Il caso continua')}>CONTINUA PER DIVERTIMENTO</Button></div> : <div className="waiting-host"><span className="pulse-dot" /> IL MASTER STA DECIDENDO</div>}</div>;
}

function SolutionScreen({ state, call, busy, leave }: { state: GameState; call: (action: string, data?: Record<string, unknown>, message?: string) => Promise<Record<string, unknown> | null>; busy: boolean; leave: () => void }) {
  const mystery = state.case!;
  const winner = state.players.find((player) => player.id === state.room.winnerPlayerId);
  const missing = mystery.frames?.filter((frame) => !frame.discovered).length ?? 0;
  const base = state.room.mode === 'COMPETITIVE' && winner ? state.room.settings.solutionPoints : 0;
  const bonus = state.room.mode === 'COMPETITIVE' && winner ? missing * state.room.settings.earlyFrameBonus : 0;
  const ranking = sortPlayers(state.players);
  return <div className="scene solution-scene"><SceneHeader title={winner ? 'CASO RISOLTO' : 'LA VERITÀ'} subtitle="LA VERITÀ È VENUTA ALLA LUCE" back={leave} /><section className="cinema-card violet-card truth-card"><h2><Search /> COSA È SUCCESSO DAVVERO?</h2><p>{mystery.solution}</p><div className="case-seat-photo solution-photo" /></section><section className="cinema-card violet-card solution-frames"><h2><Film /> I FRAME</h2>{mystery.frames?.map((frame, index) => <div key={index}><span className={frame.discovered ? 'yes' : 'no'}>{frame.discovered ? <Check /> : <X />}</span><b>{index + 1}</b><p>{frame.text}</p><small>{frame.discovered ? `Scoperto da ${frame.discoveredBy}` : 'Non scoperto'}</small></div>)}</section>{winner && state.room.mode === 'COMPETITIVE' && <section className="winner-card"><Trophy /><div><h2>VINCITORE DEL CASO: {winner.nickname}</h2><p>Soluzione corretta <b>+{base}</b></p><p>{missing} Frame mancanti <b>+{bonus}</b></p><strong>TOTALE <em>+{base + bonus}</em></strong></div></section>}{state.room.mode === 'PARTY' && winner && <TeamScore score={state.room.teamScore} total={state.room.settings.teamStart} />}<section className="cinema-card amber-card final-ranking"><h2><Gauge /> CLASSIFICA AGGIORNATA</h2>{ranking.map((player, index) => <div key={player.id}><b>{index + 1}</b><span className="avatar">{initials(player.nickname)}</span><strong>{player.nickname}</strong><em>{player.score}</em></div>)}</section>{state.me.isHost ? <Button className="next-case-button" disabled={busy} onClick={() => void call('next', {}, 'Prossimo caso')}><Film /> PROSSIMO CASO <ArrowRight /></Button> : <div className="waiting-host"><span className="pulse-dot" /> IN ATTESA DEL PROSSIMO CASO</div>}</div>;
}

function FinalScreen({ state, leave }: { state: GameState; leave: () => void }) {
  const ranking = sortPlayers(state.players);
  return <div className="scene final-scene"><SceneHeader title="FINE PARTITA" subtitle={`${state.room.cycleCount} ${state.room.cycleCount === 1 ? 'CICLO COMPLETATO' : 'CICLI COMPLETATI'}`} back={leave} /><div className="final-trophy"><Trophy /></div><h2>{state.room.mode === 'PARTY' ? 'SQUADRA INVESTIGATIVA' : 'CLASSIFICA FINALE'}</h2><section className="podium-list">{ranking.map((player, index) => <article key={player.id} className={index === 0 ? 'champion' : ''}><b>{index + 1}</b><span className="avatar">{initials(player.nickname)}</span><div><strong>{player.nickname}</strong><small>{player.stats.frames} Frame · {player.stats.solved} casi risolti · {player.stats.yes} Sì</small></div><em>{player.score}<small>PUNTI</small></em></article>)}</section><Button className="primary-cta" onClick={leave}><House /> TORNA ALLA HOME</Button></div>;
}
