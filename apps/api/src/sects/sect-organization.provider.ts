import { sectOrganizationFacade } from './organization/productionSectOrganization';

export const SECT_ORGANIZATION = Symbol('SECT_ORGANIZATION');
export type SectOrganization = typeof sectOrganizationFacade;
export const sectOrganizationProvider = {
  provide: SECT_ORGANIZATION,
  useValue: sectOrganizationFacade,
};
