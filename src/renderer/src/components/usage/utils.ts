// Generate a consistent color palette for charts
export const generateColorPalette = (count: number): string[] => {
  const baseColors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
  ];

  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  // Generate additional colors by varying hue
  const colors = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const hue = (i * 137.508) % 360; // Golden angle approximation for good distribution
    colors.push(`hsl(${hue}, 65%, 55%)`);
  }

  return colors;
};

enum GroupBy {
  Year = 'year',
  Month = 'month',
  Day = 'day',
  Hour = 'hour',
}

export const getPeriodKey = (timestamp: string, groupBy: GroupBy): string => {
  const dateObj = new Date(timestamp);

  switch (groupBy) {
    case GroupBy.Hour:
      return dateObj.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
    case GroupBy.Day:
      return dateObj.toISOString().split('T')[0]; // "YYYY-MM-DD"
    case GroupBy.Year:
      return dateObj.toISOString().slice(0, 4); // "YYYY"
    // default is month
    default:
      return dateObj.toISOString().slice(0, 7); // "YYYY-MM"
  }
};

export const formatDateByGroup = (date: Date, groupBy: GroupBy): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // Months are 0-indexed

  switch (groupBy) {
    case GroupBy.Year:
      return year.toString();
    case GroupBy.Month:
      return `${month}/${year}`;
    case GroupBy.Day:
      return date.toLocaleDateString();
    case GroupBy.Hour:
      return date.toLocaleTimeString([], { hour: '2-digit' });
    default:
      return date.toLocaleDateString();
  }
};
