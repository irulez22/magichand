# Touchscreen PC setup

Turns a Windows touchscreen PC into a self-updating Magic Hand Play kiosk.
The repository is **public**, so no key or GitHub login is needed on the PC.
You need internet once (to clone), Git for Windows and Microsoft Edge.

## 1. Run setup

Double-click **`Setup.cmd`** (recommended), or from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-TouchscreenPc.ps1
```

It:

1. installs Git for Windows with winget if it is missing;
2. clones `https://github.com/irulez22/magichand.git` to `C:\MagicHand`
   (or adopts an existing copy there);
3. installs the launcher in `%LOCALAPPDATA%\MagicHand\launcher`;
4. creates a **Magic Hand Play** desktop shortcut.

Useful switches:

| Switch | Effect |
| --- | --- |
| `-InstallDir D:\MagicHand` | install somewhere else |
| `-CreateTask` | also start at logon (scheduled task `MagicHandPlay`) |
| `-Launch` | start the kiosk when setup finishes |
| `-DryRun` | check prerequisites and print actions only |
| `-SshKey` | private repo only: create a deploy key and use an SSH remote |

If the PC cannot reach GitHub at all, extract the complete kit zip to `C:\MagicHand`
and use `Launch-Kiosk.cmd`; run setup later when the network allows it.

### Private repo (optional)

Pass `-SshKey -Repo git@github.com:irulez22/magichand.git`. Setup prints a public key
to add at `https://github.com/irulez22/magichand/settings/keys` (read-only deploy key).
Note: some networks block SSH port 22. HTTPS is the default for a reason.

## 2. Daily use

Double-click **Magic Hand Play** (or the launcher `.cmd`). It:

1. takes a lock so two copies cannot run;
2. shows a small **Magic Hand Play** window with a progress bar while it checks GitHub;
3. fetches `origin/main` and resets to it when there is a newer commit;
4. checks that `index.html` and `js\app.js` exist, otherwise rolls back;
5. starts Edge in kiosk mode with a dedicated profile;
6. keeps the lock until the kiosk closes, so updates never run mid-session.

**Offline:** the check fails quickly, a line is logged, the splash closes and the local copy launches normally.
If `git` is missing or the local files were edited, it also launches the local copy
without updating. Pass `-NoSplash` to skip the window, or `-NoLaunch` to update and exit.

Log: `%LOCALAPPDATA%\MagicHand\logs\launcher.log`

## 3. How updates reach the PC

From the development machine:

```powershell
git -C G:\Codex\Projects\MagicHand add -A
git -C G:\Codex\Projects\MagicHand commit -m "fix: ..."
git -C G:\Codex\Projects\MagicHand push
```

The PC picks it up on the next launch. The kiosk profile
(`%LOCALAPPDATA%\MagicHand\kiosk-profile`) is outside the repo, so settings,
calibration and picture pairs survive updates.

## 4. Updating the launcher itself

The launcher is copied out of the repo so an update cannot break it mid-run.
After changing `pc\*.ps1` in the repo, re-run `Setup.cmd` on the PC (or copy the
two files into `%LOCALAPPDATA%\MagicHand\launcher`).

Once this version is installed, it also refreshes its installed copy for the
**next** start whenever an app update is applied, so later launcher changes do
not need another manual setup. The first install of the splash version still
needs `Setup.cmd` once on each PC.

## 5. Rollback and recovery

- Every launch logs the commit it runs.
- If a new commit is missing app files, the launcher resets to the previous commit.
- To pin a known-good commit by hand:

```powershell
git -C C:\MagicHand reset --hard <commit>
```

## 6. Uninstall

Remove the shortcut, the scheduled task (`Unregister-ScheduledTask MagicHandPlay`),
`C:\MagicHand`, and `%LOCALAPPDATA%\MagicHand`. The deploy key (if any) can be
deleted in the repository settings.
