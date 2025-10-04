# Quickstart: ZAI Coding Plan Provider

## Overview
This quickstart guide walks through setting up and using the ZAI coding plan provider in AiderDesk.

## Prerequisites
- AiderDesk installed and running
- ZAI API key (obtain from ZAI platform)

## Setup Steps

### 1. Configure ZAI Provider
1. Open AiderDesk settings
2. Navigate to "Providers" section
3. Click "Add Provider"
4. Select "ZAI Plan" from the provider list
5. Enter your ZAI API key
6. Click "Save"

### 2. Select ZAI Model
1. In the provider configuration, click "Load Models"
2. Wait for model discovery to complete
3. Select your preferred ZAI model
4. Configure model parameters if needed
5. Save the configuration

### 3. Use ZAI in Agent Profile
1. Go to "Agent Profiles" in settings
2. Create new agent profile or edit existing one
3. Select "ZAI Plan" as the provider
4. Choose your configured ZAI model
5. Adjust agent settings as needed
6. Save the agent profile

### 4. Start Using ZAI
1. Open a project in AiderDesk
2. Select your ZAI-configured agent profile
3. Start coding with ZAI's specialized capabilities

## Validation Scenarios

### Scenario 1: Basic Configuration
**Given** I have a valid ZAI API key
**When** I configure the ZAI provider
**Then** the system should successfully load available models

### Scenario 2: Model Selection
**Given** ZAI provider is configured
**When** I select a ZAI model
**Then** the model should be available for use in agent profiles

### Scenario 3: Agent Integration
**Given** ZAI provider and model are configured
**When** I create an agent profile with ZAI
**Then** the agent should use ZAI for coding tasks

### Scenario 4: Error Handling
**Given** Invalid ZAI API key
**When** I try to load models
**Then** the system should display appropriate error message

## Troubleshooting

### Common Issues

**Issue**: Models not loading
- Check API key validity
- Verify network connectivity
- Ensure ZAI service is available

**Issue**: Agent not using ZAI
- Verify agent profile configuration
- Check that ZAI provider is active
- Confirm model selection

**Issue**: Authentication errors
- Validate API key format
- Check API key permissions
- Verify ZAI account status

### Debug Information
Enable debug logging in AiderDesk settings to see detailed ZAI API interactions.

## Advanced Configuration

### Custom Headers
Add custom headers to ZAI API requests if needed for your organization's setup.

### Model Overrides
Configure model-specific parameters like temperature, max tokens, and other settings.

### Performance Tuning
Adjust timeout settings and retry behavior for optimal performance.

## Support
For issues specific to ZAI integration, contact AiderDesk support.
For ZAI API issues, contact ZAI platform support.