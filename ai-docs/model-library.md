# Model Library & Provider Management Refactoring Specification

## 1. Overview & Goal

The current system for managing LLM providers is based on a static list of `AVAILABLE_PROVIDERS`, with a single, global configuration for each. This is inflexible and does not allow users to configure multiple accounts for the same provider (e.g., two different OpenAI accounts) or easily manage custom provider setups.

The goal of this refactoring is to transition to a dynamic, user-centric system where users can create, manage, and use multiple **Provider Profiles**. Each profile will represent a specific, named configuration for an LLM provider.

## 2. Core Architecture Changes

### 2.1. Data Structure: The `LlmProviderProfile`

The `LlmProviderProfile` will become the single source of truth for a provider's configuration. The existing `settings.llmProviders` record will be deprecated and removed.

**File:** `src/common/types.ts`

```typescript
// This will be the new structure stored in the settings
export interface LlmProviderProfile {
  id: string; // Unique UUID for the profile
  name: string; // User-defined name (e.g., "Personal OpenAI", "Work Gemini")
  provider: LlmProviderName; // The type of provider (e.g., 'openai', 'gemini')
  prefix: string; // User-defined prefix for models (e.g., "openai-pers/")
  parameters: LlmProvider; // The provider-specific configuration object (e.g., OpenAiProvider with apiKey)
  headers?: Record<string, string>; // Optional custom headers for API requests
}

// In SettingsData, llmProviders will be removed and replaced
export interface SettingsData {
  // ... other settings
  llmProviderProfiles: LlmProviderProfile[];
  // llmProviders: { ... } // This will be removed
  // ... other settings
}
```

### 2.2. Main Process: `ModelManager`

`ModelManager` will be refactored to load models based on the list of `LlmProviderProfile`s instead of the static `AVAILABLE_PROVIDERS` and `settings.llmProviders`.

**File:** `src/main/models/model-manager.ts`

-   The `loadProviderModels` method will now accept an array of `LlmProviderProfile`s.
-   It will iterate over this array, invoking the appropriate model loader (e.g., `loadOpenAiModels`) for each profile and passing the `profile.parameters` as the configuration.
-   This change decouples model loading from the global settings object.

### 2.3. Data Storage & Migration: `Store`

A migration script is required to seamlessly transition existing users.

**File:** `src/main/store/store.ts` & `src/main/store/migrations/`

-   A new top-level key `llmProviderProfiles: LlmProviderProfile[]` will be added to the store's schema.
-   A migration script will be created to:
    1.  Read the old `settings.llmProviders` object.
    2.  For each configured provider in the object, create a new `LlmProviderProfile`.
    3.  Generate a UUID for `id`, create a default `name` and `prefix` (e.g., "OpenAI" and "openai/"), and move the configuration into the `parameters` field.
    4.  Save the new array to `settings.llmProviderProfiles`.
    5.  Unset the old `settings.llmProviders` key.

## 3. API Layer

The API will be updated to support the new profile-based system.

**File:** `src/common/api.ts` & `src/main/events-handler.ts`

1.  **Modify `updateProviders`:**
    -   The existing `updateProviders(providers: LlmProviderProfile[]): Promise<LlmProviderProfile[]>` will be the primary method for all CRUD operations.
    -   The frontend will manage the list of profiles in its state and send the entire updated array to the backend, which will then persist it.

2.  **New Method `getModelsForProviderProfile`:**
    -   **Signature:** `getModelsForProviderProfile(profile: LlmProviderProfile): Promise<Model[]>`
    -   **Purpose:** To provide immediate user feedback during profile setup. This endpoint will take a (potentially unsaved) profile configuration, attempt to fetch models using it, and return the list of models if successful or throw an error if the configuration is invalid (e.g., bad API key).

## 4. UI/UX Refactoring (Renderer)

### 4.1. `ModelLibrary.tsx` - The Central Hub

This component will be the main entry point for viewing models and managing provider profiles.

-   **Initial State (No Profiles):** If `llmProviderProfiles` is empty, the view will directly display the grid of provider cards (see Section 4.3, Step 1), inviting the user to create their first profile.
-   **Main View (With Profiles):**
    -   The provider filter `MultiSelect` will be populated with the user's configured profiles (`profile.name` as the label, `profile.id` as the value).
    -   A **"Manage Providers"** button will be present. Clicking it opens the "Provider Profiles Management" view.

### 4.2. New View: Provider Profiles Management

This will be a new modal or dedicated view for managing all profiles.

-   It will display a list of all existing `LlmProviderProfile`s.
-   Each item in the list will show the profile's name and provider type.
-   Each item will have **"Edit"** and **"Delete"** buttons.
-   A prominent **"+ Add Provider Profile"** button will be at the top or bottom of the list.

### 4.3. New Workflow: Adding/Editing a Profile

1.  **Step 1: Select Provider Type**
    -   Triggered by clicking "+ Add Provider Profile".
    -   The user is shown a grid of cards, each representing a provider type from `AVAILABLE_PROVIDERS` (e.g., OpenAI, Gemini), complete with name and icon.
    -   Selecting a provider type proceeds to the configuration form.

2.  **Step 2: Configure Profile (Provider Profile Form)**
    -   This is a new reusable form component.
    -   **Inputs:**
        1.  **Profile Name:** Text input (e.g., "Work Gemini").
        2.  **Model Prefix:** Text input (e.g., "gemini-work/").
        3.  **Provider Parameters:** The relevant parameters component (e.g., `<GeminiParameters />`, `<OpenAiParameters />`) is dynamically rendered here.
        4.  **Custom Headers:** A section for adding key-value pairs for custom HTTP headers.
    -   **Actions:**
        1.  **"Test & Load Models" Button:** Calls the new `getModelsForProviderProfile` API endpoint to validate the configuration and show the user which models can be loaded.
        2.  **"Save" Button:** Saves the profile (either creating a new one or updating an existing one).
        3.  **"Cancel" Button:** Closes the form without saving.
