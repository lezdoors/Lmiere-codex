import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ClockCounterClockwise,
  CircleNotch,
  Coins,
  Cpu,
  DownloadSimple,
  FileText,
  LockKey,
  Receipt,
  ShieldCheck,
  SignOut,
  Sparkle,
  UserCircle,
  Wallet,
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

function formatStatus(status = "pending") {
  return status.replaceAll("_", " ");
}

function routeFromPath(pathname = "/") {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "landing", path };
  if (path === "/studio") return { name: "studio", path };
  if (path === "/archive") return { name: "archive", path };
  if (path === "/account") return { name: "account", path };
  if (path === "/privacy") return { name: "privacy", path };
  if (path === "/terms") return { name: "terms", path };
  if (path.startsWith("/runs/")) {
    return { name: "run", path, id: decodeURIComponent(path.slice("/runs/".length)) };
  }
  return { name: "not-found", path };
}

function ledgerLabel(kind) {
  return {
    initial_credit: "Opening test credit",
    credit: "Credit added",
    reserve: "Run approved",
    settle: "Completed generation",
    release: "Charge released",
    refund: "Credit returned",
  }[kind] ?? "Wallet activity";
}

function BrandMark({ dark = false }) {
  return (
    <span className={`brand-seal ${dark ? "brand-seal-dark" : ""}`} aria-hidden="true">
      L<Sparkle size={11} weight="fill" />
    </span>
  );
}

function SignalImage({ src, alt, className = "", loading = "lazy" }) {
  const [active, setActive] = useState(false);

  function moveSignal(event) {
    setActive(true);
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    event.currentTarget.style.setProperty("--signal-x", `${x.toFixed(2)}%`);
    event.currentTarget.style.setProperty("--signal-y", `${y.toFixed(2)}%`);
  }

  return (
    <span
      className={`signal-image ${active ? "is-signal-active" : ""} ${className}`}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onPointerMove={moveSignal}
    >
      <img className="signal-image-base" src={src} alt={alt} loading={loading} />
      <img className="signal-image-echo signal-image-echo-a" src={src} alt="" aria-hidden="true" loading={loading} />
      <img className="signal-image-echo signal-image-echo-b" src={src} alt="" aria-hidden="true" loading={loading} />
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
      setError("Account access is not configured for this environment.");
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
        <p className="panel-kicker">Private account connected</p>
        <h2>{session.user.name || "Lmiere member"}</h2>
        <p>{session.user.email}</p>
        <div className="account-balance">
          <span>Available balance</span>
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
        <p className="panel-kicker">Private account access</p>
        <h2>{mode === "sign-up" ? "Create your field identity." : "Return to your archive."}</h2>
        <p>Your generations, balance, and results stay attached to your account and never mix with another member’s archive.</p>

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
      <small>Secure sign-in protects your private archive and available balance.</small>
    </div>
  );
}

function ResultMedia({ generation, interactive = false }) {
  if (!generation?.resultUrl) return null;
  if (generation.resultContentType?.startsWith("video/")) {
    return <video src={generation.resultUrl} controls playsInline autoPlay loop />;
  }
  if (interactive) {
    return <SignalImage src={generation.resultUrl} alt={generation.prompt || "Generated Lmiere result"} />;
  }
  return <img src={generation.resultUrl} alt={generation.prompt || "Generated Lmiere result"} />;
}

