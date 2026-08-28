---
title: "Subagents"
sidebar_label: "Subagents"
---

# Subagents

## Table of Contents

- [What are Subagents?](#what-are-subagents)
- [Key Benefits](#key-benefits)
- [Getting Started](#getting-started)
- [Subagent Configuration](#subagent-configuration)
- [Using Subagents Effectively](#using-subagents-effectively)
- [Example Subagents](#example-subagents)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)

Subagents are specialized AI assistants that can be created and configured within AiderDesk to handle specific types of tasks. They enable more efficient problem-solving by providing task-specific configurations with customized system prompts and separate tool access permissions.

## What are Subagents?

Subagents are specialized AI profiles that can be delegated specific tasks by the main agent. Each subagent:

- Has a specific purpose and expertise area defined by its system prompt
- Operates with its own tool access permissions and settings
- Can be invoked automatically based on task descriptions or on-demand when explicitly requested
- Maintains visual distinction with color-coded indicators in the interface

When the main agent encounters a task that matches a subagent's expertise, it can delegate that task to the specialized subagent, which works independently and returns results.

## Key Benefits

### Context Preservation
Each subagent operates with its own focused context, preventing pollution of the main conversation and keeping primary discussions centered on high-level objectives.

### Specialized Expertise
Subagents can be configured with detailed system prompts for specific domains, leading to higher success rates on designated tasks through specialized knowledge and approaches.

### Reusability
Once created, subagents can be used across different projects and shared within your team for consistent workflows and specialized task handling.

### Flexible Permissions
Each subagent can have different tool access levels and approval settings, allowing you to limit powerful tools to specific subagent types and maintain control over automated actions.

### Cost Optimization
Subagents enable strategic model selection for different tasks, significantly reducing costs while maintaining performance. You can configure cost-effective models like Gemini Flash or Claude Haiku for routine tasks (code reviews, testing), premium models for complex development work, and specialized models like Claude Opus for architectural planning and high-level design decisions. This granular control over model selection per task type optimizes your AI spending without compromising quality.

## Getting Started

### Creating a Subagent

1. **Open Agent Settings**
   - Navigate to **Settings > Agent** in the AiderDesk interface

2. **Create or Edit a Profile**
   - Create a new agent profile or edit an existing one
   - Enable the **"Enable as Subagent"** option in the profile's Subagent section

3. **Configure Subagent Settings**
   - **System Prompt**: Define the subagent's role, capabilities, and approach
   - **Invocation Mode**: Choose between Automatic or On-demand
   - **Color**: Select a visual identifier for the subagent
   - **Description**: For automatic subagents, describe when this subagent should be used

4. **Save and Use**
   - Your subagent is now available and will be used according to its invocation mode
   - Subagents appear with color-coded indicators in the interface

## Subagent Configuration

### Core Settings

#### Enable as Subagent
Toggle this option to convert an agent profile into a subagent. Once enabled, the profile becomes available for task delegation.

![Subagent configuration in an agent profile](../images/am-subagent-config.png)

#### System Prompt
The system prompt defines the subagent's behavior, expertise, and approach to problem-solving. This is the most important configuration aspect:

```markdown
You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is simple and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed
```

#### Invocation Mode

**Automatic**
- The main agent will proactively use this subagent based on the task description
- Requires a description field that explains when the subagent should be used
- Ideal for specialized tasks that occur frequently

**On-demand**
- The subagent is only used when explicitly requested by the user
- No description field needed
- Perfect for specialized or sensitive tasks that should not run automatically

#### Color
Select a color that visually identifies the subagent in the interface. This helps users quickly identify which subagent is active and track its actions.

#### Description (Automatic mode only)
For automatic subagents, provide a clear description of when this subagent should be invoked. The main agent uses this description to determine if a task matches the subagent's expertise.

Example: "Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code."

### Tool Access and Permissions

Subagents inherit tool permissions from the profile:

- **Tool Groups**: Configure access to Power Tools, Aider Tools, Todo Tools, Task Tools, Memory Tools, and Skills Tools
- **Individual Tool Approvals**: Set approval levels for each tool (Ask, Always, Never)
- **MCP Servers**: Control access to external Model Context Protocol servers

Subagents run with optimized settings:
- **Context Memory mode**: Choose whether the subagent keeps *Full Context* of previous runs, only the *Last Message*, or starts fresh (*Off*)
- **No nested subagents**: Subagents cannot spawn further subagents, preventing infinite loops
- **Focused context**: Limited file and rule inclusion keeps work targeted and costs down

## Using Subagents Effectively

### Automatic Invocation

Automatic subagents work proactively based on:
- The task description in your request
- The `description` field in the subagent configuration
- Current context and available tools

**Example automatic triggers:**
- "Review my recent code changes" → Code reviewer subagent
- "Run tests and fix any failures" → Test runner subagent
- "Analyze this error and debug it" → Debugger subagent

### Explicit Invocation

Request a specific subagent by mentioning it in your commands:

```
> Use the code reviewer subagent to check my recent changes
> Have the debugger subagent investigate this error:
> Ask the test runner subagent to verify the build
```

### Best Practices

1. **Design focused subagents**: Create subagents with single, clear responsibilities rather than trying to make one subagent do everything

2. **Write detailed system prompts**: Include specific instructions, examples, and constraints in your system prompts. The more guidance you provide, the better the subagent will perform

3. **Use appropriate invocation modes**:
   - Use **Automatic** for frequent, well-defined tasks
   - Use **On-demand** for specialized, sensitive, or infrequent tasks

4. **Configure conservative tool access**: Only grant tools that are necessary for the subagent's purpose. This improves security and helps the subagent focus on relevant actions

5. **Test subagents thoroughly**: Validate subagent behavior on non-critical tasks before relying on them for important work

6. **Monitor subagent performance**: Pay attention to how well subagents perform their tasks and refine their system prompts and permissions accordingly

7. **Optimize model selection strategically**:
   - Use cost-effective models like **Gemini Flash** or **Claude Haiku** for routine tasks (code reviews, testing, documentation)
   - Use premium models for complex development tasks requiring deep reasoning
   - Use specialized planning models like **Claude Opus** for architectural decisions, project planning, and high-level design work
   - Balance cost vs. performance based on task complexity and criticality

## Example Subagents

### Code Reviewer

**Configuration:**
- **Invocation Mode**: Automatic
- **System Prompt**:
```
You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run `git diff` to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is simple and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.
```
- **Description**:
 ```
 Expert code review specialist. Should be used proactively to review code for quality, security, and maintainability.
 Use immediately after finishing complex changes in the code.
 ```
- **Recommended Model**: Gemini Flash or Claude Haiku for cost-effective code reviews
- **Tools**: Power tools with `bash` and `file_read` set to Always


## Advanced Usage

### Chaining Subagents

For complex workflows, you can chain multiple subagents:

```
> First use the code analyzer subagent to find performance issues, then use the optimizer subagent to fix them
```

### Context Management

Subagents work with optimized contexts:
- **Limited file inclusion**: Only essential files are included for cost efficiency
- **Focused prompts**: Subagents receive clear, task-specific instructions
- **Isolated execution**: Each subagent runs independently without affecting the main conversation

### Cost Management Strategies

Effective subagent configuration requires strategic model selection to balance cost and performance:

#### Model Selection Guidelines
- **Planning & Architecture**: Use **Claude Opus** for high-level design decisions, project planning, and complex architectural work where deep reasoning is critical
- **Development & Coding**: Use premium models (Claude 3.5 Sonnet, GPT-4) for complex implementation tasks, debugging, and feature development
- **Code Review & Testing**: Use **Gemini Flash** or **Claude Haiku** for routine code reviews, test execution, and quality assurance tasks
- **Documentation & Maintenance**: Use cost-effective models for documentation updates, refactoring suggestions, and maintenance tasks

#### Cost vs. Performance Tradeoffs
- **Critical Path Tasks**: Invest in premium models for core functionality and user-facing features
- **Support Tasks**: Use cost-effective models for validation, testing, and documentation
- **Batch Processing**: Configure subagents with cheaper models for bulk operations and repetitive tasks

This strategic approach ensures optimal AI spending while maintaining high-quality output across all task types.

### Performance Considerations

- **Cost optimization**: Subagents use reduced context windows and tool permissions
- **Strategic model selection**: Configure different models per subagent to optimize costs - use Claude Opus for planning/architectural tasks, premium models for complex development, and cost-effective models like Gemini Flash or Claude Haiku for routine tasks
- **Speed**: Focused subagents can complete specialized tasks faster than general-purpose agents
- **Reliability**: Specialized prompts lead to more consistent and accurate results

## Troubleshooting

### Common Issues

**Subagent not being invoked automatically**
- Verify the subagent is enabled and in Automatic mode
- Check that the description field clearly describes when to use the subagent

**Subagent failing to complete tasks**
- Review the system prompt for clarity and completeness
- Check that the subagent has access to necessary tools
- Verify tool approval settings aren't blocking required actions

**Performance issues**
- Monitor token usage and adjust context settings
- Consider breaking complex tasks into smaller subagent calls
- Review and optimize system prompts for efficiency

### Getting Help

- Check the agent logs for detailed subagent execution information
- Review tool approval settings in the Agent Settings
- Test subagents with simple tasks to isolate configuration issues

Subagents in AiderDesk provide a powerful way to specialize AI assistance for your specific workflow needs, enabling more efficient, reliable, and cost-effective AI-powered development.
