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

export const formatDateByGroup = (timestamp: string, groupBy: GroupBy): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');

  switch (groupBy) {
    case GroupBy.Year:
      return year.toString();
    case GroupBy.Month:
      return `${year}-${month}`;
    case GroupBy.Day:
      return `${year}-${month}-${day}`;
    case GroupBy.Hour:
      return `${year}-${month}-${day} ${hour}:00`;
    default:
      return `${year}-${month}-${day}`;
  }
};
