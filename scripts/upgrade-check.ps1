# Upgrade evidence for the Windows NSIS installer. Called by .github/workflows/upgrade-check.yml.
param(
  [Parameter(Mandatory = $true)][ValidateSet('install-old', 'seed', 'run')][string]$Step,
  [string]$Installer,
  [string]$ArgsLine,
  [string]$Label = 'run',
  [string]$OutDir = 'upgrade-evidence'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$save = Join-Path $env:APPDATA 'Sabretooth\saves\anna-save.txt'
$log = Join-Path $OutDir "$Label.log"

function Get-TopWindows {
  $code = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class WinEnum {
  public delegate bool Proc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Proc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public static List<string> Titles() {
    var list = new List<string>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, sb.Capacity);
      var t = sb.ToString();
      if (t.Length > 0) list.Add(t);
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
'@
  if (-not ('WinEnum' -as [type])) { Add-Type -TypeDefinition $code | Out-Null }
  return [WinEnum]::Titles()
}

function Shot([string]$name) {
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $path = Join-Path $OutDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

if ($Step -eq 'install-old') {
  $p = Start-Process -FilePath $Installer -ArgumentList '/S','/currentuser' -PassThru -Wait
  "exit=$($p.ExitCode)" | Set-Content $log
  exit $p.ExitCode
}

if ($Step -eq 'seed') {
  New-Item -ItemType Directory -Force -Path (Split-Path $save) | Out-Null
  Set-Content -Path $save -Value 'anna-save-v1' -NoNewline
  $hash = (Get-FileHash $save -Algorithm SHA256).Hash
  Set-Content (Join-Path $OutDir 'save-sha256-before.txt') $hash
  Write-Output $hash
  exit 0
}

# run
$seen = New-Object System.Collections.Generic.List[string]
$proc = Start-Process -FilePath $Installer -ArgumentList $ArgsLine.Split(' ') -PassThru
$deadline = (Get-Date).AddSeconds(90)
$i = 0
while (-not $proc.HasExited -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 700
  $i++
  foreach ($t in (Get-TopWindows)) { if (-not $seen.Contains($t)) { $seen.Add($t) } }
  if ($i % 3 -eq 1) { Shot "$Label-$i.png" }
}
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; "TIMEOUT" | Set-Content $log }
else { "exit=$($proc.ExitCode)" | Set-Content $log }
$seen | Set-Content (Join-Path $OutDir "$Label-windows.txt")
$wizard = @($seen | Where-Object { $_ -match 'Installation Options|per-user|per user|already a' })
if ($wizard.Count -gt 0) { "WIZARD" | Add-Content $log } else { "NO_WIZARD_PAGE" | Add-Content $log }
Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
  ForEach-Object { $p = Get-ItemProperty $_.PSPath; if ($p.DisplayName -match 'Sabretooth') { "$($_.PSPath) | $($p.DisplayName) | $($p.DisplayVersion) | $($p.InstallLocation)" } } |
  Set-Content (Join-Path $OutDir "$Label-uninstall.txt")
$folders = @()
$root = Join-Path $env:LOCALAPPDATA 'Programs'
if (Test-Path $root) {
  $folders = Get-ChildItem $root -Directory | Where-Object { $_.Name -match 'abretooth' } | ForEach-Object { $_.FullName }
}
$folders | Set-Content (Join-Path $OutDir "$Label-folders.txt")
if (Test-Path $save) { (Get-FileHash $save -Algorithm SHA256).Hash | Set-Content (Join-Path $OutDir "$Label-save-sha256.txt") }
Get-Process -Name 'Sabretooth' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id | Set-Content (Join-Path $OutDir "$Label-procs.txt")
$exe = Get-ChildItem $root -Recurse -Filter 'Sabretooth.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($exe) { $exe.VersionInfo.ProductVersion | Set-Content (Join-Path $OutDir "$Label-product-version.txt") }
exit 0
