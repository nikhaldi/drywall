// User service module

export function validateUser(user) {
  const errors = [];
  if (!user.name || user.name.trim().length === 0) {
    errors.push("Name is required");
  }
  if (!user.email || !user.email.includes("@")) {
    errors.push("Valid email is required");
  }
  if (!user.password || user.password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [] };
}

export function formatUserForApi(user) {
  return {
    id: user.id,
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email.toLowerCase(),
    role: user.role || "member",
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}

export async function fetchUsers(db, filters = {}) {
  let query = "SELECT * FROM users WHERE 1=1";
  const params = [];

  if (filters.role) {
    query += " AND role = ?";
    params.push(filters.role);
  }
  if (filters.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }
  if (filters.createdAfter) {
    query += " AND created_at > ?";
    params.push(filters.createdAfter);
  }

  query += " ORDER BY created_at DESC";

  if (filters.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }

  return db.query(query, params);
}
