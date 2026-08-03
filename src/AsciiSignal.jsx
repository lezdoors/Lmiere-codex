import { useEffect, useRef } from "react";

const CHARACTER_RAMP = "  .:-=+*#%@";
const FRAME_INTERVAL = 1000 / 24;
const PHOSPHOR_TINT = { red: 0x33 / 255, green: 1, blue: 0x99 / 255 };

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function drawCover(context, image, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    (width - renderedWidth) * 0.5,
    (height - renderedHeight) * 0.5,
    renderedWidth,
    renderedHeight,
  );
}

function screenTint(channel, tintChannel) {
  const screened = 1 - (1 - channel) * (1 - tintChannel);
  return channel * 0.82 + screened * 0.18;
}

export default function AsciiSignal({ src, alt }) {
  const frameRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return undefined;

    const context = canvas.getContext("2d");
    const glyphCanvas = document.createElement("canvas");
    const glyphContext = glyphCanvas.getContext("2d");
    const sampleCanvas = document.createElement("canvas");
    const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    const image = new Image();
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let imageReady = false;
    let visible = true;
    let hovering = false;
    let lastFrame = 0;
    let samplePixels = null;
    let metrics = null;

    function prepare() {
      if (!imageReady) return;
      const rect = frame.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const cellSize = 10;
      const columns = Math.ceil(width / cellSize);
      const rows = Math.ceil(height / cellSize);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      glyphCanvas.width = canvas.width;
      glyphCanvas.height = canvas.height;
      sampleCanvas.width = columns;
      sampleCanvas.height = rows;
      sampleContext.clearRect(0, 0, columns, rows);
      sampleContext.imageSmoothingEnabled = true;
      drawCover(sampleContext, image, columns, rows);
      samplePixels = sampleContext.getImageData(0, 0, columns, rows).data;
      metrics = { cellSize, columns, height, pixelRatio, rows, width };
      draw(performance.now(), true);
    }

    function draw(time, force = false) {
      if (!metrics || !samplePixels) return;
      if (!force && time - lastFrame < FRAME_INTERVAL) return;
      lastFrame = time;

      const { cellSize, columns, height, pixelRatio, rows, width } = metrics;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(2, 10, 7, 0.9)";
      context.fillRect(0, 0, width, height);

      glyphContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      glyphContext.clearRect(0, 0, width, height);
      glyphContext.font = `${cellSize}px \"IBM Plex Mono\", monospace`;
      glyphContext.textAlign = "center";
      glyphContext.textBaseline = "middle";

      const motionStrength = motionQuery.matches ? 0 : 0.6;
      const hoverLift = hovering ? 1.18 : 1;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = (row * columns + column) * 4;
          let red = samplePixels[index] / 255;
          let green = samplePixels[index + 1] / 255;
          let blue = samplePixels[index + 2] / 255;

          red = clamp((red - 0.5) * 1.15 + 0.5);
          green = clamp((green - 0.5) * 1.15 + 0.5);
          blue = clamp((blue - 0.5) * 1.15 + 0.5);
          red = screenTint(red, PHOSPHOR_TINT.red);
          green = screenTint(green, PHOSPHOR_TINT.green);
          blue = screenTint(blue, PHOSPHOR_TINT.blue);

          const luminance = clamp(red * 0.2126 + green * 0.7152 + blue * 0.0722);
          if (luminance < 0.02) continue;

          const flickerPhase = Math.sin(time * 0.018 + column * 2.117 + row * 5.371);
          const flicker = 1 - motionStrength * 0.15 + flickerPhase * motionStrength * 0.15;
          const liftedLuminance = clamp(Math.pow(luminance, 0.58) * 1.28);
          const animatedLuminance = clamp(liftedLuminance * flicker * hoverLift);
          const characterIndex = Math.min(
            CHARACTER_RAMP.length - 1,
            Math.floor(animatedLuminance * CHARACTER_RAMP.length),
          );
          const alpha = clamp(0.42 + animatedLuminance * 0.58);

          glyphContext.fillStyle = `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)}, ${alpha})`;
          glyphContext.fillText(
            CHARACTER_RAMP[characterIndex],
            (column + 0.5) * cellSize,
            (row + 0.5) * cellSize,
          );
        }
      }

      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = 0.25;
      context.filter = "blur(3px)";
      context.drawImage(glyphCanvas, 0, 0, width, height);
      context.restore();
      context.drawImage(glyphCanvas, 0, 0, width, height);

      context.save();
      context.globalAlpha = 0.45;
      context.fillStyle = "rgba(51, 255, 153, 0.11)";
      for (let y = 0; y < height; y += 4) context.fillRect(0, y, width, 1);
      context.restore();

      const vignette = context.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.18,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.72,
      );
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
    }

    function animate(time) {
      draw(time);
      animationFrame = window.requestAnimationFrame(animate);
    }

    function stop() {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    function start() {
      stop();
      if (!visible || motionQuery.matches || !imageReady) {
        draw(performance.now(), true);
        return;
      }
      animationFrame = window.requestAnimationFrame(animate);
    }

    function setHover(nextHover) {
      hovering = nextHover;
      if (motionQuery.matches) draw(performance.now(), true);
    }

    function onPointerEnter() {
      setHover(true);
    }

    function onPointerLeave() {
      setHover(false);
    }

    const resizeObserver = new ResizeObserver(prepare);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    }, { rootMargin: "160px" });

    image.crossOrigin = "anonymous";
    image.onload = () => {
      imageReady = true;
      prepare();
      start();
    };
    image.src = src;
    resizeObserver.observe(frame);
    visibilityObserver.observe(frame);
    frame.addEventListener("pointerenter", onPointerEnter);
    frame.addEventListener("pointerleave", onPointerLeave);
    motionQuery.addEventListener?.("change", start);

    return () => {
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      frame.removeEventListener("pointerenter", onPointerEnter);
      frame.removeEventListener("pointerleave", onPointerLeave);
      motionQuery.removeEventListener?.("change", start);
      image.onload = null;
    };
  }, [src]);

  return (
    <div ref={frameRef} className="ascii-signal-frame">
      <canvas ref={canvasRef} className="ascii-signal-canvas" role="img" aria-label={alt}>
        {alt}
      </canvas>
      <span className="ascii-signal-label" aria-hidden="true">PHOSPHOR / LIVE</span>
    </div>
  );
}
