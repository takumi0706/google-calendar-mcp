// Re-export validated configuration for backward compatibility
// This maintains existing import paths while adding Zod validation
import validatedConfig from './validated-config';

export default validatedConfig;

// Re-export types and utilities for advanced usage
export { validatedConfigManager, type Config, type Environment, type ConfigValidationError } from './validated-config';
