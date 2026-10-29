"""Notifica Windows a fine run: BurntToast se installato, altrimenti toast nativo via PowerShell."""
from __future__ import annotations

import os
import subprocess
import sys

SCRIPT = r"""
$t = $env:BBI_TITLE; $b = $env:BBI_BODY
if (Get-Module -ListAvailable -Name BurntToast) {
  Import-Module BurntToast; New-BurntToastNotification -Text $t, $b
} else {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
  $x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
  $x.GetElementsByTagName('text')[0].AppendChild($x.CreateTextNode($t)) > $null
  $x.GetElementsByTagName('text')[1].AppendChild($x.CreateTextNode($b)) > $null
  $n = [Windows.UI.Notifications.ToastNotification]::new($x)
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show($n)
}
"""


def toast(title: str, body: str) -> str:
    if sys.platform != "win32":
        return "notifica: solo su Windows"
    env = dict(os.environ, BBI_TITLE=title[:120], BBI_BODY=body[:240])
    try:
        p = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", SCRIPT],
                           env=env, capture_output=True, text=True, timeout=30)
    except Exception as e:  # noqa: BLE001
        return f"notifica: errore ({e})"
    return "notifica inviata" if p.returncode == 0 else f"notifica: errore ({(p.stderr or '')[:150]})"
