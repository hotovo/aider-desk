import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AgentProfile } from '@aider-desk/common/types';

import { AgentProfileItem } from './AgentProfileItem';

type SortableAgentProfileItemProps = {
  profile: AgentProfile;
  isSelected: boolean;
  onClick: (id: string) => void;
  onCopy?: (profile: AgentProfile) => void;
  onCut?: (profile: AgentProfile) => void;
  onDelete?: (profile: AgentProfile) => void;
  isCut?: boolean;
  isDefaultProfile?: boolean;
};

export const SortableAgentProfileItem = ({ profile, isSelected, onClick, onCopy, onCut, onDelete, isCut, isDefaultProfile }: SortableAgentProfileItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: profile.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <AgentProfileItem
        profile={profile}
        isSelected={isSelected}
        onClick={onClick}
        onCopy={onCopy}
        onCut={onCut}
        onDelete={onDelete}
        isCut={isCut}
        isDefaultProfile={isDefaultProfile}
      />
    </div>
  );
};
