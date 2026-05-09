; SettlementSystem Inno Setup 脚本
; 由 build.js 通过 /D 参数传入版本号和源目录

#ifndef AppVersion
  #define AppVersion "1.0.0"
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
OutputDir=..\dist
OutputBaseFilename=SettlementSystem-{#AppVersion}-Setup
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\SettlementSystem.ico
SetupLogging=yes

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; 主程序文件 - 递归复制所有内容
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Dirs]
Name: "{app}\logs"

[Icons]
; 桌面快捷方式 - 启动托盘应用
Name: "{group}\SettlementSystem"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\tray.ps1"""; IconFilename: "{app}\SettlementSystem.ico"; WorkingDir: "{app}"
; 开机自启动
Name: "{userstartup}\SettlementSystem"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\tray.ps1"""; WorkingDir: "{app}"
; 打开浏览器快捷方式
Name: "{group}\打开 SettlementSystem"; Filename: "http://localhost:4000"

[Run]
; 首次安装初始化
Filename: "{app}\first-run.bat"; Parameters: """{app}"""; StatusMsg: "正在初始化数据库..."; Flags: shellexec waituntilterminated skipifsilent

; 设置 PowerShell 执行策略（静默）
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force"""; Flags: runhidden skipifsilent

[InstallDelete]
; 更新时删除旧的应用文件（保留数据库）
Type: filesandirs; Name: "{app}\backend\dist\*"
Type: filesandirs; Name: "{app}\frontend\dist\*"
Type: files; Name: "{app}\*.bat"
Type: files; Name: "{app}\*.ps1"

[UninstallDelete]
; 卸载时删除（不包含 data 目录）
Type: filesandirs; Name: "{app}\logs\*"
Type: filesandirs; Name: "{app}\node"
Type: filesandirs; Name: "{app}\backend\node_modules"
Type: filesandirs; Name: "{app}\backend\dist"
Type: filesandirs; Name: "{app}\frontend\dist"
Type: files; Name: "{app}\*.bat"
Type: files; Name: "{app}\*.ps1"
Type: files; Name: "{app}\server.pid"
Type: files; Name: "{app}\SettlementSystem.ico"

[Code]
function InitializeSetup(): Boolean;
var
  trayExists: Boolean;
  resultCode: Integer;
begin
  Result := True;
  trayExists := FileExists(ExpandConstant('{app}\tray.ps1'));

  if trayExists then
  begin
    // 检测到旧版本，先停止服务
    Exec(ExpandConstant('{app}\stop.bat'), '', '', SW_HIDE, ewWaitUntilTerminated, 10000);

    // 备份数据库
    if FileExists(ExpandConstant('{app}\backend\prisma\data\settlement.db')) then
    begin
      FileCopy(
        ExpandConstant('{app}\backend\prisma\data\settlement.db'),
        ExpandConstant('{app}\backend\prisma\data\settlement.db.bak'),
        False
      );
    end;
  end;
end;

function InitializeUninstall(): Boolean;
var
  result: Integer;
begin
  result := MsgBox(
    '是否保留数据库文件？(settlement.db)',
    mbConfirmation, MB_YESNO
  );
  if result = IDNO then
  begin
    DelTree(ExpandConstant('{app}\backend\prisma\data'), True, True, True);
  end;
  Result := True;
end;
