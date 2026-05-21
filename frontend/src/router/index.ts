import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { tokenManager } from '../api/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    children: [
      {
        path: '',
        name: 'DashboardHome',
        component: () => import('@/views/DashboardHome.vue')
      },
      {
        path: 'salary',
        name: 'Salary',
        redirect: '/dashboard/salary/salary-calculation',
        children: [
          {
            path: 'salary-calculation',
            name: 'SalaryCalculation',
            component: () => import('@/views/salary/SalaryCalculation.vue')
          },
          {
            path: 'daily-records',
            name: 'DailyPieceRecord',
            component: () => import('@/views/salary/DailyPieceRecord.vue')
          },
          {
            path: 'work-logs',
            name: 'WorkLogRecord',
            component: () => import('@/views/salary/WorkLogRecord.vue')
          },
          {
            path: 'other-salaries',
            name: 'OtherSalaryList',
            component: () => import('@/views/salary/OtherSalaryList.vue')
          }
        ]
      },
      {
        path: 'basic-info',
        name: 'BasicInfo',
        redirect: '/dashboard/basic-info/products',
        children: [
          {
            path: 'products',
            name: 'ProductList',
            component: () => import('@/views/salary/ProductList.vue')
          },
          {
            path: 'bom',
            name: 'BomManage',
            component: () => import('@/views/inventory/BomManage.vue')
          }
        ]
      },
      {
        path: 'inventory',
        name: 'Inventory',
        redirect: '/dashboard/inventory/partners',
        children: [
          {
            path: 'partners',
            name: 'PartnerList',
            component: () => import('@/views/inventory/PartnerList.vue')
          },
          {
            path: 'materials',
            name: 'MaterialList',
            component: () => import('@/views/inventory/MaterialList.vue')
          },
          {
            path: 'purchase-orders',
            name: 'PurchaseOrder',
            component: () => import('@/views/inventory/PurchaseOrder.vue')
          },
          {
            path: 'sales-orders',
            name: 'SalesOrder',
            component: () => import('@/views/inventory/SalesOrder.vue')
          },
          {
            path: 'inventory-query',
            name: 'InventoryQuery',
            component: () => import('@/views/inventory/InventoryQuery.vue')
          },
          {
            path: 'material-requirements',
            name: 'MaterialRequirement',
            component: () => import('@/views/inventory/MaterialRequirement.vue')
          },
          {
            path: 'return-orders',
            name: 'ReturnOrder',
            component: () => import('@/views/inventory/ReturnOrder.vue')
          }
        ]
      },
      {
        path: 'finance',
        name: 'Finance',
        redirect: '/dashboard/finance/receivables',
        children: [
          {
            path: 'receivables',
            name: 'ReceivableList',
            component: () => import('@/views/finance/ReceivableList.vue')
          },
          {
            path: 'payables',
            name: 'PayableList',
            component: () => import('@/views/finance/PayableList.vue')
          }
        ]
      },
      {
        path: 'production',
        name: 'Production',
        redirect: '/dashboard/production/orders',
        children: [
          {
            path: 'orders',
            name: 'ProductionOrder',
            component: () => import('@/views/production/ProductionOrder.vue')
          }
        ]
      },
      {
        path: 'system',
        name: 'System',
        redirect: '/dashboard/system/users',
        children: [
          {
            path: 'users',
            name: 'UserManagement',
            component: () => import('@/views/system/UserManagement.vue')
          },
          {
            path: 'job-types',
            name: 'JobTypeList',
            component: () => import('@/views/system/JobTypeList.vue')
          },
          {
            path: 'employees',
            name: 'EmployeeList',
            component: () => import('@/views/salary/EmployeeList.vue')
          },
          {
            path: 'departments',
            name: 'DepartmentList',
            component: () => import('@/views/system/DepartmentList.vue')
          },
          {
            path: 'settings',
            name: 'SystemSettings',
            component: () => import('@/views/system/SystemSettings.vue')
          }
        ]
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach((to) => {
  const token = tokenManager.getToken()
  const requiresAuth = to.path !== '/login'

  if (requiresAuth && !token) {
    return '/login'
  }
  if (to.path === '/login' && token) {
    return '/dashboard'
  }
})

export default router
