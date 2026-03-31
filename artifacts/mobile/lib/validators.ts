export type ValidationResult = { valid: boolean; error?: string };

export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) return { valid: false, error: "Email is required" };
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return { valid: false, error: "Enter a valid email address" };
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return { valid: false, error: "Password is required" };
  if (password.length < 6) return { valid: false, error: "Password must be at least 6 characters" };
  return { valid: true };
}

export function validateUsername(username: string): ValidationResult {
  if (!username.trim()) return { valid: false, error: "Username is required" };
  if (username.trim().length < 2) return { valid: false, error: "Username must be at least 2 characters" };
  if (username.trim().length > 30) return { valid: false, error: "Username must be under 30 characters" };
  const re = /^[a-zA-Z0-9_.-]+$/;
  if (!re.test(username.trim())) return { valid: false, error: "Username can only contain letters, numbers, _, . or -" };
  return { valid: true };
}

export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone.trim()) return { valid: false, error: "Phone number is required" };
  const clean = phone.replace(/[\s\-().+]/g, "");
  if (!/^\d{7,15}$/.test(clean)) return { valid: false, error: "Enter a valid phone number (7–15 digits)" };
  return { valid: true };
}

export function validateContactName(name: string): ValidationResult {
  if (!name.trim()) return { valid: false, error: "Name is required" };
  if (name.trim().length < 1) return { valid: false, error: "Name is required" };
  if (name.trim().length > 50) return { valid: false, error: "Name must be under 50 characters" };
  return { valid: true };
}

export function validateKeyword(keyword: string): ValidationResult {
  if (!keyword.trim()) return { valid: false, error: "Keyword is required" };
  if (keyword.trim().length < 2) return { valid: false, error: "Keyword must be at least 2 characters" };
  if (keyword.trim().length > 40) return { valid: false, error: "Keyword must be under 40 characters" };
  return { valid: true };
}

export function validateGroupName(name: string): ValidationResult {
  if (!name.trim()) return { valid: false, error: "Group name is required" };
  if (name.trim().length > 30) return { valid: false, error: "Group name must be under 30 characters" };
  return { valid: true };
}

export function validateRequired(value: string, label = "This field"): ValidationResult {
  if (!value.trim()) return { valid: false, error: `${label} is required` };
  return { valid: true };
}
