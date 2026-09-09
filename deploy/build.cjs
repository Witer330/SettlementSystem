#!/usr/bin/env node

/**
 * SettlementSystem 安装包构建脚本
 *
 * 用法:
 *   node deploy/build.cjs                  # 完整安装包
 *   node deploy/build.cjs --skip-frontend  # 跳过前端构建
 *   node deploy/build.cjs --skip-backend   # 跳过后端构建
 *   node deploy/build.cjs --skip-manager   # 跳过服务管理器构建
 *
 * 版本号统一从 package.json 读取，修改 version 字段即可控制版本。
 *
 * 输出目录:
 *   release/installer/v{version}/  — 全量安装包
 *
 * 前置条件:
 *   - Node.js 20+
 *   - Inno Setup 6+ (安装后 iscc.exe 在 PATH 中，或安装到默认路径)
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// ============ 配置 ============

const ROOT = path.resolve(__dirname, '..')
const DEPLOY = __dirname
const OUTPUT_DIR = path.join(DEPLOY, 'output', 'app')
const RELEASE_DIR = path.join(ROOT, 'release')
const ISCC_DEFAULT = 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe'

// ============ 工具函数 ============

function run(cmd, cwd = ROOT) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function log(msg) {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`  ${msg}`)
  console.log('='.repeat(50))
}

function rimraf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item)
    const destPath = path.join(dest, item)
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function findIscc() {
  // 检查 PATH
  try {
    execSync('iscc /? >nul 2>&1', { stdio: 'ignore' })
    return 'iscc'
  } catch {}

  // 检查默认安装路径
  if (fs.existsSync(ISCC_DEFAULT)) {
    return ISCC_DEFAULT
  }

  // 检查常见路径
  const candidates = [
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'D:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'D:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }

  return null
}

// ============ 主流程 ============

const args = process.argv.slice(2)
const skipFrontend = args.includes('--skip-frontend')
const skipBackend = args.includes('--skip-backend')
const skipManager = args.includes('--skip-manager')

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
  const version = pkg.version
  log(`构建 SettlementSystem v${version} (安装包)`)

  // 1. 清理旧构建
  log('[1/8] 清理旧构建产物')
  rimraf(path.join(DEPLOY, 'output'))

  // 2. 构建前端
  if (!skipFrontend) {
    log('[2/8] 构建前端')
    run('npm install', path.join(ROOT, 'frontend'))
    run('npm run build', path.join(ROOT, 'frontend'))
  } else {
    log('[2/8] 跳过前端构建')
  }

  // 3. 构建后端
  if (!skipBackend) {
    log('[3/8] 构建后端')
    run('npm install', path.join(ROOT, 'backend'))
    run('npm run build', path.join(ROOT, 'backend'))
  } else {
    log('[3/8] 跳过后端构建')
  }

  // 4. 构建 Tauri 服务管理器
  if (!skipManager) {
    log('[4/8] 构建服务管理器 (Tauri)')
    const managerDir = path.join(ROOT, 'service-manager')
    run('npm install', managerDir)
    run('npm run tauri build', managerDir)
  } else {
    log('[4/8] 跳过服务管理器构建')
  }

  // 5. 创建输出目录结构
  log('[5/8] 组装文件')
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  // 复制前端构建产物
  copyDir(path.join(ROOT, 'frontend', 'dist'), path.join(OUTPUT_DIR, 'frontend', 'dist'))

  // 复制后端编译产物
  copyDir(path.join(ROOT, 'backend', 'dist'), path.join(OUTPUT_DIR, 'backend', 'dist'))

  // 复制 prisma 目录（schema + migrations，不含 data）
  const prismaSrc = path.join(ROOT, 'backend', 'prisma')
  const prismaDest = path.join(OUTPUT_DIR, 'backend', 'prisma')
  fs.mkdirSync(path.join(prismaDest, 'data'), { recursive: true })
  fs.copyFileSync(path.join(prismaSrc, 'schema.prisma'), path.join(prismaDest, 'schema.prisma'))
  const migrationsSrc = path.join(prismaSrc, 'migrations')
  if (fs.existsSync(migrationsSrc)) {
    copyDir(migrationsSrc, path.join(prismaDest, 'migrations'))
  }
  const lockSrc = path.join(prismaSrc, 'migration_lock.toml')
  if (fs.existsSync(lockSrc)) {
    fs.copyFileSync(lockSrc, path.join(prismaDest, 'migration_lock.toml'))
  }

  // 6. 创建生产 node_modules
  log('[6/8] 创建生产依赖')
  const backendPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend', 'package.json'), 'utf-8'))
  const prodDeps = backendPkg.dependencies || {}
  prodDeps['prisma'] = backendPkg.devDependencies?.prisma || '^5.20.0'

  const tempPkg = {
    name: 'settlement-system-prod',
    version: '1.0.0',
    dependencies: prodDeps
  }
  const tempDir = path.join(DEPLOY, 'output', 'temp')
  fs.mkdirSync(tempDir, { recursive: true })
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(tempPkg, null, 2))

  run('npm install --production', tempDir)

  const nodeModulesDest = path.join(OUTPUT_DIR, 'backend', 'node_modules')
  fs.renameSync(path.join(tempDir, 'node_modules'), nodeModulesDest)
  rimraf(tempDir)

  fs.copyFileSync(
    path.join(ROOT, 'backend', 'package.json'),
    path.join(OUTPUT_DIR, 'backend', 'package.json')
  )

  // 7. 运行 prisma generate
  log('[7/8] 生成 Prisma Client')
  run('npx prisma generate', path.join(OUTPUT_DIR, 'backend'))

  // 复制服务管理器和部署脚本
  log('[8/8] 复制服务管理器')

  // 复制 Tauri 构建产物
  const tauriRelease = path.join(ROOT, 'service-manager', 'src-tauri', 'target', 'release')
  const managerExe = path.join(tauriRelease, 'settlement-service-manager.exe')
  const proxyExe = path.join(tauriRelease, 'settlement-proxy.exe')
  const updaterExe = path.join(tauriRelease, 'settlement-updater.exe')
  if (fs.existsSync(managerExe)) {
    fs.copyFileSync(managerExe, path.join(OUTPUT_DIR, 'manager.exe'))
    console.log('已复制 manager.exe')
  } else {
    console.warn('警告: 未找到 manager.exe，跳过')
  }
  if (fs.existsSync(proxyExe)) {
    fs.copyFileSync(proxyExe, path.join(OUTPUT_DIR, 'settlement-proxy.exe'))
    console.log('已复制 settlement-proxy.exe')
  } else {
    console.warn('警告: 未找到 settlement-proxy.exe，跳过')
  }
  if (fs.existsSync(updaterExe)) {
    fs.copyFileSync(updaterExe, path.join(OUTPUT_DIR, 'settlement-updater.exe'))
    console.log('已复制 settlement-updater.exe')
  }

  // 创建 .env 模板（OSS 凭据从开发机 backend/.env 合并，敏感值不写进本脚本）
  const envLines = [
    'DATABASE_URL="file:./data/settlement.db"',
    'JWT_SECRET="settlement-system-secret-key-change-in-production"',
    'JWT_EXPIRES_IN="7d"',
    'PORT=0',
    'NODE_ENV="production"'
  ]
  const ossKeys = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET', 'OSS_REGION']
  const srcEnvPath = path.join(ROOT, 'backend', '.env')
  if (fs.existsSync(srcEnvPath)) {
    for (const line of fs.readFileSync(srcEnvPath, 'utf-8').split(/\r?\n/)) {
      const key = line.split('=')[0].trim()
      if (ossKeys.includes(key) && line.includes('=')) envLines.push(line.trim())
    }
  }
  if (!envLines.some(l => l.startsWith('OSS_ACCESS_KEY_ID='))) {
    console.warn('警告: backend/.env 未配置 OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET，管理器将无法检查 OSS 在线更新')
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'backend', '.env'), envLines.join('\n'))

  // 创建默认 config.json
  const configPath = path.join(OUTPUT_DIR, 'config.json')
  if (!fs.existsSync(configPath)) {
    const defaultConfig = { proxy_port: 4000, host: '0.0.0.0' }
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
  }

  // 创建 logs 目录
  fs.mkdirSync(path.join(OUTPUT_DIR, 'logs'), { recursive: true })

  // 复制图标（如果存在）
  const iconSrc = path.join(ROOT, 'assets', 'settlement.ico')
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(OUTPUT_DIR, 'SettlementSystem.ico'))
  }

  // 编译 Inno Setup
  log('编译 Inno Setup')
  const iscc = findIscc()
  if (!iscc) {
    console.error('\n错误: 未找到 Inno Setup (ISCC.exe)')
    console.error('请安装 Inno Setup 6+: https://jrsoftware.org/isinfo.php')
    console.error('安装后确保 iscc.exe 在 PATH 中，或安装到默认路径')
    process.exit(1)
  }

  const sourceDirAbs = path.resolve(OUTPUT_DIR)
  run(`"${iscc}" /DAppVersion=${version} /DSourceDir="${sourceDirAbs}" "${path.join(DEPLOY, 'installer.iss')}"`)

  // 完成
  const outputExe = path.join(RELEASE_DIR, 'installer', `v${version}`, `SettlementSystem-${version}-Setup.exe`)
  if (fs.existsSync(outputExe)) {
    const stats = fs.statSync(outputExe)
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1)
    log('构建完成!')
    console.log(`输出: ${outputExe}`)
    console.log(`大小: ${sizeMB} MB`)
  } else {
    log('构建完成，但未找到输出文件')
    console.log('请检查 Inno Setup 编译输出')
  }
}

main().catch(err => {
  console.error('\n构建失败:', err.message)
  process.exit(1)
})
