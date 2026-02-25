// Admin service module

export function validateAdmin(admin) {
  const errors = [];
  if (!admin.name || admin.name.trim().length === 0) {
    errors.push("Name is required");
  }
  if (!admin.email || !admin.email.includes("@")) {
    errors.push("Valid email is required");
  }
  if (!admin.password || admin.password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [] };
}

export function formatAdminForApi(admin) {
  return {
    id: admin.id,
    fullName: `${admin.firstName} ${admin.lastName}`,
    email: admin.email.toLowerCase(),
    role: admin.role || "admin",
    department: admin.department,
    createdAt: new Date(admin.createdAt).toISOString(),
    updatedAt: new Date(admin.updatedAt).toISOString(),
  };
}

export async function fetchAdmins(db, filters = {}) {
  let query = "SELECT * FROM admins WHERE 1=1";
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
