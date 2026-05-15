; SettlementSystem 增量补丁包 Inno Setup 脚本
; 只包含前后端代码和数据库迁移，不包含 Node.js 和 node_modules

#ifndef AppVersion
  #define AppVersion "1.0.1"
#endif

#ifndef SourceDir
  #define SourceDir "output\app"
#endif

[Setup]
AppName=SettlementSystem
AppVersion={#AppVersion}
AppPublisher=SettlementSystem
DefaultDirName={autopf}\SettlementSystem
DefaultGroupName=SettlementSystem
OutputDir=..\release\patch\v{#AppVersion}
OutputBaseFilename=SettlementSystem-{#AppVersion}-Patch
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\SettlementSystem.ico
SetupLogging=yes
; 补丁包不卸载旧文件，只覆盖
CreateUninstallRegEntry=no

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; 代码文件 → 临时目录，由 manager --apply-update 迁移
Source: "{#SourceDir}\frontend\dist\*"; DestDir: "{app}\.update\frontend\dist"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#SourceDir}\backend\dist\*"; DestDir: "{app}\.update\backend\dist"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#SourceDir}\backend\prisma\*"; DestDir: "{app}\.update\backend\prisma"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#SourceDir}\settlement-proxy.exe"; DestDir: "{app}\.update"; Flags: ignoreversion
; manager.exe → 暂存为 .new
Source: "{#SourceDir}\manager.exe"; DestDir: "{app}"; DestName: "manager.exe.new"; Flags: ignoreversion

[Dirs]
Name: "{app}\logs"

[Icons]
Name: "{group}\SettlementSystem"; Filename: "{app}\manager.exe"; IconFilename: "{app}\SettlementSystem.ico"; WorkingDir: "{app}"
Name: "{group}\打开 SettlementSystem"; Filename: "http://localhost:4000"

[Run]
; 启动管理器执行文件迁移 + 数据库迁移
Filename: "{app}\manager.exe"; Parameters: "--apply-update"; StatusMsg: "正在应用更新..."; Flags: runhidden nowait skipifsilent

[Code]
var
  isUpdate: Boolean;

function CheckNodeInstalled(): Boolean;
var
  r: Integer;
begin
  Exec('cmd', '/c node --version >nul 2>&1', '', SW_HIDE, ewWaitUntilTerminated, r);
  Result := (r = 0);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  isUpdate := False;

  if not CheckNodeInstalled() then
  begin
    MsgBox(
      '未检测到 Node.js 环境。' + #13#10 + #13#10 +
      'SettlementSystem 需要 Node.js 来运行后端服务。' + #13#10 + #13#10 +
      '请先安装 Node.js（推荐 v20 LTS）：' + #13#10 +
      'https://nodejs.org/zh-cn/download',
      mbError, MB_OK
    );
    Result := False;
    Exit;
  end;
end;

{ 只杀管理器 }
procedure KillManager();
var
  resultCode: Integer;
begin
  Exec('taskkill', '/F /IM manager.exe', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
  Sleep(1500);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  resultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    if FileExists(ExpandConstant('{app}\manager.exe')) then
    begin
      isUpdate := True;
      KillManager();
    end;
  end;

  { 替换 manager.exe }
  if CurStep = ssPostInstall then
  begin
    if FileExists(ExpandConstant('{app}\manager.exe')) then
      RenameFile(ExpandConstant('{app}\manager.exe'), ExpandConstant('{app}\manager.exe.old'));
    RenameFile(ExpandConstant('{app}\manager.exe.new'), ExpandConstant('{app}\manager.exe'));
  end;
end;
