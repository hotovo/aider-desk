import { AgentProfile, QuestionData, ToolApprovalState } from '@common/types';

import { Project } from '../../project';

export class ApprovalManager {
  private alwaysApproveForRunKeys: Set<string> = new Set();

  constructor(
    private readonly project: Project,
    private readonly profile: AgentProfile,
  ) {}

  public async handleApproval(key: string, text: string, subject?: string): Promise<[boolean, string | undefined]> {
    if (this.profile.autoApprove) {
      return [true, undefined]; // Auto-approve
    }

    const isApprovedFromSet =
      this.alwaysApproveForRunKeys.has(key) || (this.profile.toolApprovals[key] || ToolApprovalState.Always) === ToolApprovalState.Always;
    if (isApprovedFromSet) {
      return [true, undefined]; // Pre-approved
    }

    const questionData: QuestionData = {
      baseDir: this.project.baseDir,
      text,
      subject,
      defaultAnswer: 'y',
      answers: [
        { text: '(Y)es', shortkey: 'y' },
        { text: '(N)o', shortkey: 'n' },
        { text: '(A)lways', shortkey: 'a' },
        { text: 'Always for This (R)un', shortkey: 'r' },
      ],
      key,
    };

    const [answer, userInput] = await this.project.askQuestion(questionData);

    if (answer === 'r') {
      this.alwaysApproveForRunKeys.add(key);
      return [true, undefined]; // Approved and remember for this run
    }

    if (answer === 'y' || answer === 'a') {
      return [true, undefined]; // Approved for this instance
    }

    return [false, userInput]; // Not approved
  }
}
