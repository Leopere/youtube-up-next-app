(function () {
  if (window.__ytUpNextPaneLoaded) {
    return;
  }
  window.__ytUpNextPaneLoaded = true;

  const QUEUE_KEY = "ytUpNextQueue";
  const PANEL_KEY = "ytUpNextPanelOpen";
  const ACTIVE_TAB_KEY = "ytUpNextActiveTab";
  const MAX_QUEUE_SIZE = 200;
  const WATCH_LATER_URL = "https://www.youtube.com/playlist?list=WL";
  const VALID_RENDERER_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-reel-video-renderer",
    "ytd-reel-item-renderer",
    "yt-lockup-view-model",
    "ytm-shorts-lockup-view-model"
  ].join(",");
  const COMMENT_SELECTOR = [
    "#comments",
    "ytd-comments",
    "ytd-comment-thread-renderer",
    "ytd-comment-view-model",
    "ytd-comment-replies-renderer",
    "ytd-live-chat-frame",
    "ytd-live-chat-renderer"
  ].join(",");

  let queue = [];
  let panelOpen = true;
  let activeTab = "queue";
  let watchLaterItems = [];
  let watchLaterStatus = "idle";
  let watchLaterError = "";
  let root;
  let panel;
  let toggleButton;
  let addCurrentNextButton;
  let addCurrentLastButton;
  let shortsDock;
  let toastTimer;
  let currentMainVideo;
  let currentMainVideoEndedHandler;
  let advancing = false;
  let scanTimer;

  const storage = {
    get(defaults) {
      return new Promise((resolve) => {
        chrome.storage.local.get(defaults, resolve);
      });
    },
    set(values) {
      return new Promise((resolve) => {
        chrome.storage.local.set(values, resolve);
      });
    }
  };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function parseVideoId(urlValue) {
    try {
      const url = new URL(urlValue, window.location.origin);
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }

      const shortsMatch = url.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shortsMatch) {
        return shortsMatch[1];
      }
    } catch (_error) {
      return "";
    }

    return "";
  }

  function videoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  }

  function isWatchPage() {
    return window.location.pathname === "/watch" && Boolean(parseVideoId(window.location.href));
  }

  function isShortsPage() {
    return window.location.pathname.startsWith("/shorts/");
  }

  function thumbnailUrl(videoId) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
  }

  function makeUid(videoId) {
    return `${videoId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getRenderer(element) {
    return element.closest(VALID_RENDERER_SELECTOR);
  }

  function isCommentArea(element) {
    return Boolean(element && element.closest(COMMENT_SELECTOR));
  }

  function findTitle(renderer, anchor) {
    const titleNode = renderer && renderer.querySelector([
      "#video-title",
      "a#video-title",
      "yt-formatted-string#video-title",
      "h3",
      ".yt-lockup-metadata-view-model-wiz__title",
      ".yt-core-attributed-string"
    ].join(","));

    return normalizeText(
      (titleNode && (titleNode.getAttribute("title") || titleNode.textContent)) ||
      anchor.getAttribute("title") ||
      anchor.getAttribute("aria-label") ||
      "Untitled video"
    );
  }

  function findChannel(renderer) {
    if (!renderer) {
      return "";
    }

    const channelNode = renderer.querySelector([
      "#channel-name a",
      "ytd-channel-name a",
      ".ytd-channel-name a",
      ".yt-content-metadata-view-model-wiz__metadata-row span"
    ].join(","));

    return normalizeText(channelNode && channelNode.textContent);
  }

  function findThumbnail(renderer, videoId) {
    if (!renderer) {
      return thumbnailUrl(videoId);
    }

    const image = renderer.querySelector("img");
    const source = image && (image.currentSrc || image.src);
    return source || thumbnailUrl(videoId);
  }

  function videoFromAnchor(anchor) {
    if (!anchor || isCommentArea(anchor)) {
      return null;
    }

    const renderer = getRenderer(anchor);
    if (!renderer || isCommentArea(renderer)) {
      return null;
    }

    const videoId = parseVideoId(anchor.href || anchor.getAttribute("href"));
    if (!videoId) {
      return null;
    }

    return {
      id: videoId,
      uid: makeUid(videoId),
      title: findTitle(renderer, anchor),
      channel: findChannel(renderer),
      thumb: findThumbnail(renderer, videoId),
      url: videoUrl(videoId),
      addedAt: Date.now()
    };
  }

  function getCurrentVideo() {
    const videoId = parseVideoId(window.location.href);
    if (!videoId) {
      return null;
    }

    const titleNode = document.querySelector([
      "ytd-watch-metadata h1 yt-formatted-string",
      "ytd-watch-metadata h1",
      "h1.title",
      "h1"
    ].join(","));

    const channelNode = document.querySelector([
      "ytd-watch-metadata ytd-channel-name a",
      "#owner ytd-channel-name a",
      "#channel-name a"
    ].join(","));

    let title = normalizeText(titleNode && titleNode.textContent);
    if (!title) {
      title = normalizeText(document.title.replace(/\s+-\s+YouTube$/, ""));
    }

    return {
      id: videoId,
      uid: makeUid(videoId),
      title: title || "Current video",
      channel: normalizeText(channelNode && channelNode.textContent),
      thumb: thumbnailUrl(videoId),
      url: videoUrl(videoId),
      addedAt: Date.now()
    };
  }

  async function saveQueue() {
    await storage.set({ [QUEUE_KEY]: queue });
    render();
  }

  async function setPanelOpen(open) {
    panelOpen = open;
    await storage.set({ [PANEL_KEY]: panelOpen });
    render();
  }

  async function setActiveTab(tab) {
    activeTab = tab === "watch-later" ? "watch-later" : "queue";
    await storage.set({ [ACTIVE_TAB_KEY]: activeTab });
    render();

    if (activeTab === "watch-later") {
      loadWatchLater();
    }
  }

  function queueLabel(position) {
    return position === "next" ? "Up Next" : "Up Last";
  }

  function unplayedCount() {
    return queue.filter((item) => !item.played).length;
  }

  function normalizeQueueItem(item) {
    return {
      ...item,
      uid: item.uid || makeUid(item.id),
      played: Boolean(item.played),
      playedAt: item.playedAt || 0
    };
  }

  async function markPlayed(uid) {
    let changed = false;
    queue = queue.map((item) => {
      if (item.uid !== uid) {
        return item;
      }

      changed = true;
      return {
        ...item,
        played: true,
        playedAt: Date.now()
      };
    });

    if (changed) {
      await saveQueue();
    }
  }

  async function addVideo(video, position) {
    const insertPosition = position === "next" ? "next" : "last";
    if (!video || !video.id) {
      showToast("No video found");
      return;
    }

    const existingIndex = queue.findIndex((item) => item.id === video.id);
    let item = {
      ...video,
      uid: video.uid || makeUid(video.id),
      played: false,
      playedAt: 0,
      addedAt: Date.now()
    };

    if (existingIndex >= 0) {
      item = {
        ...queue[existingIndex],
        ...item,
        uid: queue[existingIndex].uid,
        played: false,
        playedAt: 0
      };
      queue = queue.filter((entry) => entry.id !== video.id);
    }

    if (insertPosition === "next") {
      queue = [item].concat(queue).slice(0, MAX_QUEUE_SIZE);
    } else {
      queue = queue.concat(item).slice(-MAX_QUEUE_SIZE);
    }

    await saveQueue();
    await setPanelOpen(true);
    showToast(existingIndex >= 0 ? `Moved to ${queueLabel(insertPosition)}` : `Added to ${queueLabel(insertPosition)}`);
  }

  async function removeItem(uid) {
    queue = queue.filter((item) => item.uid !== uid);
    await saveQueue();
  }

  async function moveItem(uid, direction) {
    const index = queue.findIndex((item) => item.uid === uid);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= queue.length) {
      return;
    }

    const nextQueue = queue.slice();
    const [item] = nextQueue.splice(index, 1);
    nextQueue.splice(target, 0, item);
    queue = nextQueue;
    await saveQueue();
  }

  async function clearQueue() {
    queue = [];
    await saveQueue();
  }

  async function resetPlayed() {
    queue = queue.map((item) => ({
      ...item,
      played: false,
      playedAt: 0
    }));
    await saveQueue();
  }

  async function playItem(uid) {
    const item = queue.find((entry) => entry.uid === uid);
    if (!item) {
      return;
    }

    await markPlayed(uid);
    window.location.href = item.url;
  }

  async function playNext() {
    if (advancing || unplayedCount() === 0) {
      return;
    }

    advancing = true;
    const item = queue.find((entry) => !entry.played);
    await markPlayed(item.uid);
    window.location.href = item.url;
  }

  function createButton(label, className, onClick, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    if (title) {
      button.title = title;
      button.setAttribute("aria-label", title);
    }
    button.addEventListener("click", onClick);
    return button;
  }

  function showToast(message) {
    let toast = document.querySelector(".ytun-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "ytun-toast";
      document.documentElement.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 1600);
  }

  function mount() {
    root = document.createElement("div");
    root.id = "ytun-root";

    toggleButton = createButton("Up Next", "ytun-toggle", () => {
      setPanelOpen(!panelOpen);
    }, "Toggle Up Next");

    addCurrentNextButton = createButton("+ Next", "ytun-add-current ytun-add-next", () => {
      addVideo(getCurrentVideo(), "next");
    }, "Play current video or short next");

    addCurrentLastButton = createButton("+ Last", "ytun-add-current ytun-add-last", () => {
      addVideo(getCurrentVideo(), "last");
    }, "Add current video or short to the end");

    shortsDock = document.createElement("div");
    shortsDock.className = "ytun-shorts-dock";

    const shortsLabel = document.createElement("div");
    shortsLabel.className = "ytun-shorts-label";
    shortsLabel.textContent = "Short";

    shortsDock.appendChild(shortsLabel);
    shortsDock.appendChild(createButton("+ Next", "ytun-dock-button", () => {
      addVideo(getCurrentVideo(), "next");
    }, "Play this Short next"));
    shortsDock.appendChild(createButton("+ Last", "ytun-dock-button", () => {
      addVideo(getCurrentVideo(), "last");
    }, "Add this Short to the end"));

    panel = document.createElement("aside");
    panel.className = "ytun-panel";
    panel.setAttribute("aria-label", "Up Next");

    root.appendChild(toggleButton);
    root.appendChild(addCurrentNextButton);
    root.appendChild(addCurrentLastButton);
    root.appendChild(shortsDock);
    root.appendChild(panel);
    document.documentElement.appendChild(root);
  }

  function render() {
    if (!root) {
      return;
    }

    updateShell();
    panel.replaceChildren();

    const header = document.createElement("div");
    header.className = "ytun-header";

    const title = document.createElement("div");
    title.className = "ytun-title";
    title.textContent = "Up Next";

    const count = document.createElement("div");
    count.className = "ytun-count";
    count.textContent = `${unplayedCount()}/${queue.length}`;

    const close = createButton("Close", "ytun-close", () => setPanelOpen(false), "Close Up Next");

    header.appendChild(title);
    header.appendChild(count);
    header.appendChild(close);
    panel.appendChild(header);
    panel.appendChild(renderTabs());

    if (activeTab === "watch-later") {
      renderWatchLater();
    } else {
      renderQueue();
    }
  }

  function renderTabs() {
    const tabs = document.createElement("div");
    tabs.className = "ytun-tabs";
    tabs.setAttribute("role", "tablist");

    const queueTab = createButton(`Queue ${unplayedCount()}/${queue.length}`, "ytun-tab", () => setActiveTab("queue"), "Show local Up Next queue");
    const watchLaterTab = createButton("Watch Later", "ytun-tab", () => setActiveTab("watch-later"), "Show your YouTube Watch Later playlist");

    queueTab.classList.toggle("is-active", activeTab === "queue");
    watchLaterTab.classList.toggle("is-active", activeTab === "watch-later");
    queueTab.setAttribute("aria-selected", activeTab === "queue" ? "true" : "false");
    watchLaterTab.setAttribute("aria-selected", activeTab === "watch-later" ? "true" : "false");

    tabs.appendChild(queueTab);
    tabs.appendChild(watchLaterTab);
    return tabs;
  }

  function renderQueue() {
    const controls = document.createElement("div");
    controls.className = "ytun-controls";
    controls.appendChild(createButton("+ Next", "ytun-control", () => addVideo(getCurrentVideo(), "next"), "Play current video or short next"));
    controls.appendChild(createButton("+ Last", "ytun-control", () => addVideo(getCurrentVideo(), "last"), "Add current video or short to the end"));
    controls.appendChild(createButton("Play First", "ytun-control", () => playNext(), "Play first queued video"));
    controls.appendChild(createButton("Reset Played", "ytun-control", () => resetPlayed(), "Mark all queued videos as unplayed"));
    controls.appendChild(createButton("Clear", "ytun-control danger", () => clearQueue(), "Clear Up Next"));
    panel.appendChild(controls);

    if (queue.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ytun-empty";
      empty.textContent = "No videos queued";
      panel.appendChild(empty);
      return;
    }

    const list = document.createElement("ol");
    list.className = "ytun-list";
    queue.forEach((item, index) => {
      list.appendChild(renderQueueItem(item, index));
    });

    panel.appendChild(list);
  }

  function renderWatchLater() {
    const controls = document.createElement("div");
    controls.className = "ytun-controls ytun-watch-controls";
    controls.appendChild(createButton("Refresh", "ytun-control", () => loadWatchLater(true), "Refresh Watch Later"));
    controls.appendChild(createButton("Open List", "ytun-control", () => {
      window.location.href = WATCH_LATER_URL;
    }, "Open YouTube Watch Later"));
    panel.appendChild(controls);

    if (watchLaterStatus === "loading") {
      const loading = document.createElement("div");
      loading.className = "ytun-empty";
      loading.textContent = "Loading Watch Later";
      panel.appendChild(loading);
      return;
    }

    if (watchLaterError) {
      const error = document.createElement("div");
      error.className = "ytun-status";
      error.textContent = watchLaterError;
      panel.appendChild(error);
    }

    if (watchLaterItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ytun-empty";
      empty.textContent = watchLaterStatus === "loaded" ? "No Watch Later videos found" : "Open this tab to load Watch Later";
      panel.appendChild(empty);
      return;
    }

    const list = document.createElement("ol");
    list.className = "ytun-list";
    watchLaterItems.forEach((item, index) => {
      list.appendChild(renderLibraryItem(item, index));
    });
    panel.appendChild(list);
  }

  function updateShell() {
    if (!root) {
      return;
    }

    const hasCurrentVideo = Boolean(getCurrentVideo());
    root.classList.toggle("is-open", panelOpen);
    root.classList.toggle("is-shorts", isShortsPage());
    document.documentElement.classList.toggle("ytun-watch-page", isWatchPage());
    document.documentElement.classList.toggle("ytun-shorts-page", isShortsPage());
    toggleButton.textContent = `Up Next ${unplayedCount()}/${queue.length}`;
    addCurrentNextButton.classList.toggle("is-hidden", !hasCurrentVideo);
    addCurrentLastButton.classList.toggle("is-hidden", !hasCurrentVideo);
  }

  function renderQueueItem(item, index) {
    return renderVideoRow(item, index, [
      createButton(item.played ? "Replay" : "Play", "ytun-mini", () => playItem(item.uid), item.played ? "Replay video" : "Play video"),
      createButton("Up", "ytun-mini", () => moveItem(item.uid, -1), "Move up"),
      createButton("Down", "ytun-mini", () => moveItem(item.uid, 1), "Move down"),
      createButton("Remove", "ytun-mini danger", () => removeItem(item.uid), "Remove video")
    ], () => playItem(item.uid));
  }

  function renderLibraryItem(item, index) {
    return renderVideoRow(item, index, [
      createButton("Play", "ytun-mini", () => {
        window.location.href = item.url;
      }, "Play video"),
      createButton("+ Next", "ytun-mini", () => addVideo(item, "next"), "Play next"),
      createButton("+ Last", "ytun-mini", () => addVideo(item, "last"), "Add to end")
    ], () => {
      window.location.href = item.url;
    });
  }

  function renderVideoRow(item, index, actions, onPlay) {
    const row = document.createElement("li");
    row.className = "ytun-item";
    row.classList.toggle("is-played", Boolean(item.played));

    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "ytun-thumb";
    thumb.title = "Play video";
    thumb.addEventListener("click", onPlay);

    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.src = item.thumb || thumbnailUrl(item.id);
    thumb.appendChild(image);

    const details = document.createElement("div");
    details.className = "ytun-details";

    const itemTitle = document.createElement("button");
    itemTitle.type = "button";
    itemTitle.className = "ytun-item-title";
    itemTitle.textContent = item.title || "Untitled video";
    itemTitle.addEventListener("click", onPlay);

    const meta = document.createElement("div");
    meta.className = "ytun-meta";
    meta.textContent = item.played
      ? `Played${item.channel ? ` · ${item.channel}` : ""}`
      : (item.channel || `Video ${index + 1}`);

    const actionRow = document.createElement("div");
    actionRow.className = "ytun-actions";
    actions.forEach((action) => actionRow.appendChild(action));

    details.appendChild(itemTitle);
    details.appendChild(meta);
    details.appendChild(actionRow);

    row.appendChild(thumb);
    row.appendChild(details);
    return row;
  }

  function addThumbnailButtons() {
    const renderers = document.querySelectorAll(VALID_RENDERER_SELECTOR);

    renderers.forEach((renderer) => {
      if (renderer.dataset.ytunButtons === "1" || isCommentArea(renderer)) {
        return;
      }

      const anchor = renderer.querySelector([
        'a#thumbnail[href*="/watch"]',
        'a[href^="/watch"][href*="v="]',
        'a[href^="/shorts/"]'
      ].join(","));

      const video = videoFromAnchor(anchor);
      if (!video) {
        return;
      }

      const host = anchor.closest("ytd-thumbnail, yt-thumbnail-view-model, ytm-shorts-lockup-view-model") || anchor;
      if (isCommentArea(host)) {
        return;
      }

      renderer.dataset.ytunButtons = "1";
      host.classList.add("ytun-thumb-host");

      const group = document.createElement("div");
      group.className = "ytun-thumb-actions";

      const nextButton = createButton("+ Next", "ytun-thumb-button", (event) => {
        event.preventDefault();
        event.stopPropagation();
        addVideo(videoFromAnchor(anchor), "next");
      }, "Play next");

      const lastButton = createButton("+ Last", "ytun-thumb-button", (event) => {
        event.preventDefault();
        event.stopPropagation();
        addVideo(videoFromAnchor(anchor), "last");
      }, "Add to end");

      group.appendChild(nextButton);
      group.appendChild(lastButton);

      ["pointerdown", "mousedown", "mouseup", "touchstart", "click"].forEach((type) => {
        group.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      });

      host.appendChild(group);
    });
  }

  function watchMainVideo() {
    if (!["/watch", "/shorts"].some((path) => window.location.pathname.startsWith(path))) {
      return;
    }

    const mainVideo = document.querySelector("video.html5-main-video");
    if (!mainVideo || mainVideo === currentMainVideo) {
      return;
    }

    if (currentMainVideo && currentMainVideoEndedHandler) {
      currentMainVideo.removeEventListener("ended", currentMainVideoEndedHandler);
    }

    currentMainVideo = mainVideo;
    currentMainVideoEndedHandler = () => {
      window.setTimeout(() => playNext(), 120);
    };
    currentMainVideo.addEventListener("ended", currentMainVideoEndedHandler);
  }

  function ensureTheaterMode() {
    if (!isWatchPage()) {
      return;
    }

    const watchFlexy = document.querySelector("ytd-watch-flexy");
    if (watchFlexy && watchFlexy.hasAttribute("theater")) {
      return;
    }

    const sizeButton = document.querySelector(".ytp-size-button");
    const label = normalizeText(
      sizeButton &&
      `${sizeButton.getAttribute("title") || ""} ${sizeButton.getAttribute("aria-label") || ""}`
    );

    if (sizeButton && /theater/i.test(label)) {
      sizeButton.click();
    }
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      addThumbnailButtons();
      watchMainVideo();
      ensureTheaterMode();
      updateShell();
    }, 250);
  }

  async function loadWatchLater(force) {
    if (watchLaterStatus === "loading") {
      return;
    }

    if (!force && watchLaterStatus === "loaded") {
      return;
    }

    watchLaterStatus = "loading";
    watchLaterError = "";
    render();

    try {
      const response = await fetch(WATCH_LATER_URL, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const data = extractInitialData(html);
      const items = extractPlaylistVideos(data);
      watchLaterItems = dedupeVideos(items).slice(0, MAX_QUEUE_SIZE);
      watchLaterStatus = "loaded";

      if (watchLaterItems.length === 0 && /ServiceLogin|sign in|Sign in/i.test(html)) {
        watchLaterError = "Sign in to YouTube in this app to load Watch Later.";
      }
    } catch (error) {
      watchLaterStatus = "error";
      watchLaterError = `Could not load Watch Later: ${error.message || error}`;
    }

    render();
  }

  function extractInitialData(html) {
    const markers = [
      "var ytInitialData =",
      "window[\"ytInitialData\"] =",
      "ytInitialData ="
    ];

    for (const marker of markers) {
      const data = parseJsonAfterMarker(html, marker);
      if (data) {
        return data;
      }
    }

    throw new Error("Watch Later data was not found");
  }

  function parseJsonAfterMarker(source, marker) {
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    const start = source.indexOf("{", markerIndex + marker.length);
    if (start < 0) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < source.length; index += 1) {
      const char = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(source.slice(start, index + 1));
        }
      }
    }

    return null;
  }

  function extractPlaylistVideos(data) {
    const renderers = [];
    collectPlaylistRenderers(data, renderers);
    return renderers.map(videoFromPlaylistRenderer).filter(Boolean);
  }

  function collectPlaylistRenderers(node, renderers) {
    if (!node || renderers.length >= MAX_QUEUE_SIZE) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item) => collectPlaylistRenderers(item, renderers));
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    if (node.playlistVideoRenderer) {
      renderers.push(node.playlistVideoRenderer);
      return;
    }

    Object.keys(node).forEach((key) => collectPlaylistRenderers(node[key], renderers));
  }

  function videoFromPlaylistRenderer(renderer) {
    const videoId = renderer.videoId;
    if (!videoId) {
      return null;
    }

    const thumbnails = renderer.thumbnail && renderer.thumbnail.thumbnails;
    const thumb = Array.isArray(thumbnails) && thumbnails.length > 0
      ? thumbnails[thumbnails.length - 1].url
      : thumbnailUrl(videoId);

    return {
      id: videoId,
      uid: makeUid(videoId),
      title: extractText(renderer.title) || "Untitled video",
      channel: extractText(renderer.shortBylineText || renderer.longBylineText),
      thumb,
      url: videoUrl(videoId),
      addedAt: Date.now()
    };
  }

  function extractText(node) {
    if (!node) {
      return "";
    }

    if (typeof node === "string") {
      return normalizeText(node);
    }

    if (node.simpleText) {
      return normalizeText(node.simpleText);
    }

    if (Array.isArray(node.runs)) {
      return normalizeText(node.runs.map((run) => run.text || "").join(""));
    }

    if (node.text) {
      return normalizeText(node.text);
    }

    if (Array.isArray(node)) {
      return normalizeText(node.map(extractText).join(""));
    }

    return "";
  }

  function dedupeVideos(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (!item || !item.id || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }

  async function init() {
    const stored = await storage.get({
      [QUEUE_KEY]: [],
      [PANEL_KEY]: true,
      [ACTIVE_TAB_KEY]: "queue"
    });

    queue = Array.isArray(stored[QUEUE_KEY]) ? stored[QUEUE_KEY].map(normalizeQueueItem) : [];
    panelOpen = stored[PANEL_KEY] !== false;
    activeTab = stored[ACTIVE_TAB_KEY] === "watch-later" ? "watch-later" : "queue";

    mount();
    render();
    scheduleScan();

    if (activeTab === "watch-later") {
      loadWatchLater();
    }

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.addEventListener("yt-navigate-finish", () => {
      advancing = false;
      scheduleScan();
    });
    window.addEventListener("popstate", scheduleScan);
    window.setInterval(scheduleScan, 2500);
  }

  init();
})();
