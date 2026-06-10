const path = require("node:path");

const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  nativeImage,
  session,
  shell
} = require("electron");

const APP_NAME = "YouTube Up Next";
const START_URL = "https://www.youtube.com/";
const WINDOW_WIDTH = 1600;
const WINDOW_HEIGHT = 900;
const WINDOW_X = 80;
const WINDOW_Y = 60;

app.setName(APP_NAME);
app.setPath("userData", path.join(app.getPath("appData"), APP_NAME));

function isHttpUrl(urlValue) {
  try {
    const url = new URL(urlValue);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function isAppUrl(urlValue) {
  try {
    const url = new URL(urlValue);
    const host = url.hostname.toLowerCase();

    return (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "gstatic.com" ||
      host.endsWith(".gstatic.com") ||
      host === "ytimg.com" ||
      host.endsWith(".ytimg.com") ||
      host === "googleusercontent.com" ||
      host.endsWith(".googleusercontent.com")
    );
  } catch (_error) {
    return false;
  }
}

function extensionPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "extension");
  }

  return path.join(__dirname, "..", "extension");
}

function chromeCompatibleUserAgent() {
  return session.defaultSession.getUserAgent().replace(/\sElectron\/\S+/g, "");
}

async function loadUpNextExtension() {
  const targetSession = session.defaultSession;
  const targetExtensionPath = extensionPath();

  if (targetSession.extensions && typeof targetSession.extensions.loadExtension === "function") {
    return targetSession.extensions.loadExtension(targetExtensionPath, {
      allowFileAccess: false
    });
  }

  return targetSession.loadExtension(targetExtensionPath, {
    allowFileAccess: false
  });
}

function setDockIcon() {
  if (process.platform !== "darwin") {
    return;
  }

  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "youtube-up-next.icns"));
  if (!icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
}

function createMenu(mainWindow) {
  const isMac = process.platform === "darwin";
  const backAccelerator = isMac ? "Command+Left" : "Alt+Left";
  const forwardAccelerator = isMac ? "Command+Right" : "Alt+Right";

  const template = [
    ...(isMac
      ? [{
          label: APP_NAME,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" }
          ]
        }]
      : []),
    {
      label: "File",
      submenu: [
        isMac ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" }
      ]
    },
    {
      label: "Navigate",
      submenu: [
        {
          label: "Back",
          accelerator: backAccelerator,
          click() {
            if (mainWindow.webContents.canGoBack()) {
              mainWindow.webContents.goBack();
            }
          }
        },
        {
          label: "Forward",
          accelerator: forwardAccelerator,
          click() {
            if (mainWindow.webContents.canGoForward()) {
              mainWindow.webContents.goForward();
            }
          }
        },
        { type: "separator" },
        {
          label: "YouTube Home",
          accelerator: isMac ? "Command+Shift+H" : "Control+H",
          click() {
            mainWindow.loadURL(START_URL);
          }
        }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" }
            ]
          : [])
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function attachContextMenu(mainWindow) {
  mainWindow.webContents.on("context-menu", (_event, params) => {
    const template = [];

    if (params.isEditable) {
      template.push(
        { role: "undo", enabled: params.editFlags.canUndo },
        { role: "redo", enabled: params.editFlags.canRedo },
        { type: "separator" },
        { role: "cut", enabled: params.editFlags.canCut },
        { role: "copy", enabled: params.editFlags.canCopy },
        { role: "paste", enabled: params.editFlags.canPaste },
        { role: "pasteAndMatchStyle", enabled: params.editFlags.canPaste },
        { role: "delete", enabled: params.editFlags.canDelete },
        { type: "separator" },
        { role: "selectAll", enabled: params.editFlags.canSelectAll }
      );
    } else if (params.selectionText) {
      template.push(
        { role: "copy", enabled: params.editFlags.canCopy },
        { type: "separator" },
        {
          label: "Search Google for Selection",
          click() {
            const query = encodeURIComponent(params.selectionText);
            shell.openExternal(`https://www.google.com/search?q=${query}`);
          }
        }
      );
    }

    if (template.length > 0) {
      Menu.buildFromTemplate(template).popup({ window: mainWindow });
    }
  });
}

function configureSession() {
  const targetSession = session.defaultSession;
  const userAgent = chromeCompatibleUserAgent();

  targetSession.setUserAgent(userAgent);
  targetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    const allowedPermissions = new Set(["fullscreen", "media", "notifications", "pointerLock"]);
    callback(isAppUrl(requestingUrl) && allowedPermissions.has(permission));
  });
}

function createWindow() {
  const userAgent = chromeCompatibleUserAgent();
  const mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: WINDOW_X,
    y: WINDOW_Y,
    minWidth: 1024,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: "#0f0f0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  mainWindow.webContents.setUserAgent(userAgent);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) {
      mainWindow.loadURL(url, { userAgent });
    } else if (isHttpUrl(url)) {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url) || url.startsWith("about:")) {
      return;
    }

    event.preventDefault();
    if (isHttpUrl(url)) {
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(START_URL, { userAgent });
  createMenu(mainWindow);
  attachContextMenu(mainWindow);
  return mainWindow;
}

app.whenReady().then(async () => {
  setDockIcon();
  configureSession();

  let extensionError;
  try {
    await loadUpNextExtension();
  } catch (error) {
    extensionError = error;
    console.error("Could not load the YouTube Up Next extension:", error);
  }

  createWindow();

  if (extensionError) {
    dialog.showErrorBox(
      "YouTube Up Next extension did not load",
      `The app opened YouTube, but the Up Next extension failed to load.\n\n${extensionError.message || extensionError}`
    );
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
