// CSV export utilities

export function exportUsersCsv(users) {
  const headers = ["id", "name", "email", "role", "created_at"];
  const lines = [headers.join(",")];

  for (const user of users) {
    const row = [
      user.id,
      `"${user.name.replace(/"/g, '""')}"`,
      `"${user.email.replace(/"/g, '""')}"`,
      user.role,
      user.createdAt,
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

export function exportOrdersCsv(orders) {
  const headers = ["id", "customer", "amount", "status", "created_at"];
  const lines = [headers.join(",")];

  for (const order of orders) {
    const row = [
      order.id,
      `"${order.customer.replace(/"/g, '""')}"`,
      `"${order.amount}"`,
      order.status,
      order.createdAt,
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

export function exportProductsCsv(products) {
  const headers = ["id", "name", "price", "category", "created_at"];
  const lines = [headers.join(",")];

  for (const product of products) {
    const row = [
      product.id,
      `"${product.name.replace(/"/g, '""')}"`,
      `"${product.price}"`,
      product.category,
      product.createdAt,
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}
