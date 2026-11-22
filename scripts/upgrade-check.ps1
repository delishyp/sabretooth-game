# Windows upgrade evidence. The installed app checks a loopback feed and calls quitAndInstall itself.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('install-old', 'seed', 'inventory', 'rewrite-feed', 'ensure-stable', 'watch-update', 'assert')]
  [string]$Step,
  [string]$Installer,
  [string]$ExpectExe,
  [string]$SetupName,
  [string]$FeedUrl,
  [ValidateSet('', 'transitional', 'in-app')]
  [string]$Mode = '',
  [ValidateSet('', 'before', 'after')]
  [string]$When = '',
  [string]$Label = '',
  [string]$Url = '',
  [string]$OutDir = 'upgrade-evidence'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$save = Join-Path $env:APPDATA 'Sabretooth\saves\anna-save.txt'

function Ensure-Win32 {
  if ('SbWin' -as [type]) { return }
  Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class SbWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, int m, IntPtr w, IntPtr l);
  static string Text(IntPtr h) {
    var sb = new StringBuilder(512);
    GetWindowText(h, sb, sb.Capacity);
    return sb.ToString();
  }
  public static List<string> Visible() {
    var list = new List<string>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var t = Text(h);
      if (t.Length > 0) list.Add(h.ToInt64().ToString() + "\t" + t);
      return true;
    }, IntPtr.Zero);
    return list;
  }
  public static void ForceFront(IntPtr h) {
    IntPtr fore = GetForegroundWindow();
    uint ft = GetWindowThreadProcessId(fore, IntPtr.Zero);
    uint me = GetCurrentThreadId();
    AttachThreadInput(ft, me, true);
    ShowWindow(h, 9);
    SetForegroundWindow(h);
    AttachThreadInput(ft, me, false);
  }
  public static void Minimize(IntPtr h) { ShowWindow(h, 6); }
  public static string ClickButton(IntPtr dialog, string caption) {
    IntPtr found = IntPtr.Zero;
    EnumChildWindows(dialog, (h, l) => {
      if (Text(h) == caption) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    if (found == IntPtr.Zero) return "missing-button";
    SendMessage(found, 0x00F5, IntPtr.Zero, IntPtr.Zero);
    return "button";
  }
}
'@
}

function Get-VisibleWindows {
  Ensure-Win32
  return @([SbWin]::Visible())
}

