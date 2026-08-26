/**
 * Lmiere showpiece choreography.
 *
 * Three rules this module must not break:
 * 1. The complete active chapter is visible before motion initializes.
 * 2. GSAP owns the single authored transition: an optical shutter exchanging specimens.
 * 3. Reduced-motion users receive the final state immediately, with no animation.
 */
import { gsap } from "gsap";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function mountLandingMotion(root) {
  if (!root || window.matchMedia(REDUCED_MOTION).matches) return () => {};

  const context = gsap.context(() => {
    const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
    intro
      .from(".landing-stage-header", { autoAlpha: 0, y: -12, duration: 0.66 }, 0)
      .from(".landing-rule", { scaleX: 0, transformOrigin: "left center", duration: 0.84 }, 0.05)
      .from("#apparatus .landing-copy h1", { autoAlpha: 0, yPercent: 12, filter: "blur(7px)", duration: 0.96 }, 0.12)
      .from("#apparatus .landing-thesis", { autoAlpha: 0, y: 20, duration: 0.72 }, 0.3)
      .from("#apparatus .landing-summary, #apparatus .landing-actions", { autoAlpha: 0, y: 16, duration: 0.62, stagger: 0.07 }, 0.4)
      .from("#apparatus .landing-machine", { autoAlpha: 0, scale: 1.018, clipPath: "inset(0 0 100% 0)", duration: 1.08 }, 0.04)
      .from("#apparatus .landing-annotation", { autoAlpha: 0, duration: 0.44, stagger: 0.08 }, 0.7)
      .from("#apparatus .landing-footer, #apparatus .landing-edge-note", { autoAlpha: 0, y: 8, duration: 0.48, stagger: 0.06 }, 0.65)
      .from(".field-index", { autoAlpha: 0, y: 18, duration: 0.58 }, 0.62);
  }, root);

  const hero = root.querySelector("#apparatus .landing-hero");
  const machine = root.querySelector("#apparatus .landing-machine");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let moveX;
  let moveY;

  if (hero && machine && finePointer) {
    moveX = gsap.quickTo(machine, "x", { duration: 0.72, ease: "power3.out" });
    moveY = gsap.quickTo(machine, "y", { duration: 0.72, ease: "power3.out" });
  }

  function onPointerMove(event) {
    if (!hero || !moveX || !moveY) return;
    const bounds = hero.getBoundingClientRect();
    moveX(((event.clientX - bounds.left) / bounds.width - 0.5) * 9);
    moveY(((event.clientY - bounds.top) / bounds.height - 0.5) * 7);
  }

  function resetPointerDepth() {
    moveX?.(0);
    moveY?.(0);
  }

  hero?.addEventListener("pointermove", onPointerMove, { passive: true });
  hero?.addEventListener("pointerleave", resetPointerDepth);
  window.addEventListener("blur", resetPointerDepth);

  return () => {
    hero?.removeEventListener("pointermove", onPointerMove);
    hero?.removeEventListener("pointerleave", resetPointerDepth);
    window.removeEventListener("blur", resetPointerDepth);
    context.revert();
  };
}

export function transitionLandingChapter(root, fromId, toId, direction, commit) {
  if (!root || window.matchMedia(REDUCED_MOTION).matches) {
    commit();
    return Promise.resolve();
  }

  const outgoing = root.querySelector(`#${fromId}`);
  const incoming = root.querySelector(`#${toId}`);
  if (!outgoing || !incoming) {
    commit();
    return Promise.resolve();
  }

  incoming.scrollTop = 0;
  root.classList.add("is-changing-chapter");
  gsap.set(outgoing, { zIndex: 3, willChange: "clip-path, filter" });
  gsap.set(incoming, {
    display: "block",
    autoAlpha: 1,
    zIndex: 2,
    clipPath: "inset(49.6% 0 49.6% 0)",
    willChange: "clip-path, filter",
  });

  const revealTargets = incoming.querySelectorAll("[data-chapter-reveal], .manual-section-heading, .landing-outcome-grid, .landing-procedure, .transmission-field, .landing-closing-section > div");

  return new Promise((resolve) => {
    const timeline = gsap.timeline({
      onComplete: () => {
        commit();
        window.requestAnimationFrame(() => {
          gsap.set(outgoing, { clearProps: "all" });
          gsap.set(incoming, { clearProps: "all" });
          root.classList.remove("is-changing-chapter");
          resolve();
        });
      },
    });

    timeline
      .to(outgoing, {
        clipPath: direction > 0 ? "inset(0 0 100% 0)" : "inset(100% 0 0 0)",
        filter: "contrast(1.16) blur(3px)",
        duration: 0.2,
        ease: "power2.in",
      })
      .to(incoming, {
        clipPath: "inset(0% 0 0% 0)",
        filter: "none",
        duration: 0.52,
        ease: "expo.out",
      }, 0.16);

    if (revealTargets.length > 0) {
      timeline.from(revealTargets, {
        autoAlpha: 0,
        y: direction > 0 ? 18 : -18,
        duration: 0.36,
        stagger: 0.035,
        ease: "power3.out",
      }, 0.28);
    }
  });
}
