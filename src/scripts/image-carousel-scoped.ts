/**
 * image-carousel-scoped.ts
 * Scopes all queries to a given root element.
 * Works with multiple carousels per page. Strong TS types.
 */

type SubImg = { src: string; alt?: string; detail?: string };
type Project = { src: string; alt: string; detail: string; gallery?: SubImg[] };
type Slide = { src: string; alt: string; detail?: string };

const $ = <T extends Element>(root: ParentNode, sel: string) =>
  root.querySelector<T>(sel);

const $$ = <T extends Element>(root: ParentNode, sel: string) =>
  root.querySelectorAll<T>(sel);

const hasHTML = (s?: string) => !!s && /<[a-z][\s\S]*>/i.test(s);
const clamp = (i: number, len: number) => (len ? (i + len) % len : 0);

export default function initCarousel(root: ParentNode): void {
  // Find DOM elements inside this root
  const dataEl = $<HTMLScriptElement>(root, '[data-role="data"]');

  const modal = $<HTMLDivElement>(root, '[data-role="modal"]');
  const overlay = $<HTMLButtonElement>(root, '[data-role="overlay"]');
  const closeBtn = $<HTMLButtonElement>(root, '[data-role="close"]');

  const modalImg = $<HTMLImageElement>(root, '[data-role="image"]');
  const modalTitle = $<HTMLHeadingElement>(root, '[data-role="title"]');
  const modalContent = $<HTMLDivElement>(root, '[data-role="content"]');
  const progress = $<HTMLDivElement>(root, '[data-role="progress"]');

  const prevBtn = $<HTMLButtonElement>(root, '[data-role="prev"]');
  const nextBtn = $<HTMLButtonElement>(root, '[data-role="next"]');
  const thumbs = $<HTMLDivElement>(root, '[data-role="thumbs"]');

  const openers = $$<HTMLButtonElement>(root, '[data-role="open"]');

  if (
    !dataEl ||
    !modal ||
    !overlay ||
    !closeBtn ||
    !modalImg ||
    !modalTitle ||
    !modalContent ||
    !prevBtn ||
    !nextBtn ||
    !thumbs
  ) {
    return; // essential nodes missing
  }

  // State (per instance)
  let projects: Project[] = [];
  let currentProject = 0;
  let slides: Slide[] = [];
  let currentSlide = 0;
  let lastFocused: HTMLElement | null = null;

  // Data
  projects = dataEl.textContent
    ? (JSON.parse(dataEl.textContent) as Project[])
    : [];

  // Helpers
  const lockScroll = (on: boolean) => {
    document.documentElement.style.overflow = on ? "hidden" : "";
    document.body.style.overflow = on ? "hidden" : "";
  };

  const buildSlides = (p: Project): Slide[] => {
    const main: Slide = { src: p.src, alt: p.alt, detail: p.detail };
    const extras = (p.gallery ?? []).map((g) => ({
      src: g.src,
      alt: g.alt ?? p.alt,
      detail: g.detail ?? p.detail,
    }));
    return [main, ...extras];
  };

  const preloadNeighbors = (i: number) => {
    const idxs = [clamp(i - 1, slides.length), clamp(i + 1, slides.length)];
    idxs.forEach((k) => {
      const s = slides[k];
      if (s?.src) {
        const img = new Image();
        img.src = s.src;
      }
    });
  };

  const updateProgress = () => {
    if (!progress) return;
    progress.textContent =
      slides.length > 1 ? `${currentSlide + 1} / ${slides.length}` : "";
  };

  const renderThumbs = () => {
    thumbs!.innerHTML = "";
    slides.forEach((s, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "shrink-0 relative rounded-lg overflow-hidden border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/40";
      btn.setAttribute("aria-label", `Go to slide ${i + 1}`);

      const im = document.createElement("img");
      im.src = s.src;
      im.alt = s.alt || `Slide ${i + 1}`;
      im.loading = "lazy";
      im.className = "h-16 w-24 object-cover";

      const hi = document.createElement("div");
      hi.className =
        i === currentSlide
          ? "absolute inset-0 ring-2 ring-black rounded-lg"
          : "absolute inset-0";

      btn.appendChild(im);
      btn.appendChild(hi);
      btn.addEventListener("click", () => showSlide(i));
      thumbs!.appendChild(btn);
    });
  };

  const showSlide = (index: number) => {
    const safe = clamp(index, slides.length);
    const s = slides[safe];
    if (!s) return;
    currentSlide = safe;

    // crossfade
    modalImg!.style.opacity = "0";
    requestAnimationFrame(() => {
      modalImg!.src = s.src;
      modalImg!.alt = s.alt || "";
      const p = projects[currentProject];
      modalTitle!.textContent = p?.alt || s.alt || `Image ${currentSlide + 1}`;
      if (hasHTML(s.detail)) {
        modalContent!.innerHTML = s.detail!;
      } else {
        modalContent!.textContent = s.detail || "";
      }
      const onLoad = () => {
        modalImg!.style.transition = "opacity 150ms ease-out";
        modalImg!.style.opacity = "1";
        modalImg!.removeEventListener("load", onLoad);
      };
      modalImg!.addEventListener("load", onLoad);
    });

    renderThumbs();
    updateProgress();
    preloadNeighbors(currentSlide);
  };

  const openProject = (projectIndex: number) => {
    currentProject = projectIndex;
    slides = buildSlides(projects[currentProject]);
    currentSlide = 0;

    modal!.classList.remove("hidden");
    modal!.setAttribute("aria-hidden", "false");
    lockScroll(true);
    lastFocused = (document.activeElement as HTMLElement) ?? null;
    closeBtn!.focus();

    showSlide(0);
  };

  const closeModal = () => {
    modal!.classList.add("hidden");
    modal!.setAttribute("aria-hidden", "true");
    lockScroll(false);
    lastFocused?.focus?.();
  };

  const next = () => showSlide(currentSlide + 1);
  const prev = () => showSlide(currentSlide - 1);

  // Openers
  openers.forEach((el) => {
    el.addEventListener("click", () => {
      const raw = el.getAttribute("data-index");
      openProject(Number(raw ?? 0));
    });
  });

  // Controls
  overlay!.addEventListener("click", closeModal);
  closeBtn!.addEventListener("click", closeModal);
  nextBtn!.addEventListener("click", next);
  prevBtn!.addEventListener("click", prev);
  modalImg!.addEventListener("click", next);

  // Keyboard (only when modal is open)
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (modal!.classList.contains("hidden")) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  // Swipe on image
  let startX = 0,
    startY = 0,
    touching = false;
  modalImg!.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
      const t = e.touches[0];
      touching = true;
      startX = t.clientX;
      startY = t.clientY;
    },
    { passive: true }
  );

  modalImg!.addEventListener("touchend", (e: TouchEvent) => {
    if (!touching) return;
    touching = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? next() : prev();
    }
  });
}

const currentScript = document.currentScript as HTMLScriptElement | null;

if (currentScript) {
  const root = currentScript.closest("[data-carousel-root]") ?? document;
  initCarousel(root);
} else {
  document
    .querySelectorAll<HTMLElement>("[data-carousel-root]")
    .forEach((root) => {
      initCarousel(root);
    });
}
