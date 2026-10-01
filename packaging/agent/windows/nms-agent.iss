; Inno Setup script for the on-site agent (ADR 0002, 1.8).
; Built by scripts/agent/package.mjs, which passes AppVersion and SourceDir.
;
; The installer asks for one thing, the pairing key, and only on a PC that
; is not paired yet. It writes the key where the service picks it up; the
; service pairs itself, so the token is sealed for the service's account.
;
; Silent install: nms-agent-setup.exe /VERYSILENT /PAIRINGKEY=pk1....

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "."
#endif

#define AppName "NMS Agent"
#define ServiceExe "nms-agent-service.exe"
#define DataDir "{commonappdata}\NmsAgent"

[Setup]
AppId={{6E0B5C2A-7F41-4E0C-9C2B-6A1D8E4F3B21}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppName}
DefaultDirName={autopf}\NmsAgent
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=nms-agent-setup-{#AppVersion}
OutputDir={#SourceDir}\..
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#AppName}
CloseApplications=no

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
es.KeyPageTitle=Clave de vinculación
es.KeyPageDescription=Pegue la clave que le dio su proveedor.
es.KeyPageLabel=La clave empieza por pk1. Solo se usa una vez.
es.KeyInvalid=Esa no es una clave de vinculación válida. Cópiela completa, empieza por pk1.
en.KeyPageTitle=Pairing key
en.KeyPageDescription=Paste the key your provider gave you.
en.KeyPageLabel=The key starts with pk1. It works once.
en.KeyInvalid=That is not a valid pairing key. Copy all of it; it starts with pk1.

[Files]
Source: "{#SourceDir}\nms-agent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\{#ServiceExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\nms-agent-service.xml"; DestDir: "{app}"; Flags: ignoreversion

[InstallDelete]
; An installer run replaces the program outright; a rollback copy or a
; half-finished download from a self-update means nothing after it.
Type: files; Name: "{app}\nms-agent.exe.old"
Type: files; Name: "{app}\nms-agent.exe.new"

[UninstallRun]
Filename: "{app}\{#ServiceExe}"; Parameters: "stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopService"
Filename: "{app}\{#ServiceExe}"; Parameters: "uninstall"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveService"
Filename: "powershell.exe"; Parameters: "-NoProfile -NonInteractive -Command ""Remove-MpPreference -ExclusionPath '{app}','{#DataDir}' -ErrorAction SilentlyContinue"""; Flags: runhidden waituntilterminated; RunOnceId: "RemoveDefenderExclusion"

[UninstallDelete]
; The token, the device list and unsent results: nothing stays behind.
Type: filesandordirs; Name: "{#DataDir}"
; What a self-update leaves beside the program: the previous
; version, kept for a rollback, and a download not yet swapped in.
Type: files; Name: "{app}\nms-agent.exe.old"
Type: files; Name: "{app}\nms-agent.exe.new"

[Code]
var
  KeyPage: TInputQueryWizardPage;

function IsPaired(): Boolean;
begin
  Result := FileExists(ExpandConstant('{#DataDir}\agent.json'));
end;

function GivenKey(): String;
begin
  Result := Trim(ExpandConstant('{param:PAIRINGKEY|}'));
end;

// The same shape the agent checks: pk1.<base64url>.<code>. The backend is
// the real judge; this only catches a partial paste before install.
function LooksLikeKey(Key: String): Boolean;
var
  I, Dots: Integer;
  C: Char;
begin
  Result := False;
  if (Length(Key) < 10) or (Copy(Key, 1, 4) <> 'pk1.') then Exit;
  Dots := 0;
  for I := 1 to Length(Key) do
  begin
    C := Key[I];
    if C = '.' then
      Dots := Dots + 1
    else if not (((C >= 'A') and (C <= 'Z')) or ((C >= 'a') and (C <= 'z')) or
                 ((C >= '0') and (C <= '9')) or (C = '-') or (C = '_')) then
      Exit;
  end;
  Result := (Dots = 2) and (Key[Length(Key)] <> '.');
end;

procedure InitializeWizard();
begin
  KeyPage := CreateInputQueryPage(wpWelcome,
    CustomMessage('KeyPageTitle'), CustomMessage('KeyPageDescription'),
    CustomMessage('KeyPageLabel'));
  KeyPage.Add('', False);
  KeyPage.Values[0] := GivenKey();
end;

// An upgrade, or a silent install that already has its key, asks nothing.
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := (PageID = KeyPage.ID) and (IsPaired() or (GivenKey() <> ''));
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = KeyPage.ID) and not LooksLikeKey(Trim(KeyPage.Values[0])) then
  begin
    MsgBox(CustomMessage('KeyInvalid'), mbError, MB_OK);
    Result := False;
  end;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if WizardSilent() and not IsPaired() and not LooksLikeKey(GivenKey()) then
  begin
    Log('Silent install needs /PAIRINGKEY=<key> on a PC that is not paired');
    Result := False;
  end;
end;

procedure RunHidden(FileName, Params: String);
var
  Code: Integer;
begin
  if not Exec(FileName, Params, '', SW_HIDE, ewWaitUntilTerminated, Code) then
    Log(Format('Could not run %s %s', [FileName, Params]))
  else if Code <> 0 then
    Log(Format('%s %s exited %d', [FileName, Params, Code]));
end;

// An upgrade replaces the executable, which Windows keeps locked while the
// service runs.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Service: String;
begin
  Result := '';
  Service := ExpandConstant('{app}\{#ServiceExe}');
  if FileExists(Service) then
    RunHidden(Service, 'stop');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  DataDir, Service, Key: String;
begin
  if CurStep <> ssPostInstall then Exit;
  DataDir := ExpandConstant('{#DataDir}');
  Service := ExpandConstant('{app}\{#ServiceExe}');

  // Only SYSTEM and administrators may read the agent's files: the token and
  // the list of the network's addresses live here.
  ForceDirectories(DataDir);
  RunHidden('icacls.exe', '"' + DataDir + '" /inheritance:r /grant:r *S-1-5-18:(OI)(CI)F *S-1-5-32-544:(OI)(CI)F');

  if not IsPaired() then
  begin
    Key := GivenKey();
    if Key = '' then Key := Trim(KeyPage.Values[0]);
    SaveStringToFile(DataDir + '\pairing.key', Key, False);
  end;

  // A PC that sleeps measures nothing (ADR 0002, "Packaging").
  RunHidden('powercfg.exe', '/change standby-timeout-ac 0');
  RunHidden('powercfg.exe', '/change hibernate-timeout-ac 0');

  // Defender scanning every ping the agent spawns slows cycles down and
  // unsigned executables get quarantined.
  RunHidden('powershell.exe', '-NoProfile -NonInteractive -Command "Add-MpPreference -ExclusionPath ''' + ExpandConstant('{app}') + ''',''' + DataDir + '''"');

  // install fails harmlessly on an upgrade, where the service exists.
  RunHidden(Service, 'install');
  RunHidden(Service, 'start');
end;
