# Questions Extension

Extract questions from messages and display them as an interactive questionnaire.

## Overview

The Questions Extension analyzes the last message in a conversation, extracts all questions, and presents them as an interactive questionnaire above the prompt field. Users can navigate through questions, answer them one by one, and submit all answers to the agent.

## Features

- **Smart Question Extraction**: Uses AI to identify and extract questions from message content
- **Interactive Questionnaire UI**: Displays questions with navigation controls above the prompt field
- **Answer Management**: Record answers for each question with auto-advance to the next question
- **Batch Submission**: Submit all answers at once to continue the conversation
- **Visual Feedback**: Progress indicators, answer status, and question navigation

## Installation

### Via CLI (Recommended)

```bash
npx @aiderdesk/extensions install questions
```

### Manual Installation

Copy the `questions` folder to your AiderDesk extensions directory:

```bash
# For project-level installation
cp -r questions/ /path/to/your/project/.aider-desk/extensions/

# For global installation
cp -r questions/ ~/.aider-desk/extensions/
```

## Usage

### Extract Questions

Type the `/questions` command in the prompt field:

```
/questions
```

The extension will:
1. Analyze the last message in the conversation
2. Extract all questions (sentences ending with "?")
3. Display them as an interactive questionnaire

### Answer Questions

Once the questionnaire appears:

1. **Navigate**: Use the Previous/Next buttons or `Alt+←/→` to move between questions
2. **Answer**: Type your answer in the text area for each question
3. **Track Progress**: See how many questions have been answered (e.g., "2/4 answered")
4. **Quick navigation**: Press `Ctrl/Cmd + Enter` to move to the next question

### Submit All Answers

When all questions are answered:
- The "Submit All" button becomes enabled (in the navigation row)
- Click it to submit all answers as a formatted prompt to the agent
- The agent will receive all Q&A pairs in a structured format

### Close Questionnaire

Click the X button in the top-right corner to dismiss the questionnaire.

## Example

**User sends a message:**
```
What is the purpose of this function? How does it handle errors? 
What are the input parameters? Is there any documentation?
```

**Run `/questions`:**
The extension extracts 4 questions and displays them in the questionnaire.

**Answer each question:**
- Navigate through questions using Previous/Next
- Type answers in the text area (answers are stored locally)
- The progress indicator shows how many questions are answered

**Submit all answers:**
```
Q1: What is the purpose of this function?
A1: The function validates user input before processing.

Q2: How does it handle errors?
A2: It throws a ValidationError with detailed messages.

Q3: What are the input parameters?
A3: It accepts a data object and an optional config object.

Q4: Is there any documentation?
A4: Yes, see the JSDoc comments in the source file.
```

## Technical Details

### Question Extraction

The extension uses the task's AI model to extract questions:
- Analyzes the last message content (text parts only)
- Uses a specialized system prompt for JSON output
- Parses and validates the question array
- Handles edge cases (no questions, parse errors, etc.)

### State Management

- Questions are stored per-task in memory
- Each question has an ID, text, and optional answer
- State includes current question index and active status
- State is cleared when answers are submitted or questionnaire is closed

### UI Component

The questionnaire component:
- Placement: `task-input-above` (above the prompt field)
- Local state management for answers (stored in component, not extension)
- Real-time progress tracking (answered count)
- Uses AiderDesk UI components (Button, TextArea)
- Styled with Tailwind CSS
- Keyboard shortcut (`Ctrl/Cmd + Enter`) for quick navigation
- Submit All button enabled when all questions are answered

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + ←` | Previous question |
| `Alt + →` | Next question |
| `Ctrl/Cmd + Enter` | Next question (while typing) |

## Configuration

### Custom Model for Question Extraction

By default, the extension uses the current task's agent model to extract questions. You can configure a specific model for question extraction (useful for using a faster/cheaper model):

1. Open `questions/index.ts`
2. Find the `CUSTOM_MODEL_ID` constant at the top of the file
3. Set it to your desired model in the format `provider/model`:
   ```typescript
   const CUSTOM_MODEL_ID = 'openai/gpt-4o-mini'; // example
   ```

**Available providers**: `openai`, `anthropic`, `gemini`, `groq`, `deepseek`, `ollama`, `lmstudio`, etc.

When `CUSTOM_MODEL_ID` is set, the extension will use that model instead of the task's agent model.

## Limitations

- Only extracts questions from the **last message** in the conversation
- Questions must end with "?" to be recognized
- Only text content is analyzed (images, files, etc. are ignored)
- Requires either a configured `CUSTOM_MODEL_ID` or an active agent profile

## Troubleshooting

### "No questions found"

The last message doesn't contain any questions ending with "?". Make sure the message includes question marks.

### "Failed to parse extracted questions"

The AI model returned an invalid response. Try running the command again or check the model configuration.

### "No agent profile available"

The task doesn't have an agent profile configured. Make sure you're using agent mode and have a model selected.

## Contributing

Feel free to submit issues and pull requests to improve this extension!

## License

MIT
