const STAFF_REFERRAL_KEY = "store_staff_referral";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isStaffReferralId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function saveStaffReferralId(value: string): void {
  if (!isStaffReferralId(value)) {
    clearStaffReferralId();
    return;
  }

  try {
    sessionStorage.setItem(STAFF_REFERRAL_KEY, value);
  } catch (reason) {
    console.warn("Staff referral could not be saved for checkout", reason);
  }
}

export function readStaffReferralId(): string | null {
  try {
    const value = sessionStorage.getItem(STAFF_REFERRAL_KEY);
    return value && isStaffReferralId(value) ? value : null;
  } catch (reason) {
    console.warn("Staff referral could not be read for checkout", reason);
    return null;
  }
}

export function clearStaffReferralId(): void {
  try {
    sessionStorage.removeItem(STAFF_REFERRAL_KEY);
  } catch (reason) {
    console.warn("Staff referral could not be cleared after checkout", reason);
  }
}
