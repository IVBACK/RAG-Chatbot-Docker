import json
import os
import logging
from pathlib import Path
from typing import Dict, Optional

class PromptManager:
    def __init__(self, prompts_dir: str = "app/prompts"):
        self.prompts_dir = Path(prompts_dir)
        self.base_prompt = self._load_json_file("base_prompt.json")
        if not self.base_prompt:
            logging.error("Failed to load base prompt file. System may not function correctly.")
            raise RuntimeError("Base prompt file is required but could not be loaded")
        self.translations = self._load_translations()
        logging.info(f"PromptManager initialized with languages: {self.available_languages}")
        
    def _load_json_file(self, filename: str) -> Dict:
        """Load a JSON file from the prompts directory."""
        file_path = self.prompts_dir / filename
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self._validate_prompt_structure(data, filename)
                return data
        except FileNotFoundError:
            logging.error(f"Prompt file not found: {file_path}")
            return {}
        except json.JSONDecodeError as e:
            logging.error(f"Invalid JSON in prompt file {filename}: {e}")
            return {}
        except Exception as e:
            logging.error(f"Error loading {filename}: {e}")
            return {}
            
    def _validate_prompt_structure(self, data: Dict, filename: str) -> None:
        """Validate the structure of a prompt file."""
        required_keys = {"system_prompt"}
        system_prompt_keys = {"role", "constraints", "error_response"}
        
        if not isinstance(data, dict):
            raise ValueError(f"Prompt file {filename} must contain a JSON object")
            
        if not all(key in data for key in required_keys):
            raise ValueError(f"Prompt file {filename} missing required keys: {required_keys}")
            
        system_prompt = data.get("system_prompt", {})
        if not all(key in system_prompt for key in system_prompt_keys):
            raise ValueError(f"system_prompt in {filename} missing required keys: {system_prompt_keys}")
            
        if not isinstance(system_prompt["constraints"], list):
            raise ValueError(f"constraints in {filename} must be a list")
            
    def _load_translations(self) -> Dict:
        """Load all translation files from the translations directory."""
        translations = {}
        translations_dir = self.prompts_dir / "translations"
        
        if not translations_dir.exists():
            logging.warning(f"Translations directory not found: {translations_dir}")
            return translations
            
        for file in translations_dir.glob("*.json"):
            lang_code = file.stem
            try:
                data = self._load_json_file(f"translations/{file.name}")
                if data:  # Only add if valid data was loaded
                    translations[lang_code] = data
                    logging.info(f"Successfully loaded translation for: {lang_code}")
            except Exception as e:
                logging.error(f"Failed to load translation {file.name}: {e}")
            
        return translations
        
    def get_system_prompt(self, lang: str = "en", context: str = "") -> str:
        """
        Generate a system prompt in the specified language.
        Falls back to English if the language is not supported.
        """
        if lang not in self.available_languages:
            logging.warning(f"Language {lang} not supported, falling back to English")
            lang = "en"
            
        # Get the prompt data for the specified language, fallback to base prompt
        prompt_data = self.translations.get(lang, {}).get("system_prompt", 
                                                        self.base_prompt["system_prompt"])
        
        # Construct the prompt
        prompt_parts = [
            prompt_data["role"],
            *prompt_data["constraints"],
            f"If the question cannot be answered using the context, state \"{prompt_data['error_response']}\"",
            "\nContext from documents:",
            "--- BEGIN CONTEXT ---",
            context,
            "--- END CONTEXT ---"
        ]
        
        return "\n".join(prompt_parts)
        
    @property
    def available_languages(self) -> list:
        """Return a list of available language codes."""
        return sorted(list(self.translations.keys()) + ["en"])  # Always include English as it's the base

# Create a singleton instance
_prompt_manager: Optional[PromptManager] = None

def get_prompt_manager() -> PromptManager:
    """Get or create the PromptManager singleton instance."""
    global _prompt_manager
    if _prompt_manager is None:
        _prompt_manager = PromptManager()
    return _prompt_manager 