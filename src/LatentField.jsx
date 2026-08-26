export default function LatentField({ phase = "idle", progress = 0, alt }) {
  const active = phase === "submitting" || phase === "generating";
  const awake = active || phase === "complete";
  const completion = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={`latent-field ${active ? "is-active" : ""} ${awake ? "is-awake" : ""}`}
      role="img"
      aria-label={alt}
      style={{ "--latent-progress": `${completion}%` }}
    >
      <img className="latent-field-idle" src="/assets/lmiere-specimen-idle.webp" alt="" />
      <img className="latent-field-awake" src="/assets/lmiere-specimen-awake.webp" alt="" />
      <div className="latent-lens" aria-hidden="true">
        <i /><i /><i /><i />
        <span />
      </div>
      <div className="latent-readout" aria-hidden="true">
        <span>INTERPRETATION LENS</span>
        <strong>{String(completion).padStart(2, "0")}%</strong>
      </div>
    </div>
  );
}
