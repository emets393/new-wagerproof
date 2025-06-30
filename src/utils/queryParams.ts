
export const buildQueryString = (filters: Record<string, string>): string => {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim() !== '') {
      const trimmedValue = value.trim();
      
      // Handle different operators
      if (trimmedValue.startsWith("lt:")) {
        params.append(`${key}_lt`, trimmedValue.slice(3));
      } else if (trimmedValue.startsWith("gt:")) {
        params.append(`${key}_gt`, trimmedValue.slice(3));
      } else if (trimmedValue.startsWith("between:")) {
        const [min, max] = trimmedValue.slice(8).split("-");
        params.append(`${key}_min`, min);
        params.append(`${key}_max`, max);
      } else {
        // Exact match
        params.append(key, trimmedValue);
      }
    }
  });
  
  return params.toString();
};
