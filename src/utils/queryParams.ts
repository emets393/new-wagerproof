
export const buildQueryString = (filters: Record<string, string>): string => {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim() !== '') {
      params.append(key, value.trim());
    }
  });
  
  return params.toString();
};
