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
OutputDir=..\release\installer\v{#AppVersion}
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
; 主体文件 → 临时目录，由 manager --apply-update 迁移
Source: "{#SourceDir}\*"; DestDir: "{app}\.update"; Excludes: "manager.exe"; Flags: recursesubdirs createallsubdirs ignoreversion
; manager.exe → 暂存为 .new，ssPostInstall 时替换
Source: "{#SourceDir}\manager.exe"; DestDir: "{app}"; DestName: "manager.exe.new"; Flags: ignoreversion

[Dirs]
Name: "{app}\logs"

[Icons]
; 桌面快捷方式 - 启动服务管理器
Name: "{group}\SettlementSystem"; Filename: "{app}\manager.exe"; IconFilename: "{app}\SettlementSystem.ico"; WorkingDir: "{app}"
; 打开浏览器快捷方式
Name: "{group}\打开 SettlementSystem"; Filename: "http://localhost:4000"

[Run]
; 注册开机自启动计划任务
Filename: "schtasks"; Parameters: "/Create /TN SettlementServiceManager /TR ""{app}\manager.exe --autostart"" /SC ONLOGON /F"; StatusMsg: "正在注册开机自启动..."; Flags: runhidden waituntilterminated skipifsilent
; 启动管理器执行文件迁移 + 数据库初始化 + 启动服务
Filename: "{app}\manager.exe"; Parameters: "--apply-update"; StatusMsg: "正在完成安装..."; Flags: runhidden nowait skipifsilent

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
var
  r: Integer;
begin
  Result := True;
  isUpdate := False;

  if not CheckNodeInstalled() then
  begin
    if MsgBox(
      '未检测到 Node.js 环境。' + #13#10 + #13#10 +
      'SettlementSystem 需要 Node.js 来运行后端服务。' + #13#10 + #13#10 +
      '请先安装 Node.js（推荐 v20 LTS）：' + #13#10 +
      'https://nodejs.org/zh-cn/download' + #13#10 + #13#10 +
      '安装完成后重新运行本安装程序。' + #13#10 + #13#10 +
      '是否现在打开 Node.js 下载页面？',
      mbError, MB_YESNO
    ) = IDYES then
    begin
      ShellExec('open', 'https://nodejs.org/zh-cn/download', '', '', SW_SHOW, ewNoWait, r);
    end;
    Result := False;
    Exit;
  end;
end;

{ 只杀管理器，node/proxy 由管理器 --apply-update 处理 }
procedure KillAppProcesses();
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
      KillAppProcesses();
    end;
  end;

  { 替换 manager.exe 并保留用户配置 }
  if CurStep = ssPostInstall then
  begin
    { 替换 manager.exe: 旧 → .old, .new → manager.exe }
    if FileExists(ExpandConstant('{app}\manager.exe')) then
      RenameFile(ExpandConstant('{app}\manager.exe'), ExpandConstant('{app}\manager.exe.old'));
    RenameFile(ExpandConstant('{app}\manager.exe.new'), ExpandConstant('{app}\manager.exe'));

    { 保留 config.json（首次安装时从 .update 复制） }
    if not FileExists(ExpandConstant('{app}\config.json')) then
      FileCopy(ExpandConstant('{app}\.update\config.json'), ExpandConstant('{app}\config.json'), False);

    { 保留 .env（首次安装时从 .update 复制） }
    if not FileExists(ExpandConstant('{app}\backend\.env')) then
      FileCopy(ExpandConstant('{app}\.update\backend\.env'), ExpandConstant('{app}\backend\.env'), False);

    { 更新计划任务路径 }
    Exec('schtasks', '/Delete /TN SettlementServiceManager /F', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
    Exec('schtasks', '/Create /TN SettlementServiceManager /TR ""' + ExpandConstant('{app}\manager.exe') + ' --autostart"" /SC ONLOGON /F', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
  end;
end;

function InitializeUninstall(): Boolean;
var
  dlgResult: Integer;
begin
  { 停止所有进程 }
  Exec('taskkill', '/F /IM manager.exe', '', SW_HIDE, ewWaitUntilTerminated, dlgResult);
  Exec('taskkill', '/F /IM settlement-proxy.exe', '', SW_HIDE, ewWaitUntilTerminated, dlgResult);
  Exec('taskkill', '/F /IM node.exe', '', SW_HIDE, ewWaitUntilTerminated, dlgResult);
  Sleep(1500);

  { 清理计划任务 }
  Exec('schtasks', '/Delete /TN SettlementServiceManager /F', '', SW_HIDE, ewWaitUntilTerminated, dlgResult);

  dlgResult := MsgBox(
    '是否保留数据库文件？(settlement.db)',
    mbConfirmation, MB_YESNO
  );
  if dlgResult = IDNO then
  begin
    DelTree(ExpandConstant('{app}\backend\prisma\data'), True, True, True);
  end;
  Result := True;
end;
