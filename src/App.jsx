import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ClockCounterClockwise,
  CircleNotch,
  Coins,
  CreditCard,
  DownloadSimple,
  FileText,
  FilmStrip,
  ImageSquare,
  LinkSimple,
  LockKey,
  MagicWand,
  Plus,
  Receipt,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  Trash,
  UploadSimple,
  UserCircle,
  Wallet,
  X,
} from "@phosphor-icons/react";
import {
  apiRequest,
  authClient,
  getSessionWithToken,
  isAuthConfigured,
  isVerifiedSession,
} from "./auth.js";
import { isFullName, normalizeFullName } from "./account-validation.js";
import AsciiSignal from "./AsciiSignal.jsx";
import LatentField from "./LatentField.jsx";
import { BorderBeam } from "./components/ui/border-beam.jsx";
import { LanguageSwitch, localizeError, useLanguage } from "./i18n.jsx";

const OUTCOMES = [
  {
    id: "fast",
    label: "Fast image",
    studioLabel: "Fast image",
    description: "Quick ideas and visual exploration",
    price: 0.08,
    priceCents: 8,
    eta: "~8 sec",
    signal: "IMG / 4:3",
  },
  {
    id: "cinematic",
    label: "Cinematic video",
    studioLabel: "Cinematic motion",
    description: "Movement, atmosphere and story",
    price: 0.42,
    priceCents: 42,
    eta: "~45 sec",
    signal: "VID / 16:9",
  },
  {
    id: "quality",
    label: "Highest quality",
    studioLabel: "Highest quality",
    description: "Maximum detail and fidelity",
    price: 0.76,
    priceCents: 76,
    eta: "~70 sec",
    signal: "IMG / 4:3",
  },
];

const STUDIO_STYLES = [
  { id: "natural", label: "Natural" },
  { id: "editorial", label: "Editorial" },
  { id: "product", label: "Product" },
  { id: "cinematic", label: "Cinematic" },
  { id: "analog", label: "Analog" },
  { id: "surreal", label: "Surreal" },
];

const STUDIO_RATIOS = ["1:1", "4:3", "16:9", "9:16"];

const STUDIO_RECIPES = [
  {
    label: "Product reshoot",
    note: "Reference → campaign image",
    outcome: "quality",
    style: "product",
    ratio: "4:3",
    prompt: "Re-stage this product with premium material accuracy, controlled highlights, and a quiet campaign composition.",
    asksForReference: true,
  },
  {
    label: "Animate a still",
    note: "First frame → motion",
    outcome: "cinematic",
    style: "cinematic",
    ratio: "16:9",
    prompt: "Bring this frame to life with subtle natural movement, a slow camera push, and physically coherent light.",
    asksForReference: true,
  },
  {
    label: "Editorial portrait",
    note: "Words → finished plate",
    outcome: "quality",
    style: "editorial",
    ratio: "4:3",
    prompt: "An arresting editorial portrait with sculptural light, precise styling, and an unexpected but restrained set design.",
  },
  {
    label: "Social vertical",
    note: "Idea → 9:16 image",
    outcome: "fast",
    style: "cinematic",
    ratio: "9:16",
    prompt: "A bold vertical campaign image with one immediate focal point, clean negative space, and tactile cinematic color.",
  },
];

function readReferenceFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(new Error("Could not read that reference image.")), { once: true });
    reader.readAsDataURL(file);
  });
}

const LANDING_CHAPTERS = [
  { id: "apparatus", numeral: "I", label: "Apparatus" },
  { id: "outcomes", numeral: "II", label: "Outcomes" },
  { id: "mechanism", numeral: "III", label: "Mechanism" },
  { id: "transmission", numeral: "IV", label: "Transmission" },
  { id: "ownership", numeral: "V", label: "Ownership" },
  { id: "studio-entry", numeral: "VI", label: "Studio" },
];

const CREDIT_PACKS = [
  { id: "signal-10", amountCents: 1000, label: "Signal 10", note: "125 fast images" },
  { id: "signal-25", amountCents: 2500, label: "Signal 25", note: "Room to experiment" },
  { id: "signal-50", amountCents: 5000, label: "Signal 50", note: "For longer motion runs" },
];

function outcomeById(id) {
  return OUTCOMES.find((candidate) => candidate.id === id) ?? OUTCOMES[0];
}

function formatStatus(status = "pending", t) {
  return t(status.replaceAll("_", " "));
}

function routeFromPath(pathname = "/") {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "landing", path };
  if (path === "/studio") return { name: "studio", path };
  if (path === "/archive") return { name: "archive", path };
  if (path === "/account") return { name: "account", path };
  if (path === "/privacy") return { name: "privacy", path };
  if (path === "/terms") return { name: "terms", path };
  if (path === "/reset-password") return { name: "reset-password", path };
  if (path.startsWith("/runs/")) {
    return { name: "run", path, id: decodeURIComponent(path.slice("/runs/".length)) };
  }
  return { name: "not-found", path };
}

function ledgerLabel(kind, t) {
  return t({
    initial_credit: "Opening test credit",
    founder_gift: "Founder gift",
    credit: "Credit added",
    purchase: "Credit purchase",
    reserve: "Run approved",
    settle: "Completed generation",
    release: "Charge released",
    refund: "Credit returned",
  }[kind] ?? "Wallet activity");
}

function FounderGift({ gift, onAccept }) {
  const { formatCents, t } = useLanguage();
  if (!gift) return null;

  return (
    <div className="founder-gift-backdrop" role="presentation">
      <section className="founder-gift-card" role="dialog" aria-modal="true" aria-labelledby="founder-gift-title">
        <div className="founder-gift-orbit" aria-hidden="true"><span /><span /><span /></div>
        <p>// {t("Private founder transmission")}</p>
        <h2 id="founder-gift-title">{t("A little chaos,")}<br /><em>{t("on {name}.", { name: gift.fromName })}</em></h2>
        <strong>{formatCents(gift.creditCents)}</strong>
        <blockquote>“{t(gift.message)}”</blockquote>
        <button type="button" onClick={onAccept}>{t("Accept the pixels")} <ArrowRight size={17} /></button>
        <small>{t("This credit belongs only to your account.")}</small>
      </section>
    </div>
  );
}

function BrandMark({ dark = false }) {
  return (
    <svg className={`brand-seal ${dark ? "brand-seal-dark" : ""}`} viewBox="0 0 51 51" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M0 0H51V51H0ZM2 2V49H49V2Z" />
      <path d="M44.32574462890625 0V14.25604248046875H223.6187744140625V1485.7439575195312H44.32574462890625V1500H593.6187744140625V1485.7439575195312H414.6187744140625V14.25604248046875H723.6187744140625Q841.6187744140625 14.25604248046875 914.7396850585938 46.2908935546875Q987.860595703125 78.32574462890625 1026.8349914550781 136.7745361328125Q1065.8093872070312 195.22332763671875 1079.9302978515625 275.1116638183594Q1094.0512084960938 355 1094.0512084960938 450H1108.6002807617188V0Z" transform="translate(10.61175 36.0125) scale(.0145 -.0145)" />
      <g className="brand-star-cluster">
        <path d="M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z" transform="translate(29.38825 20) scale(.04296875)" />
        <path className="brand-star-glint" d="M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z" transform="translate(29.38825 20) scale(.04296875)" />
      </g>
    </svg>
  );
}

function SignalImage({ src, alt, className = "", loading = "lazy" }) {
  const [active, setActive] = useState(false);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const frameRef = useRef(null);
  const warpUnavailableRef = useRef(false);

  useEffect(() => {
    warpUnavailableRef.current = false;
    sourceCanvasRef.current = null;

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [src]);

  function objectPositionValue(token, fallback = 50) {
    if (!token) return fallback;
    if (token.endsWith("%")) return Number.parseFloat(token);
    if (token === "left" || token === "top") return 0;
    if (token === "right" || token === "bottom") return 100;
    return token === "center" ? 50 : fallback;
  }

  function drawWarp(localX, localY, displayWidth, displayHeight) {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (
      warpUnavailableRef.current
      || !image?.complete
      || !image.naturalWidth
      || !canvas
      || displayWidth <= 0
      || displayHeight <= 0
    ) return;

    const density = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(displayWidth * density));
    const height = Math.max(1, Math.round(displayHeight * density));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      sourceCanvasRef.current = null;
    }

    try {
      let sourceCanvas = sourceCanvasRef.current;
      if (!sourceCanvas) {
        sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
        const [positionX, positionY] = window.getComputedStyle(image).objectPosition.split(/\s+/);
        const xRatio = objectPositionValue(positionX) / 100;
        const yRatio = objectPositionValue(positionY, objectPositionValue(positionX)) / 100;
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const renderedWidth = image.naturalWidth * scale;
        const renderedHeight = image.naturalHeight * scale;
        sourceContext.drawImage(
          image,
          (width - renderedWidth) * xRatio,
          (height - renderedHeight) * yRatio,
          renderedWidth,
          renderedHeight,
        );
        sourceCanvasRef.current = sourceCanvas;
      }

      const context = canvas.getContext("2d", { willReadFrequently: true });
      const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
      const centerX = Math.round(localX * density);
      const centerY = Math.round(localY * density);
      const radius = Math.round(Math.max(44, Math.min(96, Math.min(displayWidth, displayHeight) * 0.16)) * density);
      const left = Math.max(0, centerX - radius);
      const top = Math.max(0, centerY - radius);
      const right = Math.min(width, centerX + radius);
      const bottom = Math.min(height, centerY + radius);
      const regionWidth = right - left;
      const regionHeight = bottom - top;
      if (regionWidth <= 0 || regionHeight <= 0) return;

      const sourcePixels = sourceContext.getImageData(left, top, regionWidth, regionHeight);
      const warpedPixels = context.createImageData(regionWidth, regionHeight);
      const edgeWidth = Math.max(4, 9 * density);

      for (let y = 0; y < regionHeight; y += 1) {
        for (let x = 0; x < regionWidth; x += 1) {
          const offsetX = left + x - centerX;
          const offsetY = top + y - centerY;
          const distance = Math.hypot(offsetX, offsetY);
          if (distance >= radius) continue;

          const falloff = 1 - distance / radius;
          const angle = Math.atan2(offsetY, offsetX) + 1.22 * falloff * falloff;
          const pulledDistance = distance * (1 - 0.13 * falloff);
          const sampleX = Math.round(centerX + Math.cos(angle) * pulledDistance) - left;
          const sampleY = Math.round(centerY + Math.sin(angle) * pulledDistance) - top;
          if (sampleX < 0 || sampleY < 0 || sampleX >= regionWidth || sampleY >= regionHeight) continue;

          const sourceIndex = (sampleY * regionWidth + sampleX) * 4;
          const targetIndex = (y * regionWidth + x) * 4;
          const edgeAlpha = Math.min(1, (radius - distance) / edgeWidth);
          warpedPixels.data[targetIndex] = sourcePixels.data[sourceIndex];
          warpedPixels.data[targetIndex + 1] = sourcePixels.data[sourceIndex + 1];
          warpedPixels.data[targetIndex + 2] = sourcePixels.data[sourceIndex + 2];
          warpedPixels.data[targetIndex + 3] = sourcePixels.data[sourceIndex + 3] * edgeAlpha;
        }
      }

      context.clearRect(0, 0, width, height);
      context.putImageData(warpedPixels, left, top);
    } catch {
      // Cross-origin generated media can block pixel reads. Keep the image usable.
      warpUnavailableRef.current = true;
      setActive(false);
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function moveSignal(event) {
    setActive(true);
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    event.currentTarget.style.setProperty("--signal-x", `${((localX / rect.width) * 100).toFixed(2)}%`);
    event.currentTarget.style.setProperty("--signal-y", `${((localY / rect.height) * 100).toFixed(2)}%`);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => drawWarp(localX, localY, rect.width, rect.height));
  }

  function endSignal() {
    setActive(false);
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <span
      className={`signal-image ${active ? "is-signal-active" : ""} ${className}`}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={endSignal}
      onPointerMove={moveSignal}
    >
      <img ref={imageRef} className="signal-image-base" src={src} alt={alt} loading={loading} onLoad={() => { sourceCanvasRef.current = null; }} />
      <canvas ref={canvasRef} className="signal-image-warp" aria-hidden="true" />
    </span>
  );
}

