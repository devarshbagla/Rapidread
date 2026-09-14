import { IconChevronLeft, IconSettings } from '@tabler/icons-react';
import { IconButton } from '../ui/IconButton';

interface ReaderTopBarProps {
  onBack: () => void;
  onOpenSettings: () => void;
}

/** The Reader's only visible chrome: small, muted, always present. */
export function ReaderTopBar({ onBack, onOpenSettings }: ReaderTopBarProps) {
  return (
    <div className="reader-topbar">
      <IconButton label="Back to library" onClick={onBack}>
        <IconChevronLeft size={20} stroke={1.5} aria-hidden="true" />
      </IconButton>
      <IconButton label="Settings" onClick={onOpenSettings}>
        <IconSettings size={18} stroke={1.5} aria-hidden="true" />
      </IconButton>
    </div>
  );
}
