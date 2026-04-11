/**
 * Filter items by calendar period. Same rules as Order Management.
 * @param {Array} items
 * @param {string} timeFilter - 'All Time' | 'Today' | ...
 * @param {(item: *) => string|Date|null|undefined} getItemDate
 */
export function filterByDateRange(items, timeFilter, getItemDate) {
    if (timeFilter === 'All Time' || !items?.length) return items;
  
    const now = new Date();
    const inRange = (d, start, end) => d >= start && d <= end;
  
    let startDate;
    let endDate;
  
    switch (timeFilter) {
      case 'Today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'Yesterday':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'Last 7 Days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'Last 30 Days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'This Month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'Last Month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      default:
        return items;
    }
  
    return items.filter((item) => {
      const raw = getItemDate(item);
      if (raw == null || raw === '') return false;
      const itemDate = new Date(raw);
      if (Number.isNaN(itemDate.getTime())) return false;
      return inRange(itemDate, startDate, endDate);
    });
  }
  
  export const TIME_FILTER_OPTIONS = [
    'All Time',
    'Today',
    'Yesterday',
    'Last 7 Days',
    'Last 30 Days',
    'This Month',
    'Last Month'
  ];