const { app, BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const isDev =
  process.env.NODE_ENV === 'development' ||
  process.env.ELECTRON_DEV === '1' ||
  !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    win.loadURL(pathToFileURL(indexPath).href);
  }
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
