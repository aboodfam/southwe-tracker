# Ceventic System — Windows Desktop Build

The repository now supports both the existing Vercel web app and a native Windows desktop wrapper powered by Tauri 2.

## Fastest option: build on GitHub

You do not need Rust or Visual Studio on your own computer for this method.

1. Commit and push these desktop files to GitHub.
2. Open the repository on GitHub.
3. Open **Actions**.
4. Choose **Build Ceventic Windows App**.
5. Click **Run workflow** → **Run workflow**.
6. Wait for the Windows build to finish.
7. Open the completed workflow run.
8. Under **Artifacts**, download **Ceventic-System-Windows-x64**.
9. Extract the downloaded ZIP.
10. Run the `*-setup.exe` file to install Ceventic System, or use `ceventic-system.exe` as the direct executable.

The installer is currently unsigned. Windows SmartScreen may warn that the publisher is unknown. This is expected for a personal unsigned build; code signing can be added later.

## Build locally on Windows

Install:

- Node.js 22 or newer
- Rust (stable MSVC toolchain)
- Microsoft Visual Studio Build Tools with **Desktop development with C++**
- WebView2 Runtime (normally already included with Windows 10/11)

Then, from the repository folder:

```powershell
npm install
npm run desktop:dev
```

To make the Windows installer:

```powershell
npm run desktop:build
```

The main outputs will be under:

```text
src-tauri/target/release/ceventic-system.exe
src-tauri/target/release/bundle/nsis/
```

## Backend / account data

Desktop mode uses `.env.desktop`, which points to the same production Convex deployment as the current Ceventic web app. Signing in with the same account therefore uses the same online account/data backend.

If the production Convex deployment URL changes in the future, update `VITE_CONVEX_URL` inside `.env.desktop` before rebuilding the desktop app.

## Useful commands

```powershell
npm run dev                 # Existing web + Convex development
npm run build               # Existing Vite web build
npm run desktop:dev         # Windows desktop development window
npm run desktop:build       # Build executable + configured installer
npm run desktop:build:nsis  # Explicitly build the NSIS installer
```
