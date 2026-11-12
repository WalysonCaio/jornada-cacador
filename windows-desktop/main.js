const { app, BrowserWindow, shell } = require('electron');

const APP_URL = 'https://jornada.wcaio.workers.dev';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 620,
    autoHideMenuBar: true,
    backgroundColor: '#06101c',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadURL(APP_URL);
  const openSafeExternal = (url) => {
    try {
      const parsed = new URL(url);
      if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
        shell.openExternal(parsed.href).catch(() => undefined);
      }
    } catch { /* URL inválida: ignora. */ }
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    openSafeExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin === new URL(APP_URL).origin) return;
    } catch { /* URL inválida: bloqueia. */ }
    event.preventDefault();
    openSafeExternal(url);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
