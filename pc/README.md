# Touchscreen PC setup

These scripts turn a Windows touchscreen PC into a self-updating Magic Hand Play kiosk.
You need internet once (to clone), Git for Windows, and Microsoft Edge (preinstalled on Windows 10/11).

## 1. Let setup create a deploy key

Run PowerShell and start setup:

```powershell
cd <this folder>
powershell -ExecutionPolicy Bypass -File Setup-TouchscreenPc.ps1
```

It creates `%USERPROFILE%\.ssh\magichand_deploy`, prints the public key and waits.
Add that key as a **read-only Deploy key** in the repo:

<https://github.com/irulez22/magichand/settings/keys>

Then press Enter. Setup clones the repo to `C:\MagicHand`, installs the launcher in
`%LOCALAPPDATA%\MagicHand\launcher`, and creates a **Magic Hand Play** desktop shortcut.

Useful switches:

| Switch | Effect |
| --- | --- |
| `-InstallDir D:\MagicHand` | clone somewhere else |
| `-CreateTask` | also start at logon (scheduled task `MagicHandPlay`) |
| `-Launch` | start the kiosk when setup finishes |
| `-NonInteractive` | do not pause for the deploy key |
| `-DryRun` | check prerequisites and print actions only |

## 2. Daily use

Double-click **Magic Hand Play** (or the launcher `.cmd`). It:

1. takes a lock so two copies cannot run;
2. fetches `origin/main` and resets to it when there is a newer commit;
3. checks that `index.html` and `js\app.js` exist, otherwise rolls back;
4. starts Edge in kiosk mode with a dedicated profile;
5. keeps the lock until the kiosk closes, so updates never run mid-session.

**Offline:** the fetch fails, a line is logged, and the local copy launches normally.
If `git` is missing or the local files were edited, it also launches the local copy
without updating.

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
After changing `pc\*.ps1` in the repo, re-run `Setup-TouchscreenPc.ps1` on the PC
(or copy the two files into `%LOCALAPPDATA%\MagicHand\launcher`).

## 5. Rollback and recovery

- Every launch logs the commit it runs.
- If the new commit is missing app files, the launcher resets to the previous commit.
- To pin a known-good commit by hand:

```powershell
git -C C:\MagicHand reset --hard <commit>
```

## 6. Uninstall

Remove the shortcut, the scheduled task (`Unregister-ScheduledTask MagicHandPlay`),
`C:\MagicHand`, and `%LOCALAPPDATA%\MagicHand`. The deploy key can be deleted from
the repository settings.
