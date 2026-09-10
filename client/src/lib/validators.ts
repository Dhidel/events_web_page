const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isNameValid = (value: string) => value.trim().length > 0;
export const isPhoneValid = (value: string) => PHONE_REGEX.test(value.trim());
export const isEmailValid = (value: string) => EMAIL_REGEX.test(value.trim());
