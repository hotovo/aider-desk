// Bun-specific global variables that are defined during build

/**
 * Build directory path for Bun CWD bug workaround.
 * This is defined during build via Bun.build() define option.
 */
declare const __BUN_BUILD_DIR__: string;
