import { isAssistantGroupMessage, isGroupMessage, isResponseMessage, isUserMessage, Message } from '@common/types';

export enum MessageMapRole {
  User = 'user',
  Assistant = 'assistant',
}

export type MessageMapEntry = {
  id: string;
  index: number;
  role: MessageMapRole;
  preview: string;
};

export type MessageMapTurn = {
  id: string;
  number: number;
  startIndex: number;
  userIndex: number | null;
  userPreview: string;
  lastAssistantIndex: number | null;
  lastAssistantPreview: string;
};

const PREVIEW_LENGTH = 280;

export const createMessageMapEntries = (messages: Message[]): MessageMapEntry[] => {
  const entries: MessageMapEntry[] = [];

  const addMessage = (message: Message, index: number, path: string) => {
    if (isGroupMessage(message)) {
      message.children.forEach((child, childIndex) => addMessage(child, index, `${path}-${childIndex}`));
    } else if (isAssistantGroupMessage(message)) {
      addMessage(message.responseMessage, index, path);
    } else if (isUserMessage(message) || isResponseMessage(message)) {
      entries.push({
        id: `${path}-${message.id}`,
        index,
        role: isUserMessage(message) ? MessageMapRole.User : MessageMapRole.Assistant,
        preview: message.content.trim().slice(0, PREVIEW_LENGTH),
      });
    }
  };

  messages.forEach((message, index) => addMessage(message, index, String(index)));
  return entries;
};

// Collapses the flat message entries into conversation turns. A turn starts at each user prompt and
// absorbs the assistant replies that follow it, tracking the last reply of the turn. Assistant
// replies that appear before any user prompt form a leading turn with no user message.
export const createMessageMapTurns = (messages: Message[]): MessageMapTurn[] => {
  const entries = createMessageMapEntries(messages);
  const turns: MessageMapTurn[] = [];

  for (const entry of entries) {
    const currentTurn = turns.at(-1);
    const isUser = entry.role === MessageMapRole.User;

    if (isUser || !currentTurn) {
      turns.push({
        id: entry.id,
        number: turns.length + 1,
        startIndex: entry.index,
        userIndex: isUser ? entry.index : null,
        userPreview: isUser ? entry.preview : '',
        lastAssistantIndex: isUser ? null : entry.index,
        lastAssistantPreview: isUser ? '' : entry.preview,
      });
    } else {
      currentTurn.lastAssistantIndex = entry.index;
      currentTurn.lastAssistantPreview = entry.preview;
    }
  }

  return turns;
};

export type MessageMapMarkerItem = {
  id: string;
  turnNumber: number;
  role: MessageMapRole;
  index: number;
  preview: string;
};

// Flattens turns into individually navigable markers: a green user-prompt marker and a blue
// last-assistant-reply marker per turn, kept in ascending rendered order for scroll tracking.
export const createMessageMapMarkers = (turns: MessageMapTurn[]): MessageMapMarkerItem[] => {
  const markers: MessageMapMarkerItem[] = [];

  for (const turn of turns) {
    if (turn.userIndex !== null) {
      markers.push({ id: `${turn.id}-user`, turnNumber: turn.number, role: MessageMapRole.User, index: turn.userIndex, preview: turn.userPreview });
    }
    if (turn.lastAssistantIndex !== null) {
      markers.push({
        id: `${turn.id}-assistant`,
        turnNumber: turn.number,
        role: MessageMapRole.Assistant,
        index: turn.lastAssistantIndex,
        preview: turn.lastAssistantPreview,
      });
    }
  }

  return markers;
};

// Selection follows user messages only: the active marker is the user message currently in the
// scroll view, or the previous one when the viewport sits within that turn's replies.
export const getActiveMarkerId = (markers: MessageMapMarkerItem[], visibleIndex: number): string | null => {
  const userMarkers = markers.filter((marker) => marker.role === MessageMapRole.User);
  let active: MessageMapMarkerItem | undefined;
  for (const marker of userMarkers) {
    if (marker.index <= visibleIndex) {
      active = marker;
    } else {
      break;
    }
  }
  return (active ?? userMarkers[0])?.id ?? null;
};