function Save-Shot([string]$Name, [switch]$Force) {
  try {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
    $tmp = Join-Path $env:TEMP ("sb-shot-" + [guid]::NewGuid().ToString() + ".png")
    $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    $hash = (Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash
    if (-not $Force -and $hash -eq $script:lastShotHash) { Remove-Item -LiteralPath $tmp -Force; return }
    $dest = Join-Path $OutDir $Name
    Move-Item -LiteralPath $tmp -Destination $dest -Force
    $script:lastShotHash = $hash
  } catch {
    Add-Content -Path (Join-Path $OutDir 'shot-errors.txt') -Value $_.Exception.Message
  }
}

function Test-WizardTitle([string]$Title) {
  return $Title -match 'Setup|Installation Options|per-user|per user|already a'
}

function Get-UninstallEntries {
  $roots = @(
    @{ Hive = 'HKCU'; Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' },
    @{ Hive = 'HKLM'; Path = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall' },
    @{ Hive = 'HKLM-WOW'; Path = 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' }
  )
  $out = @()
  foreach ($root in $roots) {
    if (-not (Test-Path $root.Path)) { continue }
    foreach ($k in @(Get-ChildItem $root.Path -ErrorAction SilentlyContinue)) {
      $p = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
      if ($p.DisplayName -match 'Sabretooth') {
        $out += [pscustomobject]@{
          Hive = $root.Hive
          Key = $k.Name
          Name = $p.DisplayName
          Version = $p.DisplayVersion
          Location = ([string]$p.InstallLocation).Trim().Trim('"')
          DisplayIcon = [string]$p.DisplayIcon
          UninstallString = [string]$p.UninstallString
        }
      }
    }
  }
  return @($out)
}

function Find-SabretoothExe {
  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($e in @(Get-UninstallEntries)) {
    if ($e.Location) { [void]$candidates.Add((Join-Path $e.Location.TrimEnd('\') 'Sabretooth.exe')) }
    foreach ($raw in @($e.DisplayIcon, $e.UninstallString)) {
      if (-not $raw) { continue }
      $clean = ($raw -replace '^"', '' -replace '",.*$', '' -replace ',0$', '').Trim()
      if ($clean -match '\.exe$') { [void]$candidates.Add($clean) }
    }
  }
  foreach ($rel in @(
    'Programs\Sabretooth\Sabretooth.exe',
    'Programs\sabretooth\Sabretooth.exe'
  )) {
    [void]$candidates.Add((Join-Path $env:LOCALAPPDATA $rel))
  }
  foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
    if ($root) { [void]$candidates.Add((Join-Path $root 'Sabretooth\Sabretooth.exe')) }
  }
  foreach ($c in $candidates) {
    if ($c -and (Test-Path -LiteralPath $c)) { return (Resolve-Path -LiteralPath $c).Path }
  }
  return $null
}

function Get-InstallRoot {
  $exe = Find-SabretoothExe
  if (-not $exe) {
    $listed = @(Get-UninstallEntries | ForEach-Object { "$($_.Hive) $($_.Name) loc=$($_.Location) icon=$($_.DisplayIcon)" })
    throw "Sabretooth.exe was not found. uninstall=$($listed -join ' || ')"
  }
  return (Split-Path -Parent $exe)
}

function Get-InstalledExe {
  return (Join-Path (Get-InstallRoot) 'Sabretooth.exe')
}

function Write-Inventory([string]$Name) {
  $entries = @(Get-UninstallEntries)
  $keyLines = @($entries | ForEach-Object { "$($_.Hive) | $($_.Key) | $($_.Name) | $($_.Version) | $($_.Location)" })
  if ($keyLines.Count -eq 0) { '' | Set-Content (Join-Path $OutDir "$Name-uninstall.txt") }
  else { $keyLines | Set-Content (Join-Path $OutDir "$Name-uninstall.txt") }
  $folderLines = @()
  $localRoot = Join-Path $env:LOCALAPPDATA 'Programs'
  if (Test-Path $localRoot) {
    foreach ($dir in @(Get-ChildItem $localRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'abretooth' })) {
      $folderLines += "local|$($dir.FullName)"
    }
  }
  foreach ($pair in @(
    @{ Tag = 'pf'; Root = $env:ProgramFiles },
    @{ Tag = 'pfx86'; Root = ${env:ProgramFiles(x86)} }
  )) {
    if (-not $pair.Root -or -not (Test-Path -LiteralPath $pair.Root)) { continue }
    foreach ($dir in @(Get-ChildItem -LiteralPath $pair.Root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'abretooth' })) {
      $folderLines += "$($pair.Tag)|$($dir.FullName)"
    }
  }
  if ($folderLines.Count -eq 0) { '' | Set-Content (Join-Path $OutDir "$Name-folders.txt") }
  else { $folderLines | Set-Content (Join-Path $OutDir "$Name-folders.txt") }
}

function Stop-SabretoothSettled {
  $deadline = (Get-Date).AddSeconds(10)
  do {
    Get-Process -Name Sabretooth -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 400
  } while ((Get-Date) -lt $deadline)
  Start-Sleep -Seconds 2
  Get-Process -Name Sabretooth -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  $left = @(Get-Process -Name Sabretooth -ErrorAction SilentlyContinue)
  if ($left.Count -gt 0) { throw "Sabretooth still running after kill: $($left.Id -join ',')" }
}

function Get-SabretoothInfo {
  $procs = @(Get-Process -Name Sabretooth -ErrorAction SilentlyContinue)
  $pids = @($procs | ForEach-Object { [string]$_.Id })
  $vers = New-Object System.Collections.Generic.List[string]
  foreach ($p in $procs) {
    try {
      $exePath = $p.Path
      if (-not $exePath) { continue }
      $v = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($exePath).FileVersion
      if ($v -and -not $vers.Contains($v)) { [void]$vers.Add($v) }
    } catch { }
  }
  return [pscustomobject]@{ Pids = $pids; Versions = @($vers) }
}

function Get-FileVersion([string]$Path) {
  return [System.Diagnostics.FileVersionInfo]::GetVersionInfo((Resolve-Path -LiteralPath $Path)).FileVersion
}

function Read-Lines([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return @() }
  return @(Get-Content -LiteralPath $Path | Where-Object { $_ -ne '' })
}

function Read-One([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return '' }
  return ((Get-Content -LiteralPath $Path -Raw).Trim())
}

if ($Step -eq 'install-old') {
  if ($Installer -match '__uninstaller') { throw "refusing uninstaller: $Installer" }
  Remove-Item Env:\SABRETOOTH_CI_AUTOUPDATE -ErrorAction SilentlyContinue
  Remove-Item Env:\SABRETOOTH_CI_UPDATE_URL -ErrorAction SilentlyContinue
  $log = Join-Path $OutDir 'install-old.log'
  $nodes = @(Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id) $($_.Path)" })
  @(
    'match=run 44187012811 Start-Process -ArgumentList /S,/currentuser -PassThru -Wait'
    "cwd=$(Get-Location)"
    'workingDirectory=default'
    'args=/S /currentuser'
    "SABRETOOTH_CI_AUTOUPDATE=[$($env:SABRETOOTH_CI_AUTOUPDATE)]"
    "SABRETOOTH_CI_UPDATE_URL=[$($env:SABRETOOTH_CI_UPDATE_URL)]"
    "installer=$Installer"
    "node=[$($nodes -join '; ')]"
  ) | Set-Content $log
  $p = Start-Process -FilePath $Installer -ArgumentList '/S', '/currentuser' -PassThru -Wait
  "exit=$($p.ExitCode)" | Add-Content $log
  $found = Find-SabretoothExe
  if ($found) { "exe=$found" | Add-Content $log } else { 'exe=missing' | Add-Content $log }
  if ($p.ExitCode -ne 0 -or -not $found) { exit 1 }
  Stop-SabretoothSettled
  exit 0
}

if ($Step -eq 'seed') {
  New-Item -ItemType Directory -Force -Path (Split-Path $save) | Out-Null
  Set-Content -Path $save -Value 'anna-save-v1' -NoNewline
  $hash = (Get-FileHash -LiteralPath $save -Algorithm SHA256).Hash
  Set-Content (Join-Path $OutDir 'save-sha256-before.txt') $hash
  Write-Output $hash
  exit 0
}

if ($Step -eq 'inventory') {
  if (-not $Label -or -not $When) { throw 'inventory needs -Label and -When' }
  Write-Inventory "$Label-$When"
  exit 0
}

if ($Step -eq 'rewrite-feed') {
  if (-not $Url -or -not $Label) { throw 'rewrite-feed needs -Url and -Label' }
  $root = Get-InstallRoot
  $yml = @(Get-ChildItem -LiteralPath $root -Recurse -Filter 'app-update.yml' -ErrorAction SilentlyContinue)
  if ($yml.Count -ne 1) { throw "expected one app-update.yml under $root, found $($yml.Count)" }
  $text = "provider: generic`r`nurl: $Url`r`n"
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($yml[0].FullName, $text, $utf8)
  Copy-Item -LiteralPath $yml[0].FullName -Destination (Join-Path $OutDir "$Label-app-update.yml") -Force
  exit 0
}

if ($Step -eq 'ensure-stable') {
  if (-not $Installer -or -not $ExpectExe) { throw 'ensure-stable needs -Installer and -ExpectExe' }
  if ($Installer -match '__uninstaller') { throw "refusing uninstaller: $Installer" }
  $want = Get-FileVersion $ExpectExe
  $have = ''
  try { $have = Get-FileVersion (Get-InstalledExe) } catch { $have = '' }
  if ($have -eq $want) {
    Stop-SabretoothSettled
    "already $have" | Set-Content (Join-Path $OutDir 'ensure-stable.log')
    exit 0
  }
  $p = Start-Process -FilePath $Installer -ArgumentList '/S' -PassThru -Wait
  "installed exit=$($p.ExitCode) from=$have want=$want" | Set-Content (Join-Path $OutDir 'ensure-stable.log')
  Stop-SabretoothSettled
  $now = Get-FileVersion (Get-InstalledExe)
  if ($now -ne $want) { throw "installed FileVersion $now, wanted $want" }
  if ($p.ExitCode -ne 0) { exit $p.ExitCode }
  exit 0
}

if ($Step -eq 'watch-update') {
  if (-not $Mode -or -not $SetupName -or -not $ExpectExe -or -not $Label) { throw 'watch-update needs -Mode -SetupName -ExpectExe -Label' }
  if ($SetupName -match '__uninstaller') { throw "refusing uninstaller name: $SetupName" }
  if ($Mode -eq 'in-app' -and -not $FeedUrl) { throw 'in-app watch needs -FeedUrl' }
  Remove-Item -LiteralPath (Join-Path $env:TEMP 'sabretooth-nsis.log') -ErrorAction SilentlyContinue
  Stop-SabretoothSettled
  $expected = Get-FileVersion $ExpectExe
  Set-Content (Join-Path $OutDir "$Label-expected-fileversion.txt") $expected
  $exe = Get-InstalledExe
  $launched = Get-FileVersion $exe
  Set-Content (Join-Path $OutDir "$Label-launched-fileversion.txt") $launched
  $feedFile = @(Get-ChildItem -LiteralPath (Get-InstallRoot) -Recurse -Filter 'app-update.yml')
  if ($feedFile.Count -eq 1) { Copy-Item $feedFile[0].FullName (Join-Path $OutDir "$Label-app-update.yml") -Force }
  if ($Mode -eq 'in-app') {
    $env:SABRETOOTH_CI_AUTOUPDATE = '1'
    $env:SABRETOOTH_CI_UPDATE_URL = $FeedUrl
  } else {
    Remove-Item Env:\SABRETOOTH_CI_AUTOUPDATE -ErrorAction SilentlyContinue
    Remove-Item Env:\SABRETOOTH_CI_UPDATE_URL -ErrorAction SilentlyContinue
  }
  $proc = Start-Process -FilePath $exe -PassThru
  $allTitles = New-Object System.Collections.Generic.List[string]
  $wizard = New-Object System.Collections.Generic.List[string]
  $cmdlines = New-Object System.Collections.Generic.List[string]
  $processNames = New-Object System.Collections.Generic.List[string]
  $beforeSnap = $null
  $waitedChildren = $false
  $setupSeen = $false
  $setupExitAt = $null
  $dialog = $(if ($Mode -eq 'transitional') { 'missing' } else { 'n/a' })
  $shotN = 0
  $nextShot = [datetime]::MinValue
  $deadline = (Get-Date).AddSeconds(240)
  while ((Get-Date) -lt $deadline) {
    if (-not $setupSeen -and -not $beforeSnap) {
      $info = Get-SabretoothInfo
      if ($info.Pids.Count -gt 0) {
        if (-not $waitedChildren) { $waitedChildren = $true; Start-Sleep -Milliseconds 800 }
        $beforeSnap = Get-SabretoothInfo
        if ($beforeSnap.Pids.Count -eq 0) { $beforeSnap = $info }
      }
    }
    if ($Mode -eq 'transitional' -and $dialog -eq 'missing' -and -not $setupSeen) {
      $dlg = @(Get-VisibleWindows | Where-Object { ($_ -split "`t", 2)[1] -eq 'Update ready' } | Select-Object -First 1)
      if ($dlg.Count -eq 1) {
        $hwnd = [IntPtr]::new([long](($dlg[0] -split "`t", 2)[0]))
        [SbWin]::ForceFront($hwnd)
        Save-Shot "$Label-dialog.png" -Force
        $dialog = [SbWin]::ClickButton($hwnd, 'Restart now')
        if ($dialog -ne 'button') {
          Add-Type -AssemblyName System.Windows.Forms
          [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
          $dialog = 'enter'
        }
      }
    }
    $live = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Sabretooth|Setup|uninstaller' })
    foreach ($row in $live) {
      if (-not $processNames.Contains($row.Name)) { [void]$processNames.Add([string]$row.Name) }
      if ($row.Name -eq $SetupName) {
        $setupSeen = $true
        $line = [string]$row.CommandLine
        if ($line -and -not $cmdlines.Contains($line)) { [void]$cmdlines.Add($line) }
      }
    }
    if ($setupSeen -and -not @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $SetupName })) {
      if (-not $setupExitAt) { $setupExitAt = Get-Date }
    }
    foreach ($row in @(Get-VisibleWindows)) {
      $title = ($row -split "`t", 2)[1]
      if (-not $allTitles.Contains($title)) { [void]$allTitles.Add($title) }
      $watching = $setupSeen -and ((-not $setupExitAt) -or (((Get-Date) - $setupExitAt).TotalSeconds -le 3))
      if ($watching -and (Test-WizardTitle $title) -and -not $wizard.Contains($title)) { [void]$wizard.Add($title) }
    }
    $watchingShot = $setupSeen -and ((-not $setupExitAt) -or (((Get-Date) - $setupExitAt).TotalSeconds -le 3))
    if ($watchingShot -and (Get-Date) -ge $nextShot) {
      $shotN++
      Save-Shot ("{0}-{1:d2}.png" -f $Label, $shotN)
      $nextShot = (Get-Date).AddSeconds(1.5)
    }
    if ($setupExitAt -and ((Get-Date) - $setupExitAt).TotalSeconds -ge 3) { break }
    Start-Sleep -Milliseconds 400
  }
  if (-not $beforeSnap) { $beforeSnap = Get-SabretoothInfo }
  $after = Get-SabretoothInfo
  if ($setupSeen) {
    $until = (Get-Date).AddSeconds(45)
    do {
      $after = Get-SabretoothInfo
      $stillNow = @()
      foreach ($id in @($beforeSnap.Pids)) {
        try {
          $alive = Get-Process -Id ([int]$id) -ErrorAction Stop
          if ($alive.ProcessName -eq 'Sabretooth') { $stillNow += $id }
        } catch { }
      }
      $fresh = @($after.Pids | Where-Object { $beforeSnap.Pids -notcontains $_ })
      if ($fresh.Count -gt 0 -and $stillNow.Count -eq 0 -and @($after.Versions) -contains $expected) { break }
      Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $until)
  }
  $still = @()
  foreach ($id in @($beforeSnap.Pids)) {
    $alive = @(Get-Process -Id ([int]$id) -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'Sabretooth' })
    if ($alive.Count -gt 0) { $still += $id }
  }
  $rows = @(Get-VisibleWindows)
  foreach ($row in $rows) {
    $hwndText = $row -split "`t", 2
    $title = $hwndText[1]
    $isApp = $title -eq 'Sabretooth' -or ($title -like 'Sabretooth*' -and $title -notmatch 'Setup')
    $isConsole = $title -match 'PowerShell|pwsh|Command Prompt|Windows Terminal|GitHub Actions'
    $hwnd = [IntPtr]::new([long]($hwndText[0]))
    if ($isConsole) { [SbWin]::Minimize($hwnd) }
    if ($isApp) { $appHwnd = $hwnd }
  }
  if ($appHwnd) { [SbWin]::ForceFront($appHwnd) }
  Start-Sleep -Milliseconds 600
  Save-Shot "$Label-app.png" -Force
  @($beforeSnap.Pids) | Set-Content (Join-Path $OutDir "$Label-before-pids.txt")
  @($after.Pids) | Set-Content (Join-Path $OutDir "$Label-after-pids.txt")
  if (@($still).Count -eq 0) { '' | Set-Content (Join-Path $OutDir "$Label-still-before.txt") } else { $still | Set-Content (Join-Path $OutDir "$Label-still-before.txt") }
  @($beforeSnap.Versions) -join ',' | Set-Content (Join-Path $OutDir "$Label-before-fileversion.txt")
  @($after.Versions) -join ',' | Set-Content (Join-Path $OutDir "$Label-after-fileversion.txt")
  $(if ($setupSeen) { 'yes' } else { 'no' }) | Set-Content (Join-Path $OutDir "$Label-setup-seen.txt")
  $dialog | Set-Content (Join-Path $OutDir "$Label-dialog.txt")
  if ($wizard.Count -eq 0) { '' | Set-Content (Join-Path $OutDir "$Label-wizard.txt") } else { $wizard | Set-Content (Join-Path $OutDir "$Label-wizard.txt") }
  $allTitles | Set-Content (Join-Path $OutDir "$Label-windows.txt")
  if ($cmdlines.Count -eq 0) { '' | Set-Content (Join-Path $OutDir "$Label-setup-cmdline.txt") } else { $cmdlines | Set-Content (Join-Path $OutDir "$Label-setup-cmdline.txt") }
  $processNames | Set-Content (Join-Path $OutDir "$Label-processes.txt")
  $nsisSrc = Join-Path $env:TEMP 'sabretooth-nsis.log'
  if (Test-Path -LiteralPath $nsisSrc) { Copy-Item $nsisSrc (Join-Path $OutDir "$Label-nsis.log") -Force }
  $menu = Join-Path $env:APPDATA 'Sabretooth\logs\menu.log'
  if (Test-Path -LiteralPath $menu) { Copy-Item $menu (Join-Path $OutDir "$Label-menu.log") -Force }
  if (Test-Path -LiteralPath $save) { (Get-FileHash -LiteralPath $save -Algorithm SHA256).Hash | Set-Content (Join-Path $OutDir "$Label-save-sha256.txt") }
  @(Get-ChildItem $env:TEMP -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'sabretooth|nsis|Setup' } | ForEach-Object { $_.FullName }) | Set-Content (Join-Path $OutDir "$Label-temp.txt")
  exit 0
}

if ($Step -eq 'assert') {
  $lines = @()
  function Add([string]$name, [bool]$ok, [string]$detail) {
    $flag = $(if ($ok) { 'PASS' } else { 'FAIL' })
    $script:lines += "$name $flag $detail"
  }
  function Assert-Layout([string]$name) {
    foreach ($when in @('before', 'after')) {
      $keys = @(Read-Lines (Join-Path $OutDir "$name-$when-uninstall.txt"))
      $folders = @(Read-Lines (Join-Path $OutDir "$name-$when-folders.txt"))
      $local = @($folders | Where-Object { $_ -like 'local|*' })
      $pf = @($folders | Where-Object { $_ -like 'pf|*' -or $_ -like 'pfx86|*' })
      Add "$name-$when-one-uninstall" ($keys.Count -eq 1 -and $keys[0] -like 'HKCU|*') "count=$($keys.Count) $($keys -join ' || ')"
      Add "$name-$when-one-folder" ($local.Count -eq 1 -and $pf.Count -eq 0) "local=$($local.Count) pf=$($pf.Count) $($folders -join ' || ')"
    }
  }
  function Assert-Relaunch([string]$name) {
    $before = @(Read-Lines (Join-Path $OutDir "$name-before-pids.txt"))
    $after = @(Read-Lines (Join-Path $OutDir "$name-after-pids.txt"))
    $still = @(Read-Lines (Join-Path $OutDir "$name-still-before.txt"))
    $overlap = @($after | Where-Object { $before -contains $_ })
    Add "$name-pids" ($before.Count -ge 1 -and $after.Count -ge 1 -and $overlap.Count -eq 0 -and $still.Count -eq 0) "before=$($before -join ',') after=$($after -join ',') overlap=$($overlap -join ',') still=$($still -join ',')"
    $b = Read-One (Join-Path $OutDir "$name-before-fileversion.txt")
    $a = Read-One (Join-Path $OutDir "$name-after-fileversion.txt")
    $e = Read-One (Join-Path $OutDir "$name-expected-fileversion.txt")
    $launched = Read-One (Join-Path $OutDir "$name-launched-fileversion.txt")
    Add "$name-fileversion" ($b -and $a -eq $e -and $a -ne $b -and $b -eq $launched) "before=$b after=$a expected=$e launched=$launched"
    Add "$name-setup-seen" ((Read-One (Join-Path $OutDir "$name-setup-seen.txt")) -eq 'yes') (Read-One (Join-Path $OutDir "$name-setup-seen.txt") + ' ' + (Read-One (Join-Path $OutDir "$name-processes.txt")))
    $beforeHash = Read-One (Join-Path $OutDir 'save-sha256-before.txt')
    $afterHash = Read-One (Join-Path $OutDir "$name-save-sha256.txt")
    Add "$name-save" ($beforeHash -and $beforeHash -eq $afterHash) "before=$beforeHash after=$afterHash"
  }
  $skip = Join-Path $OutDir 'transitional-skip.txt'
  if (Test-Path -LiteralPath $skip) {
    $script:lines += (Get-Content -LiteralPath $skip -Raw).Trim()
  } else {
    Assert-Layout 'transitional'
    Assert-Relaunch 'transitional'
    $dialog = Read-One (Join-Path $OutDir 'transitional-dialog.txt')
    Add 'transitional-driven' ($dialog -eq 'button' -or $dialog -eq 'enter') $dialog
    $twiz = @(Read-Lines (Join-Path $OutDir 'transitional-wizard.txt'))
    $installMode = @($twiz | Where-Object { $_ -match 'Installation Options|per-user|per user|already a' })
    Add 'transitional-no-install-mode' ($installMode.Count -eq 0) ($installMode -join ' | ')
    $setupTitles = @($twiz | Where-Object { $_ -match 'Setup' })
    $seen = $(if ($setupTitles.Count -gt 0) { 'SEEN' } else { 'ABSENT' })
    $script:lines += "transitional-setup-window $seen $($setupTitles -join ' | ')"
    $tlog = Read-One (Join-Path $OutDir 'transitional-nsis.log')
    $tshort = if ($tlog.Length -gt 500) { $tlog.Substring(0, 500) } else { $tlog }
    Add 'transitional-nsis-args' ($tlog -match '--updated' -and $tlog -match '--force-run' -and $tlog -notmatch '/S' -and $tlog -match 'customInstall') ($tshort -replace '\s+', ' ')
  }
  Assert-Layout 'in-app'
  Assert-Relaunch 'in-app'
  $iwiz = @(Read-Lines (Join-Path $OutDir 'in-app-wizard.txt'))
  Add 'in-app-no-wizard' ($iwiz.Count -eq 0) ($iwiz -join ' | ')
  $ilog = Read-One (Join-Path $OutDir 'in-app-nsis.log')
  $ishort = if ($ilog.Length -gt 500) { $ilog.Substring(0, 500) } else { $ilog }
  Add 'in-app-nsis-log' ($ilog -match '/S' -and $ilog -match '--updated' -and $ilog -match '--force-run' -and $ilog -match 'customInstall') ($ishort -replace '\s+', ' ')
  $note = @(
    'NSIS instruction logging (LogSet) is not available from the NSIS binary electron-builder ships.',
    'installer.nsi calls LogSet only when ENABLE_LOGGING_ELECTRON_BUILDER is defined, and NsisTarget defines that only for nsis.customNsisBinary.debugLogging.',
    'That switch needs a separately supplied NSIS built with NSIS_CONFIG_LOG. The stock makensis treats LogSet as an unknown instruction, so this run does not flip it.',
    'The CI-only include scripts/nsis-ci-log.nsh (not in package.json) writes %TEMP%\sabretooth-nsis.log from customInit and customInstall, including the installer command line.',
    'label-setup-cmdline.txt is the Win32_Process command line captured while that exact setup exe was running.',
    '0.1.8 has no CI flag. It already calls checkForUpdates on launch and quitAndInstall() with no arguments after the Update ready dialog. This job clicks Restart now so that shipped updater runs. Its installer arguments are not silent.'
  )
  $note | Set-Content (Join-Path $OutDir 'nsis-log-note.txt')
  $lines | Set-Content (Join-Path $OutDir 'summary.txt')
  Get-Content (Join-Path $OutDir 'summary.txt')
  if ($lines -match ' FAIL ') { exit 1 }
  exit 0
}

throw "unhandled step $Step"
