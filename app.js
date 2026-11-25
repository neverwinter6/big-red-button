import { ArticleApiError, fetchRandomArticle } from "./js/article-api.js";
import { createDiscoveryStore } from "./js/discovery-store.js";

const HOME_TITLE = "The Big Red Button — a random informative article";
const MIN_LOADING_MS = 800;
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const LOADING_LINES = [
  "Somewhere between a medieval duel and a deep-sea worm…",
  "Following a footnote into the weeds…",
  "Dusting off a very good sentence…",
  "Checking the shelf behind the encyclopedias…",
  "Asking the archivists for something strange…",
  "Taking the scenic route through human knowledge…"
];

const dom = {
  home: document.getElementById("homeView"),
  reader: document.getElementById("readerView"),
  main: document.getElementById("main"),
  pressButton: document.getElementById("pressButton"),
  nextButton: document.getElementById("nextButton"),
  backButton: document.getElementById("backButton"),
  brand: document.getElementById("brandHome"),
  issueNumber: document.getElementById("issueNumber"),
  articleTitle: document.getElementById("articleTitle"),
  articleDescription: document.getElementById("articleDescription"),
  articleSource: document.getElementById("articleSource"),
  articleReadTime: document.getElementById("articleReadTime"),
  articleFigure: document.getElementById("articleFigure"),
  articleImage: document.getElementById("articleImage"),
  articleCaption: document.getElementById("articleCaption"),
  articleBody: document.getElementById("articleBody"),
  sourceLink: document.getElementById("sourceLink"),
  readingProgress: document.getElementById("readingProgress"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingSub: document.getElementById("loadingSub"),
  toast: document.getElementById("toast"),
  aboutPanel: document.getElementById("aboutPanel"),
  aboutButton: document.getElementById("aboutButton"),
  aboutClose: document.getElementById("aboutClose"),
  githubLink: document.getElementById("githubLink")
};

class BigRedButtonApp {
  constructor() {
    this.history = createDiscoveryStore();
    this.state = {
      article: null,
      loading: false,
      aboutOpen: false,
      lastFocused: null,
      toastTimer: null,
      imageToken: 0
    };
  }

  start() {
    this.dom = dom;
    this.bindEvents();
    this.syncIssueNumber();
    this.adaptKeyboardHint();
    this.updateReadingProgress();

    if (this.dom.githubLink?.href.includes("your-username")) {
      this.dom.githubLink.closest(".footer-rights")?.remove();
    }
  }

  bindEvents() {
    this.dom.pressButton.addEventListener("click", () => this.openRandomArticle());
    this.dom.nextButton.addEventListener("click", () => this.openRandomArticle());
    this.dom.backButton.addEventListener("click", () => this.showHome());

    this.dom.brand.addEventListener("click", (event) => {
      if (!this.dom.home.hidden) return;
      event.preventDefault();
      this.showHome();
    });

    this.dom.aboutButton.addEventListener("click", () => this.openAbout());
    this.dom.aboutClose.addEventListener("click", () => this.closeAbout());
    this.dom.aboutPanel.addEventListener("click", (event) => {
      if (event.target === this.dom.aboutPanel) this.closeAbout();
    });

    document.addEventListener("keydown", (event) => this.handleKeyDown(event));
    window.addEventListener("scroll", () => this.updateReadingProgress(), { passive: true });
    window.addEventListener("resize", () => this.updateReadingProgress());
  }

  adaptKeyboardHint() {
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;

    const hint = document.querySelector(".keyboard-hint");
    if (hint) hint.textContent = "One press. One tangent. No algorithm.";
  }

  syncIssueNumber() {
    this.dom.issueNumber.textContent = this.formatIssueNumber(this.history.count);
  }

  formatIssueNumber(number) {
    return `No. ${String(number).padStart(3, "0")}`;
  }

  readingMinutes(paragraphs) {
    const words = paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  }

  updateReadingProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = this.dom.reader.hidden || scrollable <= 0
      ? 0
      : Math.min(1, Math.max(0, window.scrollY / scrollable));

    this.dom.readingProgress.style.transform = `scaleX(${progress.toFixed(4)})`;
  }

  setLoading(isLoading) {
    this.state.loading = isLoading;
    this.dom.pressButton.classList.toggle("is-loading", isLoading);

    if (isLoading) {
      this.dom.pressButton.setAttribute("aria-busy", "true");
    } else {
      this.dom.pressButton.removeAttribute("aria-busy");
    }
  }

  showLoadingOverlay() {
    this.dom.loadingSub.textContent = LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)];
    this.dom.loadingOverlay.hidden = false;
    this.dom.main.setAttribute("aria-busy", "true");
    document.body.classList.add("is-loading");
  }

  hideLoadingOverlay() {
    this.dom.loadingOverlay.hidden = true;
    this.dom.main.removeAttribute("aria-busy");
    document.body.classList.remove("is-loading");
  }

  async waitForMinimumLoadingTime(startedAt) {
    const remaining = MIN_LOADING_MS - (performance.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  async openRandomArticle() {
    if (this.state.loading) return;

    this.setLoading(true);
    this.showLoadingOverlay();
    const startedAt = performance.now();

    try {
      const article = await fetchRandomArticle({
        exclude: this.history.exclusionsFor(this.state.article?.title)
      });

      await this.waitForMinimumLoadingTime(startedAt);

      this.state.article = article;
      this.history.record(article.title);
      this.hideLoadingOverlay();
      this.renderArticle(article);
    } catch (error) {
      console.error("Could not load a random article:", error);
      this.hideLoadingOverlay();
      this.showError(error);
    } finally {
      this.setLoading(false);
    }
  }

  showError(error) {
    const message = error instanceof ArticleApiError && error.status === 0
      ? "The archive is offline. Check your connection and press again."
      : "The encyclopedia is having a moment. Press again in a second.";
    this.showToast(message);
  }

  showToast(message) {
    window.clearTimeout(this.state.toastTimer);
    this.dom.toast.textContent = message;
    this.dom.toast.classList.add("is-visible");
    this.state.toastTimer = window.setTimeout(() => {
      this.dom.toast.classList.remove("is-visible");
    }, 5200);
  }

  showHome() {
    this.state.article = null;
    this.dom.reader.hidden = true;
    this.dom.home.hidden = false;
    this.dom.home.classList.add("is-active");
    document.body.classList.remove("reading");
    document.title = HOME_TITLE;
    window.scrollTo({ top: 0, behavior: "instant" });
    this.updateReadingProgress();
    this.dom.pressButton.focus({ preventScroll: true });
  }

  renderArticle(article) {
    this.dom.articleTitle.textContent = article.title;
    this.dom.articleDescription.textContent = article.description || "";
    this.dom.articleSource.textContent = article.sourceLabel || "Wikipedia article";
    this.dom.articleReadTime.textContent = `${this.readingMinutes(article.paragraphs)} min read`;
    this.dom.issueNumber.textContent = this.formatIssueNumber(this.history.count);
    this.dom.sourceLink.href = article.articleUrl;
    this.dom.articleBody.replaceChildren(...article.paragraphs.map((text) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      return paragraph;
    }));

    this.renderLeadImage(article);

    this.dom.home.hidden = true;
    this.dom.home.classList.remove("is-active");
    this.dom.reader.hidden = false;
    document.body.classList.add("reading");
    document.title = `${article.title} — The Big Red Button`;

    window.scrollTo({ top: 0, behavior: "instant" });
    this.updateReadingProgress();
    this.dom.articleTitle.focus({ preventScroll: true });
  }

  renderLeadImage(article) {
    const token = ++this.state.imageToken;
    this.dom.articleFigure.classList.remove("is-loaded");
    this.dom.articleCaption.replaceChildren();

    if (!article.imageUrl) {
      this.dom.articleFigure.hidden = true;
      this.dom.articleImage.removeAttribute("src");
      this.dom.articleImage.onload = null;
      this.dom.articleImage.onerror = null;
      return;
    }

    this.dom.articleFigure.hidden = false;
    this.dom.articleImage.alt = `Lead image from the Wikipedia article “${article.title}”`;
    this.renderImageCredit(article.imageName);

    const markLoaded = () => {
      if (token === this.state.imageToken) {
        this.dom.articleFigure.classList.add("is-loaded");
      }
    };

    this.dom.articleImage.onload = markLoaded;
    this.dom.articleImage.onerror = () => {
      if (token === this.state.imageToken) this.dom.articleFigure.hidden = true;
    };
    this.dom.articleImage.src = article.imageUrl;

    if (this.dom.articleImage.complete && this.dom.articleImage.naturalWidth > 0) {
      markLoaded();
    }
  }

  renderImageCredit(imageName) {
    if (!imageName) {
      this.dom.articleCaption.textContent = "Image via Wikimedia Commons";
      return;
    }

    const fileLink = document.createElement("a");
    fileLink.href = `https://en.wikipedia.org/wiki/File:${encodeURIComponent(imageName.replace(/ /g, "_"))}`;
    fileLink.target = "_blank";
    fileLink.rel = "noopener noreferrer";
    fileLink.textContent = imageName.replace(/_/g, " ");

    this.dom.articleCaption.append("Image: ", fileLink, " · Wikimedia Commons");
  }

  openAbout() {
    if (this.state.aboutOpen) return;

    this.state.aboutOpen = true;
    this.state.lastFocused = document.activeElement;
    this.dom.aboutPanel.hidden = false;
    this.dom.aboutButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
    this.dom.aboutClose.focus();
  }

  closeAbout() {
    if (!this.state.aboutOpen) return;

    this.state.aboutOpen = false;
    this.dom.aboutPanel.hidden = true;
    this.dom.aboutButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");

    if (typeof this.state.lastFocused?.focus === "function") {
      this.state.lastFocused.focus();
    }
  }

  trapAboutFocus(event) {
    if (event.key !== "Tab") return;

    const focusable = [...this.dom.aboutPanel.querySelectorAll(FOCUSABLE_SELECTOR)]
      .filter((element) => element.offsetParent !== null);

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  handleKeyDown(event) {
    if (this.state.aboutOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeAbout();
      }
      this.trapAboutFocus(event);
      return;
    }

    if (this.state.loading) return;

    const activeTag = document.activeElement?.tagName;
    const isInteractive = ["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT"].includes(activeTag);

    if (!this.dom.home.hidden && event.code === "Space" && !isInteractive) {
      event.preventDefault();
      this.openRandomArticle();
      return;
    }

    if (!this.dom.reader.hidden && !isInteractive && ["n", "N", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      this.openRandomArticle();
      return;
    }

    if (!this.dom.reader.hidden && event.key === "Escape") {
      event.preventDefault();
      this.showHome();
    }
  }
}

new BigRedButtonApp().start();
