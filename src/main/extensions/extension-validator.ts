import path from 'path';

import * as ts from 'typescript';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export class ExtensionValidator {
  async validateExtension(filePath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create a program to validate the TypeScript file
    const compilerOptions: ts.CompilerOptions = {
      noEmit: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      allowSyntheticDefaultImports: true,
    };

    // We only care about the extension file itself
    const program = ts.createProgram([filePath], compilerOptions);

    // Get all diagnostics
    const allDiagnostics = ts.getPreEmitDiagnostics(program);

    // Filter diagnostics for the specific file
    for (const diagnostic of allDiagnostics) {
      if (diagnostic.file) {
        // Normalize paths for comparison
        const diagnosticPath = path.resolve(diagnostic.file.fileName);
        const targetPath = path.resolve(filePath);

        if (diagnosticPath === targetPath) {
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
          const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
          errors.push(`${path.basename(filePath)} (${line + 1},${character + 1}): ${message}`);
        }
      } else {
        // General compiler errors
        // We might want to filter out some general errors if they are not relevant to the file
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
