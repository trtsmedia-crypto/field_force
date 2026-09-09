export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

export const compactInr = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
};

export const relativeTime = (minutesAgo: number) => {
  if (minutesAgo < 1) return 'just now';
  if (minutesAgo < 60) return `${minutesAgo} min ago`;
  const h = Math.floor(minutesAgo / 60);
  return `${h} hr ago`;
};

export const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
