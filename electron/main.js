const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

// Windows overlay scrollbars ignore ::-webkit-scrollbar — force classic bars in the .exe
if (process.platform === 'win32') {
  app.commandLine.appendSwitch(
    'disable-features',
    'OverlayScrollbar,WindowsOverlayScrollbar,FluentOverlayScrollbar',
  );
}

const iconPath = path.join(__dirname, 'icon.png');
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    title: 'RotVault',
    icon: iconPath,
    frame: false,
    backgroundColor: '#0f0f1a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));

  win.on('maximize', () => {
    win.webContents.send('window:maximized-changed', true);
  });

  win.on('unmaximize', () => {
    win.webContents.send('window:maximized-changed', false);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  if (win.isMaximized()) {
    win.unmaximize();
    return false;
  }
  win.maximize();
  return true;
});

ipcMain.handle('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('window:isMaximized', (event) => (
  BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
));

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
