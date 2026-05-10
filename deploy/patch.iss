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
; 只覆盖前后端代码和数据库迁移
Source: "{#SourceDir}\frontend\dist\*"; DestDir: "{app}\frontend\dist"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#SourceDir}\backend\dist\*"; DestDir: "{app}\backend\dist"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#SourceDir}\backend\prisma\*"; DestDir: "{app}\backend\prisma"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#SourceDir}\manager.exe"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\logs"

[Icons]
Name: "{group}\SettlementSystem"; Filename: "{app}\manager.exe"; IconFilename: "{app}\SettlementSystem.ico"; WorkingDir: "{app}"
Name: "{userstartup}\SettlementSystem"; Filename: "{app}\manager.exe"; WorkingDir: "{app}"
Name: "{group}\打开 SettlementSystem"; Filename: "http://localhost:4000"

[Run]
; 补丁安装后运行数据库迁移
Filename: "{app}\node\node.exe"; Parameters: "node_modules\prisma\build\index.js migrate deploy --schema=prisma\schema.prisma"; StatusMsg: "正在更新数据库..."; WorkingDir: "{app}\backend"; Flags: shellexec waituntilterminated skipifsilent

[Code]
var
  isUpdate: Boolean;

function InitializeSetup(): Boolean;
begin
  Result := True;
  isUpdate := False;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  resultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    { 检测是否为更新安装 }
    if FileExists(ExpandConstant('{app}\manager.exe')) then
    begin
      isUpdate := True;
      { 停止正在运行的服务管理器 }
      Exec('taskkill', '/F /IM manager.exe', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
      Sleep(1000);
      { 备份数据库 }
      if FileExists(ExpandConstant('{app}\backend\prisma\data\settlement.db')) then
      begin
        CopyFile(
          ExpandConstant('{app}\backend\prisma\data\settlement.db'),
          ExpandConstant('{app}\backend\prisma\data\settlement.db.bak'),
          False
        );
      end;
    end;
  end;
end;
