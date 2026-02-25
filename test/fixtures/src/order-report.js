// Order reporting module

export function generateOrderReport(orders) {
  const total = orders.reduce((sum, o) => sum + o.amount, 0);
  const average = orders.length > 0 ? total / orders.length : 0;
  const maxOrder = orders.reduce(
    (max, o) => (o.amount > max.amount ? o : max),
    orders[0]
  );
  const minOrder = orders.reduce(
    (min, o) => (o.amount < min.amount ? o : min),
    orders[0]
  );

  return {
    type: "orders",
    count: orders.length,
    total: Math.round(total * 100) / 100,
    average: Math.round(average * 100) / 100,
    max: maxOrder ? maxOrder.amount : 0,
    min: minOrder ? minOrder.amount : 0,
    generatedAt: new Date().toISOString(),
  };
}
