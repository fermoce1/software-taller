' Lanzador Sanmy Taller — arranca el servidor SIN mostrar ventanas y abre el navegador.
Option Explicit
Dim fso, sh, dir, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\instalador\arrancar-app.ps1"""
' 0 = ventana oculta, False = no esperar
sh.Run cmd, 0, False
