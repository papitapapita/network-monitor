/**
 * Address properties interface.
 *
 * Defines the structure of the properties required to create an Address Value Object.
 */
export interface AddressProps {
  street: string;
  houseNumber?: string;
  city: string;
  province: string;
  country: string;
  postalCode?: string;
  complement?: string;
  neighborhood?: string;
}
