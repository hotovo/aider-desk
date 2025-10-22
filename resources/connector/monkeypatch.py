#!/usr/bin/env python

import yaml
from pathlib import Path
from aider import models
from logger import log_info, log_error

def load_monkey_patch_models():
    """Load models to monkey patch from YAML configuration file."""
    config_path = Path(__file__).parent / "monkey_patch_models.yaml"
    
    if not config_path.exists():
        log_error(f"Monkey patch config file not found: {config_path}")
        return []
    
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
            return config.get('models', [])
    except Exception as e:
        log_error(f"Error loading monkey patch config: {e}")
        return []

def monkey_patch_model_settings():
    """Add missing models to aider's MODEL_SETTINGS."""
    
    # Load models to patch from YAML config
    models_to_patch = load_monkey_patch_models()
    
    if not models_to_patch:
        log_info("No models to monkey patch")
        return
    
    # Check if models already exist and add them if they don't
    existing_model_names = {model_settings.name for model_settings in models.MODEL_SETTINGS}
    
    for model_config in models_to_patch:
        model_name = model_config['name']
        
        if model_name not in existing_model_names:
            try:
                # Try to create using the dataclass if available
                if hasattr(models, 'ModelSettings') and callable(models.ModelSettings):
                    model_settings = models.ModelSettings(**model_config)
                    log_info(f"Created model using ModelSettings constructor: {model_name}")
                else:
                    # Fallback: create a simple object and copy methods from existing model
                    model_settings = type('ModelSettings', (), model_config)()
                    
                    # Copy methods from an existing ModelSettings object
                    if models.MODEL_SETTINGS:
                        existing_model = models.MODEL_SETTINGS[0]
                        for attr_name in dir(existing_model):
                            if callable(getattr(existing_model, attr_name)) and not attr_name.startswith('_'):
                                setattr(model_settings, attr_name, getattr(existing_model, attr_name))
                    
                    log_info(f"Created model using fallback method: {model_name}")
                
                # Add it to the MODEL_SETTINGS list
                models.MODEL_SETTINGS.append(model_settings)
                log_info(f"Added model: {model_name}")
                
            except Exception as e:
                log_error(f"Failed to create model settings for {model_name}: {e}")
        else:
            # Model exists, check if it has cache_control enabled
            for existing_model in models.MODEL_SETTINGS:
                if existing_model.name == model_name:
                    if 'cache_control' in model_config and (not hasattr(existing_model, 'cache_control') or not existing_model.cache_control):
                        # Enable cache_control for existing model
                        existing_model.cache_control = model_config['cache_control']
                        log_info(f"Enabled caching for existing model: {model_name}")
                    break
