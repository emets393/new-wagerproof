
export const buildQueryString = (filters: Record<string, string>): string => {
  const params = new URLSearchParams();
  const processedFields = new Set<string>();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim() !== '') {
      const trimmedValue = value.trim();
      
      // Check if this is a _min or _max parameter
      if (key.endsWith('_min')) {
        const baseField = key.slice(0, -4); // Remove '_min'
        if (processedFields.has(baseField)) return; // Already processed this field
        
        const minValue = trimmedValue;
        const maxKey = `${baseField}_max`;
        const maxValue = filters[maxKey]?.trim();
        
        if (maxValue && maxValue !== '') {
          // Both min and max exist - use between format
          params.append(baseField, `between:${minValue}-${maxValue}`);
        } else {
          // Only min exists - use gt format
          params.append(baseField, `gt:${minValue}`);
        }
        processedFields.add(baseField);
        
      } else if (key.endsWith('_max')) {
        const baseField = key.slice(0, -4); // Remove '_max'
        if (processedFields.has(baseField)) return; // Already processed this field
        
        const maxValue = trimmedValue;
        const minKey = `${baseField}_min`;
        const minValue = filters[minKey]?.trim();
        
        if (minValue && minValue !== '') {
          // Both min and max exist - use between format
          params.append(baseField, `between:${minValue}-${maxValue}`);
        } else {
          // Only max exists - use lt format
          params.append(baseField, `lt:${maxValue}`);
        }
        processedFields.add(baseField);
        
      } else {
        // Handle existing operators and exact matches
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
    }
  });
  
  return params.toString();
};
