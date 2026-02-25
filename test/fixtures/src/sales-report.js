// Sales reporting module

export function generateSalesReport(sales) {
  const total = sales.reduce((sum, s) => sum + s.revenue, 0);
  const average = sales.length > 0 ? total / sales.length : 0;
  const maxSale = sales.reduce(
    (max, s) => (s.revenue > max.revenue ? s : max),
    sales[0]
  );
  const minSale = sales.reduce(
    (min, s) => (s.revenue < min.revenue ? s : min),
    sales[0]
  );

  return {
    type: "sales",
    count: sales.length,
    total: Math.round(total * 100) / 100,
    average: Math.round(average * 100) / 100,
    max: maxSale ? maxSale.revenue : 0,
    min: minSale ? minSale.revenue : 0,
    generatedAt: new Date().toISOString(),
  };
}
