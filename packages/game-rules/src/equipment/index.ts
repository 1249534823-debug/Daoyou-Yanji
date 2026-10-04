export {
  DAO_EQUIPMENT_TEMPLATE_ID,
  DAO_EQUIPMENT_TEMPLATES_V1,
  DAO_FORMATION_INSCRIPTION_ID,
  DAO_FORMATION_INSCRIPTIONS_V1,
  daoEquipmentTemplateOf,
  daoFormationInscriptionOf,
} from "@daoyou/game-content/equipment/content"
export {
  generateDaoEquipmentV1,
  generateDaoEquipmentV2,
  daoEquipmentGenerationRulesV1,
  daoEquipmentGenerationRulesV2,
} from "./generator.js"
export {
  compileDaoEquipmentLoadoutV1,
  compileDaoEquipmentSpecialLoadoutV1,
  validateDaoEquipmentInstanceV1,
} from "./compiler.js"
export type { CompileDaoEquipmentSpecialOptions } from "./compiler.js"
export {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCE_ID,
  DAO_EQUIPMENT_ESSENCES_V1,
  DAO_RAGE_PASSIVE_ID,
  DAO_RAGE_RESOURCE_ID,
  createDaoRageGainPassive,
  daoEquipmentArtOf,
  daoEquipmentEssenceOf,
} from "@daoyou/game-content/equipment/special-content"
export {
  DAO_EQUIPMENT_GENERATOR_VERSION,
  DAO_EQUIPMENT_GENERATOR_VERSION_V2,
  DAO_EQUIPMENT_GENERATOR_VERSION_V4,
  DAO_EQUIPMENT_GENERATOR_VERSION_V5,
  DAO_EQUIPMENT_SLOTS,
} from "@daoyou/game-domain/equipment/types"
export { DAO_WEAPONS } from '@daoyou/game-content/equipment/weapons';
export { DAO_WEAPON_TYPES, daoWeaponTypeOf } from '@daoyou/game-domain/equipment/weapons';
export type { DaoWeaponType } from '@daoyou/game-domain/equipment/weapons';
export { daoFormationMaxLevel, daoFormationPanel } from './inscriptions.js';
export type {
  CombatV6PanelAttr,
  CompileDaoEquipmentLoadoutV1Result,
  CompileDaoEquipmentSpecialLoadoutV1Result,
  DaoEquipmentAttribute,
  DaoEquipmentAttributeRoll,
  DaoEquipmentGenerationResult,
  DaoEquipmentInstanceV1,
  DaoEquipmentArtDefV1,
  DaoEquipmentEssenceDefV1,
  DaoEquipmentGeneratorVersion,
  DaoEquipmentLoadoutV1,
  DaoEquipmentPanelRoll,
  DaoEquipmentProjectionV1,
  DaoEquipmentSpecialProjectionV1,
  DaoEquipmentSlot,
  DaoEquipmentTemplateV1,
  DaoFormationInscriptionDefV1,
  DaoFormationInscriptionStateV1,
  GenerateDaoEquipmentV1Input,
  GenerateDaoEquipmentV2Input,
} from "@daoyou/game-domain/equipment/types"