function SidePanel({
  panel,
  onClose,
  onOpenStudio,
  onOpenPanel,
  onNavigate,
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
            {!session && (
              <>
                <p className="archive-empty">Sign in to recover your private generation history.</p>
                <button className="panel-action" type="button" onClick={() => onOpenPanel("Sign in")}>
                  Sign in to archive <ArrowRight size={17} />
                </button>
              </>
            )}
            {session && runs.length === 0 && <p className="archive-empty">No runs yet. The archive is waiting.</p>}
            <div className="archive-list">
              {runs.map((run, index) => {
                const outcome = outcomeById(run.outcome);
                return (
                  <button
                    className="archive-row"
                    type="button"
                    key={run.id}
                    onClick={() => onNavigate(`/runs/${encodeURIComponent(run.id)}`)}
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
            {session && (
              <button className="panel-action" type="button" onClick={() => onNavigate("/archive")}>
                Open full archive <ArrowRight size={17} />
              </button>
            )}
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
            <button className="panel-action" type="button" onClick={() => onOpenStudio()}>
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
            <button className="panel-action" type="button" onClick={() => onNavigate(`/runs/${encodeURIComponent(result.id)}`)}>
              Open full record <ArrowUpRight size={17} />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function LandingScreen({ onEnterStudio, onOpenPanel, onNavigate, session }) {
  return (
    <main className="landing-screen">
      <section className="landing-intro" aria-label="Lmiere field manual cover">
        <header className="landing-header">
          <button className="landing-brand" type="button" aria-label="Lmiere home" onClick={() => onNavigate("/")}>
            <BrandMark />
            <span>Lmiere<br />Field manual</span>
          </button>

          <div className="landing-meta" aria-label="Edition details">
            <span>Issue 001<br />Pay-per-generation</span>
            <span>No. LM-001-FG<br />Open beta</span>
          </div>

          <nav className="landing-nav" aria-label="Landing navigation">
            <button type="button" onClick={() => onNavigate("/archive")}>Archive</button>
            <button type="button" onClick={() => onOpenPanel("Sign in")}>
              {session?.user?.name || "Sign in"}
            </button>
            <button className="landing-nav-cta" type="button" onClick={onEnterStudio}>Open studio</button>
          </nav>
        </header>

        <div className="landing-rule" aria-hidden="true" />

        <section className="landing-hero">
          <SignalImage
            className="landing-machine"
            src="/assets/lmiere-field-machine.png"
            alt="A meteorite fused with a precision camera mechanism, drawn like a scientific blueprint"
            loading="eager"
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
              <a className="text-paper-button" href="#landing-method">
                How it works <ArrowRight className="north-east-arrow" size={14} />
              </a>
            </div>
          </div>

          <div className="landing-annotation landing-annotation-a" aria-hidden="true">
            <span>A.</span><p>Latent image chamber</p>
          </div>
          <div className="landing-annotation landing-annotation-b" aria-hidden="true">
            <span>B.</span><p>Interpretation lens</p>
          </div>
        </section>

        <footer className="landing-footer">
          <div><span>01</span><strong>Describe the unseen</strong><small>Use ordinary language</small></div>
          <div><span>02</span><strong>Choose an outcome</strong><small>Image, motion, or detail</small></div>
          <div><span>03</span><strong>Approve the exact cost</strong><small>No subscription required</small></div>
          <p>Recovered 2026<br />Lmiere Labs</p>
        </footer>

        <p className="landing-edge-note">Open field test // Europe · Morocco · United States</p>
      </section>

      <section className="landing-section landing-outcomes-section" id="outcomes">
        <header className="manual-section-heading">
          <div>
            <p className="landing-kicker">// Outcome catalog 001–003</p>
            <h2>Three routes.<br /><em>One visible price.</em></h2>
          </div>
          <p>Choose what you want to make—not which model, checkpoint, or provider to operate. Lmiere handles the machinery behind the page.</p>
        </header>

        <div className="landing-outcome-grid">
          {OUTCOMES.map((outcome, index) => (
            <article className="landing-outcome-card" key={outcome.id}>
              <span>0{index + 1} / {outcome.signal}</span>
              <h3>{outcome.studioLabel}</h3>
              <p>{outcome.description}</p>
              <div><strong>{formatPrice(outcome.price)}</strong><small>{outcome.eta}<br />Charged on completion</small></div>
              <button type="button" onClick={onEnterStudio}>Choose route <ArrowRight size={16} /></button>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-records-section" aria-labelledby="field-records-title">
        <header className="manual-section-heading records-heading">
          <div>
            <p className="landing-kicker">// Recovered outputs</p>
            <h2 id="field-records-title">Field records from<br /><em>the unseen.</em></h2>
          </div>
          <p>Every completed run returns as a private record: the result, the prompt that made it, the route used, and the exact amount charged.</p>
        </header>

        <div className="field-record-grid">
          <figure className="field-record field-record-cabin">
            <SignalImage src="/assets/lmiere-result-cabin.png" alt="A glass cabin glowing in a wet forest, shown as a completed generation" />
            <figcaption><span>Record LM–029</span><strong>A memory of rain inside a glass house</strong><small>Cinematic motion / $0.42</small></figcaption>
          </figure>
          <figure className="field-record field-record-specimen">
            <SignalImage src="/assets/lmiere-specimen-awake.png" alt="A luminous neural specimen bridging an archival drawing and a living network" />
            <figcaption><span>Specimen LM–001</span><strong>The network, awake</strong><small>Highest quality / $0.76</small></figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-section landing-method-section" id="landing-method">
        <header className="manual-section-heading method-heading">
          <div>
            <p className="landing-kicker">// Operating procedure</p>
            <h2>Power without<br /><em>the control room.</em></h2>
          </div>
          <p>No subscription maze. No model directory. No shared team balance. The essential decisions stay visible and the infrastructure disappears.</p>
        </header>

        <div className="landing-trust-grid">
          <article><ShieldCheck size={27} weight="light" /><span>01</span><h3>Private by account</h3><p>Your balance, runs, and archive are isolated from every other member.</p></article>
          <article><Receipt size={27} weight="light" /><span>02</span><h3>Exact cost first</h3><p>Approve a fixed price before the run. Failed runs release the charge.</p></article>
          <article><LockKey size={27} weight="light" /><span>03</span><h3>Complexity stays hidden</h3><p>Choose an outcome in plain language. Lmiere selects the route behind the scenes.</p></article>
        </div>

        <div className="landing-procedure">
          <ol>
            <li><span>01</span><strong>Describe the unseen</strong><p>Write an ordinary sentence. Precision is welcome; jargon is not required.</p></li>
            <li><span>02</span><strong>Choose the outcome</strong><p>Pick speed, motion, or maximum detail and see its price immediately.</p></li>
            <li><span>03</span><strong>Approve and recover</strong><p>Begin the run, watch its status, and collect the result in your archive.</p></li>
          </ol>
          <div>
            <p className="landing-kicker">Field note / 04</p>
            <blockquote>“Your prompt travels. Engines interpret. Images emerge.”</blockquote>
            <button className="primary-paper-button" type="button" onClick={onEnterStudio}>Open studio <ArrowRight size={21} /></button>
          </div>
        </div>
      </section>

      <section className="landing-closing-section">
        <SignalImage className="landing-closing-image" src="/assets/lmiere-specimen-idle.png" alt="A dormant neural specimen fading from archival paper into a dark network" />
        <div>
          <p className="landing-kicker">// Machine standing by</p>
          <h2>Make the thing<br />you cannot find.</h2>
          <p>Begin with an image for eight cents. Leave with a private record, not another dashboard to learn.</p>
          <button className="primary-paper-button" type="button" onClick={onEnterStudio}>Enter the machine <ArrowRight size={21} /></button>
        </div>
      </section>

      <footer className="landing-site-footer">
        <div><BrandMark dark /><span>Lmiere<br />Field manual</span></div>
        <nav aria-label="Footer navigation">
          <button type="button" onClick={() => onNavigate("/studio")}>Studio</button>
          <button type="button" onClick={() => onNavigate("/archive")}>Archive</button>
          <button type="button" onClick={() => onNavigate("/account")}>Account</button>
          <a href="/privacy" onClick={(event) => { event.preventDefault(); onNavigate("/privacy"); }}>Privacy</a>
          <a href="/terms" onClick={(event) => { event.preventDefault(); onNavigate("/terms"); }}>Terms</a>
        </nav>
        <p>© 2026 Lmiere Labs<br />Open field test</p>
      </footer>
    </main>
  );
}

function StudioScreen({
  onReturn,
  onOpenPanel,
  onNavigate,
  session,
  account,
  runs,
  onAccountChanged,
  initialDraft,
}) {
  const [selectedId, setSelectedId] = useState(initialDraft?.outcome ?? "cinematic");
  const [prompt, setPrompt] = useState(initialDraft?.prompt ?? "A memory of rain inside a glass house");
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
          <div><span>Archive</span><strong>Account-isolated / Private</strong></div>
        </div>

        <nav className="studio-nav" aria-label="Studio navigation">
          <button type="button" onClick={() => onNavigate("/archive")}>Archive / {String(runs.length).padStart(2, "0")}</button>
          <button type="button" onClick={() => onNavigate("/account")}>
            Wallet <strong>{session ? formatCents(account?.availableCents) : "Sign in"}</strong>
          </button>
          <button className="studio-exit" type="button" onClick={onReturn} aria-label="Return to landing page">
            <ArrowLeft size={16} /> Manual
          </button>
        </nav>
      </header>

      <nav className="studio-mobile-nav" aria-label="Mobile studio navigation">
        <button type="button" aria-current="page">Studio</button>
        <button type="button" onClick={() => onNavigate("/archive")}>Archive / {String(runs.length).padStart(2, "0")}</button>
        <button type="button" onClick={() => onNavigate("/account")}>Wallet {session ? formatCents(account?.availableCents) : "Sign in"}</button>
      </nav>

      <section className="studio-prompt-zone" aria-labelledby="studio-prompt-heading">
        <div className="studio-index">Input / 01</div>
        <div>
          <p className="studio-label">Prompt stream</p>
          <label id="studio-prompt-heading" htmlFor="studio-prompt" role="heading" aria-level="1">What should the network dream?</label>
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
            <button className="studio-result-button" type="button" onClick={() => onNavigate(`/runs/${encodeURIComponent(generation.id)}`)}>
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
          <span>Private archive / Account-isolated</span>
        </div>
        <p>Your prompt travels. Engines interpret. Images emerge.</p>
        <div><span>Build 1.0.0</span><strong>Status / Nominal</strong></div>
      </footer>
    </main>
  );
}

function ProductHeader({ active, tone = "night", onNavigate, session, account, runs }) {
  return (
    <header className={`product-header product-header-${tone}`}>
      <button className="product-brand" type="button" onClick={() => onNavigate("/")} aria-label="Return to Lmiere home">
        <BrandMark dark={tone !== "paper"} />
        <span>Lmiere<br /><small>Distributed image machine</small></span>
      </button>

      <div className="product-header-meta" aria-label="Page status">
        <span>Field route<br /><strong>{active}</strong></span>
        <span>Archive<br /><strong>{String(runs.length).padStart(2, "0")} records</strong></span>
      </div>

      <nav className="product-nav" aria-label="Product navigation">
        <button type="button" aria-current={active === "Studio" ? "page" : undefined} onClick={() => onNavigate("/studio")}>Studio</button>
        <button type="button" aria-current={active === "Archive" ? "page" : undefined} onClick={() => onNavigate("/archive")}>Archive</button>
        <button type="button" aria-current={active === "Account" ? "page" : undefined} onClick={() => onNavigate("/account")}>
          Wallet <strong>{session ? formatCents(account?.availableCents) : "Sign in"}</strong>
        </button>
        <button type="button" onClick={() => onNavigate("/")}><ArrowLeft size={15} /> Manual</button>
      </nav>
    </header>
  );
}

function AuthGate({ eyebrow, title, copy, onOpenPanel, tone = "night", headingLevel = "h2" }) {
  const Heading = headingLevel;

  return (
    <section className={`auth-gate auth-gate-${tone}`}>
      <LockKey size={35} weight="light" />
      <p>{eyebrow}</p>
      <Heading>{title}</Heading>
      <span>{copy}</span>
      <button type="button" onClick={() => onOpenPanel("Sign in")}>Sign in or create account <ArrowRight size={18} /></button>
    </section>
  );
}

function ArchiveMedia({ run }) {
  if (run?.resultContentType?.startsWith("video/") && run.resultUrl) {
    return <video src={run.resultUrl} muted playsInline preload="metadata" />;
  }
  return (
    <SignalImage
      src={run?.resultUrl || "/assets/lmiere-result-cabin.png"}
      alt={run?.resultUrl ? run.prompt : "A dormant sample record waiting for a completed generation"}
    />
  );
}

function ArchiveScreen({ session, account, runs, onNavigate, onOpenPanel }) {
  const completed = runs.filter((run) => run.status === "complete").length;
  const spentCents = runs.reduce((sum, run) => sum + (run.status === "complete" ? run.chargeCents : 0), 0);

  return (
    <main className="archive-screen">
      <ProductHeader active="Archive" tone="blue" onNavigate={onNavigate} session={session} account={account} runs={runs} />

      <div className="archive-paper">
        <section className="archive-page-intro">
          <div>
            <p>// Private output index</p>
            <h1>Your archive<br /><em>remembers.</em></h1>
          </div>
          <p>Every completed image and motion run returns here with its prompt, route, status, and exact charge intact.</p>
        </section>

        <div className="archive-stat-row" aria-label="Archive summary">
          <div><span>Records</span><strong>{String(runs.length).padStart(2, "0")}</strong></div>
          <div><span>Recovered</span><strong>{String(completed).padStart(2, "0")}</strong></div>
          <div><span>Total charged</span><strong>{formatCents(spentCents)}</strong></div>
          <div><span>Available</span><strong>{session ? formatCents(account?.availableCents) : "—"}</strong></div>
        </div>

        {!session ? (
          <AuthGate
            tone="blue"
            eyebrow="Archive sealed"
            title="Sign in to recover your records."
            copy="Your archive and balance are private to your account."
            onOpenPanel={onOpenPanel}
          />
        ) : runs.length === 0 ? (
          <section className="archive-zero-state">
            <SignalImage src="/assets/lmiere-specimen-idle.png" alt="A dormant network specimen waiting for its first run" />
            <div><p>// No recovered records</p><h2>The archive is waiting.</h2><span>Begin with one sentence and one visible price.</span><button type="button" onClick={() => onNavigate("/studio")}>Make the first record <ArrowRight size={18} /></button></div>
          </section>
        ) : (
          <section className="archive-record-grid" aria-label="Generation records">
            {runs.map((run, index) => {
              const outcome = outcomeById(run.outcome);
              return (
                <button className="archive-record-card" type="button" key={run.id} onClick={() => onNavigate(`/runs/${encodeURIComponent(run.id)}`)}>
                  <div className="archive-record-heading"><span>#{String(index + 1).padStart(2, "0")} {formatStatus(run.status)}</span><small>{formatRunTime(run.createdAt)}</small></div>
                  <ArchiveMedia run={run} />
                  <div className="archive-record-copy"><h2>{run.prompt}</h2><p>{outcome.signal} / {outcome.label}</p><strong>{formatCents(run.chargeCents)}</strong></div>
                </button>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function AccountScreen({ session, account, runs, ledger, onNavigate, onOpenPanel, onSignOut }) {
  const completeRuns = runs.filter((run) => run.status === "complete");
  const spentCents = completeRuns.reduce((sum, run) => sum + run.chargeCents, 0);

  return (
    <main className="account-screen network-page">
      <ProductHeader active="Account" onNavigate={onNavigate} session={session} account={account} runs={runs} />
      {!session ? (
        <AuthGate
          headingLevel="h1"
          eyebrow="Private wallet"
          title="One balance. Yours alone."
          copy="Sign in to see available credit, active reservations, and completed charges."
          onOpenPanel={onOpenPanel}
        />
      ) : (
        <div className="account-page-body">
          <section className="network-page-intro">
            <video className="account-signal-video" src="/assets/lmiere-signal-ripple.mp4" poster="/assets/lmiere-specimen-idle.png" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
            <div><p>// Account ledger</p><h1>Wallet<br /><em>signal.</em></h1></div>
            <p>{session.user.email}<br />Every credit movement is attached to this account and its private run history.</p>
          </section>

          <section className="wallet-summary-grid" aria-label="Wallet summary">
            <article><Wallet size={24} weight="light" /><span>Available balance</span><strong>{formatCents(account?.availableCents)}</strong><small>Ready for a new run</small></article>
            <article><ClockCounterClockwise size={24} weight="light" /><span>Reserved</span><strong>{formatCents(account?.reservedCents)}</strong><small>Held only while runs are active</small></article>
            <article><Coins size={24} weight="light" /><span>Completed spend</span><strong>{formatCents(spentCents)}</strong><small>{completeRuns.length} recovered generation{completeRuns.length === 1 ? "" : "s"}</small></article>
          </section>

          <section className="ledger-section">
            <header><div><p>// Immutable activity</p><h2>Credit ledger</h2></div><span>{ledger.length} entries recovered</span></header>
            {ledger.length === 0 ? <p className="ledger-empty">No wallet activity has been recorded yet.</p> : (
              <div className="ledger-list">
                {ledger.map((entry) => (
                  <article key={entry.id}>
                    <Receipt size={18} weight="light" />
                    <div><strong>{ledgerLabel(entry.kind)}</strong><span>{formatRunTime(entry.createdAt)}{entry.note ? ` / ${entry.note}` : ""}</span></div>
                    <div>
                      <strong className={entry.balanceDeltaCents < 0 ? "is-debit" : ""}>{entry.balanceDeltaCents === 0 ? "—" : `${entry.balanceDeltaCents > 0 ? "+" : "−"}${formatCents(Math.abs(entry.balanceDeltaCents))}`}</strong>
                      <span>{entry.reservedDeltaCents === 0 ? "" : `${entry.reservedDeltaCents > 0 ? "+" : "−"}${formatCents(Math.abs(entry.reservedDeltaCents))} reserved`}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="account-actions">
            <button type="button" onClick={() => onNavigate("/studio")}>Open studio <ArrowRight size={17} /></button>
            <button type="button" onClick={onSignOut}>Sign out <SignOut size={17} /></button>
          </div>
        </div>
      )}
    </main>
  );
}

function RunScreen({ id, session, account, runs, onNavigate, onOpenPanel, onRemix }) {
  const cached = runs.find((run) => run.id === id) ?? null;
  const [record, setRecord] = useState(cached);
  const [loading, setLoading] = useState(Boolean(session && !cached));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session || cached) {
      setRecord(cached);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    apiRequest(`/api/generations/${encodeURIComponent(id)}`)
      .then((data) => { if (!cancelled) setRecord(data.generation); })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "The record could not be recovered."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cached, id, session]);

  const outcome = record ? outcomeById(record.outcome) : null;

  return (
    <main className="archive-screen run-screen">
      <ProductHeader active="Archive" tone="blue" onNavigate={onNavigate} session={session} account={account} runs={runs} />
      <div className="archive-paper run-paper">
        {!session ? (
          <AuthGate headingLevel="h1" tone="blue" eyebrow="Record sealed" title="Sign in to recover this run." copy="Run links resolve only inside the account that created them." onOpenPanel={onOpenPanel} />
        ) : loading ? (
          <div className="run-loading"><CircleNotch className="spin" size={28} /> Recovering record</div>
        ) : error || !record ? (
          <section className="archive-zero-state"><SignalImage src="/assets/lmiere-specimen-idle.png" alt="A dormant specimen indicating a missing record" /><div><p>// Recovery failed</p><h2>Record not found.</h2><span>{error || "This run may belong to another account."}</span><button type="button" onClick={() => onNavigate("/archive")}>Return to archive <ArrowLeft size={18} /></button></div></section>
        ) : (
          <>
            <section className="run-page-intro">
              <div><p>// Record {record.id}</p><h1>{record.prompt}</h1></div>
              <div><span>Status</span><strong>{formatStatus(record.status)}</strong><span>Recovered</span><strong>{formatRunTime(record.completedAt || record.createdAt)}</strong></div>
            </section>

            <section className="run-media-stage">
              {record.resultUrl ? <ResultMedia generation={record} interactive /> : <SignalImage src="/assets/lmiere-result-cabin.png" alt="Preview image while this run awaits a completed result" />}
              <div className="run-media-index"><span>{outcome.signal}</span><span>{outcome.label}</span><span>{formatCents(record.chargeCents)}</span><span>{String(record.progress ?? 0).padStart(2, "0")}%</span></div>
            </section>

            <section className="run-record-notes">
              <div><p>// Prompt transcript</p><blockquote>{record.prompt}</blockquote></div>
              <dl>
                <div><dt>Outcome</dt><dd>{outcome.label}</dd></div>
                <div><dt>Exact charge</dt><dd>{formatCents(record.chargeCents)}</dd></div>
                <div><dt>Created</dt><dd>{formatRunTime(record.createdAt)}</dd></div>
                <div><dt>Completion</dt><dd>{formatRunTime(record.completedAt)}</dd></div>
              </dl>
            </section>

            <div className="run-actions">
              {record.resultUrl && <a href={record.resultUrl} download target="_blank" rel="noreferrer">Save result <DownloadSimple size={18} /></a>}
              <button type="button" onClick={() => onRemix(record)}>Remix this prompt <ArrowRight size={18} /></button>
              <button type="button" onClick={() => onNavigate("/archive")}>Back to archive <ArrowLeft size={18} /></button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const LEGAL_COPY = {
  privacy: {
    eyebrow: "// Document 004 / Privacy",
    title: "Your prompts are records, not public posts.",
    summary: "This notice explains the information Lmiere keeps during the beta and why it is needed to operate private accounts, balances, and generations.",
    sections: [
      ["Information kept with your account", "Lmiere stores the account details needed for sign-in, your wallet balance and ledger, generation prompts, status records, prices, and completed result links."],
      ["How the information is used", "The information is used to authenticate you, isolate your credits and archive, submit requested generations, return results, prevent abuse, and keep the service reliable."],
      ["Generation providers", "Prompts and generation settings are sent to infrastructure providers only when needed to complete the run you requested. Provider names and model details stay outside the everyday interface."],
      ["Retention and account control", "Run and wallet records remain attached to your account so the archive and billing history stay accurate. Account export and deletion controls will be finalized before the beta opens broadly."],
      ["Security boundary", "Provider credentials and database credentials remain on the server. They are never sent to the browser. No online service can promise absolute security, so access is limited to what the product needs."],
    ],
  },
  terms: {
    eyebrow: "// Document 005 / Terms",
    title: "A simple machine still needs clear rules.",
    summary: "These beta terms describe how credits, generations, and acceptable use work while Lmiere is being tested with a limited group.",
    sections: [
      ["Beta service", "Features, generation routes, pricing, and availability may change while the product is tested. Lmiere may pause a route when reliability or provider availability requires it."],
      ["Credits and completed runs", "The exact price is shown before a run begins. A charge is settled only after a generation completes; failed or cancelled runs release the reservation. Test credits are not cash and are not transferable."],
      ["Your prompts and results", "You remain responsible for the prompts you submit and how you use generated results. Do not submit material you do not have the right to use or content that violates applicable law."],
      ["Acceptable use", "Do not use Lmiere to harm people, impersonate others deceptively, exploit minors, create illegal content, attack systems, evade safeguards, or interfere with another member’s account."],
      ["Availability and limits", "Generation systems can fail, queue, or return unexpected results. Lmiere will make reasonable efforts to release charges for incomplete runs but does not guarantee continuous availability or a particular creative result."],
      ["Before public launch", "These terms are a beta operating draft and should receive legal review before paid credits or unrestricted public access are enabled."],
    ],
  },
};

function LegalScreen({ type, onNavigate }) {
  const document = LEGAL_COPY[type];
  return (
    <main className="legal-screen">
      <header className="legal-header">
        <button type="button" onClick={() => onNavigate("/")}><BrandMark /><span>Lmiere<br />Field manual</span></button>
        <span>Effective August 2, 2026<br />Beta operating draft</span>
        <button type="button" onClick={() => onNavigate("/")}><ArrowLeft size={16} /> Return to manual</button>
      </header>
      <article className="legal-document">
        <header><p>{document.eyebrow}</p><h1>{document.title}</h1><span>{document.summary}</span></header>
        <div className="legal-sections">
          {document.sections.map(([heading, copy], index) => <section key={heading}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{heading}</h2><p>{copy}</p></div></section>)}
        </div>
      </article>
      <footer className="legal-footer"><FileText size={20} /><p>Lmiere Labs / Open field test</p><nav><button type="button" onClick={() => onNavigate("/privacy")}>Privacy</button><button type="button" onClick={() => onNavigate("/terms")}>Terms</button></nav></footer>
    </main>
  );
}

function NotFoundScreen({ onNavigate }) {
  return (
    <main className="not-found-screen">
      <BrandMark />
      <p>// Field coordinate not found</p>
      <h1>404</h1>
      <span>This route has not been recovered.</span>
      <button type="button" onClick={() => onNavigate("/")}>Return to the manual <ArrowLeft size={18} /></button>
    </main>
  );
}

export function App() {
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));
  const [panel, setPanel] = useState(null);
  const [panelPayload, setPanelPayload] = useState(null);
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  const [runs, setRuns] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [studioDraft, setStudioDraft] = useState(null);

  const refreshAccount = useCallback(async () => {
    try {
      const data = await apiRequest("/api/me");
      setAccount(data.account);
      setRuns(data.runs ?? []);
      setLedger(data.ledger ?? []);
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sign in")) {
        setAccount(null);
        setRuns([]);
        setLedger([]);
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
      setLedger([]);
    }
  }, [refreshAccount]);

  useEffect(() => {
    refreshIdentity().catch(() => {
      setSession(null);
      setAccount(null);
      setRuns([]);
      setLedger([]);
    });
  }, [refreshIdentity]);

  useEffect(() => {
    function handlePopState() {
      setRoute(routeFromPath(window.location.pathname));
      closePanel();
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const title = {
      landing: "Lmiere — Pay per generation",
      studio: "Studio — Lmiere",
      archive: "Archive — Lmiere",
      run: "Run record — Lmiere",
      account: "Account — Lmiere",
      privacy: "Privacy — Lmiere",
      terms: "Terms — Lmiere",
      "not-found": "Not found — Lmiere",
    }[route.name];
    document.title = title;
  }, [route.name]);

  function openPanel(nextPanel, payload = null) {
    setPanel(nextPanel);
    setPanelPayload(payload);
    if (nextPanel === "Archive" && session?.user) refreshAccount();
  }

  function closePanel() {
    setPanel(null);
    setPanelPayload(null);
  }

  const navigate = useCallback((path, options = {}) => {
    const next = routeFromPath(path);
    if (options.replace) window.history.replaceState({}, "", next.path);
    else if (window.location.pathname !== next.path) window.history.pushState({}, "", next.path);
    closePanel();
    setRoute(next);
    window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
  }, []);

  function enterStudio(draft = null) {
    setStudioDraft(draft);
    navigate("/studio");
  }

  function remixRun(record) {
    enterStudio({ prompt: record.prompt, outcome: record.outcome });
  }

  async function signOut() {
    if (authClient) await authClient.signOut();
    setSession(null);
    setAccount(null);
    setRuns([]);
    setLedger([]);
    closePanel();
  }

  let page;
  if (route.name === "landing") {
    page = <LandingScreen onEnterStudio={() => enterStudio()} onOpenPanel={openPanel} onNavigate={navigate} session={session} />;
  } else if (route.name === "studio") {
    page = (
      <StudioScreen
        key={`${studioDraft?.outcome ?? "default"}:${studioDraft?.prompt ?? "default"}`}
        onReturn={() => navigate("/")}
        onOpenPanel={openPanel}
        onNavigate={navigate}
        session={session}
        account={account}
        runs={runs}
        onAccountChanged={refreshAccount}
        initialDraft={studioDraft}
      />
    );
  } else if (route.name === "archive") {
    page = <ArchiveScreen session={session} account={account} runs={runs} onNavigate={navigate} onOpenPanel={openPanel} />;
  } else if (route.name === "account") {
    page = <AccountScreen session={session} account={account} runs={runs} ledger={ledger} onNavigate={navigate} onOpenPanel={openPanel} onSignOut={signOut} />;
  } else if (route.name === "run") {
    page = <RunScreen id={route.id} session={session} account={account} runs={runs} onNavigate={navigate} onOpenPanel={openPanel} onRemix={remixRun} />;
  } else if (route.name === "privacy" || route.name === "terms") {
    page = <LegalScreen type={route.name} onNavigate={navigate} />;
  } else {
    page = <NotFoundScreen onNavigate={navigate} />;
  }

  return (
    <>
      {page}
      <SidePanel
        panel={panel}
        onClose={closePanel}
        onOpenStudio={enterStudio}
        onOpenPanel={openPanel}
        onNavigate={navigate}
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