function AuthPanel({ session, account, onAuthenticated, onSignOut }) {
  const { formatCents, t } = useLanguage();
  const [mode, setMode] = useState("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function requestVerificationCode(targetEmail) {
    const response = await authClient.sendVerificationEmail({
      email: targetEmail,
      callbackURL: `${window.location.origin}/account`,
    });
    if (response?.error) throw new Error(response.error.message ?? t("The verification code could not be sent."));
  }

  async function enterVerification(targetEmail, requestCode = true) {
    const normalizedEmail = targetEmail.trim().toLowerCase();
    setVerificationEmail(normalizedEmail);
    setVerificationCode("");
    setMode("verify");
    setError("");
    setNotice(requestCode ? t("Sending a fresh verification code…") : t("Enter the verification code from your email."));

    if (!requestCode) return;
    try {
      await requestVerificationCode(normalizedEmail);
      setNotice(t("A verification code was sent to {email}. It expires in 15 minutes.", { email: normalizedEmail }));
    } catch {
      setNotice(t("Your account was created. Request a new code below to finish verification."));
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!authClient) {
      setError(t("Account access is not configured for this environment."));
      return;
    }

    const normalizedName = normalizeFullName(name);
    if (mode === "sign-up" && !isFullName(normalizedName)) {
      setError(t("Enter your first and last name."));
      return;
    }

    if (mode === "sign-up" && password.length < 8) {
      setError(t("Use at least 8 characters for your password."));
      return;
    }

    if (mode === "sign-up" && password !== confirmPassword) {
      setError(t("The passwords do not match."));
      return;
    }

    setBusy(true);
    try {
      const response = mode === "sign-up"
        ? await authClient.signUp.email({ name: normalizedName, email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });

      if (response?.error) throw new Error(response.error.message ?? t("Authentication failed."));
      if (response?.data?.user && response.data.user.emailVerified !== true) {
        setPassword("");
        setConfirmPassword("");
        await enterVerification(response.data.user.email || email, true);
        return;
      }
      await onAuthenticated();
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : t("Authentication failed.");
      if (/security requirements|at least 8|too short/i.test(message)) {
        setError(t("Use at least 8 characters for your password."));
      } else if (/already exists|already registered/i.test(message)) {
        setError(t("An account with this email already exists. Sign in instead."));
      } else if (/verify|verification|not verified/i.test(message) && email.trim()) {
        await enterVerification(email, true);
      } else {
        setError(localizeError(message, t));
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setError(t("Enter the six-digit code from your email."));
      return;
    }

    setBusy(true);
    try {
      const response = await authClient.emailOtp.verifyEmail({
        email: verificationEmail,
        otp: verificationCode.trim(),
      });
      if (response?.error) throw new Error(response.error.message ?? t("The verification code was not accepted."));
      setNotice(t("Email verified. Connecting your private account…"));
      await onAuthenticated();
    } catch (verificationError) {
      const message = verificationError instanceof Error
        ? verificationError.message
        : t("The verification code was not accepted.");
      setError(/expired/i.test(message) ? t("That code expired. Request a new one below.") : localizeError(message, t));
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestVerificationCode(verificationEmail);
      setNotice(t("A new code was sent to {email}. It expires in 15 minutes.", { email: verificationEmail }));
    } catch (verificationError) {
      setError(localizeError(verificationError instanceof Error ? verificationError.message : t("The code could not be sent."), t));
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (response?.error) throw new Error(response.error.message ?? t("The reset email could not be sent."));
      setNotice(t("If this email has a Lmiere account, a password-reset link is on the way. The link expires in 15 minutes."));
    } catch {
      setNotice(t("If this email has a Lmiere account, a password-reset link is on the way. The link expires in 15 minutes."));
    } finally {
      setBusy(false);
    }
  }

  if (session?.user) {
    return (
      <div className="panel-content sign-in-content account-content">
        <UserCircle size={36} weight="light" />
        <p className="panel-kicker">{t("Private account connected")}</p>
        <h2>{session.user.name || t("Lmiere member")}</h2>
        <p>{session.user.email}</p>
        <div className="account-balance">
          <span>{t("Available balance")}</span>
          <strong>{formatCents(account?.availableCents)}</strong>
          <small>{formatCents(account?.reservedCents)} {t("reserved in active runs")}</small>
        </div>
        <button className="panel-action" type="button" onClick={onSignOut}>
          {t("Sign out")} <SignOut size={17} />
        </button>
        <small>{t("Every account has its own wallet, archive, and generation history.")}</small>
      </div>
    );
  }

  if (mode === "verify") {
    return (
      <div className="panel-content sign-in-content verification-content">
        <ShieldCheck size={36} weight="light" />
        <p className="panel-kicker">{t("Confirm your email")}</p>
        <h2>{t("One code. Your account stays yours.")}</h2>
        <p>{t("We only open a wallet after the address belongs to you.")}</p>

        <form className="auth-form" onSubmit={verifyEmail}>
          <label>
            <span>{t("Six-digit code")}</span>
            <input
              className="verification-code-input"
              type="text"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
          </label>
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="panel-action" type="submit" disabled={busy || verificationCode.length !== 6}>
            {busy ? <><CircleNotch className="spin" size={17} /> {t("Verifying")}</> : <><Check size={17} /> {t("Verify email")}</>}
          </button>
        </form>

        <button className="auth-mode-button" type="button" onClick={resendVerification} disabled={busy}>
          {t("Send a new code")}
        </button>
        <button
          className="auth-mode-button auth-back-button"
          type="button"
          onClick={() => {
            setMode("sign-in");
            setVerificationCode("");
            setError("");
            setNotice("");
          }}
        >
          {t("Use a different email")}
        </button>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="panel-content sign-in-content verification-content">
        <LockKey size={36} weight="light" />
        <p className="panel-kicker">{t("Recover account")}</p>
        <h2>{t("Reset the key. Keep the archive.")}</h2>
        <p>{t("We will send a short-lived reset link to the address attached to your account.")}</p>
        <form className="auth-form" onSubmit={requestPasswordReset}>
          <label>
            <span>{t("Email")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </label>
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="panel-action" type="submit" disabled={busy || !email.trim()}>
            {busy ? <><CircleNotch className="spin" size={17} /> {t("Sending")}</> : <>{t("Send reset link")} <ArrowRight size={17} /></>}
          </button>
        </form>
        <button
          className="auth-mode-button"
          type="button"
          onClick={() => {
            setMode("sign-in");
            setError("");
            setNotice("");
          }}
        >
          {t("Return to sign in")}
        </button>
      </div>
    );
  }

  return (
      <div className="panel-content sign-in-content">
        <UserCircle size={36} weight="light" />
        <p className="panel-kicker">{t("Private account access")}</p>
        <h2>{t(mode === "sign-up" ? "Create your field identity." : "Return to your archive.")}</h2>
        <p>{t("Your generations, balance, and results stay attached to your account and never mix with another member’s archive.")}</p>

      <form className="auth-form" onSubmit={submit}>
        {mode === "sign-up" && (
          <label>
            <span>{t("Full name")}</span>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              autoCapitalize="words"
              placeholder={t("First and last name")}
              required
            />
            <small className="auth-hint">{t("Enter your first and last name.")}</small>
          </label>
        )}
        <label>
          <span>{t("Email")}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          <span>{t("Password")}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          {mode === "sign-up" && <small className="auth-hint">{t("Use 8 or more characters.")}</small>}
        </label>
        {mode === "sign-up" && (
          <label>
            <span>{t("Confirm password")}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <button className="panel-action" type="submit" disabled={busy || !isAuthConfigured}>
          {busy ? <><CircleNotch className="spin" size={17} /> {t("Connecting")}</> : (
            <>{t(mode === "sign-up" ? "Create account" : "Sign in")} <ArrowRight size={17} /></>
          )}
        </button>
      </form>

      <button
        className="auth-mode-button"
        type="button"
        onClick={() => {
          setMode((value) => value === "sign-in" ? "sign-up" : "sign-in");
          setConfirmPassword("");
          setError("");
          setNotice("");
        }}
      >
        {t(mode === "sign-in" ? "First visit? Create an account" : "Already registered? Sign in")}
      </button>
      {mode === "sign-in" && (
        <button
          className="auth-mode-button auth-back-button"
          type="button"
          onClick={() => {
            setMode("forgot");
            setError("");
            setNotice("");
          }}
        >
          {t("Forgot your password?")}
        </button>
      )}
      <small>{t("Secure sign-in protects your private archive and available balance.")}</small>
    </div>
  );
}

function ResultMedia({ generation, interactive = false }) {
  const { t } = useLanguage();
  if (!generation?.resultUrl) return null;
  if (generation.resultContentType?.startsWith("video/")) {
    return <video src={generation.resultUrl} controls playsInline autoPlay loop />;
  }
  if (interactive) {
    return <SignalImage src={generation.resultUrl} alt={generation.prompt || t("Generated Lmiere result")} />;
  }
  return <img src={generation.resultUrl} alt={generation.prompt || t("Generated Lmiere result")} />;
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
  const { formatCents, formatDate, t } = useLanguage();
  if (!panel) return null;
  const panelTitle = panel === "Sign in" ? "Account access" : panel;

  return (
    <div className="panel-scrim" role="presentation" onMouseDown={onClose}>
      <aside
        className="side-panel"
        aria-label={`${t(panelTitle)} ${t("panel")}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <span>{t(panelTitle)}</span>
          <button className="panel-close" type="button" onClick={onClose} aria-label={t("Close panel")}>
            <X size={18} weight="light" />
          </button>
        </div>

        {panel === "Archive" && (
          <div className="panel-content">
            <p className="panel-kicker">{t("Recovered generations")} / {String(runs.length).padStart(2, "0")}</p>
            {!session && (
              <>
                <p className="archive-empty">{t("Sign in to recover your private generation history.")}</p>
                <button className="panel-action" type="button" onClick={() => onOpenPanel("Sign in")}>
                  {t("Sign in to archive")} <ArrowRight size={17} />
                </button>
              </>
            )}
            {session && runs.length === 0 && <p className="archive-empty">{t("No runs yet. The archive is waiting.")}</p>}
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
                      <small>{formatDate(run.createdAt)} · {t(outcome.label)} · {formatStatus(run.status, t)}</small>
                    </span>
                    <span>{formatCents(run.chargeCents)}</span>
                  </button>
                );
              })}
            </div>
            {session && (
              <button className="panel-action" type="button" onClick={() => onNavigate("/archive")}>
                {t("Open full archive")} <ArrowRight size={17} />
              </button>
            )}
          </div>
        )}

        {panel === "How it works" && (
          <div className="panel-content method-panel">
            <p className="panel-kicker">{t("Three decisions. Nothing else.")}</p>
            <ol>
              <li><span>01</span><strong>{t("Describe it")}</strong><p>{t("Write what you want in ordinary language.")}</p></li>
              <li><span>02</span><strong>{t("Choose the outcome")}</strong><p>{t("Pick speed, motion, or maximum quality.")}</p></li>
              <li><span>03</span><strong>{t("Approve the price")}</strong><p>{t("See the exact cost before anything runs.")}</p></li>
            </ol>
            <button className="panel-action" type="button" onClick={() => onOpenStudio()}>
              {t("Enter the studio")} <ArrowRight size={17} />
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
            <p className="panel-kicker">{t("Run")} {result.id} / {formatStatus(result.status, t)}</p>
            <ResultMedia generation={result} />
            <p className="ai-provenance"><Sparkle size={12} weight="fill" /> {t("AI-generated media")}</p>
            <div className="result-panel-meta">
              <span>{outcomeById(result.outcome).signal}</span>
              <span>{t(outcomeById(result.outcome).label)}</span>
              <span>{formatCents(result.chargeCents)}</span>
            </div>
            <a className="panel-action" href={result.resultUrl} download target="_blank" rel="noreferrer">
              {t("Save result")} <DownloadSimple size={17} />
            </a>
            <button className="panel-action" type="button" onClick={() => onNavigate(`/runs/${encodeURIComponent(result.id)}`)}>
              {t("Open full record")} <ArrowUpRight size={17} />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function LandingScreen({ onEnterStudio, onOpenPanel, onNavigate, session }) {
  const { formatPrice, language, t } = useLanguage();
  const rootRef = useRef(null);
  const motionRef = useRef(null);
  const activeChapterRef = useRef("apparatus");
  const transitionRef = useRef(false);
  const [activeChapter, setActiveChapter] = useState("apparatus");

  const activeChapterIndex = LANDING_CHAPTERS.findIndex((chapter) => chapter.id === activeChapter);
  const previousChapter = LANDING_CHAPTERS[activeChapterIndex - 1];
  const nextChapter = LANDING_CHAPTERS[activeChapterIndex + 1];

  const selectChapter = useCallback((chapterId) => {
    const currentId = activeChapterRef.current;
    const currentIndex = LANDING_CHAPTERS.findIndex((chapter) => chapter.id === currentId);
    const targetIndex = LANDING_CHAPTERS.findIndex((chapter) => chapter.id === chapterId);
    if (targetIndex < 0 || chapterId === currentId || transitionRef.current) return;

    const commit = () => {
      activeChapterRef.current = chapterId;
      setActiveChapter(chapterId);
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transition = motionRef.current;

    if (!transition || reducedMotion) {
      commit();
      return;
    }

    transitionRef.current = true;
    transition(rootRef.current, currentId, chapterId, targetIndex > currentIndex ? 1 : -1, commit)
      .catch(commit)
      .finally(() => {
        transitionRef.current = false;
      });
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    import("./motion.js")
      .then(({ mountLandingMotion, transitionLandingChapter }) => {
        if (!disposed) {
          motionRef.current = transitionLandingChapter;
          cleanup = mountLandingMotion(rootRef.current);
        }
      })
      .catch(() => {
        // The complete static frame remains usable if the optional motion chunk fails.
      });

    return () => {
      disposed = true;
      motionRef.current = null;
      cleanup();
    };
  }, []);

  useEffect(() => {
    function onChapterKeydown(event) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (event.key === "ArrowLeft" && previousChapter) selectChapter(previousChapter.id);
      if (event.key === "ArrowRight" && nextChapter) selectChapter(nextChapter.id);
      if (event.key === "Escape" && activeChapter !== "apparatus") selectChapter("apparatus");
    }

    window.addEventListener("keydown", onChapterKeydown);
    return () => window.removeEventListener("keydown", onChapterKeydown);
  }, [activeChapter, nextChapter, previousChapter, selectChapter]);

  return (
    <main className="landing-screen" ref={rootRef} data-active-chapter={activeChapter}>
      <header className="landing-header landing-stage-header">
        <button className="landing-brand" type="button" aria-label="Lmiere home" onClick={() => selectChapter("apparatus")}>
          <BrandMark />
          <span>Lmiere<br />{t("Field manual")}</span>
        </button>

        <nav className="chapter-stepper" aria-label={t("Chapter controls")}>
          <button type="button" disabled={!previousChapter} onClick={() => previousChapter && selectChapter(previousChapter.id)}>
            <ArrowLeft size={13} weight="light" />
            <span>{t("Previous")}</span>
          </button>
          <p aria-live="polite">
            <span>{t("Chapter")} {LANDING_CHAPTERS[activeChapterIndex]?.numeral}</span>
            <strong>{t(LANDING_CHAPTERS[activeChapterIndex]?.label || "Apparatus")}</strong>
          </p>
          <button type="button" disabled={!nextChapter} onClick={() => nextChapter && selectChapter(nextChapter.id)}>
            <span>{t("Next")}</span>
            <ArrowRight size={13} weight="light" />
          </button>
        </nav>

        <nav className="landing-nav" aria-label="Landing navigation">
          <button type="button" onClick={() => onNavigate("/archive")}>{t("Archive")}</button>
          <button className="landing-nav-account" type="button" onClick={() => onOpenPanel("Sign in")}>
            <span className="landing-account-full">{session?.user?.name || t("Sign in")}</span>
            <span className="landing-account-short">{t("Account")}</span>
          </button>
          <LanguageSwitch className="language-switch-paper" />
          <button className="landing-nav-cta" type="button" onClick={onEnterStudio}>{t("Open studio")}</button>
        </nav>
      </header>

      <div className="landing-rule" aria-hidden="true" />

      <nav className="field-index" aria-label={t("Field index")}>
        <ol>
          {LANDING_CHAPTERS.map((chapter) => (
            <li key={chapter.id}>
              <button
                type="button"
                aria-label={`${chapter.numeral}. ${t(chapter.label)}`}
                aria-current={activeChapter === chapter.id ? "page" : undefined}
                onClick={() => selectChapter(chapter.id)}
              >
                <span>{chapter.numeral}</span>
                <small>{t(chapter.label)}</small>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className={`landing-intro field-chapter${activeChapter === "apparatus" ? " is-active" : ""}`} id="apparatus" data-field-chapter aria-label="Lmiere field manual cover" aria-hidden={activeChapter !== "apparatus"} inert={activeChapter !== "apparatus"}>
        <section className="landing-hero">
          <SignalImage
            className="landing-machine"
            src="/assets/lmiere-field-machine.webp"
            alt="A meteorite fused with a precision camera mechanism, drawn like a scientific blueprint"
            loading="eager"
          />

          <div className="landing-copy">
            <p className="landing-kicker">// {t("Field apparatus 001")}</p>
            <h1>Lmiere</h1>
            <p className="landing-thesis">{language === "fr" ? <>Une machine pour créer les images et les mouvements qui <em>n’existent pas encore</em>.</> : <>A machine for making images and motion that have <em>not yet</em> happened.</>}</p>
            <p className="landing-summary">{t("Describe the unseen. Choose the outcome. Know the exact price before the machine begins.")}</p>

            <div className="landing-actions">
              <button className="primary-paper-button" type="button" onClick={onEnterStudio}>
                {t("Enter the machine")} <ArrowRight size={21} weight="light" />
              </button>
              <button className="text-paper-button" type="button" onClick={() => selectChapter("mechanism")}>
                {t("How it works")} <ArrowRight className="north-east-arrow" size={14} />
              </button>
            </div>
          </div>

          <div className="landing-annotation landing-annotation-a" aria-hidden="true">
            <span>A.</span><p>{t("Latent image chamber")}</p>
          </div>
          <div className="landing-annotation landing-annotation-b" aria-hidden="true">
            <span>B.</span><p>{t("Interpretation lens")}</p>
          </div>
        </section>

        <footer className="landing-footer">
          <div><span>01</span><strong>{t("Describe the unseen")}</strong><small>{t("Use ordinary language")}</small></div>
          <div><span>02</span><strong>{t("Choose an outcome")}</strong><small>{t("Image, motion, or detail")}</small></div>
          <div><span>03</span><strong>{t("Approve the exact cost")}</strong><small>{t("No subscription required")}</small></div>
          <p>{t("Recovered")} 2026<br />Lmiere Labs</p>
        </footer>

        <p className="landing-edge-note">{t("Open field test // Europe · Morocco · United States")}</p>
      </section>

      <section className={`landing-section landing-outcomes-section field-chapter${activeChapter === "outcomes" ? " is-active" : ""}`} id="outcomes" data-field-chapter aria-hidden={activeChapter !== "outcomes"} inert={activeChapter !== "outcomes"}>
        <div className="chapter-coordinate" aria-hidden="true"><span>II</span><small>{t("Outcomes")}</small></div>
        <header className="manual-section-heading">
          <div>
            <p className="landing-kicker">// {t("Outcome catalog 001–003")}</p>
            <h2>{t("Three routes.")}<br /><em>{t("One visible price.")}</em></h2>
          </div>
          <p>{t("Choose what you want to make—not which model, checkpoint, or provider to operate. Lmiere handles the machinery behind the page.")}</p>
        </header>

        <div className="landing-outcome-grid">
          {OUTCOMES.map((outcome, index) => (
            <article className="landing-outcome-card" key={outcome.id}>
              <span>0{index + 1} / {outcome.signal}</span>
              <h3>{t(outcome.studioLabel)}</h3>
              <p>{t(outcome.description)}</p>
              <div><strong>{formatPrice(outcome.price)}</strong><small>{outcome.eta}<br />{t("Charged on completion")}</small></div>
              <button type="button" onClick={onEnterStudio}>{t("Choose route")} <ArrowRight size={16} /></button>
            </article>
          ))}
        </div>
      </section>

      <section className={`landing-section landing-method-section field-chapter${activeChapter === "mechanism" ? " is-active" : ""}`} id="mechanism" data-field-chapter aria-hidden={activeChapter !== "mechanism"} inert={activeChapter !== "mechanism"}>
        <div className="chapter-coordinate" aria-hidden="true"><span>III</span><small>{t("Mechanism")}</small></div>
        <header className="manual-section-heading method-heading">
          <div>
            <p className="landing-kicker">// {t("Operating procedure")}</p>
            <h2>{t("Power without")}<br /><em>{t("the control room.")}</em></h2>
          </div>
          <p>{t("No subscription maze. No model directory. No shared team balance. The essential decisions stay visible and the infrastructure disappears.")}</p>
        </header>

        <div className="landing-procedure" id="landing-method">
          <ol>
            <li><span>01</span><strong>{t("Describe the unseen")}</strong><p>{t("Write an ordinary sentence. Precision is welcome; jargon is not required.")}</p></li>
            <li><span>02</span><strong>{t("Choose the outcome")}</strong><p>{t("Pick speed, motion, or maximum detail and see its price immediately.")}</p></li>
            <li><span>03</span><strong>{t("Approve and recover")}</strong><p>{t("Begin the run, watch its status, and collect the result in your archive.")}</p></li>
          </ol>
          <div>
            <p className="landing-kicker">{t("Field note / 04")}</p>
            <blockquote>“{t("Your prompt travels. Engines interpret. Images emerge.")}”</blockquote>
            <button className="primary-paper-button" type="button" onClick={onEnterStudio}>{t("Open studio")} <ArrowRight size={21} /></button>
          </div>
        </div>
      </section>

      <section className={`landing-section landing-records-section field-chapter${activeChapter === "transmission" ? " is-active" : ""}`} id="transmission" data-field-chapter aria-labelledby="field-records-title" aria-hidden={activeChapter !== "transmission"} inert={activeChapter !== "transmission"}>
        <div className="chapter-coordinate" aria-hidden="true"><span>IV</span><small>{t("Transmission")}</small></div>
        <header className="manual-section-heading records-heading">
          <div>
            <p className="landing-kicker">// {t("Recovered outputs")}</p>
            <h2 id="field-records-title">{t("Field records from")}<br /><em>{t("the unseen.")}</em></h2>
          </div>
          <p>{t("Every completed run returns as a private record: the result, the prompt that made it, the route used, and the exact amount charged.")}</p>
        </header>

        <div className="transmission-field">
          <figure className="field-record field-record-phosphor">
            <AsciiSignal
              src="/assets/lmiere-specimen-awake.webp"
              alt={t("The Lmiere specimen rendered as a living green phosphor character field")}
            />
            <figcaption><span>Specimen LM–088</span><strong>{t("Phosphor bloom")}</strong><small>{t("Highest quality")} / {formatPrice(0.76)}</small></figcaption>
          </figure>
          <div className="transmission-evidence">
            <figure className="field-record field-record-reel">
              <video autoPlay muted loop playsInline preload="metadata" poster="/assets/lmiere-specimen-awake.webp" aria-label={t("A generated signal moving through the Lmiere field")}>
                <source src="/assets/lmiere-signal-ripple.mp4" type="video/mp4" />
              </video>
              <figcaption><span>Transmission 004</span><strong>{t("The network, awake")}</strong><small>{t("Cinematic motion")} / LOOP</small></figcaption>
            </figure>
            <figure className="field-record field-record-cabin">
              <SignalImage src="/assets/lmiere-result-cabin.webp" alt="A glass cabin glowing in a wet forest, shown as a completed generation" />
              <figcaption><span>Record LM–029</span><strong>{t("A memory of rain inside a glass house")}</strong><small>{t("Cinematic motion")} / {formatPrice(0.42)}</small></figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className={`landing-section landing-ownership-section field-chapter${activeChapter === "ownership" ? " is-active" : ""}`} id="ownership" data-field-chapter aria-hidden={activeChapter !== "ownership"} inert={activeChapter !== "ownership"}>
        <div className="chapter-coordinate" aria-hidden="true"><span>V</span><small>{t("Ownership")}</small></div>
        <SignalImage
          className="ownership-vision"
          src="/assets/lmiere-phosphor-source.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="ownership-grain" aria-hidden="true" />
        <header className="ownership-heading" data-chapter-reveal>
          <div>
            <LockKey size={28} weight="light" />
            <p className="landing-kicker">// {t("Private by account")}</p>
          </div>
          <h2>{t("One balance. Yours alone.")}</h2>
          <div className="ownership-manifesto">
            <p>{t("Your balance, runs, and archive are isolated from every other member.")}</p>
            <p>{t("Every price is visible before the machine begins. Every completed result returns to your private record.")}</p>
            <p>{t("The infrastructure stays out of sight. Your work does not.")}</p>
          </div>
        </header>

        <div className="ownership-evidence" data-chapter-reveal>
          <span><ShieldCheck size={15} weight="light" />{t("Private by account")}</span>
          <span><Receipt size={15} weight="light" />{t("Exact cost first")}</span>
          <span><LockKey size={15} weight="light" />{t("Failed runs release the charge")}</span>
        </div>
      </section>

      <section className={`landing-closing-section field-chapter${activeChapter === "studio-entry" ? " is-active" : ""}`} id="studio-entry" data-field-chapter aria-hidden={activeChapter !== "studio-entry"} inert={activeChapter !== "studio-entry"}>
        <div className="chapter-coordinate chapter-coordinate-closing" aria-hidden="true"><span>VI</span><small>{t("Studio")}</small></div>
        <SignalImage className="landing-closing-image" src="/assets/lmiere-specimen-idle.webp" alt="A dormant neural specimen fading from archival paper into a dark network" />
        <div>
          <p className="landing-kicker">// {t("Machine standing by")}</p>
          <h2>{t("Make the thing")}<br />{t("you cannot find.")}</h2>
          <p>{t("Begin with an image for eight cents. Leave with a private record, not another dashboard to learn.")}</p>
          <button className="primary-paper-button" type="button" onClick={onEnterStudio}>{t("Enter the machine")} <ArrowRight size={21} /></button>
          <nav className="closing-links" aria-label={t("Company links")}>
            <button type="button" onClick={() => onNavigate("/privacy")}>{t("Privacy")}</button>
            <button type="button" onClick={() => onNavigate("/terms")}>{t("Terms")}</button>
            <span>© 2026 Lmiere Labs</span>
          </nav>
        </div>
      </section>
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
  const { formatCents, formatPrice, t } = useLanguage();
  const [selectedId, setSelectedId] = useState(initialDraft?.outcome ?? "fast");
  const [prompt, setPrompt] = useState(initialDraft?.prompt ?? "");
  const [styleId, setStyleId] = useState("natural");
  const [aspectRatio, setAspectRatio] = useState(initialDraft?.outcome === "cinematic" ? "16:9" : "4:3");
  const [reference, setReference] = useState(null);
  const [referenceUrlDraft, setReferenceUrlDraft] = useState("");
  const [showReferenceUrl, setShowReferenceUrl] = useState(false);
  const [referenceStrength, setReferenceStrength] = useState(0.78);
  const [dragActive, setDragActive] = useState(false);
  const [beamActive, setBeamActive] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [generation, setGeneration] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const promptRef = useRef(null);
  const beamTimerRef = useRef(null);

  const outcome = useMemo(() => outcomeById(selectedId), [selectedId]);
  const creationMode = selectedId === "cinematic" ? "video" : "image";
  const isRunning = ["uploading", "submitting", "generating"].includes(phase);
  const availableCents = account?.availableCents ?? 0;
  const needsCredit = Boolean(session?.user) && availableCents < outcome.priceCents;
  const recentRuns = runs.slice(0, 6);

  const pulseBeam = useCallback(() => {
    window.clearTimeout(beamTimerRef.current);
    setBeamActive(true);
    beamTimerRef.current = window.setTimeout(() => setBeamActive(false), 2800);
  }, []);

  useEffect(() => () => window.clearTimeout(beamTimerRef.current), []);

  useEffect(() => {
    if (!session?.user || phase !== "idle" || generation) return;
    const active = runs.find((run) => ["reserved", "queued", "in_queue", "in_progress"].includes(run.status));
    if (!active) return;

    setSelectedId(active.outcome);
    setPrompt(active.prompt);
    setGeneration(active);
    setProgress(Math.max(active.progress ?? 0, 5));
    setPhase("generating");
  }, [generation, phase, runs, session?.user]);

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
          setError(localizeError(next.error || t("The run did not complete. No credits were charged."), t));
          await onAccountChanged();
          return;
        }
        timer = window.setTimeout(poll, 2200);
      } catch (pollError) {
        if (cancelled) return;
        setError(localizeError(pollError instanceof Error ? pollError.message : t("Could not read the run status."), t));
        timer = window.setTimeout(poll, 4000);
      }
    }

    timer = window.setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [generation?.id, onAccountChanged, phase, t]);

  async function beginRun() {
    if (!prompt.trim()) {
      setError(t("Describe what the network should create."));
      return;
    }
    if (!session?.user) {
      setError(t("Sign in to connect a private wallet before beginning a run."));
      onOpenPanel("Sign in");
      return;
    }
    if (needsCredit) {
      setError(t("Add credit to your private wallet before beginning this run."));
      onNavigate("/account");
      return;
    }

    setError("");
    setGeneration(null);
    setProgress(2);

    try {
      let referenceUrl = reference?.url || "";
      if (reference?.dataUrl && !referenceUrl) {
        setPhase("uploading");
        const uploaded = await apiRequest("/api/references", {
          method: "POST",
          body: JSON.stringify({ dataUrl: reference.dataUrl, name: reference.name }),
        });
        referenceUrl = uploaded.reference.url;
        setReference((current) => current ? { ...current, url: referenceUrl, status: "uploaded" } : current);
      }

      setPhase("submitting");
      const data = await apiRequest("/api/generations", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.trim(),
          outcome: selectedId,
          referenceUrl,
          style: styleId,
          aspectRatio,
          referenceStrength,
        }),
      });
      setGeneration(data.generation);
      setProgress(data.generation?.progress ?? 5);
      setPhase("generating");
      await onAccountChanged();
    } catch (runError) {
      setPhase("failed");
      setProgress(0);
      setError(localizeError(runError instanceof Error ? runError.message : t("The run could not begin."), t));
      await onAccountChanged();
    }
  }

  function newRun() {
    setPhase("idle");
    setGeneration(null);
    setProgress(0);
    setError("");
  }

  function chooseMode(mode) {
    setSelectedId(mode === "video" ? "cinematic" : reference ? "quality" : "fast");
    setAspectRatio(mode === "video" ? "16:9" : "4:3");
    setError("");
    newRun();
  }

  async function acceptReferenceFile(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(t("Use a JPEG, PNG, or WebP reference image."));
      return;
    }
    if (file.size > 2_750_000) {
      setError(t("Keep reference images below 2.75 MB."));
      return;
    }

    try {
      const dataUrl = await readReferenceFile(file);
      setReference({
        dataUrl,
        previewUrl: dataUrl,
        name: file.name,
        contentType: file.type,
        status: "ready",
      });
      if (creationMode === "image") setSelectedId("quality");
      setError("");
      setShowReferenceUrl(false);
      pulseBeam();
    } catch (fileError) {
      setError(localizeError(fileError instanceof Error ? fileError.message : t("Could not read that reference image."), t));
    }
  }

  function attachReferenceUrl() {
    try {
      const parsed = new URL(referenceUrlDraft.trim());
      if (parsed.protocol !== "https:") throw new Error();
      setReference({
        url: parsed.toString(),
        previewUrl: parsed.toString(),
        name: parsed.pathname.split("/").filter(Boolean).at(-1) || t("Linked reference"),
        status: "linked",
      });
      if (creationMode === "image") setSelectedId("quality");
      setReferenceUrlDraft("");
      setShowReferenceUrl(false);
      setError("");
      pulseBeam();
    } catch {
      setError(t("Paste a public HTTPS image link."));
    }
  }

  function clearReference() {
    setReference(null);
    setError("");
  }

  function applyRecipe(recipe) {
    setPrompt(t(recipe.prompt));
    setSelectedId(recipe.outcome);
    setStyleId(recipe.style);
    setAspectRatio(recipe.ratio);
    setError("");
    newRun();
    if (recipe.asksForReference && !reference) fileInputRef.current?.click();
    else promptRef.current?.focus();
    pulseBeam();
  }

  function reuseRun(run) {
    setPrompt(run.prompt || "");
    setSelectedId(run.outcome || "fast");
    setAspectRatio(run.outcome === "cinematic" ? "16:9" : "4:3");
    newRun();
    promptRef.current?.focus();
    pulseBeam();
  }

  function useResultAsReference(run, mode) {
    if (!run.resultUrl || run.resultContentType?.startsWith("video/")) return;
    setReference({
      url: run.resultUrl,
      previewUrl: run.resultUrl,
      name: `Lmiere ${run.id}`,
      contentType: run.resultContentType || "image/jpeg",
      status: "archive",
    });
    setSelectedId(mode === "video" ? "cinematic" : "quality");
    setAspectRatio(mode === "video" ? "16:9" : "4:3");
    setError("");
    newRun();
    pulseBeam();
  }

  function handleComposerPaste(event) {
    const file = [...(event.clipboardData?.items || [])]
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();
    if (!file) return;
    event.preventDefault();
    acceptReferenceFile(file);
  }

  function handlePromptKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!isRunning) beginRun();
    }
  }

  const result = phase === "complete" ? generation : null;

  return (
    <main className="studio-screen">
      <header className="studio-header">
        <button className="studio-brand" type="button" onClick={onReturn} aria-label={t("Return to the field manual")}>
          <BrandMark dark />
          <span><strong>Lmiere</strong><small>{t("Studio / Daily image machine")}</small></span>
        </button>

        <p className="studio-header-note">{t("Reference. Direct. Generate. Keep every result.")}</p>

        <nav className="studio-nav" aria-label="Studio navigation">
          <button type="button" onClick={() => onNavigate("/archive")}>{t("Archive")} / {String(runs.length).padStart(2, "0")}</button>
          <button type="button" onClick={() => onNavigate("/account")}>
            {t("Wallet")} <strong>{session ? formatCents(account?.availableCents) : t("Sign in")}</strong>
          </button>
          <LanguageSwitch className="language-switch-paper" />
          <button className="studio-exit" type="button" onClick={onReturn} aria-label={t("Return to landing page")}>
            <ArrowLeft size={16} /> {t("Manual")}
          </button>
        </nav>
      </header>

      <nav className="studio-mobile-nav" aria-label="Mobile studio navigation">
        <button type="button" aria-current="page">{t("Studio")}</button>
        <button type="button" onClick={() => onNavigate("/archive")}>{t("Archive")} / {String(runs.length).padStart(2, "0")}</button>
        <button type="button" onClick={() => onNavigate("/account")}>{t("Account")} {session ? formatCents(account?.availableCents) : ""}</button>
        <LanguageSwitch className="language-switch-paper" />
      </nav>

      <section className="studio-workspace" aria-label={t("Generation workspace")}>
        <div className="studio-controls">
          <header className="studio-desk-intro">
            <h1 id="studio-prompt-heading">{t("Create an image or video.")}</h1>
            <p>{t("Begin with words, add an image when it matters, and approve the exact price before anything runs.")}</p>
          </header>

          <div className="studio-mode-tabs" role="tablist" aria-label={t("Creation mode")}>
            <button type="button" role="tab" aria-selected={creationMode === "image"} onClick={() => chooseMode("image")} disabled={isRunning}>
              <ImageSquare size={17} /> {t("Image")}
            </button>
            <button type="button" role="tab" aria-selected={creationMode === "video"} onClick={() => chooseMode("video")} disabled={isRunning}>
              <FilmStrip size={17} /> {t("Video")}
            </button>
          </div>

          <BorderBeam
            className="studio-composer-beam"
            size="md"
            colorVariant="ocean"
            theme="light"
            staticColors
            strength={0.48}
            duration={2.6}
            borderRadius={0}
            active={beamActive || dragActive || ["uploading", "submitting"].includes(phase)}
          >
            <section
              className={`studio-composer ${dragActive ? "is-dragging" : ""}`}
              aria-labelledby="studio-prompt-heading"
              onFocusCapture={pulseBeam}
              onPaste={handleComposerPaste}
              onDragEnter={(event) => { event.preventDefault(); setDragActive(true); pulseBeam(); }}
              onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                acceptReferenceFile(event.dataTransfer.files?.[0]);
              }}
            >
              <div className="studio-reference-head">
                <div>
                  <span>{t("Reference")}</span>
                  <small>{creationMode === "video" ? t("Optional first frame") : t("Optional visual source")}</small>
                </div>
                <div className="studio-reference-actions">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isRunning}>
                    <UploadSimple size={15} /> {reference ? t("Replace") : t("Add image")}
                  </button>
                  <button type="button" onClick={() => setShowReferenceUrl((value) => !value)} disabled={isRunning} aria-expanded={showReferenceUrl}>
                    <LinkSimple size={15} /> {t("Image link")}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label={t("Choose reference image")}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    acceptReferenceFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  disabled={isRunning}
                />
              </div>

              {showReferenceUrl && (
                <div className="studio-reference-url">
                  <input
                    type="url"
                    aria-label={t("Reference image URL")}
                    value={referenceUrlDraft}
                    placeholder="https://…/reference.jpg"
                    onChange={(event) => setReferenceUrlDraft(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); attachReferenceUrl(); } }}
                  />
                  <button type="button" onClick={attachReferenceUrl}>{t("Attach")}</button>
                </div>
              )}

              {reference ? (
                <article className="studio-reference-card">
                  <img src={reference.previewUrl} alt={t("Selected generation reference")} />
                  <div>
                    <span>{creationMode === "video" ? t("First frame") : t("Visual reference")}</span>
                    <strong>{reference.name}</strong>
                    <small>{reference.status === "uploaded" ? t("Uploaded to the generation route") : t("Ready when you generate")}</small>
                  </div>
                  <button type="button" onClick={clearReference} disabled={isRunning} aria-label={t("Remove reference")}><Trash size={16} /></button>
                </article>
              ) : (
                <button className="studio-reference-empty" type="button" onClick={() => fileInputRef.current?.click()} disabled={isRunning}>
                  <Plus size={19} />
                  <span><strong>{t("Drop, paste, or choose an image")}</strong><small>{t("JPEG, PNG, or WebP · up to 2.75 MB")}</small></span>
                </button>
              )}

              <label className="studio-label" htmlFor="studio-prompt">{creationMode === "video" ? t("Describe the motion") : t("Describe the image")}</label>
              <textarea
                ref={promptRef}
                id="studio-prompt"
                rows={5}
                value={prompt}
                placeholder={creationMode === "video"
                  ? t("Describe what moves, how the camera behaves, and how the light changes…")
                  : t("Describe the subject, setting, light, material, and feeling…")}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setError("");
                  if (phase === "complete" || phase === "failed") newRun();
                }}
                onKeyDown={handlePromptKeyDown}
                disabled={isRunning}
              />
              <div className="studio-composer-help">
                <span>{t("Paste an image anywhere in this box")}</span>
                <span>{t("⌘ Enter to generate")}</span>
              </div>
            </section>
          </BorderBeam>

          <section className="studio-look-settings" aria-label={t("Visual direction")}>
            <div className="studio-setting-heading"><span>{t("Visual direction")}</span><MagicWand size={15} /></div>
            <div className="studio-style-chips">
              {STUDIO_STYLES.map((style) => (
                <button key={style.id} type="button" aria-pressed={styleId === style.id} onClick={() => setStyleId(style.id)} disabled={isRunning}>
                  {t(style.label)}
                </button>
              ))}
            </div>
          </section>

          <section className="studio-route-settings" aria-label={t("Generation settings")}>
            <div className="studio-setting-heading"><span>{t("Output settings")}</span><SlidersHorizontal size={15} /></div>
            <div className="studio-settings-grid">
              <fieldset>
                <legend>{t("Route")}</legend>
                <div className="studio-segmented">
                  {(creationMode === "video" ? OUTCOMES.filter((candidate) => candidate.id === "cinematic") : OUTCOMES.filter((candidate) => candidate.id !== "cinematic")).map((candidate) => (
                    <label key={candidate.id} className={selectedId === candidate.id ? "is-selected" : ""}>
                      <input
                        type="radio"
                        name="studio-outcome"
                        value={candidate.id}
                        checked={selectedId === candidate.id}
                        disabled={isRunning || (Boolean(reference) && candidate.id === "fast")}
                        onChange={() => { setSelectedId(candidate.id); setError(""); newRun(); }}
                      />
                      <span>{candidate.id === "fast" ? t("Draft") : candidate.id === "quality" ? t("Studio") : t("Cinematic")}</span>
                      <small>{formatPrice(candidate.price)} · {candidate.eta}</small>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>{reference && creationMode === "image" ? t("Frame") : t("Aspect ratio")}</legend>
                {reference && creationMode === "image" ? (
                  <div className="studio-source-ratio"><ImageSquare size={15} /> {t("Match reference")}</div>
                ) : (
                  <div className="studio-ratio-chips">
                    {STUDIO_RATIOS.map((ratio) => (
                      <button key={ratio} type="button" aria-pressed={aspectRatio === ratio} onClick={() => setAspectRatio(ratio)} disabled={isRunning}>{ratio}</button>
                    ))}
                  </div>
                )}
              </fieldset>
            </div>

            {reference && creationMode === "image" && (
              <label className="studio-strength-control">
                <span>{t("Change from reference")} <output>{Math.round(referenceStrength * 100)}%</output></span>
                <input
                  type="range"
                  min="55"
                  max="95"
                  step="1"
                  value={Math.round(referenceStrength * 100)}
                  onChange={(event) => setReferenceStrength(Number(event.target.value) / 100)}
                  disabled={isRunning}
                />
                <small><span>{t("Keep close")}</span><span>{t("Reimagine")}</span></small>
              </label>
            )}
          </section>

          {error && <p className="studio-error" role="alert">{error}</p>}

          <div className="studio-quote">
            <div className="studio-quote-copy">
              <span>{t("Exact cost")}</span>
              <strong>{formatPrice(outcome.price)}</strong>
              <small>{session ? t("{amount} available", { amount: formatCents(availableCents) }) : t("Sign in to connect your wallet")}</small>
            </div>
            <button
              className="studio-run-button"
              type="button"
              onClick={needsCredit && phase === "idle" ? () => onNavigate("/account") : phase === "complete" || phase === "failed" ? newRun : beginRun}
              disabled={isRunning}
            >
              {phase === "uploading" ? (
                <><CircleNotch className="spin" size={19} /> {t("Uploading reference")}</>
              ) : ["submitting", "generating"].includes(phase) ? (
                <><CircleNotch className="spin" size={19} /> {t("Running")} {progress}%</>
              ) : phase === "complete" || phase === "failed" ? (
                <>{t("New creation")} <ArrowRight size={20} /></>
              ) : needsCredit ? (
                <>{t("Add credit")}</>
              ) : (
                <>{t("Generate for {amount}", { amount: formatPrice(outcome.price) })} <ArrowRight size={20} /></>
              )}
            </button>
            <p className={`studio-wallet-note ${needsCredit ? "is-low" : ""}`}>
              <Wallet size={14} weight="light" />
              {t("Charged only on completion. Failed runs release the reservation.")}
            </p>
          </div>
        </div>

        <figure className={`studio-output ${isRunning ? "is-generating" : ""} ${phase === "complete" ? "is-complete" : ""}`}>
          <figcaption>
            <span><i /> {t("Output field")}</span>
            <small>{outcome.signal} / {generation?.id ?? t("AWAITING")}</small>
          </figcaption>
          <div className="studio-output-frame">
            {result ? <ResultMedia generation={result} /> : (
              <LatentField
                phase={phase}
                progress={progress}
                alt={t("The interpretation lens assembling while Lmiere waits for or processes a prompt")}
              />
            )}
            {isRunning && (
              <div className="studio-output-scan" aria-live="polite">
                <CircleNotch className="spin" size={23} /> {t("Interpreting prompt")}
              </div>
            )}
            {phase === "complete" && (
              <div className="studio-output-complete" aria-live="polite">
                <Check size={16} weight="bold" /> {t("Run complete")}
              </div>
            )}
            {phase === "complete" && (
              <span className="studio-output-provenance"><Sparkle size={11} weight="fill" /> {t("AI-generated media")}</span>
            )}
            {phase === "idle" && !result && (
              <div className="studio-output-empty-note">
                <span>{creationMode === "video" ? t("Motion field") : t("Image field")}</span>
                <strong>{t("Your result appears here.")}</strong>
                <small>{reference ? t("Reference connected") : t("Words or reference accepted")}</small>
              </div>
            )}
          </div>
          <div className="studio-progress-row">
            <span>{t(phase === "complete" ? "Stored in archive" : isRunning ? "Generating" : "Awaiting run")}</span>
            <span>{phase === "idle" || phase === "failed" ? "00" : progress}%</span>
          </div>
          <div className="studio-progress-track">
            <i style={{ "--studio-progress": (phase === "idle" || phase === "failed" ? 0 : progress) / 100 }} />
          </div>
          {phase === "complete" && (
            <button className="studio-result-button" type="button" onClick={() => onNavigate(`/runs/${encodeURIComponent(generation.id)}`)}>
              {t("Open result")} <ArrowRight size={17} />
            </button>
          )}
        </figure>
      </section>

      <section className="studio-lower-deck">
        <div className="studio-recipes">
          <header>
            <strong>{t("Useful recipes")}</strong>
            <small>{t("A recipe fills the right route and settings. You stay in control.")}</small>
          </header>
          <div className="studio-recipe-grid">
            {STUDIO_RECIPES.map((recipe) => (
              <button type="button" key={recipe.label} onClick={() => applyRecipe(recipe)} disabled={isRunning}>
                <strong>{t(recipe.label)}</strong>
                <small>{t(recipe.note)}</small>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="studio-recent">
          <header>
            <strong>{t("Recent work")}</strong>
            <button type="button" onClick={() => onNavigate("/archive")}>{t("Open all {count}", { count: runs.length })} <ArrowRight size={15} /></button>
          </header>
          {recentRuns.length ? (
            <div className="studio-recent-grid">
              {recentRuns.map((run) => (
                <article key={run.id}>
                  <div className="studio-recent-media">
                    {run.resultUrl ? <ResultMedia generation={run} /> : <div><CircleNotch className={!["failed", "cancelled"].includes(run.status) ? "spin" : ""} size={24} /><span>{t(formatStatus(run.status, t))}</span></div>}
                  </div>
                  <div className="studio-recent-copy">
                    <span>{formatDate(run.createdAt)} · {formatCents(run.chargeCents)}</span>
                    <strong>{run.prompt}</strong>
                  </div>
                  <div className="studio-recent-actions">
                    <button type="button" onClick={() => reuseRun(run)}>{t("Reuse")}</button>
                    {run.resultUrl && !run.resultContentType?.startsWith("video/") && (
                      <>
                        <button type="button" onClick={() => useResultAsReference(run, "image")}>{t("Transform")}</button>
                        <button type="button" onClick={() => useResultAsReference(run, "video")}>{t("Animate")}</button>
                      </>
                    )}
                    {run.resultUrl && <a href={run.resultUrl} target="_blank" rel="noreferrer" aria-label={t("Open result in a new tab")}><DownloadSimple size={14} /></a>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="studio-recent-empty">
              <ImageSquare size={24} />
              <p><strong>{t("Your first result will land here.")}</strong><span>{t("Every completed run stays attached to your account.")}</span></p>
            </div>
          )}
        </div>
      </section>

      <footer className="studio-footer">
        <p><span /> {t(isRunning ? "Live / Provider route active" : "Ready / Prompt route standing by")}</p>
        <p>{t(session ? "Private wallet connected" : "Wallet waiting for sign in")} / {t("Private archive / Account-isolated")}</p>
        <div><span>Build 1.1.0</span><strong>{t("Status / Nominal")}</strong></div>
      </footer>
    </main>
  );
}

function ProductHeader({ active, tone = "night", onNavigate, session, account, runs }) {
  const { formatCents, t } = useLanguage();
  return (
    <header className={`product-header product-header-${tone}`}>
      <button className="product-brand" type="button" onClick={() => onNavigate("/")} aria-label="Return to Lmiere home">
        <BrandMark dark={tone !== "paper"} />
        <span>Lmiere<br /><small>{t("Distributed image machine")}</small></span>
      </button>

      <div className="product-header-meta" aria-label="Page status">
        <span>{t("Field route")}<br /><strong>{t(active)}</strong></span>
        <span>{t("Archive")}<br /><strong>{String(runs.length).padStart(2, "0")} {t("records")}</strong></span>
      </div>

      <nav className="product-nav" aria-label="Product navigation">
        <button type="button" aria-current={active === "Studio" ? "page" : undefined} onClick={() => onNavigate("/studio")}>{t("Studio")}</button>
        <button type="button" aria-current={active === "Archive" ? "page" : undefined} onClick={() => onNavigate("/archive")}>{t("Archive")}</button>
        <button type="button" aria-current={active === "Account" ? "page" : undefined} onClick={() => onNavigate("/account")}>
          {t("Wallet")} <strong>{session ? formatCents(account?.availableCents) : t("Sign in")}</strong>
        </button>
        <LanguageSwitch className={tone === "paper" ? "language-switch-paper" : "language-switch-night"} />
        <button type="button" onClick={() => onNavigate("/")}><ArrowLeft size={15} /> {t("Manual")}</button>
      </nav>
    </header>
  );
}

function AuthGate({ eyebrow, title, copy, onOpenPanel, tone = "night", headingLevel = "h2" }) {
  const { t } = useLanguage();
  const Heading = headingLevel;

  return (
    <section className={`auth-gate auth-gate-${tone}`}>
      <LockKey size={35} weight="light" />
      <p>{t(eyebrow)}</p>
      <Heading>{t(title)}</Heading>
      <span>{t(copy)}</span>
      <button type="button" onClick={() => onOpenPanel("Sign in")}>{t("Sign in or create account")} <ArrowRight size={18} /></button>
    </section>
  );
}

function ArchiveMedia({ run }) {
  const { t } = useLanguage();
  if (run?.resultContentType?.startsWith("video/") && run.resultUrl) {
    return <video src={run.resultUrl} muted playsInline preload="metadata" />;
  }
  return (
    <SignalImage
      src={run?.resultUrl || "/assets/lmiere-result-cabin.webp"}
      alt={run?.resultUrl ? run.prompt : t("A dormant sample record waiting for a completed generation")}
    />
  );
}

function ArchiveScreen({ session, account, runs, onNavigate, onOpenPanel }) {
  const { formatCents, formatDate, t } = useLanguage();
  const completed = runs.filter((run) => run.status === "complete").length;
  const spentCents = runs.reduce((sum, run) => sum + (run.status === "complete" ? run.chargeCents : 0), 0);

  return (
    <main className="archive-screen">
      <ProductHeader active="Archive" tone="blue" onNavigate={onNavigate} session={session} account={account} runs={runs} />

      <div className="archive-paper">
        <section className="archive-page-intro">
          <div>
            <p>// {t("Private output index")}</p>
            <h1>{t("Your archive")}<br /><em>{t("remembers.")}</em></h1>
          </div>
          <p>{t("Every completed image and motion run returns here with its prompt, route, status, and exact charge intact.")}</p>
        </section>

        <div className="archive-stat-row" aria-label="Archive summary">
          <div><span>{t("Records")}</span><strong>{String(runs.length).padStart(2, "0")}</strong></div>
          <div><span>{t("Recovered")}</span><strong>{String(completed).padStart(2, "0")}</strong></div>
          <div><span>{t("Total charged")}</span><strong>{formatCents(spentCents)}</strong></div>
          <div><span>{t("Available")}</span><strong>{session ? formatCents(account?.availableCents) : "—"}</strong></div>
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
            <SignalImage src="/assets/lmiere-specimen-idle.webp" alt="A dormant network specimen waiting for its first run" />
            <div><p>// {t("No recovered records")}</p><h2>{t("The archive is waiting.")}</h2><span>{t("Begin with one sentence and one visible price.")}</span><button type="button" onClick={() => onNavigate("/studio")}>{t("Make the first record")} <ArrowRight size={18} /></button></div>
          </section>
        ) : (
          <section className="archive-record-grid" aria-label="Generation records">
            {runs.map((run, index) => {
              const outcome = outcomeById(run.outcome);
              return (
                <button className="archive-record-card" type="button" key={run.id} onClick={() => onNavigate(`/runs/${encodeURIComponent(run.id)}`)}>
                  <div className="archive-record-heading"><span>#{String(index + 1).padStart(2, "0")} {formatStatus(run.status, t)}</span><small>{formatDate(run.createdAt)}</small></div>
                  <ArchiveMedia run={run} />
                  <div className="archive-record-copy"><h2>{run.prompt}</h2><p>{outcome.signal} / {t(outcome.label)}</p><strong>{formatCents(run.chargeCents)}</strong></div>
                </button>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function AccountScreen({ session, account, runs, ledger, onNavigate, onOpenPanel, onSignOut, onAccountChanged }) {
  const { formatCents, formatDate, t } = useLanguage();
  const completeRuns = runs.filter((run) => run.status === "complete");
  const spentCents = completeRuns.reduce((sum, run) => sum + run.chargeCents, 0);
  const [checkoutBusy, setCheckoutBusy] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");

  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (!checkout) return undefined;

    window.history.replaceState({}, "", "/account");
    if (checkout === "cancelled") {
      setCheckoutNotice(t("Checkout cancelled. Your wallet was not changed."));
      return undefined;
    }
    if (checkout !== "success") return undefined;

    setCheckoutNotice(t("Payment received. Stripe is confirming the credit now."));
    onAccountChanged();
    const refreshTimers = [900, 2200, 4500].map((delay) => (
      window.setTimeout(() => onAccountChanged(), delay)
    ));
    return () => refreshTimers.forEach((timer) => window.clearTimeout(timer));
  }, [onAccountChanged, t]);

  async function beginCheckout(packId) {
    setCheckoutBusy(packId);
    setCheckoutError("");
    setCheckoutNotice("");
    try {
      const data = await apiRequest("/api/checkout", {
        method: "POST",
        body: JSON.stringify({ packId }),
      });
      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(localizeError(
        error instanceof Error ? error.message : t("Secure checkout could not be opened."),
        t,
      ));
      setCheckoutBusy("");
    }
  }

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
            <video className="account-signal-video" src="/assets/lmiere-signal-ripple.mp4" poster="/assets/lmiere-specimen-idle.webp" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
            <div><p>// {t("Account ledger")}</p><h1>{t("Wallet")}<br /><em>{t("signal.")}</em></h1></div>
            <p>{session.user.email}<br />{t("Every credit movement is attached to this account and its private run history.")}</p>
          </section>

          <section className="wallet-summary-grid" aria-label="Wallet summary">
            <article><Wallet size={24} weight="light" /><span>{t("Available balance")}</span><strong>{formatCents(account?.availableCents)}</strong><small>{t("Ready for a new run")}</small></article>
            <article><ClockCounterClockwise size={24} weight="light" /><span>{t("Reserved")}</span><strong>{formatCents(account?.reservedCents)}</strong><small>{t("Held only while runs are active")}</small></article>
            <article><Coins size={24} weight="light" /><span>{t("Completed spend")}</span><strong>{formatCents(spentCents)}</strong><small>{completeRuns.length} {t(completeRuns.length === 1 ? "recovered generation" : "recovered generations")}</small></article>
          </section>

          <section className="credit-packs-section" aria-labelledby="credit-packs-title">
            <header>
              <div><p>// {t("Prepaid signal")}</p><h2 id="credit-packs-title">{t("Add generation credit")}</h2></div>
              <span>{t("Stripe test mode")}<br />{t("No subscription. No shared balance.")}</span>
            </header>
            <div className="credit-pack-grid">
              {CREDIT_PACKS.map((pack, index) => (
                <button
                  type="button"
                  key={pack.id}
                  disabled={Boolean(checkoutBusy)}
                  onClick={() => beginCheckout(pack.id)}
                  aria-label={t("Buy {amount} in generation credit", { amount: formatCents(pack.amountCents) })}
                >
                  <span>0{index + 1} / {pack.label}</span>
                  <CreditCard size={22} weight="light" />
                  <strong>{formatCents(pack.amountCents)}</strong>
                  <small>{t(pack.note)}</small>
                  <em>{checkoutBusy === pack.id ? t("Opening Stripe") : t("Choose credit")} <ArrowRight size={16} /></em>
                </button>
              ))}
            </div>
            {checkoutNotice && <p className="checkout-notice" role="status">{checkoutNotice}</p>}
            {checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}
            <p className="credit-pack-footnote">{t("Credit is added only after Stripe sends a verified payment confirmation. Test credits have no cash value.")}</p>
          </section>

          <section className="ledger-section">
            <header><div><p>// {t("Immutable activity")}</p><h2>{t("Credit ledger")}</h2></div><span>{ledger.length} {t("entries recovered")}</span></header>
            {ledger.length === 0 ? <p className="ledger-empty">{t("No wallet activity has been recorded yet.")}</p> : (
              <div className="ledger-list">
                {ledger.map((entry) => (
                  <article key={entry.id}>
                    <Receipt size={18} weight="light" />
                    <div><strong>{ledgerLabel(entry.kind, t)}</strong><span>{formatDate(entry.createdAt)}{entry.note ? ` / ${t(entry.note)}` : ""}</span></div>
                    <div>
                      <strong className={entry.balanceDeltaCents < 0 ? "is-debit" : ""}>{entry.balanceDeltaCents === 0 ? "—" : `${entry.balanceDeltaCents > 0 ? "+" : "−"}${formatCents(Math.abs(entry.balanceDeltaCents))}`}</strong>
                      <span>{entry.reservedDeltaCents === 0 ? "" : `${entry.reservedDeltaCents > 0 ? "+" : "−"}${formatCents(Math.abs(entry.reservedDeltaCents))} ${t("reserved")}`}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="account-actions">
            <button type="button" onClick={() => onNavigate("/studio")}>{t("Open studio")} <ArrowRight size={17} /></button>
            <button type="button" onClick={onSignOut}>{t("Sign out")} <SignOut size={17} /></button>
          </div>
        </div>
      )}
    </main>
  );
}

function RunScreen({ id, session, account, runs, onNavigate, onOpenPanel, onRemix }) {
  const { formatCents, formatDate, t } = useLanguage();
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
      .catch((requestError) => { if (!cancelled) setError(localizeError(requestError instanceof Error ? requestError.message : t("The record could not be recovered."), t)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cached, id, session, t]);

  const outcome = record ? outcomeById(record.outcome) : null;

  return (
    <main className="archive-screen run-screen">
      <ProductHeader active="Archive" tone="blue" onNavigate={onNavigate} session={session} account={account} runs={runs} />
      <div className="archive-paper run-paper">
        {!session ? (
          <AuthGate headingLevel="h1" tone="blue" eyebrow="Record sealed" title="Sign in to recover this run." copy="Run links resolve only inside the account that created them." onOpenPanel={onOpenPanel} />
        ) : loading ? (
          <div className="run-loading"><CircleNotch className="spin" size={28} /> {t("Recovering record")}</div>
        ) : error || !record ? (
          <section className="archive-zero-state"><SignalImage src="/assets/lmiere-specimen-idle.webp" alt={t("A dormant specimen indicating a missing record")} /><div><p>// {t("Recovery failed")}</p><h2>{t("Record not found.")}</h2><span>{error || t("This run may belong to another account.")}</span><button type="button" onClick={() => onNavigate("/archive")}>{t("Return to archive")} <ArrowLeft size={18} /></button></div></section>
        ) : (
          <>
            <section className="run-page-intro">
              <div><p>// {t("Record")} {record.id}</p><h1>{record.prompt}</h1></div>
              <div><span>{t("Status")}</span><strong>{formatStatus(record.status, t)}</strong><span>{t("Recovered")}</span><strong>{formatDate(record.completedAt || record.createdAt)}</strong></div>
            </section>

            <section className="run-media-stage">
              {record.resultUrl ? <ResultMedia generation={record} interactive /> : <SignalImage src="/assets/lmiere-result-cabin.webp" alt="Preview image while this run awaits a completed result" />}
              {record.resultUrl && <span className="run-media-provenance"><Sparkle size={12} weight="fill" /> {t("AI-generated media")}</span>}
              <div className="run-media-index"><span>{outcome.signal}</span><span>{t(outcome.label)}</span><span>{formatCents(record.chargeCents)}</span><span>{String(record.progress ?? 0).padStart(2, "0")}%</span></div>
            </section>

            <section className="run-record-notes">
              <div><p>// {t("Prompt transcript")}</p><blockquote>{record.prompt}</blockquote></div>
              <dl>
                <div><dt>{t("Outcome")}</dt><dd>{t(outcome.label)}</dd></div>
                <div><dt>{t("Exact charge")}</dt><dd>{formatCents(record.chargeCents)}</dd></div>
                <div><dt>{t("Created")}</dt><dd>{formatDate(record.createdAt)}</dd></div>
                <div><dt>{t("Completion")}</dt><dd>{formatDate(record.completedAt)}</dd></div>
              </dl>
            </section>

            <div className="run-actions">
              {record.resultUrl && <a href={record.resultUrl} download target="_blank" rel="noreferrer">{t("Save result")} <DownloadSimple size={18} /></a>}
              <button type="button" onClick={() => onRemix(record)}>{t("Remix this prompt")} <ArrowRight size={18} /></button>
              <button type="button" onClick={() => onNavigate("/archive")}>{t("Back to archive")} <ArrowLeft size={18} /></button>
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
      ["How the information is used", "The information is used to verify and authenticate you, isolate your credits and archive, send essential account email, submit requested generations, return results, prevent abuse, and keep the service reliable."],
      ["Generation providers", "Prompts and generation settings are sent to infrastructure providers only when needed to complete the run you requested. Provider names and model details stay outside the everyday interface."],
      ["Service providers", "Lmiere uses specialist providers for authentication, database hosting, generation, media storage, transactional email, and—before paid launch—payment processing. They receive only the information needed to provide their part of the service."],
      ["Retention and account control", "Run and wallet records remain attached to your account so the archive and billing history stay accurate. Account export and deletion controls will be finalized before the beta opens broadly."],
      ["Security boundary", "Provider credentials and database credentials remain on the server. They are never sent to the browser. No online service can promise absolute security, so access is limited to what the product needs."],
      ["Privacy requests", "For access, correction, deletion, or other privacy questions, email privacy@lmiere.com. Security concerns can be sent to security@lmiere.com."],
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
      ["AI output transparency", "Results are produced or altered using AI and are labeled in Lmiere. Do not remove or conceal the disclosure when a result could reasonably be mistaken for an authentic event, person, or public-interest record."],
      ["Acceptable use", "Do not use Lmiere to harm people, impersonate others deceptively, exploit minors, create illegal content, attack systems, evade safeguards, or interfere with another member’s account."],
      ["Availability and limits", "Generation systems can fail, queue, or return unexpected results. Lmiere will make reasonable efforts to release charges for incomplete runs but does not guarantee continuous availability or a particular creative result."],
      ["Contact", "Account and product questions can be sent to support@lmiere.com. Billing questions can be sent to billing@lmiere.com."],
      ["Before public launch", "These terms are a beta operating draft and should receive legal review before paid credits or unrestricted public access are enabled."],
    ],
  },
};

function LegalScreen({ type, onNavigate }) {
  const { t } = useLanguage();
  const document = LEGAL_COPY[type];
  return (
    <main className="legal-screen">
      <header className="legal-header">
        <button type="button" onClick={() => onNavigate("/")}><BrandMark /><span>Lmiere<br />{t("Field manual")}</span></button>
        <span>{t("Effective August 2, 2026")}<br />{t("Beta operating draft")}</span>
        <LanguageSwitch className="language-switch-paper" />
        <button type="button" onClick={() => onNavigate("/")}><ArrowLeft size={16} /> {t("Return to manual")}</button>
      </header>
      <article className="legal-document">
        <header><p>{t(document.eyebrow)}</p><h1>{t(document.title)}</h1><span>{t(document.summary)}</span></header>
        <div className="legal-sections">
          {document.sections.map(([heading, copy], index) => <section key={heading}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{t(heading)}</h2><p>{t(copy)}</p></div></section>)}
        </div>
      </article>
      <footer className="legal-footer"><FileText size={20} /><p>{t("Lmiere Labs / Open field test")}</p><nav><button type="button" onClick={() => onNavigate("/privacy")}>{t("Privacy")}</button><button type="button" onClick={() => onNavigate("/terms")}>{t("Terms")}</button></nav></footer>
    </main>
  );
}

function NotFoundScreen({ onNavigate }) {
  const { t } = useLanguage();
  return (
    <main className="not-found-screen">
      <BrandMark />
      <p>// {t("Field coordinate not found")}</p>
      <h1>404</h1>
      <span>{t("This route has not been recovered.")}</span>
      <button type="button" onClick={() => onNavigate("/")}>{t("Return to the manual")} <ArrowLeft size={18} /></button>
    </main>
  );
}

function ResetPasswordScreen({ onNavigate, onOpenPanel }) {
  const { t } = useLanguage();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? "" : t("This reset link is missing its security token."));
  const [complete, setComplete] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("Use at least 8 characters for your new password."));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("The passwords do not match."));
      return;
    }
    if (!token || !authClient) {
      setError(t("This reset link is not valid. Request a new link from sign in."));
      return;
    }

    setBusy(true);
    try {
      const response = await authClient.resetPassword({ newPassword: password, token });
      if (response?.error) throw new Error(response.error.message ?? t("The password could not be reset."));
      setComplete(true);
      window.history.replaceState({}, "", "/reset-password");
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : t("The password could not be reset.");
      setError(/expired|token|invalid/i.test(message) ? t("This link expired or was already used. Request a new one from sign in.") : localizeError(message, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reset-password-screen network-page">
      <div className="reset-password-topline"><button className="network-wordmark" type="button" onClick={() => onNavigate("/")}><BrandMark dark /> Lmiere</button><LanguageSwitch className="language-switch-night" /></div>
      <section className="reset-password-card">
        <div><p>// {t("Account recovery")}</p><h1>{t(complete ? "Key reset." : "Set a new key.")}</h1></div>
        {complete ? (
          <>
            <p>{t("Your password is updated. Sign in again to reconnect the verified account and its private archive.")}</p>
            <button className="panel-action" type="button" onClick={() => onOpenPanel("Sign in")}>{t("Return to sign in")} <ArrowRight size={17} /></button>
          </>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label>
              <span>{t("New password")}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
            </label>
            <label>
              <span>{t("Confirm new password")}</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="panel-action" type="submit" disabled={busy || !token}>
              {busy ? <><CircleNotch className="spin" size={17} /> {t("Resetting")}</> : <>{t("Reset password")} <ArrowRight size={17} /></>}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export function App() {
  const { t } = useLanguage();
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));
  const [panel, setPanel] = useState(null);
  const [panelPayload, setPanelPayload] = useState(null);
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  const [runs, setRuns] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [gift, setGift] = useState(null);
  const [studioDraft, setStudioDraft] = useState(null);

  const refreshAccount = useCallback(async () => {
    try {
      const data = await apiRequest("/api/me");
      setAccount(data.account);
      setRuns(data.runs ?? []);
      setLedger(data.ledger ?? []);
      setGift(data.gift ?? null);
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sign in")) {
        setAccount(null);
        setRuns([]);
        setLedger([]);
        setGift(null);
      }
      return null;
    }
  }, []);

  const refreshIdentity = useCallback(async () => {
    const identity = await getSessionWithToken();
    if (isVerifiedSession(identity.session)) {
      setSession(identity.session);
      await refreshAccount();
    } else {
      setSession(null);
      setAccount(null);
      setRuns([]);
      setLedger([]);
      setGift(null);
    }
  }, [refreshAccount]);

  useEffect(() => {
    refreshIdentity().catch(() => {
      setSession(null);
      setAccount(null);
      setRuns([]);
      setLedger([]);
      setGift(null);
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
      "reset-password": "Reset password — Lmiere",
      "not-found": "Not found — Lmiere",
    }[route.name];
    document.title = t(title);

    const privateRoute = ["studio", "archive", "run", "account", "reset-password", "not-found"].includes(route.name);
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", privateRoute ? "noindex,nofollow" : "index,follow,max-image-preview:large");

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      const color = route.name === "archive" || route.name === "run"
        ? "#1727FF"
        : ["studio", "account", "reset-password"].includes(route.name) ? "#03100D" : "#EEE6D6";
      themeColor.setAttribute("content", color);
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const publicPath = route.name === "privacy" || route.name === "terms" ? route.path : "/";
      canonical.setAttribute("href", `https://lmiere.com${publicPath}`);
    }
  }, [route.name, t]);

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
    setGift(null);
    closePanel();
  }

  async function acceptFounderGift() {
    const currentGift = gift;
    setGift(null);
    try {
      await apiRequest("/api/account-gift", { method: "POST" });
    } catch {
      setGift(currentGift);
    }
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
    page = <AccountScreen session={session} account={account} runs={runs} ledger={ledger} onNavigate={navigate} onOpenPanel={openPanel} onSignOut={signOut} onAccountChanged={refreshAccount} />;
  } else if (route.name === "run") {
    page = <RunScreen id={route.id} session={session} account={account} runs={runs} onNavigate={navigate} onOpenPanel={openPanel} onRemix={remixRun} />;
  } else if (route.name === "privacy" || route.name === "terms") {
    page = <LegalScreen type={route.name} onNavigate={navigate} />;
  } else if (route.name === "reset-password") {
    page = <ResetPasswordScreen onNavigate={navigate} onOpenPanel={openPanel} />;
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
      <FounderGift gift={gift} onAccept={acceptFounderGift} />
    </>
  );
}
