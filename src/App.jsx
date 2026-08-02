import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleNotch,
  Cpu,
  DownloadSimple,
  SignOut,
  Sparkle,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import {
  apiRequest,
  authClient,
  getSessionWithToken,
  isAuthConfigured,
} from "./auth.js";

const OUTCOMES = [
  {
    id: "fast",
    label: "Fast image",
    studioLabel: "Fast image",
    description: "Quick ideas and visual exploration",
    price: 0.08,
    eta: "~8 sec",
    signal: "IMG / 4:3",
  },
  {
    id: "cinematic",
    label: "Cinematic video",
    studioLabel: "Cinematic motion",
    description: "Movement, atmosphere and story",
    price: 0.42,
    eta: "~45 sec",
    signal: "VID / 16:9",
  },
  {
    id: "quality",
    label: "Highest quality",
    studioLabel: "Highest quality",
    description: "Maximum detail and fidelity",
    price: 0.76,
    eta: "~70 sec",
    signal: "IMG / 4:3",
  },
];

function outcomeById(id) {
  return OUTCOMES.find((candidate) => candidate.id === id) ?? OUTCOMES[0];
}

function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}

function formatCents(cents = 0) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRunTime(value) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function BrandMark({ dark = false }) {
  return (
    <span className={`brand-seal ${dark ? "brand-seal-dark" : ""}`} aria-hidden="true">
      L<Sparkle size={11} weight="fill" />
    </span>
  );
}

function AuthPanel({ session, account, onAuthenticated, onSignOut }) {
  const [mode, setMode] = useState("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!authClient) {
      setError("Neon Auth is not configured for this environment.");
      return;
    }

    setBusy(true);
    try {
      const response = mode === "sign-up"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });

      if (response?.error) throw new Error(response.error.message ?? "Authentication failed.");
      await onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  if (session?.user) {
    return (
      <div className="panel-content sign-in-content account-content">
        <UserCircle size={36} weight="light" />
        <p className="panel-kicker">Private wallet connected</p>
        <h2>{session.user.name || "Lmiere member"}</h2>
        <p>{session.user.email}</p>
        <div className="account-balance">
          <span>Available credits</span>
          <strong>{formatCents(account?.availableCents)}</strong>
          <small>{formatCents(account?.reservedCents)} reserved in active runs</small>
        </div>
        <button className="panel-action" type="button" onClick={onSignOut}>
          Sign out <SignOut size={17} />
        </button>
        <small>Every account has its own wallet, archive, and generation history.</small>
      </div>
    );
  }

  return (
    <div className="panel-content sign-in-content">
      <UserCircle size={36} weight="light" />
      <p className="panel-kicker">Private test access</p>
      <h2>{mode === "sign-up" ? "Create your field identity." : "Return to your archive."}</h2>
      <p>Ryan and Hossam can test independently. Credits and runs never cross accounts.</p>

      <form className="auth-form" onSubmit={submit}>
        {mode === "sign-up" && (
          <label>
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </label>
        )}
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="panel-action" type="submit" disabled={busy || !isAuthConfigured}>
          {busy ? <><CircleNotch className="spin" size={17} /> Connecting</> : (
            <>{mode === "sign-up" ? "Create account" : "Sign in"} <ArrowRight size={17} /></>
          )}
        </button>
      </form>

      <button
        className="auth-mode-button"
        type="button"
        onClick={() => {
          setMode((value) => value === "sign-in" ? "sign-up" : "sign-in");
          setError("");
        }}
      >
        {mode === "sign-in" ? "First visit? Create an account" : "Already registered? Sign in"}
      </button>
      <small>Authentication and account isolation are managed by Lmiere’s Neon database.</small>
    </div>
  );
}

function ResultMedia({ generation }) {
  if (!generation?.resultUrl) return null;
  if (generation.resultContentType?.startsWith("video/")) {
    return <video src={generation.resultUrl} controls playsInline autoPlay loop />;
  }
  return <img src={generation.resultUrl} alt={generation.prompt || "Generated Lmiere result"} />;
}

