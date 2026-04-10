import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createDemoData() {
  try {
    console.log('🌱 开始生成演示数据...\n');

    // ============ 清理现有数据 ============
    console.log('🧹 清理现有数据...');
    await prisma.productionRecord.deleteMany({});
    await prisma.processRate.deleteMany({});
    await prisma.productProcess.deleteMany({});
    await prisma.billOfMaterial.deleteMany({});
    await prisma.process.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.department.deleteMany({});
    await prisma.inventoryLog.deleteMany({});
    await prisma.inventory.deleteMany({});
    await prisma.salesItem.deleteMany({});
    await prisma.salesOrder.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.purchaseItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.material.deleteMany({});
    await prisma.supplier.deleteMany({});
    console.log('✓ 清理完成\n');

    // ============ 创建部门 ============
    console.log('🏢 创建部门...');
    const departments = await Promise.all([
      prisma.department.create({
        data: {
          name: 'CNC加工车间',
          code: 'CNC',
          status: 'active'
        }
      }),
      prisma.department.create({
        data: {
          name: '装配车间',
          code: 'ASSEMBLY',
          status: 'active'
        }
      }),
      prisma.department.create({
        data: {
          name: '质检部门',
          code: 'QC',
          status: 'active'
        }
      })
    ]);
    console.log(`✓ 创建了 ${departments.length} 个部门`);

    // ============ 创建员工 ============
    console.log('👥 创建员工...');
    const employees = await Promise.all([
      prisma.employee.create({
        data: {
          name: '张三',
          code: 'E001',
          departmentId: departments[0].id,
          jobType: 'CNC操作工',
          hourlyRate: 45.0,
          status: 'active'
        }
      }),
      prisma.employee.create({
        data: {
          name: '李四',
          code: 'E002',
          departmentId: departments[0].id,
          jobType: 'CNC操作工',
          hourlyRate: 42.0,
          status: 'active'
        }
      }),
      prisma.employee.create({
        data: {
          name: '王五',
          code: 'E003',
          departmentId: departments[1].id,
          jobType: '装配工',
          hourlyRate: 38.0,
          status: 'active'
        }
      }),
      prisma.employee.create({
        data: {
          name: '赵六',
          code: 'E004',
          departmentId: departments[1].id,
          jobType: '装配工',
          hourlyRate: 36.0,
          status: 'active'
        }
      }),
      prisma.employee.create({
        data: {
          name: '孙七',
          code: 'E005',
          departmentId: departments[2].id,
          jobType: '质检员',
          hourlyRate: 40.0,
          status: 'active'
        }
      })
    ]);
    console.log(`✓ 创建了 ${employees.length} 个员工`);

    // ============ 创建工序 ============
    console.log('⚙️ 创建工序...');
    const processes = await Promise.all([
      prisma.process.create({
        data: {
          name: 'CNC粗加工',
          code: 'P001',
          defaultPrice: 5.0,
          unit: 'piece',
          status: 'active'
        }
      }),
      prisma.process.create({
        data: {
          name: 'CNC精加工',
          code: 'P002',
          defaultPrice: 8.0,
          unit: 'piece',
          status: 'active'
        }
      }),
      prisma.process.create({
        data: {
          name: '钻孔',
          code: 'P003',
          defaultPrice: 3.0,
          unit: 'piece',
          status: 'active'
        }
      }),
      prisma.process.create({
        data: {
          name: '装配',
          code: 'P004',
          defaultPrice: 4.0,
          unit: 'piece',
          status: 'active'
        }
      }),
      prisma.process.create({
        data: {
          name: '质检',
          code: 'P005',
          defaultPrice: 2.0,
          unit: 'piece',
          status: 'active'
        }
      })
    ]);
    console.log(`✓ 创建了 ${processes.length} 个工序`);

    // ============ 设置员工工序计价 ============
    console.log('💰 设置工序计价...');
    await Promise.all([
      // 张三 - CNC熟练工，价格稍高
      prisma.processRate.create({
        data: {
          employeeId: employees[0].id,
          processId: processes[0].id,
          price: 6.0
        }
      }),
      prisma.processRate.create({
        data: {
          employeeId: employees[0].id,
          processId: processes[1].id,
          price: 10.0
        }
      }),
      // 李四 - CNC普通工，默认价格
      prisma.processRate.create({
        data: {
          employeeId: employees[1].id,
          processId: processes[0].id,
          price: 5.0
        }
      }),
      // 王五 - 装配熟练工
      prisma.processRate.create({
        data: {
          employeeId: employees[2].id,
          processId: processes[3].id,
          price: 5.0
        }
      })
    ]);
    console.log('✓ 设置了工序计价');

    // ============ 创建产品 ============
    console.log('📦 创建产品...');
    const products = await Promise.all([
      prisma.product.create({
        data: {
          name: '精密零件A',
          code: 'PRD001',
          category: '机械零件',
          specification: '材质：铝合金，精度：±0.01mm',
          unit: 'piece',
          status: 'active'
        }
      }),
      prisma.product.create({
        data: {
          name: '精密零件B',
          code: 'PRD002',
          category: '机械零件',
          specification: '材质：不锈钢，精度：±0.005mm',
          unit: 'piece',
          status: 'active'
        }
      }),
      prisma.product.create({
        data: {
          name: '组装部件C',
          code: 'PRD003',
          category: '组装部件',
          specification: '包含5个子组件',
          unit: 'piece',
          status: 'active'
        }
      })
    ]);
    console.log(`✓ 创建了 ${products.length} 个产品`);

    // ============ 设置产品工序 ============
    console.log('🔗 设置产品工序...');
    await Promise.all([
      // 产品A的工序流程
      prisma.productProcess.create({
        data: {
          productId: products[0].id,
          processId: processes[0].id,
          sequence: 1
        }
      }),
      prisma.productProcess.create({
        data: {
          productId: products[0].id,
          processId: processes[1].id,
          sequence: 2
        }
      }),
      prisma.productProcess.create({
        data: {
          productId: products[0].id,
          processId: processes[2].id,
          sequence: 3
        }
      }),
      prisma.productProcess.create({
        data: {
          productId: products[0].id,
          processId: processes[4].id,
          sequence: 4
        }
      }),
      // 产品B的工序流程
      prisma.productProcess.create({
        data: {
          productId: products[1].id,
          processId: processes[0].id,
          sequence: 1
        }
      }),
      prisma.productProcess.create({
        data: {
          productId: products[1].id,
          processId: processes[1].id,
          sequence: 2
        }
      }),
      prisma.productProcess.create({
        data: {
          productId: products[1].id,
          processId: processes[4].id,
          sequence: 3
        }
      }),
      // 产品C的工序流程
      prisma.productProcess.create({
        data: {
          productId: products[2].id,
          processId: processes[1].id,
          sequence: 1
        }
      }),
      prisma.productProcess.create({
        data: {
          productId: products[2].id,
          processId: processes[4].id,
          sequence: 2
        }
      })
    ]);
    console.log('✓ 设置了产品工序');

    // ============ 创建物料 ============
    console.log('📄 创建物料...');
    const materials = await Promise.all([
      prisma.material.create({
        data: {
          name: '铝合金板',
          code: 'MAT001',
          category: '原材料',
          specification: '6061-T6, 厚度5mm',
          unit: 'piece',
          barcode: '6901234567890',
          safeStock: 50,
          status: 'active'
        }
      }),
      prisma.material.create({
        data: {
          name: '不锈钢板',
          code: 'MAT002',
          category: '原材料',
          specification: '304, 厚度3mm',
          unit: 'piece',
          barcode: '6901234567891',
          safeStock: 30,
          status: 'active'
        }
      }),
      prisma.material.create({
        data: {
          name: '螺丝M6',
          code: 'MAT003',
          category: '标准件',
          specification: 'M6×20mm',
          unit: 'piece',
          barcode: '6901234567892',
          safeStock: 1000,
          status: 'active'
        }
      }),
      prisma.material.create({
        data: {
          name: '螺母M6',
          code: 'MAT004',
          category: '标准件',
          specification: 'M6',
          unit: 'piece',
          barcode: '6901234567893',
          safeStock: 2000,
          status: 'active'
        }
      }),
      prisma.material.create({
        data: {
          name: '垫片',
          code: 'MAT005',
          category: '标准件',
          specification: 'φ10×2mm',
          unit: 'piece',
          barcode: '6901234567894',
          safeStock: 500,
          status: 'active'
        }
      })
    ]);
    console.log(`✓ 创建了 ${materials.length} 种物料`);

    // ============ 设置BOM ============
    console.log('📋 设置产品BOM...');
    await Promise.all([
      prisma.billOfMaterial.create({
        data: {
          productId: products[0].id,
          materialId: materials[0].id,
          quantity: 1.0
        }
      }),
      prisma.billOfMaterial.create({
        data: {
          productId: products[0].id,
          materialId: materials[2].id,
          quantity: 4.0
        }
      }),
      prisma.billOfMaterial.create({
        data: {
          productId: products[1].id,
          materialId: materials[1].id,
          quantity: 1.0
        }
      }),
      prisma.billOfMaterial.create({
        data: {
          productId: products[1].id,
          materialId: materials[2].id,
          quantity: 6.0
        }
      }),
      prisma.billOfMaterial.create({
        data: {
          productId: products[2].id,
          materialId: materials[2].id,
          quantity: 10.0
        }
      }),
      prisma.billOfMaterial.create({
        data: {
          productId: products[2].id,
          materialId: materials[3].id,
          quantity: 10.0
        }
      }),
      prisma.billOfMaterial.create({
        data: {
          productId: products[2].id,
          materialId: materials[4].id,
          quantity: 20.0
        }
      })
    ]);
    console.log('✓ 设置了产品BOM');

    // ============ 创建供应商 ============
    console.log('🏭 创建供应商...');
    const suppliers = await Promise.all([
      prisma.supplier.create({
        data: {
          name: '华东金属材料有限公司',
          code: 'SUP001',
          contact: '张经理',
          phone: '021-12345678',
          address: '上海市浦东新区XX路123号',
          status: 'active'
        }
      }),
      prisma.supplier.create({
        data: {
          name: '南方标准件供应商',
          code: 'SUP002',
          contact: '李经理',
          phone: '0755-87654321',
          address: '广州市天河区XX大道456号',
          status: 'active'
        }
      }),
      prisma.supplier.create({
        data: {
          name: '北方零部件有限公司',
          code: 'SUP003',
          contact: '王经理',
          phone: '010-98765432',
          address: '北京市朝阳区XX街789号',
          status: 'active'
        }
      })
    ]);
    console.log(`✓ 创建了 ${suppliers.length} 个供应商`);

    // ============ 创建客户 ============
    console.log('🏢 创建客户...');
    const customers = await Promise.all([
      prisma.customer.create({
        data: {
          name: '宏达精密制造有限公司',
          code: 'CUST001',
          contact: '刘总',
          phone: '0512-3456789',
          address: '深圳市南山区XX科技园1号',
          creditLimit: 1000000,
          status: 'active'
        }
      }),
      prisma.customer.create({
        data: {
          name: '精工科技发展有限公司',
          code: 'CUST002',
          contact: '陈经理',
          phone: '0571-2345678',
          address: '苏州市工业园区XXXX路2号',
          creditLimit: 500000,
          status: 'active'
        }
      }),
      prisma.customer.create({
        data: {
          name: '新能源装备股份公司',
          code: 'CUST003',
          contact: '周经理',
          phone: '020-1234567',
          address: '杭州市西湖区XX广场3号',
          creditLimit: 2000000,
          status: 'active'
        }
      })
    ]);
    console.log(`✓ 创建了 ${customers.length} 个客户`);

    // ============ 创建初始库存 ============
    console.log('📦 初始化库存...');
    await Promise.all([
      prisma.inventory.create({
        data: {
          materialId: materials[0].id,
          quantity: 100.0
        }
      }),
      prisma.inventory.create({
        data: {
          materialId: materials[1].id,
          quantity: 80.0
        }
      }),
      prisma.inventory.create({
        data: {
          materialId: materials[2].id,
          quantity: 3000.0
        }
      }),
      prisma.inventory.create({
        data: {
          materialId: materials[3].id,
          quantity: 5000.0
        }
      }),
      prisma.inventory.create({
        data: {
          materialId: materials[4].id,
          quantity: 1200.0
        }
      })
    ]);
    console.log('✓ 初始化了库存');

    // ============ 创建采购单 ============
    console.log('📝 创建采购单...');
    const purchaseOrder1 = await prisma.purchaseOrder.create({
      data: {
        supplierId: suppliers[0].id,
        orderNo: 'PO-20240409-001',
        totalAmount: 50000,
        status: 'completed',
        remark: '首批采购'
      }
    });
    await prisma.purchaseItem.create({
      data: {
        orderId: purchaseOrder1.id,
        materialId: materials[0].id,
        quantity: 50,
        price: 600,
        receivedQuantity: 50
      }
    });

    const purchaseOrder2 = await prisma.purchaseOrder.create({
      data: {
        supplierId: suppliers[1].id,
        orderNo: 'PO-20240409-002',
        totalAmount: 8000,
        status: 'completed',
        remark: '标准件补货'
      }
    });
    await Promise.all([
      prisma.purchaseItem.create({
        data: {
          orderId: purchaseOrder2.id,
          materialId: materials[2].id,
          quantity: 1000,
          price: 5,
          receivedQuantity: 1000
        }
      }),
      prisma.purchaseItem.create({
        data: {
          orderId: purchaseOrder2.id,
          materialId: materials[3].id,
          quantity: 2000,
          price: 1.5,
          receivedQuantity: 2000
        }
      })
    ]);
    console.log('✓ 创建了采购单');

    // ============ 创建销售单 ============
    console.log('💵 创建销售单...');
    const salesOrder1 = await prisma.salesOrder.create({
      data: {
        customerId: customers[0].id,
        orderNo: 'SO-20240409-001',
        totalAmount: 150000,
        status: 'shipped',
        remark: '首批订单'
      }
    });
    await Promise.all([
      prisma.salesItem.create({
        data: {
          orderId: salesOrder1.id,
          materialId: materials[0].id,
          quantity: 100,
          price: 800,
          shippedQuantity: 100
        }
      }),
      prisma.salesItem.create({
        data: {
          orderId: salesOrder1.id,
          materialId: materials[1].id,
          quantity: 50,
          price: 1400,
          shippedQuantity: 50
        }
      })
    ]);
    console.log('✓ 创建了销售单');

    // ============ 创建生产报工记录 ============
    console.log('📊 创建生产报工记录...');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await Promise.all([
      // 张三昨天的工作记录
      prisma.productionRecord.create({
        data: {
          employeeId: employees[0].id,
          productId: products[0].id,
          processId: processes[0].id,
          quantity: 120,
          date: yesterday,
          status: 'approved',
          remark: '正常加工'
        }
      }),
      prisma.productionRecord.create({
        data: {
          employeeId: employees[0].id,
          productId: products[0].id,
          processId: processes[1].id,
          quantity: 120,
          date: yesterday,
          status: 'approved',
          remark: '精加工完成'
        }
      }),
      // 李四今天的工作记录
      prisma.productionRecord.create({
        data: {
          employeeId: employees[1].id,
          productId: products[1].id,
          processId: processes[0].id,
          quantity: 80,
          date: today,
          status: 'pending',
          remark: '上午批次'
        }
      }),
      // 王五今天的工作记录
      prisma.productionRecord.create({
        data: {
          employeeId: employees[2].id,
          productId: products[2].id,
          processId: processes[3].id,
          quantity: 150,
          date: today,
          status: 'pending',
          remark: '正常装配'
        }
      }),
      // 赵六昨天的工作记录
      prisma.productionRecord.create({
        data: {
          employeeId: employees[3].id,
          productId: products[2].id,
          processId: processes[3].id,
          quantity: 130,
          date: yesterday,
          status: 'approved',
          remark: '装配完成'
        }
      })
    ]);
    console.log('✓ 创建了生产报工记录');

    // ============ 输出统计信息 ============
    console.log('\n📊 数据统计');
    console.log('================================');
    console.log(`部门数量: ${departments.length}`);
    console.log(`员工数量: ${employees.length}`);
    console.log(`工序数量: ${processes.length}`);
    console.log(`产品数量: ${products.length}`);
    console.log(`物料数量: ${materials.length}`);
    console.log(`供应商数量: ${suppliers.length}`);
    console.log(`客户数量: ${customers.length}`);
    console.log('================================');
    console.log('\n✅ 演示数据生成完成！');
    console.log('\n使用以下信息登录:');
    console.log('  用户名: admin');
    console.log('  密码: admin123');
  } catch (error) {
    console.error('❌ 生成演示数据失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createDemoData();
