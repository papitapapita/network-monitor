import { CountryCode } from 'libphonenumber-js';

export interface PhoneNumberProps {
  value: string; // E.164 format
  countryCode: string;
  nationalNumber: string;
  formattedInternational: string;
  formattedNational: string;
  country?: CountryCode;
  type?: string; // MOBILE, FIXED_LINE, etc.
}
