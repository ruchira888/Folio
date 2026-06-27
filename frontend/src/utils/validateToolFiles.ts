import { TOOL_MODAL_CONFIG, type ToolType } from '../config/toolConfigs';

export function validateToolFiles(
  toolType: ToolType,
  files: File[],
): string | null {
  const config = TOOL_MODAL_CONFIG[toolType];

  if (files.length === 0) {
    return 'Please select a file to continue.';
  }

  if (files.length > config.maxFiles) {
    return `Please select up to ${config.maxFiles} file${config.maxFiles > 1 ? 's' : ''}.`;
  }

  if (toolType === 'merge' && files.length < 2) {
    return 'Please select at least 2 PDF files to merge.';
  }

  for (const file of files) {
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > config.maxSizeMb) {
      return `Each file must be ${config.maxSizeMb}MB or smaller.`;
    }

    if (toolType === 'convert') {
      continue;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return 'Please select a valid PDF file.';
    }
  }

  return null;
}