function SidePanel({
  panel,
  onClose,
  onOpenStudio,
  onOpenPanel,
  session,
  account,
  runs,
  result,
  onAuthenticated,
  onSignOut,
}) {
  if (!panel) return null;

  return (
    <div className="panel-scrim" role="presentation" onMouseDown={onClose}>
      <aside
        className="side-panel"
        aria-label={`${panel} panel`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <span>{panel}</span>
          <button className="panel-close" type="button" onClick={onClose} aria-label="Close panel">
            <X size={18} weight="light" />
          </button>
        </div>

        {panel === "Archive" && (
          <div className="panel-content">
            <p className="panel-kicker">Recovered generations / {String(runs.length).padStart(2, "0")}</p>
            {!session && <p className="archive-empty">Sign in to recover your private generation history.</p>}
            {session && runs.length === 0 && <p className="archive-empty">No runs yet. The archive is waiting.</p>}
            <div className="archive-list">
              {runs.map((run, index) => {
                const outcome = outcomeById(run.outcome);
                return (
                  <button
                    className="archive-row"
                    type="button"
                    key={run.id}
                    disabled={!run.resultUrl}
                    onClick={() => run.resultUrl && onOpenPanel("Result", run)}
                  >
                    <span className="archive-index">{String(index + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>{run.prompt}</strong>
                      <small>{formatRunTime(run.createdAt)} · {outcome.label} · {run.status}</small>
                    </span>
                    <span>{formatCents(run.chargeCents)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {panel === "How it works" && (
          <div className="panel-content method-panel">
            <p className="panel-kicker">Three decisions. Nothing else.</p>
            <ol>
              <li><span>01</span><strong>Describe it</strong><p>Write what you want in ordinary language.</p></li>
              <li><span>02</span><strong>Choose the outcome</strong><p>Pick speed, motion, or maximum quality.</p></li>
              <li><span>03</span><strong>Approve the price</strong><p>See the exact cost before anything runs.</p></li>
            </ol>
            <button className="panel-action" type="button" onClick={onOpenStudio}>
              Enter the studio <ArrowRight size={17} />
            </button>
          </div>
        )}

        {panel === "Sign in" && (
          <AuthPanel
            session={session}
            account={account}
            onAuthenticated={onAuthenticated}
            onSignOut={onSignOut}
          />
        )}

        {panel === "Result" && result && (
          <div className="panel-content result-panel">
            <p className="panel-kicker">Run {result.id} / {result.status}</p>
            <ResultMedia generation={result} />
            <div className="result-panel-meta">
              <span>{outcomeById(result.outcome).signal}</span>
              <span>{outcomeById(result.outcome).label}</span>
              <span>{formatCents(result.chargeCents)}</span>
            </div>
            <a className="panel-action" href={result.resultUrl} download target="_blank" rel="noreferrer">
              Save result <DownloadSimple size={17} />
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}

function LandingScreen({ onEnterStudio, onOpenPanel, session }) {
  return (
    <main className="landing-screen">
      <header className="landing-header">
        <button className="landing-brand" type="button" aria-label="Lmiere home">
          <BrandMark />
          <span>Lmiere<br />Field manual</span>
        </button>

        <div className="landing-meta" aria-label="Edition details">
          <span>Issue 001<br />Pay-per-generation</span>
          <span>No. LM-001-FG<br />Private release</span>
        </div>

        <nav className="landing-nav" aria-label="Landing navigation">
          <button type="button" onClick={() => onOpenPanel("Archive")}>Archive</button>
          <button type="button" onClick={() => onOpenPanel("Sign in")}>
            {session?.user?.name || "Sign in"}
          </button>
          <button className="landing-nav-cta" type="button" onClick={onEnterStudio}>Open studio</button>
        </nav>
      </header>

      <div className="landing-rule" aria-hidden="true" />

      <section className="landing-hero">
        <img
          className="landing-machine"
          src="/assets/lmiere-field-machine.png"
          alt="A meteorite fused with a precision camera mechanism, drawn like a scientific blueprint"
        />

        <div className="landing-copy">
          <p className="landing-kicker">// Field apparatus 001</p>
          <h1>Lmiere</h1>
          <p className="landing-thesis">A machine for making images and motion that have <em>not yet</em> happened.</p>
          <p className="landing-summary">Describe the unseen. Choose the outcome. Know the exact price before the machine begins.</p>

          <div className="landing-actions">
            <button className="primary-paper-button" type="button" onClick={onEnterStudio}>
              Enter the machine <ArrowRight size={21} weight="light" />
            </button>
            <button className="text-paper-button" type="button" onClick={() => onOpenPanel("How it works")}>
              How it works <ArrowRight className="north-east-arrow" size={14} />
            </button>
          </div>
        </div>

        <div className="landing-annotation landing-annotation-a" aria-hidden="true">
          <span>A.</span><p>Latent image chamber</p>
        </div>
        <div className="landing-annotation landing-annotation-b" aria-hidden="true">
          <span>B.</span><p>Interpretation lens</p>
        </div>
      </section>

      <footer className="landing-footer" id="landing-method">
        <div><span>01</span><strong>Describe the unseen</strong><small>Use ordinary language</small></div>
        <div><span>02</span><strong>Choose an outcome</strong><small>Image, motion, or detail</small></div>
        <div><span>03</span><strong>Approve the exact cost</strong><small>No subscription required</small></div>
        <p>Recovered 2026<br />Lmiere Labs</p>
      </footer>

      <p className="landing-edge-note">Public field test // Europe · Morocco · United States</p>
    </main>
  );
}

function StudioScreen({
  onReturn,
  onOpenPanel,
  session,
  account,
  runs,
  onAccountChanged,
}) {
  const [selectedId, setSelectedId] = useState("cinematic");
  const [prompt, setPrompt] = useState("A memory of rain inside a glass house");
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [generation, setGeneration] = useState(null);
  const [error, setError] = useState("");

  const outcome = useMemo(() => outcomeById(selectedId), [selectedId]);
  const isRunning = phase === "submitting" || phase === "generating";

  useEffect(() => {
    if (!isRunning) return undefined;
    const interval = window.setInterval(() => {
      setProgress((value) => Math.min(value + (value < 60 ? 2 : 1), 94));
    }, 900);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (phase !== "generating" || !generation?.id) return undefined;

    let cancelled = false;
    let timer;

    async function poll() {
      try {
        const data = await apiRequest(`/api/generations/${generation.id}`);
        if (cancelled) return;
        const next = data.generation;
        setGeneration(next);
        setProgress((value) => Math.max(value, next.progress ?? 0));

        if (next.status === "complete") {
          setProgress(100);
          setPhase("complete");
          await onAccountChanged();
          return;
        }
        if (["failed", "cancelled"].includes(next.status)) {
          setPhase("failed");
          setError(next.error || "The run did not complete. No credits were charged.");
          await onAccountChanged();
          return;
        }
        timer = window.setTimeout(poll, 2200);
      } catch (pollError) {
        if (cancelled) return;
        setError(pollError instanceof Error ? pollError.message : "Could not read the run status.");
        timer = window.setTimeout(poll, 4000);
      }
    }

    timer = window.setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [generation?.id, onAccountChanged, phase]);

  async function beginRun() {
    if (!prompt.trim()) {
      setError("Describe what the network should create.");
      return;
    }
    if (!session?.user) {
      setError("Sign in to connect a private wallet before beginning a run.");
      onOpenPanel("Sign in");
      return;
    }

    setError("");
    setGeneration(null);
    setProgress(2);
    setPhase("submitting");

    try {
      const data = await apiRequest("/api/generations", {
        method: "POST",
        body: JSON.stringify({ prompt: prompt.trim(), outcome: selectedId }),
      });
      setGeneration(data.generation);
      setProgress(data.generation?.progress ?? 5);
      setPhase("generating");
      await onAccountChanged();
    } catch (runError) {
      setPhase("failed");
      setProgress(0);
      setError(runError instanceof Error ? runError.message : "The run could not begin.");
      await onAccountChanged();
    }
  }

  function newRun() {
    setPhase("idle");
    setGeneration(null);
    setProgress(0);
    setError("");
  }

  const result = phase === "complete" ? generation : null;

  return (
    <main className="studio-screen">
      <header className="studio-header">
        <button className="studio-brand" type="button" onClick={onReturn} aria-label="Return to the field manual">
          <span>Lmiere<Sparkle size={10} weight="fill" /></span>
          <small>Distributed image machine</small>
        </button>

        <div className="studio-system-meta">
          <div><span>Network status</span><strong>Nominal / 03 routes</strong></div>
          <div><span>Queue</span><strong>{isRunning ? "Active / Working" : "00:00 / Ready"}</strong></div>
          <div><span>Region</span><strong>EU-Central / Private</strong></div>
        </div>

        <nav className="studio-nav" aria-label="Studio navigation">
          <button type="button" onClick={() => onOpenPanel("Archive")}>Archive / {String(runs.length).padStart(2, "0")}</button>
          <button type="button" onClick={() => onOpenPanel("Sign in")}>
            Wallet <strong>{session ? formatCents(account?.availableCents) : "Sign in"}</strong>
          </button>
          <button className="studio-exit" type="button" onClick={onReturn} aria-label="Return to landing page">
            <ArrowLeft size={16} /> Manual
          </button>
        </nav>
      </header>

      <section className="studio-prompt-zone" aria-labelledby="studio-prompt-heading">
        <div className="studio-index">Input / 01</div>
        <div>
          <p className="studio-label">Prompt stream</p>
          <label id="studio-prompt-heading" htmlFor="studio-prompt">What should the network dream?</label>
          <textarea
            id="studio-prompt"
            rows={2}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              setError("");
              if (phase === "complete" || phase === "failed") newRun();
            }}
            disabled={isRunning}
          />
          <small>Describe any image or video. The network will interpret.</small>
          {error && <p className="studio-error" role="alert">{error}</p>}
        </div>
      </section>

      <section className="studio-workspace">
        <fieldset className="studio-outcomes" disabled={isRunning}>
          <legend className="studio-label">Outcome / choose one</legend>
          {OUTCOMES.map((candidate, index) => (
            <label className={`studio-outcome ${selectedId === candidate.id ? "is-selected" : ""}`} key={candidate.id}>
              <input
                type="radio"
                name="studio-outcome"
                value={candidate.id}
                checked={selectedId === candidate.id}
                onChange={() => {
                  setSelectedId(candidate.id);
                  newRun();
                }}
              />
              <span className="studio-outcome-index">0{index + 1}</span>
              <span>
                <strong>{candidate.studioLabel}</strong>
                <small>{candidate.signal}</small>
              </span>
              <i aria-hidden="true">{selectedId === candidate.id && <Check size={12} weight="bold" />}</i>
              <p>{candidate.description}</p>
              <em>{candidate.eta}</em>
            </label>
          ))}
          <p className="studio-engine-note"><Cpu size={14} /> Lmiere chooses the best engine behind the scenes.</p>
        </fieldset>

        <div className="studio-quote">
          <p className="studio-label">Estimated cost</p>
          <output>{formatPrice(outcome.price)}</output>
          <span>USD / No subscription</span>
          <button
            className="studio-run-button"
            type="button"
            onClick={phase === "complete" || phase === "failed" ? newRun : beginRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <><CircleNotch className="spin" size={19} /> Running {progress}%</>
            ) : phase === "complete" || phase === "failed" ? (
              <>New run <ArrowRight size={20} /></>
            ) : (
              <>Begin run <ArrowRight size={20} /></>
            )}
          </button>
          <small>You will be charged {formatPrice(outcome.price)} only if the run completes.</small>
          <strong>03 routes / <b>{isRunning ? "01 active" : "ready"}</b></strong>
        </div>

        <figure className={`studio-output ${isRunning ? "is-generating" : ""} ${phase === "complete" ? "is-complete" : ""}`}>
          <figcaption>
            <span><i /> Live output feed</span>
            <small>{outcome.signal} / {generation?.id ?? "AWAITING"}</small>
          </figcaption>
          <div className="studio-output-frame">
            {result ? <ResultMedia generation={result} /> : (
              <img src="/assets/lmiere-result-cabin.png" alt="A glass cabin glowing in a forest" />
            )}
            {isRunning && (
              <div className="studio-output-scan" aria-live="polite">
                <CircleNotch className="spin" size={23} /> Interpreting prompt
              </div>
            )}
            {phase === "complete" && (
              <div className="studio-output-complete" aria-live="polite">
                <Check size={16} weight="bold" /> Run complete
              </div>
            )}
          </div>
          <div className="studio-progress-row">
            <span>{phase === "complete" ? "Stored in archive" : isRunning ? "Generating" : "Awaiting run"}</span>
            <span>{phase === "idle" || phase === "failed" ? "00" : progress}%</span>
          </div>
          <div className="studio-progress-track"><i style={{ width: `${phase === "idle" || phase === "failed" ? 0 : progress}%` }} /></div>
          {phase === "complete" && (
            <button className="studio-result-button" type="button" onClick={() => onOpenPanel("Result", generation)}>
              Open result <ArrowRight size={17} />
            </button>
          )}
        </figure>
      </section>

      <footer className="studio-footer">
        <div className="studio-log">
          <p className="studio-label">System log</p>
          <span>{isRunning ? "Live / Provider route active" : "Ready / Prompt route standing by"}</span>
          <span>{session ? "Private wallet connected" : "Wallet waiting for sign in"}</span>
          <span>Neon archive / EU-Central</span>
        </div>
        <p>Your prompt travels. Engines interpret. Images emerge.</p>
        <div><span>Build 1.0.0</span><strong>Status / Nominal</strong></div>
      </footer>
    </main>
  );
}

export function App() {
  const [screen, setScreen] = useState("landing");
  const [panel, setPanel] = useState(null);
  const [panelPayload, setPanelPayload] = useState(null);
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  const [runs, setRuns] = useState([]);

  const refreshAccount = useCallback(async () => {
    try {
      const data = await apiRequest("/api/me");
      setAccount(data.account);
      setRuns(data.runs ?? []);
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sign in")) {
        setAccount(null);
        setRuns([]);
      }
      return null;
    }
  }, []);

  const refreshIdentity = useCallback(async () => {
    const identity = await getSessionWithToken();
    setSession(identity.session);
    if (identity.session?.user) await refreshAccount();
    else {
      setAccount(null);
      setRuns([]);
    }
  }, [refreshAccount]);

  useEffect(() => {
    refreshIdentity().catch(() => {
      setSession(null);
      setAccount(null);
      setRuns([]);
    });
  }, [refreshIdentity]);

  function openPanel(nextPanel, payload = null) {
    setPanel(nextPanel);
    setPanelPayload(payload);
    if (nextPanel === "Archive" && session?.user) refreshAccount();
  }

  function closePanel() {
    setPanel(null);
    setPanelPayload(null);
  }

  function enterStudio() {
    closePanel();
    setScreen("studio");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnToLanding() {
    closePanel();
    setScreen("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function signOut() {
    if (authClient) await authClient.signOut();
    setSession(null);
    setAccount(null);
    setRuns([]);
    closePanel();
  }

  return (
    <>
      {screen === "landing" ? (
        <LandingScreen onEnterStudio={enterStudio} onOpenPanel={openPanel} session={session} />
      ) : (
        <StudioScreen
          onReturn={returnToLanding}
          onOpenPanel={openPanel}
          session={session}
          account={account}
          runs={runs}
          onAccountChanged={refreshAccount}
        />
      )}
      <SidePanel
        panel={panel}
        onClose={closePanel}
        onOpenStudio={enterStudio}
        onOpenPanel={openPanel}
        session={session}
        account={account}
        runs={runs}
        result={panelPayload}
        onAuthenticated={refreshIdentity}
        onSignOut={signOut}
      />
    </>
  );
}
