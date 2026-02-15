import { WorkflowMetadata, WorkflowPhase } from './bmad-types';

/**
 * Registry of all BMAD workflows with metadata
 * This is a hardcoded registry as per architecture decision
 * (Source: planning-artifacts/architecture.md#Workflow Discovery & Registry)
 */
export const BMAD_WORKFLOWS: WorkflowMetadata[] = [
  // Analysis Phase
  {
    id: 'brainstorming',
    name: 'Brainstorming',
    phase: WorkflowPhase.Analysis,
    description: 'Facilitate interactive brainstorming sessions using diverse creative techniques and ideation methods',
    workflowPath: '_bmad/core/workflows/brainstorming/workflow.md',
    outputArtifact: '_bmad-output/brainstorming/brainstorming-session-*.md',
    totalSteps: 4,
    followUps: ['create-product-brief'],
  },
  {
    id: 'research',
    name: 'Research',
    phase: WorkflowPhase.Analysis,
    description: 'Conduct comprehensive research across multiple domains using current web data and verified sources',
    workflowPath: '_bmad/bmm/workflows/1-analysis/research/workflow.md',
    outputArtifact: '_bmad-output/planning-artifacts/research*.md',
    totalSteps: 3,
    followUps: ['create-product-brief'],
  },
  {
    id: 'create-product-brief',
    name: 'Create Product Brief',
    phase: WorkflowPhase.Analysis,
    description: 'Define product vision and target users',
    workflowPath: '_bmad/bmm/workflows/1-analysis/create-product-brief/workflow.md',
    outputArtifact: '_bmad-output/planning-artifacts/product-brief*.md',
    totalSteps: 6,
    followUps: ['create-prd'],
  },

  // Planning Phase
  {
    id: 'create-prd',
    name: 'Create PRD',
    phase: WorkflowPhase.Planning,
    description: 'Create comprehensive requirements document',
    workflowPath: '_bmad/bmm/workflows/2-plan-workflows/create-prd/workflow.md',
    outputArtifact: '_bmad-output/planning-artifacts/prd.md',
    totalSteps: 12,
    requiredArtifacts: ['_bmad-output/planning-artifacts/product-brief*.md'],
    followUps: ['create-ux-design', 'create-architecture', 'create-epics-and-stories'],
  },
  {
    id: 'create-ux-design',
    name: 'Create UX Design',
    phase: WorkflowPhase.Planning,
    description: 'Create UX design documentation for product interface',
    workflowPath: '_bmad/bmm/workflows/2-plan-workflows/create-ux-design/workflow.md',
    outputArtifact: '_bmad-output/planning-artifacts/ux-design*.md',
    totalSteps: 14,
    requiredArtifacts: ['_bmad-output/planning-artifacts/prd.md'],
    followUps: ['create-architecture'],
  },

  // Solutioning Phase
  {
    id: 'create-architecture',
    name: 'Create Architecture',
    phase: WorkflowPhase.Solutioning,
    description: 'Design technical architecture and system structure',
    workflowPath: '_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.md',
    outputArtifact: '_bmad-output/planning-artifacts/architecture.md',
    totalSteps: 8,
    requiredArtifacts: ['_bmad-output/planning-artifacts/prd.md'],
    followUps: ['create-epics-and-stories'],
  },
  {
    id: 'create-epics-and-stories',
    name: 'Create Epics & Stories',
    phase: WorkflowPhase.Solutioning,
    description: 'Break down requirements into implementation-ready epics and stories',
    workflowPath: '_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md',
    outputArtifact: '_bmad-output/planning-artifacts/epics.md',
    totalSteps: 4,
    requiredArtifacts: ['_bmad-output/planning-artifacts/prd.md', '_bmad-output/planning-artifacts/architecture.md'],
    followUps: ['sprint-planning'],
  },

  // Implementation Phase
  {
    id: 'sprint-planning',
    name: 'Sprint Planning',
    phase: WorkflowPhase.Implementation,
    description: 'Generate and manage the sprint status tracking file for Phase 4 implementation',
    workflowPath: '_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml',
    outputArtifact: '_bmad-output/implementation-artifacts/sprint-status.yaml',
    totalSteps: 1,
    requiredArtifacts: ['_bmad-output/planning-artifacts/epics.md'],
    followUps: ['create-story'],
  },
  {
    id: 'create-story',
    name: 'Create Story',
    phase: WorkflowPhase.Implementation,
    description: 'Guided development for implementing stories and features',
    workflowPath: '_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml',
    outputArtifact: 'TBD',
    totalSteps: 1,
    requiredArtifacts: ['_bmad-output/planning-artifacts/sprint-status.yaml'],
    followUps: ['dev-story'],
  },
  {
    id: 'dev-story',
    name: 'Dev Story',
    phase: WorkflowPhase.Implementation,
    description: 'Execute a story by implementing tasks/subtasks, writing tests, validating, and updating the story file',
    workflowPath: '_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml',
    outputArtifact: 'TBD',
    totalSteps: 1,
    requiredArtifacts: ['_bmad-output/implementation-artifacts/sprint-status.yaml'],
    followUps: ['code-review', 'create-story'],
  },
  {
    id: 'code-review',
    name: 'Code Review',
    phase: WorkflowPhase.Implementation,
    description: 'Perform an adversarial Senior Developer code review that finds specific problems in every story',
    workflowPath: '_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml',
    outputArtifact: '_bmad-output/implementation-artifacts/code-review*.md',
    totalSteps: 1,
    requiredArtifacts: ['_bmad-output/implementation-artifacts/sprint-status.yaml'],
    followUps: ['create-story', 'dev-story'],
  },

  // Quick Phase
  {
    id: 'quick-spec',
    name: 'Quick Spec',
    phase: WorkflowPhase.QuickFlow,
    description: 'Create focused specifications for well-defined features',
    workflowPath: '_bmad/bmm/workflows/bmad-quick-flow/quick-spec/workflow.md',
    outputArtifact: '_bmad-output/implementation-artifacts/tech-spec-*.md',
    totalSteps: 4,
    followUps: ['quick-dev'],
  },
  {
    id: 'quick-dev',
    name: 'Quick Dev',
    phase: WorkflowPhase.QuickFlow,
    description: 'Rapid spec-to-implementation for small features',
    workflowPath: '_bmad/bmm/workflows/bmad-quick-flow/quick-dev/workflow.md',
    requiredArtifacts: ['_bmad-output/implementation-artifacts/tech-spec-*.md'],
    outputArtifact: '_bmad-output/implementation-artifacts/tech-spec-*.md',
    totalSteps: 6,
    followUps: [],
  },
];
