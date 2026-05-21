// 软删除/归档相关辅助
export const ARCHIVED = 'archived'

// list 默认过滤掉 archived；前端传 includeArchived=true 才显示
export function buildArchivedFilter(includeArchived?: any) {
  const include = includeArchived === 'true' || includeArchived === true || includeArchived === '1'
  return include ? undefined : { not: ARCHIVED }
}
