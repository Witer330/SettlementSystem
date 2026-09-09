const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const pc = await p.partner.count()
  const mc = await p.material.count()
  const prc = await p.product.count()
  const ec = await p.employee.count()
  const dc = await p.department.count()
  const jc = await p.jobType.count()
  console.log('现有数据:', { partners: pc, materials: mc, products: prc, employees: ec, departments: dc, jobTypes: jc })

  // 1. 部门
  const depts = ['生产部', '销售部', '采购部', '财务部', '仓储部', '行政部']
  for (const name of depts) {
    await p.department.upsert({ where: { name }, update: {}, create: { name, code: name, status: 'active' } })
  }
  console.log('部门 done')

  // 2. 工种
  const jobs = ['焊工', '车工', '钳工', '装配工', '质检员', '包装工']
  for (const name of jobs) {
    await p.jobType.upsert({ where: { name }, update: {}, create: { name, code: name, status: 'active' } })
  }
  console.log('工种 done')

  // 3. 员工
  const deptList = await p.department.findMany()
  const jobList = await p.jobType.findMany()
  const employees = [
    { name: '张三', dept: '生产部', job: '焊工', rate: 35 },
    { name: '李四', dept: '生产部', job: '车工', rate: 30 },
    { name: '王五', dept: '销售部', job: '质检员', rate: 25 },
    { name: '赵六', dept: '采购部', job: '钳工', rate: 28 },
    { name: '陈七', dept: '仓储部', job: '装配工', rate: 22 },
    { name: '周八', dept: '财务部', job: '包装工', rate: 20 },
    { name: '刘九', dept: '销售部', job: '焊工', rate: 32 },
    { name: '吴十', dept: '生产部', job: '质检员', rate: 26 },
  ]
  for (let i = 0; i < employees.length; i++) {
    const e = employees[i]
    const dept = deptList.find(d => d.name === e.dept)
    const job = jobList.find(j => j.name === e.job)
    const code = 'EMP' + String(i + 1).padStart(3, '0')
    await p.employee.upsert({
      where: { code },
      update: { name: e.name, departmentId: dept?.id, jobTypeId: job?.id, hourlyRate: e.rate, status: 'active' },
      create: { name: e.name, code, departmentId: dept?.id, jobTypeId: job?.id, hourlyRate: e.rate, status: 'active' }
    })
  }
  console.log('员工 done')

  // 4. 往来单位
  const partners = [
    { name: '华东钢材有限公司', code: 'P001', isCustomer: true, isSupplier: true, shortName: '华东钢材', contact: '王经理', phone: '13800001001', address: '上海市浦东新区', region: '华东', category: '生产商', level: 'A', creditLimit: 500000, defaultDiscount: 95, email: 'hd@example.com', remark: '长期合作优质客户' },
    { name: '南方铝业集团', code: 'P002', isCustomer: false, isSupplier: true, shortName: '南方铝业', contact: '李总', phone: '13800001002', address: '广州市天河区', region: '华南', category: '生产商', level: 'A', creditLimit: 0, defaultDiscount: 100, email: 'nf@example.com', remark: '' },
    { name: '北方机械制造厂', code: 'P003', isCustomer: true, isSupplier: false, shortName: '北方机械', contact: '赵厂长', phone: '13800001003', address: '北京市大兴区', region: '华北', category: '经销商', level: 'B', creditLimit: 200000, defaultDiscount: 90, email: 'bf@example.com', remark: '' },
    { name: '西部五金商贸公司', code: 'P004', isCustomer: true, isSupplier: true, shortName: '西部五金', contact: '陈经理', phone: '13800001004', address: '成都市武侯区', region: '西南', category: '经销商', level: 'B', creditLimit: 100000, defaultDiscount: 93, email: 'xb@example.com', remark: '' },
    { name: '中建三局采购部', code: 'P005', isCustomer: true, isSupplier: false, shortName: '中建三局', contact: '刘主任', phone: '13800001005', address: '武汉市武昌区', region: '华中', category: '终端客户', level: 'VIP', creditLimit: 0, defaultDiscount: 100, email: 'zj@example.com', remark: '大型工程项目' },
    { name: '顺达物流设备有限公司', code: 'P006', isCustomer: true, isSupplier: true, shortName: '顺达物流', contact: '杨经理', phone: '13800001006', address: '南京市江宁区', region: '华东', category: '生产商', level: 'A', creditLimit: 300000, defaultDiscount: 97, email: 'sd@example.com', remark: '' },
    { name: '恒通管业', code: 'P007', isCustomer: false, isSupplier: true, shortName: '恒通管业', contact: '马厂长', phone: '13800001007', address: '天津市滨海新区', region: '华北', category: '生产商', level: 'C', creditLimit: 0, defaultDiscount: 100, email: 'ht@example.com', remark: '' },
    { name: '新世纪装饰工程公司', code: 'P008', isCustomer: true, isSupplier: false, shortName: '新世纪装饰', contact: '黄设计', phone: '13800001008', address: '杭州市西湖区', region: '华东', category: '终端客户', level: 'B', creditLimit: 80000, defaultDiscount: 88, email: 'xsj@example.com', remark: '' },
  ]
  for (const pt of partners) {
    await p.partner.upsert({ where: { code: pt.code }, update: pt, create: pt })
  }
  console.log('往来单位 done')

  // 5. 物料
  const materials = [
    { name: '冷轧钢板', code: 'M001', category: '钢材', specification: '1.5mm×1250mm×2500mm', unit: '张', safeStock: 100 },
    { name: '不锈钢管', code: 'M002', category: '钢管', specification: 'Φ50×3mm×6m', unit: '根', safeStock: 50 },
    { name: '铝合金型材', code: 'M003', category: '铝材', specification: '6063-T5 40×40×2mm', unit: '根', safeStock: 80 },
    { name: '角钢', code: 'M004', category: '钢材', specification: '∠50×50×5mm×6m', unit: '根', safeStock: 200 },
    { name: '焊条', code: 'M005', category: '焊接材料', specification: 'J422 Φ3.2mm', unit: '箱', safeStock: 30 },
    { name: '螺栓套件', code: 'M006', category: '紧固件', specification: 'M12×50 8.8级', unit: '套', safeStock: 500 },
    { name: '铜线', code: 'M007', category: '线材', specification: 'Φ2.5mm', unit: 'kg', safeStock: 25 },
    { name: '密封垫圈', code: 'M008', category: '密封件', specification: 'DN50 EPDM', unit: '个', safeStock: 300 },
    { name: '油漆', code: 'M009', category: '涂料', specification: '环氧富锌底漆 20kg/桶', unit: '桶', safeStock: 40 },
    { name: '槽钢', code: 'M010', category: '钢材', specification: '[100×48×5.3mm×6m', unit: '根', safeStock: 60 },
    { name: '钢丝绳', code: 'M011', category: '线材', specification: 'Φ8mm 6×19+FC', unit: '米', safeStock: 200 },
    { name: '轴承', code: 'M012', category: '轴承', specification: '6205-2RS', unit: '个', safeStock: 150 },
  ]
  for (const m of materials) {
    await p.material.upsert({ where: { code: m.code }, update: m, create: m })
  }
  console.log('物料 done')

  // 6. 产品
  const products = [
    { name: '标准货架', code: 'PROD001', category: '仓储设备', unit: '套', price: 2800 },
    { name: '移动工作台', code: 'PROD002', category: '工位器具', unit: '台', defaultPrice: 1500 },
    { name: '焊接支架', code: 'PROD003', category: '支撑结构', unit: '个', defaultPrice: 350 },
    { name: '输送辊道', code: 'PROD004', category: '输送设备', unit: '米', defaultPrice: 800 },
    { name: '防护围栏', code: 'PROD005', category: '安全防护', unit: '套', defaultPrice: 1200 },
    { name: '工具柜', code: 'PROD006', category: '工位器具', unit: '台', defaultPrice: 2200 },
    { name: '物料架', code: 'PROD007', category: '仓储设备', unit: '套', defaultPrice: 1800 },
    { name: '钢结构平台', code: 'PROD008', category: '钢结构', unit: '套', defaultPrice: 9500 },
  ]
  for (const pr of products) {
    await p.product.upsert({ where: { code: pr.code }, update: pr, create: pr })
  }
  console.log('产品 done')

  // 汇总
  const pc2 = await p.partner.count()
  const mc2 = await p.material.count()
  const prc2 = await p.product.count()
  const ec2 = await p.employee.count()
  const dc2 = await p.department.count()
  const jc2 = await p.jobType.count()
  console.log('\n=== 写入完成 ===')
  console.log(`部门: ${dc2}  工种: ${jc2}  员工: ${ec2}`)
  console.log(`往来单位: ${pc2}  物料: ${mc2}  产品: ${prc2}`)
}

main().then(() => p.$disconnect()).catch((e) => { console.error(e); p.$disconnect(); process.exit(1) })
