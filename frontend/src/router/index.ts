import { createRouter, createWebHistory } from 'vue-router'

const routes = [
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
        redirect: '/dashboard/salary/employees',
        children: [
          {
            path: 'employees',
            name: 'EmployeeList',
            component: () => import('@/views/salary/EmployeeList.vue')
          },
          {
            path: 'products',
            name: 'ProductList',
            component: () => import('@/views/salary/ProductList.vue')
          },
          {
            path: 'processes',
            name: 'ProcessList',
            component: () => import('@/views/salary/ProcessList.vue')
          },
          {
            path: 'production-records',
            name: 'ProductionRecord',
            component: () => import('@/views/salary/ProductionRecord.vue')
          },
          {
            path: 'salary-calculation',
            name: 'SalaryCalculation',
            component: () => import('@/views/salary/SalaryCalculation.vue')
          }
        ]
      },
      {
        path: 'inventory',
        name: 'Inventory',
        redirect: '/dashboard/inventory/suppliers',
        children: [
          {
            path: 'suppliers',
            name: 'SupplierList',
            component: () => import('@/views/inventory/SupplierList.vue')
          },
          {
            path: 'customers',
            name: 'CustomerList',
            component: () => import('@/views/inventory/CustomerList.vue')
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

export default router
