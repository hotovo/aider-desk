# Research Findings: ZAI Coding Plan Provider

## Provider Integration Research

### Decision: Use OpenAI-Compatible SDK Pattern
**Rationale**: ZAI uses OpenAI-compatible API endpoints, allowing reuse of existing OpenAI-compatible infrastructure while providing distinct provider configuration.

**Key Findings**:
- ZAI API endpoints:
  - Models: `https://api.z.ai/api/paas/v4/models`
  - Chat/Completions: `https://api.z.ai/api/coding/paas/v4`
- Provider prefix: `zai-plan` (distinct from generic `openai-compatible`)
- Integration approach: Extend existing OpenAI-compatible provider pattern

### Provider Type System Research

**Decision**: Add `zai-plan` as new provider type in LlmProviderName union
**Rationale**: Provides distinct provider identity while leveraging OpenAI-compatible SDK

**Implementation Requirements**:
- Add `'zai-plan'` to LlmProviderName type
- Create ZaiPlanProvider interface extending LlmProviderBase
- Add to AVAILABLE_PROVIDERS array
- Implement type guards and default parameters

### UI Component Pattern Research

**Decision**: Follow existing provider UI component structure
**Rationale**: Maintains consistency with existing provider implementations

**Required Components**:
- ZaiPlanParameters.tsx (provider configuration form)
- ZaiPlanModelOverrides.tsx (model-specific settings)
- ZaiPlanAdvancedSettings.tsx (advanced options)
- Provider icon component

### Model Loading Strategy Research

**Decision**: Custom model loading endpoint
**Rationale**: ZAI uses different endpoint for model discovery than chat operations

**Implementation Details**:
- Use `https://api.z.ai/api/paas/v4/models` for model discovery
- Use `https://api.z.ai/api/coding/paas/v4` for chat operations
- Maintain separate base URLs for different operations

### Configuration Management Research

**Decision**: Store ZAI configuration separately from OpenAI-compatible
**Rationale**: Prevents configuration conflicts and allows independent management

**Configuration Fields**:
- API key (required)
- Base URLs (pre-configured, user-configurable for flexibility)
- Model-specific parameters
- Advanced settings (following existing patterns)

## Technical Implementation Research

### Agent Integration Research

**Decision**: Extend existing agent system with ZAI support
**Rationale**: Leverages existing Vercel AI SDK integration patterns

**Integration Points**:
- Model creation using createOpenAICompatible with ZAI endpoints
- Cost calculation following existing patterns
- Usage reporting integration
- Aider mapping with `zai-plan` prefix

### Error Handling Research

**Decision**: Implement ZAI-specific error handling
**Rationale**: Provides better user experience for ZAI-specific issues

**Error Scenarios**:
- Invalid API credentials
- Service unavailability
- Model loading failures
- Network connectivity issues

### Performance Considerations Research

**Decision**: Optimize for <200ms response times
**Rationale**: Meets constitutional performance requirements

**Optimization Strategies**:
- Efficient model caching
- Connection pooling
- Proper timeout handling
- Graceful degradation

## Alternatives Considered

### Alternative 1: Extend OpenAI-Compatible Provider
**Rejected Because**: Would not provide distinct provider identity and configuration separation

### Alternative 2: Custom SDK Implementation
**Rejected Because**: Unnecessary complexity when OpenAI-compatible pattern works well

### Alternative 3: Generic HTTP Client
**Rejected Because**: Would lose Vercel AI SDK benefits and existing infrastructure

## Conclusion

The research confirms that implementing ZAI as a distinct provider using the OpenAI-compatible SDK pattern is the optimal approach. This provides:
- Clear provider identity
- Configuration separation
- Leverage of existing infrastructure
- Consistent user experience
- Performance optimization opportunities

All technical unknowns have been resolved, and implementation can proceed with confidence.