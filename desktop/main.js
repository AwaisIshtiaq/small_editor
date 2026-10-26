// Small Editor Desktop — Electron wrapper around the Next.js standalone
// server. The app spawns the bundled server.js on a fixed localhost port,
// waits for it to answer, then loads it in a window. Everything (engine,
// temp store, OCR/Office binaries on Linux builds) runs locally; files never
// leave the machine.
const { app, BrowserWindow, shell, Menu } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')

const PORT = process.env.SMALL_EDITOR_PORT || 3847
const HOST = '127.0.0.1'
const URL_BASE = `http://${HOST}:${PORT}`

let serverProc = null
let win = null

function serverEntry() {
  // dev: repo layout — production: packaged extraResource
  const packaged = path.join(process.resourcesPath || '', 'server.js')
  if (app.isPackaged) return { script: packaged, cwd: path.dirname(packaged) }
  return {
    script: path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
    cwd: path.join(__dirname, '..', '.next', 'standalone'),
  }
}

function startServer() {
  const { script, cwd } = serverEntry()
  serverProc = spawn(process.execPath, [script], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      HOSTNAME: HOST,
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  serverProc.on('exit', (code) => {
    if (!app.isQuitting) {
      // server crashed unexpectedly — surface it instead of a white window
      dialog.showErrorBox('Small Editor', `The local engine exited unexpectedly (${code}). Restart the app.`)
      app.quit()
    }
  })
}

function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(`${URL_BASE}/api/health`, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (n <= 0) return reject(new Error('engine did not start'))
        setTimeout(() => attempt(n - 1), 500)
      })
    }
    attempt(retries)
  })
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Small Editor',
    backgroundColor: '#f7f7f8',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // External links open in the user's browser, never inside the app shell
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(URL_BASE)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  win.loadURL(URL_BASE)
  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(async () => {
  buildMenu()
  createWindow()
  try {
    await waitForServer()
  } catch {
    // window shows; the app UI itself surfaces engine errors per-task
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.isQuitting = true
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (serverProc && !serverProc.killed) serverProc.kill()
})
